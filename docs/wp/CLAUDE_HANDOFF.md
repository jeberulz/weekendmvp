# Claude Handoff — Build Platform Program

Last updated: 2026-08-06 (Europe/London)

## Resume Point

- Work from the main checkout on branch `codex/wave2-platform-integration`.
- The integrated code checkpoint before this handoff is commit `0028594`.
- The main working tree was clean when this handoff was written.
- Treat `docs/wp/program-manifest.md` as the frozen program source of truth. Read `CLAUDE.md`, `AGENTS.workflow.md`, `.agentic-workflow.yml`, and `docs/wp/RULINGS.md` before acting.
- Do not resume from the WP23, WP24, or WP25 worktrees. Their reviewed changes are already integrated into `codex/wave2-platform-integration`; the worktrees remain only as clean historical branches.

## Current Program State

| Package | State | Remaining work |
|---|---|---|
| WP21 Auth | Development auth gate usable | Credential-backed Resend magic-link sign-in is confirmed locally. Google OAuth credentials and real Google redirect/callback/session/logout E2E are intentionally deferred to go-live. |
| WP22 Contracts | Passed | Frozen additive schema and owner-only authorization contracts are integrated. No destructive deletion or admin/support bypass. |
| WP23 Dashboard/Explore | Code and independent review passed | `WP23-S6` remains pending only for authenticated desktop/mobile browser, keyboard, and automated accessibility evidence. |
| WP24 Billing/Credits | Test-mode code gate passed | Live Stripe activation is blocked. Partial refunds, dispute resolution/funds reinstatement, tax/VAT, and credential-backed live E2E require later owner rulings and activation gates. |
| WP25 Intake/Projects | Code and independent review passed | `WP25-S6` remains pending only for the authenticated browser journey described below. |
| Wave 2 | Integration checks passed; final UX evidence open | Close WP23-S6 and WP25-S6, then record the Wave 2 gate verdict before opening Wave 3 implementation. |

## Immediate Next Action — Gate Lane

The owner has just confirmed that magic-link sign-in works and the dashboard opens. Use that authenticated local session to gather the remaining evidence; do not start WP26 code first.

1. Verify WP23 on desktop and mobile widths:
   - dashboard and Explore load without browser/console errors;
   - keyboard-only navigation, skip link, focus states, current-route state, mobile contextual sheet, Escape close, and focus restoration;
   - Saved and Interested persist independently;
   - Building is derived from an active project;
   - private routes remain noindex/noarchive;
   - run the automated accessibility scan.
2. Verify WP25:
   - create an own-idea draft and observe autosave before Review;
   - refresh and resume;
   - exercise the two-tab conflicting-first-save path and confirm the losing tab does not claim Saved;
   - verify review focus, confirmation, keyboard order, responsive layout, and automated accessibility;
   - confirm project cards expose only truthful server state.
3. Record evidence and verdicts in `docs/wp/wp23-progress.md`, `docs/wp/wp25-progress.md`, and `docs/wp/wave-gate-report.md`. Mark S6 complete only when the journey actually passes.
4. If code changes are needed, stay inside the frozen WP boundary, rerun the standard checks, obtain independent review, and commit the scoped fix before declaring the gate passed.

## Local Runtime Notes

- Next.js should be available at `http://localhost:3000`.
- Convex Auth proxies to the local Convex backend at `http://127.0.0.1:3210`; both processes must run.
- A recent `auth:signIn` `fetch failed` was caused by the Convex backend being offline after typed environment validation rejected a missing `PLATFORM_BILLING_BRIDGE_SECRET`. A fresh secret was set in the **local Convex deployment only**, Convex was restarted, and port 3210 returned HTTP 200. Never print or copy the secret into files, chat, logs, or client code.
- If Convex is offline in a new terminal/session, run `npm run convex:dev`. Do not create or rotate production credentials.
- Resend is the approved magic-link provider. The local credential is already configured; do not expose its value.

## After Wave 2 Passes

Open WP26, `Durable task workflow and M3 Validation Reports`, on branch `codex/wp26-research-workflow` using the Work Package lane.

Before implementation:

1. Ask the owner to rule on the unresolved WP26 provider contract: model provider, search/community sources, source licensing, per-report cost cap, and retention policy. Until ruled, provider adapters remain disabled outside isolated fixtures.
2. Create and freeze `docs/wp/wp26-stories.md` and `docs/wp/wp26-progress.md` before code.
3. First deliver and independently gate the versioned Validation Report and site-input contracts. WP27 may begin in parallel only after that named contract subgate passes.
4. Then implement durable resume/retry/cancel/timeout/onComplete behavior, stable external-step idempotency keys, exact refunds, citation/competitor/score completeness, cost telemetry, and fixed-corpus quality evaluation.

WP26 is high-risk AI/backend/workflow work and requires a high-tier worker plus independent high-risk review. `convex/schema.ts`, `convex/convex.config.ts`, generated Convex files, middleware/proxy, lockfiles, webhooks, and ledger mutations remain serialized one-writer seams.

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
