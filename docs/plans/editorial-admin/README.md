# Editorial Admin — implementation handoff

Prepared 2026-09-27 for the owner's request: a separate super-admin workspace to review every idea and its research, edit it, approve it, and explicitly publish it; manage revisions, unpublishing and deletion of existing ideas too.

**This is a plan, not an implemented dashboard.** Build in parallel with WP45 without modifying WP45's checkout or engine files. This planning branch is `codex/editorial-admin-plan`, based on main `359ad428`. The engine checkout is already active on `codex/wp45-idea-engine-completion`; do not use it for this work.

Read in order:

1. [Product and design specification](design.md)
2. [Implementation, contracts and acceptance gates](implementation.md)
3. Existing `docs/wp/wp38-stories.md` for the super-admin authorization/audit foundation.
4. WP45's `docs/plans/idea-engine/2026-09-27-completion-plan.md` when integrating the finished engine. Its schema is still under construction; use adapters, not guessed imports.

## Scope decisions

- A separate **Editorial** interface under `/admin/editorial`, within the existing Next.js application, with its own shell. No changes to the member `/dashboard` or public page design. A second deployed application/auth system is unnecessary for this first version.
- You are the sole super-admin. Server-side capabilities must be bound to your verified account through deployment configuration. No client-side email check, shared admin password, or customer-data bypass.
- “Accept idea”, “Approve revision”, and “Publish” are three separate decisions. The engine can submit drafts; it can never make these decisions for you.
- Save/edit never changes a live page. An edit creates a private revision; the last published revision remains live until a successful explicit release.
- Delete means recoverable **Move to Trash**. A live idea must first be successfully unpublished. No permanent deletion, and no erasing audit history or readers' saved plans.
- Existing live ideas can be imported into the workspace without republishing or falsely marking them verified. Revisions undergo current quality and review gates before republishing.
- No automatic publish, bulk approval, or scheduled publishing in v1. A Publish click authorises one exact reviewed release, not arbitrary future edits.
- This is canonical Weekend MVP content publishing, not the paused tenant-site publishing/credits work.

## Work boundaries

Start an isolated worktree under `.worktrees/editorial-admin-ui` on `codex/editorial-admin-ui`. Use a fresh checkout of main; do not switch the shared root checkout. Work Package lane. Reserve the next unused WP ID when implementation begins (WP45 is already occupied). Keep initial story/progress files within this directory until a coordinated registry update; do not race another agent editing `docs/PROJECT_STRATEGY.md`.

The parallel slice owns only new files under `app/admin/editorial/**`, `components/admin/editorial/**`, `lib/editorial/**`, `tests/editorial/**`, and these plan/story/progress docs. No production credentials or live mutations. No writes to `lib/engine/**`, engine scripts, public idea content, member dashboard, shared auth, schema, generated files, CI or lockfile during the parallel UI slice. Shared integrations are a later, explicit phase with a single assigned writer.

## Prompt to give Claude

> Build the Editorial Admin described in `docs/plans/editorial-admin/README.md`, `design.md` and `implementation.md`. Read repo instructions first. Use your own branch and contained worktree; WP45 engine work and the member dashboard are separate and must remain untouched. Start with E0–E3: contract fixtures, a private editorial shell, review queue, evidence/article editor, revisions, explicit review checklist and release/trash UI. Use the fixture adapter with a conspicuous local-demo label; do not claim that demo approval or publishing is real. Keep fixture mode impossible to activate in production and do not add an authentication bypass to a deployable route. Save state and conflict behaviour must be testable. Use a Markdown editor with safe preview, not unrestricted MDX execution. Match the design specification, including mobile, keyboard, error and empty states. Record stories/progress and verify each slice. Then implement E4–E7 only when the serialized schema/auth/engine/publishing integration windows are assigned; if they are not available, complete the fixture/UI slice and report the exact blocked integrations. Reuse WP38's narrow super-admin foundation and WP45's verification/promotion library rather than rebuilding them. No broad admin/billing/tenant features, production bootstrap, import, deploy, seed, push or merge without the appropriate explicit operator instruction. Final delivery requires the stated security, recovery, public-visibility and human-approval acceptance tests; mocks cannot satisfy the production gate.

The parallel slice is independently reviewable and mergeable behind a deny-by-default feature flag. The complete product requires the later integration gate; an attractive mock dashboard is not completion.

## Planning evidence

Read-only inspection found:

- WP38 is planned, not implemented in this baseline. `docs/wp/wp38-progress.md` records a story freeze, not working super-admin authorization.
- WP45 owns research records, compiler safety, quality checks and local promotion; its scope excludes the admin UI and production activation.
- `lib/canonical-idea-body.ts` chooses filesystem MDX before Convex body. Public idea resolution uses hour-scale cached data and a filesystem fallback when Convex is unavailable.
- `convex/ideas.ts` exposes public catalogue queries; simply adding private draft fields to that table would risk exposing them.
- Homepage picks read the repository manifest, while public catalogue lists use Convex. A complete release must reconcile both.
- Existing rulings preserve soft deletion, immutable audit, one schema writer and super-admin-only editorial access.

This plan changes no runtime code, registry, shared manifest, credentials or live data. Product recommendations become the implementation contract when this work package is opened; do not silently reinterpret old WP38/WP32 boundaries. Document the editorial-only WP38 dependency slice at that point; billing, account support, customer reports and tenant operations remain out of scope.
