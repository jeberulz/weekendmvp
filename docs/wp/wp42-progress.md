# WP42 Progress - Ideas-first homepage

Append-only progress log. Do not rely on chat history for project state.

## 2026-09-24 - Setup

- Branch/worktree: `claude/compassionate-fermi-eau6rv` (no worktree), fast-forwarded to `main` at `f71518d` so the new Login / Sign up nav (#72, #74) is in place
- Assignment: rebuild `/` as the owner-approved ideas-first light homepage
- File boundaries: `app/(marketing)/page.tsx`, `components/home/**`, `lib/home/**`, `tests/home/**`, `components/layout/MarketingNav.tsx` (cream variant on `/`), `app/globals.css`, `lib/fonts.ts`, `next.config.ts` (file tracing only), `scripts/validate-idea-tags.mjs`, `.claude/skills/publish-idea/SKILL.md`, `package.json` (test script), WP42 docs, `docs/wp/RULINGS.md`
- Required checks: `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`, WCAG 2.1 AA review
- Initial risks:
  - The weekly excerpts read the idea MDX; quality varies until ideas carry `highlights`
  - Idea art has the logo and title baked in, so the homepage crops a band from the OG card
  - PR #71 edits the same skill file

## 2026-09-24 - S1 to S7 implemented

- Rulings: five WP42 rows appended to `docs/wp/RULINGS.md` (positioning and picks, live data, highlights, engine-draft ideas public, photo unblurred)
- WP number: `WP41` was already taken on `main` by #72 (login / signup), so this package is `WP42`; the WP41 docs were restored untouched
- Data layer (`lib/home/*`): manifest reader, counts, newest rows, weekly rotation (Monday 00:00 UTC, section 06 half a pool away from 03), MDX extractor, `highlights` override. Art readiness uses the manifest `og.status === "ready"`, which matches the PNGs on disk for all 226 live ideas, so the 327 MB of OG cards is never traced into the function
- Parity with the design prototype: pool 165 of 226; Sep 21–27 picks SlackToDoc (03/05) and Workflow Audit App (06); Sep 28–Oct 4 picks AlgoAlly and the music-teacher practice planner
- Highlights: `validate:idea-tags` checks the optional block (228/228 pass); `/publish-idea` Step 6b documents it
- `GOAL_LABEL` lives in `lib/home/labels.ts` so client components do not pull the category icon map into the browser bundle
- UI: `components/home/*` (icons, tool marks from @lobehub/icons-static-svg MIT, meter, stamp, tags, 10 sections, 3 small client islands: hero tabs + copy, index hover art, copy button). Cream nav on `/`. `BeehiivSubscribeForm` gained an optional `emailLabelClassName` (default unchanged: `sr-only`)
- Removed homepage-only code: `components/marketing/home-data.tsx`, `HomeBackground.tsx`, `BrandIcons.tsx`, `sections/HomeBento.tsx`

## 2026-09-24 - Verification

- `npm run typecheck` pass
- `npm run lint` 0 errors; 35 warnings, all pre-existing in `scripts/*.mjs`, none in changed files
- `npm test` pass, including the new `test:home` (19 tests)
- `npm run build` pass; `/` is static with `Revalidate 1h`, `Expire 1d`. The 5 Turbopack tracing warnings point at `lib/mdx.tsx:55` and `lib/sitemap-data.ts`, which this package does not change
- `next start` smoke: `/` 200, one `h1`, one `main`, new title, description with the live count, canonical, FAQPage JSON-LD, this week's picks in the HTML
- Screenshots at 1440px and 390px compared against the design canvas; mobile had a 22px overflow from grids without an explicit column count, fixed with `grid-cols-1`
- WCAG 2.1 AA: axe-core 4.12 (`wcag2a/aa`, `wcag21a/aa`) on `main` at 1440px and 390px: 0 violations. Contrast items axe could not decide (text over the photo, art and dotted backgrounds) were measured from rendered pixels against the lightest pixel behind each text box; the photo overlays were strengthened until every sample passed (weekend body text 8.7:1, eyebrow 5.9:1, art-band title 7.4:1, art-band meta 4.7:1)
- Keyboard: hero tool tabs follow the tabs pattern (arrows, Home/End, wrap), copy writes the full prompt and announces "Prompt copied", visible 2px focus rings

## Docs

- Updated: `docs/wp/RULINGS.md`, `.claude/skills/publish-idea/SKILL.md` (Step 6b), `CLAUDE.md` (key paths), WP42 stories/progress
- Footer: the owner asked to keep the production footer as the last section. The homepage already renders the shared `SiteFooter` through the `(marketing)` layout, unchanged; the design canvas now shows it as section 11 (desktop and mobile)
- Open for the owner: the founder letter is draft copy for John to rewrite
