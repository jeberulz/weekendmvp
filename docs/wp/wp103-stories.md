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

- [x] `WP103-S2` - GuideSpec schema (zod) and `audit:guide`, including `--live`
  - Branch: `claude/wp103-s2-guide-audit` (cut from the S1 branch while PR 334 is open).
  - Scope: `lib/guides/*` (new: `spec-schema.ts`, `slots.ts`, `audit.ts`, `audit-live.ts`), `scripts/audit-guide.mjs`, `package.json` script, `app/(marketing)/guides/_shared/{types,blocks}.ts*`, `app/(marketing)/guides/5-to-9-builder/{guide.spec,price}.ts`, tests, docs.
  - Acceptance criteria:
    - `GuideSpec` is a zod schema and the TypeScript type is inferred from it. The 5-to-9 spec parses.
    - Copy slot names have one source of truth (`lib/guides/slots.ts`), used by the shared blocks and the audit.
    - `npm run audit:guide -- --slug=5-to-9-builder` passes on the real guide and exits 1 on any error finding.
    - Static rules, each with a failing fixture test: schema, sequential section ids, missing or empty slots, placeholder text, hero asset not approved or missing or draft, mixed currency, internal labels in copy and Receipt sources, unsupported gate mode.
    - `--live` checks a running URL with a headless browser. Every guide: no page errors, no sideways scroll at 390px, no placeholder text, one currency. Gated guides only: locked state shows only the open section, the unlocked state shows every section, a reload reads as returning, and (only with `--email`) one submit returns 200 from `/api/subscribe`. It never submits unless `--email` is passed.
    - The pure live-evaluation logic has fixture tests. The browser driver is checked against a local production server.
    - The rendered guide markup is unchanged by S2 (compared before and after).
  - Verification:
    - `npm run typecheck`, `npx eslint` on changed folders, `npm run test:home`
    - `npm run audit:guide -- --slug=5-to-9-builder`
    - `npm run audit:guide -- --slug=5-to-9-builder --live --url=http://localhost:3000/guides/5-to-9-builder --no-submit`
  - Not in S2: claim and source rules (S4), upsell rules (S3), word floors and honest-catch caps (thresholds need a second guide), rendering `gate.mode: none` in the layout (reported by the audit as unsupported).
- [x] `WP103-S3` - Offers registry and `UpsellCard` (replaces the guide-local `SprintCard`)
  - Branch: `claude/wp103-s3-offers-upsell` (cut from the S2 branch while PR 335 is open).
  - Scope: `lib/guides/{offers,offer-live,routes}.ts` (new), `lib/guides/{audit,spec-schema}.ts`, `scripts/audit-guide.mjs`, `scripts/lib/alias-hooks.mjs` (new), `app/(marketing)/guides/_shared/{blocks,GuideInteractions}.tsx`, `app/(marketing)/guides/5-to-9-builder/{guide.spec,_sections}.ts*`, tests, docs.
  - Acceptance criteria:
    - An offers registry holds each offer's kind (`paid`, `waitlist`, `free-asset`), status, copy, link, topic and audience tags and fit note. It validates at import, so a bad entry fails the build.
    - A paid offer reads its price from `lib/live/config.ts` through a named key. No price is typed into an offer. Waitlist and free offers cannot carry a price.
    - An offer's status can be derived from config, not typed. The Build-Along derives open or closed from `BUILD_ALONG`, `NEXT_BUILD_ALONG` and `NEXT_SESSION_CHECKOUT_ENABLED`.
    - A shared `UpsellCard` replaces the guide-local `SprintCard`. The 5-to-9 guide's rendered markup is byte-identical before and after.
    - The guide spec lists its upsells by offer id and placement (`mid`, `close`).
    - Click tracking keeps the event name `guide_sprint_click` and gains `guide` and `offerId`. This is the one deliberate behaviour change in S3.
    - `audit:guide` gains rules, each with a failing fixture test: no upsell, more than two cards or a repeated placement, unknown offer, closed offer, paid card for an offer that is not open, dead internal link, placeholder or non-https link, paid offer without a resolvable price, invalid offer entry. A thin offer (fewer than three bullets or no "not for" line) is a warning.
    - `rankOffers` ranks offers by topic and audience overlap, for the skill in S5.
    - The audit CLI loads `lib/live/config.ts` under plain Node through an alias hook, so prices and statuses are checked against the real config.
  - Verification:
    - `npm run typecheck`, `npx eslint` on changed folders, `npm run test:home`
    - `npm run audit:guide -- --slug=5-to-9-builder`
    - `CHECK_BUILT_GUIDE=1 npm run test:home` after `next build`
  - Not in S3: writing offer copy the owner has not approved (bullets and "not for" lines stay empty for the Build-Along), a waitlist offer for a real product (none exists), the footer soft link, renaming the click event.
