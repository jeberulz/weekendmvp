# WP18 Progress - Weekly validation digest

## Status

Implementation complete on `cursor/weekly-validation-digest-fde5`. Scheduled
delivery activates after the four documented GitHub Actions secrets are set.

## S1 — Funnel event contract

- Added consent-gated `idea_prompt_copied`, `starter_kit_clicked`,
  `newsletter_subscribed`, `checkout_started`, and `purchase_completed`.
- Funnel events include inferred source path/idea/hub context plus stable
  surface and CTA identifiers.
- Existing GA4 ecommerce and legacy analytics events remain intact.

## S2 — Validation metadata contract

- Added optional, strictly validated `validation` metadata to Convex ideas.
- Seed payloads preserve the object.
- `/publish-idea` now requires a primary audience, falsifiable hypothesis, and
  primary action for new ideas; historical entries remain valid.

## S3 — Weekly GA4 report

- Added a pure report module and tested CLI using GA4 property `517826359`.
- Seven complete UTC days ending after a two-day GA4 processing lag are
  compared with the prior 28 complete days.
- Baseline volume is normalized to seven days; page signals use the documented
  25/100 view eligibility and 25%/2pp movement thresholds.
- Markdown and escaped, mobile-friendly HTML renderers are covered by tests.

## S4 — Scheduled email delivery

- Added Monday 08:00 UTC plus manual GitHub Actions triggers.
- Workflow sends through Resend with a per-period idempotency key and uploads
  the Markdown artifact for 30 days.
- Recipient and sender remain repository secrets; no personal address is
  committed.
- Live GA4 query/email proof is pending because this agent environment has
  neither GA4 service-account credentials nor a Resend API key.

## Verification

- `npm run test:validation` — pass (4 tests)
- `npm run test:convex` — pass (6 tests)
- `npm test` — pass
- `npm run typecheck` — pass
- `npm run build` — pass (284 pages)
- `npm run seed:convex:dry -- --only ideas` — pass (145 ideas, 6 batches)
- `npm run lint` — unavailable: the repository has no `lint` script or ESLint
  configuration
- `npm audit --omit=dev` — reports 5 high-severity advisories in the existing
  pinned Next.js/Convex/PostCSS/Sharp/WebSocket stack; clearing them requires
  upgrading those direct dependencies and Sharp across a breaking boundary,
  which is outside this work package
- Accessibility — rendered controls and copy are unchanged; only analytics
  side effects and non-rendered data attributes changed, so no new interaction
  or contrast surface was introduced

## Docs

- Work-package stories/progress: updated.
- Operator configuration/runbook: added.
- Publishing skill: updated with the validation contract.
