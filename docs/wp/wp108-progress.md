# WP108 Progress - Editor verify-claim action

Append-only progress log. Do not rely on chat history for project state.

## 2026-11-28 - Setup

- Branch/worktree: `marley/pain-engine-verify-claim` (created by Sir Rulz so Codex can review as the build progresses; local checkout at 54eb717, current main)
- Assignment: build the editor verify-claim action so the three submitted Pain Engine drafts' evidence blockers can be cleared after the editor checks each claim against its sources.
- File boundaries: `lib/editorial/contracts/evidence.ts`, `lib/editorial/contracts/views.ts`, `lib/editorial/contracts/repository.ts`, `lib/editorial/core/repository.ts`, `convex/editorial/commands.ts`, `lib/editorial/adapters/live/repository.ts`, `app/admin/editorial/_actions/review.ts`, `components/admin/editorial/workspace/EvidencePanel.tsx`, `components/admin/editorial/workspace/IdeaWorkspace.tsx`, tests in `tests/editorial/contract/repository-contract.ts`, `tests/editorial/core/live-core.test.ts`, `convex/editorial/denials.test.ts`, `convex/editorial/contract.test.ts`, docs `docs/wp/wp108-stories.md`, `docs/wp/wp108-progress.md`.
- Required checks: `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`.
- Initial risks: adding a new `VERIFICATION_AUTHORITIES` value is a shared-contract change (Convex validators import the same enum); the review item goes stale on verify by design; the live adapter needs a Convex mutation or production cannot use the button.
- WP number: originally WP105 (WP100–WP104 were in use on this checkout); renumbered to WP108 on 2026-11-28 because main's WP105 is the Next.js 16.4.6 security upgrade — both sides added docs/wp/wp105-*.md, blocking PR #356's merge.

## 2026-11-28 - S1–S4 implemented, tests green

- S1 (contract): `"editor"` added to `VERIFICATION_AUTHORITIES` (`lib/editorial/contracts/evidence.ts`); `"claim.verified"` added to `ACTIVITY_ACTIONS` (`lib/editorial/contracts/views.ts`); `verifyClaim(revisionId, claimId, note)` added to the `EditorialRepository` interface.
- S2 (core): `verifyClaim` implemented in `EditorialCore` after `markReviewed` — editor-only guard, single-line ≤400-char note, refuses NOT_FOUND / IDEA_TRASHED / PRECONDITION_FAILED (non-working revision) / INVALID_TRANSITION (already approved, non-material, assumed, already verified). Sets `verification = { status: "verified", reason: <note> }` and `verificationAuthority = "editor"`, moves draft → in_review, stamps the idea, records audit + `claim.verified` activity.
- S3 (transport): Convex mutation in `convex/editorial/commands.ts`, live adapter + `PartitionedEditorialRepository` delegation. Convex validators pick up `"editor"` automatically via `literals(VERIFICATION_AUTHORITIES)`. One real tsc error found and fixed: `ACTIVITY_LABELS` in `lib/editorial/presentation/activity.ts` was missing `"claim.verified"` (added `"Claim verified"`).
- S4 (UI): `verifyClaimAction` in `app/admin/editorial/_actions/review.ts` (mirrors `markReviewedAction`: `withWorkspace` + `withView`, returns the fresh revision view); Verify button in `EvidencePanel.tsx` next to each verifiable claim (material, not assumed, not already verified), using `ReasonDialog` with `required={false}` and `maxLength={EDITORIAL_LIMITS.verificationReasonChars}`; wired through `IdeaWorkspace.tsx` (mirrors `resolveIssue`, disabled while `reviewDisabledReason` is set).
- Tests: 5 new contract tests in `tests/editorial/contract/repository-contract.ts` (verify sets editor authority + clears the UNSUPPORTED_CLAIM blocker; verify without a note; customer refused FORBIDDEN; assumed + already-verified refused INVALID_TRANSITION; approved revision refused); 1 new Convex test in `convex/editorial/functions.test.ts` (owner verifies an unverified claim from a `authority: "none"` import, editor authority round-trips through the Convex validators, second verify refused); denials test updated (23 mutations, verifyClaim added to the denied-commands list).
- Results so far: contract suite 76/76 (fixture + partitioned adapters); Convex contract + denials + functions 52/52. tsc: no errors in any touched file; the 48 remaining errors are pre-existing in untouched files (keystatic not installed, 5-to-9-builder guide, landing builder-guide, tests/home). Full editorial + Convex suites, lint and build still running.
- Not done yet: full `npm run test:editorial` / `npm run test:convex` results, `npm run lint`, `npm run build`, push + draft PR. Never merge or deploy; Sir Rulz merges. Do not touch E7, releases, publishing, or the three `engine/pain/review/*.json` records (never include them in a push manifest).

