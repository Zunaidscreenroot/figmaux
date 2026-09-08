const MAX_IMAGE_BYTES = 15 * 1024 * 1024;
const MAX_INLINE_BASE64_CHARS = 5_500_000;
const ALLOWED_FIGMA_HOSTS = ["figma.com", "www.figma.com", "figmausercontent.com", "www.figmausercontent.com"];

const ISSUE_SCHEMA = {
  type: "object",
  properties: {
    severity: { type: "string", enum: ["critical", "high", "medium", "low"] },
    title: { type: "string" },
    evidence: { type: "string" },
    impact: { type: "string" },
  },
  required: ["severity", "title", "evidence", "impact"],
  additionalProperties: false,
};

const FIX_SCHEMA = {
  type: "object",
  properties: {
    priority: { type: "string", enum: ["P0", "P1", "P2", "P3"] },
    before: { type: "string" },
    after: { type: "string" },
    rationale: { type: "string" },
  },
  required: ["priority", "before", "after", "rationale"],
  additionalProperties: false,
};

const REVIEW_SCHEMA = {
  type: "object",
  properties: {
    score: { type: "integer", minimum: 0, maximum: 100 },
    verdict: { type: "string" },
    critical_issues: { type: "array", items: ISSUE_SCHEMA },
    ux_issues: { type: "array", items: ISSUE_SCHEMA },
    visual_issues: { type: "array", items: ISSUE_SCHEMA },
    business_opportunities: { type: "array", items: { type: "string" } },
    recommended_fixes: { type: "array", items: FIX_SCHEMA },
    high_fidelity_polish: { type: "array", items: { type: "string" } },
    do_not_change: { type: "array", items: { type: "string" } },
    assumptions: { type: "array", items: { type: "string" } },
  },
  required: ["score", "verdict", "critical_issues", "ux_issues", "visual_issues", "business_opportunities", "recommended_fixes", "high_fidelity_polish", "do_not_change", "assumptions"],
  additionalProperties: false,
};

function json(data: unknown, status = 200) {
  return Response.json(data, { status, headers: { "cache-control": "no-store" } });
}

function isAllowedImageUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && ALLOWED_FIGMA_HOSTS.some((host) => url.hostname === host || url.hostname.endsWith(`.${host}`));
  } catch {
    return false;
  }
}

function buildPrompt({ context, task, screen, focus, mode }: Record<string, string>) {
  return `You are an independent senior product designer, UX auditor and conversion-focused reviewer. Review the supplied mobile UI screenshot strictly as visual evidence.

SCREEN: ${screen || "unspecified"}
REVIEW MODE: ${mode || "post_change"}
TASK / INTENDED CHANGE:
${task || "No task supplied. Identify the highest-impact issues visible in the screen."}

PRODUCT CONTEXT:
${context || "No product context supplied. Infer only what is visibly supported and clearly label assumptions."}

REQUESTED FOCUS: ${focus || "full"}

Your review is independent of the designer/agent that created the screen. Be critical, specific and implementation-oriented. Do not flatter the design and do not invent functionality, data or states that are not visible.

Evaluate:
1. Visual hierarchy and whether the primary user goal is immediately obvious.
2. Information architecture, repetition, density, scanning and unnecessary vertical space.
3. Layout, spacing, alignment, grid, card geometry and component consistency.
4. Typography, readability, contrast, hierarchy and content clarity.
5. Interaction affordances, CTA hierarchy, tap targets and mobile thumb reach. Do not assume every CTA must be right-aligned.
6. Whether the screen follows the supplied product hierarchy and business intent.
7. Funnel/conversion opportunities that can improve engagement or progression without adding clutter.
8. Accessibility and obvious usability risks.
9. High-fidelity quality: rhythm, visual balance, states implied by the UI, polish and platform conventions.

Review rules:
- Separate actual visible defects from strategic/product recommendations.
- Prefer fewer, stronger findings over generic checklists.
- Use concrete evidence from the screenshot for every issue.
- Never recommend adding UI just to occupy empty space.
- If a carousel, compact card pattern or progressive disclosure would reduce clutter, explain the specific trade-off.
- Preserve things that are already working.
- Do not make claims about behavior that cannot be established from the screenshot.
- Score the current screen, not the hypothetical improved version.
- If the design is already strong, say so and focus only on meaningful residual issues.

Return JSON matching the supplied response schema exactly. Keep arrays concise and high-signal.`;
}

async function imageFromUrl(url: string) {
  if (!isAllowedImageUrl(url)) throw new Error("Only HTTPS Figma screenshot URLs are accepted.");
  const response = await fetch(url, { redirect: "follow" });
  if (!response.ok) throw new Error(`Could not fetch the Figma screenshot (${response.status}).`);
  const contentLength = Number(response.headers.get("content-length") || 0);
  if (contentLength > MAX_IMAGE_BYTES) throw new Error("Screenshot is larger than 15 MB.");
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength > MAX_IMAGE_BYTES) throw new Error("Screenshot is larger than 15 MB.");
  const mime = (response.headers.get("content-type") || "image/png").split(";")[0];
  if (!mime.startsWith("image/")) throw new Error("The supplied Figma URL did not return an image.");

  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  return { data: btoa(binary), mime_type: mime };
}

function extractOutput(body: any) {
  if (typeof body?.output_text === "string") return body.output_text.trim();
  const steps = Array.isArray(body?.steps) ? body.steps : [];
  const modelStep = [...steps].reverse().find((step: any) => step?.type === "model_output");
  const content = modelStep?.content;
  if (Array.isArray(content)) return content.filter((item: any) => item?.type === "text").map((item: any) => item.text).join("\n").trim();
  return "";
}

