# Convex DB I/O cut (Oct 2026)

## Status (12 Oct 2026)

| Round | PR | Result |
| --- | --- | --- |
| 1 | #123 merged | Cache + facet indexes. I/O only −25%. |
| 2 | #130 merged + Convex+Vercel deployed | byTool/byAudience fixed. **`libraryPage` got worse**: page size 100→40 meant more reactive pages while home/explore still exhausted. |
| 3 | **#138 NEVER MERGED** (still open draft) | Explains everything: `platform/ideas.library` never appears in prod metrics; Vercel still serves `useLibraryCatalogue` → `libraryPage`. |
| 4 | **this PR** | Re-lands Round 3 on current `main` + kills `useLibraryCatalogue` so it cannot silently return. |

Team is **over** the Free cap (1.03 GB / 1 GB). 11–12 Oct UTC: libraryPage **40 MB**, ideas.list **17.6 MB**.

### Verdict: Vercel production does **NOT** include PR #138

- GitHub: PR #138 `state=OPEN`, `isDraft=true`, `mergedAt=null`.
- Vercel production tip: `35be49a` = PR **#139** (“hide the publish date”), on `main`.
- `main` still has `useLibraryCatalogue()` in `PickedForYou` + `IdeasLibrary`.
- Convex `npx convex deploy` alone cannot fix this: the burn is **frontend callers**. The `library` query already existed; the UI never switched.

---

## Why libraryPage stayed hot (and looked worse)

1. Home + explore still mount `usePaginatedQuery(api.platform.ideas.libraryPage)` and **loadMore until Exhausted** (~230 full idea docs).
2. Round 2 shrank page size to 40 → **more pages** per exhaust → more prefs/intent/saved-idea re-gets per visit.
3. Open dashboard tabs keep reactive subscriptions; any `ideas` write re-runs every page.

`platform/ideas.library` missing from metrics = **no production client calls it**.

## ideas.list

Still drained per collection cache entry (and solve/startup) on `ideas` tag revalidate. Round 4 shares one cached drain + indexed category/revenue reads.

---

## Round 4 fixes (this PR)

| Change | Effect |
| --- | --- |
| Home + explore → `useQuery(api.platform.ideas.library)` | Stops all UI `libraryPage` exhaust |
| `useLibraryCatalogue` → throws if called | Prevents silent regress |
| `fetchAllIdeas` itself `"use cache"` + `ideas` tag | One list drain shared across hubs |
| Collections: indexed byCategory/byRevenueGoal; tab counts from manifest | Most hubs skip `ideas.list` |
| Solve: byCategory pool | No full list |
| startup-ideas uses shared cached drain | Shares the one miss |

Est. after Vercel ships: libraryPage → **~0** from app; ideas.list → **≪5 MB/day** unless frequent publishes.

---

## Exact steps for John (order matters)

**Nothing is deployed until this PR merges to `main` and Vercel promotes production.**

1. **Merge this PR** to `main` (mark ready / merge). Close draft **#138** as superseded (do not merge #138 — it is behind `main`).
2. **Confirm Vercel production** builds from the merge commit on `main` and reaches READY. Tip SHA must contain the `useQuery(api.platform.ideas.library` change in `PickedForYou.tsx` / `IdeasLibrary.tsx`.
3. **Convex** — only if this PR’s `convex/platform/ideas.ts` tweak is not yet on `first-squirrel-244`:
   ```bash
   npx convex deploy
   ```
   Target **first-squirrel-244**. No schema/backfill. (Frontend is the critical path.)
4. **Verify** in Convex dashboard within 1–4h:
   - `platform/ideas.libraryPage` → collapse
   - `platform/ideas.library` → **appears** and stays modest
   - `ideas.list` → sharp drop
5. Optional immediate: close any long-open `/dashboard` tabs (old JS still exhausts until hard refresh after Vercel).

Do **not** disable Convex backups. Do **not** run MCP/`testQuery` one-offs on prod.

---

## testQuery

Still not in repo. Convex dashboard/MCP one-off runner (`testQuery.js`). Ignore for this cut; stop large Runs on prod.
