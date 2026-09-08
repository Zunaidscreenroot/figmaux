# Gemini UX Critic

Use Gemini as an optional independent UX critic to add a second model perspective to UX analysis.

## Role

Gemini is a critic, not the source of truth and not the design executor.

The primary agent remains responsible for:
- Scope and workspace safety
- Figma inspection
- Requirements and business context
- Final UX reasoning
- Recommendations
- Figma implementation
- Re-audit

Gemini provides an independent critique that can expose blind spots, alternative interpretations, usability risks, and additional opportunities.

## When to use

Use Gemini when it is available locally through the `gemini` CLI and the task benefits from independent review, especially:

- UX audits
- Information architecture reviews
- Conversion/funnel reviews
- Complex user journeys
- Competing design directions
- Re-audits of an implementation
- High-impact product decisions

Do not invoke Gemini for trivial edits where an independent critique adds no value.

## Review protocol

1. The primary agent inspects the authorised Figma context first.
2. Prepare a concise, evidence-based review brief containing only the relevant design/context needed for critique.
3. Ask Gemini to independently identify UX problems, missed opportunities, accessibility concerns, hierarchy issues, interaction risks, and business/funnel implications.
4. Do not tell Gemini what conclusions the primary agent has already reached. Avoid leading the critique.
5. Compare Gemini's findings with the primary analysis.
6. Separate:
   - Agreement
   - New finding
   - Contradiction
   - Low-confidence opinion
7. Resolve disagreements using requirements, evidence, user goals, design-system constraints, and business context.
8. Do not blindly merge Gemini's suggestions into the final recommendation.
9. The primary agent owns the final decision.

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

If the `gemini` command is unavailable, authentication is missing, or the invocation fails:

- Continue with the primary agent's own analysis.
- Do not block the user's task.
- Do not fabricate a Gemini result.

## Implementation boundary

Gemini should remain read-only in this workflow.

It must not:
- Modify Figma
- Modify GitHub
- Change project files
- Override approvals
- Make access-control decisions

The primary agent remains the orchestrator and final decision-maker.
