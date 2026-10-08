# WP60 Stories - Hero idea link as a conversion funnel

Branch: `codex/wp60-hero-idea-cta` (stacked on `codex/wp59-hero-tabs`)
Lane: Work Package (visible homepage behavior, signed-in wording, analytics, a link into the WP57 account gate)
Registry: `docs/PROJECT_STRATEGY.md`
Product decisions: `docs/wp/RULINGS.md` (2026-10-07 WP60 row)

Definition of done: the homepage hero build window has one link to `/ideas/{slug}`. A verified member lands on the full research. Anyone else lands on the teaser with the embedded create-account and log-in card and returns to the same idea after verification. The link is worded for the audience, reports its click with the audience, idea and tool, and works by keyboard and on a phone. No change is made to the gate, the auth flow or access rules. Focused tests, a browser check, typecheck, lint, full tests and production build pass. No production deploy is part of this package.

## Stories

- [x] `WP60-S1` - Record the ruling and the design
  - Scope: `docs/wp/RULINGS.md`, `docs/PROJECT_STRATEGY.md`, these stories and progress.
  - Acceptance criteria:
    - The ruling records that the idea page, not the hero, decides gate versus research, the wording for each audience, and that the hint decides wording only.
  - Verification:
    - `git diff --check`

- [x] `WP60-S2` - Wording and link target
  - Scope: `lib/home/hero-cta.ts`, `lib/use-session-hint.ts`, `tests/home/hero-cta.test.ts`.
  - Acceptance criteria:
    - Visitor: "Unlock the full research", with a note that prompt 1 is free and a free account unlocks the rest. Member: "Read the full research", with a note that points to the full page. The visitor copy makes no price, card or trial claim. The member copy does not ask them to sign up.
    - The href is `/ideas/{slug}` with the slug encoded and no query, because the gate returns to the clean path.
    - The audience comes from the readable session hint the nav already uses, read after hydration. The server markup is the visitor's. The hint never decides access.
  - Verification:
    - `npx vitest run tests/home/hero-cta.test.ts`

- [x] `WP60-S3` - The link in the build window, and its tracking
  - Scope: `components/home/client/HeroBuildWindow.tsx`, `tests/home/hero-window.test.tsx`.
  - Acceptance criteria:
    - One link sits under the prompt, after the Copy button in reading order. Its accessible name includes the idea title and starts with the visible label.
    - Clicking fires `cta_button_clicked` with `button_location: home-hero-idea`, `button_text`, `audience`, `idea_slug` and `tool` (the active tab).
    - The link is at least 44px tall on a phone, shows a focus outline, and causes no horizontal overflow at 390px or 1280px.
  - Verification:
    - `npx vitest run tests/home`
    - Browser check, see S4.

- [x] `WP60-S4` - Browser check as a visitor and as a member
  - Scope: a temporary harness route that rendered the real `Hero`, deleted after the check.
  - Acceptance criteria:
    - At 390px and 1280px, as a visitor and as a member: the label, note and href are right, the other audience's wording is absent, Tab from Copy reaches the link, the click requests `/ideas/{slug}` and fires one correctly shaped event, and there are no page errors.
  - Verification:
    - Results recorded in `docs/wp/wp60-progress.md`.

- [x] `WP60-S5` - Docs and full checks
  - Scope: `CLAUDE.md` (`lib/home/*` line), `docs/wp/wp60-progress.md`.
  - Acceptance criteria:
    - `npm run typecheck`, `npm run lint`, `npm test` and `npm run build` pass, each read from its own exit code.
  - Verification:
    - Results recorded in `docs/wp/wp60-progress.md`.

## Out Of Scope

- Any change to the gate, the auth card, the return-to-idea flow or access rules. WP57 owns them.
- An event for account creation on the gate. Today none fires, so the funnel is measurable to the gate page view and not past it. WP57-S6 names this tracking and it must avoid email PII.
- Audience-aware wording on "Idea of the week", whose "Read the research" link goes to the same page for everyone.
- Sharing the session hint hook with `NavAuthLinks`. A source-matching test pins the nav's file, so the nav keeps its own copy of the same read.
- Hint lifetime. The hint follows the Convex session cookie, which lasts for the browser session.
- Locking prompts 2 and 3 in the left card, and any change to the hero's headline buttons.

## Notes

- The end-to-end path through the real idea page (gate, create account, return to the research) needs a Convex backend and Beehiiv. It was not run here. The browser check stubs the idea page and verifies what the hero sends.
- Promote unknown product decisions to `docs/wp/RULINGS.md`.
