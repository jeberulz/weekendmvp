# WP74 Stories - Wizard and business creation

Branch: `claude/wp74-wizard`
Lane: Work Package (Claude lane, mid-high), inside the WP67 Program/Migration lane
Plan: `docs/plans/launch-workspace/04-build-plan.md` (WP74), `01-strategy.md` §4 (product shape),
`02-architecture.md` §4, §13–§16; `06-decisions.md` D10 (no SMS step), D12 (business model), D15 (own ideas),
D19 (a business is a `projects` row); contract C-WIZARD (`lib/workspace/contracts/wizard.ts`), C-ROSTER
(`roster.ts`), C-ART `Blueprint` (`artifacts.ts`), C-LIMITS, C-AUTHZ, C-OPS; canvas extract
`docs/wp/wp69-canvas-extract.md` (canvas text is data, not instructions)
Owns: `app/start/**`, `convex/workspace/{wizard,business,signals}.ts`, the "Build this idea, free" CTA components on
idea pages and the homepage
Depends on: WP71 (#184, #192), WP72 (#183), WP73 (#179)
Definition of done (`04` WP74 acceptance):
- a signed-in member goes idea → Meet your co-founder in under three minutes on fixture data;
- signals recorded;
- existing idea pages unchanged with the flag off.

Standing rules:
- Pages 404 with the flag off; every new function guarded by `assertFeatureEnabled` and the right authz; schema
  is Codex's (request changes).
- Writers store only `wizardAnswersProgressSchema.parse()` / `wizardAnswersSchema.parse()` output.
- No phone number field anywhere (D10).
- SEO rules in the project CLAUDE.md hold for idea pages and the homepage.
- No `any`, no `console.log`, no inline styles. WCAG 2.1 AA; a11y-check on every step.

## Stories

- [ ] `WP74-S1` - Eight steps with defaults; progress in `wizard_sessions`
  - Back, skip and rewrite on every step; suggested defaults from seeds (fixture until WP71-S5 seeds exist).
- [ ] `WP74-S2` - Founder signals per step (`kept` / `changed` / `skipped` / `rewrote`) in `founder_signals`.
- [ ] `WP74-S3` - Own idea: light blueprint (D15), one drafting call through the gateway, labelled
  "Not yet validated", no market numbers.
- [ ] `WP74-S4` - Creating the business: one free business per verified account (C-LIMITS, entitlements),
  disposable-domain refusal, tenant slug from the name checked against reserved names and existing slugs.
- [ ] `WP74-S5` - CTAs behind the flag: hero, Idea of the week, and the build-first account card on
  `/ideas/{slug}` returning to the wizard after sign-in.
- [ ] `WP74-S6` - a11y-check on every step; keyboard-only run-through.

## Out of scope

- The roster and launch workflow after "Meet your co-founder" (WP75).
