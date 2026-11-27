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
