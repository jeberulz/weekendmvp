# WP63 Stories — Navigation consistency

Branch: `codex/wp63-navigation-consistency`
Lane: Work Package
Registry: `docs/PROJECT_STRATEGY.md`
Definition of done: All public site menus use the existing cream floating navigation; desktop and mobile share their discovery links; idea-reader offsets and member navigation still work; the anonymous account card appears in the mobile introduction while desktop retains its existing layout; configured checks and browser checks pass.

## Stories

- [x] WP63-S1 — Replace the old public idea menu
  - Scope: `components/ideas/IdeaPageNav.tsx`, `components/layout/IdeaNav.tsx`, `components/layout/MegaNav.tsx`, `components/ideas/IdeaSidebar.tsx`, `app/ideas/[slug]/layout.tsx`, existing member-chrome tests.
  - Acceptance criteria: Every anonymous idea detail uses the same cream MegaNav as marketing/public/auth pages, including its mobile drawer. Member PRIMARY_NAV and account controls remain. Reader scroll targets clear the floating header, including its top gap.
  - Verification: idea/member chrome tests and desktop/mobile browser smoke on the pictured music-royalty page and representative public route families.
- [x] WP63-S2 — Keep desktop/mobile discovery menus in sync
  - Scope: `components/layout/{MegaNav,MobileNav,site-navigation}.tsx` or `.ts`, navigation regression tests.
  - Acceptance criteria: Both menus derive category, revenue, time, tool and audience links from one definition; mobile gains the missing destinations. Current-page indicators, keyboard focus, Escape, outside dismissal and close after navigation work.
  - Verification: shared destination/route tests and browser keyboard/mobile interaction checks.
- [x] WP63-S3 — Verification and documentation
  - Scope: these WP docs, registry, `CLAUDE.md`, temporary local evidence under ignored `tmp/`.
  - Acceptance criteria: Route audit records the shell used by each route family and intentional workspace/editorial/preview/tenant differences. Typecheck, lint, full tests and production build results are recorded honestly.
- [x] WP63-S4 — Bring the anonymous account card into the mobile introduction
  - Scope: `components/ideas/{EmailGate,IdeaPublicSummary}.tsx`, anonymous composition in `app/ideas/[slug]/page.tsx`, existing account-gate test, WP docs/registry and navigation convention in `CLAUDE.md`.
  - Acceptance criteria: Mobile shows the existing account card immediately after the idea title and description, before long summary/research teasers/prompts. The card is visible in the initial viewport on representative phones. Desktop retains its existing title/summary column and sticky account rail. Exactly one account form is rendered, public copy remains server-rendered, and verified research access/return targets stay unchanged.
  - Verification: mobile initial-viewport, DOM/focus order and single-form checks; desktop geometry comparison; configured checks.

## Out of scope

- Idea content, account access rules and auth behavior, footer restyles, dashboard/editorial redesigns, preview/tenant chrome, production deployment and publishing activation. Account-card placement on mobile is included by the owner's follow-up.

## Audit baseline

- Marketing group: MarketingNav → cream MegaNav.
- `/startup-ideas`, `/articles` and detail, `/newsletter` and detail: PublicShell → cream MegaNav.
- `/ideas/{collection}`, `/ideas-for/*`, `/build-with/*`, `/solve/*`: PublicShell/HubShell → cream MegaNav.
- Global not-found: PublicShell → cream MegaNav.
- `/links`: purpose-built social campaign archive with a home-logo link and local category filters; it has no global site menu to migrate.
- `/login`, `/signup`: AuthPageShell → cream MegaNav; `/signin` redirects to `/login`. Email confirmation and auth callback are focused confirmation/error screens without a site menu.
- `/ideas/{idea}`: IdeaPageNav → legacy two-row IdeaNav anonymously, PRIMARY_NAV when the member hint exists. This is the old design in the screenshot.
- Desktop/mobile discovery data are separate: mobile omits Developer Tools, $5K/month, all time links, Replit, v0, All Tools and Weekend Builders.
- Dashboard and editorial have purpose-specific workspace navigation. Build, preview and tenant pages have artifact/tenant chrome rather than the public menu.
