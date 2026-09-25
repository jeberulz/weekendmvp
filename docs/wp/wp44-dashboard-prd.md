# WP44 PRD - Ideas-first dashboard (free and paid)

Status: Rulings complete. R1 to R9 were ruled on 2026-09-25 and are recorded
in `docs/wp/RULINGS.md`. One follow-up is open: whether R5 also parks WP29 to
WP31 (end of section 12).

Companion docs:

- `docs/wp/wp44-stories.md` - the build plan, story by story
- `docs/wp/wp44-progress.md` - progress log
- Design canvas: [Weekend MVP Dashboard](https://claude.ai/artifact/SoKxJm9Urpeyo8p9NntLG5) - five artboards (new member, free member building, Builder's Hub member, phone, upgrade sheet). Private to the owner until shared

---

## 1. Summary

The product changed direction on 2026-09-24 (WP42 rulings). Weekend MVP now
leads with ideas: "startup ideas you can build in a weekend without quitting
your job, built with the AI tools you already use." The homepage moved to a
light "research desk" look. Login and signup (WP41) now send free users to
`/dashboard`.

The dashboard did not move with it. It still reads like the Build Platform
cockpit from August: dark theme, credits, projects, "Preview this idea" as the
main action, and copy written for auditors instead of builders.

This PRD turns `/dashboard` into the signed-in home of the idea library:

- A daily reason to come back (this week's pick, new ideas, ideas picked for you)
- A place to keep ideas (Saved)
- A simple plan to build one idea this weekend (Builds)
- A clear, calm split between what is free and what a paid plan adds

The core bet: research stays free for everyone. The paid plan sells workflow
and outcomes on top of it.

---

## 2. Current state audit

What a new free user sees today after signup (`app/dashboard/page.tsx`,
`components/platform/shell/DashboardHome.tsx`,
`components/platform/shell/WorkspaceShell.tsx`):

| # | Finding | Where | Why it matters |
|---|---|---|---|
| A1 | Dark theme (`#050505`) while `/` and `/ideas/*` are light research-desk | `WorkspaceShell.tsx`, `DashboardHome.tsx` | Signing in feels like leaving the product you signed up for |
| A2 | Headline "Move one idea forward" and primary CTA "Preview this idea" push the paid publish path first | `DashboardHome.tsx` | WP42 ruled no monetization push for now. New users have no idea picked yet |
| A3 | System copy leaks into the UI: "Only your active, server-owned records", "Saved and Interested remain independent", "These open explicit workflows; they do not run an autonomous agent", "Billing changes only after server confirmation" | `DashboardHome.tsx` | Reads like a compliance note. Users do not know what "server-owned" means |
| A4 | Two intent flags (Saved and Interested) with separate nav items. Nothing explains the difference | `WorkspaceShell.tsx`, `ExploreCard.tsx` | Two buttons for one job. Splits a small list in two |
| A5 | "New idea" (bring your own idea) is a top-level nav item, but its Validation Report is deferred to v1.1 | `app/dashboard/new`, `docs/wp/v1-scope-cut.md` | A new user can start a flow that ends without the promised report |
| A6 | Home has no editorial content. No idea of the week, no new ideas, no scores or art | `DashboardHome.tsx` | Nothing to do on day one except click through to Explore |
| A7 | Explore search and filters run per loaded page ("Search and filters apply to each indexed page as it loads") | `ExploreWorkspace.tsx`, `convex/platform/ideas.ts` | A search can say "No ideas on this page" while matches exist further down |
| A8 | Explore cards are text-only rows with "Canonical score 8/10" | `ExploreCard.tsx` | The homepage uses art, meters and tool marks. The library inside the account looks poorer than the public one |
| A9 | Whole dashboard waits for client mount before rendering data (`useSyncExternalStore` gate) | `DashboardHome.tsx`, `ExploreWorkspace.tsx` | Every visit starts with a skeleton, even for content that is the same for every user |
| A10 | Billing page renders its own `<main>` inside the shell's `<main>` | `app/dashboard/billing/page.tsx:19` | Nested landmarks break the "one semantic main" rule in `PRODUCT.md` |
| A11 | Signed-in readers cannot save from a public idea page. Saving only works inside `/dashboard/explore` | `app/ideas/[slug]/page.tsx` | The idea page is where people decide. The save button is somewhere else |
| A12 | No onboarding. "For you" ranks on a small boost from saved categories only | `convex/platform/ideas.ts` | Recommendations are weak until a user has saved several ideas |
| A13 | No concept of a plan tier or entitlement anywhere in the schema | `convex/schema.ts` | Free vs paid needs a server-side source of truth before any gate ships |

What works and should stay:

- Owner-scoped Convex queries (`requireCurrentPlatformUser`) and noindex on all private routes
- The intent mutation (`platform.ideas.setIntent`) and its live-region announcements
- The rail-plus-sidebar shell pattern and mobile bottom navigation
- The preview claim runner on `/dashboard` (`PreviewClaimRunner`)
- Weekly pick logic in `lib/home/rotation.ts` (reuse it so the dashboard and homepage agree)

---

## 3. Direction and principles

### 3.1 Positioning inside the account

Outside: "Startup ideas you can build in a weekend."
Inside: "Your idea desk. Pick one. Build it this weekend."

### 3.2 Principles

1. Research is free. Workflow is paid. Public idea pages stay complete,
   crawlable and canonical (`permanent_guardrails` in `.agentic-workflow.yml`).
   The paid plan never blurs, hides or delays research.
2. One next step. Every screen shows one obvious action. On Home it changes
   with the user's state (new, has saves, building).
3. Same desk, same look. The dashboard uses the WP42 research-desk tokens,
   type and components. It should feel like the homepage with your name on it.
4. Earn the upgrade at the moment of intent. Paid features appear where a user
   reaches for them, with a free way forward every time.
5. Plain words. Talk about ideas, weekends and prompts. Never about records,
   workflows, servers or ledgers.

### 3.3 Why not copy IdeaBrowser's free vs paid model

IdeaBrowser's free plan gives one idea per day with 24-hour access. The
database, trends and reports sit behind paid plans (Starter, Pro at
$1,499/yr, Empire at $2,999/yr). That works because their database is the
product.

Our database is also our SEO acquisition engine. 228 idea pages rank because
they are open. Gating them would cut traffic to the funnel that feeds signups.
So we borrow IdeaBrowser's logged-in structure (idea of the day up top, scores
at a glance, a library with filters, a clear upgrade path) and reject its
paywall on research.

---

## 4. Users and jobs

| User | Arrives from | Job to be done | What they need on Home |
|---|---|---|---|
| New member | Signup from `/`, an idea page, or the Starter Kit | "Show me an idea worth my weekend." | This week's pick, a short setup, fresh ideas |
| Browser | Returns weekly, saves ideas, has not built | "Help me choose." | Saved ideas side by side, picks for them with reasons |
| Weekend builder | Has started a plan | "Tell me what to do next and give me the prompt." | Plan progress, next step, copy-ready prompt |
| Paying builder | Upgraded | "Keep my ideas organised and get my build live." | Collections, prompt packs, plan usage, no Builder's Hub upsell |

---

## 5. Goals, non-goals, metrics

### 5.1 Goals

- G1. A new member saves at least one idea in their first session.
- G2. Members come back weekly because Home changes every week.
- G3. Members start and finish a weekend plan.
- G4. A paid plan converts from real intent, without hurting G1 to G3.
- G5. The dashboard matches the research-desk look and passes WCAG 2.1 AA.

### 5.2 Non-goals (this WP)

- Gating any content on `/ideas/{slug}` or `/startup-ideas`
- An AI chat or agent on Home (anti-reference in `PRODUCT.md`)
- Own-idea Validation Reports (v1.1, WP26 S2 to S6)
- Teams, comments, sharing, public profiles
- Dark mode for the workspace
- Stripe subscription billing code (separate high-risk WP, see section 9.4)
- Landing page preview, publishing, hosting and credit packs (parked for v1.1, R5 and R9)

### 5.3 Metrics

Baselines do not exist yet. Story S3 adds the events. Collect two weeks of
data, then set targets. Suggested starting targets are in brackets.

| Metric | Definition | Suggested target |
|---|---|---|
| First-session save rate | New members who save 1+ idea within 30 min of signup | [50%] |
| Setup completion | New members who answer the 3 setup questions | [60%] |
| D7 return | Members with a dashboard visit 1 to 7 days after signup | [30%] |
| Plan start rate | Weekly active members with an active weekend plan | [15%] |
| Plan finish rate | Plans that reach the Sunday "Launch it" step | [25%] |
| Free to paid | Members who upgrade within 30 days (Phase C only) | [2 to 4%] |
| Guardrail: organic | Organic sessions to `/ideas/*` week over week | No drop |
| Guardrail: quality | axe violations on dashboard routes at 390px and 1440px | 0 |
| Guardrail: speed | Dashboard LCP on 4G mobile | < 2.5 s |

---

## 6. Experience design

### 6.1 Navigation

Desktop (1024px and up): one sidebar, 248px, collapsible to a 72px rail.
This replaces today's rail plus second sidebar, which doubles the same links.

```text
[Logo] Weekend MVP
  Home
  Ideas
  Saved            12
  Builds            1

  COLLECTIONS            (Builder's Hub only. Free sees nothing here)
    Fintech shortlist
    Weekend in Oct

  RESOURCES
    Starter Kit
    Build with AI         (links to /build-with)

  [Plan card]            (free only, see 6.6)
  (JI) John Iseghohi  v  (account menu: Plan and billing, Settings, Sign out)
```

- Top bar: search field ("Search 228 ideas", `/` shortcut focuses it). No
  second sign-out button. Account lives in the sidebar footer.
- "New idea" leaves the nav until own-idea reports ship (ruling R4). The route
  stays for existing drafts.
- "Interested" leaves the nav. Saved shows both flags (ruling R3).
- Billing moves into the account menu as "Plan and billing".

Mobile (below 1024px): bottom tab bar with Home, Ideas, Saved, Builds, and
Account. Account opens a sheet with plan, billing, Starter Kit, and sign out.
Search sits at the top of Home and Ideas. The sheet keeps today's focus trap.

### 6.2 Home

Home is four modules and an optional right rail. Order is fixed: personal
first, then editorial, then discovery. No stat tiles, no charts.

```text
Date line (mono)        THU 24 SEP · WEEK 39
Greeting (serif)        Good evening, John.
Status line             4 saved ideas. Your weekend starts Friday.

[1] Next step card      changes by state (see below)
[2] Idea of the week    same pick as the homepage (lib/home/rotation.ts)
[3] Picked for you      3 ideas with a one-line reason each
[4] New this week       Index-style list, newest first, 5 rows

Right rail (1280px+)    Saved (5 latest) · Starter Kit card or Plan card
```

Module 1 changes with the user's state:

| State | Condition | Card shows | Primary action |
|---|---|---|---|
| New | No saves, setup not done | "Tell us how you build" with 3 quick questions inline | Show my ideas |
| New, set up | No saves, setup done | This week's pick with a "Start here" label | Save this idea |
| Choosing | 1+ saves, no active plan | Top 3 saved ideas as a compact comparison (hours, tools, scores) | Plan my weekend |
| Building | Active weekend plan | Plan progress (Fri, Sat, Sun, Mon), the next step, and its prompt | Copy prompt / Open plan |
| Finished | Plan reached Monday | "You shipped." Shows the live link the member saved on Sunday | Pick the next idea |

Module 2, Idea of the week: full-width card with the idea's art band, title,
one-line pitch, four scores (Opportunity, Pain, Timing, Builder confidence),
build hours and tool marks. Actions: "Read the research" (to `/ideas/{slug}`)
and Save. It reuses `getHomeData()` so it always matches `/`.

Module 3, Picked for you: three cards. Each shows a reason in plain words:
"You build with Cursor", "Fits a 12-hour weekend", "Like SlackToDoc, which you
saved". Reasons come from the ranking inputs, never invented. If there is no
honest reason, the card shows none.

Module 4, New this week: the homepage Index row style (N°, title, category,
hours, save). "View all" goes to Ideas sorted by newest.

Right rail: shows only at 1280px and wider. Below that its modules drop under
module 4, except the Plan card, which stays in the sidebar.

Offer card (rulings R6 and R8): the rail holds at most one offer card, under
Saved.

- In a member's first 24 hours after signup: the Starter Kit card, until they
  claim the kit. No promos.
- After that: an active promo for another Weekend MVP product (a webinar, a
  workshop) if one is running, else the Starter Kit card if the kit is not
  claimed yet, else nothing.
- Every offer card has a dismiss button. A dismissed card stays gone for that
  member.
- Builder's Hub members see promos for other products. They never see the
  Builder's Hub upsell.

### 6.3 Other screens

Ideas (`/dashboard/explore`, relabelled "Ideas")

- Views as tabs: All, For you, New. Saved and Building move to their own screens.
- Filters as chips with counts: category, tools, build time, revenue goal.
- Sort: Recommended, Newest, Highest score.
- Search runs over the whole library, not the loaded page (fixes A7).
- Grid of idea cards (art band, title, pitch, 4 score meters, hours, tools, Save)
  with a list toggle for dense scanning. Grid is the default.

Saved (`/dashboard/saved`)

- Free: one list, newest first, with a "Compare" hint and "Plan my weekend" on each row.
- Builder's Hub: the same list plus named collections and a private note per idea.

Builds (`/dashboard/builds`)

- Active weekend plan on top, finished plans below.
- Site projects (claimed previews, published sites) are parked for v1.1 (R5).
  Their routes stay reachable by URL, but nothing links to them.
- Plan detail (`/dashboard/builds/{planId}`): the four stages from the homepage
  (`WEEKEND_PLAN` in `components/home/content.ts`), each with a short checklist,
  the matching prompts from the idea page, a one-line "core feature" field for
  scope, and on Sunday the idea's Landing Page prompt plus a field for the
  live link the member ships. Weekend MVP's own landing page builder returns
  in v1.1 (R5).

Plan and billing (`/dashboard/billing`, relabelled)

- Current plan, what it includes, and upgrade or manage.
- Builder's Hub monthly subscription only. Credit packs stay hidden until the
  owner revisits them (R9). The WP24 credit code stays in place, unlinked.

### 6.4 Setup (first visit)

Three questions, inline on Home in module 1. Skippable. Editable later in
Settings. Pattern from Codecademy's "Find what's right for you" and
Pinterest's interest picker, cut down to what our ranking can use.

1. Which AI tools do you build with? Chips: Cursor, Claude, Bolt, v0, Lovable,
   Replit, Windsurf, No-code. Multi-select. Maps to the manifest `tools` allowlist.
2. How much time do you have most weekends? 8 hrs, 12 hrs, 20 hrs, More.
   Maps to `buildTime` values.
3. What do you want from it? Side income, Learn by building, Portfolio piece,
   Replace my job one day. Maps to `revenueGoal` and audiences.

After the last answer, module 1 swaps to "New, set up" and Picked for you fills
in with reasons. No modal, no page change.

### 6.5 Free vs paid

The paid plan is Builder's Hub at $29 a month (ruling R1, 2026-09-25). The
plan is sold monthly only for now (R9). The free limits below are ruling R2. In code the
plan id is `builders_hub`, and the UI reads the name and price from one
constant, so a rename or price change never touches stored data. Do not reuse
the id `builder`: the credit pack catalog already uses it (see R9).

| Capability | Anonymous | Free member | Builder's Hub |
|---|---|---|---|
| Read every idea page, prompts and sources | Yes | Yes | Yes |
| Search and filter the whole library | Yes (`/startup-ideas`) | Yes, plus For you | Yes |
| Home with idea of the week and new ideas | No | Yes | Yes |
| Save ideas | No | Unlimited, one list | Unlimited, plus collections and notes |
| Picked for you with reasons | No | Yes | Yes |
| Weekend plan | No | 1 active plan | Unlimited, with history |
| Copy prompts | Yes | Yes | Yes, plus prompt pack export per tool |
| Compare ideas side by side | No | No | Up to 4 |
| Landing page preview, publishing and hosting | v1.1 (R5) | v1.1 | v1.1 |
| Validation Report on your own idea | v1.1 (R4) | v1.1 | v1.1 |
| Price | Free | Free | $29 a month, billed monthly |

Why these lines:

- Saves stay unlimited on free. Saving is the habit that brings people back and
  the signal that powers For you. A save cap would cut G1 and G2.
- One active weekend plan is the natural free limit. It matches the promise
  ("one idea, one weekend") and only bites for users who are already building.
- Prompt pack export is a deterministic file build from content we already
  have (for example a `CLAUDE.md`, a `.cursor/rules` file, a Lovable brief).
  It costs nothing to run and saves a builder real setup time.
- Publishing, hosting and own-idea reports return in v1.1 (R4, R5). Hosting
  is then the natural next Builder's Hub benefit, since it is a cost we carry
  every month.
- No credit packs for now (R9). One monthly price is easier to explain while
  the product leads with ideas.

### 6.6 Upgrade surfaces

Allowed surfaces, and nothing else:

1. Plan card in the sidebar footer (free only). Shows usage, not ads:
   "Free plan. 1 of 1 weekend plan in use. Builder's Hub adds collections,
   prompt packs and unlimited weekend plans." Link: "See Builder's Hub". Pattern from Arcade's
   "Free Plan 1/3" meter.
2. Point-of-intent sheet when a free member reaches for a Builder's Hub
   feature (start a 2nd plan, create a collection, export a prompt pack,
   compare). Two-column Free vs Builder's Hub comparison, as in Plane's trial
   sheet, with the price on the upgrade button ("Upgrade to Builder's Hub ·
   $29/mo").
   Always includes a free way forward, for example "Archive SlackToDoc and
   start this one" or "Not now".
3. "Builder's Hub" tag on the locked action itself (a small text label, not a
   padlock wall). Clay's "Ads - Upgrade" nav badge is the reference.
4. Plan and billing page with a Free vs Builder's Hub table and a "Current plan" label.
5. The offer card in the Home rail (section 6.2), which also carries promos
   for other Weekend MVP products such as webinars (R8).

Rules:

- Never blur, truncate or delay research, on any page, for any plan.
- Nothing sells in a member's first 24 hours: no promos and no upgrade
  prompts, except the sheet when the member clicks a Builder's Hub feature.
- Home carries at most one offer card. Builder's Hub tags appear only on
  locked actions.
- No countdown timers, fake discounts or pre-checked boxes.
- Builder's Hub members never see the Builder's Hub upsell. They see what they
  have (plan usage) and, like everyone, promos for other products.
- The public homepage stays free of monetization (WP42 ruling). The dashboard
  may sell (R8).

### 6.7 Visual design

Use the WP42 tokens in `app/globals.css`. Do not add a new palette.

| Role | Token | Notes |
|---|---|---|
| Page background | `home-paper` `#f7f3ec` | |
| Cards | `home-card` `#fffdf9` with 1px `home-rule` border | 12px radius, no drop shadows |
| Sidebar | `home-sunk` `#efe8dc` | Active item: `home-card` fill plus ink text |
| Text | `home-ink`, `home-ink-2`, `home-ink-3` | `home-ink-3` only for 14px+ meta |
| Accent text under 24px | `home-orange-ink` `#a84a00` | 5.2:1 on paper |
| Accent 24px+ and graphics | `home-orange` `#cc5500` | Never for small text |
| Category tints | `home-sage`, `home-ochre`, `home-sky`, `home-clay` with their `-ink` pairs | Same mapping as the homepage tags |
| Plan card (free) | `home-panel` `#24211c` with `home-d*` text | The one dark element, so it reads as account state, not content |

Type:

- Greeting and page titles: Newsreader (`font-editorial`), 40px desktop, 32px mobile.
- Section labels and meta: Geist Mono, 11 to 12px, uppercase, 0.08em tracking.
  Example: `IDEA OF THE WEEK`, `N°228`, `12 HRS`.
- Body and UI: Geist 14 to 16px.

Components to reuse from `components/home/*`: `IdeaArt` (art band), weekend
meter, category tag, tool logos, `Eyebrow`, `ButtonLink`. Score meters show the
number next to the bar so colour is never the only signal.

Layout: 8px spacing grid, content max width 1200px, 32px gutters on desktop,
16px on mobile, no horizontal scroll at 390px.

Motion: 150ms colour and border transitions only. Respect
`prefers-reduced-motion`. No animated counters.

### 6.8 Copy

| Today | Proposed |
|---|---|
| Move one idea forward. | Good evening, John. |
| Review the evidence you kept, then choose one concrete next step. Nothing runs or spends credits without your confirmation. | 4 saved ideas. Your weekend starts Friday. |
| Only your active, server-owned records. | (remove) |
| Saved and Interested remain independent. | (remove) |
| Supported shortcuts. These open explicit workflows; they do not run an autonomous agent. | (remove the section) |
| Available balance: 25 credits. Billing changes only after server confirmation. | (remove. No credits in v1, R9) |
| Search loaded idea metadata | Search 228 ideas |
| Canonical score 8/10 | Score 8/10 |
| Project cockpit becomes available after you confirm a brief. | (remove) |
| Workspace data is unavailable. The Convex data connection is missing or invalid. | We can't load your ideas right now. Try again in a minute. (Keep the technical detail in the console.) |

### 6.9 States

- Loading: server-render the shell and the editorial modules (2 and 4). Only
  personal modules (1, 3, Saved counts) show a skeleton, sized to the final
  layout so nothing jumps.
- Empty: each module has an empty state that points to one action (see 6.2).
- Error: per-module. A failed personal query never blanks the editorial content.
- Offline or Convex down: editorial modules still render from the cached
  homepage data.

### 6.10 Accessibility

WCAG 2.1 AA, per `PRODUCT.md`. Specific to this work:

- One `main` per page (fix A10). Sidebar is `nav aria-label="Workspace"`.
- Save is a toggle button with `aria-pressed` and a polite live announcement.
- Setup chips are checkboxes in a `fieldset` with a `legend`.
- Plan stages use an ordered list with "Step 2 of 4, current" text, not colour alone.
- The upgrade sheet is a dialog with a focus trap, Escape to close, and focus
  returned to the trigger.
- Contrast: follow the token notes in 6.7. Measure text over art bands from
  rendered pixels, as WP42 did.
- Keyboard: `/` focuses search, visible 2px focus rings everywhere.

---

## 7. Wireframes

The design canvas holds the working artboards:
[Weekend MVP Dashboard](https://claude.ai/artifact/SoKxJm9Urpeyo8p9NntLG5). It is the visual source of truth while the
design is in review. Export the approved artboards as PNGs into
`docs/wp/evidence/` in story S1 so coding agents without canvas access can
read them. ASCII versions follow.

### 7.1 Desktop, free member, building

```text
+------------------------+----------------------------------------------------------+
| [WMVP] Weekend MVP     | [ Search 228 ideas                  / ]                  |
|                        |----------------------------------------------------------|
| > Home                 | THU 24 SEP · WEEK 39                                     |
|   Ideas                | Good evening, John.                                      |
|   Saved            4   | 4 saved ideas. Your weekend starts Friday.               |
|   Builds           1   |                                                          |
|                        | +------------------------------------------------------+ |
| RESOURCES              | | YOUR WEEKEND · SlackToDoc          Step 2 of 4       | |
|   Starter Kit          | | [x] Fri  Pick and plan                                | |
|   Build with AI        | | [>] Sat  Build the core  <- next                      | |
|                        | | [ ] Sun  Launch it                                    | |
|                        | | [ ] Mon  Back at work                                 | |
|                        | | "Paste the setup prompt into Cursor..."               | |
|                        | | [Copy prompt]  [Open plan ->]                         | |
|                        | +------------------------------------------------------+ |
|                        |                                                          |
|                        | IDEA OF THE WEEK                                         |
|                        | +------------------------------------------------------+ |
|                        | | [ art band ]                                          | |
|                        | | Non-toxic appliance check                             | |
|                        | | Opportunity 8  Pain 8  Timing 7  Builder conf. 8      | |
|                        | | 12 HRS · Cursor Claude v0     [Read research] [Save]  | |
|                        | +------------------------------------------------------+ |
| +--------------------+ |                                                          |
| | FREE PLAN          | | PICKED FOR YOU                                           |
| | 1 of 1 plan in use | | [You build with Cursor] [Fits 12 hrs] [Like SlackToDoc]  |
| | Builder's Hub adds | |  Invoice Reconciler     Tutor planner   Meeting notes    |
| | collections, packs | |                                                          |
| | and more plans.    | | NEW THIS WEEK                              View all ->   |
| | See Builder's Hub  | | N°228  AI Landing Page Gen.  AI TOOLS  10 HRS   [Save]   |
| +--------------------+ | N°227  Youth Sports Hub      CREATOR   12 HRS   [Save]   |
| (JI) John  Free    v   |                                                          |
+------------------------+----------------------------------------------------------+
```

### 7.2 Desktop, Builder's Hub member (differences only)

```text
Sidebar:  COLLECTIONS group appears (Fintech shortlist, Weekend in Oct, + New)
          Plan card is gone. Account chip reads "John · Builder's Hub"
Module 1: same, plus "Export prompt pack" next to Copy prompt
Saved:    collections, notes, "Compare (2)" action bar
Builds:   every plan kept, with history and the live links members shipped
Rail:     plan usage (weekend plans, collections), then the offer card
```

### 7.3 Mobile, 390px

```text
+--------------------------------+
| [WMVP]                   (JI)  |
| [ Search 228 ideas          ]  |
| THU 24 SEP                     |
| Good evening, John.            |
| +----------------------------+ |
| | YOUR WEEKEND · SlackToDoc  | |
| | Step 2 of 4 · Build core   | |
| | [Copy prompt] [Open plan]  | |
| +----------------------------+ |
| IDEA OF THE WEEK               |
| [ art band ]                   |
| Non-toxic appliance check      |
| Opp 8 · Pain 8 · 12 HRS [Save] |
| PICKED FOR YOU      swipe ->   |
| [card] [card] [ca              |
| NEW THIS WEEK                  |
| N°228 AI Landing Page  [Save]  |
|--------------------------------|
| Home  Ideas  Saved  Builds  Me |
+--------------------------------+
```

### 7.4 Upgrade sheet (free member starts a second plan)

```text
+--------------------------------------------------+
| Start another weekend plan?                      |
| Free includes one active plan.                   |
|                                                  |
|  FREE                     BUILDER'S HUB          |
|  1 active plan        ->  Unlimited plans        |
|  One saved list       ->  Collections and notes  |
|  Copy prompts         ->  Prompt pack export     |
|  One idea at a time   ->  Compare up to 4 ideas  |
|                                                  |
|  [ Upgrade to Builder's Hub · $29/mo ]           |
|  [ Archive SlackToDoc and start this one ]       |
|  Not now                                         |
+--------------------------------------------------+
```

---

## 8. Functional requirements

Home

| ID | Requirement |
|---|---|
| FR-1 | `/dashboard` renders the shell and editorial modules on the server. Personal modules load from Convex on the client |
| FR-2 | Idea of the week and New this week come from `getHomeData()` so they match `/` exactly |
| FR-3 | Module 1 picks its state from: setup done, save count, active plan, finished plan (table in 6.2) |
| FR-4 | Picked for you shows 3 ideas the user has not saved, each with a reason derived from its ranking inputs, or no reason |
| FR-5 | Greeting uses the time of day in the browser's time zone and the user's first name. No name, no comma: "Good evening." |
| FR-6 | `PreviewClaimRunner` keeps working on `/dashboard` |

Library and saving

| ID | Requirement |
|---|---|
| FR-7 | Ideas search runs over the full library through a Convex search index on `ideas`, filtered by category |
| FR-8 | Filters (category, tools, build time, revenue goal) combine with search and sort, and live in the URL |
| FR-9 | Save is one toggle. Saved shows ideas where `saved` or `interested` is true. Unsave clears both flags |
| FR-10 | Signed-in readers can save from `/ideas/{slug}`. The page stays static and crawlable. The save control is a client island that renders only when the `wmvp_signed_in` hint cookie is present |
| FR-11 | Anonymous readers who click Save go to `/signup?returnTo=/ideas/{slug}` and the save completes after signup |

Setup and personalization

| ID | Requirement |
|---|---|
| FR-12 | Setup stores tools, weekly hours and goal per user, server-side, owner-scoped |
| FR-13 | Setup is skippable and editable in Settings. Skipping never blocks Home |
| FR-14 | For you ranking uses setup answers plus saved categories. Every reason shown maps to one input |

Weekend plans

| ID | Requirement |
|---|---|
| FR-15 | A member can start a plan from any idea. It creates an owner-scoped plan with the 4 stages |
| FR-16 | Steps can be checked and unchecked. Progress persists across devices |
| FR-17 | Each stage shows the idea's matching prompts with a copy button that announces "Prompt copied" |
| FR-18 | The Sunday stage shows the idea's Landing Page prompt and saves the live link the member ships. It links to no Weekend MVP preview or publish flow (R5) |
| FR-19 | Free members can hold 1 active plan. Starting another opens the upgrade sheet with an archive option (enforced server-side once entitlements exist) |
| FR-20 | Ideas with an active plan show "Building" in Ideas and Saved |

Plans and entitlements

| ID | Requirement |
|---|---|
| FR-21 | One server-side resolver returns the member's plan and limits. Every gated mutation calls it. The client never decides access |
| FR-22 | Until the subscription WP ships, the resolver returns Free for everyone and Builder's Hub UI stays behind a flag |
| FR-23 | The sidebar Plan card, upgrade sheet and Plan and billing page follow the rules in 6.6 |
| FR-24 | Builder's Hub members see no upgrade prompts anywhere |

Shell and quality

| ID | Requirement |
|---|---|
| FR-25 | All `/dashboard/**` routes use the light research-desk theme, including billing, projects and intake |
| FR-26 | Exactly one `main` per page |
| FR-27 | All private routes stay `noindex` and out of the sitemap |
| FR-28 | "New idea" is removed from navigation until own-idea reports ship. Existing drafts stay reachable from Builds |

Offers and parked features

| ID | Requirement |
|---|---|
| FR-29 | No landing page preview, publish, hosting or credit entry point appears on `/dashboard/**` or `/ideas/{slug}` until v1.1 (R5, R9). Today that means `PreviewIdeaCta` on idea pages, "Preview this idea" on Explore cards and the old dashboard home, and project cards. The routes stay reachable by URL, and `PreviewClaimRunner` still claims a stashed preview |
| FR-30 | Plan and billing sells the Builder's Hub monthly subscription only. Credit packs stay hidden (R9) |
| FR-31 | The Home rail shows at most one offer card, chosen by the rules in 6.2. Offer cards are dismissible, and a dismissal persists per member on the server |
| FR-32 | Promos come from one config file (id, title, blurb, date text, link, start and end time). No promo shows in a member's first 24 hours after signup |

---

## 9. Data and backend

### 9.1 Reads

- New `convex/platform/dashboard.ts` query `home`, replacing `ideas.dashboardSummary`.
  Returns first name, saved count, 5 latest saved ideas, setup state, active
  plan summary, plan tier. Uses `requireCurrentPlatformUser`. Bounded reads
  with `take()`, as today.
- Editorial data stays in Next.js: `app/dashboard/page.tsx` becomes a server
  component that calls `getHomeData()` (cached 1 hour) and passes the weekly
  pick and newest rows to client modules. `next.config.ts` must trace the idea
  files into the `/dashboard` function the same way WP42 did for `/`.
- `platform.ideas.explore` gains full-library search (search index) and
  returns a `reason` for For you results.

### 9.2 Additive schema (one writer per merge window)

| Table or index | Fields | Indexes | Story |
|---|---|---|---|
| `ideas` search index | `searchField: title`, `filterFields: [category]` | `search_title` | S5 |
| `user_preferences` | `ownerId`, `tools[]`, `weeklyHours`, `goal`, `onboardedAt?`, `dismissed[]` (offer card ids, capped at 50), `updatedAt` | `by_ownerId` | S8 |
| `weekend_plans` | `ownerId`, `ideaId`, `status` (active, done, archived), `steps[]` (`key`, `doneAt?`), `coreFeature?`, `liveUrl?`, `startedAt`, `updatedAt`, `completedAt?` | `by_ownerId_and_status_and_updatedAt`, `by_ownerId_and_ideaId` | S9 |

All additive. No existing table, field or index changes. Read
`convex/_generated/ai/guidelines.md` before writing any of it.

### 9.3 Entitlements

`convex/platform/entitlements.ts` exports one internal helper,
`getEntitlements(ctx, ownerId)`, returning `{ plan: "free" | "builders_hub", limits }`.
The display name ("Builder's Hub") and price ($29 a month) live in one plan
constant beside it. For now it returns Free. Gated mutations (start plan, create collection,
export pack, compare) call it and throw a typed `ConvexError` with
`code: "UPGRADE_REQUIRED"` and the feature name, which the UI turns into the
upgrade sheet.

### 9.4 Payments

Builder's Hub billing needs a Stripe monthly subscription, webhooks, and a
subscription record. No credit packs (R9). That is a payments change, so it
runs as its own high-risk Work Package, with the same exactly-once and
server-confirmed rules as WP24. WP44 ships the UI and the resolver, not the
billing code.

### 9.5 Offers

- Promos live in `lib/dashboard/offers.ts` as typed config: id, title, blurb,
  date text, link, `startsAt`, `endsAt`. Changing a promo is a code change and
  a deploy, the same way programmatic hubs work today.
- "Kit claimed" means a `subscriptions` row exists for the member's email
  (existing `by_email` index), read inside the owner-scoped dashboard query.
  The email never reaches the client.
- "First 24 hours" uses the member's `users._creationTime`.
- Dismissals live in `user_preferences.dismissed` (S8).

---

## 10. Analytics

Client events stay consent-gated through `lib/track.ts` and carry no email,
names, notes or free text.

| Event | Properties |
|---|---|
| `dashboard_viewed` | `state` (new, set_up, choosing, building, finished), `plan` |
| `setup_completed` | `tools_count`, `hours_bucket`, `goal` |
| `setup_skipped` | none |
| `explore_state_changed` | existing. Add `source` (home, ideas, saved, idea_page) |
| `weekend_plan_started` | `source` |
| `weekend_step_completed` | `step` (fri, sat, sun, mon) |
| `prompt_copied` | `surface` (plan, home, idea_page) |
| `upgrade_prompt_viewed` | `surface` (sidebar, sheet, tag, billing), `feature` |
| `upgrade_clicked` | `surface`, `feature` |
| `offer_viewed` | `offer_id`, `kind` (starter_kit, promo) |
| `offer_clicked` | `offer_id`, `kind` |
| `offer_dismissed` | `offer_id`, `kind` |

Paid outcomes (`checkout_completed` and the like) are emitted only after
server confirmation, as the existing analytics contract requires.

---

## 11. Risks

| Risk | Mitigation |
|---|---|
| Save island on idea pages turns them dynamic and hurts SEO | Keep the page static. Island reads the hint cookie after hydration. Check the build output route type and the canonical SEO suite |
| Theme switch leaves billing, projects and intake dark | S7 restyles every `/dashboard/**` route in the same WP |
| Paid UI ships before subscription billing exists | Phase C sits behind a flag until the subscription WP passes its gate. Phase A and B stand alone |
| Builder's Hub feels thin at $29 while publishing, hosting and reports are parked | Turn Phase C on when the owner judges the bundle ready. Member access to the webinars the dashboard will promote (R8) would make it stronger |
| Promos turn Home into an ad board | One offer card, dated, dismissible, never in the first 24 hours |
| Members halfway through the old preview flow hit a dead end | `/preview/{token}` and preview claims keep working. Only the entry points go (FR-29) |
| Credit pack names clash with Builder's Hub and the Starter Kit | Packs are hidden for now (R9). Rename their display names before they return |
| Two stories edit `convex/schema.ts` at once | S5, S8 and S9 run in sequence, one schema writer per merge window |
| Weekly pick differs between `/` and `/dashboard` | Both call `getHomeData()`. Add a test that compares the two slugs |
| Recommendations feel random | Show a reason only when it maps to a real input. No reason beats a made-up one |
| Merging Saved and Interested loses meaning for existing users | Keep both flags in data. Saved shows the union. No migration |
| IdeaBrowser-style gating is requested later | Section 3.3 records why research stays open. Any change needs a new ruling |

---

## 12. Owner rulings

Record each in `docs/wp/RULINGS.md` before the story that needs it. R1 to R4
were ruled on 2026-09-25.

| # | Question | Ruling | Status | Blocks |
|---|---|---|---|---|
| R1 | Paid plan name and price | Builder's Hub, $29 a month. Monthly only for now (R9) | Ruled 2026-09-25 | S10, S11 |
| R2 | Free limits | Unlimited saves in one list, 1 active weekend plan. Collections, prompt pack export and compare are Builder's Hub only | Ruled 2026-09-25 | S9, S10 |
| R3 | Merge Interested into Saved in the UI | Yes. One Save toggle and one Saved list. Both flags stay in data | Ruled 2026-09-25 | S5 |
| R4 | Park "Bring your own idea" until v1.1 reports ship | Yes. Hidden from nav. The route stays for existing drafts | Ruled 2026-09-25 | S2 |
| R5 | Credits, subscription and site publishing | Park everything to do with site publishing for v1.1: preview, publish, hosting, tenant sites, and the credits that pay for them | Ruled 2026-09-25 | S5, S6, S7, S9 |
| R6 | Starter Kit card on free Home | Yes. Right rail, dismissible, hidden once the member has claimed the kit | Ruled 2026-09-25 | S4, S12 |
| R7 | Setup questions: skippable or required | Skippable | Ruled 2026-09-25 | S8 |
| R8 | May the dashboard sell? (WP42 ruled no monetization on `/`) | Yes. Quiet Builder's Hub surfaces plus a promo slot for future products such as webinars. Nothing sells in a member's first 24 hours | Ruled 2026-09-25 | S10, S12 |
| R9 | Credit packs | None for now. Monthly subscription only. Revisit later | Ruled 2026-09-25 | S7, S10 |

Open follow-up on R5: WP29 to WP31 (project cockpit, policy gate, production
activation) exist to ship site publishing. If R5 parks them too,
`docs/wp/v1-scope-cut.md` and the WP29 to WP31 rows in
`docs/PROJECT_STRATEGY.md` need a revision. Waiting on the owner.

---

## 13. Inspiration

Mobbin references reviewed on 2026-09-24. Each line says what to borrow.

Home and greeting

- [Babbel home](https://mobbin.com/screens/509a5802-3cd9-4a05-be5d-bf472cfb51ba): serif greeting on a warm off-white page. Closest match to the research-desk tone.
- [Pi discover](https://mobbin.com/screens/96aac65f-2195-40d3-8e35-fcf323652122): editorial serif greeting with content as the hero, not metrics.
- [ManyChat home](https://mobbin.com/screens/8fe75ba9-6967-4312-931d-2d4e768f3a35): "Start here" plus "Your next best actions" with a 2-of-3 progress checklist. Model for module 1.
- [Braintrust home](https://mobbin.com/screens/763a4660-fe0a-4927-80d4-21908b8c0232): "Your newest matches" cards with save and share. Model for Picked for you.
- [Databricks welcome](https://mobbin.com/screens/9c8d74ad-9a6a-497a-aad9-045d3f2e7ed7): Recents, Favorites, Popular, What's new as tabs over one list.
- [Homerun home](https://mobbin.com/screens/42d9dd98-e74d-41c3-a9cc-c28f36315897): cream background, bold greeting, quiet trial pill top right.

Library and saved

- [Uxcel bookmarks](https://mobbin.com/screens/fd91798a-0824-4fb3-99c1-ba05c5975605): type chips, sort menu, card grid with a filled bookmark state.
- [Gamma library](https://mobbin.com/screens/27f739c8-3b41-4dc6-b761-54b7d881533a): All, Recently viewed, Favorites tabs with a grid and list toggle.
- [Skillshare browse](https://mobbin.com/screens/a0b01c47-8ca2-4e2b-a8d4-628dac9ff08b): filter dropdowns with multi-select, "Staff Pick" label on cards.
- [Codecademy onboarding flow, last screen](https://mobbin.com/flows/9e0051c2-a775-4a37-adcd-a9649df80a60): dashboard with "Free course" labels on cards and a "Try Plus or Pro" card in the sidebar.

Free vs paid

- [Arcade library](https://mobbin.com/screens/1f96449f-566c-4dd0-8de7-7baedb230743): "Free Plan 1/3" usage meter in the sidebar. Model for the Plan card.
- [Clay home](https://mobbin.com/screens/923ab3a6-fc2c-4130-b369-fa8c5429316b): "Upgrade" tag on a single nav item instead of a wall.
- [Plane trial sheet](https://mobbin.com/screens/fe4835d5-446a-4b88-aaec-5807e9a62e5f): Free vs Business rows with arrows. Model for the upgrade sheet.
- [Mobbin paywall](https://mobbin.com/screens/8c330b43-b179-4540-a747-aa2812a5a24d): "Get full access" with "Or continue for free" under the main button.
- [ChatGPT upgrade](https://mobbin.com/screens/6d350f15-68f9-4de7-a660-7b2c4658fa0a): two plans, "Your current plan" label, short feature lists.
- [Savee Pro sheet](https://mobbin.com/screens/fa90f904-d727-4376-9a4c-de2e1c45293e): "You discovered a Pro only feature" at the point of intent.
- Counter-examples: [Uxcel blurred answers](https://mobbin.com/screens/1b347563-d7e8-41ad-8d54-55148c4f07aa) and [Kajabi promo card](https://mobbin.com/screens/5d415c90-2aa2-4aae-bd05-b5c346f95361). Blurring content and promo banners are what section 6.6 rules out.

Setup and progress

- [Codecademy onboarding](https://mobbin.com/flows/9e0051c2-a775-4a37-adcd-a9649df80a60): 3 questions to recommendations.
- [Pinterest onboarding](https://mobbin.com/flows/2d162947-15e5-4c32-93e0-920d07a1bb19): interest picker, then "Pick any idea to get started" tip on the feed.
- [Wrike quick start](https://mobbin.com/screens/b453a329-6f1b-4745-ba03-5ce03c2c5307) and [Apollo onboarding hub](https://mobbin.com/screens/f7cca581-5cd4-4e57-9184-3646cdc97e47): checklist progress in the sidebar.

Mobile

- [Fabric home](https://mobbin.com/screens/5502fe88-93d1-4389-b4bf-7df64084998e): greeting plus horizontal "Recent items" row.
- [Zalando saved](https://mobbin.com/screens/fd7e3507-990a-46fc-8b10-2d18792da10f): serif subhead, saved groups with counts.

IdeaBrowser

The IdeaBrowser MCP failed to connect in this session, and the site is blocked
by the session's network policy, so the logged-in pages could not be captured
again. Notes come from public sources and the repo's earlier review (WP41 used
an IdeaBrowser-inspired auth layout):

- Free plan: one idea per day with 24-hour access ([Greg Isenberg on X](https://x.com/gregisenberg/status/1939401459851985356)).
- Paid plans unlock the database, trends and AI-generated ideas (Starter), a research agent with 3 reports a month (Pro, $1,499/yr) and coaching (Empire, $2,999/yr) ([web search summary](https://preuve.ai/compare/ideabrowser)).
- What we borrow: idea of the day as the first thing you see, scores at a
  glance, a filterable database, build prompts next to the research, a visible
  path to more.
- What we do not borrow: time-limited access to research, and a paywall on the
  database (see 3.3).

Before S4 starts, capture fresh IdeaBrowser logged-in screenshots from a
machine with access and add them to `docs/wp/evidence/`.
