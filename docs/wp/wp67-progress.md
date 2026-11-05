# WP67 Progress - Launch Workspace program board

The orchestrator (Claude lane) keeps this file. It is the program's status board: every
WP, its lane, status, blockers and the next gate. Each WP's own detail lives in
`docs/wp/wpNN-progress.md` on that WP's branch. Agents never edit the other lane's
progress files; they write requests in their own under **Needs from the other lane**.

To read the other lane's latest status, fetch first:
`git fetch origin && git show origin/<branch>:docs/wp/wpNN-progress.md`.

## Board

Updated 2026-11-05 (both Phase 0 contract PRs open). Next gate: **G0** (Phase 0 close).

| WP | Phase | Lane | Branch | Status | Blockers | Next |
|---|---|---|---|---|---|---|
| WP67 | 0–7 | Claude (orchestrator) | `claude/wp67-board` | Plan PR #166 merged; manifest RATIFIED on `main` | — | Review WP68; run G0 once WP68 and WP69 merge |
| WP68 | 0 | Codex | `codex/wp68-data-contract` | PR #167 open; Claude review posted (2 high, 5 medium, 7 low) | — (H2 ruled: D22) | Codex fixes H1–H2, M1–M4 before G0 |
| WP69 | 0 | Claude | `claude/wp69-crew-contracts` | S1–S3 done; contract PR #168 open, all four checks green locally | S4 needs the owner's OK for up to $25 of live spend | Codex reviews C-ART, C-METER on #168; S4 spike on OK; S5 freezes prices |
| WP70 | 1 | Codex | `codex/wp70-metering` | Waiting | G0; C-METER from WP69 | — |
| WP71 | 1 | Claude | `claude/wp71-ai-gateway` | Waiting | G0; C-METER implementation from WP70 (stub until then) | — |
| WP72 | 1 | Claude | `claude/wp72-workspace-shell` | Waiting | G0; C-OPS from WP68 | — |
| WP73 | 1 | Codex | `codex/wp73-ledger-v2` | Waiting | G0; C-JOBS from WP69 | — |
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
| Confirm the ops-function feature-flag exemption WP68 cites (super-admin settings functions work while the workspace is off) | Before G0 | Open |
| Share the landing-page agent brief (skills, MCP servers and tools the AI employees use to design the page). The tool and MCP list is needed before the WP71 gateway design, because C-PROMPT has no tool-use field yet and every call goes through the gateway; the design detail can wait for WP75 | Tool list: WP71 S1. Full brief: WP75 | Open (John will share) |
| WP69 owner decisions: paid global daily budget ($50 provisional); whether precompute/evals use the free pool; prices for blueprint, roster, SEO pack, launch plan, ads drafts change rounds; short video 35 credits or 6 s clips | WP69 S5 (before C-JOBS freezes) | Open |

## Cross-lane contract reviews for G0

| Contract | Owner | Reviewer | Status |
|---|---|---|---|
| C-DATA, C-AUTHZ, C-OPS (WP68) | Codex | Claude | Reviewed on #167 (https://github.com/jeberulz/weekendmvp/pull/167#issuecomment-6663584469): fixes requested |
| C-ART, C-JOBS, C-PROMPT, C-METER (WP69) | Claude | Codex | PR #168 open, awaiting Codex review |

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
