# WP62 Progress — Public idea SEO summary above EmailGate

Append-only progress log.

## 2026-10-08 — Implementation

- Lane: Work Package. Branch: `cursor/idea-public-seo-summary-f0a8` off `origin/main`.
- Owner request: restore crawlable public summary on `/ideas/[slug]` after PR #116 without cloaking or inventing copy; keep build prompts ungated; signed-in path unchanged.
- Added `lib/ideas/public-preview.ts` to build SEO title/meta, 120–250 word summary, section teasers and prompts from existing MDX/manifest fields.
- Anonymous idea page now renders `IdeaPublicSummary` above `EmailGate`, plus Article + BreadcrumbList JSON-LD from public fields only.
- Deep research body remains empty for anonymous `resolveIdea` / member-only editorial markdown.
- Checks recorded after verification in this session.

## 2026-10-08 — Local production smoke

- `npm run typecheck` pass; focused vitest (15) pass; `npm run lint` 0 errors / 34 existing warnings; `npm run build` pass.
- Local Convex anonymous agent on 3210 + Next production on 3189.
- Logged-out curl AFTER for four slugs: query-shaped titles ≤60, meta ≤160, research H2 teasers + prompts + one account H2, Article + BreadcrumbList present, HowTo absent, deep research markers absent. Summary areas 161–202 words.
- BEFORE captured from live www earlier in the session (title stubs, single account H2, no JSON-LD, ~48 main words).
