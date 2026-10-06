# Plan: one design language for the public site (dark pages → "research desk")

**Status:** Plan only. Not approved to build. Visual mockups awaiting sign-off: https://claude.ai/artifact/KdLeitLCx9CJn7vYJ91Ziw
**Date:** 2026-10-04
**Proposed lane:** Work Package (WP55). Many pages, but only one kind of change (restyle) and no data, auth or money is involved. It ships in waves ordered by risk, with a check after each wave.
**Skill used:** impeccable `audit` (brand register for the marketing surfaces), plus a live visual pass on www.weekendmvp.app at 1280px and 375px.

---

## 1. What you asked for, and how I read it

- Move the **dark-themed public pages** to the homepage's style: same palette, fonts and component grammar. The goal is for the site to feel like one product.
- Named priority: **Browse ideas** (category, by revenue, by build time), **Build with**, **Ideas for** and `/startup-ideas`.
- **Leave the individual idea page alone** (`/ideas/{idea-slug}`, the white/cream breakdown page). You said "I do want to change the structure of that". I read that as *don't*. **Please confirm.** The plan below does not touch it.
- **Starter kit is out of scope.** It's already light, and you asked to treat it separately.
- Motion is optional. I make a recommendation in §7.

---

## 2. Page inventory (what's dark today)

| Family | Routes | Count | Today | In scope |
|---|---|---|---|---|
| Homepage | `/` | 1 | Research desk (paper + warm ink) | **Reference only. Don't touch** |
| Dashboard (signed in) | `/dashboard/**` | — | Research desk (`.theme-desk`) | **Reference only. Don't touch** |
| Idea detail | `/ideas/{idea}` | 224 | Cream (`.theme-cream`, own IdeaNav) | **Don't touch** |
| Starter kit, Shipable, Dare | `/starter-kit`, `/shipable`, `/dare` | 3 | Cream | Out of scope |
| **Browse: collections** | `/ideas/{saas,ai-tools,…,1k-month,5k-month,passive-income,build-in-8-hours,build-in-weekend,build-in-1-week…}` | ~20 | Dark `#050505` (HubShell) | **Wave 1** |
| **Ideas for** | `/ideas-for/{developers,designers,non-technical,solo-founders,side-hustlers,weekend-builders}` | 6 | Dark | **Wave 2** |
| **Solve** | `/solve/{customer-support,lead-generation,…}` | ~7 | Dark | **Wave 2** |
| **Build with** | `/build-with/{cursor,claude,claude-code,windsurf,bolt,lovable,replit,v0,no-code}` | 9 | Dark | **Wave 2** |
| **Browse all** | `/startup-ideas` (search, chips, sort, email gate) | 1 | Dark + grid lines + glow | **Wave 3** |
| Articles | `/articles`, `/articles/{slug}` | many | Dark + grid lines | Wave 4 (needs your OK) |
| Newsletter | `/newsletter`, `/newsletter/{slug}` | many | Dark | Wave 4 (needs your OK) |
| About / founder | `/about`, `/john-iseghohi`, `/privacy-policy` | 3 | Dark | Wave 4 (needs your OK) |
| Auth | `/login`, `/signup`, `/email-signin` (AuthPageShell) | 3 | Dark | Wave 4 (needs your OK) |
| 404 | `not-found` | 1 | Dark + purple glow | Wave 4 (needs your OK) |
| Links | `/links` | 1 | Dark | Wave 4 (needs your OK) |
| Global chrome | `SiteFooter` (dark `#050505` **even on the homepage**), `MegaNav` (dark by default; cream only on 4 paths) | — | Mixed | Waves 1 and 4 |

**Main observation:** there are currently **three separate palettes** in production.
1. Neutral black: `#050505` and Tailwind `neutral-*`.
2. Cream: `#faf7f2` / `#fcfaf7` and `stone`, used on idea pages.
3. Research desk: `home-*` tokens, `#f7f3ec` paper with `#1a1814` warm ink, used on the homepage and dashboard.

Even the homepage ends on a neutral-black footer that doesn't match its own warm-ink sections. The fix is to make **research desk the only marketing palette** and retire palette 1.

---

## 3. Audit health score (the dark hub family as it stands)

