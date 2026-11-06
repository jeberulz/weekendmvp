# WP78 Progress — Publishing un-park

Append-only progress log. Claims must cite checks or code evidence.

## 2026-11-06 — Setup

- Branch/worktree: `codex/wp78-publishing` / `.worktrees/wp78-publishing`, from `origin/main` `d8055b98` after G1 passed.
- Assignment: WP78-S1–S5 per `04-build-plan.md` and owner rulings D2/D5.
- File boundaries: in `wp78-stories.md`; WP79 owns shared cron/http/env files for this phase.
- Required checks: typecheck, lint, test, build, targeted security tests, independent Claude review, `git diff --check`.
- Initial risks: C-APPROVAL and Claude policy prompt are not on main yet; wildcard DNS and Global Config provider setup need owner action; real leads remain synthetic-only until D5 controls ship together; no live activation or production deployment authorized.
- Needs from other lane: WP77 must merge C-APPROVAL fixture/contract and WP75 or gateway owner must merge policy prompt contract before WP78-S1 can enable publish. Claude reviews publishing and takedown before merge.

## 2026-11-06 — WP78-S2 implementation (verification in progress)

- Actions taken: installed `@vercel/global-config`; added per-slug Global Config deny reads before Convex tenant routing; added an authenticated super-admin action with internal prepare/commit, external deny upsert and consistent readback; added takedown refusal in site resolver, lead capture and publish core. Legacy public publish/rollback now fail closed with `PUBLISH_APPROVAL_REQUIRED`; unpublish is feature gated. Existing publish/rollback core is internal for WP78-S1's future approval path.
- Checks run: isolated anonymous Convex 3370/3371 codegen/deploy passed; focused publish/takedown/middleware tests 36/36 passed before the final seed and host-validation refinements. Re-run plus full checks pending.
- Result: takedown is safe in code but no live Global Config propagation evidence exists. Founder publishing remains unavailable until WP78-S1 consumes merged C-APPROVAL and policy contracts. This branch must not be merged as a claim of complete WP78 publishing.
- Gotchas: Global Config has a ready sentinel and denies all tenant traffic if absent/unreadable. Vercel's installed SDK types specify `undefined` for a missing key; the unit test verifies the clear path only after ready. The SDK's one-week `staleIfError` default is explicitly disabled. Two-phase takedown may leave a safe extra deny entry if Convex commit fails; retry is idempotent. The consistent readback is not a global propagation proof.
- Needs from WP79: optional env declarations/documentation for `TENANT_GLOBAL_CONFIG`, `TENANT_GLOBAL_CONFIG_ID`, `TENANT_GLOBAL_CONFIG_WRITE_TOKEN`, `TENANT_GLOBAL_CONFIG_TEAM_ID` in `convex/convex.config.ts` and `.env.example`; tracked on stacked draft PR #198. Retention cron entry remains WP79-owned.
- Verification update: pre-write authorization now runs in an internal mutation with session-expiry enforcement; an expired admin session test proves zero Global Config writes. Focused publish/takedown/middleware tests 38/38 and redirect tests 90/90 passed; lint passed with zero errors and 37 existing warnings; isolated local Convex deploy/codegen on 3370/3371 passed; build passed. Full `npm test` stopped in `test:security` solely because `env-documentation.test.mjs` requires the four optional Global Config keys in `.env.example`, which WP79 owns and has prepared in #198. Full-suite rerun is owed after #198 merges. No live Global Config call or propagation test was run.

## 2026-11-06 — WP78-S3 runbook draft

- Actions taken: wrote `wp78-activation-runbook.md` with current Vercel nameserver and wildcard certificate requirements, Global Config initialization/recovery, a test-slug host matrix and DNS-first rollback.
- Result: documentation drafted; live DNS/certificate/test deployment verification remain owner-executed and open. The historical WP28 CNAME/delegation directions are superseded for this activation.

## Cross-lane requests for WP78-S4

- Claude tenant renderer (`app/site/**`): display a versioned privacy notice directly under every real waitlist form, naming the founder as controller and Weekend MVP as processor. Pass the notice text/version with the form submission; expose real capture only when WP78's full D5 backend gate is ready. No WP78 edit to Claude-owned renderer.
- WP79 opt-in hook: after WP78 `recordReal` inserts a lead, schedule internal `requestOptInForLead({ leadId })`. WP79 rechecks the real, undeleted lead and owner/project/site chain, stores only a purpose-bound token digest, and queues confirmation with stable `optin:{leadId}` idempotency key. Enrollment begins only after token consumption. Real capture remains disabled until the hook, renderer notice, retention, export and per-contact delete all land together.
