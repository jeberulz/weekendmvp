# Weekend MVP - Claude Code Guidelines

## Project Overview

Weekend MVP is a **Next.js (App Router) + MDX + Convex** site for startup idea validation and the Weekend MVP Starter Kit. Pages are React Server Components; long-form content (ideas, articles, newsletters) is authored as MDX in `content/` and metadata lives in Convex + the `*/manifest.json` files. All pages must be accessible, performant, and follow consistent patterns.

### Local development

| Goal | Command |
|------|---------|
| App dev server | `npm run dev` — `next dev` (default port **3000**) |
| Convex backend (run alongside dev) | `npm run convex:dev` — required for the ideas grid, hubs, and seeding |
| Type check | `npm run typecheck` — `tsc --noEmit` |
| Production build | `npm run build` — `next build` |

**Styling:** Tailwind v4 via `@tailwindcss/postcss` (see [`postcss.config.mjs`](postcss.config.mjs)). Global styles live in [`app/globals.css`](app/globals.css); fonts are Geist (sans/mono). There is no hand-built CSS pipeline — do not edit compiled output.

**Content pipeline:** new ideas/articles are MDX in `content/` + an entry in `ideas/manifest.json` / `articles/manifest.json` (the metadata source of truth), then `npm run seed:convex` (→ Convex powers grids/hubs) and `npm run og:generate` (→ OG cards). The sitemap (`app/sitemap.ts`) and robots (`app/robots.ts`) are generated automatically — there is no static `sitemap.xml`/`robots.txt` to edit. Use the `/publish-idea`, `/publish-article`, and `/publish-programmatic` skills rather than authoring by hand.

**After clone:** `npm ci`, then `npm run build` (and `npm run convex:dev` in a second terminal for backend-dependent pages).

---

## Accessibility Requirements (WCAG 2.1 AA)

**Every page and component MUST follow these accessibility rules. Non-compliance is a bug.**

> These rules apply to the React/JSX components in `app/` and `components/`, and to MDX content. The examples below are written in HTML for brevity — translate to JSX (`className`, `aria-hidden={true}`, etc.). The app uses **`lucide-react`** icons (e.g. `<X aria-hidden />`), not the `iconify-icon` web component shown in legacy snippets.

### Critical Requirements (Must Pass)

#### 1. Icon-Only Buttons
All buttons containing only icons MUST have an `aria-label`:

```html
<!-- CORRECT -->
<button aria-label="Close modal">
    <iconify-icon icon="lucide:x" width="20" aria-hidden="true"></iconify-icon>
</button>

<!-- INCORRECT - Missing aria-label -->
<button>
    <iconify-icon icon="lucide:x" width="20"></iconify-icon>
</button>
```

Common buttons that need aria-labels:
- Close buttons: `aria-label="Close modal"` or `aria-label="Close menu"`
- Menu buttons: `aria-label="Open menu"`
- Copy buttons: `aria-label="Copy to clipboard"`
- Navigation arrows: `aria-label="Next"` / `aria-label="Previous"`

#### 2. Decorative Icons
Icons inside buttons or links MUST have `aria-hidden="true"`:

```html
<button aria-label="Close">
    <iconify-icon icon="lucide:x" aria-hidden="true"></iconify-icon>
</button>
```

#### 3. Logo Accessibility
Logo divs using CSS mask-image MUST have `role="img"` and `aria-label`:

```html
<div class="logo h-4 w-32 text-black" role="img" aria-label="Weekend MVP"></div>
```

#### 4. Form Inputs
All form inputs MUST have associated labels:

```html
<!-- Using label element -->
<label for="email">Email Address</label>
<input type="email" id="email" name="email">

<!-- Or using aria-label for visually hidden labels -->
<input type="email" aria-label="Email address" placeholder="you@example.com">
```

#### 5. Images
All images MUST have alt attributes:

```html
<!-- Informative image -->
<img src="chart.png" alt="Monthly signups chart showing 50% growth">

<!-- Decorative image -->
<img src="decoration.png" alt="">

<!-- Tracking pixels -->
<img height="1" width="1" style="display:none" src="..." alt="">
```

