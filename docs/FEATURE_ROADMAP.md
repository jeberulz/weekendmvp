# Feature Roadmap — Weekend MVP / ship·able

_Last updated: 2026-07-04. Synthesized from a full codebase inventory + market research on IdeaBrowser, Trends.vc, Exploding Topics, Starter Story, Small Bets, Indie Hackers, and ShipFast._

## How to read this

Every feature below is scored against the funnel in `STRATEGY.md`:

**SEO/AEO traffic → email capture (Beehiiv) → qualified $9 ship·able buyer → $29 DARE Live → high-ticket DARE.**

The north-star metric is **qualified buyers** (builder-designer persona on the list), so features are prioritized by (1) how directly they grow or qualify the list, (2) how much existing infrastructure they reuse, and (3) proven demand in the niche (competitor evidence cited per item).

Effort: **S** = a day or less, **M** = a weekend-to-a-week, **L** = multi-week.

### Where we sit in the market

| Competitor | Core paid offer | Price |
|---|---|---|
| IdeaBrowser | Idea database + AI research agent | $299–$999/yr |
| Trends.vc | Deep-dive reports + community | $299/yr |
| Exploding Topics | Trends database + alerts | $39–$249/mo |
| Starter Story | Case-study database + bootcamps | ~$792/yr |
| Small Bets | Classes + community, live events | $185 lifetime |
| ShipFast | Next.js boilerplate ("ship this weekend") | $199–$299 one-time |

Our structural advantages: **103 researched ideas with 4-dimension scores already in Convex**, a 7-section research contract (`ideas/SECTIONS.md`) that matches the "rigid report template" pattern Trends.vc built its brand on, a programmatic-hub engine no small competitor has, and a live $9 offer none of them have (their front doors are all free content → $299/yr — ours converts to a purchase at $9).