- [x] `WP103-S3.1` - Switch for the Build-Along cards (owner request, 2026-11-27)
  - Branch: `claude/wp103-guide-cards-switch`.
  - Why: the audit showed the guide sells a sprint that cannot be bought, because the 14 Nov session ended and checkout for 5 Dec is off. The owner asked to remove the cards now and have a switch to turn them back on when seats open.
  - Acceptance criteria:
    - `BUILD_ALONG_GUIDE_CARDS_ENABLED` in `lib/live/config.ts` is the one switch. It ships `false`.
    - Off: both Build-Along cards and the sprint line and link in the founder note are gone. The served page has no mention of the Build-Along and no link to `/live/build-along`. On: the page is as before.
    - The offers registry ties the Build-Along to the switch (`switchKey`). Any offer can sit behind a named switch.
    - The audit does not judge a switched-off offer's sale status. It reports it as info, warns when no upsell is showing, and fails if copy links to a switched-off offer.
    - `audit:guide --offers-on` judges the guide as if the switch were on, so the owner can check before flipping it.
  - Verification: `npm run typecheck`, `npx eslint` on changed files, `npm run test:home` (run with the switch off and again with it temporarily on), `npm run test:security`, `npm run build`, a screenshot of the closing section at 1280 and 390 wide, `npm run audit:guide -- --slug=5-to-9-builder`.
  - Not in scope: the `/5-to-9-starter` page, which has its own Build-Along links.

