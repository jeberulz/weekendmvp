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

## 2026-11-05 - S1 route scaffold

- Author: an Opus sub-agent.
- `convex/workspace/access.ts`: the read-only query `getWorkspaceAccess`. C-OPS `assertFeatureEnabled(ctx, "workspace")`
  runs first, then C-AUTHZ `requireBusinessAccess(owner)`. Every denial returns `{ allowed: false }`, so callers can't
  tell the reasons apart. It is dormant while `ops_settings.workspaceEnabled` is off.
- `lib/workspace/access.ts`: a server gate cached per request. Any refusal or error becomes `notFound()`.
- `lib/workspace/routes.ts`: the manifest of 15 routes (extract §9.5), with three groups (This weekend, Workspace,
  Account).
- Routes sit in `app/(launch-workspace)/dashboard/b/[projectId]/` so the legacy dashboard layout doesn't wrap them. The
  URLs stay the same and existing dashboard files are untouched. noindex is set explicitly.
- `team/[employee]` accepts the roster role keys except `lead`.
- `convex/_generated/api.d.ts`: two lines added by hand to match codegen. Regenerate the file at the next
  `convex dev`.
- Needs from Codex:
  - a hard 404 status for refused routes, through middleware; `notFound()` can stream a soft 404;
  - the optional build-time flag `NEXT_PUBLIC_LAUNCH_WORKSPACE` (`02` §15) in `.env.example`, if wanted.
- Checks (orchestrator, with S3 in the tree): typecheck 0, lint 0 (37 existing warnings), `npm test` 0, build 0. The
  build lists every `/dashboard/b/[projectId]/*` route.
