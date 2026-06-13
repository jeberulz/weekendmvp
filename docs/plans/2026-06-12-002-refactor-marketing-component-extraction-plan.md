---
title: "refactor: Extract reusable section library + theme/accent variant system from marketing pages"
type: refactor
status: active
date: 2026-06-12
---

# refactor: Extract reusable section library + theme/accent variant system from marketing pages

## Summary

Break the four large marketing page files (`(marketing)/page.tsx` 1,157 LOC, `shipable/page.tsx` 1,175, `dare/page.tsx` 1,155, `starter-kit/page.tsx` 747) plus `NotFoundContent.tsx` (452) into a composable section library under `components/marketing/sections/`, governed by a small `theme + accent` variant token map mirroring the existing `components/hubs/hub-theme.ts`. Eliminate 13 hand-rolled inline JSON-LD `@graph` blocks with `lib/seo.ts` helpers. Replace idea-card markup duplicated across `HubIdeasGrid`, `RelatedIdeas`, `IdeasExplorer`, and the homepage Featured Ideas with one `<IdeaCard variant>` primitive. Collapse `Interactions` + `ScrollReveal` into one motion-effects module. Extract `<HubRelatedTiles>` from the four hub families. Wire `SignupCta`/`SignupModal` onto real surfaces (homepage final CTA, 404, mega-nav CTA) so the modal pattern stops being dead code. Target: ~67% LOC reduction across marketing pages (~4,684 → ~1,500), pixel parity preserved, zero behavior changes.

---

## Requirements

- R1. Pixel parity: every visible pixel, color, hover state, animation, and copy string in the refactored pages matches the current rendered output. Visual diff bar = 0 meaningful differences.
- R2. JSON-LD output across all 13 pages remains byte-equivalent (or strictly improved — same `@graph` members, same field values). Crawler-visible structured data must not regress.
- R3. Section components take a `theme: "dark" | "cream" | "ink-blue"` prop and an `accent: <token>` prop drawn from a shared token map. Switching theme/accent on any section MUST produce a coherent visual variant (text contrast, border colors, focus ring, icon tinting all adapt). The token map lives in `components/marketing/section-theme.ts` mirroring the structure of `components/hubs/hub-theme.ts`.
- R4. `<IdeaCard>` supports at minimum `variant: "default" | "compact" | "featured"` covering every current use site (HubIdeasGrid grid card, RelatedIdeas grid, IdeasExplorer filter grid, homepage Featured Ideas row).
- R5. `lib/seo.ts` exports composable schema builders (`personSchema`, `websiteSchema`, `breadcrumbSchema(items)`, `articleSchema(...)`, `collectionPageSchema(...)`, `howToSchema(...)`, `softwareApplicationSchema(...)`, `faqPageSchema(...)`, `buildGraph(...)`) and is imported by every page currently inlining JSON-LD. The 13 inline `@graph` objects are deleted from page files.
- R6. `(marketing)/page.tsx` ≤ 350 LOC after refactor. `shipable/page.tsx` and `dare/page.tsx` ≤ 350 each. `starter-kit/page.tsx` ≤ 350. Each page is primarily composition: a list of `<Section name={...} {...props} />` calls. `NotFoundContent.tsx` ≤ 200.
- R7. shipable + dare share at least 5 section components (Hero, ProblemFrame/ValueStack, Ticket, FAQ, FinalCta or equivalents) — proves the variant system carries the workshop family.
- R8. No new Tailwind utility classes introduced. No copy edits. No new product features. All `aria-*` attributes, focus rings, and CLAUDE.md a11y conventions preserved or strengthened.
- R9. `npm run build` succeeds; `npx tsc --noEmit` clean. Every route's response HTML (curl, no JS) contains the same `<h1>`, key copy, JSON-LD count, and meta tags as before refactor (verified via a quick snapshot script under `scripts/verify-prerender-parity.mjs`).
- R10. `SignupCta` import count rises from 1 → ≥3 (homepage final CTA, 404 signup card, mega-nav CTA button — at minimum). `SignupModal` reachable from real user flows.

---

## Scope Boundaries

- No copy changes. No new product features. No new pages.
- No visual redesign. No new color palette. No typography changes.
- No Tailwind v4 utility renames or class drift.
- No changes to API routes, Convex schema, MDX pipeline, or any data layer.
- No changes to hub pages' visible structure — they only swap inline idea-card markup for `<IdeaCard>` and inline `@graph` for `lib/seo.ts` helpers.
- No new test framework adoption. No Playwright/Cypress/Storybook setup (out of session scope).

### Deferred to Follow-Up Work

