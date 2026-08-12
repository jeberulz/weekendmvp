# WP19 Stories - Publish 10 top-quality articles

Branch: `cursor/publish-10-articles-625a`
Lane: Work Package
Registry: `docs/PROJECT_STRATEGY.md`
Definition of done: Ten net-new articles in MDX + manifest, Convex-seeded (dev + prod), OG cards generated (non-blocking), research queue updated, PR open with typecheck green.

## Stories

- [ ] `WP19-S1` - Research and queue 10 net-new article topics
  - Scope: `.claude/skills/publish-article/topics/research.md`, keyword/gap check vs existing `articles/manifest.json`
  - Acceptance criteria:
    - Ten topics not overlapping existing slugs/titles
    - Each topic has primary keyword, framework, and sources
  - Verification:
    - Diff against existing 51 article slugs shows zero collisions

- [ ] `WP19-S2` - Write 10 MDX articles + append manifest entries
  - Scope: `content/articles/*.mdx`, `articles/manifest.json`
  - Acceptance criteria:
    - Rich frontmatter (non-empty description, heroAlt)
    - Framework-faithful bodies with 3+ CTAs to `/startup-ideas`
    - No bare `<`/`{` outside fences
    - Manifest entries with og.subject + accent + status pending
  - Verification:
    - `awk` bare-jsx scan clean; typecheck; spot-check one route in dev if possible

- [ ] `WP19-S3` - Seed Convex + generate OG cards + mark queue published
  - Scope: Convex seed scripts, `image/og/article/*.png`, research.md status
  - Acceptance criteria:
    - Dev + prod article seeds succeed (or honest failure report)
    - `og:generate --non-blocking` for all 10 slugs
    - Topics marked PUBLISHED in research.md
  - Verification:
    - Seed CLI output shows inserted/updated for each slug; og.status ready|failed

## Out Of Scope

- New programmatic hubs
- Idea MDX publishing
- Redesigning article chrome/layout

## Notes

- Original skill queue (14 topics) already published; this WP authors a new research batch.
- Cloud agent: PR to main (not direct main push); Vercel deploy follows merge.