- [x] `WP103-S4` - Source Critic for guides: claim kinds, a sealed review gate and mechanical verification
  - Branch: `claude/wp103-s4-guide-source-critic` (stacked on `claude/wp103-guide-cards-switch`, which touches the same audit file).
  - Design: a guide-specific record and review that mirror the Idea Engine's contract (`lib/engine/source-review.ts`), instead of changing the engine's `ResearchRecordV2`, so the engine's records and tests are untouched. It reuses the engine's strict excerpt matcher.
  - Scope: `lib/guides/{research-record,guide-review,verify-claims}.ts` (new), `lib/guides/audit.ts`, `scripts/guide-source-review.mjs` (new), `scripts/audit-guide.mjs`, `package.json` (`guide:source-review`), `tests/security/ai-imports.test.mjs` (allowlist entry), tests, docs.
  - Acceptance criteria:
    - A research record has sources, first-hand evidence and claims. Claim kinds: `stat`, `pay`, `tool-fact`, `date`, `quote` (outside sources, each with a verbatim excerpt) and `first-hand` (backed by evidence).
    - First-hand evidence is checked against this repo (`file-count`, `git-count`) or stated by the owner (`owner-statement`, which a reviewer confirms). It is never taken from the web.
    - A review is bound to a hash of the record, sealed against edits, covers every claim with the checks for its kind, and fails closed. `finalizeReview` cannot seal a PASS over a false check. A source last checked more than 120 days ago fails the review, more than 60 warns.
    - Mechanical checks: the record is consistent, each cited page is re-fetched and must contain the excerpt (a page that cannot be read leaves its claims unverified), first-hand evidence reproduces, and every figure in the guide copy traces to a claim or is listed as structure.
    - `guide:source-review` has `draft`, `verify`, `seal` and `check`. `check` exits 0 only for a sealed PASS on exactly this record. This is the gate the S5 skill calls before drafting.
    - `audit:guide` runs the research rules when `guides/records/{slug}.json` exists, and says plainly when it does not.
    - Each rule has a failing test, and the core behaviours were mutation-checked.
  - Verification: `npm run typecheck`, `npx eslint` on changed files, `npm run test:home`, `npm run test:security`, a dry run of `verify` on the real repo's evidence.
  - Not in S4: fetching pages through a proxy (`--fetch` uses Node's own fetch), a record for the 5-to-9 guide (it has none, so its claims are not checked), the skill that calls the gate (S5).
- [x] `WP103-S5` - `.claude/skills/publish-guide/SKILL.md`
  - Branch: `claude/wp103-s5-publish-guide-skill`, cut from the S4 re-land branch (PR 340) because the skill calls the S4 gate.
  - Note: PR 339 merged into the stale switch branch, not `main`. PR 340 re-lands the same S4 commit on `main`. Merge it before this one.
  - Scope: `.claude/skills/publish-guide/SKILL.md` (new), `lib/guides/verify-claims.ts` (stand-in evidence rule), `tests/home/guide-research.test.ts`, `CLAUDE.md`, plan and WP docs.
  - Acceptance criteria:
    - The skill walks plan steps 0 to 10 with the owner gates (brief, thesis and outline, evidence, sign-off) stopping the run.
    - It names the real commands: `guide:source-review draft|verify|seal|check`, `audit:guide` (static and `--live`), `typecheck`, `eslint`, `test:home`, `build`, and the `a11y-check` skill.
    - The Source Critic review is done by a fresh agent that sees only the record and the cited pages, never the writer's draft.
    - It never deploys, seeds, merges to `main` or asks for publication. A candidate is reviewed from a local build.
    - It never invents first-hand evidence. A placeholder mode lets a test run continue to the draft, and a mechanical rule makes the result unpublishable: evidence or a first-hand claim that is a stand-in fails `verify` and the audit with `evidence-placeholder`, a reviewer cannot confirm it, and placeholder text in copy fails `placeholder-text`.
    - It says each guide still needs its own `_sections.tsx` that composes shared blocks, and that anything missing from the template is a stop, not a new component.
  - Verification: `npm run typecheck`, `npx eslint` on `lib/guides` and the new test, `npm run test:home`, `npm run test:security`, the new rule fails on the old code, and the skill is listed by the harness.
  - Dry run (2026-11-27): the skill was run on "mastering Claude Code" through steps 0 to 8 in placeholder mode. The gates stopped the run at steps 0 and 1. Result in `docs/wp/wp103-progress.md`. The pilot branch `claude/wp103-s6-claude-code-pilot` is never merged.
  - Not in S5: a scaffold command for a new guide folder, a `skill-ladder` archetype in code (the template has one archetype today), Tier B research providers, the re-check command (S7).
- [~] `WP103-S6` - Pilot guide two (mastering Claude Code). Placeholder run done on `claude/wp103-s6-claude-code-pilot` (never merged): sourced and independently reviewed, audit fails only on the PLACEHOLDER stand-ins. Open: John's real evidence, then redraft the review with `--force` and rerun the audit.
  - Owner-provided evidence (2026-11-27): weekendmvp.app itself, built solo with Claude Code. The design, the research of over 200 startup ideas, and more features coming. This is first-hand evidence and goes in the research record as `first-hand` claims.
  - What the repo can already prove (checked 2026-11-27 with `guide:source-review verify`): 231 idea pages in `content/ideas`, 101 articles in `content/articles`. "Built solo" is an `owner-statement` that a reviewer must confirm. The pull-request and commit counts need full git history, which a shallow clone (this cloud session, and CI's default checkout) does not have, so they stay unverifiable until history is fetched in full.
  - Still needed from the owner: which specific things built with Claude Code to feature (screens, features, the Idea Engine, the audit tooling), with the real numbers behind each, and which screenshots.
- [x] `WP103-S7` - Re-check command and cadence
  - Branch: `claude/wp103-s7-guide-recheck`, cut from `main` after S1 to S5 landed.
  - Scope: `lib/guides/recheck.ts` (new), `scripts/guide-source-review.mjs` (a `recheck` subcommand), `tests/home/guide-recheck.test.ts` (new), `.claude/skills/publish-guide/SKILL.md` (step 11), `CLAUDE.md`, plan and WP docs.
  - Acceptance criteria:
    - `guide:source-review recheck` fetches every cited page again and reports each outside claim as `unchanged`, `drifted`, `gone` or `unreachable`. A drifted claim shows the old excerpt and the page's own sentence now, with how much wording they share. An unreadable page is never a pass.
    - It reproduces first-hand counts from this repo. A count that no longer holds fails the run. A commit or pull-request count that the clone cannot answer (a shallow clone) is `evidence-unchecked`, fails the run and is not saved. An owner statement is never a gap.
    - It exits 0 only when nothing needs a person. `--json` gives the same result for a program.
    - `--write` saves `guides/records/{slug}.recheck.json` with the date and the record hash, so the next run can say when the last re-check was and whether it is overdue (cadence `--every`, default 30 days). It does not save when a page could not be read or a count could not be checked. The file is not part of the record, so writing it never makes a sealed review stale.
    - `--all` rechecks every record and skips the review and re-check files beside them. `--pages-dir` reads saved pages instead of the web.
    - It changes neither the record nor the sealed review.
    - Each rule has a failing test, and drift detection, the incomplete-check guard and the overdue maths were mutation-checked.
  - Verification: `npm run typecheck`, `npx eslint` on the changed files, `npm run test:home` (three full runs), `npm run test:security`, and a live run on the Claude Code pilot's record against Anthropic's pages, plus a throwaway copy with one drifted excerpt.
  - Not in S7: a scheduler (a GitHub Action or a scheduled Claude task, the owner's call), an `audit:guide` warning for overdue or drifted records, refreshing a source's age from a clean re-check, and per-guide cadence stored in the record.

S2 to S7 were defined in the plan and each started on an owner go-ahead.

## Out Of Scope For S1

- Any visual change, copy change or new section.
- The zod schema, audits, offers registry and skill file (S2 to S5).
- Renaming the `builder-guide` CSS class or the `data-guide` attribute.
- The gate-preview, sources block and 30-day plan rebuild on the 5-to-9 guide itself.
- Switching the `/5-to-9-starter` page currency (settled separately by the owner).

## Notes

- `.agentic-workflow.yml` sets the branch prefix `codex/`. This session is bound to a `claude/` branch, so S1 uses `claude/`.
- Promote unknown product decisions to `docs/wp/RULINGS.md`.
