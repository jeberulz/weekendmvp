# Claude Handoff — Build Platform Program

Last updated: 2026-08-06 (Europe/London)

## Resume Point

- Work from `codex/wp27-site-preview` (branched from `codex/wp26-research-workflow`, which itself carries the passed Wave 2 gates and WP26-S1). WP26's own remaining work (`S2`-`S6`) stays on `codex/wp26-research-workflow`; the two can proceed in parallel.
- **WP27 is the active package.** `WP27-S1` and `WP27-S2` are complete at the story level (S2 code is on disk uncommitted — commit when asked). Next is `WP27-S3` (three templates + per-template XSS/a11y). See "WP27 — Active" below.
- Wave 2 (WP21-WP25) is fully gated and passed; see `docs/wp/wave-gate-report.md` ("Wave 2 / WP23 & WP25 Authenticated Browser Gate - 2026-08-06").
- `WP26-S1` (contract subgate) is done and independently reviewed — pass; see `docs/wp/wave-gate-report.md` ("WP26-S1 Contract Subgate - 2026-08-06"). New code: `convex/platform/engine/contracts.ts` and its adjacent test file. No `convex/schema.ts` change.
- `codex/wp38-admin-plan` (a parallel session's WP38 planning, docs-only) was cherry-picked onto this branch; see "Super-Admin Program Amendment" below.
- Treat `docs/wp/program-manifest.md` as the frozen program source of truth. Read `CLAUDE.md`, `AGENTS.workflow.md`, `.agentic-workflow.yml`, and `docs/wp/RULINGS.md` before acting.
- Do not resume from the WP23, WP24, or WP25 worktrees. Their reviewed changes are already integrated into `codex/wave2-platform-integration`; the worktrees remain only as clean historical branches.
- Two local-dev-only test projects ("Wave 2 QA Gate Test Idea", confirmed; one unconfirmed race-test draft) exist in the local Convex deployment as a byproduct of the WP23/WP25 browser gate. They are harmless local dev data (no archive/delete UI exists yet in v1); safe to ignore or manually clear via a fresh `convex dev` local reset if desired.

## Current Program State

| Package | State | Remaining work |
|---|---|---|
| WP21 Auth | Development auth gate usable | Credential-backed Resend magic-link sign-in is confirmed locally. Google OAuth credentials and real Google redirect/callback/session/logout E2E are intentionally deferred to go-live. |
| WP22 Contracts | Passed | Frozen additive schema and owner-only authorization contracts are integrated. No destructive deletion or admin/support bypass. |
| WP23 Dashboard/Explore | **Passed, including S6** | Authenticated desktop/mobile browser, keyboard, focus, Saved/Interested, and automated-a11y evidence gathered live 2026-08-06; see `docs/wp/wp23-progress.md`. Building's positive (repository-idea-derived) branch remains Convex-test-verified only, pending WP27's live UI path — recorded as a scope boundary, not a defect. |
| WP24 Billing/Credits | Test-mode code gate passed | Live Stripe activation is blocked. Partial refunds, dispute resolution/funds reinstatement, tax/VAT, and credential-backed live E2E require later owner rulings and activation gates. |
| WP25 Intake/Projects | **Passed, including S6** | Authenticated autosave/resume/two-tab-race/review/confirm/a11y evidence gathered live 2026-08-06; see `docs/wp/wp25-progress.md`. |
| Wave 2 | **Passed** | WP23-S6 and WP25-S6 closed 2026-08-06. WP24 live-activation evidence remains a separately gated future item and does not block WP26. |

## WP27 — Active

Stories are frozen at `docs/wp/wp27-stories.md`; context and rationale are in `docs/wp/wp27-progress.md`. Read both before acting.

- **`WP27-S1` done** (committed): capability contract + additive `preview_capabilities` table.
- **`WP27-S2` done** (committed `965bac4`): `/build/{slug}` now returns 200 — the dead-CTA merge blocker is cleared. HMAC preview bridge, rate-limited generation, customisation form.
- **`WP27-S3` done**: three templates (Editorial/Product/Minimal), named-field-only render, closed dispatch table, structural watermark, 48-case per-template security matrix that was mutation-tested to prove it can fail.
- **`WP27-S4` done**: `/preview/{token}`, the `read.ts` action+internalQuery clock split, `/preview/:token` response headers in `next.config.ts`, and the preview API's own origin gate (`PLATFORM_PREVIEW_APP_ORIGIN`, falling back to the request `Host` rather than skipping). The deferred live per-template axe scan ran: 3 templates x 2 widths, two contrast findings, both carried to `S6` (see `docs/wp/wp27-progress.md`) - the `S3` decorative watermark (1.09, WCAG 1.4.3 pure-decoration exception, open judgement call) and a **pre-existing site-wide** `ConsentBanner` link (4.17, also present on `/starter-kit`, out of WP27 scope).
- **Known deviation to raise at `S6`:** `/preview/{token}` answers **200** for every case, valid and invalid alike, because Cache Components flushes a PPR shell before `notFound()` runs. `connection()` does not suppress it. No status oracle exists (all four cases match), and `X-Robots-Tag` carries non-indexability, but it is a soft-404 the owner may want changed.
- **`WP27-S5` done**: `convex/platform/preview/claim.ts` plus the sign-in handoff. Exactly-once via the `wp27:preview:{capabilityId}` idempotency key (namespaced away from WP25's keys); identity derived server-side with no owner argument; expired, unknown, malformed, and someone-else's all raise the same `RESOURCE_NOT_FOUND`; no hostname written. The capability crosses sign-in in `sessionStorage`, never in `returnTo` or analytics.
- **Interpretation for `S6`/owner:** the story says a capability claimed by A cannot be "claimed or read" by B. *Claim* exclusivity is implemented and tested. *Read* exclusivity is not: `S1` ruled a claimed capability still resolves so its holder can reload, and `/preview/{token}` is anonymous with no identity to check. Restricting reads would contradict a passed subgate.
- **`WP27-S6` next** (package gate). It inherits four open items: the read-exclusivity interpretation above, the two `S4` accessibility findings, the `S4` 200-status deviation, and the live signup journey (preview -> `/signin` -> magic link -> dashboard claim), which `S5` did not exercise in a browser.

Three things a fresh session will otherwise rediscover the hard way:

1. **The anonymous-preview conflict is already resolved.** Every frozen WP22 table requires `ownerId`, so an anonymous artifact had nowhere to live. The owner ruled one additive `preview_capabilities` table. Do not relax `ownerId` on `site_configs`/`site_versions` — that would reopen a passed security gate.
2. **Template choice does not go in `SiteInputPayload`.** WP26-S1 froze that contract at v1 and it is content-only. WP27 wraps it: `SiteRenderSpec = { contractVersion, templateId, siteInput }`, stored as the site version's document body. No frozen-table column needed.
3. **`/build/{slug}` currently 404s and four merged components link to it** (`PreviewIdeaCta` on every public idea page, plus `ExploreCard`, `DashboardHome`, `ProjectCard`). Production is unaffected only because the platform program is unmerged from `main`. `WP27-S2` must land before that merge.

The three-template ruling went against the recommendation of one. Its cost is real and concentrated in `S3`: run the XSS and accessibility matrices **per template**, not once across the set.

## Earlier Context — Work Package Lane (WP26)

Wave 2 has passed. WP26 (`Durable task workflow and M3 Validation Reports`) is open on branch `codex/wp26-research-workflow`. The owner ruling on the provider contract is **already recorded** (2026-08-06, see `docs/wp/RULINGS.md` — four WP26 rows: model provider, search source, cost cap, retention), and `docs/wp/wp26-stories.md` plus `docs/wp/wp26-progress.md` are frozen and actively updated on that branch. Do not re-ask the owner for these four rulings and do not recreate those files — read them first.

**`WP26-S1` (the versioned Validation Report and site-input contract subgate) is done and independently reviewed — pass, recorded in `docs/wp/wave-gate-report.md` ("WP26-S1 Contract Subgate - 2026-08-06").** It required zero `convex/schema.ts` changes (WP22 already froze the needed `tasks`/`documents`/`document_citations`/`workflow_runs` tables and their enum values); the contracts live in `convex/platform/engine/contracts.ts` with tests in the adjacent `.test.ts` file. **This unblocks WP27 to start in parallel with WP26's remaining work**, once WP27's own preconditions are otherwise met — do not wait for `WP26-S2` through `S6`.

**No ruling gaps remain open in WP26.** All three providers are ruled as of 2026-08-06 (`docs/wp/RULINGS.md`): `gpt-5.6-sol` for synthesis/scoring, Perplexity Sonar Pro for market/community research, DataForSEO for keyword volume/CPC. A full run prices at roughly $0.52 (~$1.04 with retries) against the $4.00 cap — the reference budget and its breakdown are in `docs/wp/wp26-stories.md` under "Ruled Inputs". `WP26-S2` through `S6` are unblocked and may proceed in order.

Proceed through `WP26-S2` through `WP26-S6` per `docs/wp/wp26-stories.md`: provider adapters (fixture-mode only until this WP's own test-mode gate passes; pin a **dated** OpenAI model snapshot, not a floating alias; keyword provider must fail closed rather than fall back to a model estimate), durable resume/retry/cancel/timeout/onComplete with provider-side idempotency (not just a local key) on every paid call, pre-call cost reservation against the $4.00 cap (not a post-hoc check), explicit retry-once-then-refund test coverage, the report compiler/renderer, and fixed-corpus quality evaluation. A credential-backed quality gate (real OpenAI/Perplexity calls against a small fixed corpus, in an isolated sandbox) is required before any provider is activated beyond fixtures — a separate, later, owner-approved activation step, not part of the WP26 package gate itself.

WP26 is high-risk AI/backend/workflow work and requires a high-tier worker plus independent high-risk review. `convex/schema.ts`, `convex/convex.config.ts`, generated Convex files, middleware/proxy, lockfiles, webhooks, and ledger mutations remain serialized one-writer seams.

## Local Runtime Notes

- Next.js should be available at `http://localhost:3000`.
- Convex Auth proxies to the local Convex backend at `http://127.0.0.1:3210`; both processes must run.
- A recent `auth:signIn` `fetch failed` was caused by the Convex backend being offline after typed environment validation rejected a missing `PLATFORM_BILLING_BRIDGE_SECRET`. A fresh secret was set in the **local Convex deployment only**, Convex was restarted, and port 3210 returned HTTP 200. Never print or copy the secret into files, chat, logs, or client code.
- If Convex is offline in a new terminal/session, run `npm run convex:dev`. Do not create or rotate production credentials.
- Resend is the approved magic-link provider. The local credential is already configured; do not expose its value.

## Hard Safety Boundaries

- No production deployment, data mutation/backfill, DNS/wildcard activation, live Stripe object/charge, external send, credential rotation/removal, or Ideabrowser offboarding without the manifest's restore, dry-run, owner-approval, and gate requirements.
- Every private Convex operation derives identity server-side. Never accept a caller-supplied owner ID.
- Public `/ideas/{slug}` pages remain the only canonical idea research pages; signed-in Explore reuses the same records.
- Private platform and preview surfaces remain non-indexable.
- Money and credits change only from server-verified, idempotent events.
- Google OAuth is not complete merely because provider code exists.

## Super-Admin Program Amendment

The owner approved WP38 (`Super Admin and Operator Control Plane Foundation`).
Before production activation, merge the committed `codex/wp38-admin-plan`
amendment and treat `docs/wp/wp38-stories.md` as frozen scope.

- WP38 follows WP30 and gates WP31.
- WP32-WP36 additionally depend on WP38's authorization/audit/release seam.
- The Idea Engine console, editorial review queues, canonical content compilers,
  production activation, rollback, and engine configuration are `super_admin`-
  only. Customers receive only bounded owner-scoped research/site workflows.
- The initial owner account is bootstrapped from deployment-only configuration
  and bound to a verified auth user ID. Never commit or trust an email in client
  code.
- Preserve the WP22 privacy boundary: no generic cross-owner bypass,
  impersonation, arbitrary private-artifact browsing, direct ledger edits, or
  hard deletion.
- No engine/compiler candidate may publish automatically. The mandatory release
  sequence is branch -> preview -> explicit admin approval -> deploy/asset health
  check -> activate -> immutable audit/rollback record.

## Useful Checks

```bash
git status --short --branch
./scripts/workflow_status.sh
npm run typecheck
npm run lint
npm test
npm run build
npm audit --omit=dev --audit-level=high
git diff --check
```

Do not rerun the full suite merely to begin reading. Run checks in proportion to the active gate or after changes, and record the evidence honestly in the WP progress and wave-gate documents.