| # | Dimension | Score | Key finding |
|---|---|---|---|
| 1 | Accessibility | 2/4 | Card body text (`neutral-500` on `#0A0A0A`, about 4.1:1) and meta text (`neutral-600`, about 2.6:1) fail WCAG AA on **every idea card on every hub** |
| 2 | Performance | 3/4 | Fixed full-screen grid overlay plus a fixed `blur-[120px]` glow with `mix-blend-screen` costs paint on every scroll. Cards run an infinite conic-gradient "beam" border on hover |
| 3 | Responsive | 3/4 | No horizontal scroll at 375px. Hero chips stack into three full-width pills; the hero is long before the first idea appears |
| 4 | Theming | 1/4 | Hard-coded hex and `neutral-*` values everywhere. A 14-colour rainbow category system (`hub-theme.ts`) runs parallel to the homepage's 5 category tints. shadcn `:root` tokens are dark-first |
| 5 | Anti-patterns | 1/4 | See the verdict below |
| **Total** | | **10/20** | **Acceptable. Needs significant work** |

### Anti-patterns verdict: fail

These pages look like a generic 2023 dark SaaS template, and nothing like the homepage. Specific tells:
- **Walls of identical cards.** 30 to 225 same-size dark cards with a badge, title and two lines of text. No hierarchy, nothing to scan by.
- **Decorative grid-line background** (`grid-lines` utility) on `/startup-ideas` and articles.
- **Blurred glow blobs** and a **rotating conic "beam" border** on card hover.
- **Icon in a rounded tinted square** next to every H1 and every "best for" item, in rainbow tints.
- **Green-dot pill chips** used as hero metadata.
- **Gradient-border buttons** and a **purple glow 404**.
- The type is Geist sans with medium weight throughout. None of the homepage's editorial serif voice, italic orange emphasis, or mono ledger metadata.

### Findings by severity

- **[P1] Card text fails contrast.** Location: `components/primitives/IdeaCard.tsx` (`BODY.dark`, `META.dark`), which every hub and `/startup-ideas` uses. Violates WCAG 1.4.3. The restyle fixes it for free: `home-ink-3` on `home-card` is about 5.6:1.
- **[P1] Breadcrumb text fails contrast.** Location: `HubBreadcrumb` (`neutral-500` on `#050505`, about 4.3:1). Fixed by the restyle.
- **[P1] Three competing palettes.** Location: `globals.css` `:root`, `.theme-cream`, `.theme-desk` and `@theme home-*`. This is the systemic cause of the problem.
- **[P2] Dark footer under light pages.** Location: `components/layout/SiteFooter.tsx:102`. This includes the homepage.
- **[P2] Nav theme is chosen by an allow-list of 4 paths.** Location: `components/layout/MarketingNav.tsx` (`CREAM_PATHS`). Every new light page means editing this list. It should be inverted.
- **[P2] Rainbow category colours disagree with the homepage.** SaaS is blue on hubs but sky-tinted on the homepage; AI Tools is violet on hubs and something else on the homepage. Location: `components/hubs/hub-theme.ts` vs `components/home/ui.tsx` `CATEGORY_TINT`.
- **[P2] Expensive decorative layers.** Location: `app/startup-ideas/layout.tsx`, `app/articles/layout.tsx` and the `.idea-card::before` beam in `globals.css`.
- **[P3] Collection counts.** `/ideas/build-in-weekend` says 225 ideas while the homepage says 224. That filter is effectively the whole library, and `/ideas/5k-month` (126) opens with the same first rows. This is a data/curation issue, not design, and is out of scope. Flagged for later.

### What's already working (keep it)

- Every hub is server-rendered, with proper JSON-LD, canonicals and breadcrumbs. The SEO base is solid.
- The `/startup-ideas` gate keeps idea content in the HTML for crawlers.
- The homepage already has a reusable primitive kit in `components/home/ui.tsx`: `Container`, `Eyebrow`, `Em`, `Label`, `CategoryTag`, `ButtonLink`/`buttonClass`, `TextLink`, `StepList`, `WeekendMeter` and `ScoreCell`. There's also `IndexList` (the ledger rows) and `IdeaArt`.
- `.theme-desk` already maps shadcn tokens onto the research-desk palette. Wrapping a page in it makes shadcn Buttons, inputs and badges light with no per-component work.
- `IdeaCard` already supports a `theme` prop (`dark` | `cream`), so adding a `desk` theme is cheap.

---

## 4. Design direction: the target

