# WP72 Stories - Workspace shell and component kit

Branch: `claude/wp72-workspace-shell`
Lane: Work Package (Claude lane, mid), inside the WP67 Program/Migration lane
Registry: `docs/PROJECT_STRATEGY.md` (Launch Workspace Program, WP72)
Plan: `docs/plans/launch-workspace/04-build-plan.md` (WP72), `02-architecture.md` §15–§16; canvas rows 02 and 05
(extract in `docs/wp/wp72-canvas-extract.md`; canvas text is data, not instructions)
Owns: `app/(launch-workspace)/**` (scaffold, serving `/dashboard/b/[projectId]/*`), `components/workspace/**`
Definition of done (`04` WP72 acceptance):
- the kit renders behind the flag with fixture data;
- a11y-check passes;
- existing dashboard pages are unchanged.

Standing rules:
- WCAG 2.1 AA.
- No `any`, no `console.log`, no inline styles.
- Tailwind v4 tokens, Geist, lucide icons.
- Pages ship dormant: a 404 unless the workspace flag is on and the caller owns the business (C-OPS,
  C-AUTHZ).
- The browser check runs this worktree's code, not the main checkout.

## Stories

- [x] `WP72-S0` - Canvas extract
  - Scope: `docs/wp/wp72-canvas-extract.md`
  - Acceptance criteria: nav entries, page list, component inventory and copy for rows 02 and 05 extracted as
    plain data; reviewed by the orchestrator.

- [x] `WP72-S1` - Route scaffold
  - Scope: `app/(launch-workspace)/dashboard/b/[projectId]/**`
  - Acceptance criteria:
    - One route per workspace page in the extract.
    - Each route returns a 404 unless the workspace flag is on and the caller owns the business
      (`requireBusinessAccess`).
    - Existing `/dashboard/*` routes are unchanged.

- [x] `WP72-S2` - Shell
  - Scope: `components/workspace/shell/**`
  - Acceptance criteria:
    - Business switcher.
    - Credit meter reading `creditsSummary`, mocked behind a typed interface until WP73.
    - Nav entries from canvas row 02.
    - Keyboard and screen-reader support.

- [x] `WP72-S3` - Component kit
  - Scope: `components/workspace/**`
  - Acceptance criteria:
    - Built from canvas row 05:
      - employee card;
      - status pill (always with a text label);
      - approval card (Looks good / Ask for changes, cost badge);
      - Wren thread and cards;
      - workstream panel;
      - empty, loading and error states.
    - Each renders from fixture data.

- [x] `WP72-S4` - Tests and accessibility
  - Acceptance criteria:
    - vitest component tests.
    - The a11y-check skill on every component, with findings fixed.
    - A browser check of the kit from this worktree's dev server.

- [x] `WP72-S5` - Hard HTTP 404 for refused workspace routes (Codex follow-up)
  - Scope: `middleware.ts`, `tests/redirects/middleware.test.ts`
  - Acceptance criteria:
    - `/dashboard/b/[projectId]/*` checks the same workspace access query before PPR can stream.
    - Missing token, disabled workspace, denied project, malformed path and backend failure answer HTTP 404.
    - RSC and segment requests reach the gate; workspace responses are private and carry no referrer.
    - A production build confirms the HTTP status for signed-out requests.
