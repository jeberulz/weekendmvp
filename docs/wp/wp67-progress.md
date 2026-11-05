# WP67 Progress - Launch Workspace program board

The orchestrator (Claude lane) keeps this file. It is the program's status board: every
WP, its lane, status, blockers and the next gate. Each WP's own detail lives in
`docs/wp/wpNN-progress.md` on that WP's branch. Agents never edit the other lane's
progress files; they write requests in their own under **Needs from the other lane**.

To read the other lane's latest status, fetch first:
`git fetch origin && git show origin/<branch>:docs/wp/wpNN-progress.md`.

## Board

Updated 2026-11-05. Next gate: **G0** (Phase 0 close).

| WP | Phase | Lane | Branch | Status | Blockers | Next |
|---|---|---|---|---|---|---|
| WP67 | 0–7 | Claude (orchestrator) | `claude/wp67-launch-crew-plan` | Rulings recorded, manifest frozen | Plan PR not merged yet | Owner merges the plan PR; orchestrator runs G0 |
| WP68 | 0 | Codex | `codex/wp68-data-contract` | Not started | Plan PR on `main` | Start S7 and S1 |
| WP69 | 0 | Claude | `claude/wp69-crew-contracts` | Not started | Plan PR on `main`; S4 needs the owner's OK for up to $25 of live spend | Start S1–S3 |
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
| Merge the plan PR (`claude/wp67-launch-crew-plan`) so both lanes start from `main` | Before any WP starts | Open |
| Approve up to $25 of live AI spend for the WP69 cost spike | WP69 S4 | Open (WP69 asks first) |
| Start Meta business verification and app review (D7, D8) | Phase 5; lead time is weeks | Open |
| Create the tenant Resend project and sending domain (D6) | WP79 | Open |
| Wildcard DNS plan for `*.weekendmvp.app` (D2) | WP78 S3 | Open |
| Terms review for credits | WP80 S7 | Open |
| Rule D10 (SMS) when ready | Before any SMS work | Deferred |

## Cross-lane contract reviews for G0

| Contract | Owner | Reviewer | Status |
|---|---|---|---|
| C-DATA, C-AUTHZ, C-OPS (WP68) | Codex | Claude | Open |
| C-ART, C-JOBS, C-PROMPT, C-METER (WP69) | Claude | Codex | Open |

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
