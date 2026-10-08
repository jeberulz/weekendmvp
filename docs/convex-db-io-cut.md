# Convex DB I/O cut (Oct 2026)

## Root cause

1. **E6 editorial commit `943b14a` removed `"use cache"`** from public hubs
   (`/build-with`, `/ideas-for`, `/solve`, `/startup-ideas`, collection hubs)
   and replaced it with `connection()` + `instant = false`. Every page view
   started hitting Convex again. Component names like `CachedToolHub` kept
   the old name but no longer cached.

2. **`ideas.byTool` / `ideas.byAudience` full-table `.collect()`** — tools and
   audiences are array fields, so membership required scanning every idea
   document (~230 rows) on each call. That is why those two functions led
   production DB I/O (190 MB + 143 MB in early Oct).

3. **`platform/ideas.libraryPage`** did an `activePlanForIdea` point read per
   card on every page (N+1), on top of paginating full idea docs for the
   member catalogue.

4. **`_system_job/snapshot_export` (~41 MB)** is a Convex platform backup /
   export job, **not** something this repo schedules. The only app cron is
   `editorial release recovery` in `convex/crons.ts`. Do **not** disable
   Convex dashboard backups without an explicit owner decision — flag only.

## Fixes in this PR

| Change | Effect |
| --- | --- |
| Restore `"use cache"` + `cacheLife("hours")` + `cacheTag("ideas"…)` on hubs, collections, startup-ideas (member path), and `RelatedIdeas` | Cuts call volume for byTool / byAudience / list / relatedFor to roughly one miss per slug per hour (plus revalidate) |
| Additive `idea_tools` / `idea_audiences` tables + dual-write on upsert/seed/editorial publish | Index-backed byTool/byAudience; each call reads ~`limit` idea docs instead of all ~230 |
| `libraryPage` uses one `activePlansOf` set instead of per-card plan lookups | Removes N plan-index reads per library page |

## Expected I/O reduction (order-of-magnitude)

Assumptions: ~230 ideas, ~1 KB/doc, current Oct run-rate from the dashboard.

| Function | Before (month to 8 Oct) | After (estimate) | Why |
| --- | --- | --- | --- |
| `ideas.byTool` | 190 MB | **~5–20 MB** | Cache ≈ 90%+ fewer calls; indexed path ≈ 30/230 docs per miss |
| `ideas.byAudience` | 143 MB | **~4–15 MB** | Same |
| `ideas.list` | 65 MB | **~5–15 MB** | Hub/archive caching restored |
| `ideas.relatedFor` | 48 MB | **~5–10 MB** | RelatedIdeas cached hourly |
| `platform/ideas.libraryPage` | 76 MB | **~50–65 MB** | N+1 plans gone; still paginates full docs for members |
| `_system_job/snapshot_export` | 41 MB | unchanged | Platform backup — leave alone |

**Net:** public browse I/O should drop on the order of **~350–450 MB/month** at
current traffic, enough to stay inside the 1 GB Free cap if call patterns
hold. Re-check the Convex dashboard 48h after deploy.

## Deploy steps (John)

Order matters: **Convex first**, then Vercel (frontend cache).

1. Deploy Convex (additive schema — no data drop):
   ```bash
   npx convex deploy
   ```
   Target the live production deployment (`efficient-emu-764` / weekendmvp).
   Do **not** use this checkout’s `--prod` shorthand if it still points at a
   different project.

2. Backfill facet rows (bounded, idempotent). Dry-run first:
   ```bash
   npx convex run ideaFacets:backfill '{"dryRun":true}'
   ```
   Then apply, repeating with the returned `continueCursor` until `isDone`:
   ```bash
   npx convex run ideaFacets:backfill '{"dryRun":false}'
   npx convex run ideaFacets:backfill '{"dryRun":false,"cursor":"<continueCursor>"}'
   ```
   Until backfill has written ≥1 row, `byTool`/`byAudience` keep the legacy
   full scan (correct results, higher I/O).

3. Ship the Next.js build (Vercel) so `"use cache"` restores. Existing
   `ideas` / `idea:<slug>` revalidation from upserts and editorial publish
   still invalidates hubs.

4. Optional: confirm Convex dashboard scheduled backups are intentional;
   snapshot export I/O is separate from app code.

## Non-goals

- Claim→pay flow untouched.
- No URL or public behaviour change.
- No removal of Convex backups.
- Digest/projection table for full idea cards deferred (list/libraryPage
  still read full docs; caching covers most public traffic).
