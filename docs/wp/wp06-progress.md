# WP06 Progress — Marketplace + B2B batch

## Status
Ready to push — MDX, manifest, Convex (dev+prod), OG all done.

## Branch
`content/marketplace-b2b-batch-10`

## Idea IDs → slugs

| ID | Slug | Category |
|----|------|----------|
| 8712 | `small-town-storefront-marketplace` | marketplace |
| 8566 | `fan-funded-creator-products` | marketplace |
| 8523 | `creator-manufacturer-partnership-marketplace` | marketplace |
| 8558 | `ai-builder-hiring-marketplace` | marketplace |
| 7923 | `wedding-event-staffing-marketplace` | marketplace |
| 5040 | `website-accessibility-ada-scanner` | b2b |
| 5309 | `ai-chief-of-staff-consultants` | b2b |
| 5360 | `shopify-trust-scanner` | b2b |
| 8023 | `markdown-client-proposals` | b2b |
| 8946 | `one-star-attack-detection` | b2b |

## Pipeline checklist
- [x] Mode A research (base + competitive)
- [x] MDX written (all ≥800 words, 8 sections, How it works)
- [x] Manifest entries (`source: ideabrowser:{id}`, accents cycled)
- [x] `npm run seed:convex` (dev)
- [x] `npm run seed:convex -- --prod`
- [x] `npm run og:generate` ×10 → `public/image/og/idea/*.png`
- [ ] Commit + push (+ merge main for Vercel)
- [ ] Live `/ideas/{slug}` 200s

## Notes
- Categories forced to `marketplace` / `b2b` for category-fill goal.
- Escaped MDX hazards (`<`, `{`) in prose.
