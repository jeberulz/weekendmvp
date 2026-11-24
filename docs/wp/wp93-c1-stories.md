# WP93 C1 — Owner spend alerts

Work Package, from the L1 beta readiness brief in PR #292.

- [x] When the alarm mutation first raises a free or paid threshold for a UTC day, atomically schedule one internal notification with the pool totals at the crossing. Cover today's thresholds, prior-day charges and repeated cron ticks.
- [x] Resolve the current bound owner's address when enqueueing. Audit a missing recipient. Send only pool, threshold, day, settled spend, in-flight reservations, budget and the admin link. Exercise the real Resend component against a mocked provider with founder email disabled.
- [x] Keep sender credentials, batches and retry policy isolated from tenant email. Allow at most two provider attempts. Check both eventual success and repeated failure without replaying the alarm or changing meter state.

Scope covers the Convex spend alarm, its notification path, the Resend mount and types, and their tests. The console and meter are outside C1.
