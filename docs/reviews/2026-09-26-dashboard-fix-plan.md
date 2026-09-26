# Dashboard redesign: proposed repair and release plan

Date: 26 September 2026  
Status: **Implementation authorized on PR #81, 26 September 2026.**  
Based on: [independent audit of `7cf31dea`](2026-09-26-dashboard-audit.md).

## Objective and boundaries

Ship the ideas-first free dashboard with reliable discovery, saving and weekend planning, while keeping Builder's Hub and site publishing behind their current boundaries. Preserve the research-desk design. Fix known defects through small reviewable changes instead of another broad redesign.

This plan does not authorize subscription checkout, production data mutation, publishing activation, deployment, merge or deletion. Those remain separate actions. No repair code, schema change or product ruling was made during the audit.

The existing WP44 branch contains the entire multi-phase implementation, although the original stories proposed separate phase merges. Do not split that history mechanically during the review. First reconcile the final candidate and then use focused repair PRs, or cleanly separated commits if the branch must remain a single integration candidate.

## Phase 0 — freeze the candidate and reconcile findings

**Dependencies:** none. **Risk:** low. **Lane:** Gate/documentation.

1. Obtain the next pushed Claude commit. Compare it with the audit pin `7cf31dea` and identify which findings it fixes. The session already described pending pagination, drafts, auth and focus changes; do not reimplement them based on chat claims.
2. Record a candidate SHA, base SHA, enabled flags and exact scope. Keep site publishing parked and Builder's Hub UI disabled.
3. Update WP44 stories/progress with report finding IDs and the real gate status. Fix stale references such as the WP43 PRD filename in the paid-plan ruling by an append-only clarification if necessary; never rewrite ruling history.
4. Before starting a repair program, add the approved scope/waves/file boundaries to the program manifest and freeze it according to the repository workflow. This proposal does not alter the existing frozen manifest.

**Exit gate:** every finding is marked open, fixed-and-retested, deferred-with-reason or a decision needed. Review covers one reproducible commit. No “fixed” status based only on a session message.

## Phase 1 — free-path correctness and authentication

**Dependencies:** Phase 0. **Risk:** high for authorization/state changes; medium for UI. **Lane:** scoped Work Packages. No production data migration expected.

| Repair | Files/ownership boundary | Acceptance criteria |
|---|---|---|
| R1: complete browsing and search — A04/A05 | `convex/platform/ideas.ts`, `libraryFilters.ts`, `dashboard.ts`, required indexes; `IdeasLibrary.tsx`, `SavedIdeas.tsx`, query tests | Every record is reachable with 241+ saves and 1,001+ ideas; stable continuation and explicit completion; no endless Show more. A matching item beyond 256 search hits remains discoverable with category/tool/time/goal filters. Totals and facets do not imply completeness falsely. Test deduplication and ordering. |
| R2: validate replacement intent — A06 | `weekendPlans.ts`, `StartPlan.tsx`, plan tests | Confirmation includes expected plan ID/version; stale state returns a typed conflict and refreshes the choice. Two tabs cannot archive an unseen replacement. Duplicate/retried submissions do not create extra active plans. |
| R3: verified prompt-route auth — A07 | `app/api/ideas/prompts/route.ts`, auth/route tests | Missing, forged, expired and revoked sessions fail; a valid member succeeds. Authentication is verified before content access. Public idea research stays static and free. If endpoint policy changes to public, record that explicit decision instead of retaining a pretend member check. |
| R4: restore existing draft access — A08 | `BuildsList.tsx`, owner-scoped draft query/adapter, relevant tests and docs | A member with an existing draft can reach `/dashboard/new?project=…` through Builds. No foreign drafts, new own-idea entry point or publishing CTA appears. R4’s exception is explicit in stories. |
| R5: reliable Save intent — A09 | Public `SaveIdeaButton.tsx`, pending-save helper/runner if approved, interaction tests | Rapid Save/Unsave preserves the latest intent in both UI and database regardless of response timing. Older errors cannot roll back newer success. Visible feedback accompanies accessible announcements. Failed signup-time saving has a deliberate retry policy and does not silently disappear on reload. |

**Implementation guidance:** pagination needs a query strategy, not a larger magic number. Avoid adding indexes until the filtered/search/paging contract is clear. Only one writer owns `convex/schema.ts` and generated API output in a merge window. UI and backend contracts must land together or have compatibility adapters.

