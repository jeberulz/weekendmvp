# WP62 Progress — Public idea SEO summary above EmailGate

Append-only progress log.

## 2026-10-08 — Implementation

- Lane: Work Package. Branch: `cursor/idea-public-seo-summary-f0a8` off `origin/main`.
- Owner request: restore crawlable public summary on `/ideas/[slug]` after PR #116 without cloaking or inventing copy; keep build prompts ungated; signed-in path unchanged.
- Added `lib/ideas/public-preview.ts` to build SEO title/meta, 120–250 word summary, section teasers and prompts from existing MDX/manifest fields.
- Anonymous idea page now renders `IdeaPublicSummary` above `EmailGate`, plus Article + BreadcrumbList JSON-LD from public fields only.
- Deep research body remains empty for anonymous `resolveIdea` / member-only editorial markdown.
- Checks recorded after verification in this session.