#### 6. External Links
Links opening in new tabs MUST indicate this to screen readers:

```html
<a href="https://example.com" target="_blank" rel="noopener noreferrer">
    External Link<span class="sr-only"> (opens in new tab)</span>
</a>
```

### Serious Requirements (Should Pass)

#### 7. Focus Visibility
Focus indicators MUST be visible. Minimum opacity for focus rings:
- Dark backgrounds: `focus:ring-white/40` (not /20 or lower)
- Light backgrounds: `focus:ring-black/30` (not /10 or lower)

```html
<!-- CORRECT - Visible focus ring -->
<input class="focus:outline-none focus:ring-2 focus:ring-white/40">

<!-- INCORRECT - Nearly invisible -->
<input class="focus:outline-none focus:ring-2 focus:ring-white/10">
```

#### 8. Color-Only Information
Don't convey information with color alone. Add text or icons:

```html
<!-- CORRECT - Text supplements color -->
<span class="w-1.5 h-1.5 rounded-full bg-green-500" aria-hidden="true"></span>
<span class="sr-only">Active:</span>
New ideas added regularly

<!-- INCORRECT - Color only -->
<span class="w-1.5 h-1.5 rounded-full bg-green-500"></span>
New ideas added regularly
```

### Utility Classes

Always include this CSS for screen-reader-only text:

```css
.sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border-width: 0;
}
```

(Tailwind includes this class by default)

---

## New Page / Component Checklist

When creating a new route, component, or MDX page, verify:

**Accessibility:**
- [ ] All icon-only buttons have `aria-label`
- [ ] All decorative icons have `aria-hidden`
- [ ] Logo elements have `role="img"` and `aria-label="Weekend MVP"`
- [ ] All form inputs have labels (visible or aria-label)
- [ ] All images have alt attributes
- [ ] External links have `rel="noopener noreferrer"` and sr-only text
- [ ] Focus rings use visible opacity (white/40+ or black/30+)
- [ ] Color-only indicators have supplementary text
- [ ] Heading hierarchy is logical (h1 > h2 > h3, no skipping)

**SEO/AEO** (mostly automatic — see the SEO & AEO section):
- [ ] `generateMetadata` sets title, description, canonical, and `og:image`/`twitter:image`
- [ ] JSON-LD emitted from the route (use the builders in `lib/seo.ts`)
- [ ] For MDX content: an entry exists in the relevant `manifest.json` and Convex has been seeded
- [ ] No manual `sitemap.xml` edit needed — `app/sitemap.ts` auto-discovers `content/**/*.mdx` and exported `*_SLUGS`

---

## Component Patterns

UI is built from React components in `components/` and route files in `app/` (Tailwind v4 + `lucide-react` + Radix primitives). Reuse existing components rather than hand-writing markup; mirror their accessibility wiring. Reference examples:

- **Icon-only button / copy button:** see `app/(marketing)/starter-kit/CopyPromptButton.tsx` (`aria-label` + `aria-hidden` icon).
- **Logo / nav / footer:** the shared App Router layouts (`app/**/layout.tsx`) — pages do not re-author nav, footer, or analytics.
- **External link with sr-only hint:** mirror the byline/external-link pattern in `app/articles/[slug]/page.tsx`.
- **Forms (email/subscribe):** `react-hook-form` + the Beehiiv API route — see the seat/subscribe forms under `app/(marketing)/`.

The accessibility attributes in the rules above are mandatory on every new component regardless of which pattern it follows.

---

## Beehiiv Integration

When implementing email subscriptions, follow `BEEHIIV_CURSOR_RULES.md`:

- Endpoint: `https://api.beehiiv.com/v2/publications/{publication_id}/subscriptions`
- Always include `form_id` and `automation_ids` in request body
- Use Vercel Edge runtime for speed
- Read response as text before parsing JSON

---

## SEO & AEO (Answer Engine Optimization)

