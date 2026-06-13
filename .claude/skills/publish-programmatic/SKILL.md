---
name: publish-programmatic
description: "Add a programmatic SEO hub (tool / audience / problem / category / revenue / build-time) by editing the hardcoded TypeScript config object in its App Router route file — NOT by rendering HTML templates. Editorial copy lives in the TS config; idea associations come from Convex (tag ideas in ideas/manifest.json + seed). Validates with npm run typecheck; the sitemap auto-wires from exported *_SLUGS. Usage: /publish-programmatic {page-type} {slug}"
---

# Publish Programmatic SEO Pages

Add category, tool, audience, revenue, and problem hub pages for Weekend MVP's
programmatic SEO strategy.

> **Architecture (read first).** Each programmatic page **type** is a single
> hardcoded TypeScript **config object** inside its App Router route file.
> Adding a page means adding one typed entry to that object — there are **no
> HTML templates, no `{{VAR}}` substitution, and no `index.html` outputs**.
> Editorial copy lives in the config; the **list of ideas** shown on each hub
> comes from **Convex** queries at render time. The sitemap is generated
> automatically from the exported slug arrays. The whole job is: edit a typed
> object, make sure the ideas are tagged + seeded, and run `npm run typecheck`.

---

## Usage

```
/publish-programmatic {page-type} {slug}
```

**Page Types → edit target:**

| Page type | URL | Config object | File |
|-----------|-----|---------------|------|
| `problem` | `/solve/{slug}` | `PROBLEM_PAGES` | `app/solve/[problem]/page.tsx` |
| `tool` | `/build-with/{slug}` | `TOOL_PAGES` | `app/build-with/[tool]/page.tsx` |
| `audience` | `/ideas-for/{slug}` | `AUDIENCE_PAGES` | `app/ideas-for/[audience]/page.tsx` |
| `category` | `/ideas/{slug}` | `COLLECTIONS` (`kind: "category"`) | `app/ideas/[slug]/collection.tsx` |
| `revenue` | `/ideas/{slug}` | `COLLECTIONS` (`kind: "revenue"`) | `app/ideas/[slug]/collection.tsx` |
| `build-time` | `/ideas/{slug}` | `COLLECTIONS` (`kind: "buildTime"`) | `app/ideas/[slug]/collection.tsx` |

Slugs must be kebab-case (`^[a-z0-9-]+$`).

**Examples:**
- `/publish-programmatic tool windsurf` — add a Windsurf entry to `TOOL_PAGES`
- `/publish-programmatic audience indie-hackers` — add to `AUDIENCE_PAGES`
- `/publish-programmatic problem onboarding` — add to `PROBLEM_PAGES`
- `/publish-programmatic category fintech` — add a `category` entry to `COLLECTIONS`
- `/publish-programmatic revenue 20k-month` — add a `revenue` entry to `COLLECTIONS`

**Current inventory (for reference):** 5 problems, 8 tools, 6 audiences, and
14 collection hubs (6 category + 5 revenue + 3 build-time). Read the live config
object before adding — it is the source of truth for the exact shape.

---

## How the data flows (critical)

Each hub page renders from **two independent sources**:

1. **Editorial copy → the TS config object.** Hero, titles, meta description,
   positioning, steps, prompts, advantages, etc. live in the route file's
   config record. This is what you edit.
2. **The list of ideas → Convex.** At render time the page calls a Convex query
   (`fetchAllIdeas`, `fetchIdeasByCategory`, `fetchIdeasByRevenueGoal`,
   `fetchIdeasByAudience`, `fetchIdeasByTool`) and filters/sorts the results.
   The config does **not** list ideas.

**Consequence for brand-new categories / audiences / tools:** the hub renders
**empty** unless ideas are already tagged with that slug. Before (or alongside)
editing the config you must:

- Add the tag to the relevant ideas in `ideas/manifest.json`
  (`category`, `audiences[]`, `tools[]`, `buildTime`, or `revenueGoal`), **then**
