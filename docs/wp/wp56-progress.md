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