Our structural gaps: no daily free loop (IdeaBrowser's entire top-of-funnel), no personalization/founder-fit, no accounts or saved ideas, no interactive tools, no leaderboard/social proof, and the ideas grid can't sort or filter by most of the metadata we already store.

---

## Tier 1 — Now (compounding wins on existing infrastructure)

### 1.1 Idea of the Day — real page + archive
**Effort: S–M · Funnel: traffic + capture · Evidence: IdeaBrowser's entire free acquisition engine is one free daily idea + browsable archive.**

`/ideas/today` already exists as a 302 redirect (`app/ideas/today/route.ts`, `api.ideas.latest`). Upgrade it to a real page: today's featured idea with its scores, a visible countdown to tomorrow's, and an archive at `/ideas/previous`. Wire the daily-ideas Beehiiv automation CTA inline. Every past "today" page compounds into indexable inventory, and the page gives the newsletter a permanent on-site anchor ("see today's idea" works in every email, social post, and AI answer).

### 1.2 Sort + multi-facet filtering on `/startup-ideas`
**Effort: S–M · Funnel: engagement → capture · Evidence: Starter Story's 39 filterable databases; IdeaBrowser filters by investment/skill/time — filters turn content into a tool.**

`IdeasExplorer.tsx` has search + single category chips only (its own comment: "No sort controls, no tool/audience/revenue filters"). Convex already stores and indexes `buildTime`, `revenueGoal`, `tools[]`, `audiences[]`, and four scores per idea. Add: sort by newest / opportunity / builder-confidence / build-time; facet chips for revenue goal, build time, tool, audience. All state in URL params (pattern already exists) so filtered views are shareable and crawlable.

### 1.3 Surface the scores + a "Top Ideas" leaderboard page
**Effort: S · Funnel: traffic (AEO) + social proof · Evidence: IdeaBrowser's `/top-ideas` leaderboard; answer engines favor pages with unique quantitative data.**

We compute `scores{opportunity, pain, timing, builder_confidence}` for every idea and barely show them. Put a compact score readout on `IdeaCard` and the idea sidebar, and ship `/startup-ideas/top` — "Highest-scored weekend-buildable startup ideas" ranked by our own data, regenerated from Convex. Primary-source ranked lists are exactly what ChatGPT/Perplexity cite, and it's a natural monthly-refresh page for the newsletter.

### 1.4 RSS/Atom + JSON feeds
**Effort: S · Funnel: traffic + AEO distribution.**

No feed exists anywhere (confirmed). Add `/feed.xml` (ideas), `/articles/feed.xml`, `/newsletter/feed.xml` as route handlers reading Convex — a few hours of work. Feeds get us into readers, aggregators, and AI-crawler ingestion pipelines, and they're an expected feature for a content product.

### 1.5 Wire the DARE Live checkout
**Effort: S · Funnel: revenue — this is the funnel's second step and it currently can't take money.**

`/dare` is a draft: placeholder dates and `DareSeatForm` only captures email ("Stripe/Gumroad for live payment once ready"). The $9 ship·able checkout pattern (`ShipableCheckoutForm.tsx`: Stripe Payment Link + `prefilled_email` + `client_reference_id`, GA/Meta events, Beehiiv waitlist, `?paid=1` confirmation) is proven and directly reusable, and the webhook (`app/api/stripe-webhook/route.ts`) already handles any payment link. Blocked only on the real date/proof content per `STRATEGY.md`'s mid-July milestone — the code should be ready before the content is.

### 1.6 Per-idea FAQ section + FAQPage JSON-LD
**Effort: S · Funnel: AEO traffic · Evidence: question-phrased H2s and FAQ schema are the most-cited structures in AI answers; we already emit HowTo but not FAQPage on ideas.**

Reference tables in Convex already carry `faqs` for hubs. Add 3–4 generated FAQs per idea ("How long does X take to build?", "How much can X make?", "What stack should I use for X?") — answers derivable from existing manifest metadata — rendered on-page and emitted as FAQPage via `lib/seo.ts`.

### 1.7 "48-Hour Validation Checklist" content upgrade on every idea page
**Effort: S · Funnel: capture · Evidence: checklists/templates are the highest-converting lead-magnet format (template kits ~+72% capture vs guides); per-page content upgrades outperform generic site-wide CTAs.**

One well-made checklist asset, offered contextually at the bottom of all 68+ idea pages via the existing Beehiiv subscribe flow (`/api/subscribe` with a dedicated automation ID). Near-zero build cost, touches every page in the highest-traffic section.

### 1.8 Site-wide search (articles + newsletter included)
**Effort: S · Funnel: engagement.**

Only the ideas grid has search. Extend the same client-side pattern to `/articles` and `/newsletter` indexes (both datasets are small enough to filter in-memory, same as ideas today). Defer real full-text search until content volume demands it.

---

## Tier 2 — Next (differentiators; the qualification layer)

### 2.1 Founder-Fit Quiz → matched ideas + segmented list ⭐
**Effort: M · Funnel: capture AND qualification — this is the single highest-leverage feature on the list.**

**Evidence: IdeaBrowser's founder-fit assessment is its stickiest personalization feature; quizzes are the top-converting lead-magnet format (case studies show ~+68% opt-ins vs a PDF).**

A 5–6 question quiz (skills: design/code/marketing, hours available, budget, revenue goal, tools comfort) that (a) filters the existing Convex idea database into a personal shortlist — every question maps to metadata we already store (`audiences`, `buildTime`, `tools`, `revenueGoal`, scores), (b) captures email to deliver results, and (c) **tags the answer to the Beehiiv subscriber via custom fields**. That last part is the strategic payoff: `STRATEGY.md`'s north-star metric is *qualified* buyers (designer/PM/builder persona), currently measured by a one-field "what do you do" — the quiz measures persona fit at the top of the funnel and lets ship·able/DARE emails target the DARE-compatible segment directly.

### 2.2 Interactive free tools (2–3 calculators)
**Effort: M each · Funnel: backlinks + traffic + capture · Evidence: free tools are the proven link-earning vehicle in this niche (HubSpot Website Grader, CoSchedule Headline Analyzer); IdeaBrowser ships a generator at every tier.**

Candidates, in order:
1. **Weekend Buildability Scorer** — paste your idea, answer 5 questions, get a 0–100 "can you ship this in a weekend" score + recommended stack. On-brand, unique to us, and feeds the ship·able pitch directly.
2. **MVP Cost & Time Calculator** — scope choices → estimated build hours and cost (DIY vs done-for-you), with the Cal.com MVP-sprint CTA for the done-for-you path.
3. **Freelance Rate Calculator** — already queued as a fintech *idea brief* in `STRATEGY.md`; building it as a real tool doubles as proof-of-concept ("we built one of our own ideas") and a linkable asset.

Each tool: server-rendered shell for SEO, email-gated full results (existing gate pattern), own OG card via the existing pipeline.

### 2.3 Accounts + saved ideas (Clerk + Convex)
**Effort: M–L · Funnel: retention + data · Evidence: every competitor above $299/yr has accounts; saved-idea behavior is purchase-intent signal.**

The schema is already stubbed for exactly this: `users` and `saved_ideas` tables exist in `convex/schema.ts` with a comment reserving them for "Clerk + ConvexProviderWithClerk". Ship it minimally: sign in, heart an idea, `/my-ideas` list, and a weekly "ideas you saved" email hook. This upgrades the localStorage email gate into durable identity — a prerequisite for the paid tier (3.1) — and saved-idea counts become an on-site popularity signal (feeds the leaderboard, 1.3).

### 2.4 "Shipped by readers" showcase
**Effort: M · Funnel: proof + community · Evidence: ShipFast's customer-launch leaderboard is its core growth lever; Indie Hackers' revenue transparency built durable trust; `STRATEGY.md` calls the deployed URL "the proof engine for all future marketing".**

A submission form + curated gallery of things readers shipped (from ship·able calls, the starter kit, or idea pages), each linking the idea it came from. Every ship·able cohort (target ≥60% shipped-on-call) generates entries. This is the site's missing social-proof layer and a unique content type competitors can't copy without our workshop.

### 2.5 Idea upvoting
**Effort: S–M (after 2.3) · Funnel: engagement + data.**

Lightweight upvote on idea pages/cards (anonymous-with-dedupe or accounts-based once 2.3 lands). Fuels the leaderboard with real engagement data, tells us which categories to fill next (currently guesswork + Ideabrowser quota), and gives visitors a micro-interaction on otherwise read-only pages.

### 2.6 Newsletter database lead magnet
**Effort: S · Funnel: capture · Evidence: My First Million and The Hustle both use a curated idea database as their email-capture asset.**

Package the manifest data we already have as "103 Validated Weekend-Buildable Startup Ideas — the database" (Notion/CSV/Airtable export, regenerated by script), gated behind subscribe. Cheap to make, strong swap for the generic "get the starter kit" CTA in some placements, and A/B-testable against it.

---

## Tier 3 — Later (monetization expansion; sequence after Tiers 1–2 prove the loop)

### 3.1 Pro tier: free summary / paid deep-dive
**Effort: L · Funnel: new revenue line · Evidence: the proven paywall line in this niche — Trends.vc ($299/yr), IdeaBrowser ($299–$999/yr), Starter Story (~$792/yr); annual-only pricing at $99–$299 is the band.**

The 7-section contract already splits naturally: Problem/Solution free; Market Research, Competitive Landscape, Business Model, full AI Prompts behind a **$99–$199/yr** membership (deliberately undercutting IdeaBrowser's $299 with a "weekend-buildable only" niche focus). `researchLevel` ("deep"/"summary") already exists in the schema as the tiering flag. Requires 2.3 (accounts) + a real Stripe subscription flow (today: payment links only). **Caution:** this changes the free-content AEO posture — keep enough free depth that idea pages stay citable, and grandfather existing pages carefully.

### 3.2 On-demand research reports (productized or AI-assisted)
**Effort: L · Funnel: premium revenue · Evidence: IdeaBrowser's $999/yr tier is essentially "run the research agent yourself"; the niche is shifting from static library → per-user generated research.**

"Submit your idea, get the full 7-section Weekend MVP research report." Start productized-manual (the `/publish-idea` research stack is already a semi-automated 7-call pipeline — run it privately per customer at $49–$99/report), automate later. Also the natural DARE-program upsell asset.

### 3.3 MCP server / public API for the idea database
**Effort: M · Funnel: AEO distribution moat · Evidence: IdeaBrowser ships an MCP server exposing its product inside Claude/ChatGPT — where this audience increasingly starts their search.**

Expose read-only `search_ideas` / `get_idea` / `top_ideas` tools backed by the existing Convex queries. For a content product, being queryable *inside* AI assistants is the emerging distribution channel that pure SEO can't reach. Free tier = summaries + links back (drives traffic); full depth can key off the Pro tier later.

### 3.4 Community / live-events layer
**Effort: L · Funnel: retention + high-ticket bridge · Evidence: every competitor above ~$300/yr bundles community (Trends.vc masterminds, Small Bets weekly events, Starter Story Slack) — it's the churn-killer.**

Don't build software: run a Discord/Circle around ship·able cohorts and DARE, with a weekly "what are you shipping this weekend" ritual and demo days feeding the showcase (2.4). Becomes part of the DARE high-ticket offer. Explicitly sequenced after DARE Live validates (per `STRATEGY.md`'s "not working on" list).

### 3.5 Tool deals page
**Effort: S · Funnel: perceived value + affiliate revenue · Evidence: IdeaBrowser Empire, Trends.vc, and Starter Story all bundle "$50K–$1M in tool deals".**

A `/deals` page of partner discounts for the tools already referenced across `/build-with/*` hubs. Standalone SEO value now; bundle value for the Pro tier later.

---

## What NOT to build

- **llms.txt** — Google has confirmed zero Search/AI Overview effect and ~97% of llms.txt files get no AI-bot requests. Our real AEO levers are already in place (server-rendered HTML, allow-listed AI crawlers in `app/robots.ts`) — extend them with 1.3, 1.4, 1.6 instead.
- **Monthly pricing for a future Pro tier** — the niche's proven pattern is annual-only at $99–$999.
- **A custom-built community platform** — rent (Discord/Circle), don't build; the value is the ritual, not the software.
- **Generic AI chat on the site** — undifferentiated vs ChatGPT itself; the MCP server (3.3) is the higher-leverage way to meet AI users.
- **Comments on idea pages** — moderation cost without funnel benefit; upvotes (2.5) + showcase (2.4) capture the same energy productively.

---

## Suggested sequence

| Phase | Ship | Why this order |
|---|---|---|
| July 2026 | 1.5 DARE checkout → 1.2 filters/sort → 1.3 scores+leaderboard → 1.4 feeds → 1.6 FAQ schema | Revenue unblock first; then quick compounding SEO/UX wins on existing data |
| Aug 2026 | 1.1 Idea of the Day → 1.7 checklist upgrade → 2.6 database magnet → 1.8 search | The free daily loop + capture layer |
| Sept 2026 | 2.1 founder-fit quiz ⭐ → 2.2 first tool (Buildability Scorer) | Qualification layer — directly moves the north-star metric |
| Oct 2026 | 2.3 accounts+saved ideas → 2.5 upvotes → 2.4 showcase | Identity + proof layer; prerequisite for paid tier |
| Q4 2026+ | 3.1 Pro tier → 3.3 MCP server → 3.2 reports → 3.4 community → 3.5 deals | Monetization expansion, only after the loop above proves out |

**If only three things get built:** 1.5 (DARE checkout — the funnel literally can't take its second payment today), 2.1 (founder-fit quiz — grows *and* qualifies the list, the north-star metric), and 1.1 (Idea of the Day — the proven free daily loop this product is missing).
