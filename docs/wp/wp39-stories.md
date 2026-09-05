# WP39 Stories - Publish 10 ideas into thin categories

Branch: `codex/wp39-underrepresented-ideas`
Lane: Work Package
Registry: Weekend MVP idea corpus
Definition of done: 10 Mode A idea pages written, tagged, section-gated, seeded (dev+prod), OG generated, pushed so `/ideas/{slug}` returns 200.

## Stories

- [ ] `WP39-S1` - Publish 10 unpublished Ideabrowser ideas into the 12-count and 13-count categories (skip SaaS/education)
  - Scope: `content/ideas/{slug}.mdx` × 10, `ideas/manifest.json`
  - Acceptance criteria:
    - Categories filled: health, developer-tools, marketplace, b2b, fintech, automation, ai-tools, ecommerce, productivity, creator-tools (one each)
    - Each page passes the publish-idea section gate (≥~800 words, 8 H2s, How-it-works numbered list, 3+ competitors with pricing, 2+ cited stats, no bare `<`/`{` in prose)
    - `npm run validate:idea-tags` passes for the new slugs
  - Verification:
    - `npm run validate:idea-tags`
    - mechanical grep/wc/awk gate per slug

## Out Of Scope

- Platform/WP19–38 code
- SaaS or education category fills
- Article or programmatic hub pages

## Notes

- Mode A only. STOP if MCP competitive_analysis lacks 3 named competitors with pricing.
- 7293 (AI plugin trust registry) failed that gate (Copyleaks/Turnitin/ANSYS, no $). Replaced with 36.
- Do not edit `ideas/manifest.json` from parallel workers; orchestrator merges entries.
