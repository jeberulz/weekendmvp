# WP08 — Publish 5 ideas into thin categories

## Goal

Publish five Ideabrowser Mode A ideas into underrepresented categories (not SaaS). Current thin buckets: health (5), education (5), ecommerce (8).

## Stories

### S1 — Publish health: AI Dance Form Coach (idea_id 2302)
- Write `content/ideas/ai-dance-form-coach.mdx` + manifest entry
- Category: `health`

### S2 — Publish health: AI Protein Tracker (idea_id 1829)
- Write `content/ideas/ai-protein-tracker.mdx` + manifest entry
- Category: `health`

### S3 — Publish education: AWS Cert AI Study Buddy (idea_id 2709)
- Write `content/ideas/aws-cert-ai-study-buddy.mdx` + manifest entry
- Category: `education`

### S4 — Publish education: AI Course Tutor Companion (idea_id 4170)
- Write `content/ideas/ai-course-tutor-companion.mdx` + manifest entry
- Category: `education`

### S5 — Publish ecommerce: Shopify AI Support Context (idea_id 7459)
- Write `content/ideas/shopify-ai-support-context.mdx` + manifest entry
- Category: `ecommerce`

### S6 — Seed, OG, deploy
- Section gate all five
- `npm run seed:convex` + `--prod`
- `npm run og:generate` per slug (non-blocking)
- Commit + push for live `/ideas/{slug}` pages
