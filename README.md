# Gemini Visual Reviewer

Backend-only visual UX review service for the Screenroot design workflow, deployed on Vercel.

## Purpose

This service is an independent visual-review layer. It receives a Figma screenshot plus product/task context, sends the image to Gemini 3.8 Flash, and returns structured UX, visual and business/funnel findings.

It has **no browser reviewer UI and no Figma write access**.

## Architecture

`ChatGPT → Figma MCP screenshot → Vercel /api/review → Gemini Vision → JSON analysis → ChatGPT`

Gemini is read-only. It must never modify Figma, GitHub, project files, approvals, or access-control rules.

## API

### `GET /api/review`

Designed for ChatGPT-driven reviews where the screenshot already exists as a Figma-hosted URL.

Required:
- `image_url` — HTTPS Figma screenshot URL

Optional:
- `screen` — screen name, e.g. `NTB` or `Rejected`
- `task` — change being reviewed
- `context` — product/business context and constraints
- `focus` — `full`, `hierarchy`, `mobile`, `conversion`, or `visual`
- `mode` — `post_change`, `pre_change`, or `comparison`

The response is JSON containing the review plus the supplied metadata and model name.

### `POST /api/review`

Accepts JSON with either:
- `image_url` (preferred for Figma screenshots), or
- `image_data` + optional `mime_type`

It accepts the same `screen`, `task`, `context`, `focus`, and `mode` fields as GET.

## Review output

The structured review contains:
- `score` — 0–100
- `verdict`
- `critical_issues`
- `ux_issues`
- `visual_issues`
- `business_opportunities`
- `recommended_fixes`
- `high_fidelity_polish`
- `do_not_change`
- `assumptions`

Issues include severity, visible evidence and impact. Recommended fixes include priority, before/after direction and rationale.

## Intended ChatGPT loop

1. Inspect the allowed Figma screen.
2. Form the UX/product hypothesis.
3. Make the requested Figma change.
4. Take a fresh Figma screenshot.
5. Call `/api/review` with screenshot + task/context.
6. Compare Gemini's independent findings with the designer analysis.
7. Fix missed high-impact issues in Figma when appropriate.
8. Re-screenshot and optionally re-review.

Gemini is a critic, not the source of truth: product requirements and the approved design intent remain authoritative.

## Security / limits

- `GEMINI_API_KEY` stays server-side in Vercel environment variables.
- URL-based images are restricted to HTTPS Figma hosts.
- Remote screenshots are limited to 15 MB.
- Inline base64 images are limited to keep requests within serverless request limits; Figma URLs are preferred.
- The endpoint does not expose or accept Figma write operations.

## Environment variables

- `GEMINI_API_KEY` — required secret in Vercel.
- `GEMINI_MODEL` — optional; defaults to `gemini-3.8-flash`.
