# WP103 Stories - Guide template and /publish-guide skill

Branch: `claude/wp103-s1-guide-shared-blocks` (S1). Later stories get their own branches.
Lane: Work Package
Registry: `docs/PROJECT_STRATEGY.md`
Plan: `docs/plans/publish-guide/PLAN.md`
Definition of done: `npm run typecheck` green, `npm run lint` with 0 errors, `npm run test:home` green, and the guide's server markup unchanged by S1.

## Stories

- [x] `WP103-S1` - Extract shared guide blocks and a per-guide spec from `/guides/5-to-9-builder`
  - Scope: `app/(marketing)/guides/_shared/*` (new), `app/(marketing)/guides/5-to-9-builder/*`, `tests/home/five-to-nine-builder-guide.test.ts` (path updates only), `CLAUDE.md` key paths.
  - Acceptance criteria:
    - The 5-to-9 page renders from `guide.spec.ts` plus its copy deck. Layout, gate, checklist, prompt and FAQ code lives in `_shared`.
    - Server markup of the guide page is byte-identical before and after (compared with `renderToStaticMarkup`).
    - No change to visible copy, CSS selectors, analytics event names or payloads, localStorage keys, or the `builder-guide` wrapper class.
    - A missing copy slot throws at render time, so a bad guide fails the build.
    - Existing guide tests pass with no assertion weakened. Only file paths in the test change.
  - Verification:
    - `npm run typecheck`
    - `npm run lint`
    - `npx vitest run tests/home/five-to-nine-builder-guide.test.ts`
    - `npm run test:home`
    - `CHECK_BUILT_GUIDE=1 npm run test:home` after `next build` (record if the build cannot run here)

- [ ] `WP103-S2` - GuideSpec schema (zod) and `audit:guide`, including `--live`
- [ ] `WP103-S3` - Offers registry and `UpsellCard` (replaces the guide-local `SprintCard`)
- [ ] `WP103-S4` - Extend Source Critic claim kinds for guides
- [ ] `WP103-S5` - `.claude/skills/publish-guide/SKILL.md`
- [ ] `WP103-S6` - Pilot guide two (mastering Claude Code), needs the owner's evidence file
- [ ] `WP103-S7` - Re-check command and cadence

S2 to S7 are defined in the plan. Do not start them without an owner go-ahead.

## Out Of Scope For S1

- Any visual change, copy change or new section.
- The zod schema, audits, offers registry and skill file (S2 to S5).
- Renaming the `builder-guide` CSS class or the `data-guide` attribute.
- The gate-preview, sources block and 30-day plan rebuild on the 5-to-9 guide itself.
- Switching the `/5-to-9-starter` page currency (settled separately by the owner).

## Notes

- `.agentic-workflow.yml` sets the branch prefix `codex/`. This session is bound to a `claude/` branch, so S1 uses `claude/`.
- Promote unknown product decisions to `docs/wp/RULINGS.md`.