- Run `npm run seed:convex` to push the tagged ideas into Convex.

How each type resolves its idea pool:

| Type | Query | Tag the ideas need |
|------|-------|--------------------|
| `problem` | `fetchAllIdeas()` filtered by `categoryMatches[]` | ideas must carry one of the referenced `category` values (reuse existing categories — no new tag needed) |
| `tool` | `fetchIdeasByTool(slug)` | `tools: ["{slug}"]` in manifest |
| `audience` | `fetchIdeasByAudience(slug)` | `audiences: ["{slug}"]` in manifest |
| `category` | `fetchIdeasByCategory(slug)` | `category: "{slug}"` in manifest |
| `revenue` | `fetchIdeasByRevenueGoal(slug)` | `revenueGoal: "{slug}"` in manifest |
| `build-time` | `fetchAllIdeas()` filtered by `buildTimeValues[]` | ideas must carry a matching `buildTime` hour value |

### Convex reference-table overrides

The seed script (`scripts/seed-convex.mjs` → `buildReferenceTables`) also seeds
reference tables (`categories`, `audiences`, `revenue_goals`, `build_times`,
`tools`) **from the corresponding blocks in `ideas/manifest.json`** (e.g.
`manifest.categories[]`, `manifest.audiences[]`, `manifest.tools[]`).

Two of the route files prefer the Convex row over the static config **at render
time** (the static config is only the build-time / Convex-down fallback):

- **`tool`** pages: the Convex `tools` row overrides
  `description`, `url`, `strengths`, `gettingStarted`.
- **`audience`** pages: the Convex `audiences` row overrides
  `description` and `resources`.

`problem` and `COLLECTIONS` (category/revenue/build-time) pages do **not** read
ref tables — their copy is the static config only.

**So:** for a brand-new `tool` or `audience` whose copy you want Convex to serve
(not just the static fallback), also add a matching block to `manifest.tools[]`
or `manifest.audiences[]` and reseed. For `category`/`revenue`/`build-time`/
`problem`, the static config in the route file is sufficient on its own.

---

## The sitemap is automatic (with one exception)

`app/sitemap.ts` **imports** `AUDIENCE_SLUGS`, `COLLECTION_SLUGS`, and
`PROBLEM_SLUGS` from the route files. Each route exports
`export const X_SLUGS = Object.keys(X_PAGES)` (or `COLLECTIONS`). So **adding an
entry to `PROBLEM_PAGES`, `AUDIENCE_PAGES`, or `COLLECTIONS` automatically adds
the page to the sitemap** — never hand-edit a sitemap.

**Exception — tools.** `app/sitemap.ts` does **not** import `TOOL_SLUGS`; it
**inlines** a `BUILD_WITH_SLUGS` array. After adding a tool to `TOOL_PAGES` you
must **also add the slug to the `BUILD_WITH_SLUGS` array in `app/sitemap.ts`**
(keep it alphabetically sorted, matching the existing entries). This is the only
manual sitemap touch in this skill, and it edits `app/sitemap.ts` — never a
`.xml` file.

---

## Workflow

### Step 1 — Read the live config object

Open the route file for the page type and read the existing config record and
its TypeScript type. **The type is the contract.** Mirror an existing entry's
shape exactly — copy a neighbouring entry as a starting template rather than
inventing fields. The per-type field lists below are a summary; the route file
is authoritative.

### Step 2 — Confirm ideas are tagged + seeded

Decide which ideas should appear on the hub. Check `ideas/manifest.json`:

- For `tool` / `audience` / `category` / `revenue`: at least ~3 ideas should
  carry the matching tag (`tools[]`, `audiences[]`, `category`, `revenueGoal`).
  If not, add the tag to the relevant ideas now.
- For `problem`: pick `categoryMatches[]` from **existing** category values that
  already have ideas (no new tagging required).
- For `build-time`: pick `buildTimeValues[]` from existing `buildTime` hour
  values in the manifest.

If you added/changed any manifest tags, run `npm run seed:convex` (Step 5) so
Convex reflects them — otherwise the hub renders empty.

