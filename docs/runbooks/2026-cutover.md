# Cutover runbook — Next.js migration (U14)

**Owner:** John Iseghohi
**Migration plan:** `docs/plans/2026-06-12-001-refactor-nextjs-convex-migration-plan.md`
**Branch:** `next-migration` (this branch becomes `main` after cutover)

This document is the operational playbook for swapping `weekendmvp.app` from the legacy static deploy to the new Next.js app. Every step here is **user-executed** because it touches production infrastructure (DNS, Vercel domains, Convex production, Stripe webhooks, Beehiiv).

---

## 0. Pre-cutover prerequisites

Before scheduling the swap, every item in this list must be ✅:

- [ ] All slice units (U1–U13) merged on `next-migration` and `npm run build` is green
- [ ] `next-migration` deployed to a fresh Vercel project at `next.weekendmvp.app`
- [ ] A second Vercel domain `legacy.weekendmvp.app` is aliased to the current production project (so unmigrated path fallbacks still resolve during the slicing window — if you're cutting over straight from this branch the fallback is unused)
- [ ] Production Convex deployment provisioned (`npx convex deploy` from this repo, with `CONVEX_DEPLOY_KEY` set). URL goes into Vercel project env `NEXT_PUBLIC_CONVEX_URL`
- [ ] `node scripts/seed-convex.mjs --prod` run against production Convex (57 ideas, 19 articles, 11 newsletter issues, reference tables seeded)
- [ ] Vercel project env vars set (mirror `.env.example`):
  - [ ] `BEEHIIV_API_KEY`
  - [ ] `BEEHIIV_PUBLICATION_ID`, `BEEHIIV_DEFAULT_FORM_ID`, `BEEHIIV_DEFAULT_AUTOMATION_ID`, `BEEHIIV_SHIPABLE_AUTOMATION_ID`, `BEEHIIV_IDEAS_AUTOMATION_ID`, `BEEHIIV_PAID_AUTOMATION_ID`
  - [ ] `STRIPE_WEBHOOK_SECRET` (required — webhook signature verification)
  - [ ] `STRIPE_SECRET_KEY` (OPTIONAL for the current Payment-Link flow; the webhook does signature verification only and never reaches the Stripe API. Set if you later add `checkout.sessions.create`, refunds, or customer/subscription queries.)
  - [ ] `NEXT_PUBLIC_CONVEX_URL`
  - [ ] `REVALIDATE_SECRET` (generate a fresh secret; mirror to Convex env `SITE_URL` + `REVALIDATE_SECRET` so the http action can POST to /api/revalidate)
  - [ ] `NEXT_PUBLIC_BASE_URL=https://weekendmvp.app`
  - [ ] `NEXT_PUBLIC_GA_ID`, `NEXT_PUBLIC_META_PIXEL_ID`
- [ ] Stripe webhook endpoint added in Stripe Dashboard pointing at `https://next.weekendmvp.app/api/stripe-webhook` (in addition to the existing legacy endpoint — both fire until cutover)

---

## 1. Sitemap coverage validation

Export the legacy sitemap to disk (one-shot):

```bash
curl https://weekendmvp.app/sitemap.xml > /tmp/legacy-sitemap.xml
```

Run the validator against the new deploy:

```bash
node scripts/validate-sitemap-coverage.mjs /tmp/legacy-sitemap.xml https://next.weekendmvp.app
```

**Exit 0 is the gate.** If any URL returns 4xx/5xx, do not cut over — investigate and add the missing route or 301 redirect first.

Expected: every legacy URL resolves either directly or via 308 redirect (`.html` → extensionless, etc.).

---

## 2. End-to-end smoke tests on `next.weekendmvp.app`

Run these manually with a real browser **and** `curl`:

### Marketing surfaces
- [ ] `GET /` → 200, no `cdn.tailwindcss.com` in HTML, canonical `https://weekendmvp.app`
- [ ] `GET /starter-kit` → 200, copy prompts render and copy
- [ ] `GET /shipable` → 200, countdown ticks, sticky bar shows on mobile
- [ ] `GET /dare` → 200, `<meta name="robots" content="noindex, nofollow">`
- [ ] `GET /privacy-policy` → 200
- [ ] `GET /not-a-real-route` → 404

### Content surfaces (R1 + R4)
- [ ] `GET /ideas/ai-code-coach-tutor` → 200, **raw HTML (no JS) contains full body sections** (`curl -s ... | grep -c "The Problem"` ≥ 1)
- [ ] Browser: same URL shows email gate overlay when localStorage clear
- [ ] Browser: paste `?utm_source=beehiiv` → gate bypassed
- [ ] `GET /ideas/today` → 302 to a real `/ideas/{slug}`
- [ ] `GET /articles/vibe-coding-101` → 200, syntax-highlighted code blocks
- [ ] `GET /newsletter/2026-04-20-am` → 200, `data-nl-slot="am"` attribute
- [ ] `GET /startup-ideas` → 200, filter UI works, 57+ idea links in HTML
- [ ] `GET /ideas/saas` → 200, dark canvas inside cream layout
- [ ] `GET /ideas-for/developers` → 200, idea grid
- [ ] `GET /build-with/cursor` → 200, ≤30 ideas
- [ ] `GET /solve/customer-support` → 200, HowTo JSON-LD present

### Forms & integrations
- [ ] Submit homepage email → POST `/api/subscribe` → 200 → real Beehiiv enrollment (check Beehiiv dashboard)
- [ ] Submit ship·able form → redirects to Stripe Payment Link
- [ ] `stripe trigger checkout.session.completed --forward-to https://next.weekendmvp.app/api/stripe-webhook` (with a test card) → 200, Convex `stripe_events` row appears, Beehiiv paid automation enrolls the buyer
- [ ] Idea page email gate submit → POST `/api/ideas-subscribe` → 200 → ideas-daily Beehiiv automation enrolls
- [ ] Beehiiv welcome email link with `?e=<email>` → `/api/ideas-verify` returns `{ok:true}` for an active subscriber

### SEO surfaces
- [ ] `GET /sitemap.xml` → 126 URLs (5 root + 57 ideas + 19 articles + 11 newsletter + 6 ideas-for + 8 build-with + 5 solve + 13 collection + 2 misc)
- [ ] `GET /robots.txt` → AI bot allowlist present
- [ ] `GET /llms.txt` → 200
- [ ] `GET /image/og-image.png` → 200 (default OG preserved)
- [ ] `GET /image/og/idea/ai-travel-planner.png` → 200 (per-idea OG preserved)
- [ ] `GET /ideas/ai-code-coach-tutor.html` → 308 → `/ideas/ai-code-coach-tutor`

### Lighthouse (use Chrome DevTools)
- [ ] Performance ≥ 90 on `/`
- [ ] Accessibility = 100 on `/`, `/starter-kit`, `/ideas/ai-code-coach-tutor`
- [ ] Best Practices ≥ 95 (no inline `gtag` before consent, no cdn.tailwindcss.com)

---

## 3. DNS swap (cutover)

When Section 2 is fully ✅:

1. In Vercel → `next-migration` project → Domains:
   - Add domain `weekendmvp.app` (transfer from legacy project if needed)
   - Add `www.weekendmvp.app` with redirect to apex
2. Remove `weekendmvp.app` from the legacy Vercel project. It now serves only `legacy.weekendmvp.app`.
3. In the new project, **edit `next.config.ts`** to remove the `fallback` rewrite array (every URL is now owned). Commit + redeploy.
4. Update Stripe webhook endpoint: remove the legacy `https://weekendmvp.app/api/stripe-webhook` endpoint, keep only `https://weekendmvp.app/api/stripe-webhook` (now hitting the new app via DNS).

**Verification within 5 minutes of DNS propagation:**
```bash
curl -sI https://weekendmvp.app/ | grep -i "x-vercel-id\|server"
# expect a new vercel-id that differs from the legacy project's
curl -s https://weekendmvp.app/sitemap.xml | grep -c "<loc>"
# expect 126
```

---

## 4. Post-cutover monitoring (30-day window)

- [ ] Vercel Observability: error rate ≤ 7-day pre-cutover baseline for 7 consecutive days
- [ ] Beehiiv: subscribe events per day match pre-cutover rate
- [ ] Google Search Console: re-submit sitemap, monitor coverage report daily for the first week, then weekly
- [ ] Stripe: webhook delivery success rate at 100% (Convex idempotency guards retries)
- [ ] Social card scrapers (Twitter, LinkedIn Post Inspector) re-fetch a sample of 3 each — confirm cards render

---

## 5. Rollback procedure

If a P0 regression appears within 30 days:

1. In Vercel → legacy project → Domains: re-add `weekendmvp.app` (5 min DNS propagation).
2. In the new project: leave the deployment up; do NOT delete. Investigate offline.
3. Stripe: re-enable the legacy webhook endpoint.

DNS swap reverts in under 5 minutes. No data loss because Convex `stripe_events` is idempotent — legacy enrollments via Beehiiv don't conflict.

---

## 6. Legacy retirement (T+30 days)

Once monitoring is clean for 30 days:

- [ ] Delete the legacy Vercel project
- [ ] Remove `legacy.weekendmvp.app` DNS entry
- [ ] Merge `next-migration` into `main`, delete the branch
- [ ] Seed `docs/solutions/` with 1–2 patterns from this migration (e.g., "fallback rewrites for slice-by-slice", "email gate must server-render visible-by-default")

---

## Appendix: what was removed from this repo

Retired in U14:
- `partials/*.html` (5 files) — React layouts own this now
- `scripts/sync-*.js`, `scripts/publish-idea-page.js`, `scripts/update-*.js`, `scripts/tag-build-with-tools.js`, `scripts/inject-analytics.js`, `scripts/check-internal-links.js`, `scripts/report-missing-stylesheets.js`, `scripts/audit-ideas.js`, `scripts/validate-schema.js`, `scripts/schema-fix.js`, `scripts/backfill-*.js`, `scripts/build-newsletter-index.js`, `scripts/generate-programmatic-pages.js`, `scripts/idea-data/`, `scripts/ralph/`
- `scripts.js`, `src/input.css`, `tailwind.config.js`, `styles.css`, `vercel.json`
- `README-ANALYTICS.md`
- All `*.html` pages at repo root and under `ideas/`, `articles/`, `newsletter/`, `ideas-for/`, `build-with/`, `solve/`

Retained (still load-bearing):
- `lib/og/`, `scripts/generate-og-cards.mjs`, `tests/og/` — OG generation pipeline
- `scripts/extract-*.mjs`, `scripts/seed-convex.mjs`, `scripts/publish-newsletter.mjs`, `scripts/validate-sitemap-coverage.mjs`, `scripts/check-og-cards.js`, `scripts/lib/html-to-md.mjs`
- `articles/manifest.json`, `ideas/manifest.json`, `newsletter/manifest.json` — seed sources of truth
- `content/newsletter/` — authoring source (gitignored per-issue)
- `CLAUDE.md`, `BEEHIIV_CURSOR_RULES.md`, `IMAGES.md` — institutional knowledge
