#!/usr/bin/env python3
"""Call Gemini directly through the Gemini API for the FigmaUX second-opinion layer.

No Gemini CLI is required. The script reads GEMINI_API_KEY from the process
environment, or from the local .gemini/.env file (which must never be committed).
"""

from __future__ import annotations

import argparse
import base64
import json
import mimetypes
import os
from pathlib import Path
import sys
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

API_URL = "https://generativelanguage.googleapis.com/v1beta/interactions"
DEFAULT_MODEL = "gemini-3.8-flash"


def load_local_env() -> None:
    """Load simple KEY=value pairs from .gemini/.env without adding a dependency."""
    if os.environ.get("GEMINI_API_KEY"):
        return

    env_file = Path(__file__).resolve().parents[1] / ".gemini" / ".env"
    if not env_file.is_file():
        return

    for raw_line in env_file.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip("\"'")
        if key and value and key not in os.environ:
            os.environ[key] = value


def image_part(path: Path) -> dict:
    mime = mimetypes.guess_type(path.name)[0]
    if mime not in {"image/jpeg", "image/png", "image/webp", "image/gif"}:
        raise ValueError(f"Unsupported image type: {path}")
    data = base64.b64encode(path.read_bytes()).decode("ascii")
    return {"type": "image", "data": data, "mime_type": mime}


def extract_output(payload: dict) -> str:
    chunks: list[str] = []
    for step in payload.get("steps", []):
        if step.get("type") != "model_output":
            continue
        for item in step.get("content", []):
            if item.get("type") == "text" and item.get("text"):
                chunks.append(item["text"])
    if chunks:
        return "\n".join(chunks)
    return json.dumps(payload, indent=2)


def call_gemini(prompt: str, images: list[Path], model: str) -> str:
    load_local_env()
    api_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
    if not api_key:
        raise RuntimeError(
            "GEMINI_API_KEY is not available. Set it in the environment or in "
            ".gemini/.env (never commit that file)."
        )

    parts: list[dict] = [{"type": "text", "text": prompt}]
    for image in images:
        if not image.is_file():
            raise FileNotFoundError(image)
        parts.append(image_part(image))

    body = {
        "model": model,
        "store": False,
        "input": parts,
        "system_instruction": (
            "You are the independent UX critic for a product design agent. "
            "Be evidence-driven. Separate observations from hypotheses. "
            "Do not claim research, analytics, stakeholder input, or KPI impact "
            "that was not supplied. Return actionable critique, not implementation."
        ),
    }

    request = Request(
        API_URL,
        data=json.dumps(body).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "x-goog-api-key": api_key,
        },
        method="POST",
    )

    try:
        with urlopen(request, timeout=120) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"Gemini API HTTP {exc.code}: {detail}") from exc
    except URLError as exc:
        raise RuntimeError(f"Gemini API connection failed: {exc.reason}") from exc

    return extract_output(payload)


def main() -> int:
    parser = argparse.ArgumentParser(description="Run the FigmaUX Gemini API critic")
    parser.add_argument("--prompt", required=True, help="Review brief for Gemini")
    parser.add_argument("--image", action="append", default=[], help="Optional local image path; repeatable")
    parser.add_argument("--model", default=os.environ.get("GEMINI_MODEL", DEFAULT_MODEL))
    args = parser.parse_args()

    try:
        result = call_gemini(args.prompt, [Path(p) for p in args.image], args.model)
    except Exception as exc:  # noqa: BLE001 - CLI should return a useful failure to Codex.
        print(f"GEMINI_API_ERROR: {exc}", file=sys.stderr)
        return 1

    print(result)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
