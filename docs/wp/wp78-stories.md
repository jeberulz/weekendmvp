# WP78 Stories — Publishing un-park

Branch: `codex/wp78-publishing`
Lane: Work Package (Phase 2, Codex)
Registry: `docs/PROJECT_STRATEGY.md`; source: `docs/plans/launch-workspace/04-build-plan.md` §WP78
Definition of done: the approved landing can publish on a test tenant host, takedown blocks within a minute even during a Convex outage, real leads have the D5 controls, and an independent Claude security review passes before owner merge.

## Stories

- [ ] `WP78-S1` — Guard `publishLanding` with owner authorization, current `publish` approval and subject version, deterministic and gateway policy checks, reserved slug, five publishes per owner per hour, workspace flag, and publish kill switch. Fail closed until C-APPROVAL and policy prompt are merged. Add negative and idempotency tests.
- [ ] `WP78-S2` — Super-admin takedown with reason and immutable audit. Middleware reads a durable Global Config denylist before the fail-open publish check; test taken-down slug with Convex unreachable and measure propagation.
- [ ] `WP78-S3` — Write wildcard DNS, Vercel domain/certificate, and test-slug activation/rollback runbook. Owner executes live DNS/provider changes.
- [ ] `WP78-S4` — D5 real lead capture with consent notice and version, opt-in hook for WP79, founder CSV export and per-contact delete, and purge 30 days after business/account deletion. Keep real lead capture off until all D5 controls work together.
  - [x] `WP78-S4a` — In the owner-authorized `deleteContact` transaction, revoke WP79 tokens, active enrollment and queued component mail before erasing lead contact fields. A revocation failure leaves the lead unchanged; retry is idempotent. Keep real capture and real-lead purge off.
  - [x] `WP78-S4b` — Make the legacy archive-based internal purge fail closed for every project. Ordinary archive cannot delete synthetic or real leads under the owner's explicit-delete/closure ruling. Prove archived projects retain all leads while the workspace is off; leave the future deletion-request queue and real-lead cleanup for a revised C-DATA contract.
  - [x] `WP78-S4c` — Require a signed, short-lived Next-to-Convex bridge for the existing synthetic lead write. The client/IP rate key must be authenticated and pseudonymized, with the tenant bridge secret optional and fail-closed. Prove forged keys, expired payloads and missing configuration cannot write; keep real capture off.
  - [x] `WP78-S4d` — Widen C-DATA for an explicit deletion-request epoch on projects and retention jobs. Deprecate the archive epoch without reinterpreting it; add a fail-closed fixture for the future due purge. Prove archive-only and legacy job rows cannot authorize deletion. Merge this contract before the runtime producer or cron.
  - [ ] `WP78-S4e` — On a founder's explicit Delete business or account closure, atomically record the deletion epoch and a single persisted due job, preserve its 30-day deadline on retries, then process due jobs in bounded per-lead revocation/deletion transactions through a WP79-owned hourly cron. Ordinary archive never schedules deletion; real capture remains off until the full D5 gate.
- [ ] `WP78-S5` — Security and integration gate: unapproved publish rejected; taken-down slug never served when Convex is down; tenant isolation, rate limit, kill switch and retention verified. Record checks and independent review.

## File boundary

Own `convex/platform/sites/**`, tenant handling in `middleware.ts`, `lib/tenant-*.ts`, lead routes under `app/api/**`, takedown routes under `app/admin/ops/**`, WP78 docs and new WP78 security tests. WP79 is the sole Phase 2 writer of `convex/crons.ts`, `convex/http.ts`, `.env.example`, and tenant-email files. WP78 records any retention-cron entry request for WP79 in progress. Schema additions require a separate early contract change and coordination before either implementation uses them.

## Out of scope

- No live wildcard DNS, Vercel domain, provider account, production deploy, customer publish or production lead capture by the agent.
- No repository-preview funnel revival, arbitrary HTML generation, or Claude-owned tenant renderer edits.
- No fabricated C-APPROVAL or policy prompt contract; dependent paths fail closed pending merged contracts.
