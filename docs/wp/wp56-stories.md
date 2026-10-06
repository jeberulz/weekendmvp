# WP56 Stories - One design language for the public site

Branch: `codex/wp56-public-design-unify` (worktree `.worktrees/wp56-public-design`)
Lane: Work Package
Registry: `docs/PROJECT_STRATEGY.md`
Plan: `docs/plans/2026-10-04-001-design-unify-public-pages-plan.md`
Approved visuals: https://claude.ai/artifact/KdLeitLCx9CJn7vYJ91Ziw (owner approved 2026-10-06; owner edit: score-bar fill is `home-orange` on public cards)
Definition of done: every dark public page renders on the research-desk palette. The idea detail page, homepage body, dashboard, starter kit, shipable and dare are visually unchanged. The SEO snapshot is unchanged apart from H1 tails. typecheck, lint, test and build pass. a11y-check has been run on the changed UI.

## Stories

- [x] `WP56-S0` - Safety net: SEO snapshot script plus baseline
  - Scope: `scripts/seo-snapshot.mjs`, `tests/seo-snapshot/`
  - Acceptance criteria:
    - For each URL the snapshot records: title, meta description, canonical, robots, JSON-LD blocks, the H1 text, and internal `/ideas/` link targets.
    - A diff mode fails on any change, except an H1 that keeps its old text as a prefix.
  - Verification: run against a local `next start` build before and after.
- [x] `WP56-S1` - Shared public kit (light)
  - Scope: `components/public/*` (new); `components/hubs/HubShell.tsx` rewritten light; `components/layout/SiteFooter.tsx` moves to warm ink; `components/layout/MarketingNav.tsx` defaults to the cream variant.
  - Acceptance criteria:
    - The shell, page header, ideas browser (Cards/Rows toggle, `?view=rows`, remembered per visitor), public idea card, idea row, ink band, ruled FAQ and keep-browsing links all exist.
    - Score bars use `home-orange`.
    - Nothing in `components/home/**` or `components/platform/**` changes.
  - Verification: typecheck; the homepage looks the same apart from the footer.
- [x] `WP56-S2` - Browse collections `/ideas/{collection}` (category, revenue, build time)
  - Scope: `app/ideas/[slug]/collection.tsx` only (the collection branch). The idea detail render path is untouched.
- [x] `WP56-S3` - `/build-with/*`, `/ideas-for/*`, `/solve/*` plus the remaining `components/hubs/*`
- [x] `WP56-S4` - `/startup-ideas` (explorer, chips, search, sort, gate)
- [x] `WP56-S5` - Wave 4 pages: articles (index and detail), newsletter (index and detail), about, john-iseghohi, privacy-policy, 404, login/signup/email-signin (AuthPageShell), links
- [x] `WP56-S6` - Cleanup
  - Flip `:root` and `body` to desk.
  - Delete dead dark utilities (`grid-lines`, beam, flashlight, gradient-border-button), the `IdeaCard` dark theme and the `hub-theme` rainbow, once nothing references them.
  - Docs.

## Out Of Scope

- Individual idea pages (`/ideas/{idea}`), `IdeaPageNav`, `IdeaFooter`, `components/ideas/**`, MDX content.
- Homepage sections (`components/home/**`): imports only.
- `/dashboard/**`, `/starter-kit`, `/shipable`, `/dare`.
- New copy that isn't already on a page. Exception: the approved H1 tails and short section headings.
- GSAP or scroll scenes on these pages.
- Collection count and curation issues (e.g. `build-in-weekend` ≈ the whole library).

## Notes

- Rulings are recorded in `docs/wp/RULINGS.md` (WP56 rows).
