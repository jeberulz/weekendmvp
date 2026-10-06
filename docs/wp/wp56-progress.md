# WP56 Progress - One design language for the public site

Append-only progress log. Do not rely on chat history for project state.

## 2026-10-06 - Setup

- **Branch/worktree:** `codex/wp56-public-design-unify` at `.worktrees/wp56-public-design`, from `origin/main` 0f79043f. A worktree was needed because the main checkout is being used by a parallel content session. WP55 is taken by `codex/wp55-price-acceptance`.
- **Assignment:** owner-approved redesign. See the plan and the artifact in `wp56-stories.md`.
- **File boundaries:**
  - S1 owns `components/public/*`, `HubShell`, `SiteFooter` and `MarketingNav`.
  - S2 owns `app/ideas/[slug]/collection.tsx`.
  - S3 owns `app/{build-with,ideas-for,solve}` and `components/hubs/*` other than `HubShell`.
  - S4 owns `app/startup-ideas/*`.
  - S5 owns the Wave 4 routes and `components/auth/AuthPageShell.tsx`.
  - S6 owns `app/globals.css` and the primitives cleanup.
- **Required checks:** `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`, the SEO snapshot diff, `a11y-check`.
- **Local data:** local Convex is not running, so `.env.development.local` (gitignored) points dev at the live deployment `first-squirrel-244`. Public read-only queries only; no forms submitted.
- **Initial risks:**
  - `app/ideas/[slug]` serves both idea pages and collections.
  - `use cache` pages can serve stale HTML after a deploy, and the revalidate secret can't be retrieved (see memory). This is a release risk to resolve before merge.

## 2026-10-06 - S0–S6 delivered

- **Actions taken:**
  - S0: SEO snapshot script, with the baseline captured over 66 pages.
  - S1: kit in `components/public/*`, warm-ink `SiteFooter` and light `HubShell`.
  - S2: collection hubs.
  - S3: build-with / ideas-for / solve (worker).
  - S4: `/startup-ideas` (worker).
  - S5: articles, newsletter, about, founder, privacy, 404, auth and links (worker).
  - Owner additions: cookie banner, preferences dialog, signup modal and mobile menu.
  - S6: deleted `hub-theme.ts`, `ReadingNav`, `AuraBackground`, and the `grid-lines` / `gradient-border-button` / beam / `flashlight-border` / `glow-filter` / `perspective-1000` CSS. The MegaNav default is now cream.
- **Decisions made:**
  - The `body`/`:root` dark defaults stay. Admin, preview and tenant surfaces still rely on them, and every public page paints its own paper.
  - `components/primitives/IdeaCard.tsx` is kept: the idea detail page's `RelatedIdeas` uses its cream theme.
  - `/articles` drops its decorative `_` cursor from the H1, and `/newsletter` gains a missing space in the H1. The owner accepted both.
- **Checks run:**
  - `npx tsc --noEmit`: clean.
  - `npm run lint`: 0 errors (warnings pre-existing).
  - `npm test`: pass. `wp44-idea-member-chrome` was updated to assert `PublicShell`.
  - `npm run build`: pass. Route render modes are identical to an `origin/main` build on all 79 routes.
  - `seo-snapshot diff`: only the two accepted H1 changes, across 66 pages.
  - axe WCAG 2.1 AA: 0 violations on 15 restyled pages, the signup modal, the cookie dialog and the mobile menu (desktop and 375px). Escape closes the overlays and focus returns.
- **Gotchas:**
  - Local `/_next/image` returns 400 for every OG PNG, on an untouched `main` build too; the live site returns 200. This is environmental.
  - The homepage has one pre-existing axe finding (`aria-prohibited-attr` on a span in `components/home`). It is out of scope.
  - `/startup-ideas` counts 228 while the homepage counts 225. This was already true on `main`.
- **Next:**
  - Owner review, then push and PR.
  - Resolve the stale `use cache` and revalidate-secret release risk before merge.

## 2026-10-06 - Idea count consistency (owner request)

- **Cause:** `/startup-ideas` and the hubs listed raw Convex `ideas` rows: 228 versus the homepage's 225. The three extras:
  - `expense-report-generator` and `client-portal`: retired in the manifest on 2026-04-21, but still in Convex.
  - `ai-built-app-code-audit`: a stale Convex-only row whose page answers 404 (see the WP46 E7 gate note).
- **Fix:** `lib/public/library.ts` is the one membership rule (manifest live ideas plus released editorial publications, minus retired ideas, engine drafts and withdrawn ideas), identical to the homepage. Every list in `components/hubs/hub-data.ts` and `/startup-ideas` passes through `onlyPublicIdeas`; "Browse N ideas" uses `publicLibraryTotal`. Regression test: `tests/home/public-library.test.ts`.
- **Result:**
  - The homepage, `/startup-ideas` (numeral, result line, ItemList) and the footer band all read 225.
  - Every category count on the hub tabs matches the homepage index.
  - SEO diff: 16 pages changed JSON-LD and lost internal links, all of it accounted for by those 3 slugs leaving their lists. No other change.
  - Checks: tests, lint (0 errors) and build pass; render modes are identical to `main`.
- **Not changed:**
  - The retired pages still answer 200 at their URLs, as before.
  - The dashboard catalogue's counts were left alone (out of scope).

## 2026-10-06 - Dashboard idea counts aligned (owner request)

- **Cause:** the member catalogue (`convex/platform/catalogPolicy.ts` → `inMemberCatalogue`) already dropped retired ideas and engine drafts. It still listed the stale Convex-only `ai-built-app-code-audit` row, so Explore showed 226 against a header total of 225 (the header comes from `getHomeData`).
- **Fix:**
  - `STALE_CATALOGUE_ROWS` is an explicit, documented exclusion inside `inMemberCatalogue`.
  - `libraryPage` now applies `inMemberCatalogue`, not only `isRetiredIdea`. Weekend plans and compare already use `inMemberCatalogue`, so they inherit the change.
- **Rejected alternative:** a manifest allow-list. It broke 32 Convex tests whose fixtures seed slugs that aren't in the manifest, and the public pages already apply the full allow-list in `lib/public/library.ts`.
- **Test:** `convex/wp44Library.test.ts` "WP56 library membership".
- **Checks:** tsc clean; lint 0 errors; `npm test` (including 476 Convex tests) passes; build passes.
- **Deploy:** the Convex functions deploy with the Vercel production build (`scripts/vercel-build.mjs`), so no manual deploy is needed.