**All pages must be optimized for both search engines (Google) and AI answer engines (ChatGPT, Perplexity, Claude).**

In the App Router, most SEO/AEO wiring is automatic. Do **not** hand-edit a sitemap or robots file, and do not maintain JSON-LD by hand on index pages.

### Sitemap & Robots (automatic)

- `app/sitemap.ts` generates the sitemap at build/request time. It auto-discovers `content/ideas/*.mdx`, `content/articles/*.mdx`, and `content/newsletter-pages/*.mdx`, and pulls programmatic hub slugs from the exported `*_SLUGS` (audiences, problems, collections). Adding an MDX file or a config-object entry is enough — there is no `sitemap.xml`.
  - One exception: `BUILD_WITH_SLUGS` is inlined in `app/sitemap.ts`, so a new `/build-with/{tool}` also needs its slug added to that array.
- `app/robots.ts` generates robots rules (AI crawlers allow-listed: GPTBot, ClaudeBot, PerplexityBot, etc.). There is no `robots.txt`.

### Metadata & JSON-LD (per route)

- Each route exports `generateMetadata` for title, description, canonical, and `og:image`/`twitter:image`. Idea/article OG images live at `/image/og/{idea|article}/{slug}.png`.
- JSON-LD is emitted from the route using the builders in `lib/seo.ts` (Article, SoftwareApplication, HowTo, BreadcrumbList, CollectionPage + ItemList). Index pages (`/startup-ideas`, `/articles`) generate their `ItemList` **dynamically** from Convex/MDX — never edit a static `ItemList` by hand.
- Idea pages parse the MDX `**How it works:**` numbered list into the `HowTo` schema, so keep that section format intact.

### Content visibility (no JS gate)

Pages are server-rendered, so content is visible to crawlers by default — there is **no** JavaScript email-gate to manage. Keep primary content in the server-rendered output (MDX body / RSC), not behind client-only state.

### Application Categories for Schema

| Idea Category | Schema applicationCategory |
|---------------|---------------------------|
| SaaS | BusinessApplication |
| Productivity | ProductivityApplication |
| Health | HealthApplication |
| Fintech | FinanceApplication |
| Education | EducationalApplication |
| Developer | DeveloperApplication |
| Creator | MultimediaApplication |
| E-commerce | ShoppingApplication |

### SEO/AEO Checklist for New Pages

- [ ] `generateMetadata` sets title, description, canonical, and `og:image`/`twitter:image`
- [ ] JSON-LD emitted via `lib/seo.ts` builders (dynamic ItemList on index pages — never hand-edited)
- [ ] Primary content is server-rendered (no client-only gate hiding it from crawlers)
- [ ] For MDX content: `manifest.json` entry added + `npm run seed:convex` run (so it appears in grids/hubs)
- [ ] Sitemap/robots untouched — they regenerate from `app/sitemap.ts` / `app/robots.ts`

---

## File Structure

```
weekendmvp/
├── app/                    # Next.js App Router (routes, layouts, metadata, sitemap.ts, robots.ts)
│   ├── ideas/[slug]/       # Idea page (MDX → render) + collection hubs
│   ├── articles/[slug]/    # Article page (MDX → render)
│   ├── startup-ideas/      # Ideas grid (Convex-driven)
│   ├── solve|build-with|ideas-for/  # Programmatic hubs (hardcoded TS config objects)
│   └── api/                # Route handlers (Beehiiv subscribe, Stripe webhook, revalidate, …)
├── content/                # MDX source — the body of each page
│   ├── ideas/*.mdx         # frontmatter: slug + title only (metadata lives in manifest/Convex)
│   ├── articles/*.mdx      # rich frontmatter (title, description, publishedAt, heroAlt, …)
│   └── newsletter-pages/*.mdx
├── ideas/manifest.json     # Idea metadata — SOURCE OF TRUTH (feeds Convex seed + OG)
├── articles/manifest.json  # Article metadata — feeds OG + Convex seed
├── ideas/SECTIONS.md       # The 7-section idea contract (manual gate for publish-idea)
├── convex/                 # Convex backend: schema, queries, seed functions
├── components/             # Shared React components (incl. hubs/hub-data.ts Convex fetchers)
├── lib/                    # mdx.tsx (MDX loader), seo.ts (JSON-LD), og/ (OG sources)
├── scripts/                # seed-convex.mjs, generate-og-cards.mjs, migration extractors
├── app/globals.css         # Global Tailwind v4 styles
└── CLAUDE.md               # This file
```