### Step 3 — Add the typed config entry

Add one entry to the config object, satisfying every required field of the type.
Add the entry near related ones and keep the file's formatting. Field summaries:

**`problem` → `PROBLEM_PAGES` (type `SolvePage`)**
`slug`, `shortTitle`, `metaTitle`, `metaDescription`, `title` (hero h1, "How to
Automate X" pattern), `description`, `color` (`HubColor`), `icon` (a `lucide-react`
component, imported at the top of the file), `problemIntro`, `problemStats`
(`{ stat }[]`), `steps` (`{ name, text }[]`), `categoryMatches` (string[] of
existing Convex category slugs).

**`tool` → `TOOL_PAGES` (type `ToolPage`)**
`slug`, `name`, `h1`, `titlePattern` (must contain the literal `{count}`
placeholder — replaced with the live idea count), `legacyCount` (number; the
Convex-down fallback count baked into the title), `metaDescription`,
`description`, `url`, `icon` (`LucideIcon`), `color`, `gradient` (literal
Tailwind gradient classes), `operatingSystem`, `schemaDescription`,
`strengths` (string[]), `gettingStarted` (string[]), `prompts`
(`{ label, prompt }[]` — may be `[]`).
Then **also** add the slug to `BUILD_WITH_SLUGS` in `app/sitemap.ts`, and
optionally to the `TOOL_TILES` array (the "Explore Other Tools" footer) in the
same route file.

