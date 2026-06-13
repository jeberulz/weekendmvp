---
title: "refactor: Update publish-idea / publish-article / publish-programmatic skills for Next.js + MDX + Convex"
type: refactor
status: active
date: 2026-06-13
---

# refactor: Update publishing skills for the Next.js + MDX + Convex architecture

## Summary

The `publish-idea`, `publish-article`, and `publish-programmatic` skills were written for the old static-HTML site and are now broken against the App Router rewrite: they generate `.html` into the wrong folders, hand-edit files that are now dynamically generated (`sitemap.xml`, `startup-ideas.html`, `articles.html`), and call three scripts that no longer exist (`audit-ideas.js`, `sync-idea-nav.js`, `inject-analytics.js`). This plan rewrites all three `SKILL.md` files to target the real pipeline — MDX body + `manifest.json` metadata + `seed:convex` + `og:generate` for content skills, and TypeScript config-object edits for programmatic pages — keeping `manifest.json` as the metadata source of truth and having the content skills automate seeding/OG end-to-end.

---

## Problem Frame

The project migrated from a static HTML site to Next.js App Router with MDX content sources and a Convex backend (see `docs/plans/2026-06-12-001-refactor-nextjs-convex-migration-plan.md`). The three publishing skills still describe the pre-migration workflow. Running any of them today produces files the app never renders, edits to dynamic-route outputs that get overwritten on build, and hard failures when they invoke deleted scripts. They need to be rewritten to match how content actually reaches a rendered page now.

---

## Requirements

- R1. `publish-idea` produces a `/ideas/{slug}` page that renders, appears in the startup-ideas grid and collection/programmatic hubs, and has an OG card — using the current MDX + manifest + Convex + OG pipeline.
- R2. `publish-article` produces a rendered `/articles/{slug}` page that appears in the articles index and has an OG card, using `content/articles/*.mdx` rich frontmatter + `articles/manifest.json` + OG generation.
- R3. `publish-programmatic` adds new tool / audience / problem / collection (category, revenue, build-time) hub pages by editing the hardcoded TypeScript config objects in the route files (and optional Convex reference-table data), not by rendering HTML templates.
- R4. No skill references deleted scripts (`audit-ideas.js`, `sync-idea-nav.js`, `inject-analytics.js`), the static `sitemap.xml`, `startup-ideas.html`, `articles.html`, `ideas/_template*.html`, or `articles/markdown/`.
- R5. `manifest.json` remains the metadata source of truth (per decision); content skills dual-write MDX body + manifest entry, then run `seed:convex` and `og:generate` themselves (full automation, per decision).
- R6. Each skill's YAML `description` frontmatter is updated so the `/skill` router and usage text reflect the new behavior (no "Generates HTML").

---

## Scope Boundaries

- Not refactoring the OG or Convex-seed pipeline to read metadata from MDX frontmatter — `manifest.json` stays the source of truth (explicit decision).
- Not changing app/runtime code (`app/`, `lib/`, `convex/`, `scripts/`). The programmatic skill *documents* editing `app/**/[param]/page.tsx` config objects, but this plan does not itself modify those routes.
- Not deleting the orphaned legacy assets (`ideas/*.html`, `ideas/_template*.html`, `startup-ideas.html`, `articles.html`). Cleanup is separate follow-up work.
- Not adding new automated tests/CI for skills (skills are markdown instruction docs; verification is manual dry-run + one sample publish).

### Deferred to Follow-Up Work

- Delete or archive orphaned legacy HTML (`ideas/*.html`, `ideas/_template*.html`, root `startup-ideas.html`, `articles.html`, `articles/markdown/`): separate cleanup PR.
- Prune the now-stale HTML/accessibility/email-gate and "edit sitemap.xml / startup-ideas.html" guidance in the root `CLAUDE.md`: separate PR (touches shared project doc, not a skill).
- Reconcile `publish-programmatic/data/problems.json` (superseded by `PROBLEM_PAGES` in `app/solve/[problem]/page.tsx`) — either delete it or repurpose as a seed reference: fold into U3 if cheap, else follow-up.

