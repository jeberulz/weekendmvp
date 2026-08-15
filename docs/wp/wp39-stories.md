# WP39 Stories - Starter Kit Feedback and Effectiveness Insights

Branch: `codex/wp39-starter-kit-feedback`
Lane: Work Package
Registry: `docs/PROJECT_STRATEGY.md`
Definition of done: Starter Kit visitors can submit structured, anonymous-by-default feedback; submissions are validated, deduplicated, and rate-limited without storing IP addresses; an operator-only bounded summary exposes effectiveness signals; the UI and privacy disclosure meet the repository's accessibility and data-handling rules.

## Stories

- [x] `WP39-S1` - Freeze and implement the feedback data contract
  - Scope: `convex/schema.ts`, `convex/convex.config.ts`, `convex/marketing/starterKitFeedback.ts`, `convex/marketing/starterKitFeedback.test.ts`, `.env.example`
  - Acceptance criteria:
    - A dedicated table stores progress stage, usefulness score, useful section, blocker, optional qualitative notes, and optional follow-up email/consent.
    - The raw browser identifier and client IP are never persisted; repeated feedback from one browser updates one response.
    - Only a correctly signed bridge call can write feedback, and rate-limit quota is committed separately so failed submissions cannot refund it.
    - An internal bounded summary returns counts, average usefulness, section/blocker distributions, and a bounded recent-response sample.
  - Verification:
    - `npm run test:convex -- convex/marketing/starterKitFeedback.test.ts`

- [x] `WP39-S2` - Ship the abuse-bounded feedback API
  - Scope: `app/api/starter-kit-feedback/_server.ts`, `app/api/starter-kit-feedback/route.ts`, `tests/security/wp39-starter-kit-feedback.test.mjs`
  - Acceptance criteria:
    - The route accepts same-origin JSON only, rejects oversized or unknown input, and fails closed when its bridge or Convex configuration is absent.
    - The route derives a non-persisted rate-limit key from trusted request headers, signs the normalized payload, and calls quota consumption before persistence.
    - A honeypot submission receives a generic success response without creating a record.
    - Public errors reveal only actionable validation, rate-limit, or availability states.
  - Verification:
    - `node --experimental-strip-types --test tests/security/wp39-starter-kit-feedback.test.mjs`

- [x] `WP39-S3` - Add an accessible Starter Kit feedback experience
  - Scope: `app/(marketing)/starter-kit/StarterKitFeedback.tsx`, `app/(marketing)/starter-kit/page.tsx`, `app/(marketing)/starter-kit/StarterKitShell.tsx`, `app/(marketing)/privacy-policy/page.tsx`, UI tests under `tests/`
  - Acceptance criteria:
    - The Starter Kit page asks for progress, usefulness, the most useful section, the main blocker, optional detail, and optional follow-up contact.
    - The form uses native labels/fieldsets, keyboard-operable controls, visible focus, inline validation, disabled pending state, and a polite live-region result.
    - Follow-up email is accepted only with explicit consent; the default submission remains anonymous.
    - Successful submissions are remembered in the browser and may be updated as the visitor progresses.
    - The privacy policy names feedback fields, purpose, optional contact handling, and the absence of stored IP addresses.
  - Verification:
    - `npm run typecheck`
    - `npm run lint`
    - `npm test`
    - `npm run build`
    - `git diff --check`

## Out Of Scope

- Public testimonials, case-study publication, or testimonial licensing.
- A new customer/community forum.
- Automated email follow-up or external sends.
- A public analytics dashboard or unauthenticated response-reading API.
- Production deployment or secret provisioning.

## Notes

- This package is additive and independent of the Build Platform production-activation path.
- `convex/schema.ts` remains a serialized one-writer seam; WP39 is its sole writer in this branch.
- Promote unknown product decisions to `docs/wp/RULINGS.md`.
