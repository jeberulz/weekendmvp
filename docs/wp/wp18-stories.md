# WP18 Stories - Five research-backed startup ideas

Branch: `feat/publish-five-ideas`
Lane: Work Package
Registry: `docs/PROJECT_STRATEGY.md`
Definition of done: Five new Ideabrowser Mode A idea pages are researched, authored, validated, added to the manifest, and prepared for Convex/OG publication, with preference for categories that have the fewest current idea pages.

## Stories

- [ ] `WP18-S1` - Identify low-content categories and select five publishable ideas
  - Scope: `ideas/manifest.json`, Ideabrowser browse/research tools
  - Acceptance criteria:
    - Existing manifest category counts are inventoried before selection
    - Five distinct ideas are selected from underrepresented categories where possible
    - Each selected idea meets the Mode A research stop rule
  - Verification:
    - Ideabrowser research records and a category-count inventory are retained in the progress log

- [ ] `WP18-S2` - Author five complete idea pages
  - Scope: `content/ideas/{slug}.mdx`, `ideas/manifest.json`
  - Acceptance criteria:
    - Each page has the exact two-field frontmatter and all eight canonical sections
    - Each page has a numbered `How it works` list, three AI prompts, three or more priced competitors, and cited market evidence
    - Each manifest entry includes provenance, scores, metadata, and OG configuration
  - Verification:
    - Section, word-count, placeholder, MDX-safety, slug, and manifest checks pass for all five pages

- [ ] `WP18-S3` - Seed, generate assets, and run publication checks
  - Scope: Convex seed commands, `public/image/og/idea/`, configured project checks
  - Acceptance criteria:
    - Dev and production Convex seeds are attempted and reported honestly
    - OG generation is attempted for each new slug and failures remain non-blocking
    - Required typecheck, lint, tests, and build checks are run or their blockers are recorded
  - Verification:
    - Command output and live/deployment status are recorded in `docs/wp/wp18-progress.md`

## Out Of Scope

- Rewriting or deleting pre-existing uncommitted idea files or manifest entries
- WebSearch fallback; this work uses Ideabrowser Mode A only
- Changes to application routes, Convex schema, or shared UI
- Claiming production visibility without a successful production seed and deploy verification

## Notes

- Preserve the user’s existing dirty worktree changes while adding WP18 files.
- The publish skill’s MCP stop rule is a blocker for any idea lacking sufficient competitor pricing, market citations, or go-to-market data.
