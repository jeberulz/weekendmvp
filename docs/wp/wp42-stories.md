# WP42 Stories - Ideas-first homepage

Branch: `claude/compassionate-fermi-eau6rv`
Lane: Work Package
Registry: Marketing homepage (`app/(marketing)/page.tsx`)
Definition of done: `/` renders the owner-approved ideas-first light homepage (10 sections, desktop and 390px mobile) from live idea data, with the weekly sections rotating on their own, and passes `npm run typecheck`, `npm run lint`, `npm test`, `npm run build` plus a WCAG 2.1 AA review.

Design source: the owner-approved "Weekend MVP Homepage Moodboard" design canvas (final picks, mobile page, build notes). Rulings for this WP are dated 2026-09-24 in `docs/wp/RULINGS.md`.

## Stories

- [x] `WP42-S1` - Record the homepage rulings and WP docs
  - Scope: `docs/wp/RULINGS.md`, `docs/wp/wp41-stories.md`, `docs/wp/wp41-progress.md`
  - Acceptance criteria:
    - Rulings cover positioning, section picks, the weekly rotation rule, the highlights block, the engine-draft ideas, and the founder photo
  - Verification:
    - `git diff --check`

- [x] `WP42-S2` - Homepage data layer from the idea library
  - Scope: `lib/home/*`, `tests/home/*`
  - Acceptance criteria:
    - Live count, category counts and tool counts come from `ideas/manifest.json` minus retired ideas
    - The Index shows the 8 newest live ideas; `N°` is each idea's place in publish order
    - The weekly pick changes every Monday 00:00 UTC; the pool is ideas with OG art, How it works, 3+ prompts, pricing, market numbers and 3+ sources
    - Section 06 uses a different idea from section 03 every week (half a rotation away)
    - Section 05 shows the three prompts of section 03's idea
    - Excerpts read a manifest `highlights` block first and fall back to the MDX parser; a tile with no data hides
  - Verification:
    - `npm run test:home`

- [x] `WP42-S3` - Highlights contract for idea publishing
  - Scope: `lib/home/highlights.ts`, `scripts/validate-idea-tags.mjs`, `.claude/skills/publish-idea/SKILL.md`
  - Acceptance criteria:
    - `highlights` is an optional manifest field; when present the validator checks its shape and lengths
    - `/publish-idea` writes a `highlights` block for every new idea
  - Verification:
    - `npm run validate:idea-tags`
    - `npm run test:home`

- [x] `WP42-S4` - Visual primitives and tokens
  - Scope: `components/home/primitives/*`, `app/globals.css`, `lib/fonts.ts`
  - Acceptance criteria:
    - Research-desk palette, Newsreader roman + italic, Geist, Geist Mono
    - Icon set, weekend meter, stamp, category tag and tool logos render as accessible SVG (decorative ones hidden from assistive tech)
  - Verification:
    - `npm run typecheck`

- [x] `WP42-S5` - Sections 01 to 05
  - Scope: `components/home/sections/*`
  - Acceptance criteria:
    - Hero (prompt to product), Idea library index, Idea of the week, Weekend test sticky wall, Build with AI (logo wall + this week's prompts)
    - Layouts match the design at 1440px and 390px
  - Verification:
    - Screenshots at 390px and 1440px

- [x] `WP42-S6` - Sections 06 to 10
  - Scope: `components/home/sections/*`
  - Acceptance criteria:
    - Inside every idea (weekly excerpts), Your weekend (photo + plan), Starter Kit ticket (Beehiiv form), Founder letter, Final call
    - The Starter Kit form reuses `BeehiivSubscribeForm`; kit CTAs reuse `SignupCta`
  - Verification:
    - Screenshots at 390px and 1440px

- [x] `WP42-S7` - Page assembly and verification
  - Scope: `app/(marketing)/page.tsx`, `components/layout/MarketingNav.tsx`, `next.config.ts`, retired homepage-only components
  - Acceptance criteria:
    - Cream nav on `/`; metadata and JSON-LD updated for the ideas-first message
    - Weekly data is cached for one hour; the idea files are traced into the `/` function
    - Primary content stays server-rendered
  - Verification:
    - `npm run typecheck`
    - `npm run lint`
    - `npm test`
    - `npm run build`
    - WCAG 2.1 AA review at 390px and 1440px

## Out Of Scope

- Backfilling `highlights` for already-published ideas (the parser covers them)
- Changing the OG generator to keep clean art (`--raw`) for new ideas
- Teaching the idea-engine compiler to emit `highlights`
- Renaming the `engine-draft-*` slugs
- Final founder-note copy (the letter ships as the draft until John rewrites it)
- Figma export of the design

## Notes

- Promote unknown product decisions to `docs/wp/RULINGS.md`.
- `.agentic-workflow.yml` prefers `codex/` branches; this session is pinned to `claude/compassionate-fermi-eau6rv`.
- PR #71 also edits `.claude/skills/publish-idea/SKILL.md`; keep the highlights edit to one new subsection so a merge stays simple.
