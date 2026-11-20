# WP93 C2 — Expiring founder AI caps

Work Package on `codex/beta-cap-override`. The beta brief in `codex-needs-beta.md` and the WP93 registry entry in `docs/PROJECT_STRATEGY.md` cover this follow-up.

- [x] C2.1 Store the founder's temporary cap, expiry, issuing account, issue time and reason on the existing `ai_budgets` row. Existing rows keep their plan defaults.
- [x] C2.2 Have `reserve` use the cap only for that founder, until expiry or UTC rollover. In-flight reservations count. Free lifetime, global pool, kill-switch and platform-owner bypass rules keep their existing behavior.
- [x] C2.3 Exercise the reservation entry point with Convex fixtures and run the standard gates. Record evidence in `wp93-c2-progress.md`.

Files in scope include the AI schema, budget and reservation helpers, metering tests and the C2 handoff. The console's audited setter and form belong to the Claude follow-up.
