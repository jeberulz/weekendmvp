# WP03 Progress - Publish 5 AEO/SEO Articles

Append-only progress log. Do not rely on chat history for project state.

## 2026-07-22 - Setup

- Branch/worktree: `cursor/publish-5-articles-aeo-seo-f2aa` (no worktree)
- Assignment: Publish 5 fresh articles with solid AEO/SEO
- File boundaries: `content/articles/*`, `articles/manifest.json`, `docs/wp/wp03-*`, `docs/PROJECT_STRATEGY.md`, OG under `public/image/og/article/`
- Required checks: MDX JSX safety awk; typecheck if touching TS (not expected); seed + og:generate
- Initial risks: prod Convex auth may be unavailable in cloud; OG API keys may be missing (non-blocking)

## 2026-07-22 - Topic selection

- Actions taken: Confirmed original publish-article queue fully published (31 articles). Chose 5 net-new high-intent topics from Exa research.
- Decisions made:
  1. Product Hunt solo launch 2026
  2. Find customers on Reddit
  3. Cursor vs Claude Code vs Lovable
  4. Add Stripe to weekend MVP
  5. Micro-SaaS SEO + AEO content engine
- Next: Write MDX + manifest, then seed/OG/PR

## 2026-07-22 - WP03-S1..S5 content

- Actions taken: Wrote 5 MDX articles + manifest entries + topics/research.md restore
- Decisions made: Net-new topics (queue exhausted); AEO skeleton (Quick Answer + FAQ + sourced stats)
- Checks run: MDX JSX awk (0 hazards); 3 CTAs each to /startup-ideas; meta 150-160
- Result: Content ready for seed/OG/PR
- Next: seed convex, og:generate, commit/push/PR

## 2026-07-22 - WP03-S6 seed/OG/push

- Actions taken: Pushed branch; og:generate failed (no RECRAFT/OPENAI keys) → og.status=failed; local+prod Convex articles seed succeeded (5 new slugs present in `articles:list --prod`)
- Checks run: MDX JSX awk; seed:convex --only articles; seed:convex --only articles --prod; convex run articles:list --prod
- Result: Content + prod index data ready; OG PNGs pending keys; page HTML needs Vercel deploy via PR merge
- Gotchas: Cloud env lacks image API keys; heroes 404 until `npm run og:generate` with keys
- Next: Open PR; note OG retry for human with keys
