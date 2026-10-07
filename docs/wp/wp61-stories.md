# WP61 Stories - Weekend prompt standard and backfill

Branch: `codex/wp61-prompt-backfill`
Lane: Program/Migration. The frozen manifest is `docs/wp/wp61-program-manifest.md`.
Registry: `docs/PROJECT_STRATEGY.md`
Product decisions: `docs/wp/RULINGS.md` (2026-10-07 WP61 rows)

Definition of done: all 176 `ideabrowser` ideas have four build prompts that pass weekend prompt standard v1, and each is on the ratchet list `ideas/prompt-standard.json`. The auditor no longer forces billing into Project Setup. `npm run audit:prompts` and `tests/prompts` keep the standard in place. `audit:idea --all` has no new failure against the baseline of 29. Typecheck, lint, full tests and build pass. No seeding, deploy or Convex change is part of this program.

## Stories

- [x] `WP61-S1` - Audit and freeze the manifest
  - Scope: `docs/wp/wp61-program-manifest.md`, `docs/wp/RULINGS.md`, `docs/PROJECT_STRATEGY.md`.
  - Acceptance criteria:
    - The baseline of all 225 ideas is measured and recorded. The 176 targets are split into waves. The owner decisions are recorded.
  - Verification:
    - `npm run audit:prompts -- --report` shows 0 of 225 passing before any rewrite.

- [x] `WP61-S2` - Standard, lint and ratchet
  - Scope: `ideas/SECTIONS.md`, `scripts/lib/prompt-standard.mjs`, `scripts/lib/prompt-standard-enforced.mjs`, `scripts/audit-idea-prompts.mjs`, `ideas/prompt-standard.json`, `package.json`, `tests/prompts/*`.
  - Acceptance criteria:
    - The standard is written once, in `ideas/SECTIONS.md`, and enforced by the lint.
    - A `Do not build:` line may name billing, a service or a login without counting as using it.
    - The lint reads legacy page formats. One test per rule, and a ratchet test that lints every listed idea.
  - Verification:
    - `npm run test:prompts`

- [x] `WP61-S3` - Relax the auditor's tier-in-setup rule
  - Scope: `scripts/lib/idea-quality.mjs`, `scripts/audit-idea-mdx.mjs`.
  - Acceptance criteria:
    - A Project Setup that never mentions billing owes no tier names. One that does must still name them.
    - `audit:idea` warns once per page that fails the standard and fails a page on the ratchet list.
    - The ReDoS tests for the tier check still pass.
  - Verification:
    - `npx vitest run lib/engine/audit.redos.test.ts tests/prompts`

- [x] `WP61-S4` - Wave 1, the pilot (5 ideas)
  - Scope: the five pilot pages, `ideas/prompt-standard.json`.
  - Acceptance criteria:
    - The five pass the lint and the gates in the manifest. MeetingMood AI is among them.
  - Verification:
    - `npm run audit:prompts -- --slugs <wave>`, `npm run audit:idea -- --all` against the baseline.

- [x] `WP61-S5` - Waves 2 to 9 (171 ideas)
  - Scope: the manifest's waves.
  - Acceptance criteria:
    - Each wave meets the gates in the manifest and is committed and pushed on its own.
  - Verification:
    - The same commands per wave. A sampled diff per wave is recorded in the progress log.

- [x] `WP61-S6` - Program gate
  - Scope: the whole branch.
  - Acceptance criteria:
    - `npm run audit:prompts -- --source ideabrowser` shows 176 of 176 passing.
    - `npm run typecheck`, `npm run lint`, `npm test` and `npm run build` pass, each read from its own exit code.
    - Progress records evidence, what was sampled, and what a human reviewer still owes.
  - Verification:
    - The commands above.

- [x] `WP61-S7` - Align the engine's build prompts to the standard
  - Scope: `lib/engine/compile.ts` and its tests.
  - Acceptance criteria:
    - New engine ideas start compliant: Project Setup has no Stripe catalog, plan column or metering table, and all four prompts pass the standard. Done only if the earlier waves hold and the engine's tests can be kept green. Otherwise recorded as a follow-up package.
    - A test compiles the engine fixture and lints it, so the template cannot drift from the standard.
  - Why it was needed now: the S3 warning made `test:engine` fail on the engine's own page. The engine's replay test expects a compiled page with no warnings.
  - Verification:
    - `npm run test:engine`

## Out Of Scope

- The 49 ideas from other sources (rewrite). They are linted and reported.
- Any section of a page other than the prompts. Stack and Business Model still name Clerk, Stripe and tiers.
- Seeding Convex, deploying, OG art, the manifest, hero or homepage code.
- Flipping `audit:idea` from a warning to an error for ideas not on the ratchet list. S7 is done, so this is the next small package, once the 49 other-source ideas are rewritten or retired.

## Notes

- Promote unknown product decisions to `docs/wp/RULINGS.md`.
