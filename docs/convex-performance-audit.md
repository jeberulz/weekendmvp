# Convex performance audit

Date: 2026-07-28
Scope: code-level audit plus safe local-only fixes
Branch: `feat/wp11-convex-performance-audit`

## Executive summary

`ideas.relatedFor` was the dominant cost because every distinct idea slug caused an indexed point lookup followed by a newest-first read of **every full idea document**. The function then filtered and limited in JavaScript. The public page displays four small cards, but the query paid for every row and returned full documents.

The implementation now:

1. reads the current idea by the existing `by_slug` index;
2. reads at most `limit + 1` same-category candidates from `by_category_publishedAt`;
3. returns immediately when those candidates fill the rail; and
4. only for a future sparse category, iterates newest-first until the shared-audience fallback is full.

All 12 current categories contain at least seven ideas, so the public four-card rail takes the six-document path for every one of the 140 locally seeded ideas. The pre/post result checksum across all 140 slugs is identical.

The other safe change removes broad `referenceTables.all` calls from public pages. Tool and audience hubs now make indexed single-row lookups, while the startup-ideas filter reads only the bounded categories table.

Estimated monthly database I/O after these changes is **155-190 MB**, below the 250 MB objective. The lower estimate scales the measured read-set reduction; the upper estimate assumes only a conservative 90% reduction in related-query I/O and assigns no savings to the reference-table fix.

## Baseline evidence

Dashboard evidence supplied by the owner:

| Metric                         |        Baseline |
| ------------------------------ | --------------: |
| Total database I/O             | 710.19 MB/month |
| Total function calls           |       87K/month |
| Read share of database I/O     |           98.6% |
| `ideas.relatedFor` production  |       482.64 MB |
| `ideas.relatedFor` development |        97.44 MB |
| `ideas.byTool` production      |        39.00 MB |
| `ideas.byAudience` production  |        37.36 MB |
| `ideas.list` production        |         8.29 MB |
| `ideas.byAudience` development |         7.08 MB |

Production call counts supplied by the owner:

| Function              | Calls |
| --------------------- | ----: |
| `ideas.bySlug`        |   33K |
| `ideas.relatedFor`    |   16K |
| `referenceTables.all` |   11K |
| `ideas.byTool`        |  7.7K |
| `ideas.list`          |  3.5K |
| `ideas.byAudience`    |  3.4K |

`ideas.relatedFor` therefore averaged approximately:

`482.64 MB / 16,000 = 30.17 KB of database I/O per production call`

The dashboard baseline remains authoritative. The local CLI does not expose local insights: `convex insights --deployment local` attempted a control-plane usage lookup for the local deployment name and returned `DeploymentNotFound`.

## Local deployment and data measurements

Validation used a fresh local backend at `http://127.0.0.1:3210`. No data was transferred from another deployment. The current repository seed produced:

- 140 ideas;
- 12 categories, with category counts from 7 to 40;
- 10 audiences;
- 10 tools;
- 5 revenue goals;
- 4 build times; and
- 5 problems.

Serialized local Convex result sizes include system fields but exclude storage/index-engine overhead:

| Dataset       | Rows | Total JSON | Mean row |     p50 |     p95 |     Max |
| ------------- | ---: | ---------: | -------: | ------: | ------: | ------: |
| Ideas         |  140 |  168,463 B |  1,203 B | 1,111 B | 1,733 B | 2,374 B |
| Categories    |   12 |   12,366 B |  1,031 B | 1,028 B | 1,113 B | 1,660 B |
| Audiences     |   10 |    9,945 B |    995 B |   997 B | 1,078 B | 1,088 B |
| Tools         |   10 |    7,130 B |    713 B |   825 B |   955 B |   967 B |
| Revenue goals |    5 |    3,527 B |    705 B |   706 B |   707 B |   724 B |
| Build times   |    4 |    1,565 B |    391 B |   389 B |   401 B |   401 B |
| Problems      |    5 |      650 B |    130 B |   130 B |   135 B |   140 B |

Every current seeded idea uses `bodyMode: "mdx"`, so the local rows do not contain `body`. They do contain optional metadata such as `provenance`, `scores`, and `og`. The schema still permits a large `body` and arbitrary `provenance`, making any full-table idea reader vulnerable to row-size growth (`convex/schema.ts:20-39`).

## Root causes

### 1. `ideas.relatedFor`: full-table reads before filtering

Before this work, `relatedFor` read the current idea by `by_slug`, then called `.collect()` over `by_publishedAt`, excluded the current slug, built category and audience arrays in JavaScript, concatenated them, and finally sliced to the UI limit.

