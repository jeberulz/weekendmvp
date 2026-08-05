# WP25 Progress - Idea Intake, Versioned Briefs, Projects, And Public CTA

Append-only progress log. Do not rely on chat history for project state.

## 2026-08-05 - Setup and story freeze

- Branch/worktree: `codex/wp25-intake-projects`, `.worktrees/wp25-intake-projects`.
- Assignment: WP25 worker owns S1-S5 and prepares S6 evidence. The orchestrator owns story checkboxes, cross-package rulings, registry/manifest/ledger/gate truth, independent review, and integration.
- Frozen paths: `/dashboard/new` for authenticated own-idea intake and `/build/{slug}` as the public repository CTA contract. WP27, not WP25, owns anonymous preview rendering/security.
- Frozen lifecycle: resumable editable draft, immutable confirmed revision, later changes create the next draft revision, and the prior version is superseded only after re-confirmation. Repository source snapshots remain immutable. Cal.com is deferred.
- Shared-contract boundary: WP22 schema, validators, statuses, indexes, transitions, authorization helpers, and document-size rule are immutable in this worktree.
- Public boundary: narrow CTA only; canonical URL, metadata, JSON-LD, public research content, email gate, and collection behavior must not regress or fork.
- Required gate: typecheck, lint, full tests, build, production dependency audit, diff/secret scans, focused browser/a11y/SEO journeys, two-user/revision/idempotency tests, and independent high-risk data review.
- Production remains untouched: no deploy, backfill, environment mutation, customer data inspection, preview generation, or external service call is authorized.
- Next: implement one story at a time, append evidence and blockers here, and return a cleanly scoped diff.

## 2026-08-05 - WP25-S1 owner-scoped project creation

- Added `convex/platform/intake.ts` and `briefPayload.ts` over the frozen WP22 tables; no schema, validator, status, transition, or index changed.
- Own-idea creation accepts a bounded structured brief only. Repository creation accepts a slug only, resolves the canonical `ideas` row server-side, and freezes its ID plus source metadata in the initial JSON brief document.
- Project owner, source snapshot, initial statuses, revision, timestamps, and graph relationships are server-derived. The owner-scoped idempotency index makes repeated/concurrent starts return one project/submission/document/brief graph.
- Focused evidence: anonymous denial, two-owner key isolation, unknown repository denial, canonical snapshot assertions, and concurrent duplicate attempts pass in `convex/wp25Intake.test.ts` as part of 86 passing Convex tests.

## 2026-08-05 - WP25-S2 resumable immutable briefs

- Added atomic draft save, confirm, and next-revision operations. Saves require the current revision and server timestamp; identical retries are harmless, stale writes fail, and each revision binds to its exact submission through a server-owned idempotency key.
- Confirmed brief documents are never patched. A later edit copies the confirmed payload to a new draft document; the previous confirmed brief changes to `superseded` only when the replacement confirms.
- Repository `sourceSnapshot` is reconstructed only at initial server resolution and preserved byte-for-byte across edits. Forged brief/document/project relationships, archived projects, cross-owner IDs, skipped/stale revisions, invalid page sizes, and documents above 256 KiB fail closed in focused tests.
- Queries are owner-derived, bounded or paginated, hide archived records, use generic cross-owner not-found behavior, and return only the brief/card projections needed by the UI.

## 2026-08-05 - WP25-S3 own-idea intake journey

- Added `/dashboard/new` with a staged shape -> review -> confirm flow, resumable server drafts, 800 ms queued autosave, explicit save state, inline field errors, stale-write recovery copy, and server-confirmed navigation to the owned project.
- Refresh and direct `?project=` resume use owner-authorized queries; local storage holds only a random idempotency key, never brief text, identity, or authoritative state.
- The form uses labelled native controls, linked descriptions/errors, persistent entered values, heading focus on review, polite live regions, keyboard-visible focus, mobile stacking, and reduced-motion-safe loading indicators.
- Focused typecheck and ESLint pass with no WP25 warning. Impeccable detector returned no findings across the new intake/project/CTA surfaces.

## 2026-08-05 - WP25-S4 project cards and resume actions

- Added `/dashboard/projects`, `/dashboard/projects/{projectId}`, bounded project cards, direct generic error handling, real lifecycle labels, revision history, own-draft resume, and a server-confirmed `Edit as a new revision` action.
- Cards do not invent completion percentages, artifacts, activity, reports, or live sites. Empty state offers the two supported starts: Explore or bring an own idea.
- Owner isolation, archived filtering, bounded page-size denial, pagination, draft/confirmed projections, and cross-owner direct access are covered by the Convex suite.

## 2026-08-05 - WP25-S5 public preview CTA contract

- Added one server-rendered, same-origin `Preview this idea` link to `/build/{slug}` inside the actual idea article renderer. Collection hubs continue to return before this renderer and therefore do not masquerade as buildable ideas.
- The seam is a normal link that works without JavaScript and has visible focus/accessible copy. WP25 did not add `/build/{slug}`, capability tokens, preview generation, personalized metadata, or duplicate research.
- `tests/security/wp25-routes.test.mjs` passes for private noindex metadata, CTA link semantics, collection separation, and unchanged canonical/JSON-LD markers.

## 2026-08-05 - WP25-S6 worker gate evidence prepared

