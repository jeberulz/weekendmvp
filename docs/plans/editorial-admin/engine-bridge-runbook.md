# WP46-E5 engine → editorial runbook

This bridge makes a **private candidate and its saved-revision checks**. It does not release, unpublish, or change the public site. E6 release code is deployed, but the live release switch remains off pending the E7 launch gate. Settings should show the Idea Engine and a non-empty check policy as connected; publishing readiness must reflect the live switch and reader configuration.

## Prepare a candidate

1. For a **new, unreleased** slug, keep the brief, live contract-v2 record, compiled MDX and generated manifest under an ignored, owner-readable directory such as `tmp/editorial-private/SLUG/`. Run `umask 077` before research and compile. Use `npm run engine:research -- --brief PATH --live --out PATH`, then `npm run engine:compile -- --record PATH --ideas-dir PATH --manifest PATH` with every path in that private directory. Never stage a new candidate in this public repository's `content/ideas/`, `ideas/manifest.json` or `engine/records/`.
2. Fill the generated **private** manifest row's `category`, `tools` and `audiences` from `lib/editorial/contracts/taxonomy.ts` (at least two distinct tools and audiences). The compiler intentionally leaves these as `uncategorized` and empty arrays; the submission command refuses that stub. Run the private dry run below. It reruns the deep audit and bounded editorial metadata validation on the exact files. Then open and verify every cited market statistic and competitor price plus at least two community quotes as `/publish-idea` requires. A machine check cannot establish source credibility on its own. A contract-v1 or fixture record is refused.

   ```bash
   npm run editorial:submit-engine -- --slug=SLUG \
     --record=tmp/editorial-private/SLUG/record.json \
     --mdx=tmp/editorial-private/SLUG/ideas/SLUG.mdx \
     --manifest=tmp/editorial-private/SLUG/manifest.json
   ```

3. Record the printed artifact hash, record hash and source/claim counts. The CLI accepts either a generated manifest containing exactly one matching row or that row as a JSON object. It refuses explicit private paths that resolve inside the tracked repository outside `tmp/`. Existing **already public** ideas can still use the original `--slug=SLUG` dry run; do not use that path for an unreleased candidate. On any error, stop and correct the research or artifact; never bypass the audit by calling `editorial.service.importSubmission`.

## Submit to the private workspace

After the E5 Convex code is deployed to the intended environment and a fresh backup is verified, set `EDITORIAL_ENGINE_CONVEX_URL` and `EDITORIAL_ENGINE_ADMIN_KEY` in the operator environment. The admin key must not be in a committed file or command argument. Run:

```bash
npm run editorial:submit-engine -- --slug=SLUG --apply \
  --record=tmp/editorial-private/SLUG/record.json \
  --mdx=tmp/editorial-private/SLUG/ideas/SLUG.mdx \
  --manifest=tmp/editorial-private/SLUG/manifest.json \
  --confirm-submission=ARTIFACT_HASH --target=EXACT_DEPLOYMENT_NAME \
  --backup=/absolute/path/to/verified-backup.zip
```

The script revalidates the exact local bytes, verifies the hash and target, and calls the private Node action. That action reruns the deep audit; the write transaction pins the normalized record with the new candidate. Repeating the same submission is idempotent. A slug already reserved by a separate legacy idea is a conflict; do not force-replace its public baseline. Resolve ownership in a separate migration plan.

## Review in the dashboard

1. Sign in as the bound editorial owner at `/admin/editorial`. Open the new queue item and decide whether to accept, request research or reject it. Import does not make this human decision.
2. Run **Checks** on the saved revision. The public Node action loads the pinned record, reruns the engine audit and source-freshness check, then writes results only if the saved artifact hash and policy version still match. The required `engine-artifact-audit` must pass. A changed number, citation, title or evidence-bound highlight fails; an edit made while checks run makes the commit stale.
3. Open the actual source pages, complete review items and resolve any warning with a reason. Approval requires a current passing check set and explicit human attestation. Save a later edit → run checks and review again.
4. Use **Prepare release** only in the isolated E7 staging target while exercising the release journey. Production release preparation, approval of a real page and switch activation remain behind the E7 launch gate in `docs/wp/wp46-e7-gate.md`.

## Verification and recovery

- `npx vitest run lib/editorial/engine convex/editorial/ingest.test.ts tests/editorial` covers mapping, action authentication, ingestion, stale edits, deep-check failure and approval.
- `npx convex codegen --typecheck disable` checks the split between Node actions and edge mutations without changing deployed functions. `npx tsc --noEmit -p convex/tsconfig.json` checks the generated API.
- For a failed or partial operator run, keep the backup and printed hashes, inspect the private queue and audit log, then retry the exact submission. Do not delete or overwrite an existing idea to clear a conflict. Nothing in this bridge changes public content.
