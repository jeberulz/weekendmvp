# WP40 Stories - Publish 10 ideas into thin categories

Branch: `codex/wp40-underrepresented-ideas`
Lane: Work Package
Registry: Weekend MVP idea corpus
Definition of done: 10 Mode A idea pages written, tagged, section-gated, seeded (dev+prod), OG generated, pushed so `/ideas/{slug}` returns 200.

## Stories

- [x] `WP40-S1` - Publish 10 unpublished Ideabrowser ideas into the thinnest categories (skip SaaS)
  - Scope: `content/ideas/{slug}.mdx` × 10, `ideas/manifest.json`
  - Acceptance criteria:
    - Categories filled: health, developer-tools, automation, ai-tools, ecommerce, productivity, fintech, marketplace, b2b, education (one each)
    - Each page passes the publish-idea section gate (≥~800 words, 8 H2s, How-it-works numbered list, 3+ competitors with pricing, 2+ cited stats, no bare `<`/`{` in prose)
    - `npm run validate:idea-tags` passes for the new slugs
  - Verification:
    - `npm run validate:idea-tags`
    - mechanical grep/wc/awk gate per slug

## Out Of Scope

- Platform/WP19–39 code
- SaaS category fills
- Article or programmatic hub pages

## Notes

- Mode A only. STOP if MCP competitive_analysis lacks 3 named competitors with pricing.
- Do not edit `ideas/manifest.json` from parallel workers; orchestrator merges entries.
