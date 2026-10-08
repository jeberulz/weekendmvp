# WP62 Stories — Public idea SEO summary above EmailGate

Branch: `cursor/idea-public-seo-summary-f0a8`
Lane: Work Package
Registry: `docs/PROJECT_STRATEGY.md`
Definition of done: Logged-out `/ideas/{slug}` HTML includes a server-rendered public summary (SEO title/meta, H1, 120–250 word summary, research H2 teasers, ungated build prompts, Article + BreadcrumbList JSON-LD) without exposing the deep research body; signed-in experience unchanged; focused tests and configured checks pass.

## Stories

- [x] `WP62-S1` — Public preview builder from existing fields
  - Scope: `lib/ideas/public-preview.ts`, `tests/ideas/public-preview.test.ts`
  - Acceptance criteria:
    - Document titles prefer description leads for short stubs and clamp to ≤60 with the brand suffix where practical; meta ≤160.
    - Summary and section teasers are stitched only from MDX/manifest text; thin sources flag `thinSummary`.
    - Build prompts extract via the existing homepage extractor.
  - Verification: `npx vitest run tests/ideas/public-preview.test.ts`

- [x] `WP62-S2` — Render public summary above the account gate
  - Scope: `app/ideas/[slug]/page.tsx`, `components/ideas/EmailGate.tsx`, `components/ideas/IdeaPublicSummary.tsx`, auth gate regression test
  - Acceptance criteria:
    - Anonymous HTML is identical for every visitor (no UA sniffing): summary, teasers, prompts, then account CTA.
    - Public JSON-LD is Article + BreadcrumbList from public fields only; no `isAccessibleForFree` / paywall schema.
    - Member path still renders full `IdeaContent` unchanged.
  - Verification: logged-out curl against local production build for four idea slugs; `tests/auth/ideas-account-gate.test.ts`

## Out Of Scope

- claim-to-pay, Stripe, preview generation/bridge, auth providers
- Exposing editorial markdown through public Convex queries
- Changing `/startup-ideas` library gate
- Site publishing / production deploy

## Notes

- Owner asked for this SEO repair after PR #116 thinned anonymous idea pages. Ruling recorded in `docs/wp/RULINGS.md`.
