# WP11 Progress - Convex database I/O audit and safe fixes

Append-only progress log. Do not rely on chat history for project state.

## 2026-07-28 - Setup

- Branch/worktree: `feat/wp11-convex-performance-audit` in the main checkout; no worktree.
- Assignment: Audit the 710.19 MB/month Convex database-I/O baseline and implement safe local-only fixes targeting less than 250 MB/month.
- File boundaries: Convex idea/reference readers, their server-rendered callsites, focused tests/config, `docs/convex-performance-audit.md`, and WP registry/progress files.
- Required checks: formatting, lint, `npm run typecheck`, focused/full tests, Convex codegen and local query validation, `npm run build`.
- Initial risks:
  - `ideas.relatedFor`, `byTool`, and `byAudience` read full idea documents; optional `body` and `provenance` amplify row size.
  - Tool/audience membership is stored in arrays and cannot be storage-indexed without a relation/digest migration.
  - Public result eligibility and ordering must remain byte-for-byte equivalent at the slug level.
  - Existing `.env.local` points at a non-local deployment, so all Convex CLI validation must use a separate explicit local env file.
- Lane: Work Package. No schema/data migration is authorized.

## 2026-07-28 - WP11-S1 (in progress)

- Actions taken:
  - Read repository, workflow, Convex AI, hot-path, and subscription-cost instructions.
  - Confirmed a clean starting worktree and branched from `origin/main`.
  - Traced the hot functions through idea pages, metadata, cached hub routes, startup index, and sitemap.
  - Measured 140 manifest ideas; serialized source metadata averages 1,111 bytes (p95 1,647, max 2,280), before Convex system/index overhead.
- Decisions made:
  - Use the existing `by_category_publishedAt` index for the related rail, retaining a newest-first audience scan only when a sparse category cannot fill the limit.
  - Replace broad reference-table reads with existing slug indexes and a bounded categories-only reader.
  - Do not add facet relation/digest tables or split idea documents in this WP.
- Checks run: instruction and code trace only.
- Result: Root causes and safe implementation boundary established.
- Gotchas: The starting `.env.local` was not local and could not be passed implicitly to Convex CLI commands.
- Next: Start a local Convex deployment with a separate env file, seed it locally, and capture baseline parity cases.

## 2026-07-28 - WP11-S1 complete

- Actions taken:
  - Started a fresh local Convex backend at `http://127.0.0.1:3210`; selected "start fresh" and transferred no external data.
  - Updated `.env.local` to the local client/site URLs and kept functional commands pinned to `CONVEX_DEPLOYMENT=local:local-john_iseghohi-weekendmvp_2a6d0`.
  - Refreshed stale official Convex AI files with `npx convex ai-files install` and reread the updated guidance.
  - Seeded only the local backend with 140 ideas and all reference tables.
  - Measured local full idea result JSON at 168,463 bytes total, 1,203-byte mean, 1,733-byte p95, and 2,374-byte max.
  - Captured the legacy ordered-related-slug checksum across all 140 seeded ideas: `592517a3fc38ee4d65a81d23832c7f483d9e3fba96403c2a66652278a2592a6f`.
- Decisions made:
  - Treat the owner-supplied dashboard as the production baseline; local CLI insights are unsupported.
  - Keep cloud/production data out of scope.
- Checks run: local seed counts, document-size inventory, 140-slug legacy query sweep.
- Result: Audit evidence and parity baseline complete.
- Gotchas:
  - `convex dev --configure new --dev-deployment local` unexpectedly attempted cloud project creation first and failed HTTP 400; no project/deployment was created.
  - `convex insights --deployment local` unexpectedly attempted a control-plane usage lookup and failed HTTP 404; no cloud function data was queried.
- Next: Implement the indexed read path and focused tests.

## 2026-07-28 - WP11-S2 complete

- Actions taken:
  - Replaced the full idea collection in `relatedFor` with `by_category_publishedAt.take(limit + 1)`.
  - Preserved newest-first shared-audience fallback with stop-when-full async iteration.
  - Bounded limits at 12 and returned only `slug`, `title`, and `category`.
  - Added five Convex tests covering eligibility, order, deduplication, limits, empty results, public/authenticated parity, missing optionals, and the six-document common read budget.
- Checks run:
  - `npm run test:convex` — 5/5 pass.
  - Post-change 140-slug checksum — exact match with the legacy baseline.
