# 10 — Keeping per-idea crew seeds current (WP92)

Status: built on `claude/wp91-seed-freshness`. **Live spend stays off** until the
owner does the "Switching it on" steps below. Nothing has run against prod.

## The problem

WP90 seeds come from `npm run crew:seeds`, and an operator has to run it. An idea
published or edited after the last run has no seed at the current version, so its
wizard falls back to generic fixtures, and its crew preview stays empty until
someone remembers to run the script.

## Options considered

| | (a) Seed step in the publish path | (b) Automatic run after merges (chosen) |
|---|---|---|
| Where | `/publish-idea` and `editorial:submit-engine` | A GitHub Action after each Production deploy, plus a daily run |
| Catches | Only ideas that go through those two paths | Any change to `content/ideas/**` or `ideas/manifest.json` that reaches `main`: skill publishes, hand edits, waves, reverts |
| Timing | Too early for engine ideas: they stay on the private editorial path until WP46-E7 GO, and the seed reads the **published** page | After the change is live, from the same files the site serves |
| Still needs someone to remember? | Yes: an operator with a prod key runs the skill locally | No |
| Cost control | Per publish, no shared view of the free pool | One place for the cap, the founder-pool floor and the live switch |

Option (a) also adds a money-spending step to two flows that must stay safe to dry
run. Option (b) is one workflow file, one read-only query and a guarded mode in the
existing script.

## Design

`.github/workflows/crew-seeds.yml` runs `npm run crew:seeds -- --auto` against prod
(`first-squirrel-244`, through the `CONVEX_PROD_DEPLOY_KEY` secret) at one fixed
seed version (`CREW_SEED_VERSION`).

**When it runs:**
- after every successful Vercel **Production** deployment (`deployment_status`).
  That build also deploys Convex prod (`scripts/vercel-build.mjs`), so the functions
  it calls are already live;
- daily at 04:17 UTC, as a safety net (it picks up ideas a busy pool held back,
  failed items, and anything a skipped run missed);
- by hand (`workflow_dispatch`).

It always checks out `main`, so a late older deployment cannot seed stale pages. One
run at a time (`concurrency: crew-seeds`).

**What a run does:** it builds every published page's seed source, calls the
read-only `estimateItems` dry run, then the new read-only `crew/seeds:autoRunState`
query. It hands both to `decideSeedAutoRun` (`lib/workspace/crew/seedAutoRun.ts`),
which checks the rules below in order:

1. **A run at this version is still open → skip.** Its ideas have no seed row yet,
   so a second run would send them again. The next run picks up any change.
2. **Nothing changed → done.** A page unchanged since its seed at this version is
   skipped (`sourceHash`), so most runs send nothing and spend nothing.
3. **The deployment is not in live provider mode → dry run.** A fixture run would
   write fixture seeds at this version. Those pages would then read as unchanged and
   never get a real seed. `providerLive` needs `AI_PROVIDER_MODE=live` and an
   Anthropic key to be set; only whether a key is set is reported.
4. **The live switch is off → dry run.** `--apply` is passed only when
   `CREW_SEEDS_AUTO_APPLY` is exactly `true`.
5. **The worst case is over the per-run cap → refuse, exit 3.** The job fails so
   the owner sees it. A seed version bump or a mass edit re-seeds most of the
   library ($53 worst case), and that stays an operator run (plan 09, "Running it").
6. **The run would cut into the founders' share of today's free pool → wait.** A
   later run, at the latest the daily one, sends those ideas.

Otherwise it creates the run, adds only the changed ideas, and submits one batch.
That batch is reserved per idea through C-METER as before. The meter's own budget,
kill switch and `AI_DISABLED` refusals still apply. A refused reservation leaves the
idea `not_reserved` for a later run.

## The cap (proposed, the owner's call)

Seeds are ownerless platform work. They reserve from the **free global pool** (D22),
the same pool free founders draw on. The L1 split in `docs/wp/l1-release-plan.md`
is about $7 free and $3 paid under the $10 daily cap.

| Limit | Variable | Proposed | What it means |
|---|---|---|---|
| Per-run worst-case reservation | `CREW_SEEDS_MAX_RESERVE_USD` | **$2.50** | About 10 changed ideas at $0.23 worst case each. Expected spend is about $0.06–$0.10 per idea, so roughly $1 at most. More than that fails the job for a manual run. |
| Founders' share of the free pool | `CREW_SEEDS_KEEP_FREE_POOL` | **0.5** | A run may reserve only if at least half of today's free pool stays unspent and unreserved afterwards. With a $7 pool, $3.50 always stays for founders, which is more than four median launches ($0.75). |

The worst case on a busy day is one $2.50 reservation held for about an hour, while
the batch runs. It settles at the real cost, usually under $1. The open-run skip
means at most one seed batch is in flight per version at any time.

## Switching it on (owner only)

1. Run the first library seed by hand, as plan 09 "Running it" describes. This is a
   dry run, then a spike of 5, then the rest. Note its seed version, for example
   `2026-11-08.1`.
2. In the GitHub repo settings, add the secret `CONVEX_PROD_DEPLOY_KEY`: a
   production deploy key for `first-squirrel-244`. Never use `vibrant-jackal-308`;
   the script refuses it.
3. Add the variable `CREW_SEED_VERSION` with that version.
4. Run the workflow by hand (Actions → Crew seeds → Run workflow). Without
   `CREW_SEEDS_AUTO_APPLY` it is a read-only dry run. Check the summary, for example
   "every seed at 2026-11-08.1 is current".
5. Set the variable `CREW_SEEDS_AUTO_APPLY` to `true`. From then on, a changed idea
   page is seeded within minutes of its Production deploy.

To pause it, delete `CREW_SEEDS_AUTO_APPLY` or set it to anything else: runs go back
to dry runs. The meter's kill switch also stops every reservation.

To change the seed version (for example after a new seed prompt), do the operator
run at the new version first, then update `CREW_SEED_VERSION`. If you update the
variable first, the automatic run exits 3 on its first run (over the cap) and sends
nothing.

## Not covered

- The workflow assumes `npx convex run` honours `CONVEX_DEPLOY_KEY` with no
  `--prod` flag, as `npx convex deploy` does in the Vercel build. Step 4 above (a
  read-only dry run) confirms this before any spend.
- A page that `seedSourceFromPage` refuses is listed in the log and skipped. It never
  fails the job.
- Seeds for engine ideas before WP46-E7 GO: they have no published page yet, so there
  is nothing to seed.
