# WP68 follow-up — Platform owner access

Branch: `codex/owner-unlimited-access`. Work Package lane.

Owner direction, 2026-11-20: give the verified account `iseghohi.john@gmail.com` unlimited product access. A later tester account must retain normal plan restrictions.

- [x] S1. Add an optional, operator-controlled owner access grant bound to the stored user ID and active super-admin binding. Grant and revoke are audited and idempotent. Legacy accounts default to ordinary access.
- [x] S2. Apply the grant to commercial entitlements, business creation, workspace rate allowances, change rounds and credit debits. Keep usage and cost accounting, ownership checks, lifecycle checks and runtime feature switches.
- [x] S3. Reflect owner access in the existing account and credit reads. Show an unlimited credit label for the owner.
- [x] S4. Prove isolation, revocation, grant replay, multiple businesses, repeated changes and insufficient-credit behavior. Verify AI reservations still record and settle real costs.
- [ ] S5. Run typecheck, lint, tests, build, isolated Convex and independent review. Prepare the owner activation command after the owner merges and deploys.

The owner explicitly approved bypassing the $10 AI cap on this account and the "Owner · Unlimited" label. Uncapped owner usage uses separate counters and remains visible in the spend report. Provider kill switches and operational concurrency protection still apply.

Files include `convex/schema.ts`, `convex/platform/ownerAccess*`, entitlement/membership/ledger reads and gates, `convex/platform/limits.ts`, `convex/ai/metering.ts`, business/change-round gates, existing workspace credit display and focused tests. The business and change-round changes extend Claude-owned consumers solely to apply this explicit owner request.
