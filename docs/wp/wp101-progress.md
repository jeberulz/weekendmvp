# WP101 progress

- Work package `codex/leo-private-landing` starts from the merged WP97 fix and the live pass on 24 November 2026.
- Scope is a private founder review and synthetic waitlist. The work uses the existing landing renderer, draft site versions and crew queue.
- Related production gate closed after [PR #322](https://github.com/jeberulz/weekendmvp/pull/322) deployed. The exact test CTA was “Reply with your sun hours.” Both new specialist calls settled at 13:08 GMT and their answers survived refresh.
- The design and research approach uses the [private landing design brief](../plans/launch-workspace/briefs/private-landing-design.md) and three repo-owned skills. New public research and image-generation integrations remain separate from the existing vetted seed path.

## Completed

- S1. The explicit founder request binds the approved blueprint and Brand Kit. The existing metered queue records Iris’s answer before Leo drafts. Retries reuse the answer for the same inputs and revised inputs get a new handoff.
- S2. The finish transaction stores the private version and a review for its exact document. Test data and receipts are scoped to the latest private version. Signup counts are kept on the site record to preserve append-only version content.
- S3. Chrome on local HydroTrail verified the Brand Kit prerequisite, the recorded handoff on Landing page and Team HQ, a rendered draft, a rejected non-test address, one accepted test entry after reload, and an approval that stayed private. The fixture originally had a failed Brand Kit revision, so its saved kit was given a fresh local review and approved in Chrome. A request without an owner session returned 404. At 320 and 360 CSS pixels, Chrome reported no horizontal overflow and loaded the approved Bricolage Grotesque and Figtree pairing.
- S4. The three skills are in `skills/`. The separate Balcony Relay design study demonstrates original photography for a specific campaign. Its image is a concept asset.
- S5. App and Convex typechecks, full tests, lint, production build, server trace checks, prompt versions, idea tags, and local Convex module deployment passed. The dependency audit reported two existing moderate advisories and zero high or critical findings. Next’s initial build advisory stopped the command, and the unchanged retry completed.

## Pending

- Run a live Iris-to-Leo provider smoke on a disposable business after the production backend and frontend are rolled out. Verify both metered prompt calls, review state, the real brand match and a persisted test signup.
- Review the founder-facing design study and choose any additional layout or media work. Hosted Leo uses approved art direction and vetted research when present. Live reference collection and the generated-asset job are future integrations tracked in the design brief.
- Public publishing and real waitlist opt-in belong to the subsequent release scope.
