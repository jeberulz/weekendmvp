# WP46-E5 engine → editorial runbook

This bridge makes a **private candidate and its saved-revision checks**. It does not release, unpublish, or change the public site. Settings should show the Idea Engine and a non-empty check policy as connected, while Publishing readiness remains **Unavailable** until E6.

## Prepare a candidate

1. Run the live `/publish-idea` research and compile path on a new slug. A contract-v1 or fixture record cannot enter the live editorial workspace.
2. Fill the manifest tagging and run `npm run generate:idea-slugs`: compile added a manifest row, and `lib/idea-slugs.generated.ts` must list SLUG or `/build/SLUG` answers 404 and `npm test` fails. Then run `npm run audit:idea -- --slug=SLUG` and `npm run validate:idea-tags -- --slug=SLUG` (no stale slug-set warning), then open and verify every cited market statistic and competitor price plus at least two community quotes as the skill describes. The machine check does not establish source credibility on its own.
3. Run `npm run editorial:submit-engine -- --slug=SLUG`. This is local and read-only. Record the printed artifact hash, record hash and source/claim counts. An error means stop and correct the research or artifact; never bypass the audit by calling `editorial.service.importSubmission`.

## Submit to the private workspace

After the E5 Convex code is deployed to the intended environment and a fresh backup is verified, set `EDITORIAL_ENGINE_CONVEX_URL` and `EDITORIAL_ENGINE_ADMIN_KEY` in the operator environment. The admin key must not be in a committed file or command argument. Run:

```bash
npm run editorial:submit-engine -- --slug=SLUG --apply \
  --confirm-submission=ARTIFACT_HASH --target=EXACT_DEPLOYMENT_NAME \
  --backup=/absolute/path/to/verified-backup.zip
```

The script revalidates the exact local bytes, verifies the hash and target, and calls the private Node action. That action reruns the deep audit; the write transaction pins the normalized record with the new candidate. Repeating the same submission is idempotent. A slug already reserved by a separate legacy idea is a conflict; do not force-replace its public baseline. Resolve ownership in a separate migration plan.

## Review in the dashboard

1. Sign in as the bound editorial owner at `/admin/editorial`. Open the new queue item and decide whether to accept, request research or reject it. Import does not make this human decision.
2. Run **Checks** on the saved revision. The public Node action loads the pinned record, reruns the engine audit and source-freshness check, then writes results only if the saved artifact hash and policy version still match. The required `engine-artifact-audit` must pass. A changed number, citation, title or evidence-bound highlight fails; an edit made while checks run makes the commit stale.
3. Open the actual source pages, complete review items and resolve any warning with a reason. Approval requires a current passing check set and explicit human attestation. Save a later edit → run checks and review again.
4. Do not use **Prepare release** yet. E6 owns the release worker and public visibility gate; until then the backend refuses it and Settings says Publishing readiness **Unavailable**.

## Verification and recovery

- `npx vitest run lib/editorial/engine convex/editorial/ingest.test.ts tests/editorial` covers mapping, action authentication, ingestion, stale edits, deep-check failure and approval.
- `npx convex codegen --typecheck disable` checks the split between Node actions and edge mutations without changing deployed functions. `npx tsc --noEmit -p convex/tsconfig.json` checks the generated API.
- For a failed or partial operator run, keep the backup and printed hashes, inspect the private queue and audit log, then retry the exact submission. Do not delete or overwrite an existing idea to clear a conflict. Nothing in this bridge changes public content.
