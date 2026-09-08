const MAX_IMAGE_BYTES = 15 * 1024 * 1024;
const MAX_INLINE_BASE64_CHARS = 5_500_000;
const ALLOWED_FIGMA_HOSTS = ["figma.com", "www.figma.com", "figmausercontent.com", "www.figmausercontent.com"];

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}

function isAllowedImageUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && ALLOWED_FIGMA_HOSTS.some((host) => url.hostname === host || url.hostname.endsWith(`.${host}`));
  } catch {
    return false;
  }
}

function extractOutput(body) {
  if (typeof body?.output_text === "string") return body.output_text;
  const steps = Array.isArray(body?.steps) ? body.steps : [];
  const modelStep = [...steps].reverse().find((step) => step?.type === "model_output");
  const content = modelStep?.content;
  if (Array.isArray(content)) {
    return content.filter((item) => item?.type === "text").map((item) => item.text).join("\n").trim();
  }
  return "";
}

function buildPrompt(context, focus) {
  return `You are an independent senior product designer and UX reviewer. Review the supplied mobile UI screenshot as evidence, not as a generic design exercise.

Review context:
${context || "No product context supplied. Infer only what is visibly supported and clearly label assumptions."}

Requested focus: ${focus || "full"}

Your job is to find real visual and UX problems that a designer should fix before calling the screen high-fidelity. Do not flatter the design and do not invent functionality that is not visible.

Evaluate:
1. Visual hierarchy and whether the primary user goal is immediately obvious.
2. Information architecture, repetition, density and unnecessary vertical space.
3. Layout, spacing, alignment, grids, card geometry and consistency.
4. Typography, readability, contrast, hierarchy and scanning.
5. Interaction affordances, CTA hierarchy, tap targets and mobile thumb reach.
6. Content clarity and whether labels/copy support the intended business goal.
7. Conversion/funnel opportunities: what could increase engagement, progression or completion without adding clutter.
8. Accessibility and obvious usability risks.
9. High-fidelity polish: visual rhythm, states implied by the design, component consistency and platform conventions.

Important constraints:
- Prefer fewer, stronger recommendations over a long generic checklist.
- Distinguish visual defects from product/strategy recommendations.
- Do not recommend adding UI merely to fill empty space.
- If a carousel, compact card pattern or progressive disclosure would reduce clutter, explain why and what should remain visible.
- For mobile screens, consider one-handed use and reachable primary actions, but do not claim every CTA must be right-aligned.
- Preserve the stated product hierarchy from the supplied context.

Return exactly this structure:

OVERALL VERDICT
- Score: X/100
- One-sentence verdict

TOP 5 ISSUES
1. [Severity: Critical/High/Medium/Low] Issue — evidence — why it matters
2. ...

BUSINESS / FUNNEL IMPACT
- Opportunity 1
- Opportunity 2
- Opportunity 3

RECOMMENDED FIXES
1. Before → After
2. Before → After
3. Before → After

HIGH-FIDELITY POLISH
- 3 to 5 specific visual refinements

DO NOT CHANGE
- 2 to 4 things that are already working and should be preserved

Be concrete enough that another designer can implement the fixes directly in Figma.`;
}

async function imageFromUrl(url) {
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

async function callGemini(image, prompt) {
  const key = Netlify.env.get("GEMINI_API_KEY");
  const model = Netlify.env.get("GEMINI_MODEL") || "gemini-3.8-flash";
  if (!key) throw new Error("GEMINI_API_KEY is not configured on Netlify.");

  const response = await fetch("https://generativelanguage.googleapis.com/v1beta/interactions", {
    method: "POST",
    headers: { "content-type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify({
      model,
      input: [
        { type: "image", data: image.data, mime_type: image.mime_type, resolution: "high" },
        { type: "text", text: prompt },
      ],
    }),
  });
  const body = await response.json();
  if (!response.ok) {
    const message = body?.error?.message || `Gemini request failed (${response.status}).`;
    throw new Error(message);
  }
  const analysis = extractOutput(body);
  if (!analysis) throw new Error("Gemini returned no text analysis.");
  return { analysis, model };
}

export default async (req) => {
  if (req.method === "GET") {
    const url = new URL(req.url);
    const imageUrl = url.searchParams.get("image_url");
    const context = url.searchParams.get("context") || "";
    const focus = url.searchParams.get("focus") || "full";
    if (!imageUrl) return json({ error: "Missing image_url. Pass a Figma screenshot URL." }, 400);
    try {
      const image = await imageFromUrl(imageUrl);
      const result = await callGemini(image, buildPrompt(context, focus));
      return json({ ok: true, ...result });
    } catch (error) {
      return json({ error: error instanceof Error ? error.message : "Unknown reviewer error." }, 500);
    }
  }

  if (req.method !== "POST") return json({ error: "Use GET with image_url or POST with JSON." }, 405);

  try {
    const body = await req.json();
    let image;
    if (typeof body.image_data === "string" && body.image_data.length) {
      if (body.image_data.length > MAX_INLINE_BASE64_CHARS) throw new Error("Screenshot is too large for a browser upload. Use the Figma screenshot URL field instead.");
      image = { data: body.image_data, mime_type: body.mime_type || "image/png" };
    } else if (typeof body.image_url === "string") {
      image = await imageFromUrl(body.image_url);
    } else {
      return json({ error: "Provide image_data or image_url." }, 400);
    }
    const result = await callGemini(image, buildPrompt(body.context || "", body.focus || "full"));
    return json({ ok: true, ...result });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Unknown reviewer error." }, 500);
  }
};

export const config = {
  path: "/api/review",
  method: ["GET", "POST"],
  rateLimit: { action: "rate_limit", aggregateBy: ["ip"], windowSize: 60, windowLimit: 10 },
};