The corrected code is at `convex/ideas.ts:179-239`:

- current idea: one `by_slug` point read (`convex/ideas.ts:188-191`);
- same category: `by_category_publishedAt`, descending, `take(max + 1)` (`convex/ideas.ts:199-205`);
- self exclusion and limit: in memory over at most 13 rows (`convex/ideas.ts:206-209`);
- audience fallback: newest-first async iteration that stops when full (`convex/ideas.ts:215-237`);
- response: only `slug`, `title`, and `category`, the fields consumed by the card component (`convex/ideas.ts:15-20`, `components/ideas/RelatedIdeas.tsx:42-52`).

Why the old path produced approximately 30 KB/call rather than the local 168 KB full JSON size:

- Convex dashboard database I/O is not serialized response JSON;
- identical query arguments can be served from the query cache;
- `relatedFor` has high argument cardinality because every slug is a different query;
- production row counts and optional-field population may differ from the current local seed; and
- storage accounting/compression differs from JSON size.

Those factors change the exact byte number, but not the code-level cause: a cache miss read every idea document before selecting four cards.

### 2. `ideas.byTool` and `ideas.byAudience`: array membership scans

`byTool` and `byAudience` still read all full idea documents and filter array fields in JavaScript (`convex/ideas.ts:116-159`). They then sort by `scores.builder_confidence` and cap at 30.

This is inefficient but cannot be corrected with a simple index:

- `tools` and `audiences` are array fields (`convex/schema.ts:18-19`);
- the required membership predicate is not served by the existing indexes;
- exact result order is builder-confidence descending, not publish-date order; and
- a correct indexable representation requires relation/digest rows, dual writes, a backfill, and a cutover.

That is migration-heavy and intentionally not implemented in this work package.

### 3. `ideas.list`: full-document pagination for card/list consumers

`list` is indexed and paginated (`convex/ideas.ts:55-81`), but each page item is a full idea document. The startup archive drains it in 200-row pages (`app/startup-ideas/page.tsx:110-123`), and collection/problem hubs share the same helper (`components/hubs/hub-data.ts:101-126`).

The consumers need more than the related rail—description, scores, application category, build time, and research level—but not `body` or large provenance. Convex does not provide storage-level field projection from a full document, so returning a smaller object alone would not reduce database I/O. A digest/document split would require a migration and was not implemented.

### 4. `ideas.bySlug`: high call count, but an appropriate point read

`bySlug` uses `by_slug` and `.unique()` (`convex/ideas.ts:43-53`). The full document is necessary on the idea detail path because the row can supply the body, metadata chips, scores, tools, audiences, JSON-LD, and fallback content (`app/ideas/[slug]/page.tsx:153-205`, `app/ideas/[slug]/page.tsx:377-425`).

The Next.js resolver is cached for hours and tagged by idea and collection (`app/ideas/[slug]/page.tsx:172-180`). Both metadata and page rendering call the same cached resolver (`app/ideas/[slug]/page.tsx:221-227`, `app/ideas/[slug]/page.tsx:351-364`). No duplicate uncached Convex read was found in that flow.

Some `bySlug` calls come from curated tool rails: the application deliberately resolves each editorial slug independently so curation is not constrained by the 30-item tool/audience result cap (`components/hubs/hub-data.ts:56-77`). Batching those lookups could reduce function-call overhead, but not the underlying document bytes; it was not needed to meet the database-I/O target.

### 5. `referenceTables.all`: six tables read when one row was used

`referenceTables.all` reads six entire tables (`convex/referenceTables.ts:19-46`). Before this work:

- each tool hub used only one `tools` row;
- each audience hub used only one `audiences` row; and
- the startup archive used only `categories`.

The new callsites are:

- tool hub: `toolBySlug` via `fetchToolReference` (`components/hubs/hub-data.ts:37-42`, `app/build-with/[tool]/page.tsx:560-578`);
- audience hub: `audienceBySlug` via `fetchAudienceReference` (`components/hubs/hub-data.ts:27-35`, `app/ideas-for/[audience]/page.tsx:654-671`);
- startup archive: bounded `allCategories` (`convex/referenceTables.ts:48-55`, `app/startup-ideas/page.tsx:143-151`).

The broad public function remains available for API compatibility, but no repository callsite uses it.

## Callsite and page-flow map