---

## Context & Research

### Relevant Code and Patterns

**Content rendering (MDX is the body source):**
- `lib/mdx.tsx` — `readMdxFile(dir, slug)`, `listMdxSlugs(dir)`, `Mdx` renderer. Slugs validated `^[a-z0-9-]+$`; files starting with `_` excluded.
- `app/ideas/[slug]/page.tsx` — three-tier resolution: MDX disk → Convex row (`bodyMode: "convex"`) → collection hub. `generateStaticParams` reads `content/ideas/*.mdx` + `COLLECTION_SLUGS`. Idea description falls back to `excerpt()` of first paragraph when absent.
- `app/articles/[slug]/page.tsx` — reads `content/articles/{slug}.mdx`; `ArticleFrontmatter = { slug, title, description, category?, publishedAt?, wordCount?, readMinutes?, heroAlt? }`. Article pages read frontmatter directly (description **required** in frontmatter, unlike ideas).

**Idea MDX frontmatter (verified): only `slug` + `title`.** 0 of 57 idea MDX files carry a `description`. Body sections by convention: `## The Problem`, `## The Solution` (with `**How it works:**` numbered steps — parsed by the page's HowTo schema regex), `## Market Research`, `## Competitive Landscape`, `## Business Model`, `## Recommended Tech Stack`, `## AI Prompts to Build This`, `## Sources`.

**Metadata source of truth (manifest.json — NOT legacy):**
- `ideas/manifest.json` `ideas[]` entries carry `slug, title, publishedAt, category, buildTime, revenueGoal, applicationCategory, tools[], audiences[], source, scores{opportunity,pain,timing,builder_confidence}, description, og{subject,accent,status}, provenance, researchLevel`. Read by `scripts/seed-convex.mjs` (→ Convex) **and** `scripts/generate-og-cards.mjs` (→ OG PNG).
- `articles/manifest.json` `articles[]` entries carry `slug, title, description, wordCount, readMinutes, og{subject,accent,status}`. Read by OG generation + seed-convex.
- `convex/schema.ts` `ideas` table mirrors the manifest fields + `bodyMode: "mdx"|"convex"` + `body?`. `articles` table: `slug, title, description, publishedAt?, wordCount?, readMinutes?, og?`.

**Convex powers the grids/hubs (so seeding is required for visibility):**
- `app/startup-ideas/page.tsx` — `fetchAllIdeas()` (Convex) primary, MDX fallback; ItemList JSON-LD generated dynamically from the ideas array.
- `app/articles/page.tsx` — filesystem MDX first, Convex overlay for `publishedAt`; ItemList generated dynamically.
- `components/hubs/hub-data.ts` — `fetchAllIdeas`, `fetchIdeasByCategory`, `fetchIdeasByRevenueGoal`, `fetchIdeasByAudience`, `fetchIdeasByTool` (used by programmatic hubs).

**Programmatic pages are hardcoded TS config objects (not templates):**
- `app/solve/[problem]/page.tsx` — `PROBLEM_PAGES` record (5 problems) → `PROBLEM_SLUGS`; ideas filtered by `categoryMatches` against Convex.
- `app/build-with/[tool]/page.tsx` — `TOOL_PAGES` record (8 tools) → `TOOL_SLUGS`; count/descriptions via `fetchIdeasByTool`, fallback `legacyCount`.
- `app/ideas-for/[audience]/page.tsx` — `AUDIENCE_PAGES` record (6 audiences) → `AUDIENCE_SLUGS`; ideas via `fetchIdeasByAudience`; Convex `audiences` ref table overrides static copy.
- `app/ideas/[slug]/collection.tsx` — `COLLECTIONS` record (6 category + 5 revenue + 3 build-time hubs) → `COLLECTION_SLUGS`.
- `app/sitemap.ts` — imports `AUDIENCE_SLUGS`, `PROBLEM_SLUGS`, `COLLECTION_SLUGS`, inlines `BUILD_WITH_SLUGS`, and auto-discovers `content/{ideas,articles,newsletter-pages}/*.mdx`. **Adding a slug to an exported config object auto-adds it to the sitemap** — no manual sitemap edit ever.

**Scripts (verified existence):**
- EXIST: `scripts/generate-og-cards.mjs` (flags: `--slug`, `--surface`, `--non-blocking`, `--force`, `--dry-run`, `--raw`), `scripts/seed-convex.mjs` (`--dry-run`, `--prod`, `--include-drafts`, `--only ideas|articles|newsletters|refs`).
- `package.json` scripts: `seed:convex` = `node scripts/seed-convex.mjs`; `seed:convex:dry`; `og:generate` = `node scripts/generate-og-cards.mjs`; `og:generate:force`; `og:generate:dry`.
- GONE (skills must stop referencing): `scripts/audit-ideas.js`, `scripts/sync-idea-nav.js`, `scripts/inject-analytics.js`. Also gone: `articles/markdown/` dir.
- `seed:convex` prerequisite: `convex/seed.ts` must be deployed (`npx convex dev` running, or `npx convex deploy`). It re-seeds the whole manifest idempotently (upsert by slug), defaults to the **dev** deployment.

### Institutional Learnings

- `docs/plans/2026-06-12-001-refactor-nextjs-convex-migration-plan.md` and `-002-...-marketing-component-extraction-plan.md` describe the migration that produced this architecture — useful background for why manifest + MDX + Convex coexist.
- `IMAGES.md` — OG prompt-writing guide (`og.subject` director's-note rules, accent palette: lime/mint/lavender/emerald/aubergine). Still current; both content skills should keep linking it.
- `ideas/SECTIONS.md` — still exists and still encodes the 7-section idea contract. The contract is still meaningful for body quality even though the `audit-ideas.js` enforcer is gone; the rewritten publish-idea should reference it as a manual checklist, not a script gate.

---

## Key Technical Decisions

- **Keep `manifest.json` as metadata source of truth** (user decision): content skills dual-write `content/{ideas,articles}/{slug}.mdx` (body) + a `manifest.json` entry (metadata), then `seed:convex` propagates to Convex and `og:generate` reads the same entry. No pipeline code change.
- **Full end-to-end automation** (user decision): `publish-idea` / `publish-article` run `npm run seed:convex` (dev) and `npm run og:generate --slug … --non-blocking` themselves as final steps, rather than printing commands. OG remains non-blocking (a Recraft/OpenAI failure must not fail the publish); seeding failure (e.g. Convex not running) should surface clearly with the fix (`npx convex dev`).
- **Idea MDX frontmatter stays minimal (`slug` + `title`).** Description/category/scores/og go in the manifest entry only — matches all 57 existing files and the page's `excerpt()` fallback. Do **not** invent richer idea frontmatter.
- **Article MDX frontmatter is rich** (`slug, title, description, category?, publishedAt?, wordCount?, readMinutes?, heroAlt?`) because the article page reads it directly; the `articles/manifest.json` entry duplicates the OG-relevant subset (`description, wordCount, readMinutes, og`).
- **Programmatic skill becomes a code-editing skill**: it edits the relevant `*_PAGES` / `COLLECTIONS` TS object and (optionally) seeds matching Convex ref-table copy, then relies on the exported `*_SLUGS` → `app/sitemap.ts` auto-wiring. No HTML, no `problems.json` template rendering.
- **Replace the dead `audit-ideas.js` gate with a manual section checklist** sourced from `ideas/SECTIONS.md` plus a body word-count sanity check the skill performs itself; remove `sync-idea-nav.js` and `inject-analytics.js` steps entirely (nav + analytics are handled by the shared App Router layout, not per-page injection).

---

## Open Questions

### Resolved During Planning

- Is `manifest.json` legacy? — No. It is read by `seed-convex.mjs` and `generate-og-cards.mjs` and is the metadata SoT. Confirmed by reading both scripts.
- Do new ideas need Convex seeding to appear in the grid/hubs? — Yes. `startup-ideas` and all hub pages query Convex first; MDX is only a build-time fallback for the individual page. Seeding is mandatory for visibility.
- Should skills edit `sitemap.xml`? — No. `app/sitemap.ts` auto-discovers MDX and imports the programmatic `*_SLUGS`. Manual sitemap edits are obsolete.

### Deferred to Implementation

- Exact analytics/nav wording to remove vs. keep — confirm against the actual `app/layout.tsx` / nav components while editing each skill (analytics is global now; verify there is no per-page hook the skill still owns).
- Whether `publish-programmatic` should also write a Convex ref-table seed for brand-new categories/audiences or assume `seed:convex` from manifest covers it — decide while writing U3 by checking how `seed-convex.mjs` sources ref tables vs. the hardcoded TS copy.

---

## Implementation Units

- U1. **Rewrite `publish-idea` SKILL.md for the MDX + manifest + Convex + OG pipeline**

**Goal:** `/publish-idea` produces a rendering `/ideas/{slug}` page that shows in the grid/hubs with an OG card, via the real pipeline.

**Requirements:** R1, R4, R5, R6

**Dependencies:** None

**Files:**
- Modify: `.claude/skills/publish-idea/SKILL.md`

**Approach:**
- Keep the two-mode sourcing (Mode A Ideabrowser MCP default, Mode B `--from-draft`) and the 7-call research stack / STOP rule — those are unaffected by the migration.
- Replace the entire "generate HTML" half (Steps 5–11) with the new sink sequence:
  1. Write `content/ideas/{slug}.mdx` — frontmatter **only** `slug` + `title`; body = the 7 canonical `##` sections (Problem, Solution w/ `**How it works:**` numbered steps, Market Research, Competitive Landscape, Business Model, Recommended Tech Stack, AI Prompts to Build This, Sources). Mirror an existing PASS-tier MDX file for rhythm (keep the Step 4.5 voice-check, but point it at two real `content/ideas/*.mdx` exemplars instead of the deleted HTML pages / `_audit.json`).
  2. Add the `ideas/manifest.json` entry (full provenance block, `og.subject`/`og.accent`, `og.status: "pending"`, `scores`, `source`). This step is preserved largely as-is — it is still correct.
  3. Manual section/word-count check against `ideas/SECTIONS.md` (replaces the deleted `audit-ideas.js --strict` gate): verify all 7 sections present, ≥ ~800 words body, no leftover placeholders.
  4. Run `npm run seed:convex` (dev) to push the idea into Convex (grid + hubs). Document the `npx convex dev` prerequisite and how to read a seed failure.
  5. Run `npm run og:generate -- --slug {slug} --surface idea --non-blocking`; flip/read `og.status`.
- Delete all references to: `ideas/_template.html`, `scripts/sync-idea-nav.js`, `scripts/audit-ideas.js`, `scripts/inject-analytics.js`, hand-editing `startup-ideas.html` (card + ItemList), hand-editing `sitemap.xml`. Add a one-line note that the grid card, ItemList JSON-LD, and sitemap entry are now generated automatically from Convex/MDX after seeding + build.
- Rewrite the embedded SEO/JSON-LD/accessibility/email-gate sections: the page's metadata, schema graph, nav, and analytics come from `app/ideas/[slug]/page.tsx` + layout, so the skill should stop emitting `<head>`/`<script>`/nav HTML and instead note what the route already provides. Keep only authoring guidance that affects MDX body quality.
- Update the YAML `description` frontmatter and both Output Report blocks to list the new file set (`content/ideas/{slug}.mdx`, `ideas/manifest.json`, Convex via seed, `image/og/idea/{slug}.png`).

**Patterns to follow:** An existing well-formed `content/ideas/*.mdx` (e.g. `ai-code-reviewer.mdx`) for body shape; the current manifest-entry block in the old SKILL.md (Step 7) for the metadata entry, which remains valid; `IMAGES.md` for `og.subject`.

**Test scenarios:**
- Happy path: Following the rewritten skill for one MCP idea yields `content/ideas/{slug}.mdx` (slug+title frontmatter), a manifest entry, a seeded Convex row, and an OG attempt — and `/ideas/{slug}` renders all 7 sections in `next dev`.
- Edge case: A slug with characters needing kebab-casing is normalized and passes the `^[a-z0-9-]+$` validation `lib/mdx.tsx` enforces.
- Error path: `npm run seed:convex` with no Convex dev running — the skill documents the failure signature and the `npx convex dev` fix, and the publish does not silently claim grid visibility.
- Error path: OG generation fails — `og.status: "failed"`, publish still reported success (non-blocking invariant preserved).
- Anti-regression: grep the final SKILL.md for `audit-ideas|sync-idea-nav|inject-analytics|_template.html|startup-ideas.html|sitemap.xml` returns no actionable step (only, at most, "no longer needed" notes).

**Verification:** A dry sample run (or close read) shows every referenced path/script exists; `/ideas/{slug}` renders; the idea appears on `/startup-ideas` after seeding.

---

- U2. **Rewrite `publish-article` SKILL.md for MDX articles + manifest + OG**

**Goal:** `/publish-article` produces a rendering `/articles/{slug}` page that appears in the articles index with an OG/hero card.

**Requirements:** R2, R4, R5, R6

**Dependencies:** None (parallel to U1; share the pipeline-fact wording established in U1)

**Files:**
- Modify: `.claude/skills/publish-article/SKILL.md`

**Approach:**
- Keep the topic queue (`topics/research.md`), the 7 frameworks, keyword research, and title-approval flow — all migration-independent.
- Replace HTML generation (Steps 8–13.5) with:
  1. Write `content/articles/{slug}.mdx` with **rich frontmatter** (`slug, title, description, category?, publishedAt, wordCount, readMinutes, heroAlt`) + markdown body (h2/h3, lists, code fences). Body keeps the framework structure and the 3+ CTAs to `/startup-ideas`.
  2. Append the `articles/manifest.json` entry (`slug, title, description, wordCount, readMinutes, og{subject,accent,status:"pending"}`).
  3. Run `npm run seed:convex` (or `--only articles`) and `npm run og:generate -- --slug {slug} --surface article --non-blocking`.
  4. Mark the topic PUBLISHED in `topics/research.md` (preserved).
- Remove: `articles/markdown/{slug}.md` step (dir gone — newsletter reuse now reads MDX directly), `scripts/inject-analytics.js`, hand-editing `articles.html` (5-place edit), hand-editing `sitemap.xml`, emitting `<head>`/nav/footer HTML. Note that the hero image, OG meta, JSON-LD, and index card are produced by `app/articles/[slug]/page.tsx` + `app/articles/page.tsx` from frontmatter + OG PNG.
- The `heroAlt` frontmatter field replaces the old in-HTML hero `<figure>` alt authoring — keep the alt-writing guidance, retarget it to the frontmatter field.
- Update YAML `description` frontmatter and Output Report to the new file set.

**Patterns to follow:** An existing `content/articles/*.mdx` (e.g. `how-to-build-your-first-app-in-a-weekend.mdx`) for frontmatter + body; existing `articles/manifest.json` entries for the OG subset; `ArticleFrontmatter` type in `app/articles/[slug]/page.tsx` as the authoritative field list.

**Test scenarios:**
- Happy path: Skill run for a queued topic yields `content/articles/{slug}.mdx` with all required frontmatter, a manifest entry, a seeded Convex row, and `/articles/{slug}` renders with hero + content + CTAs.
- Edge case: `description` missing/empty is caught — the article page requires it (no excerpt fallback), so the skill must enforce a non-empty frontmatter `description`.
- Error path: OG generation fails → `og.status: "failed"`, hero `<img>` 404s until retry, publish still succeeds (non-blocking).
- Anti-regression: grep final SKILL.md for `inject-analytics|articles/markdown|articles.html|sitemap.xml` returns no actionable step.

**Verification:** Referenced paths/scripts exist; `/articles/{slug}` and `/articles` render the new article after seeding + build.

---

- U3. **Rewrite `publish-programmatic` SKILL.md as a TS-config + Convex-ref editing skill**

**Goal:** `/publish-programmatic` adds a tool / audience / problem / collection hub by editing the route config objects (+ optional Convex ref data), with the page auto-wired into the sitemap.

**Requirements:** R3, R4, R6

**Dependencies:** None (can reference pipeline facts from U1)

**Files:**
- Modify: `.claude/skills/publish-programmatic/SKILL.md`
- Possibly modify/remove: `.claude/skills/publish-programmatic/data/problems.json` (now superseded by `PROBLEM_PAGES`) and `.claude/skills/publish-programmatic/keywords/research.md` (keep as research input)

**Approach:**
- Replace the whole "read template → fill `{{VARS}}` → write `index.html`" model with per-page-type edit targets:
  - `problem` → add an entry to `PROBLEM_PAGES` in `app/solve/[problem]/page.tsx` (fields per the `SolvePage` type: `slug, shortTitle, metaTitle, metaDescription, title, description, color, icon, problemIntro, problemStats, steps, categoryMatches[]`).
  - `tool` → add to `TOOL_PAGES` in `app/build-with/[tool]/page.tsx` (`ToolPage` type fields incl. `titlePattern` w/ `{count}`, `legacyCount`, `strengths`, `gettingStarted`, `prompts`).
  - `audience` → add to `AUDIENCE_PAGES` in `app/ideas-for/[audience]/page.tsx` (`AudiencePage` type: `positioning, advantages[], resources[]`, etc.).
  - `category` / `revenue` / `build-time` → add to `COLLECTIONS` in `app/ideas/[slug]/collection.tsx`.
- Document the data-flow split: editorial copy lives in the TS config; idea associations come from Convex queries (`categoryMatches`, `fetchIdeasByAudience/Tool`, collection filters), so for a brand-new category/audience the ideas must already carry that tag in `ideas/manifest.json` and be seeded.
- Document that adding the slug to the exported `*_PAGES`/`COLLECTIONS` object auto-includes it in `app/sitemap.ts` (no manual sitemap step), and that copy can be overridden at render by Convex ref tables (`categories`, `audiences`, …) seeded from manifest — note when to also update Convex ref data.
- Add a TypeScript-safety note: edits must satisfy the route's type (`SolvePage`/`ToolPage`/`AudiencePage`/collection shape); run `npm run typecheck` after editing.
- Remove all references to `ideas/_template-*.html`, `ideas/{slug}/index.html` output paths, `sitemap.xml` edits, and the `{{VAR}}` substitution tables. Repoint `problems.json` usage to `PROBLEM_PAGES` (and decide delete-vs-keep for the JSON file).
- Update YAML `description` frontmatter / usage examples.

**Patterns to follow:** The existing `PROBLEM_PAGES` / `TOOL_PAGES` / `AUDIENCE_PAGES` / `COLLECTIONS` literals in the four route files as the canonical entry shape; `app/sitemap.ts` for the auto-wiring proof.

**Test scenarios:**
- Happy path: Following the skill to add one new `problem` yields a valid `PROBLEM_PAGES` entry, `npm run typecheck` passes, `/solve/{slug}` renders with Convex-filtered ideas, and `/sitemap.xml` (the route) includes it.
- Edge case: New category/audience whose ideas aren't tagged yet — skill instructs tagging `ideas/manifest.json` + reseeding so the hub isn't empty.
- Error path: A config entry missing a required type field — `npm run typecheck` fails; skill lists the field set per type to prevent it.
- Anti-regression: grep final SKILL.md for `_template-|index.html|{{` returns no actionable HTML-generation step.

**Verification:** `npm run typecheck` clean after a sample entry; the new hub route renders and is in the sitemap route output.

---

- U4. **Cross-skill consistency pass + smoke verification**

**Goal:** The three rewritten skills are mutually consistent, reference only existing scripts/paths, and have been exercised once.

**Requirements:** R4, R5, R6

**Dependencies:** U1, U2, U3

**Files:**
- Modify (as needed): the three `SKILL.md` files for consistent shared wording (manifest SoT, seed/OG automation, sitemap auto-discovery)

**Approach:**
- Grep all three skills for dead references (`audit-ideas|sync-idea-nav|inject-analytics|_template|startup-ideas\.html|articles\.html|articles/markdown|sitemap\.xml|index\.html`) and confirm each remaining hit is an explicit "no longer needed" note, not an instruction.
- Confirm every script/flag the skills invoke resolves: `npm run seed:convex`, `npm run og:generate -- --slug … --surface … --non-blocking`, `npm run typecheck`, `npx convex dev`.
- Confirm the three `description:` frontmatter lines no longer say "HTML" and accurately describe the new outputs.
- Smoke test: run `npm run seed:convex -- --dry-run` and `npm run og:generate -- --dry-run` to prove the automation commands the skills now hand off to actually execute in this repo.

**Test scenarios:**
- Happy path: All three greps return zero actionable dead references.
- Integration: `npm run seed:convex -- --dry-run` and `npm run og:generate -- --dry-run` exit 0, proving the end-to-end automation steps the content skills invoke are valid.
- Consistency: The manifest-SoT and "sitemap is automatic" explanations are phrased the same across all three skills (no contradictory guidance).

**Verification:** Dry-run commands succeed; no dead references remain; descriptions are accurate.

---

## System-Wide Impact

- **Interaction graph:** Skills are instruction docs consumed by the `/skill` router; the `description:` frontmatter feeds routing, so wording changes alter when each skill is auto-invoked. No runtime code path changes.
- **Error propagation:** The content skills now hand off to `seed:convex` (can fail if Convex dev isn't running) and `og:generate` (non-blocking). The rewritten docs must make the seed-failure mode explicit so a user doesn't believe an unseeded idea is live.
- **API surface parity:** All three skills must describe the same manifest-SoT + sitemap-auto + seed/OG model consistently (U4 enforces this).
- **Unchanged invariants:** `manifest.json` schema, `app/sitemap.ts`, `lib/og/sources/*.mjs`, `scripts/seed-convex.mjs`, and all `app/**` routes are unchanged by this plan — only the skill docs change. OG non-blocking invariant is preserved.

---

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Skill instructs writing richer idea MDX frontmatter, diverging from the 57 existing files and the `excerpt()` contract | U1 explicitly pins idea frontmatter to `slug` + `title`; metadata goes to manifest only. |
| `seed:convex` automation writes to a live Convex deployment unexpectedly | Skills default to the **dev** deployment (no `--prod`), document the prerequisite, and reseed idempotently (upsert by slug). |
| Programmatic edits break the build via type errors | U3 mandates `npm run typecheck` after editing and lists required fields per route type. |
| Stale guidance lingers in root `CLAUDE.md` and contradicts the rewritten skills | Flagged as deferred follow-up; U4 at least makes the skills internally correct. |
| OG/seed command syntax drift (`--` arg passing through npm) | U4 dry-run smoke test verifies the exact invocations before sign-off. |

---

## Sources & References

- Related plans: `docs/plans/2026-06-12-001-refactor-nextjs-convex-migration-plan.md`, `docs/plans/2026-06-12-002-refactor-marketing-component-extraction-plan.md`
- Skills: `.claude/skills/publish-idea/SKILL.md`, `.claude/skills/publish-article/SKILL.md`, `.claude/skills/publish-programmatic/SKILL.md`
- Pipeline code: `lib/mdx.tsx`, `app/sitemap.ts`, `app/ideas/[slug]/page.tsx`, `app/articles/[slug]/page.tsx`, `app/solve/[problem]/page.tsx`, `app/build-with/[tool]/page.tsx`, `app/ideas-for/[audience]/page.tsx`, `app/ideas/[slug]/collection.tsx`, `convex/schema.ts`, `scripts/seed-convex.mjs`, `scripts/generate-og-cards.mjs`, `lib/og/sources/*.mjs`
- Data: `ideas/manifest.json`, `articles/manifest.json`, `ideas/SECTIONS.md`, `IMAGES.md`
