# WP60 Progress - Hero idea link as a conversion funnel

Append-only progress log. Do not rely on chat history for project state.

## 2026-10-07 - Setup

- Branch/worktree: `codex/wp60-hero-idea-cta`, cut from `codex/wp59-hero-tabs` at `c968130`. No worktree. Stacked because it edits the same hero window file and appends to the same docs. Open its PR against the WP59 branch, or after WP59 merges.
- Assignment: single agent, mid tier. Lane: Work Package. It links into the WP57 account gate and words itself by signed-in state, so the gate and auth code were read first and left unchanged.
- File boundaries: `lib/home/hero-cta.ts`, `lib/use-session-hint.ts`, `components/home/client/HeroBuildWindow.tsx`, `tests/home/*`, docs. Not touched: `components/ideas/EmailGate.tsx`, `components/auth/*`, `app/ideas/[slug]/*`, `middleware.ts`, `components/layout/NavAuthLinks.tsx`.
- Required checks: `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`.
- Initial risks: sending the wrong audience to the wrong page, a flash of visitor wording for members, and a funnel nobody can measure.

What was found before designing:
- The gate is the idea page. `app/ideas/[slug]/page.tsx` resolves the member session on the server. With none, it renders `EmailGate`, the public teaser plus the embedded `AuthCard` in create-account mode with `returnTo=/ideas/{slug}`. The card switches to log-in in place. With a verified session it renders the full research.
- So a single link to `/ideas/{slug}` already sends a member to the research and anyone else to the gate. Routing by audience in the hero would duplicate that decision and could disagree with it.
- The marketing nav already reads a hint cookie (`wmvp_signed_in`) after hydration to tell signed-in visitors. The hint follows the Convex session cookie, which is a browser-session cookie.
- `/ideas/{slug}` links already exist on the homepage ("Read the research" in Idea of the week), all with no query.

## 2026-10-07 - WP60-S1 to S4

- Actions taken:
  - Added `lib/home/hero-cta.ts` (wording per audience, the href, the event location) and `lib/use-session-hint.ts` (the nav's read, as a hook).
  - `HeroBuildWindow` gets a footer under the prompt: a one-line note and one link. Tracking uses the existing `cta_button_clicked` event with extra fields.
  - Added `tests/home/hero-cta.test.ts` and four window tests. Recorded the ruling, the registry row and the `CLAUDE.md` note.
- Decisions made:
  - One destination for everyone. The hero words the link and does not route.
  - The link sits after the prompt, as the step after Copy. It lives in the right column and costs desktop about three visible code rows, which are faded anyway. Moving it into the left card would hide it from phones, where the prompt list is hidden.
  - "Prompt 1 is free" is true for the hero, and the gate teaser says the account unlocks "the complete research, build plan and prompts". The note says "the other prompts", because the hero shows prompt titles for at most three.
  - No query on the URL. The gate returns to the clean path, and the page's own `?from=` has its own meaning.
  - No `prefetch` change, matching the "Read the research" link in Idea of the week.
  - The nav's own copy of the hint read was left alone. A source-matching test pins that file.
- Checks run:
  - `npx vitest run tests/home`: 12 files, 76 tests, pass.
  - Mutation checks: pointing the link at `/startup-ideas` fails two window tests, an unencoded slug fails the path test, and a price in the visitor copy fails the copy test. The price check first passed by mistake. I had written its regex with a doubled backslash, so it could never match. Fixed the regex, re-ran the mutation, and it now fails as it should.
  - Contrast: note text `#cfc6b6` on `#1a1814` is 10.47:1, and the button text on `#f08a3e` is 7.10:1.
  - Real browser (Chromium, Playwright) against a temporary harness route that rendered the real `Hero` with real data. The route was deleted afterwards. 48 of 48 checks pass, at 390px and 1280px, as a visitor and as a member:
    - the link exists, its accessible name carries the idea title, and its href is `/ideas/adventure-date-night-app`
    - the note and label match the audience, and the other audience's wording is absent
    - the link is 44px tall on a phone and 48px on desktop, and is inside the viewport width
    - Tab from Copy lands on the link, and the focus outline is solid 2px
    - no horizontal overflow
    - one click fires one `cta_button_clicked` with `home-hero-idea`, the label, the audience, the idea slug and the active tab (Lovable in the test)
    - the browser requests `/ideas/adventure-date-night-app` and nothing else, and there are no page errors
  - Screenshots checked by eye at 390px (visitor) and 1280px (visitor).
- Gotchas:
  - The dev middleware clears the hint cookie when no real session cookie sits behind it. A fake hint set before load never reached React, so the first member run failed. Playwright's `route.fetch()` also applies a response's `Set-Cookie` to the browser's jar itself, so stripping the header from the fulfilled response did nothing. Setting the hint in an init script, which runs before hydration, gave the state a real member's browser is in.
  - Next 16 dev needs `localhost`, not `127.0.0.1`, and a `Suspense` around `searchParams` (both learned in WP59).
  - The stale `.next/dev` types from a dev run break `typecheck` and `build` after the harness is deleted. Removed again this time before running them.
- Limits:
  - The end-to-end path through the real idea page (gate, create account, return to the research) was not run. It needs a Convex backend and Beehiiv. The check verified what the hero sends and stubbed the page it lands on.
  - Account creation on the gate fires no analytics event, so the funnel is measurable from the hero click to the gate page view and no further. WP57-S6 names this tracking and it must avoid email PII.
  - The `a11y-check` skill named in `CLAUDE.md` is not installed in this session. Checked by hand: contrast, keyboard order and focus outline in a real browser, an accessible name that starts with its visible label, target size and overflow.
- Next: record the full check results.

## 2026-10-07 - WP60-S5

- Checks on the code in `0fbdf1f`, each read from its own exit line:
  - `npm run typecheck`: exit 0.
  - `npm run lint`: exit 0.
  - `npm test`: exit 0. No failures in any group, including `tests/home` (12 files, 76 tests).
  - `npm run build`: exit 0. No reference to the deleted harness route.
- The `.next/dev` types from the harness run were removed before these checks, so the stale-types failure from WP59 did not recur.
- Result: all required checks pass. No PR is open.
- Next: owner review.
