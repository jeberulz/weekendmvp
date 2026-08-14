# WP29 Stories - v1.0 Project Cockpit Minimum

Branch: `feat/wp29-min`
Lane: Work Package
Registry: `docs/PROJECT_STRATEGY.md`
Definition of done: Signed-in `/dashboard/projects/[projectId]` shows server-derived project status, a labeled publish control for a claimable repository project, the tenant URL when a site hostname exists, the WP24 credit balance, and a link to canonical `/ideas/{sourceSlug}`; typecheck, test, and build pass; PR opened against main.

## Frozen Product Contract

- v1.0 min slice only, per `docs/wp/v1-scope-cut.md`. Repository-idea journey. No wildcard DNS. No schema, Stripe, proxy/middleware, content MDX, or WP26 engine work.
- Status, hostname, publishability, and credit balance are server-derived. The client never invents lifecycle, live URL, or ledger math.
- Publish calls the existing WP28 `platform/sites/publish:publish` mutation. Disabled and error states are labeled. Idempotent republish of the same live hostname is a no-op on the server.
- Canonical research stays at `/ideas/{slug}`. The cockpit links there; it does not copy research.
- Full WP29 (revision tasks, artifact browser, refund UX beyond the existing ledger) is out of this slice.

## Stories

- [x] `WP29-S1` - Freeze the v1.0 min story file
  - Scope: `docs/wp/wp29-stories.md`, `docs/wp/wp29-progress.md`
  - Acceptance criteria:
    - Only the cockpit min slice is in-scope. S-numbers do not list revision tasks, artifact browser, or refund UX as in-scope.
    - File boundaries match the U-wp29-min brief allowlist.
  - Verification: story file exists on `feat/wp29-min` and names only S1–S4 below.

- [x] `WP29-S2` - Return owned site facts from the existing project query
  - Scope: `convex/platform/projects.ts`, `convex/platform/projects.cockpit.test.ts`
  - Acceptance criteria:
    - `getOwned` still authorizes through `requireOwnedProject`. Cross-owner and archived projects stay `RESOURCE_NOT_FOUND`.
    - The payload includes server `project.status` unchanged, plus `site: null` or `{ status, hostname?, publishable, live }` from the owned `site_configs` / latest `site_versions` row.
    - `publishable` is true only when the latest version has a document. `live` is true only when status is `published`, hostname is set, and `currentVersionId` is set.
    - No schema, ledger, or publish-mutation changes.
  - Verification: convex-test owner/stranger/no-site/draft-site/live-site cases.

- [x] `WP29-S3` - Render the cockpit on the project workspace
  - Scope: `components/platform/projects/ProjectWorkspace.tsx`, `components/platform/projects/cockpit.ts`, `app/dashboard/projects/[projectId]/page.tsx` (route already mounts the workspace), `tests/auth/wp29-cockpit.test.ts`
  - Acceptance criteria:
    - Status text is the server project status (and site status when a site exists), not a client-invented label that hides the row.
    - Repository projects show a publish control. Ready sites accept a subdomain and call `api.platform.sites.publish.publish`. Invalid slug, missing site, missing content, in-flight, and server error states are labeled via `aria-describedby` / `aria-live`.
    - When hostname exists, `https://{hostname}` is visible. DNS is not activated here.
    - Credit balance comes from `api.platform.billing.queries.summary` and is displayed as the server integer. Ledger math is untouched.
    - Repository projects with `sourceSlug` link to `/ideas/{sourceSlug}`.
  - Verification: pure cockpit-state tests plus source-level UI contract tests.

- [x] `WP29-S4` - Package gate
  - Scope: worktree checks only
  - Acceptance criteria:
    - `npm run typecheck`, `env -u RECRAFT_API_KEY -u RECRAFT_STYLE_ID npm test`, and `npm run build` exit 0.
  - Verification: command tails recorded in progress; SHA of the commit that passed.

## Out Of Scope

- Revision tasks, artifact browser, refund UX beyond existing WP24 ledger
- WP26 S2–S6 workflow engine
- WP30 policy copy, classifier, kill switch
- `convex/schema.ts`, Stripe routes, `proxy.ts` / `middleware.ts`, content MDX, `ideas/manifest.json`
- Wildcard DNS, live Stripe, Google OAuth, homepage replacement

## Notes

- Promote unknown product decisions to `docs/wp/RULINGS.md`. This slice does not invent prices, policy, or launch copy.
