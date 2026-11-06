# WP76 progress

## 2026-11-06 - Planned; S1a started (branch `claude/wp76-s1-email`, worktree `.worktrees/wp76-email`)

- Owner go-ahead: "Yes, start WP76-S1" (after #239 merged as `2d97d911`). Base: `origin/main` at `aba80b2f`.
- Audit: `sequences` and `sequence_steps` exist (Codex, `convex/schema/growth.ts`); C-ART `emailSequenceSchema`
  exists; the launch registry has the `email_sequence` slot (`pending_wp76`); `crew_email_sequence` is a C-JOBS job
  type with `email_sequence_regenerate` priced at 3 credits after the free rounds. C-APPROVAL already lists
  `sequences` / `sequence_steps` as `send` subjects with the `updated_at_with_children` version policy.
- Decision (orchestrator, against `02` §6.2 and the slot's inputs): the email step's parent moves from `roster`
  to `brand_kit`.
- Decision: each step points at the one `email_sequence` document (no per-email document kind; adding one would be
  a C-DATA change). WP79 reads a step's content through the S1a helper.

## Needs from Codex

None yet.
