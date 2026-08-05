# WP15 Stories - Build-with growth push

Branch: `cursor/wp15-build-with-growth`
Lane: Work Package
Registry: `docs/PROJECT_STRATEGY.md`
Definition of done: Lovable/no-code/replit/cursor titles match high-impression queries; those hubs (plus no-code) have featured rails and no-code has MVP prompts; `/build-with/claude-code` is live, sitemapped, and linked from Claude + nav/footers.

## Stories

- [x] `WP15-S1` - CTR title/meta rewrites
  - Scope: `TOOL_PAGES` in `app/build-with/[tool]/page.tsx`
  - Acceptance criteria:
    - Lovable title targets “best Lovable projects / app ideas”
    - No-code H1/title/meta target “no-code MVP” queries
    - Replit/Cursor titles lean into “project examples / ideas”
    - Claude title unchanged (already converting)
  - Verification: live `<title>` / meta description on www after deploy

- [x] `WP15-S2` - Featured rails + no-code MVP copy
  - Scope: same `TOOL_PAGES` map
  - Acceptance criteria:
    - Featured blocks on lovable, cursor, replit, no-code
    - No-code description/getting-started rewritten for MVP builders
    - No-code has 2–3 starter prompts
  - Verification: typecheck; featured sections render when slugs resolve

- [x] `WP15-S3` - `/build-with/claude-code` hub
  - Scope: `TOOL_PAGES`, sitemap, MegaNav/MobileNav, SiteFooter/IdeaFooter
  - Acceptance criteria:
    - New hub 200 with Code-specific copy; grid reuses `claude` tool tag
    - Soft link from Claude hub to Claude Code
    - Sitemap + nav/footer include Claude Code
  - Verification: `/build-with/claude-code` 200; listed in sitemap.xml

## Out Of Scope

- Bolt/windsurf deep rewrites
- Mass retagging ideas to `claude-code`
- Instagram / `/links` funnel
