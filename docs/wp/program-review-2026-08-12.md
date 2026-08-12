# Build Platform Program — Independent Status Review

**Date:** 2026-08-12
**Lane:** Gate (verification only; no program code changed)
**Reviewed:** `codex/wp28-tenant-hosts` @ `bfc33fb` — the tip of the stacked
platform program (WP19-WP28). It contains every platform commit; the WP26 and
WP27 branches are its ancestors.
**Baseline:** `origin/main` @ `d7a5dd7`
**Method:** read the frozen manifest, plan, rulings, gate report and every
progress log; then re-ran the configured checks in a clean checkout
(`npm ci` from the committed lockfile) rather than trusting recorded evidence.

> There is no branch named `feat/platform-program-plan` on `origin`. The plan
> is `docs/wp/program-platform-plan.md`, committed at `162869e`, and it lives
> on the `codex/*` stack. If a branch by that name exists, it is local to one
> machine and has never been pushed.

---

## 1. Verdict

The program is **not drifting in quality — it is drifting in shape**. The
delivery machinery is well ahead of the thing that was supposed to make this
product different, the whole program is one unmerged 7-day-old stack, and four
unrelated branches are now editing seams the manifest declares single-writer.

Three findings block the program's own gates today. Four more are structural
and decide whether the 2026-08-16 launch target and the 2026-09-05 Ideabrowser
deadline survive.

| # | Finding | Severity |
|---|---|---|
| F1 | The critical-path package (WP26 research engine) is 1/6 done while two downstream packages are 6/6 | HIGH |
| F2 | `npm test` is red on the program tip on Node 22.14 — three security suites fail to load | HIGH |
| F3 | `npm audit --omit=dev --audit-level=high` is red (nanoid `GHSA-2v37-7h3g-55p8`) | HIGH |
| F4 | Four off-program branches edit manifest-owned seams, two of them reuse frozen WP numbers | HIGH |
| F5 | 120 files / +18,224 lines of platform code unmerged for 5 days behind a single linear stack | MEDIUM |
| F6 | Launch target 2026-08-16 is not reachable; the residual scope is the majority of the product | MEDIUM |
| F7 | Wave 5 (Ideabrowser independence) is unstarted with a hard external deadline of 2026-09-05 | MEDIUM |

Nothing here is live. The platform is unmerged, `origin/main` contains no
`/build`, `/preview`, `/dashboard`, or tenant code, and no DNS or Stripe
activation has happened. **Production risk is currently zero; all the risk is
in the merge and in the schedule.**

---

## 2. Where the program actually is

| Wave | Scope | State |
|---|---|---|
| 0 | Audit, manifest freeze, rulings | Complete, gated |
| 1 | WP20 security/CI/test baseline | Complete, gated |
| 2 | WP21 auth, WP22 schema/authz, WP23 shell/Explore, WP24 credits/Stripe, WP25 intake | Complete, gated (incl. authenticated browser gate 2026-08-06) |
| 3 | WP26 workflow + M3 reports | **S1 of 6.** Contract only. No workflow, no provider adapter, no report |
| 3 | WP27 renderer + preview | Complete, package gate pass |
| 3 | WP28 tenant hosts/publish/leads | Complete, package gate pass |
| 3 | WP29 cockpit, WP30 trust/safety, WP38 admin plane | **Not started.** WP38 has stories; WP29/WP30 have no stories |
| 4 | WP31 activation + launch surface | Not started |
| 5 | WP32-WP37 Idea Engine + Ideabrowser retirement | Not started |
| 6 | Closeout | Not started |

Delivered so far: 120 files, +18,224 lines of platform code (9,486 of it in
`convex/platform`), 2,819 lines of tests, 44 recorded rulings, 9 gate entries.

Last commit anywhere on the program: **2026-08-07 22:15**. Five days of no
movement.

### F1 — the critical path is the least advanced package (HIGH)

The manifest sequence is `WP26 -> WP27 -> WP28`. WP27 was correctly authorised
to start early, off the named WP26-S1 contract subgate — that part is per the
manifest, not a deviation. What followed is the deviation: WP27 finished, WP28
opened on top of it and finished, and **WP26-S2 through S6 have not been
started**.

