# WP105 · Owner dashboard

Implemented on `codex/admin-member-analytics`. Work Package lane.

- The admin index reads the existing account directory, linked sign-in providers and owner-scoped audit events. Its server reads require the existing super-admin binding. A shared navigation bar links Overview, Editorial, Pages, AI costs and Feedback.
- The overview shows seven-day signups and distinct members with measured visits. Counts are bounded at 501 inspected rows and a plus sign marks a lower bound. The directory pages through accounts in batches of 25.
- Measurement requires the account-linked analytics notice, a signed-in account and an allowlisted product page. The browser reports focused duration at 30-second intervals and on departure. Browser or network interruptions can lose a final interval. Dynamic URL segments, queries and fragments are excluded. Each member has one activity row with lifetime measured totals and the latest 20 visits. Account deletion drains it.
- Historical emails, provider links and the latest eight audit events use existing records. Page activity starts after rollout. There is no telemetry backfill.
- Updated the privacy notice, consent copy and account deletion data map. Production rollout requires the additive Convex backend before the frontend. No production deployment or live member read was performed.

## Verification

Focused Convex and UI tests cover member/anonymous denials, account linking display, pagination, stale and duplicate reports, deletion cleanup, safe route templates, focus transitions, consent, and server rendering of the directory with fixture data.

Typecheck and production build passed. ESLint finished with zero errors and 45 existing warnings. Local production smoke returned 404 for a signed-out request to /admin and 403 for a measurement request without consent. The directory render used synthetic data; an authenticated production browser session was not exercised.

The full test command stopped at the existing IdeaBrowser runtime guard in the newsletter skill files, which match the base branch. All 1,546 Convex tests passed with two workers. Ran the remaining platform and live suites separately. Two platform files hit timing-related failures under concurrent load; both passed in a serial retry with a longer timeout. The live suite passed.
