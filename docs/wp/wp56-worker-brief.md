# WP56 worker brief (shared by every S3–S5 worker)

You are restyling dark public pages of Weekend MVP onto the **research-desk** design language that the homepage already uses. The owner approved the visuals. This is a restyle: **change presentation, not substance.**

## Where

- **Worktree:** `/Users/jeberulz/Documents/AI-projects/weekendmvp/.worktrees/wp56-public-design`, branch `codex/wp56-public-design-unify`. Run every command from there. Never `cd` to the main checkout.
- **Approved mockups (read-only HTML, inline styles):** `/private/tmp/claude-501/-Users-jeberulz-Documents-AI-projects-weekendmvp/df037991-5760-4629-bd74-fb5d04d7f776/scratchpad/canvas/project/*.dc.html`. Translate their look into Tailwind using the `home-*` tokens. Don't copy inline styles.
- **Reference implementation (already done):**
  - `app/ideas/[slug]/collection.tsx` (collection hubs)
  - the kit in `components/public/*`
  - `components/home/ui.tsx` (Container, Eyebrow, Em, Label, CategoryTag, ButtonLink/buttonClass, TextLink, StepList, WeekendMeter, ScoreCell)
  - `components/home/client/CopyButton.tsx`
  - `components/home/tool-logos.tsx`

## The kit (use it; don't fork it)

- **`PublicShell`:** cream MegaNav, paper ground, `.theme-desk`, editorial serif variable, FooterCta band and warm-ink SiteFooter.
  - It renders `<main id="main">`, so **your page must not render its own `<main>`**.
  - `footerCta={false}` hides the closing band when the page ends on its own call.
- **`PageHeader`:** crumbs, eyebrow, title, description, meta, aside, children, size, align.
  - Also exports `Breadcrumbs` and `MetaLine`.
- **`LinkTabs`:** mono underline tabs.
- **`IdeaBrowser`** (client): Cards/Rows toggle plus list.
  - Also exports `IdeaList`, `ViewToggle` and `useIdeaView`.
  - Takes `PublicIdea[]`, built from Convex docs with `toPublicIdeas` in `lib/public/ideas.ts`.
- **`PublicIdeaCard`, `FeaturedIdeaCard`, `PublicIdeaRow`, `IdeaRowsHead`** (in `IdeaCards.tsx`).
- **`Section`, `SectionHeading`, `InkBand`** (`inset` for a rounded panel), **`FeaturedIdeas`, `KeepBrowsing`, `RuledFaq`** (in `Sections.tsx`).

If you truly need a kit change, **do not edit `components/public/*`**. Stop and report what you need and why.

## Tokens

| Use | Token |
|---|---|
| Paper | `bg-home-paper` |
| Card | `bg-home-card` |
| Sunk | `bg-home-sunk` |
| Hairline | `border-home-rule` |
| Ink | `text-home-ink` / `bg-home-ink` |
| Body | `text-home-ink-2` |
| Meta | `text-home-ink-3` (passes AA) |
| Small accent text | `text-home-orange-ink` |
| 24px+ accent and graphics only | `text-home-orange` |
| On ink: text | `text-home-d1/d2/d3` |
| On ink: rules | `border-home-dr` |
| On ink: accent | `text-home-orange-light` |
| Code/prompt panel | `bg-home-panel` + `border-home-panel-rule` |

**Type:**
- Headings: `font-editorial font-normal` (Newsreader), tracking ≥ −0.03em, `text-balance`.
- Body: Geist.
- Metadata, labels and breadcrumbs: `font-mono text-[11px] uppercase tracking-[0.08em]`.

**One italic orange phrase per heading** via `<Em>`. On ink, use `<Em dark>`.

## Hard rules

1. **SEO is frozen.**
   - Don't touch `generateMetadata`, JSON-LD builders/props, canonicals or `lib/seo.ts`.
   - Every existing internal link target must still be rendered as a crawlable `<a href>` (you may add links, never drop one).
   - The **H1 text must keep its existing words verbatim at the start**. You may append an italic tail: `{title} <Em>tail</Em>`, with a space between. Nothing else in the H1 changes.
   - Keep primary content server-rendered.
2. **No new marketing copy or claims.** Reuse the page's existing strings. Short new section headings and eyebrows are fine if they say what the section already is. Never invent numbers, testimonials or facts.
3. **Retire the dark look completely on your pages.**
   - Remove: `#050505`, `neutral-*`, `white/…`, rainbow hub-theme colours, `grid-lines`, glow blobs, `gradient-border-button`, flashlight, conic beam, icon-in-tinted-square headers, green-dot pills, `rounded-[3rem]`.
   - No side-stripe borders, gradient text, glass, or decorative grid backgrounds.
   - Cards top out at ~16px radius; pills are full radius.
4. **Code standards.** TypeScript strict, no `any`, no `console.log`, no inline `style` (data-driven widths only). Match the surrounding code's idiom.
5. **Accessibility is WCAG 2.1 AA.**
   - Visible `focus-visible` outlines (`outline-home-orange-ink` on paper, `outline-home-orange-light` on ink).
   - Real buttons and links, labelled inputs, a logical heading order, ≥44px touch targets, and `motion-reduce` on any transition.
   - External links keep their sr-only "(opens in a new tab)" hint where present.
6. **Motion:** CSS only (short hover/focus transitions, ease-out). No GSAP, no scroll scenes.
7. **Stay inside your file boundary** (in your assignment). Don't touch other workers' files, `components/public/*`, `components/home/**`, `components/platform/**`, the idea detail page (`app/ideas/[slug]/page.tsx`, `components/ideas/**`), the dashboard, or `app/globals.css`.
8. **Don't run `npm run build` or `next build`.** A shared dev server is running from this folder on :3456 and a build would break it. **Don't use the browser.** **Don't commit.** The orchestrator commits.

## Verify before you report

- `npx tsc --noEmit` and `npx eslint <your files>` must be clean.
- `curl -s http://localhost:3456/<your route>` returns 200 for each of your routes, with no leftover dark class names in the HTML for your sections (grep for `neutral-`, `#050505`, `bg-white/`).
- SEO check:
  - Run `node scripts/seo-snapshot.mjs capture --base http://localhost:3456 --out tmp/seo-<you>.json`.
  - Then run `node scripts/seo-snapshot.mjs diff tmp/seo-before.json tmp/seo-<you>.json`.
  - Only lines for **your** paths matter. Yours must be clean. Ignore other workers' paths.

**Report:**
- the files you changed
- the decisions you made
- anything you couldn't do and why
- the SEO diff result for your paths
