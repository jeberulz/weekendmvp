# WP97 Progress - Own-idea example chips from the library

Append-only progress log. Do not rely on chat history for project state.

## 2026-11-24 - Setup

- Branch/worktree: `claude/step1-idea-suggestions`, cut from `origin/main` (not stacked on the Step 1 link fix, PR #306).
- Assignment: replace the hard-coded `OWN_IDEA_EXAMPLES` on `/start/own` with real suggestions; recommend a source
  first.
- File boundaries: `lib/workspace/wizard/own-idea-examples*.ts`, `app/start/own/page.tsx`, `OwnIdeaStart` in
  `components/workspace/wizard/WizardFlow.tsx`, tests, docs.
- Required checks: `npm run typecheck`, the wizard suites, `npm run test:platform`, eslint on changed files,
  a11y-check.
- Initial risks: per-view spend, slowing the field, a chip that is really a library idea turning into an unvalidated
  build.

## 2026-11-24 - WP97-S1..S3

- Actions taken:
  - Wrote `docs/design/wizard-step1-own-idea-suggestions.md`. Option (c), the live library, recommended.
  - `own-idea-examples.ts`: pool (live, `isBuildCtaSlug`, headline ≤ 60 chars, single line, no market claim, deduped
    by slug and text), a draw of three per request, and a padding fallback.
  - `own-idea-examples.server.ts`: `"use cache"` pool under the `ideas` tag, using the same merge as
    `publicIdeaSlugs` (hours, or minutes on a manifest-only fallback); `ownIdeaExamplesForRequest` never throws.
  - `/start/own` starts the draw beside `requireWizardAccess` and passes it through `WizardPage` → `WizardFlow` →
    `OwnIdeaStart`.
  - `OwnIdeaStart`: chips from the prop. `applyExample` still fills and focuses the field. While the field holds a
    library chip's exact text, a polite status line offers "Build the researched version" → `/start/{slug}`.
- Decisions made:
  - No LLM. A per-view call is spend and latency for no gain. An LLM pool means a schema change (Codex), a prompt
    plus version lock, and an operator command for three pills, and its lines are unresearched. The library already
    has 222 titles of 60 characters or fewer.
  - A tap keeps filling the box (brief). The researched-version line answers the "should it go to the library idea?"
    question without taking the box away.
- Checks run: see the PR for the final results.
- Gotchas: `.next/dev/types` left over from another branch can fail `tsc`. Delete it, since it is generated.
- Next: owner review. If personalised chips are wanted later, a Convex pool can feed the same `OwnIdeaExample[]` prop.