**`audience` → `AUDIENCE_PAGES` (type `AudiencePage`)**
`slug`, `name`, `title`, `metaDescription`, `description`, `color`, `icon`
(`LucideIcon`), `skillChip`, `timeChip`, `positioning`, `accentAdvantages`
(boolean), `advantages` (`{ icon, title, description }[]` — or build them from
traits via the file's `traitsToAdvantages(...)` helper), `resources`
(`{ title, url, description }[]`). Optionally add the slug to the
`AUDIENCE_TILES` array (the "Ideas For Other Audiences" footer) in the same file.

**`category` / `revenue` / `build-time` → `COLLECTIONS` (type `CollectionDef`)**
`slug`, `kind` (`"category" | "revenue" | "buildTime"`), `title`
("… Startup Ideas" pattern), `description`, `color`, `icon`. For `kind:
"buildTime"` also set `buildTimeValues` (string[] of manifest `buildTime` hour
values that qualify).

### Step 4 — Type-check

```bash
npm run typecheck
```

This (`tsc --noEmit`) is the validation gate that **replaces** the old
"all `{{VAR}}` replaced" check. A missing or mistyped field (wrong `color`, a
non-imported icon, a missing `categoryMatches`, `{count}` left out of a tool's
`titlePattern`, etc.) fails here. Fix until it passes. Optionally also run
`npm run build` for a full render check.

### Step 5 — Seed Convex (if you touched manifest tags or ref blocks)

```bash
npm run seed:convex            # dev deployment; upserts by slug, idempotent
npm run seed:convex -- --prod   # production deployment — REQUIRED for live hub/grid visibility
# or scope it:
npm run seed:convex -- --only refs            # just the reference tables (dev)
npm run seed:convex -- --only refs --prod     # ...and on production
```

**Live hubs read the PRODUCTION Convex deployment**, so a dev-only seed updates
local preview but not the live site. Always run the `--prod` seed too; the prod
upsert auto-triggers cache revalidation (`/api/revalidate`) so the hub updates
within seconds, no redeploy.

**Prerequisite:** the Convex dev deployment must be running
(`npx convex dev` in another terminal) or deployed; the `--prod` seed needs
production deployment access. If seeding fails with a connection error, that is
the fix — surface it clearly; do **not** claim the hub is populated until the
(prod) seed succeeds. Use `npm run seed:convex -- --dry-run` to preview without
writing.

> Pure config-only edits (e.g. a `problem` reusing existing categories) need no
> reseed — the ideas are already in Convex. Reseed only when you changed
> `ideas/manifest.json` tags or ref blocks.

### Step 6 — Verify

- `npm run typecheck` is clean.
- In `npm run dev`, the new hub route renders (`/solve/{slug}`,
  `/build-with/{slug}`, `/ideas-for/{slug}`, or `/ideas/{slug}`) and shows ≥3
  ideas (not the empty-state message).
- The new slug appears in the sitemap route output (`/sitemap.xml` served by
  `app/sitemap.ts`) — automatic for problem/audience/collection; for tools,
  confirm you added it to `BUILD_WITH_SLUGS`.

### Step 6.5 — Deploy to production (REQUIRED for the hub to exist live)

Programmatic hubs are **TS config objects in route files** (`app/solve|build-with|ideas-for/...`) — they live in code, so the hub route does not exist in production until the code is **deployed**. The `--prod` Convex seed only refreshes the *ideas data* the hub queries; it cannot create a route that isn't in the deployed build.

```bash
git add <route file> app/sitemap.ts ideas/manifest.json   # whichever you touched
git commit -m "feat(hub): add {page_type} hub {slug}"
git push origin main   # triggers the Vercel production deploy
```

Confirm after deploy (~1-2 min): `curl -s -o /dev/null -w "%{http_code}\n" https://www.weekendmvp.app/{path}/{slug}` → expect **200**. Do **not** report the hub as live until it returns 200. If no push was authorized, report it as **staged locally**, not live.

### Step 7 — Report

```markdown
## Published: {PAGE_TYPE} hub — {NAME}

**Edited:**
- {route file}: added "{slug}" to {CONFIG_OBJECT}
- app/sitemap.ts: added "{slug}" to BUILD_WITH_SLUGS   (tools only)
- ideas/manifest.json: tagged {n} ideas / added ref block   (if applicable)

**Verification:**
- npm run typecheck: pass
- /{path}/{slug} renders with {count} ideas
- slug present in sitemap route output
- **Deploy / live status:** {LIVE — pushed, Vercel deployed, /{path}/{slug} returns 200 | STAGED — local only, route 404s until `git push` (Step 6.5)}

**Page details:**
- URL: https://weekendmvp.app/{path}/{slug}
- Idea source: {Convex query} → {count} ideas
- Target keywords: {primary}, {secondary}

**Convex:**
- seed:convex run: {yes/no} ({reason})
- ref-table override active: {tools/audiences only — yes/no}
```

---

## Per-type field reference (summary)

These mirror the TypeScript types in the route files. **Always re-read the live
type before editing** — the route file wins if this summary drifts.

### `SolvePage` (`PROBLEM_PAGES`)
`slug · shortTitle · metaTitle · metaDescription · title · description · color ·
icon · problemIntro · problemStats[{stat}] · steps[{name,text}] · categoryMatches[]`

### `ToolPage` (`TOOL_PAGES`)
`slug · name · h1 · titlePattern("…{count}…") · legacyCount · metaDescription ·
description · url · icon · color · gradient · operatingSystem · schemaDescription ·
strengths[] · gettingStarted[] · prompts[{label,prompt}]`
*(plus: add slug to `BUILD_WITH_SLUGS` in `app/sitemap.ts`)*

### `AudiencePage` (`AUDIENCE_PAGES`)
`slug · name · title · metaDescription · description · color · icon · skillChip ·
timeChip · positioning · accentAdvantages · advantages[{icon,title,description}] ·
resources[{title,url,description}]`

### `CollectionDef` (`COLLECTIONS`)
`slug · kind("category"|"revenue"|"buildTime") · title · description · color ·
icon · buildTimeValues[]?(buildTime only)`

---

## `HubColor` values

`color` and (for `CollectionDef`) the theme accent must be a valid `HubColor`
from `components/hubs/hub-theme.ts`. Read that file for the current allowed set
(e.g. `blue`, `purple`, `emerald`, `amber`, `rose`, `orange`, `pink`, `violet`,
`cyan`, `white`). An invalid value fails `npm run typecheck`.

Icons are `lucide-react` components — import the icon at the top of the route
file before referencing it in your entry (an un-imported icon fails typecheck).

---

## Schema, metadata, and accessibility — already handled by the route

You do **not** author any `<head>`, JSON-LD, nav, or analytics markup. Each
route already builds, from your config entry:

- Page `<title>`, meta description, canonical, OpenGraph/Twitter tags
  (`generateMetadata`).
- JSON-LD graph — `HowTo` (problem/tool), `SoftwareApplication` (tool),
  `CollectionPage` + `ItemList` (audience/collection), `BreadcrumbList`,
  `Person`, `WebSite` — via `lib/seo.ts` helpers.
- The shared `HubShell` layout, nav, breadcrumbs, idea grid, CTA, and the
  accessible markup (aria labels, focus states).

Your job is just clean, accurate copy in the config fields.

---

## Data files in this skill

- **`keywords/research.md`** — keyword clusters and volumes per page type.
  **Keep** as a research input when choosing slugs and writing meta copy.
- **`data/problems.json`** — *deprecated / removed.* Problem-page content now
  lives in `PROBLEM_PAGES` in `app/solve/[problem]/page.tsx`, which is the
  single source of truth. Do not reintroduce a JSON template source.

---

## Extending — quick recipes

### Add a new tool
1. Tag relevant ideas with `tools: ["{slug}"]` in `ideas/manifest.json`
   (optionally add a `manifest.tools[]` block for Convex-served copy).
2. Add a `TOOL_PAGES` entry in `app/build-with/[tool]/page.tsx`.
3. Add the slug to `BUILD_WITH_SLUGS` in `app/sitemap.ts`.
4. `npm run seed:convex` → `npm run typecheck` → verify `/build-with/{slug}`.

### Add a new audience
1. Tag ideas with `audiences: ["{slug}"]` (optionally add `manifest.audiences[]`).
2. Add an `AUDIENCE_PAGES` entry in `app/ideas-for/[audience]/page.tsx`.
3. `npm run seed:convex` → `npm run typecheck` → verify `/ideas-for/{slug}`.

### Add a new category / revenue / build-time hub
1. Tag ideas with `category` / `revenueGoal` / `buildTime` in the manifest.
2. Add a `COLLECTIONS` entry (set `kind`, plus `buildTimeValues` for buildTime)
   in `app/ideas/[slug]/collection.tsx`.
3. `npm run seed:convex` → `npm run typecheck` → verify `/ideas/{slug}`.

### Add a new problem
1. Choose `categoryMatches[]` from existing category slugs that already have ideas.
2. Add a `PROBLEM_PAGES` entry in `app/solve/[problem]/page.tsx`. (No reseed
   needed if you reused existing categories.)
3. `npm run typecheck` → verify `/solve/{slug}`.

---

## Validation checklist

- [ ] Read the live config object + its TS type before editing
- [ ] Entry added with **every** required field (mirrors a neighbouring entry)
- [ ] `color` is a valid `HubColor`; `icon` imported in the route file
- [ ] (tool) `titlePattern` contains the literal `{count}`; slug added to
      `BUILD_WITH_SLUGS` in `app/sitemap.ts`
- [ ] Ideas tagged in `ideas/manifest.json` and **seeded to dev AND prod** (`npm run seed:convex` + `npm run seed:convex -- --prod` — prod required for live hub visibility)
- [ ] **Deployed (Step 6.5):** committed + pushed the route/config changes (git push → Vercel) so the hub route exists in prod; confirmed `/{path}/{slug}` returns 200 live. (If no push authorized, reported it as staged, NOT live.)
      so the hub isn't empty — ≥3 ideas
- [ ] `npm run typecheck` passes
- [ ] Hub route renders in `npm run dev` and shows the curated ideas
- [ ] New slug appears in the sitemap route output (auto for problem/audience/
      collection; manual `BUILD_WITH_SLUGS` for tools)
- [ ] Meta description < 160 chars, title < 60 chars
