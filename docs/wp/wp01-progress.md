# WP01 Progress - Social Video Link Hub

Append-only progress log. Do not rely on chat history for project state.

## 2026-07-13 - Setup

- Branch/worktree: `feat/wp01-links-hub` in the primary checkout; no worktree needed.
- Assignment: Create `weekendmvp.app/links` as the link-in-bio destination for the daily video campaign.
- Lane: Work Package.
- File boundaries: `app/links/**`, `app/layout.tsx`, `app/sitemap.ts`, `docs/PROJECT_STRATEGY.md`, `docs/wp/wp01-stories.md`, and `docs/wp/wp01-progress.md`.
- Required checks: `npm run typecheck`, `npm run lint` if defined, `npm test` if defined, `npm run build`, and browser verification.
- Initial risks: campaign rows include both idea and article destinations; some entries do not have a dedicated OG image; the repository's configured lint and test commands may not exist in `package.json`.
- Existing worktree state: unrelated untracked content and planning files were present on `main` and are intentionally preserved untouched.
- Data decision: use the active Reel campaign CSV as the single source of truth so future calendar edits automatically update the page on the next deployment.
- UX decision: show the complete four-week campaign as a continuous, week-grouped archive so every destination remains one tap away without JavaScript.
- Next: implement `WP01-S1`.

## 2026-07-13 - WP01-S1

- Actions taken: added a cached server-side CSV reader, quote-aware row parser, week grouping, destination validation, UTM attribution, and filesystem-backed image fallback handling.
- Decisions made: preserve canonical `/ideas/*` and `/articles/*` paths; use the existing campaign slug for `utm_campaign`; use the global Weekend MVP OG card where a dedicated image is absent.
- Checks run: `npm run typecheck`; local HTTP sweep of all 28 campaign destinations.
- Result: pass. All 28 destinations returned HTTP 200.
- Gotchas: the campaign calendar is existing untracked workspace content and must be included when this branch is published.
- Next: implement `WP01-S2`.

## 2026-07-13 - WP01-S2

- Actions taken: added the `/links` Server Component, responsive card grid, existing portrait and OG imagery, route loading and empty states, canonical/social metadata, keyboard focus states, reduced-motion fallbacks, and a global favicon declaration.
- Design system: existing dark-first Weekend MVP Tailwind language with Geist, brand orange, a soft 16px radius system, no new dependency, and static tactile motion only.
- Checks run: browser snapshots and screenshots at 1440x1000 and 390x844; copy audit; console inspection.
- Result: pass. Desktop and mobile render correctly, card actions stay readable, acronym casing is correct, and `/links` reports zero browser console errors or warnings.
- Gotchas: the site-wide cookie banner covers the lower viewport until a visitor chooses a consent option; this is existing expected behavior.
- Next: complete `WP01-S3` and production gate.

## 2026-07-13 - WP01-S3

- Actions taken: added `/links` to the sitemap and ran a production-like browser handoff using `weekendmvp.localhost` so the idea gate would not use its documented localhost bypass.
- End-to-end evidence: `/links` loaded from the campaign CSV; the first Week 1 card retained its four UTM parameters; the destination title matched; the locked idea page rendered first-name and email fields plus the `Unlock Idea` button; browser console remained at zero errors and zero warnings.
- Checks run:
  - `npm run typecheck` - pass.
  - `npm run build` - pass; `/links` prerendered static with a one-hour revalidation window.
  - 28-destination HTTP sweep - pass, all returned 200.
  - `git diff --check` - pass.
  - `rg -n '[—–]' app/links` - pass with no matches.
  - `npm run lint` - unavailable because `package.json` has no `lint` script.
  - `npm test` - unavailable because `package.json` has no `test` script.
- Build note: Next.js reports one pre-existing filesystem-tracing warning from `app/startup-ideas/page.tsx` through `lib/mdx.tsx`; the `/links` route compiles and prerenders successfully.
- Docs: WP registry, stories, progress, metadata, and sitemap updated. No Convex, schema, auth, environment, or API documentation changes were needed.
- Result: WP01 definition of done met.
- Next: owner review, commit, and deployment.

## 2026-07-13 - WP01-S4 Reopened

- Owner feedback: the link-in-bio page should expose only the current day's campaign idea, not the complete campaign archive.
- Lane/branch: continuing WP01 on `feat/wp01-links-hub`; no worktree needed.
- File boundaries: `app/links/**`, `docs/PROJECT_STRATEGY.md`, `docs/wp/wp01-stories.md`, and `docs/wp/wp01-progress.md`.
- Scheduling decision: match the campaign CSV's ISO date against the current `Europe/London` calendar date. The route must defer date evaluation until request time so a production build cannot freeze the result.
- Expected transition: 13 July shows `ai-proposal-generator-consultants`; 14 July shows `quiet-creator-personal-branding` without a code change or deployment.
- Next: implement the date-scoped data path and focused single-card UI, then rerun gates.

## 2026-07-13 - WP01-S4 Complete

- Actions taken: replaced the week-grouped data response with an exact scheduled-date lookup, deferred the current-date calculation to request time with Next.js `connection()`, and focused the page and loading state on one daily card.
- Rollover behavior: the current date is calculated in `Europe/London`; that ISO date is an argument to the cached campaign lookup, so the first request after midnight uses a new cache key and selects the next row without a deployment.
- Visibility guardrail: past and future rows remain server-only and are not rendered into the `/links` response.
- Checks run:
  - `npm run typecheck` - pass.
  - `npm run build` - pass; `/links` is reported as partially prerendered with request-time dynamic content.
  - Local HTML inspection - pass; only `utm_content=ai-proposal-generator-consultants` is present for 13 July.
  - In-app browser verification - pass; today's heading and idea are visible, while `Quiet Creator` is absent.
- Build note: the same pre-existing filesystem-tracing warning from `app/startup-ideas/page.tsx` through `lib/mdx.tsx` remains; no `/links` build error or warning was introduced.
- React review: no client-side state, hydration, accessibility, serialization, or bundle-size issue found. The page remains a Server Component and uses the existing route loading boundary.
- Docs: registry, story acceptance criteria, timezone decision, and verification evidence updated. No Convex, auth, schema, API, dependency, or environment documentation changes were needed.
- Result: WP01 definition of done met with the owner-requested one-idea-per-day behavior.
