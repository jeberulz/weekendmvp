# WP67 Stories - Launch Workspace program setup, rulings and gates

Branch: `claude/wp67-launch-crew-plan` (plan and rulings); the board and gate reports
after that on `claude/wp67-board`
Lane: Program/Migration (orchestrator)
Registry: `docs/PROJECT_STRATEGY.md` → Launch Workspace Program (WP67)
Manifest: `docs/wp/wp67-program-manifest.md`
Definition of done: numbers reserved on `main`, rulings recorded, manifest frozen,
and every gate G0–G7 run and recorded in `docs/wp/wp67-progress.md`.

## Stories

- [x] `WP67-S1` - Reserve WP67–WP87 and add the program files
  - Scope: `docs/PROJECT_STRATEGY.md`, `docs/wp/wp67-*`, `docs/plans/launch-workspace/**`
  - Acceptance criteria:
    - Registry rows for WP67–WP87 exist (they reach `main` with the plan PR)
  - Verification:
    - `git diff --check`
- [x] `WP67-S2` - Record the owner's decisions
  - Scope: `docs/wp/RULINGS.md`, `docs/plans/launch-workspace/06-decisions.md`
  - Acceptance criteria:
    - One dated row per decision, D1–D21, with D10 recorded as deferred
  - Verification:
    - Rows dated 2026-11-05 in `docs/wp/RULINGS.md`
- [ ] `WP67-S3` - Track the owner's long-lead items
  - Scope: `docs/wp/wp67-progress.md` (owner actions list)
  - Acceptance criteria:
    - Meta business verification and app review (D7, D8), tenant Resend domain (D6),
      wildcard DNS plan (D2) and the credits Terms review each have a status
  - Verification:
    - Owner actions table is current at every gate
- [x] `WP67-S4` - Freeze the manifest
  - Scope: `docs/wp/wp67-program-manifest.md`
  - Acceptance criteria:
    - Status reads RATIFIED and frozen; later scope changes need an owner ruling
  - Verification:
    - Manifest header
- [ ] `WP67-S5` - Run and record gates G0–G7
  - Scope: `docs/wp/wp67-progress.md` on `claude/wp67-board`
  - Acceptance criteria:
    - Each gate in `docs/plans/launch-workspace/04-build-plan.md` has a dated result
      with the check output, the reviews done and the owner's go
  - Verification:
    - Gate entries in `docs/wp/wp67-progress.md`

## Out Of Scope

- Feature code. The orchestrator assigns, reviews and gates; workers build.
- SMS of any kind while D10 is deferred.

## Notes

- Promote unknown product decisions to `docs/wp/RULINGS.md` after the owner rules.
