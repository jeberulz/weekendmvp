# WP100 Stories - Improve your idea with AI (wizard Step 1)

Branch: `claude/wp100-idea-ai-improve` (backend), `claude/wp100-idea-ai-improve-ui` (UI, after the unified Step 1 lands)
Lane: Work Package
Registry: `docs/PROJECT_STRATEGY.md`
Design: `docs/design/wizard-idea-ai-improve.md`
Definition of done: a founder on `/start/own` can ask a cheap model (Haiku 5.5, `fast` tier) to sharpen their idea
sentence, or a selected part of it, through the metered gateway; they see the suggestion before anything changes and
can use it, edit it, try again or keep their own; undo always returns their own words; the field works exactly as
before when AI is off, refused or failing. The accepted idea, the founder's original and the extracted hints are stored
for the blueprint and the crew.

## Stories

- [ ] `WP100-S1` - Design doc and clickable mockup
  - Scope: `docs/design/wizard-idea-ai-improve.md`, mockup Artifact.
  - Acceptance criteria:
    - UX states, data, blueprint impact, platform impact and cost model written down before code.
    - Blueprint-impact section shared with the `wizard-e2e-audit` session (one shared extraction step).
  - Verification: owner review.

- [ ] `WP100-S2` - The improve prompt and its guardrails (pure)
  - Scope: `convex/ai/prompts/ideaImprove.v1.ts`, registry entry, `versions.lock.json`, fixture reply,
    `lib/workspace/wizard/idea-improve.ts`.
  - Acceptance criteria:
    - `wizard-idea-improve@1`: `fast` tier (Haiku 5.5), effort `low`, thinking `disabled`, small `maxTokens`.
    - Whole-idea and selection modes; founder text reaches the model only as quoted data.
    - Output checked in code after the schema: one line, at most `WIZARD_LIMITS.ownIdea` characters, no number or market
      claim the founder did not write, no hype words, keeps at least one of the founder's own content words, text outside
      a selection unchanged. A failed check returns "keep yours", never a bad suggestion.
  - Verification: `tests/platform/wp100-idea-improve.test.ts`, prompt version check.

- [ ] `WP100-S3` - Metered improve action with a per-founder cap
  - Scope: `convex/workspace/ideaImprove.ts` (+ table in `convex/schema/workspace.ts`), C-METER key form
    `idea_improve`, `gatewayActions` validator, C-LIMITS `ideaImprove`, account purge.
  - Acceptance criteria:
    - Signed-in founders only; identity from auth. Every call goes through `internal.ai.gatewayActions.runPrompt`
      (reserve → call → settle), never a raw SDK call.
    - A per-founder daily cap through `@convex-dev/rate-limiter`; at the cap the action returns `rate_limited` and the
      model is not called.
    - Every call is one `wizard_idea_improvements` row (input, suggestion, hints, outcome, usage ids); account deletion
      removes them.
    - AI off, budget refused, provider failure or junk output all come back as typed results; nothing throws to the UI.
  - Verification: `convex/workspace/ideaImprove.test.ts` (fixture adapter, no live spend).

- [ ] `WP100-S4` - The IdeaImprove control and hook
  - Scope: `components/workspace/wizard/IdeaImprove.tsx`, `components/workspace/wizard/useIdeaImprove.ts`.
  - Acceptance criteria:
    - States: idle, loading, suggestion, accepted (undo), already clear, error, rate limited, unavailable.
    - Selection mode when the founder selects part of the text; whole idea otherwise (the touch fallback).
    - Live region announces the suggestion; focus moves to it and back to the field on use or dismiss.
  - Verification: `tests/platform/wp100-idea-improve-ui.test.tsx`, a11y-check, browser at desktop and 375px.

- [ ] `WP100-S5` - Wire into the unified Step 1 and store the outcome
  - Scope: the unified Step 1 component from `wizard-e2e-audit` (one insert), `startOrResume` (optional
    `improvementId`), founder signal `ai_improved`.
  - Acceptance criteria:
    - Continue with an accepted suggestion stores the original, the final text and the hints on the session.
    - The Step 2 rail shows the AI-assisted rewrite with before and after.
  - Verification: wizard suites (`l1-wizard-fidelity`, `wp74-*`, `wp75-*`, `wp90-*`) and the browser.

## Out Of Scope

- Using the hints in the light blueprint or the crew prompts (that is the own-idea blueprint enrichment plan owned by
  `wizard-e2e-audit`; this WP only stores them in the shared shape).
- Improve on any other wizard field.
- Anonymous visitors (the wizard already requires sign-in).

## Notes

- Promote unknown product decisions to `docs/wp/RULINGS.md`.
- Owner decisions pending: daily cap size, separate `ai_improved` signal, the new C-METER key form.
