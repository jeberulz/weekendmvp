# WP46-E6 pre-implementation public reader inventory

Audit date: 2026-10-03. The repository is **public** (`gh repo view`), so an unreleased revision cannot be committed to a branch in this repository, uploaded as a public CI artifact, or exposed on an unprotected Vercel preview. The E6 staging adapter needs private storage and a protected preview. The existing Git MDX files are the legacy public baseline until a verified per-slug cutover.

| Surface | Current source | E6 requirement |
| --- | --- | --- |
| `/ideas/[slug]` HTML, RSC, metadata, JSON-LD | `app/ideas/[slug]/page.tsx`; cached MDX-first resolver with Convex fallback | Resolve the active exact version outside the content cache before streaming; real 404 on removal; no MDX fallback after an editorial unpublish. |
| `/startup-ideas` | `convex/ideas.list`, merged with `ideas/manifest.json` and MDX; entire page cached for hours | Gate both Convex and static fallback. Backend outage must not re-add removed slugs. |
| Homepage, weekly picks, highlights and counts | `lib/home/data.ts` reads manifest and MDX inside an hour-long cache | Filter by live pointer before cached presentation; update versioned metadata/body and avoid stale picks. |
| Sitemap | `app/sitemap.ts` lists filesystem MDX | Remove unpublished slugs and add newly activated ones with verified release lastmod. Fail closed if the visibility source is unavailable. |
| Category, tool, audience and collection hubs; related rail; today redirect | `convex/ideas.ts` via `components/hubs/hub-data.ts`, `app/ideas/[slug]/collection.tsx`, `app/ideas/today/route.ts` | All public catalogue queries must exclude hidden rows and include activated projections. |
| Member library, plans, previews, compare, collections, prompts | `convex/platform/**` and `lib/dashboard/idea-prompts.ts` | No new plan/export from hidden ideas; existing owner-scoped saved work stays readable without revealing removed public body. |
| `/api/ideas/prompts`, `/api/ideas/prompt-pack` | `readCanonicalIdeaBody()` prefers MDX before the Convex row; prompt extraction cached for hours | Resolve the approved live body through the same gate, no private revision or removed-body fallback. |
| `/build/[slug]` and OG/asset paths | Public Convex lookup and static `public/image/og/idea/*` | Withhold unpublished generated content/metadata, including direct static asset URLs in the takedown scope. |

At the audit date, release seams were **not** evidence of a working worker: `convex/editorial/service.ts` exposed internal queue/advance functions, but no scheduler called them, and a `completed` report could advance the fixture state machine without proving public delivery. This inventory drove the E6 implementation. Current architecture and activation steps are in `e6-release-runbook.md`.

Baseline cutover gate: inventory the deployed commit and production manifest/MDX/Convex rows, map every imported legacy slug to its exact active baseline, compare hashes and coverage, and rehearse 404/rollback under warm cache and backend failure. Do not infer production baseline solely from the local checkout or the private import count.