- Result: Public four-card related results are identical for all local seeded ideas; common read set is at most six documents.
- Gotchas: Sparse future categories still use the exact audience fallback and may read farther through the publish-date index.
- Next: Narrow broad reference-table reads.

## 2026-07-28 - WP11-S3 complete

- Actions taken:
  - Added bounded `referenceTables.allCategories`.
  - Switched tool hubs to indexed `toolBySlug`.
  - Switched audience hubs to indexed `audienceBySlug`.
  - Switched startup filters to categories only.
- Checks run: `npm run typecheck`, full test suite, production build, and served-page smoke tests.
- Result: Repository callsites no longer use `referenceTables.all`; public copy/fallback/result order is unchanged.
- Gotchas: The broad function remains public for compatibility with any unknown external callers.
- Next: Complete the final gate and I/O forecast.

## 2026-07-28 - WP11-S4 complete

- Actions taken:
  - Added the `convex-test`/Vitest edge-runtime harness.
  - Corrected pre-existing Node 22 test scripts to target `*.test.mjs` files instead of unsupported directory arguments.
  - Wrote `docs/convex-performance-audit.md`.
  - Built and served the production application against local Convex.
- Checks run:
  - `npx prettier --check ...` on changed/new core code and audit/WP docs — pass.
  - `git diff --check` — pass.
  - `npm run lint` — unavailable because the repository has no `lint` script.
  - `npx -y oxlint@latest` on all changed TS/TSX files — 0 errors; one pre-existing `Link` unused-import warning in `app/ideas-for/[audience]/page.tsx`.
  - `npm run typecheck` — pass.
  - `npm test` — pass: 91 OG + 6 links + 5 Convex tests.
  - `CONVEX_DEPLOYMENT=local:... npx convex codegen` — pass against local backend.
  - `npm run build` with local Convex URLs — pass, 273/273 static pages; existing sitemap/NFT tracing warning remains.
  - Served-page smoke: `/ideas/abandoned-cart-recovery`, `/build-with/claude`, `/ideas-for/developers`, and `/startup-ideas` all returned HTTP 200; the idea page contained the expected related cards.
- Result:
  - Estimated monthly I/O: 154.80 MB read-set model; 188.12 MB conservative model.
  - Recommended operational budget: 200 MB/month.
  - No commit, push, deploy, import, pause, `--prod`, or cloud/production function-data command was executed.
- Gotchas: `npm install` reports 10 high-severity transitive vulnerabilities; no breaking automated audit fix was run.
- Next:
  - Observe the next complete billing window.
  - Plan facet relation rows only if the run rate stays above budget.
  - Inventory approved production row sizes/category density before considering a digest or document split.

## 2026-08-01 - Ship undeployed WP11 to production

- Actions taken:
  - Scanned commit history vs GitHub Production deployments and live `www.weekendmvp.app`.
  - Confirmed every `main` commit through `227149b` (WP09) already has a successful Vercel Production deploy and is live (ideas/articles/hubs return 200; grid includes WP09 slugs).
  - Identified the only undeployed code push: `feat/wp11-convex-performance-audit` @ `1e8f7bb` (Preview only; never merged).
  - Opened `cursor/deploy-wp11-convex-perf-d2d5` from that tip to merge into `main` for Vercel production.
- Decisions made:
  - Safe to merge Next.js callers ahead of Convex function deploy: hubs/`allCategories` degrade via existing fallbacks; `relatedFor` remains backward-compatible until `npx convex deploy`.
- Next:
  - Merge PR → confirm Vercel Production deploy for the merge SHA.
  - Run `npx convex deploy` (needs `CONVEX_DEPLOY_KEY` / owner login) so prod picks up indexed `relatedFor` + `allCategories`.

## 2026-08-01 - Vercel Production deploy confirmed

- Merged #29 → `8efd712` on `main`.
- GitHub Production deployment `5706961851` succeeded; Vercel status success.
- Live smoke on `www.weekendmvp.app`: `/`, `/startup-ideas`, `/ideas/tattoo-dm-booking-agent`, `/build-with/claude`, `/ideas-for/developers`, `/about` all HTTP 200; homepage cache age ~1s post-deploy.
- Convex MCP/CLI: no `CONVEX_DEPLOY_KEY` / login in this agent env — backend function deploy still owner-side.