The consequence is strategic, not procedural. WP26 is the Validation Report
engine — brief normalisation, market stats, competitors, community signals,
keywords, synthesis/scoring, report render. It is the entire content of the
wedge stated in plan §2.2 ("Polsia builds without validating; we validate
first"), and it is the only paid deliverable on the own-idea path (§5, §6.4).

What is built is the half a competitor could copy: a templated landing-page
renderer, preview tokens, and tenant host routing. What is not built is the
half that is supposed to be uncopyable. On the current stack a customer can be
shown a preview, pay, and publish a page — and receive no research at all.

Compounding it: WP29, WP30 and WP38 all depend on WP26, and WP38 additionally
gates WP31 (production activation). WP26 is therefore blocking four packages
while sitting idle behind two that were allowed to overtake it.

### F5 — one linear stack, unmerged (MEDIUM)

`WP19..WP28` is a single chain: `wp26 <- wp27 <- wp28`. Nothing is merged to
`main`, no pull request exists for any `codex/*` branch, and the diff against
`main` is 186 files / +33,717 lines.

The stack cannot be merged incrementally in its current shape either: merging
WP28 without WP27 ships a dead `/build/{slug}` CTA from four components inside
the stack. That is correctly recorded in `wp28-progress.md`. It does mean the
merge is all-or-nothing, and the first merge will be the largest one.

Resuming WP26-S2 on `codex/wp26-research-workflow` — as `AGENT_HANDOFF.md`
§4B still instructs — now forks the stack, because that branch is five commits
and two packages behind `codex/wp28-tenant-hosts`. WP26-S3+ touches
`convex/convex.config.ts` (workflow mount) and the generated Convex API, both
of which WP27 and WP28 have since written. **Decide the base before opening
WP26-S2, not during it.**

---

## 3. Verified check results

Run on `bfc33fb`, clean `npm ci`, Node 22.14.0.

| Check | Result | Matches recorded evidence? |
|---|---|---|
| `npm run typecheck` | pass | yes |
| `npm run lint` | pass — 0 errors, 35 pre-existing warnings | yes |
| `npm run build` | pass — 315 pages | yes |
| `npm test` | **fail** | no — `wp28-progress.md` records exit 0 |
| `npm audit --omit=dev --audit-level=high` | **fail** — 1 high | no — recorded 0 on 2026-08-07 |

### F2 — `npm test` red: three security suites never load (HIGH)

```
> test:security
> node --test tests/security/*.test.mjs && vitest run …

TypeError [ERR_UNKNOWN_FILE_EXTENSION]: Unknown file extension ".ts"
  for app/api/platform/preview/_server.ts
```

Three suites fail: `wp27-preview-bridge`, `wp27-preview-route`,
`wp28-tenant-lead`. They are `.mjs` files importing `.ts` modules, and
`test:security` is the only test script that does **not** pass
`--experimental-strip-types` (`test:redirects` and `test:sitemap` both do).

They pass on Node ≥ 22.18, where type stripping is unflagged, which is why the
authoring machine and CI's `node-version: '22.x'` (floating to latest) both
report green. Confirmed by re-running the same file with
`NODE_OPTIONS=--experimental-strip-types` — 16/16 pass.

This is worse than a flake, because of which suites they are: the preview
capability-token boundary and the tenant lead-endpoint boundary. On any Node
between 20.9 (the floor `package.json` `engines` declares) and 22.17, they
report nothing at all while the suite around them stays green.

Two further failures appear when `RECRAFT_API_KEY` / `RECRAFT_STYLE_ID` are
present in the environment: `tests/og/providers-recraft.test.mjs` reads
`process.env` as its default, so "throws when apiKey is missing" instead makes
a real 4.2-second network call to the Recraft API. Pre-existing on `main`, not
a program regression, but it makes the suite fail in any environment that
carries those secrets — including Cloud Agents.

**Scoped fixes:** add `--experimental-strip-types` to `test:security`; raise
`engines.node` to `>=22.6.0` and pin CI to an exact minor rather than `22.x`;
have the Recraft tests pass an explicit `apiKey: undefined` / stub the env.

### F3 — production audit red (HIGH)

```
nanoid  <3.3.17  (high)  GHSA-2v37-7h3g-55p8
  node_modules/nanoid  ← next@16.3.0 > postcss, @tailwindcss/postcss > postcss
```

`npm audit --omit=dev --audit-level=high` exits 1. That is a step in the
program's own CI workflow (added by WP20) and a Wave 1 exit criterion ("no
unwaived high production dependency vulnerability"). The advisory post-dates
the 2026-08-07 gate run, so the recorded evidence was true when written — but
**the program branch's CI is red right now**, and WP31's gate cannot pass
until it is either fixed or explicitly waived in `RULINGS.md`.

The fix is a transitive `postcss` bump; it does not need
`npm audit fix --force`.

---

## 4. Off-program work colliding with the program

Four open PRs, all branched from `main`, all editing files the manifest
assigns to a package. None of them appear in `session-ledger.md`. All four have
red CI.

| PR | Branch | Collision |
|---|---|---|
| [#45](https://github.com/jeberulz/weekendmvp/pull/45) | `claude/lead-magnet-ideas-mvp-hhsajy` | Creates `docs/wp/wp19-stories.md` / `wp19-progress.md`. **WP19 is the frozen program-freeze package.** Also adds a whole `/playbooks` product surface that exists nowhere in the manifest, and edits `next.config.ts`, `app/sitemap.ts` and `app/api/subscribe/route.ts` |
| [#41](https://github.com/jeberulz/weekendmvp/pull/41) | `cursor/weekly-validation-digest-fde5` | Second WP18 (main's WP18 is "five research-backed startup ideas"). Edits `convex/schema.ts` — the declared one-writer seam — plus `.claude/skills/publish-idea/SKILL.md` (WP33's boundary) and `app/ideas/[slug]/page.tsx` (WP25's CTA seam). Ships its own "validation report" concept under the same name WP26 uses for the paid deliverable |
| [#46](https://github.com/jeberulz/weekendmvp/pull/46) | `fix/ci-required-checks` | Rewrites `.github/workflows/ci.yml`, which WP20 already rewrote on the program branch. Two divergent rewrites of the same file; the PR's version omits the lint and `npm audit` steps WP20 added, so merging it first replaces a stronger gate with a weaker one and guarantees a conflict |
| [#47](https://github.com/jeberulz/weekendmvp/pull/47) | `cursor/setup-cloud-agent-env-2db3` | `.cursor/` only. Benign |

Wave 0 audit finding #1 exists precisely because WP15-WP18 already collided
once; the numbering restarted at WP19 to avoid it. Two branches have since
collided with the new numbers as well. The registry is not being read by the
agents opening work.

`docs/PROJECT_STRATEGY.md` is edited by PR #45, PR #41 and the program stack
independently — three-way conflict on the registry that is supposed to prevent
exactly this.

---

## 5. Schedule reality

### F6 — 2026-08-16 is not reachable

Four days out, with the program idle for five. Remaining before the launch
target: WP26-S2..S6 (Critical: durable workflow, three external providers,
cost caps, refunds, evals), WP29 (cockpit/revisions), WP30 (trust/safety),
WP38 (admin plane — stories only), WP31 (activation: real payment smoke,
wildcard DNS, stranger journey), plus first merge of 33,717 lines to `main`.

WP31 additionally needs six owner rulings that are still listed as open
defaults in the manifest, including tax/VAT treatment before any live charge,
and the WP24 partial-refund/dispute-resolution contract, which is a recorded
hard live-mode blocker.

The manifest already says the date "cannot override security, ownership,
payment, preview-isolation, or restore gates." The honest options are to move
the date, or to cut the launch definition — see §6.

Minor, but it costs the next agent a wrong count: the manifest's "Owner Rulings
Required Before Their Gates" table still lists the two WP28 rows (legacy
fallback / reserved names, and staging host / lead retention) as open. Both
were ruled on 2026-08-07 and are recorded in `RULINGS.md`; only the table was
not updated.

### F7 — 2026-09-05 is the deadline that cannot move

The Ideabrowser subscription lapses on 2026-09-05. Wave 5 (WP32 signals/idea
generation, WP33-WP36 the four compilers, WP37 off-boarding) is entirely
unstarted, and every one of those packages depends on WP38, which is also
unstarted, and on the WP26 contract, which is 1/6.

Off-boarding step 1 in plan §4.5.1 — burn the queued Ideabrowser backlog while
the entitlement is live — was delegated to a parallel branch. 15 ideas were
published on 2026-08-05 (PRs #43, #44) and nothing since. The manifest's own
audit finding #10 ("no machine-readable MCP backlog inventory") is still true;
no backlog ledger exists in `docs/`. WP37's gate is "backlog count zero", and
there is no count.

Unlike the launch date, this one is set by a third party. If Wave 5 does not
land, the daily content engine — the funnel the entire platform is built to
monetise — degrades to `/publish-idea` Mode B.

---

## 6. Recommendations

Ordered by leverage. All of them are owner decisions; none were taken here.

1. **Freeze new non-program branches against program seams.** `convex/schema.ts`,
   `next.config.ts`, `middleware.ts`, `.github/workflows/ci.yml`,
   `app/ideas/[slug]/page.tsx`, `.claude/skills/**` and
   `docs/PROJECT_STRATEGY.md` are all manifest-owned. Close, re-scope, or
   re-number PRs #41, #45 and #46 before they land. PR #46 in particular
   should be dropped in favour of WP20's version of the file.
2. **Re-open WP26-S2 immediately, and base it on `codex/wp28-tenant-hosts`,
   not on the stale `codex/wp26-research-workflow`.** Update
   `AGENT_HANDOFF.md` §4B, which still points at the old base. Nothing else in
   the program should start until the research engine is moving, because it is
   both the differentiator and the blocker for four packages.
3. **Fix F2 and F3 as a Gate-lane scoped fix** on the program branch:
   `--experimental-strip-types` on `test:security`, an `engines` floor of
   22.6, an exact CI Node pin, and the `postcss`/`nanoid` bump. Both are
   currently blocking the program's own required checks.
4. **Re-cut the launch definition rather than the gates.** The buildable slice
   by 2026-08-16 is preview → signup → checkout → publish, without a
   Validation Report — which is precisely the "AI builds before it validates"
   product the plan positions against. Either move the date, or ship WP26's
   repository-idea compiler path only (§7 Wave 2 already scopes it as
   "existing research/MDX + manifest — no engine run needed") and hold the
   own-idea engine path back. That keeps the promise honest at a fraction of
   WP26's cost.
5. **Consider starting WP38's foundation in parallel.** Its stories are frozen
   and it gates WP31. The manifest lists WP26-WP30 as dependencies and
   `wp38-progress.md` says to hold until WP30's operational contracts exist —
   but that dependency is real only for the aggregate operational views. The
   identity bootstrap, authorization seam, admin shell and audit spine consume
   nothing WP26-WP30 produce. Splitting the package that way needs an explicit
   orchestrator ruling; it should not be taken by a worker.
6. **Produce the Ideabrowser backlog ledger this week**, independent of Wave 5.
   It is a read-only inventory, it closes an open manifest unknown, and WP37's
   gate is unmeasurable without it.
7. **Merge the stack to `main` behind a flag sooner than WP31.** Five days of
   divergence is already the largest single risk to the launch; the platform
   routes are additive and non-indexable, and `main` currently carries none of
   them.

---

## 7. What is going well — worth preserving

The gate discipline in this program is genuinely unusual and should not be
traded away for schedule.

- Independent review has caught real defects the implementer missed and
  claimed the opposite of, repeatedly: the WP27 GA4 capability-token leak; the
  WP28 fail-open path serving the full marketing site at every tenant host
  during a Convex outage; a `Promise.all` that never ran concurrently.
- The progress logs record falsified claims rather than quietly fixing them,
  and `AGENT_HANDOFF.md` explicitly instructs the next agent to treat progress
  files as claims. That instruction was correct — this review found two more
  drifted claims (§3) by re-running rather than reading.
- 44 rulings are recorded with rejected alternatives and reasons, so no
  decision has needed re-litigating.
- Mutation testing on every security-relevant story, including honest
  recording of the mutations that stayed green and why.

The problem is not rigour. It is sequencing, branch topology, and an
uncontrolled perimeter.
