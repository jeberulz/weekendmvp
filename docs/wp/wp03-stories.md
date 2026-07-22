# WP03 Stories - Publish 5 AEO/SEO Articles

Branch: `cursor/publish-5-articles-aeo-seo-f2aa`
Lane: Work Package
Registry: `docs/PROJECT_STRATEGY.md`
Definition of done: Five new articles live in MDX + manifest, seeded to Convex (dev + prod when auth allows), OG cards generated or marked failed non-blocking, committed and PR'd; each article has FAQ + early answer + 3 CTAs to `/startup-ideas`.

## Stories

- [x] `WP03-S1` - Product Hunt solo launch playbook
  - Scope: `content/articles/product-hunt-launch-solo-founder-2026.mdx`, `articles/manifest.json`
  - Acceptance criteria:
    - How-To article with 2026 PH stats, FAQ, 3+ `/startup-ideas` CTAs
  - Verification:
    - `awk` MDX JSX safety; slug in manifest

- [x] `WP03-S2` - Reddit customer discovery guide
  - Scope: `content/articles/find-customers-on-reddit-saas.mdx`, `articles/manifest.json`
  - Acceptance criteria:
    - How-To with problem-keyword system, FAQ, CTAs
  - Verification:
    - MDX safety; manifest entry

- [x] `WP03-S3` - Cursor vs Claude Code vs Lovable comparison
  - Scope: `content/articles/cursor-vs-claude-code-vs-lovable-2026.mdx`, `articles/manifest.json`
  - Acceptance criteria:
    - Comparison/listicle with decision matrix, FAQ, CTAs
  - Verification:
    - MDX safety; manifest entry

- [x] `WP03-S4` - Stripe payments for weekend MVP
  - Scope: `content/articles/add-stripe-to-weekend-mvp.mdx`, `articles/manifest.json`
  - Acceptance criteria:
    - How-To Checkout/subscriptions path, FAQ, CTAs
  - Verification:
    - MDX safety; manifest entry

- [x] `WP03-S5` - Micro-SaaS SEO + AEO content engine
  - Scope: `content/articles/micro-saas-seo-aeo-content-2026.mdx`, `articles/manifest.json`
  - Acceptance criteria:
    - How-To content playbook with 2026 AEO stats, FAQ, CTAs
  - Verification:
    - MDX safety; manifest entry

- [ ] `WP03-S6` - Seed, OG, commit, PR
  - Scope: seed scripts, OG PNGs, git
  - Acceptance criteria:
    - `npm run seed:convex -- --only articles` (+ `--prod` if auth)
    - `npm run og:generate` for each slug `--non-blocking`
    - Commit + push + PR
  - Verification:
    - Seed logs; og.status ready|failed; PR open

## Out Of Scope

- Rewriting existing articles
- New site chrome / layout changes
- Ideas MDX / programmatic hubs

## Notes

- Topics queue (`topics/research.md`) missing; all prior queue topics already published — these five are net-new.
- Docs update: registry + this WP pair only (content publish, no architecture change).
