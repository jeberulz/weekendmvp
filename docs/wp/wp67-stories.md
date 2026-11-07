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

- [x] `WP67-S6` - One Weekend MVP logo across marketing and the workspace (issue #218)
  - Branch: `claude/wp67-brand-logo`
  - Scope: `components/primitives/Logo.tsx`, `app/globals.css` (logo utilities),
    `public/image/weekendmvp-mark.svg`, `components/workspace/shell/WorkspaceSidebar.tsx`,
    `components/platform/shell/WorkspaceShell.tsx`
  - Owner direction (2026-11-07): the brand logo is the SVG wordmark on www.weekendmvp.app
    (`public/image/weekendmvp-logo.svg`); its first letter, the W, is the compact mark. The serif
    "W tile + Weekend MVP" lockup from the workspace kit preview is retired.
  - Acceptance criteria:
    - `Logo` renders the wordmark (unchanged markup) or, with `variant="mark"`, the W cut from the
      same SVG path; both are coloured by `currentColor` with `role="img" aria-label="Weekend MVP"`
    - The workspace sidebar shows the wordmark linked to `/dashboard` ("Weekend MVP home")
    - The platform shell's collapsed sidebar and mobile header show the W mark, not a serif tile
    - Wren's avatar (`WrenMark`) is an agent avatar, not the brand, and stays as it is
  - Verification:
    - `npm run typecheck`, `npm run test:platform`, `npm run test:home`, a11y check, localhost preview

- [x] `WP67-S7` - Generated avatars for the named AI crew with Recraft V4.1 Flash (issue #220)
  - Branch: `claude/wp67-crew-avatars`
  - Scope: `convex/ai/pricing.ts`, `convex/ai/providers/recraft.ts`, `convex/ai/gateway.ts` (Flash model path),
    `lib/workspace/crew-avatars.ts` (style, personas, shipped list), `scripts/generate-crew-avatars{.mjs,-core.ts}`,
    `components/workspace/kit/EmployeeAvatar.tsx`, `public/image/crew/` (after approval)
  - Facts (Recraft API docs, read 2026-11-07): model id `recraftv4_1_flash`; 7 API units = $0.007 per 1024×1024
    raster; Flash takes no `style`, `style_id` or style references. 13 named crew (one per role key), so the full set
    lists at $0.091.
  - Acceptance criteria:
    - The Recraft request takes an optional `model` (default `recraftv4_1`); Flash is priced at 7,000 micro-USD,
      refuses a `styleId`, and an unpriced model is refused before any fetch; the image gateway reserves and records
      the model actually sent. No OpenAI image fallback anywhere on this path.
    - One shared avatar per role, keyed by role (a renamed lead keeps the lead's avatar); no per-founder or per-view
      paid call.
    - `EmployeeAvatar` keeps the accessible name and shows the initial until a role is listed in `CREW_AVATAR_SRC`.
    - Owner approves the visual direction, then separately approves the live run (`--live --confirm-spend-usd`).
    - Approved PNGs are committed pre-sized (small squares) under `public/image/crew/`, checked at 20/28/40 px and
      large, and previewed on localhost before merge.
  - Verification:
    - `tests/platform/ai-providers.test.ts`, `tests/platform/ai-gateway.test.ts`, `tests/platform/wp67-crew-avatars.test.tsx`,
      `npm run typecheck`, a11y check, localhost preview

## Out Of Scope

- Feature code. The orchestrator assigns, reviews and gates; workers build.
- SMS of any kind while D10 is deferred.

## Notes

- Promote unknown product decisions to `docs/wp/RULINGS.md` after the owner rules.
