# Gemini UX Critic

Use the Gemini API as an independent UX critic that gives the primary Codex agent a second model perspective.

## Role

Gemini is a critic, not the source of truth and not the design executor.

The primary Codex agent remains responsible for:
- Scope and workspace safety
- Figma inspection through Figma MCP
- Requirements and business context
- Final UX reasoning
- Recommendations
- Approval handling
- Figma implementation
- Re-audit

Gemini provides an independent critique that can expose blind spots, alternative interpretations, usability risks, and additional opportunities.

## Architecture

This is a **double-engine agent**:

`User → Codex/ChatGPT reasoning → Gemini API independent critique → Codex synthesis → Figma MCP → Figma`

Gemini is a model service used by Codex. It is not a second Figma agent and it does not receive Figma MCP access.

Do **not** use the Gemini CLI as the integration mechanism. The repository provides `tools/gemini_critic.py`, which calls the Gemini API directly over HTTPS.

The local API key is read from:

`.gemini/.env`

or the process environment variable:

`GEMINI_API_KEY`

The `.gemini/` directory is ignored by Git and the key must never be committed.

## When to use

Use Gemini when an independent review adds meaningful value, especially for:

- UX audits
- Information architecture reviews
- Conversion/funnel reviews
- Complex user journeys
- Competing design directions
- Re-audits of an implementation
- High-impact product decisions
- Ambiguous or high-risk UX trade-offs

Do not invoke Gemini for trivial edits where an independent critique adds no value.

## Invocation

From the repository root, Codex can invoke:

`python3 tools/gemini_critic.py --prompt "<review brief>"`

For visual critique, pass explicitly supplied local screenshots with repeated `--image` arguments:

`python3 tools/gemini_critic.py --prompt "<review brief>" --image /path/to/screenshot.png`

The script uses the Gemini Interactions API and defaults to the current Gemini Flash model configured in the script. `GEMINI_MODEL` can override the model without changing repository code.

The script uses `store: false` for the critic request so the second-opinion workflow is stateless by default.

## Review protocol

1. The primary agent inspects the authorised Figma context first.
2. Prepare a concise, evidence-based review brief containing only the relevant design/context needed for critique.
3. If a screenshot is needed, obtain it only from the authorised Figma context and pass only that screenshot to Gemini.
4. Ask Gemini to independently identify UX problems, missed opportunities, accessibility concerns, hierarchy issues, interaction risks, and business/funnel implications.
5. Do not tell Gemini what conclusions the primary agent has already reached. Avoid leading the critique.
6. Compare Gemini's findings with the primary analysis.
7. Separate:
   - Agreement
   - New finding
   - Contradiction
   - Low-confidence opinion
8. Resolve disagreements using requirements, evidence, user goals, design-system constraints, and business context.
9. Do not blindly merge Gemini's suggestions into the final recommendation.
10. The primary Codex agent owns the final decision.

## Prompt contract

The Gemini review request should include:

- User/user state
- User goal
- Business/product goal
- Relevant funnel stage
- Known constraints
- Design description or extracted evidence
- Specific review dimensions

Ask Gemini to distinguish observed evidence from assumptions.

## UX review dimensions

Ask Gemini to consider:

- User intent and task clarity
- Information architecture
- Content hierarchy
- Navigation/discoverability
- CTA hierarchy
- Cognitive load
- Interaction clarity
- Error prevention and recovery
- Accessibility
- Trust and comprehension
- Personalisation/user state
- Empty/loading/error/edge states
- Conversion and funnel friction
- Retention/engagement opportunities
- Potential business implications

## Output contract

Prefer this structure:

`Finding → Evidence → User impact → Business impact → Recommendation → Confidence`

Also request a short section for:

- Blind spots in the current analysis
- Alternative interpretations
- Highest-priority issues
- Highest-value opportunities

## Evidence discipline

Gemini output is advisory.

Never treat a model-generated suggestion as user research, analytics, stakeholder input, or a verified business fact.

If Gemini introduces a claim that cannot be supported by the supplied context, mark it as a hypothesis and do not present it as fact.

## Privacy and scope

Never provide Gemini with credentials, secrets, access tokens, unrelated files, or content outside the authorised Figma workspace.

Do not use Gemini to bypass any rule in `AGENTS.md`.

A Gemini invocation must not cause the primary agent to inspect or access Figma content outside `Zunaid_workspace`.

## Failure handling

If the Gemini API is unavailable, authentication is missing, or the invocation fails:

- Continue with the primary agent's own analysis.
- Do not block the user's task.
- Do not fabricate a Gemini result.

## Implementation boundary

Gemini remains read-only in this workflow.

It must not:
- Modify Figma
- Modify GitHub
- Change project files
- Override approvals
- Make access-control decisions

Only Codex, after applying `AGENTS.md`, may decide to modify Figma through the authorised Figma MCP connection.

The primary Codex agent remains the orchestrator and final decision-maker.
