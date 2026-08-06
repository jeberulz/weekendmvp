# Claude Handoff — Build Platform Program

Last updated: 2026-08-06 (Europe/London)

## Resume Point

- Work from the main checkout on branch `codex/wave2-platform-integration`.
- Wave 2 (WP21-WP25) is now fully gated and passed as of this update; see `docs/wp/wave-gate-report.md` ("Wave 2 / WP23 & WP25 Authenticated Browser Gate - 2026-08-06").
- The main working tree is clean; the only diffs since the prior checkpoint are docs (`wp23-progress.md`, `wp25-progress.md`, `wave-gate-report.md`, `session-ledger.md`, this file) — no product code changed.
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

## Immediate Next Action — Work Package Lane (WP26)

Wave 2 has passed. WP26 (`Durable task workflow and M3 Validation Reports`) is open on branch `codex/wp26-research-workflow`. The owner ruling on the provider contract is **already recorded** (2026-08-06, see `docs/wp/RULINGS.md` — four WP26 rows: model provider, search source, cost cap, retention), and `docs/wp/wp26-stories.md` plus `docs/wp/wp26-progress.md` are already frozen on that branch. Do not re-ask the owner for these four rulings and do not recreate those files — read them first.

Two ruling gaps remain open from the same review pass and must be closed before `WP26-S2` (provider adapters) can be implemented — ask the owner if not yet answered:

1. The exact OpenAI model ID for synthesis/scoring (the ruling says "OpenAI GPT," which is a family, not a pinned model — cost/quality/the $4 cap all depend on the exact model).
2. A named keyword-volume/CPC data provider (e.g. DataForSEO or similar) for the pipeline's keywords/demand step — Perplexity covers market stats and community signals only, not keyword/CPC data.

Once those two are ruled (or if this session already resolved them — check `docs/wp/RULINGS.md` for entries dated after 2026-08-06's initial four), proceed:

1. Dispatch `WP26-S1` (the versioned Validation Report and site-input contract subgate) to a high-tier worker. This is the only story touching `convex/schema.ts`.
2. Independently gate `WP26-S1` alone and record the result in `docs/wp/wave-gate-report.md`. WP27 may begin in parallel only after this named subgate passes — not merely because WP26 opened.
3. Then proceed through `WP26-S2` through `WP26-S6` per `docs/wp/wp26-stories.md`: provider adapters (fixture-mode only until this WP's own test-mode gate passes), durable resume/retry/cancel/timeout/onComplete with provider-side idempotency (not just a local key) on every paid call, pre-call cost reservation against the $4.00 cap (not a post-hoc check), explicit retry-once-then-refund test coverage, the report compiler/renderer, and fixed-corpus quality evaluation.
4. A credential-backed quality gate (real OpenAI/Perplexity calls against a small fixed corpus, in an isolated sandbox) is required before any provider is activated beyond fixtures — this is a separate, later, owner-approved activation step, not part of the WP26 package gate itself.

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