## 2026-11-28 - Count fixes; suite failures triaged as load flakes

- Full-suite runs found two more count assertions that must move with the new action/mutation: `tests/editorial/structure/boundaries.test.ts` counts Convex mutations (22 → 23) and `tests/editorial/runtime/workflow-actions.test.ts` counts review+release+demo server actions (26 → 27). Both updated.
- The remaining full-suite failures were all timeouts, none of them assertions, all in files untouched by this WP: `fixtures.test.ts` / `workflow-actions.test.ts` / `actions.test.ts` / `ui/workflow.test.tsx` (fixture-environment `beforeAll`/`beforeEach` hook timeouts, 10s) and `private-engine-cli.test.ts` (5s test timeout); Convex side: `convex/crew/launchSweep.test.ts` and `convex/editorial/release.test.ts` (5s test timeouts). Every one of them passes when run alone or in a small group (workflow.test.tsx 9/9, private-engine-cli 3/3, launchSweep + release 31/31, fixtures + private-engine-cli together exit 0). Cause is CPU contention on the 1.5-shared-CPU VM, not this change. Full-suite totals with the count fixes: editorial 305 passed / 2 timeouts; Convex 1548 passed / 2 timeouts.
- eslint on all changed files: clean.

## 2026-11-28 - Build green; pushed; draft PR #356 open for Codex review

- Build blocker found and fixed: `@keystatic/core` + `@keystatic/next` were declared in package.json but not installed in node_modules, so `npm run build` failed at `app/admin/pages/keystatic.tsx` (untouched file) and tsc reported 48 errors. Ran `npm install` (119 packages added; package.json/package-lock.json unchanged). After install: `npx tsc --noEmit` = **0 errors** and `npm run build` = **green**.
- Push: 19 files via `github push-files` to `marley/pain-engine-verify-claim` (manifest `/tmp/wp105-push-manifest.txt`; the three `engine/pain/review/*.json` records were NOT included). Branch head now `a615dffc3281e033dc23419472efecaf3e7a69e3`; sync record updated. Remote branch head before push was `54eb717` (== local HEAD); main has since moved to `72f82bb` (PR #355) — the PR is based on main and may need a rebase at merge time; that is Sir Rulz's call.
- Draft PR: **https://github.com/jeberulz/weekendmvp/pull/356** (base main, head marley/pain-engine-verify-claim, draft). Codex review surface is live.
- Still open (not this WP): the checks-not-run blocker needs the in-panel Run checks step; the 0/8 review checklist needs per-item attestation; E7 activation remains a separate launch decision. Never merge or deploy; Sir Rulz merges.

## 2026-11-28 - Renumbered WP105 → WP108; PR #356 conflict fixed

- Cause: both this branch and main added `docs/wp/wp105-progress.md` and `docs/wp/wp105-stories.md` (add/add conflict). Main's WP105 is the Next.js 16.4.6 security upgrade (merged via PR #355); this branch's WP105 was the verify-claim work. WP106 and WP107 are also taken on main, so WP108 is the next free number.
- Fix: this branch's `docs/wp/wp105-*.md` were set to main's exact content (Next.js upgrade docs), and the verify-claim docs moved to `docs/wp/wp108-progress.md` / `docs/wp/wp108-stories.md` (titles, story IDs WP105-S1–S4 → WP108-S1–S4, and the one code comment in `lib/editorial/contracts/evidence.ts`). No code behaviour changed — the comment is the only code edit. PR title updated to (WP108). The conflict is now only these two files, both resolved.
