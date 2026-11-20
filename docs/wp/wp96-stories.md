# WP96 Stories - Privacy and deletion basics for the beta

Branch: `claude/wp96-privacy-deletion-af66c4`
Lane: Work Package
Registry: `docs/PROJECT_STRATEGY.md`
Definition of done: a PR against `main` with typecheck, lint, test and build green, the a11y check passed on the deletion screen, and the data map and policy drafts committed for the owner's review.

The owner approves every legal word. This package drafts policy text in `docs/` only and does not change the live privacy or terms pages.

## Stories

- [ ] `WP96-S1` - Data map
  - Scope: `docs/wp/wp96-data-map.md` (new).
  - Acceptance criteria:
    - Every Convex table with personal or founder-authored fields is listed with its file, personal fields, owner key and deletion treatment.
    - Every Anthropic prompt is listed with the founder fields it receives.
    - Beehiiv, GA4 (consent-gated), Stripe, Resend and image providers are covered, with what each receives.
    - Every row cites a file. Anything the code cannot confirm is marked `UNCONFIRMED`.
  - Verification:
    - Read-through against the code; `git diff --check`.

- [ ] `WP96-S2` - Policy drafts
  - Scope: `docs/wp/wp96-policy-drafts.md` (new). The live pages `app/(marketing)/privacy-policy/page.tsx` and `app/(marketing)/terms/page.tsx` are not edited.
  - Acceptance criteria:
    - A draft privacy section and a draft terms section cover: AI processing and the processors, how long data is kept, who owns AI-generated output, the beta disclaimer and how to request deletion.
    - Every claim the code does not confirm is marked, and the owner questions are listed.
    - The draft describes what the deletion code really does, including what it keeps.
  - Verification:
    - Read-through against the data map and the deletion code; `git diff --check`.

- [ ] `WP96-S3` - Account and data deletion (backend)
  - Scope: `convex/account/**` (new), tests in `convex/account/*.test.ts` (existing vitest suite).
  - Acceptance criteria:
    - A signed-in founder can request deletion of their own account with a typed confirmation. The caller is derived server-side; no user id is accepted as an argument.
    - Every business they own is deleted with its documents, chat messages, approvals, memory, tasks, crew, files, sites and email data, plus their saved ideas, notes, collections, plans, preferences and wizard sessions, and their sign-in records.
    - `ai_usage` and `ai_budgets` rows are not changed, so meter totals do not change. `audit_events` rows stay with the metadata field removed. An audit event records the request and the completion.
    - The work runs in bounded batches that schedule their own continuation, and a repeated request does not start a second chain.
    - Deletion is refused, with a clear code, for a bound super admin, a platform-owner account and a member with a live paid subscription.
    - A user cannot delete, or start the deletion of, another user's account.
  - Verification:
    - `npx vitest run convex/account`
    - Tests: nothing personal left, meter totals unchanged, cross-user denied, batches continue, idempotent.

- [ ] `WP96-S4` - Deletion screen
  - Scope: `app/dashboard/settings/**` (the page plus a new client component in the same folder).
  - Acceptance criteria:
    - The settings page has a "Delete account" section that says what is deleted and what is kept, asks for a typed confirmation and has a disabled-until-valid button.
    - After the request, the member sees a plain status message, and is signed out when the work ends.
    - Passes the `a11y-check` skill (labels, focus, live region, contrast, 44px targets, keyboard only).
  - Verification:
    - `a11y-check` skill; browser check of the screen; `npm run typecheck`, `npm run lint`.

- [ ] `WP96-S5` - Verify and open the PR
  - Scope: progress log, PR description.
  - Acceptance criteria:
    - Branch rebased on `origin/main`, `convex/_generated` regenerated (not hand-merged).
    - `npm run typecheck`, `npm run lint`, `npm test`, `npm run build` green, or the failure reported with output.
    - Codex schema and index needs and owner questions written in the progress file and the PR.
  - Verification:
    - The four commands above.

## Out Of Scope

- Editing the live privacy policy or terms pages.
- Deleting from third-party processors (Beehiiv, Stripe, Resend, Anthropic). The data map and drafts say what stays there.
- Schema, index, cron or http changes (Codex-owned). They go in the progress file as Codex needs.
- Any deploy, merge or production run.
- A data export ("download my data").

## Notes

- Conflicting ruling: `docs/wp/RULINGS.md` 2026-08-05 (WP22 data lifecycle) says v1 has no destructive deletion and that physical deletion needs a later policy and a separately gated migration. This package is that later work, at the owner's direction. It ships as code that only runs when a founder asks; it deploys no migration and touches no existing data. The owner should ratify it with a ruling row (owner question Q1).
- Promote unknown product decisions to `docs/wp/RULINGS.md` through the owner.