- `npm run typecheck`: pass.
- `npm run lint`: pass with 0 errors and 35 pre-existing repository warnings; focused WP25 ESLint has 0 findings.
- `npm test`: pass (91 OG, 6 links, 7 redirect-node, 25 redirect-Vitest, 29 auth, 7 security, 4 sitemap, and 86 Convex tests).
- `npm run build`: pass after installing the lockfile-pinned dependencies locally in this isolated worktree; 306 pages generated. Existing middleware deprecation and dynamic filesystem tracing warnings remain outside WP25 scope.
- `npm audit --omit=dev --audit-level=high`: pass, 0 vulnerabilities. `git diff --check`: pass. Impeccable detector: no findings.
- The initial build attempt failed only because Turbopack does not resolve the parent checkout's packages across the worktree root; `npm ci` created an untracked local dependency tree and the unchanged-lockfile build then passed.
- `npx convex codegen` could not run in this isolated worktree because `CONVEX_DEPLOYMENT` is intentionally absent. The generated API declaration was updated narrowly for local type safety; after parallel merge, the orchestrator should regenerate the shared Convex API once in its configured serialized window.
- Not claimed here: authenticated desktop/mobile browser journey, live Convex deployment, production data, independent high-risk review, or final WP25 gate. Those remain orchestrator/gate-runner work after parallel integration; S6 is not marked complete.

## 2026-08-05 - Independent gate corrections

- Corrected first-entry persistence: the first meaningful field now creates or updates a max-bounded partial draft through the server autosave queue before Review. Confirmation still performs full server-side brief validation. Local storage retains only the random idempotency key, never intake text or identity data.
- Corrected reactive stale-state handling: a newer server revision hydrates only when the local form is clean. When unsaved local text exists, the UI preserves both the text and the last valid write token, surfaces a conflict, and blocks further silent writes until the user refreshes or copies their work.
- Replaced the 25-project resume scan with an exact owner-derived lookup through the frozen `by_ownerId_and_idempotencyKey` index. Coverage proves a draft remains resumable after 35 newer projects and remains hidden from a second owner; no schema or index changed.
- Added generic route error boundaries for new-intake, project-list, and project-detail routes. Errors expose no record IDs and offer bounded retry/navigation recovery.
- Made intake progress non-color-only with numbered/completed markers, explicit current-step text, `aria-current="step"`, and mobile stacking.
- Added rendered component/accessibility coverage for first-entry save qualification, clean server hydration, dirty conflict preservation, resume/save/stale live-region semantics, progress state, responsive layout, and generic route failure recovery.
- Corrected full gate: `npm run typecheck` pass; `npm run lint` pass with 0 errors and the same 35 pre-existing warnings; `npm test` pass (91 OG, 6 links, 7 redirect-node, 25 redirect-Vitest, 35 auth, 7 security, 4 sitemap, and 88 Convex tests); `npm run build` pass with 306 pages and only the existing middleware/filesystem warnings; production dependency audit reports 0 vulnerabilities; `git diff --check` pass.
- Scope remains frozen: no schema, status, transition, index, billing, report, Cal.com, `/build/{slug}`, cloud, or production changes. WP25-S6 remains pending the orchestrator's authenticated browser journeys and independent final gate.

## 2026-08-05 - Residual first-save race correction

- Corrected the same-key concurrent-create race without changing the schema or idempotency contract. `startOwnIdea` now returns the canonical stored input, revision, and timestamp on both creation and retry, plus whether the caller's normalized input was accepted. An identical retry remains accepted and idempotent; a differing retry receives the winner's authoritative payload and version.
- The client now treats that mutation response as authoritative. It shows `Saved` only when current local text matches the canonical response (or the accepted attempt can be safely normalized to it). A losing tab keeps its different text, records the canonical compare-and-swap base, raises a conflict, and cannot continue to Review or silently overwrite the winner.
- Closed the reactive-query form of the race as well: an exact-key query cannot hydrate over typed text while the initial mutation is pending, and a shared-key draft discovered before that mutation preserves local text and conflicts rather than overwriting either side.
- Added a concurrent differing-input Convex test using `Promise.all`; exactly one caller is accepted, both receive the same canonical graph/payload/version, the stored document matches that winner, and only one project/submission/brief/document graph exists. Client reconciliation tests prove the losing text is retained with a non-`saved` conflict result and text entered during an accepted in-flight save remains dirty.
- Corrected full gate: `npm run typecheck` pass; `npm run lint` pass with 0 errors and the same 35 pre-existing warnings; `npm test` pass (91 OG, 6 links, 7 redirect-node, 25 redirect-Vitest, 37 auth, 7 security, 4 sitemap, and 89 Convex tests); `npm run build` pass with 306 pages and only the existing middleware/filesystem warnings; production dependency audit reports 0 vulnerabilities; `git diff --check` pass.
- Scope remains frozen and production untouched. WP25-S6 still awaits the orchestrator's authenticated browser journeys and independent final gate.

## 2026-08-05 - Independent code re-review passed; browser gate pending

- Final targeted review found no remaining Critical, High, or Medium code issue. It independently verified the authoritative concurrent-create winner, losing-tab conflict/non-Saved behavior, in-flight reactive-query guard, owner isolation, immutable revisions, repository snapshots, bounded resume, generic route errors, semantic progress, CTA/SEO, and frozen-schema boundaries.
- Independent focused evidence passed: 20 Convex/client-state/accessibility tests, 3 route/SEO tests, typecheck, focused ESLint, dependency audit with 0 vulnerabilities, diff check, and secret scan. Worker full evidence remains green with 37 auth and 89 Convex tests plus the 306-page production build.
- WP25-S1 through S5 are complete. S6 remains pending—not failed—because the available environment has no isolated authenticated synthetic deployment. A safe desktop/mobile browser journey must still verify autosave before Review, refresh/resume, two-tab conflict, review focus, confirmation, keyboard order, responsive layout, and automated accessibility before the package gate is marked complete.
