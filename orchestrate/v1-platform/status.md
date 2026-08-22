# Orchestrate status

Generated: 2026-08-14T06:27:00.000Z

## Units

States: done=6, in-flight=0, pending=4

| ID | Track | State | Branch | PR | SHA | Brief |
| --- | --- | --- | --- | --- | --- | --- |
| U-backup-wp26 | land | done | codex/wp26-v1.1-engine |  | c99351bb74f720d16863c07b0c142746b61ee5ad | briefs/U-backup-wp26.md |
| U-land-stacker | land | done | feat/platform-wp19-28-onto-main | 56 | 1386262af39454125c59ef444ce7de976a4c9b18 | briefs/U-land-stacker.md |
| U-wp29-min | product | done | feat/wp29-min | 58 | 7d212b88f151e39e2114acd4061763fcb0bb59a8 | briefs/U-wp29-min.md |
| U-wp30-min | product | pending |  |  |  |  |
| U-wp38-min | product | pending |  |  |  |  |
| U-retention-cron | product | pending |  |  |  |  |
| U-e2e-verify | verify | done | origin/main |  | 80d6f27fa6bfee1bd9150e07a11fba699e8d8377 | briefs/U-e2e-verify.md |
| U-land-verify | land | done | feat/platform-wp19-28-onto-main | 56 | 1386262af39454125c59ef444ce7de976a4c9b18 | briefs/U-land-verify.md |
| U-e2e-reverify | verify | pending |  |  |  | briefs/U-e2e-verify.md |
| U-wp29-verify | verify | done | origin/main | 58 | b9db0d0ce562d59d34cb3c609493c459e33fdd2c | briefs/U-wp29-verify.md |

## Verification ledger

Verdicts: unit-test-verified=2, verifier-blocked=1

| PR | SHA | Verdict | Evidence | Verifier | Timestamp |
| --- | --- | --- | --- | --- | --- |
| 56 | 1386262af39454125c59ef444ce7de976a4c9b18 | unit-test-verified | reports/U-land-verify.md | 84041a88-4308-463a-9876-5c98794b1855 | 2026-08-14T02:32:06.747Z |
| 56 | 80d6f27fa6bfee1bd9150e07a11fba699e8d8377 | verifier-blocked | reports/U-e2e-verify.md | 38c2ac97-2d52-4eb3-887c-1978dbf3f373 | 2026-08-14T02:48:09.591Z |
| 58 | b9db0d0ce562d59d34cb3c609493c459e33fdd2c | unit-test-verified | reports/U-wp29-verify.md | 5ab43686-c455-4fab-816f-95d24dfcebfa | 2026-08-14T06:27:00.000Z |

## Frontier

Generation: 3
Lowest unmerged: none

| Branch | PR | SHA | State |
| --- | --- | --- | --- |
| feat/platform-wp19-28-onto-main | 56 | 80d6f27 | MERGED |
| feat/wp29-min | 58 | b9db0d0 | MERGED |

## Gates

| ID | Status | Question | Options | Default | Answer |
| --- | --- | --- | --- | --- | --- |
| preview-bridge-prod | open | Set PLATFORM_PREVIEW_BRIDGE_SECRET (>=32 chars) and PLATFORM_PREVIEW_APP_ORIGIN=https://www.weekendmvp.app on Vercel Production, then redeploy 80d6f27? Local .env.local already has a 64-char bridge secret. This unblocks anonymous preview generation. Not WP31 DNS/Stripe. | set-and-redeploy,wait | wait |  |
| convex-auth-prod | open | Set Convex production AUTH_RESEND_KEY, SITE_URL=https://www.weekendmvp.app, and AUTH_RESEND_FROM so magic-link works? Local has AUTH_RESEND_KEY only. FROM and SITE_URL are absent locally. Needed for claim/signup after preview works. Read logs for request 404203ed681625d4 first if you want the exact missing var. | set-convex-auth,wait | wait |  |

<!-- orch-summary {"unitStates":{"done":6,"in-flight":0,"pending":4},"ledgerVerdicts":{"unit-test-verified":2,"verifier-blocked":1},"frontierGeneration":3,"openGateIds":["convex-auth-prod","preview-bridge-prod"]} -->
