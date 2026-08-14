# WP29 Progress - v1.0 Project Cockpit Minimum

Append-only progress log. Do not rely on chat history for project state.

## 2026-08-14 - Setup

- Branch/worktree: `feat/wp29-min` at `.worktrees/wp29-min` from `origin/main` `@ 80d6f27fa6bfee1bd9150e07a11fba699e8d8377`
- Assignment: U-wp29-min local worker. Exclusive branch. Do not touch primary checkout (`4ee44b2`). Do not resume wp23/24/25/26/38 worktrees.
- File boundaries: `docs/wp/wp29-stories.md`, `docs/wp/wp29-progress.md`, `app/dashboard/projects/**`, `components/platform/projects/**`, `convex/platform/projects.ts` and sibling project/site/credit query files already owned by those modules, tests next to them.
- Required checks: `npm run typecheck`; `env -u RECRAFT_API_KEY -u RECRAFT_STYLE_ID npm test`; `npm run build`
- Initial risks: ProjectWorkspace is brief-centric; publish lives in WP28 mutation; credits live in WP24 `billing.queries.summary`; claimed previews have a draft site with no hostname.

## 2026-08-14 - WP29-S1

- Actions taken: Froze `docs/wp/wp29-stories.md` to the v1.0 min slice only (status, publish, tenant URL, credit balance, `/ideas/{slug}`).
- Decisions made: S-numbers stop at S4. Revision/refund/artifact stories are named only as out of scope.
- Checks run: none yet (docs freeze).
- Result: stories frozen.
- Next: S2 query, then S3 UI.

## 2026-08-14 - WP29-S2 / WP29-S3 / WP29-S4

- Actions taken: Extended `getOwned` with an owned `site` summary. Added a cockpit section on `ProjectWorkspace` for server status, WP24 credit balance, publish via existing WP28 mutation, tenant URL, and `/ideas/{slug}`.
- Decisions made: Did not change `convex/schema.ts`, ledger math, publish mutation, or DNS. Own-idea projects hide the publish control. Project status badge shows the raw server status instead of remapping `validating` to "Brief confirmed".
- Checks run (worktree `.worktrees/wp29-min`, after `npm ci`):
  - `npm run typecheck` exit 0
  - `env -u RECRAFT_API_KEY -u RECRAFT_STYLE_ID npm test` exit 0 (`test:auth` 4 files including `tests/auth/wp29-cockpit.test.ts`; `test:convex` 20 files / 266 tests including `projects.cockpit.test.ts`)
  - `npm run build` exit 0 (349 static pages; `/dashboard/projects/[projectId]` present)
- Result: min slice compiled and gated. SHA recorded after commit.
- Gotchas: First `npm test` from a broken worktree `node_modules` walked up to the stale primary checkout and scanned sibling worktrees. Re-ran after `npm ci` in the worktree.
- Next: push `feat/wp29-min` and open PR against main. Do not merge.
