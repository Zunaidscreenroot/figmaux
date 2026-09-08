# Gemini Visual Reviewer

This repository is the source for a Vercel-hosted, Gemini-powered visual UX reviewer used from ChatGPT.

## Purpose

The application receives UI screenshots and returns an independent visual/UX critique from Gemini. It is a reviewer, not a design editor.

## Architecture

`ChatGPT → Figma MCP screenshot → Vercel /api/review → Gemini Vision → JSON analysis → ChatGPT`

Gemini is read-only. It must never modify Figma, GitHub, project files, approvals, or access-control rules.

## Figma scope

All DMI design work referenced by this project is restricted to:

`Zunaid_workspace → Homepage`

Never broaden Figma inspection to other files, pages, folders, projects, teams, or workspaces. Existing designs are protected unless the user explicitly asks for an edit.

## Reviewer behaviour

The reviewer should evaluate the screenshot as evidence and should not invent functionality or business facts.

Every review should cover:
- visual hierarchy
- information architecture and density
- spacing, alignment and card geometry
- typography and readability
- interaction affordances and mobile usability
- accessibility risks
- conversion/funnel opportunities
- high-fidelity visual polish

Recommendations should be concrete, prioritized, and implementable in Figma. Separate visual defects from product/strategy hypotheses.

For DMI:
- NTB: Personal Loan, Business Loan, DMIcash, Insurance and Wealth Pro are the product hierarchy; PFM is secondary; Credit Score and Bills & Payments are supporting tools.
- Rejected: PFM is primary and should communicate building healthier credit habits/profile; Credit Score and Bills & Payments are secondary; do not introduce a loan offering.
- Reduce clutter and unnecessary vertical space. Use compact patterns such as carousels when they preserve discoverability and hierarchy.

## API

`GET /api/review?image_url=<Figma screenshot URL>&context=<encoded context>&focus=<full|hierarchy|mobile|conversion|visual>`

The endpoint also accepts POST JSON with `image_url` or `image_data`.

Only HTTPS Figma-hosted screenshot URLs are accepted for URL-based reviews. Gemini credentials stay server-side in Vercel environment variables.

## Git workflow

GitHub repository: `Zunaidscreenroot/figmaux`.

The user will pull changes locally with:

`git pull origin main`

Do not require Codex for the deployed reviewer workflow.
