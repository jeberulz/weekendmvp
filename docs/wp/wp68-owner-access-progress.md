# WP68 follow-up — Platform owner access progress

## Scope frozen, 2026-11-20

- Based on `origin/main` `06349a0d` in `.worktrees/owner-unlimited-access`. The root checkout has unrelated work.
- The account is already verified, actively bound as super admin and on the production workspace allowlist. Admin status alone currently grants no commercial entitlement.
- Current restrictions include one business, three wizard starts daily, message and crew action allowances, Free AI ceilings, and two free revision rounds. The existing workspace credit display is fixture data.
- Approach: an explicit revocable grant on the existing user row, checked together with the active super-admin binding. Normal accounts and future tester accounts receive no grant automatically. Operator mutation arguments cannot set another user's privileges through a public endpoint.
- Owner activation requires the new backend to be deployed. The owner remains the merger and deployment operator under the lane brief.

## Implementation and review follow-up

- The owner approved bypassing the global AI spending cap as well as the per-account allowances. The approved sidebar wording is "Owner · Unlimited". A static local rendering of the actual workspace components is available at `http://127.0.0.1:3196`; it previews display only.
- Added optional `users.platformOwnerAccess` and `ai_usage.ownerBudgetBypass`. The grant requires a verified, non-anonymous user and the existing active super-admin binding. The existing admin module remains the single reader/writer of the binding table. Account closure and binding revocation immediately disable the grant.
- Normal accounts retain their plan and upgrade gates. The owner receives the paid legacy entitlements plus every workspace commercial feature entitlement, unlimited business creation, message/wizard/crew allowances and zero-cost change rounds. Resource limits for publish/image/video operations, task concurrency, ownership and workspace/provider switches continue to apply. Unbuilt routes retain their existing implementation status.
- Owner AI cost is reserved, finalized and swept using separate `owner-free`/`owner-paid` counter keys. The persisted usage flag preserves the counter choice after grant revocation. `ops/spend:readDaily` reports the uncapped owner's totals separately and includes the real calls in model, prompt and owner breakdowns. Customer budget capacity is unaffected.
- A credit-funded owner task receives only the missing credits, at most that task's cost, under a keyed `owner_comp_grant`. Existing credit debt is preserved. Failed/cancelled-task refunds reverse this complimentary grant once using `owner_comp_reversal`, preserving real credit balances. Both ledger reasons are additive and historical entries remain valid.
- The first independent Opus review led to separate owner budget counters, explicit budget-scope exemptions, complimentary-credit reversal, shared admin-binding checks and a boolean for unlimited change rounds. The full evaluator source confirms its kill switches run before any allowance decision. The billing summary has no restrictive return validator; the new credits-summary field has a matching validator. Existing `comp` billing validation is reused. The exact debit replay check precedes complimentary funding.
- Independent Opus re-review found no blocking defect and judged dormant merge safe. Its activation checks are covered: five businesses are listed by the switcher query, workspace access returns `unlimited:true`, and the Next access loader returns that project object directly. `refundFailedTask` is the only production task-refund writer. Revocation after reserve and an owner grant without the budget exemption have dedicated tests. The real subscription billing summary is preserved when present, so the owner can still manage or cancel a subscription.
- Verification before PR: full local test chain passed (1,429 Convex tests and 2,902 platform tests), root and Convex typechecks passed, lint passed (0 errors, 45 existing warnings), production build passed, nine prompt versions matched, and native anonymous Convex on 3490/3491 accepted the schema and functions with typechecking enabled. The final switcher reachability assertions pass. No paid provider call or production override activation occurred.
- The final build initially stopped at a framework security-upgrade advisory prompt, then passed on retry. `npm audit --omit=dev` reports two existing moderate dependency findings, zero high and zero critical. Package and lockfile were not changed by this WP.
- Binding revocation stops the owner grant while it remains revoked. An operator rebind restores it unless `set enabled:false` has also revoked the commercial grant. All revocation paths should use the latter for durable withdrawal of owner access.
- Frozen-contract consumer handoff to Claude: workspace access adds optional `project.unlimited`; free-round decisions/previews add optional `unlimited`; credits-summary adds `unlimited`. The owner-account request authorizes the narrow wizard, review and shell consumer changes here. The legacy user profile writer copies an allowlist of profile fields and cannot set the grant.

## Activation after the owner merges and deploys

The implementation ships dormant. In a checkout containing this PR, target the exact live deployment:

```bash
env -u CONVEX_DEPLOY_KEY -u CONVEX_SELF_HOSTED_URL -u CONVEX_SELF_HOSTED_ADMIN_KEY \
  -u CONVEX_DEPLOYMENT -u CONVEX_AGENT_MODE \
  npx --no-install convex run --deployment first-squirrel-244 platform/ownerAccess:set \
  '{"email":"iseghohi.john@gmail.com","enabled":true,"bypassAiBudget":true}'
```

This operator action writes one grant and an audit event. It is a control-plane exception, like the existing super-admin ops controls, and can revoke access while the workspace is off. To revoke, use the same command with `enabled:false` and `bypassAiBudget:false`. After activation, refresh the signed-in workspace to load the owner label. Setting both global budgets to zero does not stop this owner's AI calls; use the AI kill switch.