---

## Testing Accessibility

Before committing, verify accessibility with:

1. **Keyboard navigation**: Tab through all interactive elements
2. **Screen reader**: Test with VoiceOver (Mac) or NVDA (Windows)
3. **Focus visibility**: Ensure focus rings are clearly visible
4. **Axe DevTools**: Run browser extension for automated checks

---

## Quick Reference

| Element | Required Attribute |
|---------|-------------------|
| Icon-only button | `aria-label="..."` |
| Decorative icon | `aria-hidden="true"` |
| Logo div | `role="img" aria-label="Weekend MVP"` |
| Form input | `<label>` or `aria-label` |
| Image | `alt="..."` (empty for decorative) |
| External link | `rel="noopener noreferrer"` + sr-only text |
| Focus ring (dark bg) | `focus:ring-white/40` minimum |
| Focus ring (light bg) | `focus:ring-black/30` minimum |

## gstack

Use the `/browse` skill from gstack for all web browsing. Never use `mcp__claude-in-chrome__*` tools.

Available gstack skills:
- `/office-hours` - Office hours workflow
- `/plan-ceo-review` - CEO review planning
- `/plan-eng-review` - Engineering review planning
- `/plan-design-review` - Design review planning
- `/design-consultation` - Design consultation
- `/design-shotgun` - Design shotgun
- `/design-html` - Design to HTML
- `/review` - Code review
- `/ship` - Ship workflow
- `/land-and-deploy` - Land and deploy
- `/canary` - Canary deployment
- `/benchmark` - Benchmarking
- `/browse` - Web browsing (use this for ALL web browsing)
- `/connect-chrome` - Connect to Chrome
- `/qa` - QA testing
- `/qa-only` - QA only testing
- `/design-review` - Design review
- `/setup-browser-cookies` - Setup browser cookies
- `/setup-deploy` - Setup deployment
- `/retro` - Retrospective
- `/investigate` - Investigation
- `/document-release` - Document a release
- `/codex` - Codex workflow
- `/cso` - CSO workflow
- `/autoplan` - Auto planning
- `/careful` - Careful mode
- `/freeze` - Freeze deployments
- `/guard` - Guard mode
- `/unfreeze` - Unfreeze deployments
- `/gstack-upgrade` - Upgrade gstack
- `/learn` - Learn workflow

## Skill routing

When the user's request matches an available skill, ALWAYS invoke it using the Skill
tool as your FIRST action. Do NOT answer directly, do NOT use other tools first.
The skill has specialized workflows that produce better results than ad-hoc answers.

Key routing rules:
- Product ideas, "is this worth building", brainstorming → invoke office-hours
- Bugs, errors, "why is this broken", 500 errors → invoke investigate
- Ship, deploy, push, create PR → invoke ship
- QA, test the site, find bugs → invoke qa
- Code review, check my diff → invoke review
- Update docs after shipping → invoke document-release
- Weekly retro → invoke retro
- Design system, brand → invoke design-consultation
- Visual audit, design polish → invoke design-review
- Architecture review → invoke plan-eng-review
- Save progress, checkpoint, resume → invoke checkpoint
- Code quality, health check → invoke health

<!-- convex-ai-start -->

This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read
`convex/_generated/ai/guidelines.md` first** for important guidelines on
how to correctly use Convex APIs and patterns. The file contains rules that
override what you may have learned about Convex from training data.

Convex agent skills for common tasks can be installed by running
`npx convex ai-files install`.

<!-- convex-ai-end -->