| Public flow                              | Entrypoint and cache behavior                                                                                          | Convex calls                                                         | Read set                                                                                        |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `/ideas/[slug]` metadata                 | `generateMetadata` → cached `resolveIdea` (`app/ideas/[slug]/page.tsx:221-227`)                                        | `ideas.bySlug`                                                       | One indexed full idea                                                                           |
| `/ideas/[slug]` render                   | `IdeaPage` → cached resolver → `CachedIdeaPage`, `cacheLife("hours")` (`app/ideas/[slug]/page.tsx:351-364`, `417-425`) | `ideas.bySlug`, then `ideas.relatedFor` inside the cached page       | One indexed full idea; related path is one self + at most five category rows for public limit 4 |
| Related cards                            | Server component, stable `{ slug, limit: 4 }` (`components/ideas/RelatedIdeas.tsx:20-33`)                              | `ideas.relatedFor`                                                   | No client subscription; bounded indexed common path                                             |
| `/build-with/[tool]` metadata and render | cached `getToolData`, shared by metadata and cached page (`app/build-with/[tool]/page.tsx:560-604`, `684-690`)         | `ideas.byTool`, curated `ideas.bySlug`, `referenceTables.toolBySlug` | Full idea scan for tool membership; curated point reads; one indexed tool row                   |
| `/ideas-for/[audience]` render           | cached for hours and tagged (`app/ideas-for/[audience]/page.tsx:654-663`)                                              | `ideas.byAudience`, `referenceTables.audienceBySlug`                 | Full idea scan for audience membership; one indexed audience row                                |
| `/startup-ideas`                         | whole data/render cached for hours (`app/startup-ideas/page.tsx:374-380`)                                              | paginated `ideas.list`, `referenceTables.allCategories`              | All full ideas in 200-row pages; at most 100 category rows                                      |
| Collection hubs under `/ideas/[slug]`    | cached for hours (`app/ideas/[slug]/collection.tsx:289-295`)                                                           | `ideas.list`, `ideas.byRevenueGoal`, or list/filter fallback         | Indexed revenue rows; full list for normalized legacy categories/build-time collections         |
| `/solve/[problem]`                       | cached for hours (`app/solve/[problem]/page.tsx:330-345`)                                                              | `ideas.list`                                                         | Full list, then category match/sort in JS                                                       |
| `/ideas/today`                           | request-time one-shot HTTP client (`app/ideas/today/route.ts:17-35`)                                                   | `ideas.latest`                                                       | One newest row from `by_publishedAt`                                                            |
| `sitemap.xml`                            | filesystem MDX enumeration (`app/sitemap.ts:24-98`)                                                                    | None                                                                 | No Convex read                                                                                  |

### Reactivity, builds, metadata, bots, and cache reuse

- No production `useQuery` or `usePaginatedQuery` callsite was found. Public content reads use server `fetchQuery` or one-shot `ConvexHttpClient` calls.
- The root Convex provider exists, but no audited hot path creates a reactive subscription (`app/ConvexClientProvider.tsx:13-49`).
- Static parameters for ideas, tools, audiences, and problems come from the filesystem or stable constants, not Convex.
- Idea, tool, audience, collection, solve, and startup pages use Next.js `"use cache"` with hour lifetimes and content tags.
- Metadata and rendering reuse cached data helpers where both need Convex data.
- Query arguments are stable slugs/limits. No unstable object or wall-clock argument was found.
- No `Date.now()` or zero-argument `new Date()` occurs inside a Convex query. The two `Date.now()` uses are in mutations (`convex/payments.ts:34`, `convex/subscriptions.ts:27`) and do not reduce query-cache reuse.
- Crawlers can increase route requests, but cached server components prevent each hit from becoming a Convex call until a cache miss, expiration, build, or tag revalidation.

## Tables, indexes, records, and read sets

### Ideas table

Relevant fields:

- identity/content: `slug`, `title`, `description`, `summary`, `publishedAt`;
- facets: `category`, `buildTime`, `revenueGoal`, `tools[]`, `audiences[]`;
- ordering/ranking: `scores.builder_confidence`;
- potentially large: `body`, `provenance`, `og`;
- body source: `bodyMode`.

Indexes:

| Index                        | Fields                                        | Readers                                          | Verdict                                                   |
| ---------------------------- | --------------------------------------------- | ------------------------------------------------ | --------------------------------------------------------- |
| `by_slug`                    | `slug`, `_creationTime`                       | `bySlug`, `relatedFor`, writers/seed             | Correctly ordered point index                             |
| `by_publishedAt`             | `publishedAt`, `_creationTime`                | `list`, `latest`, fallback scans, sitemap helper | Correctly ordered newest-first index                      |
| `by_category_publishedAt`    | `category`, `publishedAt`, `_creationTime`    | `byCategory`, optimized `relatedFor`             | Correctly ordered for exact category/newest-first results |
| `by_revenueGoal_publishedAt` | `revenueGoal`, `publishedAt`, `_creationTime` | `byRevenueGoal`                                  | Correctly ordered                                         |