**Exit gate:** targeted runtime regressions pass, including the audit’s four backend scenarios; typecheck, lint and full tests pass. Exercise changed UI with controlled latency and errors. Update documentation for changed contracts and behavior.

## Phase 2 — safe deployment and reproducible verification

**Dependencies:** Phase 1 for final journeys; compatibility design can be prepared alongside it. **Risk:** high. **Lane:** backend compatibility WP plus Gate.

1. **Keep old clients working (A02).** Temporarily retain `dashboardSummary`, `explore` and `setIntent` with their prior authorization/response contracts. Define their retirement window. Additive backend deploy first, frontend second, adapter removal later. Test an old tab staying open and rollback of only the frontend.
2. **Verify the real schema (A01).** Use a named disposable Convex environment. Regenerate declarations with the supported tooling; review the diff instead of hand-editing generated files. Verify all five tables and two search indexes, index readiness and old-record reads. No production backfill is required merely to add empty owner tables.
3. **Reduce and measure deployment artifacts (A03).** Make filesystem roots statically discoverable and remove unintended docs/public asset inclusions without breaking content loading. Measure final packaged functions, not just NFT input sums. Check cold requests and regeneration for prompt, export, dashboard and sitemap routes.
4. **Strengthen verification (A10).** Replace the vacuous privacy slice with runtime output assertions. Deliberately insert an unwanted field in an isolated probe to prove the guard fails, then restore the candidate. Commit a reproducible browser setup and disposable fixtures; source-only assertions remain supplemental.
5. **Reconcile content sources.** Compare manifest/MDX/Convex slugs and required fields. Cover Convex-body ideas through the same canonical content resolver or explicitly constrain the supported catalog with a release validation rule. Never silently export an empty pack.
6. **Handle toolchain advisories (A11).** Use a separate dependency-only change. Inspect advisory applicability, update the affected development chain and rerun all checks. Preserve the clean production audit.

### Required free-path journey gate

| Scenario | Must demonstrate |
|---|---|
| New anonymous reader | Public research renders → Save → signup → real auth callback → Saved contains the intended idea → reload keeps it |
| Returning member | Login/logout/session expiry behave correctly; research stays public; private routes remain protected |
| Setup | Complete, skip and edit answers; personalized results update; no onboarding dead end |
| Discovery | Search/filter/sort and pagination cover realistic large data; empty states are truthful |
| Planning | Start → toggle/undo → save scope → copy prompt → save live URL → finish → reload; new plan can start afterwards |
| Replacement | Two-tab stale confirmation cannot archive a different plan; conflict copy gives a clear next action |
| Existing member | Old Saved/Interested flags merge correctly; own-idea drafts resume; preview-claim handoff remains intact |
| Ownership | Account B cannot read/mutate account A’s saves, plans, preferences, collections or notes; foreign/missing IDs behave consistently |
| Failures | Backend down, expired session, rejected mutation, clipboard unavailable, blocked storage, missing/unseeded idea and slow requests |
| Accessibility | 390px and 1440px, keyboard-only, screen-reader spot checks, 200% zoom, short landscape, long titles, reduced motion; no unacceptable violations |
| SEO | Public canonical/JSON-LD/route behavior preserved; private routes noindex and absent from sitemap |

**Exit gate:** evidence attaches to the final SHA and actual enabled flags. Record precise environment, commands, screenshots and expected/actual results. A mocked transport may supplement testing but cannot be the sole evidence of a successful authenticated journey.

## Phase 3 — experience polish after behavior is stable

**Dependencies:** Phase 1 and usable staging. **Risk:** medium. **Lane:** bounded UI Work Package.

- Make the Choosing card’s primary action lead clearly to a selected weekend plan; avoid requiring users to infer the row icon.
- Prefer safe initial focus for archive/delete confirmations, associate consequence text, restore focus on cancellation and handle deletion errors/pending state. Check Account and upgrade sheets at short/zoomed sizes.
- Make error feedback visible as well as announced. Keep per-module isolation and deliberate loading states.
- Use “Finished” versus “You shipped” according to the recorded outcome. Retain the ability to stop an experiment without overstating success.
- Keep mobile Save’s free-account transition understandable. Preserve the existing public-page visual scope unless a larger change is approved.
- Decide separately whether archived plans get a discoverable archive/restore flow. Do not bundle a lifecycle policy change into a focus fix.
- Extract repeated field/action/confirmation patterns only after tests protect behavior. Avoid a new design system or broad visual rewrite.

