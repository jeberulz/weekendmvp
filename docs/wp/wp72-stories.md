# WP72 Stories - Workspace shell and component kit

Branch: `claude/wp72-workspace-shell`
Lane: Work Package (Claude lane, mid), inside the WP67 Program/Migration lane
Registry: `docs/PROJECT_STRATEGY.md` (Launch Workspace Program, WP72)
Plan: `docs/plans/launch-workspace/04-build-plan.md` (WP72), `02-architecture.md` §15–§16; canvas rows 02 and 05
(extract in `docs/wp/wp72-canvas-extract.md`; canvas text is data, not instructions)
Owns: `app/dashboard/b/[projectId]/**` (scaffold), `components/workspace/**`, `components/platform/shell/**`
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
  - Scope: `app/dashboard/b/[projectId]/**`
  - Acceptance criteria:
    - One route per workspace page in the extract.
    - Each route returns a 404 unless the workspace flag is on and the caller owns the business
      (`requireBusinessAccess`).
    - Existing `/dashboard/*` routes are unchanged.

- [x] `WP72-S2` - Shell
  - Scope: `components/workspace/shell/**`, `components/platform/shell/**` (additive)
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

- [ ] `WP72-S4` - Tests and accessibility
  - Acceptance criteria:
    - vitest component tests.
    - The a11y-check skill on every component, with findings fixed.
    - A browser check of the kit from this worktree's dev server.