**Principle:** don't invent a fourth style. Reuse the homepage's grammar so a visitor moving from `/` to `/ideas/saas` to `/build-with/cursor` feels they never left.

### Token translation (dark → desk)

| Role | Dark today | Research desk |
|---|---|---|
| Page background | `bg-[#050505]` | `bg-home-paper` (#f7f3ec) |
| Card / raised surface | `bg-[#0A0A0A]`, `bg-white/5` | `bg-home-card` (#fffdf9) |
| Sunken / well | `bg-white/[0.03]` | `bg-home-sunk` (#efe8dc) |
| Hairlines | `border-white/5–10` | `border-home-rule` (#ddd4c4) |
| Primary text | `text-white` | `text-home-ink` (#1a1814) |
| Secondary text | `text-neutral-400` | `text-home-ink-2` (#4a453c) |
| Meta text | `text-neutral-500/600` | `text-home-ink-3` (#6b6457, passes AA) |
| Accent, small text | `orange-400` etc. | `text-home-orange-ink` (#a84a00, 5.2:1) |
| Accent, 24px+ and graphics | — | `text-home-orange` (#cc5500) |
| Emphasis band (one per page) | — | `bg-home-ink` with `home-d1/d2/d3` text, like the homepage Index section |
| Prompt / code panels | dark card | `bg-home-panel` (#24211c), the homepage's "paste into Cursor" panel |
| Category colour | 14-colour rainbow | Homepage `CategoryTag` tints (sage, ochre, sky, clay, note) |
| shadcn scope | `:root` (dark) | Wrap the page in `.theme-desk` |

### Typography

- **H1 / H2:** `font-editorial` (Newsreader), normal weight, tight but legal tracking (≥ −0.03em), `text-wrap: balance`. One italic orange `<Em>` phrase per H1, as on the homepage. For example: "SaaS ideas *you can ship this weekend.*" The *visible* H1 text and the metadata title stay as they are today (SEO). The `<Em>` only wraps part of the existing words.
- **Body:** Geist sans, the same as today.
- **Metadata, breadcrumbs, counts:** Geist mono, 11–12px, uppercase, 0.08em tracking, `home-ink-3`. This is the homepage "ledger" voice: `48 IDEAS · SORTED BY BUILDER CONFIDENCE · UPDATED WEEKLY`. It replaces the green-dot pills.
- **Font loading:** the hub shell gets `newsreaderEditorial.variable`. It's the same next/font file as the homepage, so it's self-hosted and cached across navigations. No new font payload.

### Page anatomy (hub template)

1. **Cream MegaNav.** It's already built.
2. **Header block** on paper: a mono breadcrumb, the editorial H1 with `<Em>`, a 1–2 line description (max 65ch), and the mono ledger meta line. **No icon-in-a-square.** The emoji/lucide icon box goes away.
3. **"Start here," 3 featured ideas.** Richer cards: `CategoryTag`, title, one-line hook, `WeekendMeter`, optional `IdeaArt` thumbnail. These match the dashboard's explore card, so public and signed-in views agree.
4. **The full list as ledger rows, not a card wall.** This reuses the homepage `IndexList` pattern: number, title, category, build time, opportunity. It's dense, scannable and clearly the homepage's own idiom, which fixes the "identical card grid" problem. On mobile it collapses to a stacked row. Every row stays a server-rendered `<a>` (SEO).
5. **One ink band** for the page's single editorial moment. Per family:
   - Ideas for: "Why developers are uniquely positioned".
   - Build with: the prompt panel ("Paste into Cursor", copy button).
   - Solve: "The problem" stats.
   - Collections: the email capture.

   This mirrors the homepage's paper/ink rhythm. It should be one band, not several.
6. **FAQ** as ruled rows (top border, editorial question, sans answer). Not boxed accordions in cards.
7. **Related hubs**: mono link list or tinted tags instead of icon tiles.
8. **Footer** in `home-ink`. This fixes the homepage too.

### Family-specific notes

- **Build with:** this is the biggest page (`app/build-with/[tool]/page.tsx`, 1,171 lines). Tool logos come from `components/home/tool-logos.tsx`, as in the homepage BuildWithAI section. The "What X is best for" five-icon-card row becomes a single ruled definition list. Prompt cards use the dark warm panel. That's the one place where dark is meaningful: it signals "this is code."
- **Ideas for:** the "Why X are uniquely positioned" three-up icon cards become the ink band with a numbered `StepList`, or a two-column prose block.
- **Solve:** the problem stats become large editorial numerals with mono labels. Avoid the hero-metric template: no gradient, no tiles, figures set in the paragraph's flow.
- **`/startup-ideas`:**
  - Filter chips become the homepage's mono underline-tab style (as in the homepage Index section).
  - Search becomes a ruled input in `theme-desk`.
  - Sort becomes a text toggle.
  - The results list becomes ledger rows. A cards/rows view switch is optional.
  - The email gate is restyled as a paper card with an ink CTA.
  - The **SSR-visible content contract is unchanged.**

---

## 5. Engineering approach

### Components (refactor in place; don't fork)

1. **`HubShell` → light shell.** It renders `MegaNav variant="cream"`, a `.theme-desk` wrapper, `bg-home-paper text-home-ink`, `newsreaderEditorial.variable`, and `SiteFooter`. It's used only by hubs, so the blast radius is contained. `HubBreadcrumb`, `HubHero`, `HubChip` and `HubCountChip` are rewritten to the new header anatomy (the props stay compatible, so each page's diff is small).
2. **`IdeaCard` gets `theme="desk"`.** `cream` stays exactly as is, because `RelatedIdeas` on the idea detail page uses it (don't touch). `dark` stays until the last caller has migrated, then it's deleted.
3. **New `IdeaLedger`** (server component) is generalised from `components/home/client/IndexList.tsx`. If IndexList is already generic enough, it's imported directly and **`components/home/**` isn't edited**. If a change is needed, it's additive only, and the homepage must be pixel-identical afterwards.
4. **`hub-theme.ts`:** category colours go through `CategoryTag` / `categoryTintClass` from `home/ui.tsx`. `COLOR_STYLES` is deleted once nothing uses it.
5. **`MarketingNav`:** `CREAM_PATHS` is inverted to a short `DARK_PATHS` list that shrinks to empty by Wave 4. Then the `dark` MegaNav variant is removed.
6. **`SiteFooter`:** `bg-home-ink` with `home-d*` text and `home-dr` rules. This changes the homepage footer colour slightly, from neutral black to warm ink. **It's the only intentional homepage change, and it's included because the homepage currently clashes with its own footer.** Easy to drop if you'd rather it didn't happen.
7. **Cleanup (Wave 5):**
   - Flip `:root` shadcn tokens and the `body` background to desk values.
   - Delete the `grid-lines`, `gradient-border-button`, `flashlight-*`, `.idea-card` beam and `beam-path` CSS once nothing references them. `MotionEffects.tsx`, `about`, `john-iseghohi`, `privacy-policy` and `not-found` still use some of these today.
   - Drop the legacy `@source` block if it's unused.

### Don't-touch list (enforced in review)

- `app/ideas/[slug]/page.tsx` and its idea-detail rendering, `IdeaPageNav`, `IdeaFooter`, `components/ideas/**`, the `.theme-cream` wrapper branch in `app/ideas/[slug]/layout.tsx`, the MDX content, and the `**How it works:**` HowTo parsing. The **only** change on that route is the collection-hub branch (`collection.tsx` plus `HubShell`).
- `app/(marketing)/page.tsx` and `components/home/**`: imports only. The single exception is item 6 above, the footer.
- `/starter-kit`, `/shipable`, `/dare` and `/dashboard/**`.
- SEO: `generateMetadata`, `lib/seo.ts` builders, canonicals, `app/sitemap.ts`, robots, H1 wording, internal link targets.

### SEO guardrail (automated)

Before Wave 1, snapshot every in-scope URL: title, meta description, canonical, every JSON-LD block, H1 text, and the count and targets of internal `<a href>` links. Do the same for **5 idea detail pages and the homepage**. After each wave, re-run the snapshot and diff it. The only accepted differences are class names and markup. Any change in the snapshotted fields blocks the wave. This is a small script in `scripts/` or a Playwright test.

### Release risk to resolve first

According to project memory, `use cache` pages can keep serving **stale HTML after a deploy**, and the `/api/revalidate` secret can't currently be retrieved. A restyle that half-appears (some hubs new, some old) would look broken. **Before shipping Wave 1:** rotate and store the revalidate secret, or confirm a fresh deploy busts the hub caches.

---

## 6. Waves (ordered by risk; one PR each, checked after each)

| Wave | Scope | Why this order | Size |
|---|---|---|---|
| **0. Foundation** | SEO snapshot script plus baseline screenshots (desktop and mobile) of every in-scope route, the homepage and 5 idea pages. `IdeaCard` `desk` theme. Light `HubShell` built but not yet adopted. `MarketingNav` inversion. Resolve the cache/revalidate risk. | No visible change. Builds the safety net | S |
| **1. Browse collections** | `/ideas/{collection}` (~20 pages, one file: `collection.tsx`). Shared hub components. Footer to warm ink. | Your top ask. One file drives about 20 pages, so it proves the template cheaply. It's on a shared route with idea detail, so it's checked first while the change is small | M |
| **2. Ideas for, Solve, Build with** | 6 + ~7 + 9 pages. Prompt panels, tool logos, "why" ink band | Same template, more bespoke sections. Build with is the largest file | L |
| **3. `/startup-ideas`** | Explorer, chips, search, sort, gate | Interactive client state plus the gate's SEO contract. Highest behavioural risk, so it goes after the template is proven | M |
| **4. Remaining dark pages** *(only with your OK)* | Articles (index and detail prose), newsletter (index and detail), about, founder page, privacy, 404, login/signup/email-signin, links | Not in your original list, but needed for "one product." Auth pages could adopt the dashboard look you already like | L |
| **5. Cleanup** | Flip global tokens and body background. Delete dead dark utilities, the `IdeaCard` dark theme, `hub-theme` colours and the dark MegaNav variant | Only safe once nothing dark remains | S |

**Every wave must pass before merge:**
- `npm run typecheck` and `npm run build`.
- The SEO snapshot diff is clean.
- The `a11y-check` skill on the changed UI.
- The impeccable detector on the changed files.
- Screenshots at 1280 and 375 compared against the baseline.
- Idea detail screenshots unchanged.
- One Lighthouse run per family: LCP and CLS no worse than the baseline.
- Story and progress files kept in `docs/wp/wp55-*`.

---

## 7. Motion: recommendation

**Don't bring GSAP to these pages.** The homepage loads GSAP, ScrollTrigger and SplitText after idle for its scroll scenes. That's right for a one-off storytelling page, but wrong for SEO entry pages:
- Hubs are mostly landed on from Google, where LCP and INP matter.
- They're long lists, where scroll choreography gets in the way of scanning.
- About 60–70 KB of extra JavaScript per page buys nothing for list pages.

**Do (CSS only, zero JS):**
- **Header entrance:** reuse the homepage's `home-rise` keyframe on the breadcrumb, H1 and meta line, as a short stagger. Use **transform only, no opacity fade, on the H1**: an element that starts at `opacity: 0` delays LCP in Chrome. The `/shipable` reveal already made this "transform-only" choice for the same reason.
- **Rows and cards:** hover and focus get a 150–200ms ease-out-quart background tint and a 2px arrow nudge. Replace the rotating conic beam.
- **`/startup-ideas` filtering:** a 150ms crossfade on the results list when a chip changes, optionally through the View Transitions API.
- Everything inside `prefers-reduced-motion: no-preference`. Content is always visible by default and never gated on a reveal class.

**Kill:** the infinite beam rotation, the flashlight effect, the fixed glow blob, the grid overlay and the blinking search cursor.

The pages should feel like the homepage at rest: same paper, type and rhythm. Saving the theatre for `/` is what keeps the homepage special.

---

## 8. Decisions (John, 2026-10-04)

1. **Idea detail page:** untouched. Confirmed.
2. **Wave 4 is in scope:** articles, newsletter, about, founder page, privacy, 404, login/signup/email-signin and links all move to research desk.
3. **Homepage footer:** changes to warm ink. Approved.
4. **Idea lists:** dashboard-style cards by default, with a **Cards / Rows toggle** on every list (collections, ideas-for, build-with, solve, `/startup-ideas`).
   - The choice is remembered per visitor and reflected in the URL (`?view=rows`).
   - The server renders cards by default; both views are plain links.
   - Rows use the homepage index grammar on paper.
5. **H1s:** the existing keyword phrase stays verbatim at the start, with an italic orange tail appended. For example, "SaaS Startup Ideas *you can ship by Sunday.*" Metadata titles are unchanged. The SEO snapshot treats "H1 starts with the old text" as passing.
6. **Gate:** no build agents run until John approves the final visuals on the canvas.