**Exit gate:** targeted before/after screenshots and task-based interaction review; accessibility tests cover the changed controls. Product decisions are recorded as rulings where required.

## Phase 4 — Builder's Hub readiness, separately gated

**Dependencies:** stable free release; explicit paid-feature scope approval. **Risk:** high. **Not required to start shipping the free experience.**

1. Resolve B01: paginate active/history views, use exact duplicate/invariant checks, count usage truthfully, and define downgrade behavior for members with more than one active plan. Test 21+, 50+ and completed-history boundaries. Do not silently archive extra plans.
2. Resolve B02/B03: collection deletion error recovery, cancellation focus and detached-trigger upgrade recovery.
3. Resolve B04: record whether collection/note records follow soft-delete policy or an explicitly approved exception. If existing data requires a migration, prepare a dry-run inventory, backup/restore procedure and separate approval before execution.
4. Complete the separate subscription WP: server-verified entitlement source, checkout/webhook idempotency, cancellation, renewal/failure/downgrade behavior, billing access and honest pricing/availability copy. Do not reuse credit-pack identities.
5. Only after those gates pass, rebuild with the Builder's Hub UI flag enabled and verify real Free/paid transitions. The frontend flag does not grant backend entitlements and must not be treated as an activation checklist by itself.

**Exit gate:** owner-approved paid activation with subscription, data lifecycle, security, UX and rollback evidence. Site publishing and WP29–31 remain paused.

## Rollout and rollback proposal

1. Prepare and verify additive backend compatibility on staging.
2. Record production backup/restore markers and the exact deploy inventory when deployment is separately authorized.
3. Deploy compatible backend changes; verify schema/functions/indexes before deploying frontend.
4. Release the free dashboard with paid surfaces disabled; execute the normal stranger/member smoke journeys and observe errors plus save/plan failures.
5. If frontend release fails, roll it back while the compatible backend still supports old clients. Preserve all newly written records; do not narrow schema or delete data as rollback.
6. Remove deprecated APIs only in a later gated cleanup with evidence that supported clients no longer need them.

## Ownership, sequencing and completion

Use one owner for schema/generated files and another clearly assigned owner for auth/middleware/dependency seams. Independent review may run alongside useful implementation, but shared-file changes should be serialized. Do not introduce sibling project folders.

Sizing is provisional: R3/R4 and the broken guard are small, bounded repairs; R1/R2 and deployment compatibility are medium design-and-test changes; real integration setup and paid billing are larger, environment-dependent work. Estimate dates only after Phase 0 reconciles already-fixed work and the staging environment is known.

The implementation is complete only when every release-blocking finding is resolved or explicitly accepted with evidence, standard checks pass on the final SHA, the real free journey succeeds, deployment and rollback are demonstrated, and the documentation reflects the actual state. Paid activation has its own exit gate.

**Authorized scope:** implement free-path repairs, runtime readiness, the UX recommendations and dormant Hub correctness fixes. Paid subscription implementation/activation and production operations remain separate. The frozen manifest and WP44-R1–R4 track execution.


## Approved UX implementation details

- Choosing cards get visible per-idea planning actions.
- Finished copy is factual; shipped wording requires a live link.
- Archived plans are discoverable and explicitly restorable under the active-plan limit. Downgrades preserve records and block additional starts/restores until the member archives excess plans.
- Setup radio groups offer No preference; optional answers remain clearable.
- Save state is serialized; errors are visible and pending signup intent is acknowledged only on success, with bounded lifetime and deliberate retries.
- Scores explain their editorial nature and point readers to research, without invented freshness or outcome guarantees.
- Destructive confirmations focus safe cancellation, restore to connected triggers, and recover from pending/errors. Short/zoomed sheet and sidebar layouts remain operable.
- Existing draft pagination must remain reachable even when the first project page contains no drafts.

The PR’s four additional review comments are included: empty-first-page drafts, clearable optional radio answers, normalized subscription claims, and Save-service outages reported separately from signed-out sessions.
