# Dashboard repair implementation and verification

PR: [#81](https://github.com/jeberulz/weekendmvp/pull/81). Source candidate: `6891d86d`. Audit pin: `7cf31dea`. Repair branch: `codex/wp44-audit-fixes`. Tested implementation commit: `19ed908` (dependency update `d484cca`). Frozen scope: `553bb30`.

## Scope

Implements the approved correctness, security, runtime and UX repairs while preserving the research-desk design. Builder’s Hub correctness is repaired behind its existing disabled flag; subscription checkout and activation remain a separate work package. No production deployment, data mutation, email send or merge was performed.

## Verification environment

Isolated worktree, local Convex anonymous deployment on `127.0.0.1:3310` / HTTP actions `3311`, Next development app `localhost:3188`. Fresh local signing keys and bridge secret. Original five tables and additive repair indexes accepted by the real backend. Generated declarations regenerated with supported Convex codegen. Local data seeded from the repository only.

Browser fixture uses the installed internal auth store to create a one-use verification code for `example.test`, followed by the actual `/email-signin` confirmation and public sign-in action. No JWT forgery, mocked WebSocket or authentication bypass is used. External Resend delivery and Google OAuth credentials are not exercised by this local fixture.

## Observed browser journeys

- Real email confirmation → authenticated Saved. Pending anonymous Save completed and rendered through Convex.
- Saved → start plan → toggle research step → save scope. Persisted progress showed two steps completed.
- Finish confirmation initially focused safe “Not yet”; confirmed finish without live URL showed “Plan finished” and “No live link saved”.
- Home at 390 × 844 had no horizontal overflow. Account sheet at 667 × 320 scrolled within viewport and returned focus to Account after close.
- Complete catalogue loaded; token-prefix search returned the expected two AI Code Reviewer records. Optional settings were selected, saved, cleared and verified on a fresh page. Archive cancellation restored focus; archive → Builds → Restore returned to an editable plan. A separately authenticated synthetic account B saw an empty Saved list, without account A’s records. Existing tabs keep their own authenticated connection until navigation; this is not a claim of cross-tab logout synchronization.

## Findings reconciliation

| Finding | Implemented repair / evidence |
|---|---|
| A01 real backend / generated declarations | Actual isolated backend accepts schema; supported codegen; guarded repeatable real-auth scripts. External delivery/OAuth and exhaustive assistive-technology review remain release gates. |
| A02 rolling compatibility | Restored dashboardSummary, explore and setIntent contracts; registered on real backend and reject anonymous calls. Legacy intent writes also advance the new save revision. |
| A03 server trace size | Static content roots; CI trace spill/size gate; sampled trace-assembled artifacts approximately 8.5–8.7 MB, down from approximately 494 MB. Hosting-provider packaging remains separate. |
| A04/A05 complete discovery | Native bounded pages, accumulated before global token-prefix search/filter/ranking/facets. 1,005-record tests; no hidden 240/1,000 record endpoint ceiling in the new UI. Old bounded endpoints remain compatibility-only. |
| A06 stale plan replacement | Expected active plan identity, typed conflict, exact same-idea lookup and idempotent retry. |
| A07 verified prompt membership | Real JWT verification plus current, unexpired session ownership; anonymous/revoked 401 and valid 200 (original forged-token fixture lacked `iat`; see follow-up gate); outages 503. |
| A08 existing drafts | Continue control remains even if a project page contains no resumable drafts. Own-idea creation and publishing remain parked. |
| A09 Save ordering | Coalesced requests plus server compare-and-set revision. Even a no-op Unsave advances a revision and fences a delayed older Save. Lost responses reconcile, conflicts retry the latest choice within a fixed budget; visible deliberate recovery on failure. |
| A10 meaningful privacy guard | Runtime exact output assertions plus deliberately injected unwanted-field rejection; removed vacuous source slice. |
| A11 toolchain advisories | Scoped Vitest and nested js-yaml updates; full and production audits rerun. |
| B01 plan invariants/history | Exact owner/idea lookup; native active/finished/archived paging; usage explicitly shows 50+ beyond its bound. Downgrade preserves plans and blocks additional starts/restores until explicit archival. |
| B02/B03 collection recovery/focus | Pending/delete errors, safe cancellation and connected-trigger fallback. Dormant paid surfaces remain disabled. |
| B04 lifecycle | Soft-delete collections, membership rows and notes, preserving records; no production migration. |
| B05 paid activation | Intentionally separate subscription WP. Current resolver remains Free; UI flag remains disabled. |

The initial four PR review comments received repairs (the normalized-claim overflow issue was reopened in the follow-up below): draft continuation, clearable radio choices, normalized subscription claims and honest Save outages. A discovered retired-content mismatch is addressed by deriving retirement from the existing canonical manifest: 228 stored/MDX ideas, 226 discoverable, two retired, no missing active bodies. Existing saves/history remain readable.

Independent reviewers checked the backend and runtime boundaries, then reviewed Save/UX behavior; their delayed-response and durable-intent findings were fixed before closeout. Final standard-gate results apply to implementation commit `19ed908`:

| Gate | Result |
|---|---|
| Typecheck | Passed |
| Lint | Zero errors; 35 existing warnings |
| Full tests | 1,106 passed: 221 Node + 885 Vitest |
| Production build | Passed, 428 pages; zero whole-project tracing warnings |
| Full / production dependency audits | Zero vulnerabilities in both |
| Lock consistency | npm 10 `ci --dry-run --ignore-scripts` passed |
| Local Convex + local production Next server | Passed real code redemption, membership/session revocation, Save revision conflicts/persistence, private caching, public canonical/JSON-LD and sitemap exclusion |
| Trace and corpus checks | Passed: no unintended docs/public/tests/scripts/secrets in sampled traces; 226 active bodies available |
| Diff / workflow configuration | Clean diff checks and valid YAML |

The first concurrent full test run hit the default five-second timeout only in the 1,005-record stress regression. That individual test now has a 30-second budget; the final full run passed without skipping tests or weakening assertions. A later sparse-data regression checks five empty continuing pages before the oldest saved record, with a hard 200-row scan budget.

Machine-readable results and logs: [gate summary](evidence/dashboard-repairs-2026-09-26/gates/summary.json). Browser images: [mobile Home](evidence/dashboard-repairs-2026-09-26/01-home-mobile.png), [short account sheet](evidence/dashboard-repairs-2026-09-26/02-account-short-viewport.png), [archive](evidence/dashboard-repairs-2026-09-26/03-builds-archive-desktop.png), [restored plan](evidence/dashboard-repairs-2026-09-26/04-restored-plan-desktop.png), [settings](evidence/dashboard-repairs-2026-09-26/05-settings-desktop.png).

## Release boundary

Production activation is separate: deploy additive backend compatibility first, then frontend; preserve legacy API adapters for rollback. Credential-backed delivery/OAuth, production artifact sizing and rollout/rollback smoke evidence must attach to that deployment. Do not remove compatibility adapters or narrow schema as part of frontend rollback.


## Tradeoffs and remaining operational gates

- Complete global ranking currently loads the public catalogue through bounded pages into the member browser. This removes silent truncation and preserves truthful facets at the current catalogue size; catalogue growth should be measured before replacing it with a materialized search/ranking service. Queries still enforce owner-only personal overlays.
- Search uses case-insensitive token prefixes across title and description, with title-only matches first, then selected sorting. It does not claim fuzzy or semantic search.
- Old subscription rows have no normalized index value. The initial repair suppressed all offers on scan overflow; [Claude review follow-up](2026-09-26-dashboard-review-followup.md) corrects this to suppress only the kit while preserving promos, restores the indexed fast path and adds an internal bounded backfill for separately authorized execution.
- No production backfill, schema narrowing or destructive cleanup was performed.
- Browser evidence covers the observed flows and responsive/focus checks; it is not a claim of a complete WCAG/screen-reader certification. Google OAuth, external email delivery, provider-packaged size, production rollout and rollback remain go-live checks.

## Reproduce the isolated gate

Run in an isolated checkout with no cloud deployment environment loaded. Do not copy a production `.env` file.

```sh
CONVEX_AGENT_MODE=anonymous npx convex dev --local-cloud-port 3310 --local-site-port 3311 --typecheck disable --codegen disable --tail-logs disable
```

Confirm the resulting `.env.local` points to `http://127.0.0.1:3310` and `.convex/local/default/config.json` uses 3310/3311. Generate fresh RS256 keys locally (with `jose.generateKeyPair` and extractable keys), configure `JWT_PRIVATE_KEY`, `JWKS`, a fresh `PLATFORM_BILLING_BRIDGE_SECRET`, and `SITE_URL=http://localhost:3188` using `npx convex env set NAME` with values supplied on stdin. No Resend or Google keys are needed for the local fixture. Never print these values.

```sh
npx convex codegen --typecheck disable
node scripts/seed-convex.mjs --only ideas
npm run dev -- --port 3188
node scripts/dashboard-local-session.mjs --confirm-disposable=wp44 --email=member-a@example.test --output=.convex/local/member-a.json
node scripts/dashboard-local-integration.mjs --confirm-disposable=wp44
npm run typecheck
npm run lint
npm test
npm run build
npm run check:server-traces -- --package
npm run check:idea-corpus
npm audit
```

Open the ignored fixture file’s confirmation URL in the browser and confirm the displayed synthetic account. The helper stores a real one-use code and exercises the actual sign-in route without external delivery. Do not commit fixture codes or local state. CLI seeding is safe only after the explicit local-target checks above; the existing general seed script also supports cloud targets and must not be used casually.

## Claude review follow-up (PR comment 5849896214)

The follow-up targets the three requested pre-merge fixes plus the smaller interaction and evidence findings. See WP44-R5–R8 for scope and acceptance criteria. The original forged-token evidence above did not establish backend verification: a missing `iat` could trigger middleware refresh rejection first. The corrected fixture and rerun evidence are recorded in [the follow-up report](2026-09-26-dashboard-review-followup.md). All backend/browser evidence in this report comes from local disposable services, including the production-mode Next build; none represents a production deployment. Evidence text uses `<workspace>`, `<repository>` and `<home>` in place of machine-specific paths.

Release order is backend first, frontend second. `next build` does not publish Convex functions. Verify the new `requireMember` guard and versioned Save contract on the target backend before rolling out this frontend; preserve the compatibility functions for frontend rollback.