- **Visual regression suite** (Playwright + screenshot diffing). Manual visual review + the parity script (R9) gate this refactor; an automated suite is a follow-up PR.
- **Section component documentation site** (Storybook or MDX gallery): nice-to-have for future expansion but not required to ship.
- **Refactor of `IdeasExplorer.tsx`'s internal filter logic**: scope is just swapping its inline card markup for `<IdeaCard>` — the filter state machine stays as-is.

---

## Context & Research

### Relevant Code and Patterns

- `components/hubs/hub-theme.ts` — existing `COLOR_STYLES` token map (text/bg10/bg20/border per accent). This is the pattern to mirror for `components/marketing/section-theme.ts`. The hub system already proves the approach works on 32 hub pages.
- `components/hubs/HubShell.tsx` — `HubHero` already has a `variant` prop (`"default" | "tool"`) and accepts `iconBoxClassName` for accent tinting. Section components mirror this shape.
- `components/primitives/{IconButton,Logo,NavExternalLink,JsonLd}.tsx` — typed a11y primitives we keep and import into new sections.
- `app/(marketing)/page.tsx`, `shipable/page.tsx`, `dare/page.tsx`, `starter-kit/page.tsx` — the four page files being refactored (and inline JSON-LD source for U7).
- `components/hubs/HubIdeasGrid.tsx` — current idea-card markup. The `<IdeaCard variant="default">` extraction starts from this shape; the `featured` and `compact` variants derive from the homepage Featured Ideas row and IdeasExplorer respectively.
- `app/articles/[slug]/page.tsx`, `app/newsletter/[slug]/page.tsx`, `app/ideas/[slug]/page.tsx`, `app/ideas-for/[audience]/page.tsx`, `app/build-with/[tool]/page.tsx`, `app/solve/[problem]/page.tsx`, `app/ideas/[slug]/collection.tsx`, `app/startup-ideas/page.tsx` — 8 of the 13 pages whose inline JSON-LD `@graph` blocks `lib/seo.ts` will replace (`grep -rn "@graph" app/` finds the rest).
- `components/marketing/Interactions.tsx` (landing) + `components/marketing/ScrollReveal.tsx` (shipable/dare) — the two parallel motion helpers to collapse.

### Institutional Learnings

- `CLAUDE.md` accessibility rules are encoded in `IconButton`, `Logo`, `NavExternalLink` wrappers; sections must consume those primitives, not inline raw buttons.
- The hub-theme pattern from U11 (32 hub pages on 4 different surfaces all composing `HubShell` + `HubHero` + `HubIdeasGrid` + `HubCta`) is the proof point that the variant system scales — replicate, don't reinvent.

---

## Key Technical Decisions