No missing simple index blocks the related/category/revenue/slug paths. The remaining tool/audience problem is array membership, not index order.

### Reference tables

All six reference tables have `by_slug`. The new tool/audience reads use those indexes. Categories remain a tiny bounded table scan because the startup page needs every category in creation/manifest order.

### Writers and invalidation

- `ideas.upsertBySlug` writes one indexed row and schedules revalidation for `idea:<slug>` and `ideas` (`convex/ideas.ts:263-281`).
- Seed mutations upsert by slug in batches of 25 and deliberately skip tag revalidation (`convex/seed.ts:45-79`).
- No high-churn idea field or repeated no-op write path was found.
- Reference-table seed writes are slug-indexed and low frequency.

## Changes implemented

1. Replaced `relatedFor` full collection with an indexed, bounded category-first query and a stop-when-full audience fallback.
2. Added a hard maximum related limit of 12; the public component remains unchanged at four.
3. Reduced the related response from a full idea document to the exact three fields used by the card rail.
4. Added `referenceTables.allCategories`, bounded at 100 rows.
5. Switched tool hubs from six-table `referenceTables.all` to indexed `toolBySlug`.
6. Switched audience hubs from six-table `referenceTables.all` to indexed `audienceBySlug`.
7. Switched startup filter construction from six-table `referenceTables.all` to categories only.
8. Added the official `convex-test`/Vitest edge-runtime harness and regression coverage.
9. Refreshed stale official Convex AI files as requested.
10. Corrected pre-existing Node 22 test-script globs so the configured OG and links suites execute during `npm test`.

No schema, index, backfill, digest, denormalization, or cloud deployment change was made.

## Result parity and verification

The local database was seeded from the repository manifests. Before implementation, `relatedFor({ limit: 4 })` was run for all 140 sorted slugs and reduced to ordered related-slug arrays:

`SHA-256 592517a3fc38ee4d65a81d23832c7f483d9e3fba96403c2a66652278a2592a6f`

After implementation, the same 140 cases produced the same checksum.

The Convex tests cover:

- exact category-first eligibility;
- newest-first order within category and audience fallback groups;
- exclusion of the current idea;
- no duplicate when a category idea also shares an audience;
- default, explicit, zero, and hard maximum limits;
- unknown slug and no-eligible-result cases;
- anonymous/public access and authenticated parity;
- rows with all optional fields absent; and
- a six-document transaction limit for the common public four-card path.

Final verification:

| Check                            | Result                                                              |
| -------------------------------- | ------------------------------------------------------------------- |
| Focused Prettier check           | Pass                                                                |
| `git diff --check`               | Pass                                                                |
| Repository `npm run lint`        | Unavailable: no `lint` script                                       |
| Focused Oxlint on changed TS/TSX | 0 errors; one pre-existing unused `Link` warning                    |
| `npm run typecheck`              | Pass                                                                |
| `npm test`                       | Pass: 91 OG + 6 links + 5 Convex tests                              |
| Explicit local Convex codegen    | Pass                                                                |
| 140-slug old/new parity          | Pass, identical checksum                                            |
| Local production build           | Pass, 273/273 static pages                                          |
| Served-page smoke                | Four representative routes HTTP 200; expected related cards present |

The build emitted an existing Turbopack NFT warning about the sitemap import trace. It did not fail the build and is unrelated to the Convex read path.

### Local/cloud command audit

All function pushes, seeds, data queries, parity checks, and builds targeted the local backend.

Two Convex CLI commands that were explicitly requested/configured as local still made unexpected control-plane requests:

1. `convex dev --configure new --dev-deployment local` tried to create a cloud project before local configuration and failed with HTTP 400 because the team is disabled.
2. `convex insights --deployment local --details` tried to look up usage for the local deployment name and failed with HTTP 404 `DeploymentNotFound`.

Neither request created, deployed, imported, paused, queried function data from, or mutated a cloud/production deployment. No `convex deploy`, `--prod`, cloud import, production mutation, or production data query was executed.

## Expected monthly I/O reduction

For the current public limit of four:

- old common read set: one self lookup + all 140 ideas = approximately 141 idea documents;
- new common read set: one self lookup + `take(5)` category candidates = at most 6 idea documents;
- read-count ratio: `6 / 141 = 4.26%`;
- read-count reduction: approximately 95.7%.

