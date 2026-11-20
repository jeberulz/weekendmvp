# WP94 progress

- Initially based on 3add0084, rebased onto origin/main at 6abe0755. Isolated branch `codex/crew-collaboration`.
- The review form and explicit founder chat requests create tracked revision tasks. The existing workpool owns dispatch, concurrency, retries and recovery. A queued revision waits for its eligible brief. The recovery sweep discovers legacy queued revisions on active workspaces.
- Chat supports explicit revisions for Iris, Elle and Theo. The founder's request is the authority. Model replies cannot submit an assignment. Team HQ, employee pages and chat share role availability, the latest task, approval status, changed fields and copy freshness.
- An explicit email follow-up stays attached to the brand task. The founder's approval creates Elle's assignment against that exact replacement kit. A rejected or superseded input earns an explained terminal outcome. Ask the lead to show the revised email to read the saved first email and open the full sequence.
- Paid revisions require an explicit spend decision, verified terms and a ledger debit in the same transaction as task creation. Revocation before execution closes the task and returns its debit. A failed paid attempt releases its approval before another decision. Legacy spend approvals without the workflow metadata do not dispatch automatically. A fresh review request can rebind an eligible pending legacy card.
- Review cards keep the existing draft review rules. External sending, posting, publishing and connector permissions are outside this work package. Internal specialist coordination in this release is the addressed, approval-driven brand-to-email handoff. Free-form specialist exchanges and additional worker capabilities remain separate.

## Local check

The real scheduler integration suite covers first attempts, duplicates, dependencies, recovery, no-op output, paid approval and revocation, and the brand-to-email handoff with a changed draft. An isolated anonymous Convex instance on 3410/3411 deployed the schema and functions in fixture mode. A local production build on port 3140 served a signed-in Team HQ page and the actual local queue processed a founder request through to the expected no-change outcome with the default fixture response. No provider call or production data was required.

The full test suite, typecheck, prompt-version check and production build passed. The newer baseline misidentified the wizard example click handler as a React Hook. The integration branch renames that handler without changing the interaction. Lint reported zero errors and 45 warnings. After the last compatibility adjustment, the affected launch, approval, change-round and chat tests passed again (118 tests). Next.js 16.4.1 reported its existing security warning during the successful local build.

## Staging acceptance

1. Deploy the additive Convex schema/functions before the frontend to an isolated workspace. Keep external effect switches disabled. Use one test business with Brand and Email drafts.
2. Approve the blueprint. Ask the lead, “Iris, change the brand voice to practical and direct and show me one revised email.” Verify the receipt and the same assignment on Team HQ. Close and reopen the browser while it runs.
3. Confirm the new Brand Kit differs visibly. Approve it and verify Elle receives the exact approved version and produces a new reviewable email draft. Ask the lead, “Show me the revised email.” Compare the result with the Email page.
4. Ask about Leo and confirm the lead reports the current capability and absence of active work. Verify downstream stale-copy indicators after a material voice change. Use a palette-only test to verify copy remains current.
5. Before production, land the Next.js security update and verify the existing workspace release gates, including a live-provider run of the same journey. See the [Next.js 16.4.5 security release](https://github.com/vercel/next.js/releases/tag/v16.4.5).