- **Section components are server components by default**, marked `"use client"` only when interactivity demands it (e.g., a `Hero` with an inline form embedding `<BeehiivSubscribeForm>` stays server-rendered with a small client island for the form). This preserves Cache Components prerender behavior — no Date.now()/Math.random() in render bodies.
- **Theme/accent props vs context provider**: explicit props per section, not a React context. Reasons: (a) sections are server components and props compose cleanly with `"use cache"`; (b) one page can mix themes (a cream Hero above a dark testimonial band) without nested providers; (c) mirrors the working `hub-theme.ts` pattern.
- **Token map shape**: `section-theme.ts` exports `ACCENT_TOKENS: Record<Accent, {text, bg5, bg10, bg20, border, ring, gradientFrom, gradientTo}>` and `THEME_TOKENS: Record<Theme, {pageBg, surface, surfaceMuted, textPrimary, textSecondary, textMuted, divider}>`. Sections derive classNames by reading both. Background-color and text-color classes are computed at render, not template-string-interpolated, so Tailwind purge sees every utility statically (we list each value in a comment block at the top of `section-theme.ts` to keep Tailwind's source scan happy).
- **`lib/seo.ts` returns plain objects**, not React nodes. Pages still wrap them in `<JsonLd schema={buildGraph(...)} />`. This keeps `JsonLd` a single render path and lets `seo.ts` be unit-testable as pure functions.
- **`<IdeaCard>` is a primitive (`components/primitives/IdeaCard.tsx`), not a hub component.** Reason: every surface uses it (homepage marketing + hubs + filter + related ideas), so it lives with the other shared primitives rather than under one feature folder.
- **`SignupModal` keeps its typed automation-ID union** so wiring it to new surfaces can't accidentally enroll users in disallowed Beehiiv automations.
- **Motion helpers**: collapse `Interactions` and `ScrollReveal` into `components/marketing/MotionEffects.tsx` accepting an `effects: Array<"reveal" | "flashlight" | "smooth-anchor" | "section-view" | "scroll-depth">` prop. Default = `["reveal", "smooth-anchor"]`. Pages opt in to the heavier observers (`flashlight`, `section-view`, `scroll-depth`) only when they need them. Reduces duplicate observer logic and lets each page pay only for what it uses.
- **Parity script over visual regression suite this session**: `scripts/verify-prerender-parity.mjs` records pre-refactor curl output of each route into `tmp/pre-refactor-snapshots/` then re-curls post-refactor and diffs `<title>`, JSON-LD object count + member types, h1 text, canonical, OG image URL, and rendered word count. Catches structural regressions cheaply; pixel diff is manual via Vercel preview URLs.

---

## Open Questions

### Resolved During Planning

- **Token map: monolithic or per-component?** Monolithic — one `section-theme.ts` file. Adding a new accent or theme should be one edit, not N edits across sections.
- **Should `<IdeaCard>` own the `idea-card` Tailwind class (with the conic-gradient hover beam) or just compose it?** Compose it via className — keeps the CSS in `globals.css` where it already lives, no animation regression risk.
- **What pages get the SignupCta/SignupModal wiring?** Homepage final CTA, 404 signup card, MegaNav primary CTA button — these are real conversion paths today. Idea pages stay with `EmailGate` (different UX). Articles/newsletter stay with `BeehiivSubscribeForm` inline (different conversion intent).

### Deferred to Implementation

- **Exact section component list and prop shapes**: I'm proposing 12 in U3, but implementation may discover that two collapse to one (e.g., `BentoGrid` + `FeatureGrid` if their internal cards are similar enough). Discover-and-merge during U3.
- **Whether `Countdown` and `AuraBackground` count as "sections"**: they're effects/decorations layered into Hero/Ticket variants. Implementation decides whether to fold them into a section's props or keep them as standalone composables.
- **shipable/dare exact section overlap**: minimum 5 shared per R7, but actual count may be 7-8 once the implementation looks at the full diff between the two pages.

---

## Output Structure

    components/
    ├── marketing/
    │   ├── section-theme.ts            # NEW — ACCENT_TOKENS + THEME_TOKENS maps
    │   ├── MotionEffects.tsx           # NEW — replaces Interactions.tsx + ScrollReveal.tsx
    │   └── sections/                   # NEW
    │       ├── SectionHeading.tsx      # eyebrow + h2 + lede primitive (used inside other sections)
    │       ├── Hero.tsx                # variants: dark|cream|ink-blue, with form-slot
    │       ├── BentoGrid.tsx           # 3-card flagship row
    │       ├── FeatureGrid.tsx         # N-card grid w/ icon + title + body
    │       ├── ProcessSteps.tsx        # numbered step row
    │       ├── ValueStack.tsx          # shipable's 6-item what-you-get-paid
    │       ├── Ticket.tsx              # workshop seat-price card
    │       ├── Stats.tsx               # three-stat band
    │       ├── ProblemFrame.tsx        # solve/* problem block (generalized)
    │       ├── FaqAccordion.tsx        # Q&A grid OR shadcn accordion variant
    │       ├── FinalCta.tsx            # banded CTA w/ heading + button + body
    │       ├── CategoryGrid.tsx        # browse-by-category tile grid
    │       └── ToolGrid.tsx            # build-with-tools tile grid
    ├── primitives/
    │   └── IdeaCard.tsx                # NEW — variants: default|compact|featured
    └── hubs/
        └── HubRelatedTiles.tsx         # NEW — extracted from 4 inline duplications
    lib/
    └── seo.ts                          # NEW — JSON-LD schema builders
    scripts/
    └── verify-prerender-parity.mjs     # NEW — pre/post-refactor snapshot diff

---

## Implementation Units

- U1. **`lib/seo.ts` — JSON-LD schema builders**

**Goal:** Replace 13 inline `@graph` blocks with composable helper functions.

**Requirements:** R2, R5

**Dependencies:** None.

**Files:**
- Create: `lib/seo.ts`
- Test: `tests/lib/seo.test.ts` (Node test runner)

**Approach:**
- Exports: `personSchema()`, `websiteSchema()`, `breadcrumbSchema(items: {label, href?}[])`, `articleSchema({title, description, datePublished, slug, image?, author?})`, `collectionPageSchema({title, description, slug, items?})`, `howToSchema({name, description, steps: {name, text}[]})`, `softwareApplicationSchema({name, applicationCategory, description, totalTime?})`, `faqPageSchema(qa: {question, answer}[])`, `buildGraph(...schemas)`.
- `personSchema`/`websiteSchema` are singletons returning the canonical Person (John Iseghohi, cal.com/switchtoux) and WebSite blocks already used identically across every page.
- `buildGraph` wraps an array in `{"@context": "https://schema.org", "@graph": [...]}`.
- All helpers are pure functions, framework-agnostic.

**Patterns to follow:**
- Current inline JSON-LD in `app/articles/[slug]/page.tsx` (canonical Person/Article shape) and `app/ideas/[slug]/page.tsx` (5-schema graph).

**Test scenarios:**
- Happy path: `buildGraph(personSchema(), articleSchema({title:'X', description:'D', datePublished:1700000000000, slug:'x'}))` returns the same shape as the current hand-rolled article-page JSON-LD (snapshot equality).
- Happy path: `howToSchema({name:'X', description:'D', steps:[{name:'A',text:'A1'},{name:'B',text:'B1'}]})` yields position-numbered HowToStep array.
- Edge case: `breadcrumbSchema([{label:'Home', href:'/'}, {label:'Current'}])` correctly omits `item` on the trailing entry per schema.org BreadcrumbList convention.
- Edge case: `collectionPageSchema({...items: []})` omits the `mainEntity` field rather than emitting `mainEntity: null`.

**Verification:**
- For each of the 13 pages currently inlining JSON-LD, generating the schema via `lib/seo.ts` produces an object structurally identical to the inline version (`JSON.stringify` deep-equality on a representative sample).

---

- U2. **`<IdeaCard variant>` primitive**

**Goal:** Replace idea-card markup duplicated in 4 surfaces with one composable component.

**Requirements:** R4, R8

**Dependencies:** None.

**Files:**
- Create: `components/primitives/IdeaCard.tsx`
- Test: `tests/primitives/IdeaCard.test.tsx` (RTL + tsx render snapshot)

**Approach:**
- Props: `{idea: IdeaCardData; variant?: "default" | "compact" | "featured"; href?: string; className?: string}`.
- `IdeaCardData` is a narrow projection of the Convex `ideas` Doc — exactly the fields cards need (`slug`, `title`, `description`, `category`, `buildTime?`, `revenueGoal?`, `scores?`, `summary?`). Pages map their data shape into this projection at the call site.
- Variants:
  - `default`: full card with `.idea-card` hover beam, category badge, meta chips, build-time, score pill. Matches current `HubIdeasGrid` and `RelatedIdeas`.
  - `compact`: tighter padding, no meta chips, used in dense IdeasExplorer grids.
  - `featured`: larger hero variant for homepage Featured Ideas section, optional accent border.
- `href` defaults to `/ideas/${slug}`.
- All `idea-card` / `idea-badge` / `.idea-title` Tailwind classes from `app/globals.css` reused verbatim (no CSS change).

**Patterns to follow:**
- `components/hubs/HubIdeasGrid.tsx` for the default variant's markup.
- `components/primitives/IconButton.tsx` for the typed-props + cn() pattern.

**Test scenarios:**
- Happy path: `<IdeaCard idea={{slug:'x', title:'T', description:'D', category:'saas'}} />` renders a link to `/ideas/x` with title, description, category badge.
- Happy path: each variant produces the expected class set; snapshot per variant.
- Edge case: idea with no `scores` omits the score pill (default + featured variants).
- Edge case: `compact` variant has no meta chips even when scores/buildTime are present.

**Verification:**
- After U8 rolls out, `grep -rn "idea-card" components app` shows only `components/primitives/IdeaCard.tsx` + CSS class references in `app/globals.css`. No other component emits idea-card markup inline.

---

- U3. **Marketing section library + theme/accent variant system**

**Goal:** Build the 12 section components and the token map that drives variant switching.

**Requirements:** R3, R6, R7, R8

**Dependencies:** None.

**Files:**
- Create: `components/marketing/section-theme.ts`, plus the 12 files under `components/marketing/sections/` listed in the Output Structure tree above.
- Test: `tests/marketing/section-theme.test.ts` (token map shape contract)

**Approach:**
- `section-theme.ts` defines `Theme = "dark" | "cream" | "ink-blue"` and `Accent` as the union of every accent already in the codebase (`orange`, `emerald`, `blue`, `purple`, `amber`, `rose`, `lavender`, `mint`, `aubergine`). `ACCENT_TOKENS[accent]` returns `{text, bg5, bg10, bg20, border, ring, gradientFrom, gradientTo}` Tailwind class strings. `THEME_TOKENS[theme]` returns `{pageBg, surface, surfaceMuted, textPrimary, textSecondary, textMuted, divider, focusRing}`.
- Top of `section-theme.ts` includes a JSDoc block with every Tailwind class value listed plainly (`bg-emerald-500/10`, `text-orange-400`, `border-white/10` …) so Tailwind's source scan picks them up — defensive belt against template-string drift.
- Each section component is a server component with prop shape `{theme?, accent?, ...content}` and reads tokens from the map. Defaults: `theme="dark"`, `accent="orange"` (matches the homepage today).
- `Hero` accepts a `formSlot?: React.ReactNode` so any page can drop in `<BeehiivSubscribeForm>`, `<SignupCta>`, or `<ShipableCheckoutForm>` without a Hero variant explosion.
- `Ticket` accepts `{price, currency, perks: string[], ctaSlot, deadline?}` — works for both shipable ($9) and dare ($29).
- `ProcessSteps` accepts `{steps: {title, body}[]; numbered?: boolean}` — homepage uses numbered, starter-kit doesn't.
- `FaqAccordion` accepts `{items: {q, a}[]; variant?: "grid" | "accordion"}` — homepage uses static grid (legacy), other pages can pick accordion.
- `MotionEffects` (separate file but listed here because it pairs with sections): props `{effects?: Array<"reveal" | "flashlight" | "smooth-anchor" | "section-view" | "scroll-depth">; trackedSections?: string[]}`. Combines the current `Interactions.tsx` + `ScrollReveal.tsx` observer logic into one IntersectionObserver chain that subscribes to only the requested effects.

**Patterns to follow:**
- `components/hubs/hub-theme.ts` — token map pattern (proof point).
- `components/hubs/HubHero.tsx` — variant prop + iconBoxClassName accent injection.
- `components/marketing/Countdown.tsx` — hydration-safe SSR (effect-driven state, stable initial render).

**Test scenarios:**
- Happy path: `ACCENT_TOKENS.orange.text === "text-orange-400"` (or whatever the legacy class is); each accent has all 8 keys defined.
- Happy path: rendering `<Hero theme="dark" accent="orange" eyebrow="X" title="T" sub="S" />` produces a dark-page hero with orange accent classes; switching theme to "cream" produces cream-themed identical-structure output.
- Edge case: `<Hero>` with no `formSlot` renders without a form container (no empty wrapper).
- Integration: `<MotionEffects effects={["reveal","flashlight"]} />` mounts both observers; effects not in the array don't register listeners (verified by spy on `addEventListener`).

**Verification:**
- 12 section components exist under `components/marketing/sections/`, all type-check, all have `theme` and `accent` props (where applicable).
- Storybook-free smoke: a throwaway demo page composing every section with each theme variant renders without errors at `next dev`.

---

- U4. **Refactor `(marketing)/page.tsx` (homepage) to compose sections**

**Goal:** Cut the homepage from 1,157 LOC to ≤350 by replacing inline section JSX with composition.

**Requirements:** R1, R6, R8, R9, R10

**Dependencies:** U1, U2, U3.

**Files:**
- Modify: `app/(marketing)/page.tsx`

**Approach:**
- Read each `<section>` in the current file, identify the matching section component, replace with `<Hero theme="dark" accent="orange" eyebrow="..." title="..." sub="..." formSlot={<BeehiivSubscribeForm .../>} />` style composition.
- Featured Ideas section uses `<IdeaCard variant="featured" idea={...} />` per card.
- Final CTA section uses `<SignupCta>` wrapping `<FinalCta>` so the modal opens (R10).
- JSON-LD becomes `<JsonLd schema={buildGraph(personSchema(), websiteSchema(), softwareApplicationSchema({...}), faqPageSchema(faqs))} />` from `lib/seo.ts` (R2).
- `<PageInteractions trackedSections={...}>` becomes `<MotionEffects effects={["reveal","flashlight","smooth-anchor","section-view","scroll-depth"]} trackedSections={...} />` from U3.
- Static FAQ data hoisted to a top-of-file `const FAQS = [...]`.
- Static category and tool tile data hoisted to top-of-file consts.
- All copy preserved verbatim.

**Execution note:** Run `node scripts/verify-prerender-parity.mjs --record / --before` (snapshots `/`) before any edit. After refactor, run `node scripts/verify-prerender-parity.mjs --diff /` and fix any structural diffs before committing.

**Patterns to follow:**
- The current `app/(marketing)/page.tsx` itself as the source of truth for every section's content.

**Test scenarios:**
- Happy path: GET `/` returns 200; raw HTML contains the same h1, eyebrow, all 6 what-you-get titles, all 6 FAQ questions, copyright as before refactor.
- Happy path: `<SignupCta>` final CTA opens the modal on click (manual smoke in `next dev`).
- Edge case: parity script reports 0 diffs on title, h1, canonical, OG image, JSON-LD `@graph` member count.
- Integration: `MotionEffects` flashlight effect tracks mouse on hero (manual).

**Verification:**
- `wc -l app/(marketing)/page.tsx` ≤ 350.
- `npm run build` succeeds.
- Parity script reports 0 structural diffs.

---

- U5. **Refactor `shipable/page.tsx` + `dare/page.tsx` to share sections**

**Goal:** Prove the variant system carries the workshop family. Each page ≤350 LOC; minimum 5 shared sections.

**Requirements:** R1, R6, R7, R8, R9

**Dependencies:** U1, U3.

**Files:**
- Modify: `app/(marketing)/shipable/page.tsx`, `app/(marketing)/dare/page.tsx`
- Modify (likely): `app/(marketing)/shipable/ShipableCheckoutForm.tsx`, `app/(marketing)/shipable/ShipableSeat.tsx`, `app/(marketing)/dare/DareSeatForm.tsx` — keep as-is, just imported into the `formSlot`/`ctaSlot` of the section components.

**Approach:**
- Both pages compose: `<Hero theme="cream" accent="orange|ink-blue" />`, `<Stats />`, `<ProblemFrame />`, `<ValueStack />`, `<Ticket formSlot={<ShipableCheckoutForm.../>} />`, `<FaqAccordion />`, `<FinalCta />`, optional `<StickyBar />` (or fold into Ticket).
- shipable uses `accent="orange"` (legacy); dare uses `accent="ink-blue"` (new accent token added to map in U3 if not already present — `ink-blue: {text: "text-blue-700", bg10: "bg-blue-700/10", …}` matching #1D4ED8/#1E40AF/#A7C0F2).
- shipable's Stripe redirect flow stays in `ShipableCheckoutForm` (slotted into Ticket). dare's waitlist-only flow stays in `DareSeatForm`.
- Countdown stays as-is and is passed to Ticket via a `countdownSlot` prop.
- JSON-LD via `lib/seo.ts`: `personSchema()` + `websiteSchema()` + Event schema (currently inline — add `eventSchema(...)` to `lib/seo.ts` if convenient, or hand-construct since it's only used twice).
- All copy verbatim.

**Patterns to follow:**
- Current `shipable/page.tsx` and `dare/page.tsx` content.

**Test scenarios:**
- Happy path: GET `/shipable` and `/dare` both 200; pixel parity vs pre-refactor via Vercel preview comparison (manual).
- Happy path: form submit on `/shipable` still POSTs to `/api/subscribe` then redirects to Stripe Payment Link (manual smoke).
- Edge case: countdown ticks correctly post-refactor; `[[WORKSHOP_DATE_ISO]]` placeholder on dare stays at "00 d 00 h 00 m 00 s" pre-resolution.
- Edge case: dare's `noindex,nofollow` meta tag preserved.
- Integration: parity script reports 0 structural diffs on both routes.

**Verification:**
- Both files ≤350 LOC.
- ≥5 section components shared between the two files (`grep -l` confirms shared imports).
- `npm run build` green.

---

- U6. **Refactor `starter-kit/page.tsx` + `NotFoundContent.tsx`**

**Goal:** Apply the section library to the remaining big page files.

**Requirements:** R1, R6, R8, R9, R10

**Dependencies:** U1, U2, U3.

**Files:**
- Modify: `app/(marketing)/starter-kit/page.tsx`, `app/NotFoundContent.tsx`

**Approach:**
- starter-kit composes `<Hero theme="cream" />`, `<ProcessSteps numbered={false} />`, `<FeatureGrid />` (the 10 idea cards row could be `<IdeasExplorer variant="static" ideas={CURATED} />` or just `<FeatureGrid>` with idea-shape items), `<FinalCta />`. Keep `StarterKitShell` (sticky subnav + scroll-spy) as-is — it's already a focused component.
- NotFoundContent composes `<Hero theme="dark" accent="amber" eyebrow="Error 404" />`, `<HubRelatedTiles items={recommendations} />`, `<FinalCta formSlot={<BeehiivSubscribeForm utmCampaign="404-page" successHref={null} />} />`, `<SignupCta />` (R10 wiring).
- JSON-LD via `lib/seo.ts`.

**Patterns to follow:**
- Current `starter-kit/page.tsx` (sticky subnav stays, just section content refactored).
- Current `NotFoundContent.tsx` (recommendation derivation logic stays in the client component).

**Test scenarios:**
- Happy path: `/starter-kit` renders all 5 steps with copy preserved; copy buttons still work.
- Happy path: 404 page recommendations swap correctly based on the attempted path's referrer (manual smoke).
- Edge case: starter-kit `?subscribed=true` modal still appears.
- Integration: parity script reports 0 structural diffs on `/starter-kit` and a representative 404 path.

**Verification:**
- starter-kit ≤350 LOC, NotFoundContent ≤200.
- `npm run build` green.

---

- U7. **Sweep: replace inline JSON-LD across hubs + articles + newsletter + ideas + startup-ideas**

**Goal:** Remove every remaining inline `@graph` object across the 8 non-marketing pages.

**Requirements:** R2, R5

**Dependencies:** U1.

**Files:**
- Modify: `app/articles/[slug]/page.tsx`, `app/articles/page.tsx`, `app/newsletter/[slug]/page.tsx`, `app/newsletter/page.tsx`, `app/ideas/[slug]/page.tsx`, `app/ideas-for/[audience]/page.tsx`, `app/build-with/[tool]/page.tsx`, `app/solve/[problem]/page.tsx`, `app/ideas/[slug]/collection.tsx`, `app/startup-ideas/page.tsx`

**Approach:**
- Per file, replace inline schema literals with `lib/seo.ts` helper calls. Person/WebSite blocks become `personSchema()` / `websiteSchema()` (they're literally identical across files today).
- Article pages use `articleSchema(...)`.
- Hub pages use `collectionPageSchema(...)` + `breadcrumbSchema(...)`.
- Solve hubs use `howToSchema(...)`.
- Idea pages use `articleSchema` + `softwareApplicationSchema` + `howToSchema` + `breadcrumbSchema` + `personSchema` composed via `buildGraph(...)`.
- Verify each page's emitted JSON via deep-equal vs pre-refactor snapshot.

**Patterns to follow:**
- `lib/seo.ts` exports (U1).

**Test scenarios:**
- Edge case: each of the 10 page files compiles after refactor.
- Integration: parity script reports `@graph` member count + type list unchanged on every refactored route.

**Verification:**
- `grep -rn '"@graph"' app/ components/` returns 0 results (helpers own this now).
- Build green, types clean.

---

- U8. **Sweep: replace inline idea-card markup with `<IdeaCard>` in hubs + filter**

**Goal:** Remove the 3 remaining inline idea-card markup duplications.

**Requirements:** R4, R8

**Dependencies:** U2.

**Files:**
- Modify: `components/hubs/HubIdeasGrid.tsx`, `components/ideas/RelatedIdeas.tsx`, `app/startup-ideas/IdeasExplorer.tsx`

**Approach:**
- `HubIdeasGrid` becomes a thin wrapper that maps each idea to `<IdeaCard variant="default">`.
- `RelatedIdeas` similarly maps to `<IdeaCard variant="default">` or `compact` (decide during impl based on visual fit).
- `IdeasExplorer` swaps its inline card JSX for `<IdeaCard variant="compact">`. Filter state machine unchanged.

**Patterns to follow:**
- `<IdeaCard>` from U2.

**Test scenarios:**
- Happy path: every hub page still shows its idea grid (manual smoke).
- Edge case: filter on `/startup-ideas` still narrows the grid correctly.
- Integration: parity script reports unchanged idea-link counts and card-text content on a sample hub + `/startup-ideas`.

**Verification:**
- `grep -rn 'idea-card' app components` returns only `globals.css` + `components/primitives/IdeaCard.tsx`.

---

- U9. **Collapse `Interactions` + `ScrollReveal`, extract `<HubRelatedTiles>`, wire `SignupCta`**

**Goal:** Last cleanup pass; finalize SignupCta/SignupModal wiring (R10).

**Requirements:** R6, R10

**Dependencies:** U3 (provides `MotionEffects`).

**Files:**
- Create: `components/hubs/HubRelatedTiles.tsx`
- Modify: every hub family page using "browse other X" tiles (`app/ideas-for/[audience]/page.tsx`, `app/solve/[problem]/page.tsx`, `app/ideas/[slug]/collection.tsx`, and any others discovered)
- Delete: `components/marketing/Interactions.tsx`, `components/marketing/ScrollReveal.tsx` (after every importer migrates to `MotionEffects`)
- Modify: `components/layout/MegaNav.tsx` (wire `<SignupCta>` to the primary CTA button)

**Approach:**
- `HubRelatedTiles` props: `{items: {slug, label, icon, href}[]; allHref?: string; allLabel?: string}`. Renders the consistent tile grid (icon + label + hover state) used by 4+ hub families currently inlined.
- Sweep importers of `Interactions` and `ScrollReveal` → replace with `MotionEffects` (with appropriate `effects` array).
- Delete the two old motion files once the sweep is complete.
- MegaNav: replace the "Get the Kit" CTA button with `<SignupCta utmCampaign="starter-kit" buttonLocation="nav">Get the Kit</SignupCta>` (or whatever the current CTA text is). The MegaNav stays a server-friendly shell; SignupCta is the only client interactivity it adds.
- SignupCta import count: homepage final CTA (U4), 404 (U6), MegaNav nav button (this unit) = ≥3 (R10).

**Patterns to follow:**
- The inline tile grids currently in `app/ideas-for/[audience]/page.tsx` (`AUDIENCE_TILES` array + inline render) — extract verbatim.

**Test scenarios:**
- Happy path: every hub page still shows its "browse other X" tile grid identically.
- Edge case: MegaNav CTA button opens the signup modal on click; pressing Escape closes it.
- Edge case: pages opting out of `flashlight` no longer mount the mousemove listener (verified by spy in dev mode).
- Integration: `grep -rn "Interactions\|ScrollReveal" app components` returns 0 results outside the new `MotionEffects.tsx`.

**Verification:**
- `components/marketing/Interactions.tsx` and `components/marketing/ScrollReveal.tsx` no longer exist.
- `grep -rn "SignupCta" app/` shows ≥3 distinct import sites.
- Build green.

---

## System-Wide Impact

- **Interaction graph:** Section components are the new junction point — every marketing page composes them. Bugs in `Hero` or `FinalCta` affect 4 pages. Mitigation: parity script + smoke pass per page after each refactor.
- **Error propagation:** `lib/seo.ts` returning malformed JSON-LD propagates to every page's `<head>`. Mitigation: U1 ships with snapshot equality tests against current inline output before any page migrates.
- **State lifecycle risks:** `MotionEffects` registering/cleaning up observers must mirror the current per-page lifecycle exactly — flashlight on shipable, section-view on landing. Mitigation: per-effect opt-in props; default = minimal.
- **API surface parity:** `<IdeaCard>` props are a public component contract — every future card user (homepage, hubs, filter, related) depends on its shape. Define `IdeaCardData` projection narrowly; only expand when a real use case demands.
- **Integration coverage:** Parity script (R9) is the integration test for this refactor. It catches structural regressions (missing JSON-LD, missing h1, changed canonical) that unit tests would miss.
- **Unchanged invariants:**
  - All public URLs unchanged.
  - All visible copy unchanged.
  - All Tailwind classes that appear in compiled output unchanged.
  - Beehiiv subscribe / Stripe webhook / Convex code paths untouched.
  - Email gate, consent provider, MDX pipeline untouched.

---

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Section component "props explosion": real-world variation across pages forces too many props per section. | Composition over configuration: use `slot` props (`formSlot`, `ctaSlot`, `countdownSlot`) instead of N boolean flags. Variant prop only when 2-3 shapes recur. |
| Tailwind purges utility classes that only appear inside template strings in `section-theme.ts`. | Top-of-file JSDoc block listing every literal class value plainly; `app/globals.css` `@source` glob ensures full scan of `components/`. |
| Pixel parity drift on cream pages: cream theme tokens may not exactly match the hand-tuned cream backgrounds on starter-kit/shipable/dare. | Capture pre-refactor screenshots manually; first cream-themed Hero diffed before approving the cream theme token values. |
| Parity script gives false positives on minor whitespace/HTML attribute order differences. | Normalize both snapshots (collapse whitespace, sort attributes) before diff. Match on structural signals (title text, JSON-LD member types, canonical, OG image, h1 text, FAQ question count), not raw HTML. |
| Refactor introduces hydration mismatch in a section component using a render-time guard the old inline code handled differently. | Cache Components catches Date.now()/Math.random() at build; all sections use server-render-stable values. Effects-driven dynamic content (countdown, year) stays in client islands. |
| `SignupCta` wiring on MegaNav adds client interactivity to a component that was server-rendered. | MegaNav already imports `MobileNav` (client) — adding `SignupCta` (client) keeps the same model. Server shell + client islands. |

---

## Documentation / Operational Notes

- After U3 lands, write a one-page `docs/components/marketing-sections.md` listing every section's prop shape + theme/accent options. Lightweight doc; not a Storybook.
- Update `CLAUDE.md` if needed: add "marketing pages compose from `components/marketing/sections/`; section components accept `theme + accent` props; use `lib/seo.ts` for JSON-LD".
- The refactor is internal restructuring; no user-visible change, no rollout plan needed beyond the standard deploy.

---

## Sources & References

- Migration plan (predecessor): `docs/plans/2026-06-12-001-refactor-nextjs-convex-migration-plan.md`
- Token map pattern: `components/hubs/hub-theme.ts` + `components/hubs/HubShell.tsx`
- Accessibility conventions: `CLAUDE.md`
- Section content source-of-truth: current page files in `app/(marketing)/`, `app/articles/`, `app/newsletter/`, `app/ideas/`, hubs.
