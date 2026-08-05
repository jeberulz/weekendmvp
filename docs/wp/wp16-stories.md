# WP16 Stories - Bolt & Windsurf hub enrichment

Branch: `cursor/wp16-bolt-windsurf-enrichment`
Lane: Work Package
Registry: `docs/PROJECT_STRATEGY.md`
Definition of done: Bolt.new and Windsurf hubs have CTR-oriented titles/meta matching “project ideas / examples” queries, featured start-here rails with real idea slugs, and pass typecheck/build smoke.

## Stories

- [x] `WP16-S1` - CTR title/meta rewrites
  - Scope: `TOOL_PAGES` bolt + windsurf in `app/build-with/[tool]/page.tsx`
  - Acceptance criteria:
    - Bolt H1/title/meta lean into “Bolt.new project ideas / examples / things to build”
    - Windsurf H1/title/meta lean into “Windsurf project ideas / examples”
  - Verification: local or live `<title>` / meta description

- [x] `WP16-S2` - Featured rails + copy polish
  - Scope: same `TOOL_PAGES` map
  - Acceptance criteria:
    - Featured blocks on bolt and windsurf (hand-picked slugs from tagged ideas)
    - Getting-started / description lightly strengthened for weekend builders (no mass retag)
  - Verification: typecheck; featured sections resolve when Convex is up

## Out Of Scope

- New tool hubs
- Instagram / `/links`
- Sitemap indexing investigation
- Retagging ideas

## Notes

- Follows WP15 A–B pattern; bolt had more GSC impressions (~145/28d) than windsurf (~17).
