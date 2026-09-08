# Gemini Visual Reviewer

This repository is the source for a Vercel-hosted, Gemini-powered visual UX reviewer used from ChatGPT.

## Purpose

The application receives UI screenshots and returns an independent visual/UX critique from Gemini. It is a reviewer, not a design editor.

## Required ChatGPT orchestration

The canonical workflow is:

`User prompt → permission gate → Figma inspect → Figma screenshot → ChatGPT visual/UX review → Gemini independent review → ChatGPT reconciliation → prioritized change list → Figma implementation → Figma re-screenshot → ChatGPT + Gemini re-audit`

### Stage 0 — Permission gate

Before any Figma read or write operation, ChatGPT must explicitly show the working scope:

**Working scope: only `Zunaid_workspace → Homepage`**

The permission request must state whether the requested action is **read/inspect**, **screenshot/review**, or **write/edit**. Do not imply permission for any other Figma area.

No Figma write operation may happen until the user has explicitly approved the requested write/edit action.

### Stage 1 — Figma inspection

ChatGPT inspects only the approved node/page within `Zunaid_workspace → Homepage` and forms its own UX/product assessment from the visible design and supplied requirements.

### Stage 2 — Screenshot

ChatGPT takes a fresh screenshot of the exact screen being reviewed. Prefer a high-resolution screenshot suitable for visual inspection.

### Stage 3 — ChatGPT review

ChatGPT independently reviews the screenshot before sending it to Gemini. The review should cover:
- visual hierarchy
- information architecture and density
- spacing, alignment and card geometry
- typography and readability
- interaction affordances and mobile usability
- accessibility risks
- conversion/funnel opportunities
- high-fidelity visual polish
- alignment with the user's requested change and product hierarchy

ChatGPT must record its own meaningful insights separately from Gemini's findings.

### Stage 4 — Gemini review

Send the same fresh screenshot plus screen/task/context/focus to `/api/review`. Gemini provides an independent second opinion.

Gemini is read-only. It must never modify Figma, GitHub, project files, approvals, or access-control rules.

### Stage 5 — Reconciliation

ChatGPT compares its own findings with Gemini's findings and explicitly identifies:
- findings both agree on
- findings that clash or materially differ
- Gemini-only findings worth accepting
- ChatGPT-only findings worth accepting
- findings rejected because they are unsupported, redundant, low impact, or conflict with approved product intent

Only **medium and high priority** actionable insights should normally enter the implementation list. Critical/P0 findings are always included. Low-priority polish is deferred unless it is necessary to resolve a larger issue.

### Stage 6 — Combined change list

Before editing Figma, ChatGPT presents a concise implementation list combining the accepted ChatGPT + Gemini insights. Each change should include priority, target area, problem, proposed change, and expected UX/business impact.

### Stage 7 — Figma implementation

After explicit user approval to implement, ChatGPT makes the approved changes in Figma, restricted strictly to `Zunaid_workspace → Homepage`.

Existing designs are protected by default. Prefer an exploration/iteration section or duplicate working frame when appropriate. Do not modify unrelated pages, files, folders, projects, teams, or workspaces.

### Stage 8 — Re-audit

After implementation, ChatGPT takes a fresh screenshot and repeats the review loop to verify that:
- accepted issues are resolved
- no new visual/UX regressions were introduced
- ChatGPT and Gemini findings converge
- product hierarchy and business intent remain intact

## Visible stage reporting

During every execution, ChatGPT must show concise progress markers in the conversation, for example:

`[1/8] Permission & scope`
`[2/8] Inspecting Figma`
`[3/8] Taking screenshot`
`[4/8] ChatGPT review`
`[5/8] Gemini review`
`[6/8] Reconciling insights`
`[7/8] Implementing approved changes`
`[8/8] Re-audit`

Do not hide these stages when tools are running. Keep them concise; do not expose internal chain-of-thought.

## Figma scope

All DMI design work referenced by this project is restricted to:

`Zunaid_workspace → Homepage`

Never broaden Figma inspection to other files, pages, folders, projects, teams, or workspaces.

## DMI product hierarchy

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