function parseJsonOutput(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    const fenced = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i)?.[1];
    if (fenced) return JSON.parse(fenced);
    throw new Error("Gemini returned invalid structured JSON.");
  }
}

function getEnv(name: string) {
  return ((globalThis as any).process?.env?.[name] as string | undefined) || undefined;
}

function getGeminiModels() {
  const primary = getEnv("GEMINI_MODEL") || "gemini-3.8-flash";
  const configuredFallbacks = (getEnv("GEMINI_FALLBACK_MODELS") || "")
    .split(",")
    .map((model) => model.trim())
    .filter(Boolean);

  const defaultFallbacks = [
    "gemini-3.7-flash",
    "gemini-3.6-flash",
    "gemini-3.5-flash",
    "gemini-3.5-flash-lite",
    "gemini-2.5-flash",
  ];

  return [...new Set([primary, ...configuredFallbacks, ...defaultFallbacks])];
}

function isTransientGeminiFailure(status: number, message: string) {
  if ([408, 429, 500, 502, 503, 504].includes(status)) return true;
  const normalized = message.toLowerCase();
  return normalized.includes("high demand") || normalized.includes("temporarily unavailable") || normalized.includes("overloaded") || normalized.includes("rate limit") || normalized.includes("resource exhausted") || normalized.includes("quota");
}

async function requestGeminiModel(image: { data: string; mime_type: string }, prompt: string, model: string, key: string, signal: AbortSignal) {
  const response = await fetch("https://generativelanguage.googleapis.com/v1beta/interactions", {
    method: "POST",
    headers: { "content-type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify({
      model,
      input: [
        { type: "image", data: image.data, mime_type: image.mime_type, resolution: "high" },
        { type: "text", text: prompt },
      ],
      response_format: {
        type: "text",
        mime_type: "application/json",
        schema: REVIEW_SCHEMA,
      },
    }),
    signal,
  });
  const body = await response.json();
  const message = body?.error?.message || `Gemini request failed (${response.status}).`;
  if (!response.ok) {
    const error = new Error(message) as Error & { status?: number };
    error.status = response.status;
    throw error;
  }
  const output = extractOutput(body);
  if (!output) throw new Error("Gemini returned no review.");
  return { review: parseJsonOutput(output), model };
}

async function callGemini(image: { data: string; mime_type: string }, prompt: string) {
  const key = getEnv("GEMINI_API_KEY");
  const models = getGeminiModels();
  if (!key) throw new Error("GEMINI_API_KEY is not configured on Vercel.");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 55_000);
  const failures: Array<{ model: string; message: string }> = [];

  try {
    for (const model of models) {
      try {
        return await requestGeminiModel(image, prompt, model, key, controller.signal);
      } catch (error) {
        const status = typeof (error as any)?.status === "number" ? (error as any).status : 0;
        const message = error instanceof Error ? error.message : "Unknown Gemini error.";
        failures.push({ model, message });

        if (!isTransientGeminiFailure(status, message)) throw error;
        if (controller.signal.aborted) throw error;
      }
    }

    const attempted = failures.map((failure) => `${failure.model}: ${failure.message}`).join(" | ");
    throw new Error(`All Gemini review models were temporarily unavailable. Attempted: ${attempted}`);
  } finally {
    clearTimeout(timeout);
  }
}

function getReviewInputs(params: URLSearchParams) {
  return { context: params.get("context") || "", task: params.get("task") || "", screen: params.get("screen") || "", focus: params.get("focus") || "full", mode: params.get("mode") || "post_change" };
}

async function handle(request: Request) {
  const url = new URL(request.url);
  if (request.method === "GET") {
    const imageUrl = url.searchParams.get("image_url");
    if (!imageUrl) return json({ ok: false, error: "Missing image_url. Pass a Figma screenshot URL." }, 400);
    try {
      const image = await imageFromUrl(imageUrl);
      const inputs = getReviewInputs(url.searchParams);
      const result = await callGemini(image, buildPrompt(inputs));
      return json({ ok: true, ...inputs, ...result });
    } catch (error) {
      return json({ ok: false, error: error instanceof Error ? error.message : "Unknown reviewer error." }, 500);
    }
  }

  if (request.method !== "POST") return json({ ok: false, error: "Use GET with image_url or POST with JSON." }, 405);
  try {
    const body = await request.json();
    let image: { data: string; mime_type: string };
    if (typeof body.image_data === "string" && body.image_data.length) {
      if (body.image_data.length > MAX_INLINE_BASE64_CHARS) throw new Error("Screenshot is too large for an inline request. Use a Figma screenshot URL instead.");
      image = { data: body.image_data, mime_type: body.mime_type || "image/png" };
    } else if (typeof body.image_url === "string") {
      image = await imageFromUrl(body.image_url);
    } else {
      return json({ ok: false, error: "Provide image_data or image_url." }, 400);
    }
    const inputs = { context: body.context || "", task: body.task || "", screen: body.screen || "", focus: body.focus || "full", mode: body.mode || "post_change" };
    const result = await callGemini(image, buildPrompt(inputs));
    return json({ ok: true, ...inputs, ...result });
  } catch (error) {
    return json({ ok: false, error: error instanceof Error ? error.message : "Unknown reviewer error." }, 500);
  }
}

export default { fetch: handle };
