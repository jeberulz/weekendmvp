# Convex DB I/O cut (Oct 2026)

## Status

| Round | PR | Result |
| --- | --- | --- |
| 1 | #123 | Cache restored + facet indexes. I/O only −25%. |
| 2 | #130 | Facet hard-cap 48 + `cacheLife("days")`. **byTool/byAudience fixed** (209→214 / 150→153 MB in ~24h). |
| 3 | this PR | Cut `libraryPage` + `ideas.list` leaders; document `testQuery`. |

As of 10 Oct ~10:20 BST: **944 MB / 1 GB**, ~1.6 MB/h → cap ~11 Oct evening without Round 3.

---

## Round 3 root cause (verified)

### `platform/ideas.libraryPage` (+21 MB in ~24h)

**Callers:** reactive `usePaginatedQuery` via `useLibraryCatalogue`, mounted on:

1. **Dashboard home** — `PickedForYou` (only needs **3** cards)
2. **`/dashboard/explore`** — `IdeasLibrary`

Each mount **exhausted the whole catalogue** (~230 docs across ~6 pages of 40). Every page also re-ran prefs + intents + **up to 48 `ctx.db.get` of saved ideas**. Any `ideas` write re-ran every open subscription.

`"use cache"` is **not** involved (client subscriptions).

### `ideas.list` (+18 MB in ~24h)

**Callers (server `fetchQuery` only — no client `useQuery`):**

| Caller | Before Round 3 |
| --- | --- |
| ~20 collection hubs | each `CachedCollectionHub` drained full list (own cache entry) |
| ~5–8 solve hubs | full list then filter |
| `/startup-ideas` | full paginated drain |
| `fetchIdeasByCategory` | full drain (legacy casing) |

Sitemap does **not** call Convex. Round 2 `cacheLife("days")` helped, but **each collection slug was a separate cache entry**, so one `ideas` tag revalidation (e.g. publishing a few ideas) triggered **~20 independent full drains** ≈ tens of MB in one wave — matches the +18 MB day.

### `testQuery` (16.4 MB prod + 20.3 MB dev MTD)

**Not in this repo.** No cron, script, or export. Convex MCP / dashboard **one-off query runner** materializes a temporary module named `testQuery.js` (see Convex MCP `runOneoffQuery` schema: *"single file (testQuery.js)"*). Agents and dashboard "Run" against prod/dev are the callers. **Stop running large one-offs on prod.**

---

## Round 3 fixes

| Change | Est. impact |
| --- | --- |
| **PickedForYou** → `useQuery(api.platform.ideas.library)` (limit 3+exclude) | Home stops exhausting `libraryPage`. **~40–60% of libraryPage** if home is the common path |
| **IdeasLibrary** → same `library` query with URL filters (no catalogue exhaust) | Explore: **1 take(~230)** per filter set instead of **6 pages × (40 docs + ≤48 saved gets)** |
| **`fetchAllIdeas` wrapped in `"use cache"`** + `cacheTag("ideas")` | All hubs **share one** list drain per miss/revalidate instead of ~20 |
| **Collections:** indexed `byCategory` / `byRevenueGoal`; tab counts from manifest membership (no list) | Category/revenue hubs: **~16–48 docs** not 230; tabs free |
| **Solve:** `byCategory` per match, not full list | ~3–4 category collects, capped to 6 cards |
| **`libraryPage`:** reuse on-page docs for affinity before extra gets | Residual callers cheaper |
| **startup-ideas:** uses shared cached `fetchAllIdeas` | Shares the one drain |

Public card grids / member ranking behaviour unchanged (still for_you / filters / top confidence sorts). With ~230 ideas, `LIBRARY_READ_LIMIT` (1000) remains complete.

**Target after Round 3:** libraryPage app traffic → **near zero**; ideas.list → **well under ~3–5 MB/day** unless frequent publishes revalidate `ideas`. Combined with Round 2, stay under **~15 MB/day** app I/O.

---

## Deploy (John) — do not merge/deploy from the agent

Order: **Convex first** (libraryPage affinity tweak), then **Vercel** (hub-data cache + UI callers).

```bash
# 1. Live production only
npx convex deploy
# Target: first-squirrel-244 (john-iseghohi:weekendmvp:production)

# 2. Ship Vercel production from the merged PR
```

No schema change. No backfill.

### Verify (Convex dashboard, ~4–24h)

- `platform/ideas.libraryPage` bytes/hour → collapse (only tests/rollback if unused)
- `ideas.list` bytes/hour → sharp drop; spikes only on `ideas` tag revalidate
- `platform/ideas.library` may rise modestly (replaces libraryPage) — should be **far less** than prior libraryPage
- `testQuery`: if still growing, someone is still running one-offs on that deployment

### Before code (optional, immediate)

1. **Do not run Convex MCP `runOneoffQuery` / dashboard Run against prod** for catalogue scans — use anonymous/dev.
2. Do **not** disable Convex backups without an owner decision.

---

## Non-goals

- Slim `idea_cards` projection table (still deferred; Convex reads whole docs)
- Middleware `editorial.public.visibility` caching
- Removing `libraryPage` export (rollback / tests)
- Deleting platform snapshot export