Scaling only `relatedFor` by that ratio:

| Component                |        Before | Estimated after |
| ------------------------ | ------------: | --------------: |
| `relatedFor` production  |     482.64 MB |        20.54 MB |
| `relatedFor` development |      97.44 MB |         4.15 MB |
| Everything else          |     130.11 MB |       130.11 MB |
| **Total**                | **710.19 MB** |   **154.80 MB** |

This estimate assumes:

- current category density remains at least five rows per exact category value;
- call volume and cache-hit patterns stay similar;
- document byte cost scales roughly with documents read; and
- other function I/O does not grow.

A conservative scenario assumes only a 90% reduction in related-query I/O and credits **zero** savings from the reference-table change:

`710.19 - (482.64 + 97.44) + 10% × (482.64 + 97.44) = 188.12 MB/month`

The reference-table changes should reduce the total further. A local broad read returns about 35 KB of reference JSON, while the new hub reads return one approximately 0.7-1.0 KB row; the startup page reads only the approximately 12 KB categories set. Dashboard cache behavior prevents assigning a reliable monthly byte saving without post-release observations, so that upside is not included.

### Recommended limit

Set the Weekend MVP operational database-I/O budget to **200 MB/month**, with:

- warning at 175 MB;
- escalation at 200 MB; and
- a hard product target below 250 MB.

That leaves growth headroom while making a regression visible before the stated objective is breached.

## Remaining migration-heavy opportunities

These are plans only. Do not implement them without a migration-safe rollout.

### 1. Tool and audience relation/digest rows

Create `idea_tools` and `idea_audiences` rows containing the facet slug, idea ID, builder-confidence ordering field, and the card fields needed by hubs.

Migration-safe sequence:

1. add staged indexes and new tables;
2. dual-write from `ideas.upsertBySlug` and the seed pipeline;
3. backfill locally, then in the intended deployment only after explicit approval;
4. verify counts, membership, ordering, and optional-score behavior;
5. dual-read with a correctness fallback;
6. compare old/new result checksums;
7. cut over `byTool`/`byAudience`; and
8. remove fallback only after an observation window.

This would target the remaining 83.44 MB/month explicitly attributed to production `byTool`, production/development `byAudience`, before accounting for cache effects.

### 2. Idea-card digest or document split

Create a narrow card document/table containing only slug, title, description, normalized facets, publish date, scores, research level, build time, and application category. Move or keep body/provenance outside hot card reads.

This could reduce `list`, collection, problem, tool, and audience row size, but requires dual writes, a backfill, fallback reads, and parity checks. Current local rows have no `body`, so measurement does not justify doing this before tool/audience relation rows.

### 3. Normalize historical category values

`fetchIdeasByCategory` still drains `ideas.list` because historical cloud rows may contain display-cased categories. A verified normalize/backfill/cutover would let every category hub use `by_category_publishedAt`. This cannot be assumed from local seed comments and needs an exact deployment inventory first.

### 4. Batch curated slug lookups

A bounded `bySlugs` query could consolidate multiple `bySlug` function calls for tool-page featured rails while preserving editorial order and missing-slug behavior. This is not migration-heavy, but it primarily reduces function overhead rather than database bytes and is lower priority than observing the present fix.

## Remaining risks

- A future category with fewer than five exact-category rows activates the audience fallback. It remains stop-when-full but may scan many ideas if matching audiences are rare.
- Cloud data was not inspected. Category density, optional `body`, provenance size, and historical casing may differ from the local seed.
- `byTool`, `byAudience`, `list`, solve hubs, build-time collections, and normalized category fallbacks still read full idea documents.
- The broad `referenceTables.all` function remains callable by unknown external clients, although no repository callsite remains.
- Cache hit rates and crawler/build traffic can shift, so the estimate must be checked against the next complete billing window.
- The dependency audit reports 10 high-severity transitive vulnerabilities; no automated breaking audit fix was applied because it is outside this performance scope.

## Highest-value follow-up tasks

1. After one full billing week/month, compare `relatedFor` documents/bytes per call and total I/O against the 155-190 MB forecast; alert if the run rate exceeds 200 MB/month.
2. If I/O remains above budget, prepare the migration-safe `idea_tools`/`idea_audiences` relation-table plan and prove old/new checksum parity before any backfill.
3. Inventory actual production idea row sizes and category density with an explicitly approved, read-only deployment procedure; use that evidence to decide whether an idea-card digest/document split is justified.
