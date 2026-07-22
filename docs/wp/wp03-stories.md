# WP03 Stories - Publish 5 Programmatic SEO Hubs

Branch: `cursor/publish-5-programmatic-hubs-8e5e`
Lane: Work Package
Registry: `docs/PROJECT_STRATEGY.md`
Definition of done: Five new programmatic hubs live in config (3 audiences + 2 problems), ideas tagged + seeded, typecheck passes, PR open.

## Stories

- [x] `WP03-S1` - Tag ideas + audience ref blocks in `ideas/manifest.json`
  - Scope: `ideas/manifest.json` — tag freelancers / creators / small-business-owners on ≥5 ideas each; add matching `manifest.audiences[]` ref blocks
  - Acceptance criteria:
    - Each new audience slug appears on ≥5 ideas
    - Ref blocks include description, keywords, traits, resources for Convex override
  - Verification:
    - `node` count script; `npm run seed:convex` (dev + prod if credentials allow)

- [x] `WP03-S2` - Audience hubs: freelancers, creators, small-business-owners
  - Scope: `app/ideas-for/[audience]/page.tsx` (`AUDIENCE_PAGES` + `AUDIENCE_TILES`)
  - Acceptance criteria:
    - Three typed entries with SEO meta (<60 title / <160 description), AEO-friendly positioning
    - Icons imported; valid `HubColor`; tiles updated
  - Verification:
    - `npm run typecheck`

- [x] `WP03-S3` - Problem hubs: lead-generation, content-creation
  - Scope: `app/solve/[problem]/page.tsx` (`PROBLEM_PAGES`)
  - Acceptance criteria:
    - Two typed entries with HowTo steps, stats, `categoryMatches` from existing categories
    - Meta optimized for "how to automate …" intent
  - Verification:
    - `npm run typecheck`

## Out Of Scope

- New tools / categories / revenue / build-time hubs
- New idea MDX content
- Sitemap hand-edits (audience + problem slugs auto-export)

## Notes

- Sitemap auto-imports `AUDIENCE_SLUGS` / `PROBLEM_SLUGS`.
- Problems reuse existing categories → no idea retag for S3.
- Promote unknown product decisions to `docs/wp/RULINGS.md`.
