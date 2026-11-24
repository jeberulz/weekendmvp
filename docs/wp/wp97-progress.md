# WP97 — Crew audit follow-up

WP94 shipped task-backed revisions and the approval-driven Iris-to-Elle handoff in PR #293. The 20 November 2026 production audit found a stale approval answer, a live handoff that produced no new email, repeated Social validation failures, and no way to receive a specialist's own answer through the lead. This package repairs those paths on branch `codex/crew-audit-fixes`.

| ID | Follow-up | Status | Acceptance |
| --- | --- | --- | --- |
| S1 | Approval answers and handoff guidance | Implemented | Chat reads the artifact's current approval decision, including version and expiry, and links to the matching page. Asking how delivery works does not start work. |
| S2 | Save the requested email and recover from failure | Implemented | Turn a sample request into a scoped rewrite, use the exact approved brand, reject unchanged reader-facing copy, keep the other emails, and let the founder retry the failed handoff. The original chat reply tracks the linked run and its recovery. |
| S3 | Social structured output and diagnosis | Implemented, provider gate open | Register a simpler prompt schema while keeping the old version available. Surface the last known failure separately from requirements for retry. Verify representative live generation. |
| S4 | Named specialist relay and one peer consultation | Implemented | Resolve participants against the business roster, run each specialist through the metered gateway, persist their attributed replies in chat, and resume a partly completed consultation on retry. |
| G1 | Post-deploy production acceptance | Open | Use the restricted workspace and a disposable business in Chrome. Verify approved and pending review answers, Iris's individual reply, Iris and Elle's consultation, the approval-gated rewrite and the resulting draft after refresh, and Theo's Social pack. Record worker results and prompt versions. |
| G2 | Beta breadth and account coverage | Open | Finish the existing L1 rollout gates. Repeat with an ordinary founder account, including scoped access, wait-for-approval states, required credits, retry and refund paths, and five representative live launches. |
| G3 | Frontend dependency release check | Open | Resolve the tracked Next.js dependency update and confirm the production build and frontend deploy use the expected commit. |
| F1 | Own-idea wizard preview specificity | Open | Compare the changed wizard preview on main with two distinct own ideas. Check that the preview describes the submitted idea rather than using generic customer and mechanism text. Verify that the live blueprint remains specific. |
| F2 | Provider diagnostics and rewrite repair | Open | If live Social fails, capture sanitized field paths and compare the failed format with the new schema. If live email still returns unchanged copy, evaluate one bounded automatic repair against cost and quality. Founder retry is available in this package. |
| F3 | Broader team delivery | Open | Define real deliverables and capability gates for Landing, Marketing, Engineering and Outbound. Add worker-initiated questions tied to blocked tasks, longer dependency chains, and a shared activity view that connects those tasks to drafts and decisions. |
| F4 | MCP and external work | Open | Specify connections, role and project scopes, capability-specific execution and result receipts. Verify founder approvals for sending, publishing, spending and other external effects before enabling live connectors. |

## How to test

- Ask the lead “Is the current brand kit already approved?” after deciding its review on the Brand kit page.
- Ask “Ask Iris: What is blocking the brand work?” and “Ask Iris to consult with Elle about whether the welcome email follows the brand voice.” The second question should produce two attributed answers. A name absent from the project should receive a roster explanation.
- Ask “Iris, change the brand voice to practical and neighbourly with short sentences, and show me one revised email.” Follow the request through Brand kit approval and Email review. Check that the welcome copy changed and the other three emails match the previous sequence.
- Open Social after a fixture failure and after a live run. Check the failure reason against retry eligibility and the actual state of the Brand kit.

## Rollout

Keep the restricted cohort and external effect switches in place for G1. The production Vercel build in `scripts/vercel-build.mjs` checks the target and deploys Convex to `first-squirrel-244` before building Next. Branch previews do not use that production route. The conversation field and chat task reference are additive. Existing chats need no data backfill. Keep the previous backend setup available for rollback, then record the live build and test results before expanding the cohort.

## Verification on 24 November 2026

- TypeScript, lint, prompt lock and production build passed. The existing Next.js build reported the dependency warning tracked by G3.
- The full test command passed (6,855 test executions). Fixture coverage exercises gateway calls, scope, duplicate runs, partial consultation retries, stale approval history, the pinned brand version, and the exact welcome email rewrite.
- Chrome on the local production build showed the roster refusal for an absent Brian, two attributed Iris and Elle fixture answers, and the current changes-requested Brand decision. The consultation and decision remained visible after refresh. No live model ran during these checks.
