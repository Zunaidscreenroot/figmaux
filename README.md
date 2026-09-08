# Gemini Visual Reviewer

A small Netlify-hosted visual UX reviewer powered by the Gemini API.

## What it does

- Accepts a screenshot upload or a Figma MCP screenshot URL.
- Sends the image server-side to Gemini 3.8 Flash with high-resolution visual input.
- Returns an independent UX, visual hierarchy, mobile usability and business/funnel critique.
- Keeps the Gemini API key server-side in Netlify environment variables.
- Exposes `GET /api/review?image_url=...` so ChatGPT can request a review of a Figma screenshot and receive JSON analysis in-chat.

## ChatGPT workflow

1. ChatGPT reads a target frame in the allowed Figma workspace.
2. ChatGPT requests a screenshot through Figma MCP.
3. ChatGPT calls the deployed `/api/review` endpoint with the Figma screenshot URL and product context.
4. Gemini returns an independent critique.
5. ChatGPT presents the critique and decides what, if anything, should be changed in Figma.

Gemini is a read-only reviewer. It does not receive Figma write tools or modify designs.

## Environment variables

- `GEMINI_API_KEY` — required, secret.
- `GEMINI_MODEL` — optional; defaults to `gemini-3.8-flash`.

The API endpoint only accepts HTTPS Figma-hosted screenshot URLs for URL-based reviews.
