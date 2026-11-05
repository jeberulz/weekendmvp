# WP67 Progress - Launch Workspace program board

The orchestrator (Claude lane) keeps this file. It is the program's status board: every
WP, its lane, status, blockers and the next gate. Each WP's own detail lives in
`docs/wp/wpNN-progress.md` on that WP's branch. Agents never edit the other lane's
progress files; they write requests in their own under **Needs from the other lane**.

To read the other lane's latest status, fetch first:
`git fetch origin && git show origin/<branch>:docs/wp/wpNN-progress.md`.

## Board

Updated 2026-11-05. **G0 passed** when #175 merged (`d67dc8e2`). **Phase 1 is running**: WP71 and WP72 (Claude lane) started on the owner's go; WP70 and WP73 are Codex's. Next gate: G1.

| WP | Phase | Lane | Branch | Status | Blockers | Next |
|---|---|---|---|---|---|---|
| WP67 | 0–7 | Claude (orchestrator) | `claude/wp67-gate` (board PR) | G0 passed (#174, #175) | — | Run G1 when WP70–WP73 merge |
| WP68 | 0 | Codex | `codex/wp68-data-contract` | **Done**: #167 merged, review fixes in #171 | — | — |
| WP69 | 0 | Claude | `claude/wp69-crew-contracts` | **Done**: S1–S6 merged (#168, #172, #175); C-JOBS frozen | — | — |
| WP70 | 1 | Codex | `codex/wp70-metering` | Ready to start (G0 passed) | — (C-METER merged) | — |
| WP71 | 1 | Claude | `claude/wp71-ai-gateway` | **In progress**: S1 provider adapters (Opus) | C-METER from WP70 (stub until then) | S5 seed precompute needs OK (≈ $15) |
| WP72 | 1 | Claude | `claude/wp72-workspace-shell` | **In progress**: S0 canvas extract, then S1 route scaffold | `creditsSummary` from WP73 (typed mock until then) | — |
| WP73 | 1 | Codex | `codex/wp73-ledger-v2` | Ready to start (G0 passed) | — (C-JOBS frozen) | — |
| WP74–WP79 | 2 | Both | see registry | Waiting | G1 | — |
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
