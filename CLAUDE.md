# Weekend MVP — Claude Code guidelines

> **Active now:** branch `design/platform-experience`. Product thinking, not
> coding. Signed-in home is `docs/design/signed-in-home.md`; Library is
> `docs/design/signed-in-library.md`; preview is `docs/design/preview.md`;
> publish is `docs/design/publish.md` — do not implement the Hilos dashboard,
> Explore tabs, `/build` CMS, or cockpit-as-Launch from
> `docs/wp/platform-ux-brief.md`. Read
> `docs/wp/AGENT_HANDOFF.md` for traps only; its WP27/consolidation body is
> stale. `docs/wp/CLAUDE_HANDOFF.md` is history.

Next.js (App Router) + MDX + Convex site for startup idea validation and the
Weekend MVP Starter Kit. Pages are React Server Components; long-form content
(ideas, articles, newsletters) is MDX in `content/`; metadata lives in Convex
+ the `*/manifest.json` files.

## Local development

| Goal | Command |
|------|---------|
| App dev server | `npm run dev` — `next dev` (port **3000**) |
| Convex backend (run alongside) | `npm run convex:dev` — required for ideas grid, hubs, seeding |
| Type check | `npm run typecheck` |
| Production build | `npm run build` |

After clone: `npm ci`, then `npm run build` (+ `npm run convex:dev` in a
second terminal for backend-dependent pages).

**Styling:** Tailwind v4 via `@tailwindcss/postcss`; global styles in
`app/globals.css`; fonts are Geist (sans/mono); icons are `lucide-react`.
No hand-built CSS pipeline — never edit compiled output.

## Content pipeline — use the skills, don't author by hand

New ideas/articles are MDX in `content/` + an entry in `ideas/manifest.json`
/ `articles/manifest.json` (the metadata source of truth), then
`npm run seed:convex` (Convex powers grids/hubs) and `npm run og:generate`
(OG cards). Use `/publish-idea`, `/publish-article`, and
`/publish-programmatic` rather than doing these steps manually.

## Accessibility

Every page and component must pass WCAG 2.1 AA — run the **`a11y-check`
skill** on any new or changed UI before calling it done. Project-specific:
logo divs use `role="img" aria-label="Weekend MVP"`. Reference
implementations to mirror: `app/(marketing)/starter-kit/CopyPromptButton.tsx`
(icon button), `app/articles/[slug]/page.tsx` (external-link sr-only hint),
the shared `app/**/layout.tsx` files (nav/footer — pages never re-author
them).

## SEO & AEO — mostly automatic, don't hand-edit

- `app/sitemap.ts` auto-discovers `content/**/*.mdx` and exported `*_SLUGS`;
  `app/robots.ts` allow-lists AI crawlers. There is **no** static
  `sitemap.xml`/`robots.txt` to edit. Exception: a new `/build-with/{tool}`
  needs its slug added to the inlined `BUILD_WITH_SLUGS` in `app/sitemap.ts`.
- Each route exports `generateMetadata` (title, description, canonical,
  `og:image`/`twitter:image`; OG images at `/image/og/{idea|article}/{slug}.png`).
- JSON-LD comes from the builders in `lib/seo.ts`. Index pages generate their
  `ItemList` dynamically from Convex/MDX — never hand-edit one.
- Person schema canonical URL is `/john-iseghohi` (not Cal.com). Cal stays in
  `sameAs` and UI booking CTAs only.
- Idea pages parse the MDX `**How it works:**` numbered list into `HowTo`
  schema — keep that section format intact.
- Keep primary content server-rendered; no client-only gates hiding it from
  crawlers.

## Analytics (GA4) — two different IDs, one build-time trap

GA is consent-gated (`components/consent/AnalyticsScripts.tsx`); events go
through `window.gtag` via `lib/track.ts`.

| ID | What | Where |
|----|------|-------|
| Measurement ID `G-Z1NYERTKRS` | client-side tracking | `NEXT_PUBLIC_GA_ID` (`.env.local` + Vercel prod) |
| Property ID `517826359` | GA4 Data API reads | service-account integrations (GA MCP) |

⚠️ `NEXT_PUBLIC_*` vars are inlined at **build** time. If `NEXT_PUBLIC_GA_ID`
is empty in Vercel production, the live site ships `GA_ID=undefined` and GA
silently collects nothing. After changing it, trigger a fresh build (empty
commit + push) — updating the env var alone does not re-inline it.

## Beehiiv subscriptions

Follow `BEEHIIV_CURSOR_RULES.md`: POST to
`https://api.beehiiv.com/v2/publications/{publication_id}/subscriptions`,
always include `form_id` + `automation_ids`, use Vercel Edge runtime, and
read the response as text before parsing JSON.

## Key paths

- `content/{ideas,articles,newsletter-pages}/*.mdx` — page bodies
- `ideas/manifest.json`, `articles/manifest.json` — metadata source of truth
- `ideas/SECTIONS.md` — the 7-section idea contract (gate for publish-idea)
- `app/{solve,build-with,ideas-for}/` — programmatic hubs (hardcoded TS
  config objects, see `/publish-programmatic`)
- `lib/mdx.tsx` (MDX loader), `lib/seo.ts` (JSON-LD), `scripts/` (seed + OG)

<!-- convex-ai-start -->

This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read
`convex/_generated/ai/guidelines.md` first** for important guidelines on
how to correctly use Convex APIs and patterns. The file contains rules that
override what you may have learned about Convex from training data.

Convex agent skills for common tasks can be installed by running
`npx convex ai-files install`.

<!-- convex-ai-end -->

<!-- BEGIN:agentic-delivery-workflow -->
This repo uses the agentic delivery workflow.

Before coding, read:
- `AGENTS.workflow.md`
- `.agentic-workflow.yml`
- `docs/wp/RULINGS.md`

Required defaults:
- Choose Program/Migration, Work Package, Small Fix, or Gate lane before editing.
- For large/risky programs, audit first, freeze `docs/wp/program-manifest.md`, sequence by risk, and gate every wave.
- Create/switch to a branch before story or code changes.
- For work packages, maintain `docs/wp/wpNN-stories.md` and `docs/wp/wpNN-progress.md`.
- Use Git worktrees only when needed, and only under `.worktrees/`.
- Never create sibling project folders for work packages.
- Use sub-agents only for parallel work packages, independent review, gate runs, or context isolation.
- Route model quality by risk: high for orchestration/security/architecture/data/AI/final review, mid for standard WPs, low for scaffolding/docs/checks/mechanical fixes.
- Run the configured checks and record docs updated/not needed.
<!-- END:agentic-delivery-workflow -->
