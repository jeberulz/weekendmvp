# WP67 Progress - Launch Workspace program board

The orchestrator (Claude lane) keeps this file. It is the program's status board: every
WP, its lane, status, blockers and the next gate. Each WP's own detail lives in
`docs/wp/wpNN-progress.md` on that WP's branch. Agents never edit the other lane's
progress files; they write requests in their own under **Needs from the other lane**.

To read the other lane's latest status, fetch first:
`git fetch origin && git show origin/<branch>:docs/wp/wpNN-progress.md`.

## Board

Updated 2026-11-06 (later). **G0 passed** (`d67dc8e2`). **G1 passed** (`a3f54c17`, #194). **Phase 2 in progress**: WP74 merged (#208); **WP77 done** (S1–S6, last #215, #217); WP75 S2a + S4a merged (#216); Claude runs WP75 (lane limit two); WP76 follows WP75 S2. Codex: WP78 and WP79 dormant primitives merged (#211, #212). Next gate: G2.

| WP | Phase | Lane | Branch | Status | Blockers | Next |
|---|---|---|---|---|---|---|
| WP67 | 0–7 | Claude (orchestrator) | `claude/wp67-board-p2` (board PR) | G0, G1 passed | — | Run G2 when WP74–WP79 merge; G2 needs live spend (20 test launches) and an owner OK |
| WP68 | 0 | Codex | `codex/wp68-data-contract` | **Done**: #167 merged, review fixes in #171 | — | — |
| WP69 | 0 | Claude | `claude/wp69-crew-contracts` | **Done**: S1–S6 merged (#168, #172, #175); C-JOBS frozen | — | — |
| WP70 | 1 | Codex | `codex/wp70-metering` | **Done**: S1–S3 (#180), S4–S6 (#191, sweep and alarm crons, limits, ops summary); G1 reviews pass with should-fix | — | Alarm delivery and the P2s below before the AI switch goes on |
| WP71 | 1 | Claude | `claude/wp71-ai-gateway` | **S1–S3 merged (#184)**, lock follow-up (#185), **gateway action bound to the real meter (#192)**. S4 cache helper, S5 seed precompute and S6 evals open | — | S4 and S6 in fixture mode on the owner's go; the S4 live cache test and S5 seed precompute need OK |
| WP72 | 1 | Claude | `claude/wp72-workspace-shell` | **Done, merged (#183)**; Codex's middleware hard 404 merged (#186, #190) | `creditsSummary` shape differs from the shell's typed mock (adapter needed) | Wire the real `creditsSummary` in Phase 2 |
| WP73 | 1 | Codex | `codex/wp73-ledger-v2` | **Done, merged (#179)**; G1 review: pass with should-fix | — | Review P2s below before WP80 |
| WP74 | 2 | Claude | `claude/wp74-wizard` | **Merged (#208)**; Codex's scanner reconcile and `requireOwnedWizardSession` merged (#209) | — | Follow-up: move the wizard from its local `ownedWizardSession` to C-AUTHZ `requireOwnedWizardSession` |
| WP75 | 2 | Claude | `claude/wp75-*` per story | **In progress**: S2a job runner and S4a deterministic checks merged (#216, dormant); S3a blueprint + brand kit text being built (`claude/wp75-s3a-blueprint`) | 12 owner questions in `wp75-progress.md` (Q11 `crewJob` limit before S2b); Needs from Codex 1–14 (13, the stale-run recovery cron, before S1 ships) | S3a review, then S1 roster, S2b DAG |
| WP76 | 2 | Claude | `claude/wp76-growth-drafts` | Waiting | WP75 S2 | — |
| WP77 | 2 | Claude | `claude/wp77-*` | **Done**: S1 (#203), S2–S4 (#210), S5 memory and Files (#215), S6 accessibility (#217) | Colour contrast of the chat still needs a real-browser check | — |
| WP78–WP79 | 2 | Codex | see registry | **Dormant primitives merged**: WP78 lead privacy (#211), WP79 tenant email and retention (#212). Nothing live | D5, D6; WP79 also needs WP76 S1 email drafts | Claude's independent privacy and publishing review of #211/#212 is running; findings go to Codex before D5 real capture |
| WP80–WP81 | 3 | Both | see registry | Waiting | G2 | — |
| WP82 | 4 | Claude | `claude/wp82-studio` | Waiting | G3 | — |
| WP83–WP84 | 5 | Both | see registry | Waiting | G4; Meta review | — |
| WP85–WP86 | 6 | Both | see registry | Waiting | G5 | — |
| WP87 | 7 | Gate | `claude/wp87-program-gate` | Waiting | G6 | — |

## Owner actions

| Item | Needed by | Status |
|---|---|---|
| Merge the plan PR (`claude/wp67-launch-crew-plan`) so both lanes start from `main` | Before any WP starts | Done (#166) |
| Approve up to $25 of live AI spend for the WP69 cost spike | WP69 S4 | Done (approved 2026-11-05) |
| Start Meta business verification and app review (D7, D8) | Phase 5; lead time is weeks | Open |
| Create the tenant Resend project and sending domain (D6) | WP79 | Open |
| Wildcard DNS plan for `*.weekendmvp.app` (D2) | WP78 S3 | Open |
| Terms review for credits | WP80 S7 | Open |
| Rule D10 (SMS) when ready | Before any SMS work | Deferred |
| Rule on `ai_usage.ownerId` | Before G0 | Done: D22, ownerless |
| Confirm the ops-function feature-flag exemption WP68 cites (super-admin settings functions work while the workspace is off) | WP72 (was "before G0"; G0 ran without it) | Open |
| Landing-page agent brief: C-ART amendment (WP69-S6) approved and merged (#172). D23 ruled 2026-11-05 (no tool loops). Still open: D24 (founder-page bans), D25 (CSS-only tenant motion) | D24, D25: WP75 | Partly done |
| WP69 open decisions: paid global daily budget ($50 provisional, a C-METER ops value); whether precompute and evals use the free pool; a Recraft logo measurement (top up ≈ $1.25; if it breaks 11 credits, a contract change). Done 2026-11-05: images 4, brand kit 11 (D4 amendment); C-JOBS frozen with video (WP82) and five change rounds left unpriced (#175) | Paid budget and free pool: WP70/WP71. Recraft: before WP80 | Partly done |
| Provider 5xx policy: a 5xx stays billed `possible`, so the worst case is charged (conservative). Could a provider outage lock Free users out of their lifetime pool? Keep it, or refund the reservation on 5xx | WP71 S2 ships the conservative rule; decide before WP74 | Open |

## Cross-lane contract reviews for G0

| Contract | Owner | Reviewer | Status |
|---|---|---|---|
| C-DATA, C-AUTHZ, C-OPS (WP68) | Codex | Claude | Reviewed on #167; fixes merged in #171 |
| C-ART, C-JOBS, C-PROMPT, C-METER (WP69) | Claude | Codex | Owner reports Codex is satisfied; #168 and the follow-up #172 merged |

## 2026-11-05 - Setup

- Branch/worktree: `claude/wp67-launch-crew-plan` in `.worktrees/launch-crew-plan`.
- Assignment: plan the Launch Workspace program, record the owner's rulings, reserve
  WP67–WP87, freeze the manifest.
- File boundaries: `docs/plans/launch-workspace/**`, `docs/wp/wp67-*`,
  `docs/wp/RULINGS.md`, `docs/PROJECT_STRATEGY.md`.
- Required checks: docs only, so `git diff --check`.
- Initial risks: merges deploy production Convex; two lanes share one repository.

## 2026-11-05 - WP67-S1, S2 and S4

- Actions taken: the owner approved every decision in `06-decisions.md` except D10, in
  their words "D10 - SKIP for now. the rest is approved." Rulings appended to
  `docs/wp/RULINGS.md`. Registry rows WP67–WP87 added. Manifest marked ratified. Plan docs
  marked ruled. The wizard is eight steps with no SMS step while D10 is deferred. The
  D11 wording was tightened to match the model router in `02` §5.2 (Opus runs only in
  batch precompute, eval judging and one capped escalation).
- Checks run: `git diff --check` on the docs.
- Next: the owner merges the plan PR; then the Claude lane starts WP69 and the Codex
  lane starts WP68 with the kickoff prompts in
  `docs/plans/launch-workspace/briefs/kickoff-claude.md` and `kickoff-codex.md`.

## 2026-11-05 - Phase 0 kickoff (orchestrator)

- Checked `origin/main`: manifest line 3 reads RATIFIED. Plan PR #166 is merged.
- Board worktree: `.worktrees/wp67-board` on `claude/wp67-board`.
- Read the program docs and the canvas (rows 01–05 boards needed for WP69). A field extract
  for sub-agents is on the WP69 branch at `docs/wp/wp69-canvas-extract.md`.
- WP69 started in `.worktrees/wp69-crew-contracts`: stories and progress committed, S1 (C-ART,
  Opus), S2 (C-JOBS, C-PROMPT, C-METER, Opus) and S3 (roles, Sonnet) running in parallel on
  disjoint files.
- WP68: no branch on `origin` yet. Review starts when the PR opens.

## 2026-11-05 - WP69 contract PR open; WP68 review started

- WP69 PR #168 (https://github.com/jeberulz/weekendmvp/pull/168): S1 (C-ART), S2 (C-JOBS, C-PROMPT,
  C-METER) and S3 (role rules) committed after independent Opus reviews (S1: 16 findings, S2: 15, S3: 7;
  all fixed). Local checks on the branch: typecheck, lint, test and build all exit 0.
- Asks for Codex are listed under "Needs from Codex" in `docs/wp/wp69-progress.md`:
  - `documents.kind` and task type literals.
  - Extra `ai_usage` and `ai_budgets` fields.
  - `ops_settings.paidGlobalDailyBudgetMicroUsd`.
  - Plan feature keys.
  - A `markSent` mutation.
- WP68 PR #167 is open. An Opus reviewer has the diff, `02` §4/§14, the rulings, and the WP69
  contracts for cross-checking. Findings go to #167 as a comment and are logged here.
- S4 cost spike not started: waiting for the owner's OK (cap $25).

## 2026-11-05 - WP68 review posted

- Opus review of #167 at `23462b77`: safe to deploy dormant. The only new public functions are 3 ops
  functions, all super-admin gated; no crons, routes or env vars; defaults fail closed. Typecheck, tests
  and lint exit 0. It is not ready to freeze as a contract.
- High:
  - H1: AI tables are missing C-METER fields and indexes (attemptKey, expiresAt, dayKey, pools, tiers).
  - H2: `ai_usage.ownerId` is required, against §4.2 and C-METER. That would put precompute under the
    admin's owner caps. Needs an owner ruling.
- Medium:
  - M1: `studioVideo` is not gated by `ai`.
  - M2: the AI gate ignores the paid pool.
  - M3: the boundary test covers one file only.
  - M4: no child-row or nested-parent authz for the new tables.
  - M5: unannounced convex bump from 1.43 to 1.49.
- Low: 7 findings.
- WP69 follow-ups from the cross-check (Claude lane, on #168):
  - Document the int64 ↔ number conversion for micro-USD.
  - List `WORKSPACE_DISABLED` as a code the gateway may see.
  - Say whether `seo_article` is ever written.
  - Publish a wizard answers schema.

## 2026-11-05 - Landing design brief

- John's design-skills brief received. Response written in `docs/plans/launch-workspace/07-landing-design.md`.
- Finding: C-ART in #168 carries three slop patterns (hero eyebrow, free-text font family, free lucide icon string on three same-size cards) and has no art-direction or layout fields, so every founder page would render through one template. Proposed WP69-S6 to fix before G0.
- Licences checked via the GitHub API and gsap.com: all MIT or Apache-2.0 except Vercel web-design-guidelines (no licence, link only) and GSAP (Standard License bars no-code animation builders; AI-written code allowed).
- Waiting on John: D23–D25 and the go for WP69-S6.

## 2026-11-05 - G0 (Phase 0 close): checks green, held on the price freeze

- Run by a gate-runner sub-agent in `.worktrees/wp67-gate` on fresh `main` at `601ee2a8`. That is the #172 merge,
  so it includes WP68 (#167, #171) and WP69 (#168, #172, with the S6 visual system and the D4 price amendment).

| Check | Exit | Result |
|---|---|---|
| `npm ci` | 0 | 835 packages; `npm audit` reports 24 existing advisories (not part of the gate) |
| `npm run typecheck` | 0 | no errors |
| `npm run lint` | 0 | 0 errors, 37 existing warnings (unused vars in `scripts/*.mjs`) |
| `npm test` | 0 | 3,692 tests passed, 0 failed, 0 skipped across 13 chained suites |
| `npm run build` | 0 | build completed |

- The working tree was clean before and after. Tests ran in fixture mode only: no live model calls, no Convex
  deploy.
- Merge history worth knowing: #168 was squash-merged before its last four commits were pushed. #172 carried
  them over, cherry-picked onto `main` with no conflicts.
- Open owner items that don't block G0 are listed under Owner actions: D23–D25, the remaining S5 price
  decisions, and the ops-function exemption.
- Criteria in `04` Gate G0:
  - D1–D6, D11, D14, D19 and D21 ruled: **met** (every row is in `RULINGS.md`).
  - WP68 and WP69 merged dormant: **met**.
  - Spike measured: **met**.
  - Codex reviewed C-ART and C-METER; Claude reviewed C-DATA: **met**.
  - typecheck, lint, test and build pass on `main`: **met**.
  - **Prices frozen in C-JOBS: not met.** `PRICES_STATUS` is still `"provisional"`.
- Correction: the first version of this entry said "passed". Codex's review on #174 caught the unmet criterion.
- The open price items are short video and launch film, the unpriced change rounds (blueprint, roster, SEO pack,
  launch plan, ads), and a Recraft logo measurement. The paid daily budget is an ops setting (C-METER), not a
  C-JOBS price.
- **Stopped here for the owner:** freeze C-JOBS (and decide the open items), or waive this criterion. After that,
  the go for Phase 1.

## 2026-11-05 - G0: C-JOBS freeze

- Owner: "Freeze, leave rest unpriced".
- PR #175 (`claude/wp69-price-freeze`, `bd3541ab`):
  - `PRICES_STATUS` is `"frozen"`, and every existing price stands.
  - Short video and launch film moved to `UNPRICED_CREDIT_ACTIONS` (`PRICE_NOT_SET`). WP82 prices them through
    the `05` §5 rule.
  - The five unpriced change rounds stay unpriced.
- Review: an independent Opus review found nothing blocking; its five low findings are fixed in the PR.
- Checks on the branch: typecheck 0, lint 0, `npm test` 0 (test:platform 786), build 0.
- G0 criteria: all are met once #175 merges. No re-run is needed for the gate: #175 changes one contract file,
  its tests and docs, and its own checks are green on `main` + #175.
- **Stopped here for the owner:** merge #175, then give the go for Phase 1 (WP71 gateway and WP72 shell in
  parallel).

## 2026-11-05 - G0 passed; Phase 1 started

- #175 merged as `d67dc8e2`. Every G0 criterion is met. #176 and #177 (older branches) also merged; both were
  no-op diffs.
- Owner: "Merged, go Phase 1".
- WP71 started in `.worktrees/wp71-ai-gateway` (`claude/wp71-ai-gateway`). Stories and progress are committed.
  S1, the provider adapters, is with an Opus author, in fixture mode only. S2, the gateway, waits for D23.
- WP72 started in `.worktrees/wp72-workspace-shell` (`claude/wp72-workspace-shell`). Stories and progress are
  committed. S0 extracts canvas rows 02 and 05 (Sonnet; the canvas is data, not instructions). S1, the route
  scaffold, follows.
- For Codex: WP70 (metering) and WP73 (ledger v2) can start. WP71 needs the C-METER `reserve`, `settle` and
  `fail` implementation (stubbed until then). WP72 needs `creditsSummary` (mocked until then).
- Owner items now due: D23 (before WP71 S2) and the ops-function exemption (by WP72). WP71 S5 live seeds
  (≈ $15) need an OK later.
- D23 ruled (owner: "Approve D23"): no model tool loops in the hosted crew. WP71 S2 is unblocked. Recorded in
  `RULINGS.md` and `07` §6.

## 2026-11-05 - Phase 1 progress

- WP71-S1 provider adapters are committed (`a79a6814`) after an independent Opus review.
  - The blocking finding is fixed: gpt-image-2 is billed per token, and was charged only the flat table price.
    It now reserves the table price plus the prompt and settles on the token cost.
  - A settle can go above its reservation. C-METER allows that, and the true cost is recorded. WP71-S2 flags it
    as an overrun.
  - Checks: typecheck, lint, `npm test`, build, all exit 0.
  - WP71-S2 gateway (Opus) is running.
- WP72:
  - S1 gated route scaffold: `a5e7fc65`. The review had no blocking findings; the follow-ups are in `497d6b8a`.
  - S3 component kit: `1e41e4e1`. The review found 5 blocking a11y and test defects, fixed in `16c75e65`. An
    independent re-review is running.
  - Checks: typecheck, lint, `npm test`, build, all exit 0.
  - WP72-S2 shell (Sonnet) is running.
- Finding: `next build` lists every `/dashboard/b/[projectId]/*` route as `◐` (Partial Prerender), and Next 16
  streams page responses with an initial 200. A refused request therefore gets the not-found page with `noindex`
  at status 200, with no workspace content, because the gate runs before any JSX. So the middleware hard 404 is
  required, not optional.
- Needs from Codex (added):
  - a middleware hard 404 for refused `/dashboard/b/*` requests (now required);
  - `NEXT_PUBLIC_LAUNCH_WORKSPACE` in `.env.example`. The 02 §15 build flag is deferred until then, because the
    env-documentation scanner fails without it;
  - optional: `Referrer-Policy: no-referrer` on `/dashboard/b/` and a GA path redaction for project ids;
  - devDeps `jsdom`, `@testing-library/react`, `@testing-library/user-event` and `vitest-axe`, so the WP72 focus
    behaviour can be DOM-tested;
  - still open: the WP69 ask-8 env entries (`AI_PROVIDER_MODE`, `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`,
    `RECRAFT_API_KEY`, `RECRAFT_STYLE_ID`) and item 11 (`@phosphor-icons/react`).
- Verify before any live spend:
  - the Sonnet 5.5 cache-read rate (the skill says $0.20, the spike says $0.10; $0.20 is kept);
  - the gpt-image-2 token rates on OpenAI's live pricing page.

## 2026-11-06 - WP72 PR open, WP71 PR open

- WP72 is done: PR #183 (S0 extract, S1 gated routes, S2 shell, S3 component kit, S4 a11y and browser check).
  Each story had an independent review; all checks pass. CodeRabbit's three points (copy-blocked wording, the
  soft-404 test comment, stale paths in the stories file) are fixed in `ffd4f9c8`. Waiting on the owner to merge.
- WP71 S1–S3 are in PR #184 (`claude/wp71-ai-gateway`):
  - S2 follow-up `5b9bb12f`: `safeIssuePath` work is bounded (deduped nodes, depth and node caps), and the cost
    cross-check reprices at the requested model.
  - S3 follow-ups `198d0224`, after two review rounds (the second found no blockers): the prompt-version check
    compares against the base branch lock, fetches it itself in CI and fails there if it can't read it; a
    CI-only test in `npm test` runs it for real. Hash format v3 covers the spec module, its runtime imports and
    the router's resolved model, effort, thinking and ceilings. The registry and router snapshot and re-validate
    specs. The import scan covers git-tracked files and more loader forms.
  - Checks on the final tree: typecheck, Convex typecheck, lint, `npm test`, the prompt-version check and build,
    all exit 0.
  - Next on the same PR: SKIP_DIRS matched at the top level only, more loader forms (`eval`, `new Function`,
    `_load`, `npm:` aliases), a model/ceiling regression test, and C-PROMPT value imports limited to
    `definePromptSpec`.
  - After #184 merges and `main` has a lock, a missing base lock must fail in CI (done in #185).
- Needs from Codex (added):
  - a `check:prompt-versions` package script and a CI step that runs it (a clearer signal; CI coverage no longer
    depends on it);
  - optional `fetch-depth: 0` or a `git fetch origin main` step;
  - C-METER contract questions: optional token fields on `FailArgs`, and an overrun marker in metering
    (`docs/wp/wp71-progress.md`).
- Owner items: merge #183; review and merge #184 when its follow-up commit lands; live spend for WP71 S4 (cache
  test) and S5 (≈ $15) when we get there.

## 2026-11-06 - G1 (Phase 1 close): running, one blocker in the Claude lane

- Merged to `main`: WP73 (#179), WP70 S1–S3 (#180), Codex's fixture-mode docs and DOM test tools (#181),
  WP72 (#183) and WP71 S1–S3 (#184). Head `ac7bb914`.
- G1 criteria (`04-build-plan.md`, Gate G1) and where each stands:

  | Criterion | Status |
  |---|---|
  | All checks pass on the merged tree | **Pass.** At `ac7bb914`: `npm run typecheck` 0, `npx tsc --noEmit -p convex` 0, `npm run lint` 0 (0 errors, 37 existing warnings), `npm test` 0 (every suite green; 1 CI-only test skipped locally), `npm run build` 0, `npm audit --omit=dev --audit-level=high` 0 |
  | Independent review (other lane) of WP70 and WP73 | **Pass with should-fix**, no P1 in either (findings below) |
  | Shell renders behind the flag | Pass (WP72 a11y- and browser-checked; pages `notFound()` with the flag off). The HTTP status is a soft 404 under PPR until Codex adds the middleware hard 404 |
  | Nothing user-visible on production | Pass. Every new Convex function is internal, except `creditsSummary`, which is authenticated, owner-scoped and behind `assertFeatureEnabled` |
  | Fixture-mode end to end: test business → gateway call → metered, settled → a job debits and refunds exactly once | **Not yet.** The gateway core runs only against an in-memory meter; nothing binds it to `internal.ai.metering`. The binding is WP71's (S2 "Gateway action" and WP71's acceptance line); it was wrongly deferred to WP70. Being built now on `claude/wp71-gateway-action`, with a convex-test integration test for exactly this path |

- WP70 review (Opus, given the diff and the contract): sound exactly-once accounting, exact owner caps, gating
  matches the owner ruling, all functions internal. Should-fix before Phase 2:
  - Gate refusals from `reserve`/`markSent` (`AI_DISABLED`, `WORKSPACE_DISABLED`, `RESOURCE_NOT_FOUND`) carry no
    `message`, so the gateway misclassifies them as internal errors. The WP71 gateway-action PR fixes our side.
  - No sweep cron yet (WP70-S4), so a crashed run leaves budget reserved and can lock an owner out daily.
  - Nits: the sharded counter reads every shard on each reserve (exact but serialised); "parallel" test names;
    a late `fail` after a sweep drops extra cost; global caps count by reservation day; ownerless precompute
    needs `workspaceEnabled` on, so WP71-S5 needs an explicit owner step.
- WP73 review (Opus, given the diff and the contract): exactly-once debit and refund, grant idempotency, bucket
  checks, immutability and dormancy all sound. Should-fix before Phase 2 or WP80:
  - An annual invoice grants one month's credits for the whole year, and monthly top-ups then hit
    `OVERLAPPING_ALLOWANCE_PERIOD`.
  - A mid-period upgrade (Builder's Hub → Growth) or a Lifetime buy during a subscription can never grant; the
    webhook throws on every retry. `EXPIRED_ALLOWANCE_PERIOD` throws for late-paid invoices.
  - No reversal for a refunded or disputed `plan_grant`.
  - C-LEDGER promises `debitJob`/`refundJob`; only `debitTask(credits)`/`refundFailedTask` exist, with the price
    supplied by the caller. `creditsSummary` returns bigints with no `max`/`plan`, unlike the shell's shape.
  - Nits: `Date.now()` in the `creditsSummary` query and a ±2-minute clock-skew throw; the property test never
    crosses a period end; `resolvePlan` cannot return `growth`; `debitTask`/`refundFailedTask` are not
    feature-gated; future-dated grants expire the current allowance early.
- Orchestrator items Codex asked for, done on this branch: the C-METER shutdown-cleanup ruling in `RULINGS.md`,
  and `02-architecture.md` now shows the workflow and workpool components as mounted (WP70-S1).
- Needs from Codex (added): the WP70 and WP73 should-fix items above; throw `{code, scope, message}` for meter gate
  refusals and say in C-METER that `reserve` may throw gate codes; WP70 S4–S6. Still open from before: the
  middleware hard 404, `check:prompt-versions` script and CI step, the C-METER `FailArgs` token fields and
  overrun marker.
- Next: review and merge the WP71 gateway-action PR, re-run the G1 checks on that tree, then mark G1 passed and stop.

### Update: gateway action ready (PR #192)

- `convex/ai/gatewayActions.ts` binds the gateway to `internal.ai.metering.*` (internal action `runPrompt`, fixture
  unless `AI_PROVIDER_MODE` is exactly `live`). Integration tests against the real meter and ledger cover the G1
  path: business, task, debit, gateway call reserved → sent → settled, replay as a duplicate; a failed run with one
  re-ask, then a refund exactly once and no further provider call; the kill switch with live mode and a fake key
  makes zero fetch calls.
- Honest limit: the credit-funded job path is proven through the injectable `runPromptWithMeter` with a test-only
  `allowInternal`, because the only registered spec is the internal probe. The registered action settles only
  eval runs until the first non-internal crew spec lands (WP74+).
- Reviews: independent Opus review "approve with should-fix", no P1; fixes re-reviewed twice.
- Checks on `e1b08882`: typecheck, Convex typecheck, lint (0 errors), `npm test`, `npm run test:security`, the
  prompt-lock CLI and `npm run build` all exit 0. An isolated anonymous local Convex deploy (3340/3341, dummy
  local-only billing bridge value) reported functions ready with every component installed. No cloud touched.
- G1 closes when #192 merges and the checks rerun on that `main`.

## 2026-11-06 - G1 passed; Phase 1 closed

- Merged since the last entry: the lock follow-up (#185), the G1 board (#187), Codex's middleware hard 404 (#186,
  #190), the prompt-version CI step (#188), workspace dependencies (#189, #193), WP70 S4–S6 (#191) and the WP71
  gateway action (#192). Head `a3f54c17`.
- G1 criteria (`04-build-plan.md`, Gate G1):

  | Criterion | Result |
  |---|---|
  | All checks pass | **Pass** at `a3f54c17`: `npm run typecheck` 0, `npx tsc --noEmit -p convex` 0, `npm run lint` 0 (0 errors, 37 existing warnings), `npm test` 0, `check-prompt-versions` 0 (compared with the base lock), `npm run build` 0, `npm audit --omit=dev --audit-level=high` 0. An isolated anonymous local Convex deploy (3350/3351, dummy local-only billing bridge value) reported functions ready with every component installed. No cloud deployment was touched |
  | Fixture-mode end to end | **Pass** (`tests/platform/ai-gateway-action.test.ts`, 17 tests, real meter and ledger): business, task, debit, gateway call reserved → sent → settled, replay a no-cost duplicate; a failed run with one re-ask, then a refund exactly once and no further provider call; the kill switch with live mode and a fake key makes zero fetch calls. Limit: the credit-funded job path runs through the injectable `runPromptWithMeter` with a test-only `allowInternal`, because the only registered spec is the internal probe |
  | Independent review (other lane) of WP70 and WP73 | **Pass with should-fix, no P1** in all three reviews: WP73 (#179), WP70 S1–S3 (#180), WP70 S4–S6 (#191) |
  | Shell renders behind the flag | **Pass**: WP72 merged; refused workspace routes now return a hard 404 (#186, #190) |
  | Nothing user-visible on production | **Pass**: the new public functions are `creditsSummary` (authenticated, owner-scoped, flag-gated) and `ops/spend.readDaily` (super admin only). The two new crons do nothing with no data: the sweep reads one indexed page; the alarm returns without an `ops_settings` row and cannot fire with zero budget, and it sends no email |

- WP70 S4–S6 review: sweep chain bounded (≤ 1,000 rows a tick), no loop; alarm dedupe durable per day, pool and
  threshold; limits match `02` §13 and are flag-gated; `readDaily` super-admin only; metering accounting
  unchanged; the gateway still classifies the gate errors correctly.
- Orchestrator records done on this branch: the owner's shutdown-monitoring ruling in `RULINGS.md`, and
  `docs/plans/launch-workspace/contract-changes.md` (new) acknowledging the `ops_settings.spendAlarmState` /
  `spendAlarmPreviousDayState` fields and the C-METER gate-error behaviour. Codex asked for both before merge;
  they are recorded after.
- Owed before Phase 2 relies on each piece (Needs from Codex):
  - **Before the AI switch goes on:** spend alarms only write `audit_events`; nothing reads or sends them (03 §9
    expects the operator to be told).
  - **Before WP80 grants credits:** annual invoices grant one month for a year; mid-period upgrades and Lifetime
    buys during a subscription can never grant; late-paid invoices throw; no reversal for a refunded or disputed
    `plan_grant`.
  - **Before generators debit credits (WP74+):** C-LEDGER `debitJob` / `refundJob` that price on the server, or a
    contract amendment; `debitTask` / `refundFailedTask` feature-gated.
  - **Before the shell shows real credits:** a `creditsSummary` shape the shell can use, or an adapter; no
    `Date.now()` in that query and no ±2-minute clock-skew throw.
  - Nits: a `message` on gate refusals; alarms count in-flight reservations as spend (write it down); global caps
    count by reservation day; the sharded counter reads every shard; `resolvePlan` cannot return `growth`.
- Claude lane, next on the owner's go: WP71 S4 (cache helper) and S6 (evals) in fixture mode; WP74–WP77 in Phase 2.
  Owner OKs still needed: WP71 S4 live cache test, WP71 S5 seed precompute (≈ $15 for the 5 spike ideas; it also
  needs `workspaceEnabled` on with an allowlist cohort, because ownerless `reserve` is gated).
- **Stopped at G1 as the kickoff instructed.**

## 2026-11-06 - Phase 2 started

- The owner merged #194 and said "Merged, go Phase 2".
- Claude lane, two at once (`05` §3): WP77 (`claude/wp77-wren-approvals`) with S1 approvals first, because Codex's
  WP78 publisher and WP79 sender call `assertApproved` (C-APPROVAL); and WP74 (`claude/wp74-wizard`) with S1–S2.
  WP75 starts when WP74 lands; WP76 when WP75 S2 lands.
- Codex lane: WP78 (publishing un-park) and WP79 (tenant email) can start; build against C-APPROVAL once WP77-S1
  merges (stub until then, per `05` §2.3).
- G2 will need live spend (20 live test launches, median ≤ $0.75) and owner steps (kill switches on production,
  the allowlist cohort). Nothing live runs without an OK.

### Phase 2 status - Needs from Codex and owner questions

- WP77-S1 (C-APPROVAL, `assertApproved`) is committed (`c402c967`). The independent review approved it with
  should-fix items, which are being fixed before the PR opens.
- WP74-S1/S2 (wizard steps, founder signals) is committed (`82036f77`). The independent review approved it with
  should-fix items, which are being fixed. **The WP74 PR cannot go green until Codex lands the scanner change
  below**: the WP68 boundaries scanner requires `requireBusinessAccess` in every public `convex/workspace`
  function, and a wizard runs before any business exists.
- Needs from Codex (added):
  - C-AUTHZ `requireOwnedWizardSession(ctx, sessionId)` in `convex/platform/authz.ts`, and a `PRE_BUSINESS_CONTROLS`
    exact allowlist in `tests/security/wp68-workspace-boundaries.test.mjs` (`getWizardAccess` and `startOrResume`
    need the current-user guard; the other five wizard functions need `requireOwnedWizardSession`;
    `assertFeatureEnabled` stays required for all).
  - Middleware hard 404 for `/start` and `/start/*` (via `getWizardAccess`).
  - Optional: `founder_signals` index `by_wizardSessionId_and_step`; `NEXT_PUBLIC_LAUNCH_WORKSPACE` in `.env.example`.
  - For C-APPROVAL: an `approvals.subjectVersion` fingerprint over every content field (fail closed when missing),
    `approvals.consumedAt`, index `by_status_and_createdAt`, and an hourly approval-expiry cron that cannot overlap.
- Owner questions:
  1. `checkLimit("wizardStart")` also requires the `ai` feature. Should a wizard start be refused when AI is off
     (the current plan, since the crew spends AI right after start), or should Codex add a limit-only check?
  2. Approval expiry while the workspace is switched off: may the expiry cron keep running then? It only takes
     permission away, never grants it.

## 2026-11-06 - Phase 2 progress: WP74 and WP77 S2–S4 merged

- Merged to `main`: WP74 wizard and business creation (#208, `d0f6e572`); WP68-S8 scanner reconcile with C-AUTHZ
  `requireOwnedWizardSession` (#209, Codex); WP77 S2–S4 change rounds, Wren chat and card-only tools (#210,
  `687a14db`); WP78 lead privacy primitives (#211) and WP79 tenant email primitives (#212), both dormant (Codex).
- Contract changes recorded in `docs/plans/launch-workspace/contract-changes.md`: C-AUTHZ
  `requireOwnedWizardSession` (#209) and the C-DATA additions in #212.
- WP75 started on `claude/wp75-crew` (the board said `claude/wp75-crew-engine`; corrected). Plan: 17 stories,
  20 stop-and-ask items, 13 owner questions (`docs/wp/wp75-{stories,progress}.md`). The owner answered the roster
  question: **blueprint first** (`docs/wp/RULINGS.md`, 2026-11-06). The launch DAG becomes blueprint → roster →
  the rest. 12 owner questions remain.
- WP77-S5 (Wren memory, Files page) is written and in review fixes; S6 (accessibility) follows.
- Owed by the Claude lane: an independent privacy and publishing review of #211/#212 before D5 real capture, and
  the WP74 move to `requireOwnedWizardSession`.
- G2 still needs live spend (20 test launches) and owner steps; nothing live has run.

## 2026-11-06 - Phase 2 progress: WP77 done, WP75 S2a + S4a merged

- Merged to `main`: WP77-S5 Wren memory and Files (#215, `2318762d`); WP75 S2a crew job runner and S4a
  deterministic quality checks, both dormant (#216, `dbabb646`); WP77-S6 Wren chat accessibility (#217, `eaec0abc`).
  WP77 is complete.
- Each story passed an independent Opus review and a narrow re-check before its PR; Codex and CodeRabbit review
  threads on #216 and #217 were addressed and resolved.
- WP75 now uses one branch per story: S3a (blueprint personalisation and brand kit text) is in progress on
  `claude/wp75-s3a-blueprint`. In S3a a hard quality-check failure fails the step closed; the repair call waits
  for S4b and owner questions Q6/Q7.
- The Claude lane's independent privacy and publishing review of #211/#212 is running.
- Still open for the owner: 12 WP75 questions (Q11, the `crewJob` limit, must be ruled before S2b), confirming the
  own-idea market ruling recorded in `wp75-progress.md` § S4a, and Needs from Codex 14 (archived-business refunds).
- G2 still needs live spend and owner steps; nothing live has run.
