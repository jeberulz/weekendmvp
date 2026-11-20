# WP68 follow-up — Platform owner access progress

## Scope frozen, 2026-11-20

- Based on `origin/main` `06349a0d` in `.worktrees/owner-unlimited-access`. The root checkout has unrelated work.
- The account is already verified, actively bound as super admin and on the production workspace allowlist. Admin status alone currently grants no commercial entitlement.
- Current restrictions include one business, three wizard starts daily, message and crew action allowances, Free AI ceilings, and two free revision rounds. The existing workspace credit display is fixture data.
- Approach: an explicit revocable grant on the existing user row, checked together with the active super-admin binding. Normal accounts and future tester accounts receive no grant automatically. Operator mutation arguments cannot set another user's privileges through a public endpoint.
- Owner activation requires the new backend to be deployed. The owner remains the merger and deployment operator under the lane brief.
