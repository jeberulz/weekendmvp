# Convex DB I/O cut (Oct 2026)

## Round 1 (PR #123, merged 8 Oct) — what shipped

Restored `"use cache"` on public hubs, added `idea_tools` / `idea_audiences`
join tables with dual-write + backfill, and batched `libraryPage` plan lookups.
Backfill completed on `first-squirrel-244` (~230 ideas).

**Observed after deploy:** DB I/O fell only ~25% (≈2.4 MB/h → ≈1.8 MB/h).
`ideas.byTool` still ≈0.6 MB/h. Cap trajectory still pointed at mid-Oct.

## Round 2 root cause (9 Oct audit)

1. **Hubs still requested `limit: 1000`.** `components/hubs/hub-data.ts` passed
   `UNCAPPED = 1000` into `byTool` / `byAudience`, then sliced to 30 after
   `onlyPublicIdeas`. The indexed path therefore still did
   `.take(1000)` + `ctx.db.get` per link. **`cursor` matches all ~227 ideas**,
   so each `/build-with/cursor` cache miss re-read the whole catalogue. Same
   pattern for `claude` (~220), `solo-founders` (~190), etc. Indexing helped
   niche facets; popular hubs barely changed.

2. **Hourly `cacheLife` re-fetched every hub every hour** even when nothing
   changed. Upserts already `revalidateTag("ideas"…)`, so the TTL was pure I/O.
   ~7 tool + ~5 audience + ~5 solve + ~20 collection + archive + related rails
   × 24 misses/day kept `byTool` / `byAudience` / `list` / `relatedFor` warm.

3. **Collection hubs double-drained `ideas.list`.** `CachedCollectionHub`
   called `fetchAllIdeas()` for tab counts *and* `fetchIdeasForCollection`,
   which for category hubs called `fetchAllIdeas()` again (and revenue hubs
   hit `byRevenueGoal` collect). ~20 collection routes × 2 drains per miss.

4. **`"use cache"` is effective in production** for these hubs (call volume
   dropped; residual I/O is bytes-per-miss, not uncached page views). Client
   `useQuery` is not the public-hub path. `testQuery` is **not in this repo** —
   check the Convex dashboard for a leftover Run / playground call and delete it.

5. **Still deferred (lower risk/reward for this cut):** middleware
   `editorial.public.visibility` (~15 MB/mo), full-doc reads for
   `libraryPage` / `list` (need a slim card projection table), reactive
   member catalogue exhaust on every `ideas` write.

## Round 2 fixes

| Change | Effect | Est. I/O delta |
| --- | --- | --- |
| Hard-cap `facetCap` at **48** (default 30); hubs request `HUB_FETCH = 48` not 1000 | Popular tool/audience hubs read ≤48 idea docs per miss instead of ~150–227 | **byTool ~0.6 → ~0.08–0.15 MB/h**; **byAudience** similar (~70–80% cut on those two) |
| `cacheLife("days")` on build-with / ideas-for / solve / collections / startup-ideas / RelatedIdeas (tags unchanged) | Steady-state misses fall from ~hourly to ~daily + revalidate-on-write | Further **~10–20×** cut on hub call volume when catalogue is quiet |
| Collections: one `fetchAllIdeas()` then pure filter | Removes second list/byRevenueGoal drain per collection miss | **ideas.list** roughly **halved** on collection traffic |
| Member `libraryPage` page size 100 → 40 | Same full drain when exploring; cheaper reactive re-reads while open | Modest; spikes on `ideas` writes shrink |

Public card grids still show **30** ideas sorted by `builder_confidence`. The
48 buffer only covers a few `onlyPublicIdeas` exclusions.

## Expected run-rate after Round 2 (order-of-magnitude)

Assumptions: ~230 ideas ≈1 KB/doc metadata (mdx `bodyMode`, no stored body),
current Oct rates, quiet catalogue (few upserts/day).

| Function | Oct cumulative (to ~9 Oct) | After Round 1 (observed) | After Round 2 (est.) |
| --- | --- | --- | --- |
| `ideas.byTool` | 209 MB | ~0.6 MB/h | **~1–3 MB/day** → **~30–90 MB/mo** |
| `ideas.byAudience` | 150 MB | ~proportional | **~1–2 MB/day** |
| `ideas.list` | 80 MB | still high (collections) | **~2–5 MB/day** |
| `ideas.relatedFor` | 48 MB | cached hourly | **≪1 MB/day** with daily TTL |
| `platform/ideas.libraryPage` | 79 MB | member traffic | **~40–70 MB/mo** (unchanged architecture) |
| `testQuery` | 16 MB | unknown caller | **0** if dashboard leftover removed |
| `_system_job/snapshot_export` | 41 MB | platform backup | unchanged — leave alone |

**Net target:** public+member app I/O **under ~15 MB/day** (~450 MB/mo), leaving
headroom under the 1 GB Free cap together with platform backup. Re-check the
Convex dashboard **24h after Convex + Vercel deploy**.

## Deploy steps (John) — Round 2

Order: **Convex first** (limit hard-cap), then **Vercel** (cacheLife + hub-data
fetch size + collection single-drain). No schema change. **No backfill.**

1. Deploy Convex to live `first-squirrel-244` (john-iseghohi:weekendmvp:production):
   ```bash
   npx convex deploy
   ```
   Do **not** use this checkout’s `--prod` if it still points elsewhere.

2. Ship the Next.js build (Vercel) from the merged PR so hubs request
   `limit: 48` and use `cacheLife("days")`.

3. Verify in Convex dashboard → Logs / Data usage:
   - `ideas.byTool` / `byAudience` bytes/hour drop within a few hours.
   - After ~24h, daily total for those two should be well under Round 1 rates.
   - Confirm `testQuery` volume; if still present with no app caller, remove
     any dashboard saved query / cron / external script.

4. Optional pre-merge (no code): none required. Do **not** disable Convex
   backups without an explicit owner decision.

## Non-goals

- Claim→pay / member research access unchanged.
- No URL or public card content change (still top 30 by confidence).
- No removal of Convex backups.
- Slim idea-card projection table still deferred.
- Middleware visibility caching deferred.

## Sources

- Production cumulative function I/O (owner, 9 Oct 2026 ~10:40 BST).
- Manifest tool/audience cardinality (`cursor` 227/227, `solo-founders` 190).
- PR #123 / `docs/convex-db-io-cut.md` Round 1.
