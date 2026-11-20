# WP68 follow-up — Platform owner access

Branch: `codex/owner-unlimited-access`. Work Package lane.

Owner direction, 2026-11-20: give the verified account `iseghohi.john@gmail.com` unlimited product access. A later tester account must retain normal plan restrictions.

- [ ] S1. Add an optional, operator-controlled owner access grant bound to the stored user ID and active super-admin binding. Grant and revoke are audited and idempotent. Legacy accounts default to ordinary access.
- [ ] S2. Apply the grant to commercial entitlements, business creation, workspace rate allowances, change rounds and credit debits. Keep usage and cost accounting, ownership checks, lifecycle checks and runtime feature switches.
- [ ] S3. Reflect owner access in the existing account and credit reads. Show an unlimited credit label for the owner.
- [ ] S4. Prove isolation, revocation, grant replay, multiple businesses, repeated changes and insufficient-credit behavior. Verify AI reservations still record and settle real costs.
- [ ] S5. Run typecheck, lint, tests, build, isolated Convex and independent review. Prepare the owner activation command after the owner merges and deploys.

AI budget behavior is awaiting the owner's answer about the existing $10 daily cap. No public activation of unfinished features or paid provider test is part of this code change.

Files include `convex/schema.ts`, `convex/platform/ownerAccess*`, entitlement/membership/ledger reads and gates, `convex/platform/limits.ts`, `convex/ai/metering.ts`, business/change-round gates, existing workspace credit display and focused tests. The business and change-round changes extend Claude-owned consumers solely to apply this explicit owner request.
