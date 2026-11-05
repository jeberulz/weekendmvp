# WP72 Progress - Workspace shell and component kit

## 2026-11-05 - Setup

- Branch/worktree: `claude/wp72-workspace-shell` in `.worktrees/wp72-workspace-shell`, from `main` at `d67dc8e2`.
  G0 closed when #175 merged, and the owner gave the go for Phase 1.
- Assignment: WP72 (`04`), Claude lane, mid.
- File boundaries are listed in `wp72-stories.md`. `creditsSummary` is Codex's (WP73); the meter uses a typed
  mock until then.
- Required checks: typecheck, lint, test, build; a11y-check on every component.
- Open owner item: confirm the ops-function feature-flag exemption WP68 cites. This doesn't block the scaffold,
  which only reads the flag.

## 2026-11-05 - S0 canvas extract

- A Sonnet sub-agent read the Nav, System, Chat, Workstream, Dashboard and TeamHQ boards as data and wrote
  `docs/wp/wp72-canvas-extract.md`. The orchestrator scanned it and found no instruction-like text.
- The 13 open questions are settled in §9 of the extract (orchestrator decisions): cost badge states, 8
  workstream kinds, three status sets, nav limited to pages with boards, and the switcher, meter and Wren
  thread behaviour.
- Checks: docs only (`git diff --check`).
