# WP25 Stories - Idea Intake, Versioned Briefs, Projects, And Public CTA

Branch: `codex/wp25-intake-projects`
Lane: Work Package within Build Platform Program Wave 2
Registry: `docs/PROJECT_STRATEGY.md`
Definition of done: An authenticated user can start from a canonical repository idea or their own idea, create exactly one owner-scoped resumable project/submission, review and confirm a versioned brief, resume it from project cards, and reach the repository flow from every actual public idea page through an accessible `Preview this idea` CTA; confirmed versions and repository source snapshots are immutable; SEO/canonical/JSON-LD remain unchanged; and the standard data/UX gate passes without implementing preview rendering, AI research, billing, Cal.com, or schema changes.

## Frozen Product Contract

- Repository activation uses `/build/{slug}` as the public CTA URL contract. WP25 adds the CTA and intake/project contracts only; WP27 owns anonymous preview rendering and capability security.
- Own-idea intake lives at `/dashboard/new`. It requires authentication and creates a private owner-scoped project/submission/brief.
- Repository projects retain `sourceIdeaId` and an immutable source snapshot in the versioned submission/brief document. Canonical public research remains at `/ideas/{slug}` and is not copied into a personalized article route.
- Draft briefs are resumable and editable until confirmation. Confirmation freezes the revision. A later edit creates the next draft revision and supersedes the prior version only after re-confirmation.
- All creation and confirmation paths are idempotent and server-authorized. The client never supplies authoritative owner, status, revision, source snapshot, or confirmation timestamps.
- Cal.com is deferred from v1. No scheduling UI, embed, dependency, or data contract is added.

## Stories

- [x] `WP25-S1` - Create owner-scoped repository and own-idea projects idempotently
  - Scope: `convex/platform/projects.ts`, `convex/platform/intake.ts` or equivalently narrow WP25 modules, focused tests.
  - Acceptance criteria:
    - Repository creation resolves the canonical idea server-side from slug/ID, stores its frozen `sourceIdeaId`, source type, title, and immutable versioned snapshot payload; unknown ideas fail safely.
    - Own-idea creation validates a bounded structured submission and creates a project with the frozen own-idea source type and no forged repository link.
    - Repeating the same owner/idempotency key returns the existing graph; concurrent requests cannot create duplicate project/submission/initial brief records.
    - Owner ID, source snapshot, initial statuses, revision, and timestamps are server-derived. Anonymous/cross-owner reads or writes fail under WP22 helpers.
  - Verification: anonymous/two-user/unknown-source/forged-source/idempotency/concurrency tests and `npm run test:convex`.

- [x] `WP25-S2` - Implement resumable, immutable versioned briefs
  - Scope: WP25 Convex project/intake modules and focused tests.
  - Acceptance criteria:
    - Queries return the active owned project, current draft, latest confirmed revision, and bounded project history without exposing another user's payload/document.
    - Draft save validates structured, size-bounded content and updates only the current draft revision. Confirm atomically freezes that revision and advances only allowed WP22 status transitions.
    - Editing after confirmation creates the next draft revision from the confirmed version; it never mutates a confirmed document/brief. A prior confirmed revision is superseded only when the new draft confirms.
    - Repeated save/confirm calls are idempotent; skipped revisions, double confirmation, archived projects, stale revision writes, forged document/project relationships, and cross-owner IDs fail closed.
  - Verification: lifecycle table tests, stale/concurrent edit tests, two-user graph swaps, 256 KiB document guard tests, `npm run test:convex`.

- [x] `WP25-S3` - Build the own-idea intake and confirmation journey
  - Scope: `app/dashboard/new/**`, `components/platform/intake/**`, focused UI/route tests.
  - Acceptance criteria:
    - A concise staged form captures only the information required by the frozen brief contract, autosaves/resumes a server draft, and presents a clear review step before confirmation.
    - Validation is shared/server authoritative; errors preserve entered values, identify the field/action, and never expose internal IDs or stack traces.
    - Refresh/back navigation safely resumes the owned draft, repeat submission does not duplicate it, and server-confirmed completion routes to the owned project surface.
    - Loading, save, retry, stale revision, empty, confirmation, keyboard, focus, mobile, and reduced-motion states meet WCAG 2.1 AA and the approved dark editorial design system.
  - Verification: component/route tests plus desktop/mobile keyboard and automated a11y journey.

