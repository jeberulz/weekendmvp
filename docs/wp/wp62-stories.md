# WP62 Stories - Idea of the week link worded for the audience

Branch: `codex/wp62-idea-of-week-link` (from `main` at `05ae555`)
Lane: Work Package (visible homepage wording and analytics)
Registry: `docs/PROJECT_STRATEGY.md`
Product decisions: `docs/wp/RULINGS.md` (2026-10-07 WP62 row)

Definition of done: the "Idea of the week" button goes to `/ideas/{slug}`, is worded for a visitor or a member like the hero link, and reports its click with the audience and idea. The section stays server-rendered except for the button. No change to the gate, auth or access. Focused tests, typecheck, lint, full tests and build pass.

## Stories

- [x] `WP62-S1` - Ruling, registry, stories, progress
  - Verification: `git diff --check`
- [x] `WP62-S2` - Client link with audience wording and tracking
  - Scope: `components/home/client/IdeaOfTheWeekLink.tsx`, `components/home/sections/IdeaOfTheWeek.tsx`, `lib/home/hero-cta.ts`, `tests/home/idea-of-week-link.test.tsx`.
  - Acceptance criteria:
    - Server markup is the visitor's wording, with the idea title as screen-reader text. No price, card or trial claim.
    - The href is `/ideas/{slug}` with no query.
    - Click fires `cta_button_clicked` from `home-idea-of-the-week` with `button_text`, `audience` and `idea_slug`.
  - Verification: `npx vitest run tests/home`
