# WP15 Progress - Build-with growth push

## Status

Complete on `feat/wp15-build-with-growth`. Local smoke passed; www verification after merge/deploy.

## S1 — CTR title/meta

- Done: Cursor, Lovable, No-code, Replit H1/title/meta rewritten toward ranking queries
- Claude title left unchanged

## S2 — Featured + no-code MVP

- Done: Featured rails on cursor, lovable, replit, no-code (hand-picked slugs from manifest)
- Done: No-code MVP description / getting-started / 3 prompts
- Hub `description` / `gettingStarted` prefer `TOOL_PAGES` so MVP wording ships even when Convex rows lag
- Manifest `no-code` tool row updated to match

## S3 — Claude Code hub

- Done: `/build-with/claude-code` with Code-specific copy, featured, prompts
- Done: `ideasTool: "claude"` (no mass retag)
- Done: Soft cross-links Claude ↔ Claude Code
- Done: Sitemap, MegaNav, MobileNav, SiteFooter, IdeaFooter, TOOL_NAMES, TOOL_TILES

## Verification

- `npm run typecheck` — pass
- `npm run build` — pass (284 pages; build-with includes claude-code)
- Local `next start` smoke:
  - `/build-with/claude-code` → 200, title “Claude Code Projects…”
  - Lovable / no-code / replit / cursor titles match new CTR copy
  - Claude soft-link present; sitemap lists `/build-with/claude-code`