- [x] `WP25-S4` - Add bounded project cards and resume actions
  - Scope: `components/platform/projects/**`, narrowly owned project routes/components outside WP23's dashboard root, project query tests.
  - Acceptance criteria:
    - Owner project list is indexed, paginated/bounded, excludes archived records, and returns only the fields needed for title, source, status, last update, and next supported action.
    - Cards distinguish repository versus own idea, show real lifecycle state only, and link to resume draft, review confirmed brief, or the next explicit future workflow without pretending an unbuilt report/site exists.
    - Empty/error/loading states point users to Explore or `/dashboard/new`; no fake activity stream, completion percentage, or generated artifact appears.
    - Direct project access verifies ownership server-side and uses generic not-found behavior for missing/cross-owner IDs.
  - Verification: pagination/two-user/archived-project tests and focused responsive UI tests.

- [x] `WP25-S5` - Bridge every public idea to the future preview flow without SEO regression
  - Scope: the narrow rendered-idea CTA seam in `app/ideas/[slug]/page.tsx` and/or a new `components/ideas/PreviewIdeaCta.tsx`, plus public route/SEO/a11y tests.
  - Acceptance criteria:
    - Every actual idea article (MDX or Convex-backed) presents one clear `Preview this idea` link to `/build/{slug}`; collection hub fallbacks do not masquerade as buildable idea records.
    - The CTA is a normal crawl-safe same-origin link, works without JavaScript, has an accessible name/focus state, and makes no promise that WP25 itself generated a preview.
    - Existing canonical URL, metadata, JSON-LD graph, content body, related ideas, email gate, and collection rendering remain semantically unchanged.
    - No `/build/{slug}` implementation, anonymous capability, duplicate research content, personalized public metadata, or indexable private page is introduced here.
  - Verification: representative MDX/Convex/collection/404 route tests, link test, metadata/JSON-LD regression test, automated a11y scan.

- [ ] `WP25-S6` - Run the WP25 data/UX/SEO gate
  - Scope: `docs/wp/wp25-progress.md` plus WP25-owned fixes only.
  - Acceptance criteria:
    - Standard checks and focused Convex/UI/browser/SEO/a11y tests pass with no new errors or unwaived high dependency finding.
    - Independent high-risk reviewer reports no unresolved high finding in owner isolation, idempotency, revision immutability, source snapshot integrity, stale writes, public canonical/JSON-LD behavior, accessibility, or scope separation.
    - No schema/status/index change, preview/report/workflow/payment/Cal.com implementation, public content rewrite, production deploy, data mutation, or environment change occurred.
  - Verification: `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`, `npm audit --omit=dev --audit-level=high`, `git diff --check`, secret-pattern scan.

## File Boundaries

The WP25 worker may add `convex/platform/projects.ts` and narrowly named WP25 intake/brief modules, `app/dashboard/new/**`, new project detail/resume routes that do not replace `app/dashboard/page.tsx`, `components/platform/intake/**`, `components/platform/projects/**`, the narrow public CTA seam/component, focused tests, generated Convex API types when required, and `docs/wp/wp25-progress.md`. It must not edit `convex/schema.ts`, WP23 shell/Explore/dashboard-root files, WP24 billing files, `/build/{slug}` implementation, canonical idea content/metadata rules, workflows/reports/renderers, or payment code.

## Stop Conditions

- Stop if a table, field, validator, lifecycle status, or index must change; WP22 is frozen and shared changes require orchestrator serialization.
- Stop if project/brief implementation cannot preserve idempotent creation and immutable confirmed revisions, or if repository snapshots would diverge from canonical source resolution.
- Stop before implementing `/build/{slug}`, AI/report generation, billing, Cal.com, cloud/production deployment, production data mutation, or secrets/environment changes.
