# Gemini Visual Reviewer

Backend-only visual UX review service for the Screenroot design workflow, deployed on Vercel.

## Purpose

This service is an independent visual-review layer. It receives a Figma screenshot plus product/task context, sends the image to Gemini Flash, and returns structured UX, visual and business/funnel findings.

It has **no browser reviewer UI and no Figma write access**.

## Canonical ChatGPT workflow

The reviewer is one stage in a controlled ChatGPT + Figma workflow:

`User prompt → permission gate → Figma inspect → screenshot → ChatGPT review → Gemini review → ChatGPT reconciliation → combined medium/high-priority changes → approved Figma edit → re-screenshot → re-audit`

### Scope gate

Every Figma operation must explicitly display:

**Working scope: only `Zunaid_workspace → Homepage`**

ChatGPT must ask for the appropriate permission before Figma access and must distinguish read/inspect, screenshot/review, and write/edit permission. No write operation happens without explicit approval.

### Visible execution stages

ChatGPT reports these stages in the conversation while working:

1. Permission & scope
2. Inspecting Figma
3. Taking screenshot
4. ChatGPT review
5. Gemini review
6. Reconciling insights
7. Implementing approved changes
8. Re-audit

Internal reasoning is not exposed; only concise progress and conclusions are shown.

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

## Insight reconciliation rules

ChatGPT owns the final decision. Gemini is an independent critic, not the source of truth.

After both reviews, ChatGPT should explicitly reconcile:
- shared findings
- conflicting findings
- Gemini-only findings worth accepting
- ChatGPT-only findings worth accepting
- unsupported/redundant/low-impact findings to reject

The implementation list should prioritize **critical, high and medium** actionable findings. Low-priority polish is deferred unless needed to resolve a higher-priority issue. Approved product requirements and design intent override generic recommendations.

## Figma implementation rules

- Stay strictly within `Zunaid_workspace → Homepage`.
- Never inspect or edit other Figma files, pages, folders, projects, teams or workspaces.
- Existing designs are protected unless the user explicitly approves the edit.
- Prefer a new exploration/iteration frame when appropriate.
- After changes, always take a fresh screenshot and re-audit before declaring the iteration complete.

## DMI context

- NTB: Personal Loan, Business Loan, DMIcash, Insurance and Wealth Pro are primary; PFM is secondary; Credit Score and Bills & Payments are supporting tools.
- Rejected: PFM is primary and should communicate building healthier credit habits/profile; Credit Score and Bills & Payments are secondary; no loan offering.
- Reduce clutter and unnecessary vertical space. Use compact patterns such as carousels when they preserve discoverability and hierarchy.

## Security / limits

- `GEMINI_API_KEY` stays server-side in Vercel environment variables.
- URL-based images are restricted to HTTPS Figma hosts.
- Remote screenshots are limited to 15 MB.
- Inline base64 images are limited to keep requests within serverless request limits; Figma URLs are preferred.
- The endpoint does not expose or accept Figma write operations.

## Environment variables

- `GEMINI_API_KEY` — required secret in Vercel.
- `GEMINI_MODEL` — optional; defaults to `gemini-3.8-flash`.
- `GEMINI_FALLBACK_MODEL` — optional; defaults to `gemini-3.7-flash`.

## Git workflow

GitHub repository: `Zunaidscreenroot/figmaux`.

The user will pull changes locally with:

`git pull origin main`

Do not require Codex for the deployed reviewer workflow.
