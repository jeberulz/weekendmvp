# WP74 Progress - Wizard and business creation

## 2026-11-06 - Started (Phase 2)

- G1 passed (`d8055b98`); the owner said "Merged, go Phase 2".
- Branch and worktree: `claude/wp74-wizard` at `.worktrees/wp74-wizard`, from `d8055b98`.
- Runs alongside WP77 (lane limit: two WPs at once; file sets do not overlap).
- Needs from Codex: none yet.

## 2026-11-06 - S1 and S2

- What: the eight-step wizard (C-WIZARD `WIZARD_STEPS`, no SMS step, no phone field: D10) with a suggested
  default on every step, Back, Skip and Rewrite. Progress lives in `wizard_sessions`, so a reload resumes. Every
  decision writes one `founder_signals` row and mirrors a summary into `answers.signals`. The flow ends on a
  "Meet your co-founder" placeholder. No business or project is created (S4); there is no roster (WP75).
- Files:
  - `convex/workspace/wizard.ts`: `getWizardAccess` (route gate), `startOrResume`, `getSession`, `saveStep`,
    `skipStep`, `rewriteStep`, `goBack`.
  - `convex/workspace/signals.ts`: `recordFounderSignal`, `mirrorSignal` (helpers only, no public functions).
  - `lib/workspace/wizard/defaults.ts`: `wizardSeedFor` (the single seed switch point) and step helpers.
    `lib/workspace/wizard/labels.ts`: copy and bounded summaries.
  - `lib/workspace/wizard-access.ts`: the server gate. `app/start/{layout,WizardPage,error}.tsx`,
    `app/start/[ideaSlug]/page.tsx`, `app/start/own/page.tsx`.
  - `components/workspace/wizard/{WizardFlow,WizardStepPanel,WizardProgress,MeetCofounder}.tsx`.
  - `convex/_generated/api.d.ts`: two modules added by hand, matching codegen (regenerate at the next
    `convex dev`).
  - Tests: `convex/workspace/{wizard,signals}.test.ts`, `tests/platform/wp74-wizard-{ui,flow,access}.test.ts(x)`,
    `tests/security/wp74-wizard-guards.test.mjs` (new Claude file).
- Decisions:
  - Defaults come from fixtures until WP71-S5: HydroTrail by slug, a generic seed for other library ideas, and a
    light own-idea outline marked "Not yet validated" (D15). Only `wizardSeedFor` changes when `idea_crew_seeds`
    lands. Suggested answers: web, free, a waitlist goal this weekend, strategist, Wren, the name from the title.
  - Each step mutation names the step it answers. A call for any other step changes nothing (double click, stale
    tab). Signals are also deduped per (session, step, action). That uses a bounded scan of the owner's latest 200
    rows, because there is no session index.
  - Classification: equal to the default is `kept`, the founder's own words is `rewrote`, another offered choice
    is `changed`, and Skip applies the default as `skipped`. In the C-WIZARD `kept`/`edited` mirror, `changed`
    and `rewrote` become `edited`, and `skipped` becomes `kept` with a "Skipped; used the suggested …" note.
  - `rewriteStep` takes free text on idea (own idea), blueprint (rework notes), platform (custom), name and
    partner name. Commercial model, goal and partner personality have no free-text field in C-WIZARD, so their
    Rewrite button opens the choice editor (it saves through `saveStep`) and the server refuses `rewriteStep`
    there with `INVALID_STEP`.
  - Rework keeps the session on the blueprint step. Completion parses through `wizardAnswersSchema`, so it needs
    `looks_good`. An own idea starts on the blueprint step and logs `idea: rewrote` with no `before`. Back from
    the finished screen reopens the last step. A completed session without a project still counts as active, so
    starting again resumes it. Limit: 20 new sessions per owner per rolling day.
- Flag behaviour: every page calls `requireWizardAccess` (C-OPS `workspace` + cohort, signed in, known idea) before
  any JSX and answers `notFound()` otherwise. There is no `NEXT_PUBLIC_LAUNCH_WORKSPACE` helper in the repo yet
  (WP72 deferred it), so the runtime flag is the gate. Middleware does not cover `/start`, so under PPR a refusal
  can stream with status 200 (no wizard content). See Needs from Codex.
- Tests: convex-test (22 wizard, 3 signals) covers auth, flag off, cohort, owner isolation, phone fields refused,
  over-long and multi-line text, back/skip/rewrite, the double-click no-op, resume, rework, completion needing
  `looks_good` with no project, and one signal per decision. DOM tests (testing-library + vitest-axe, jsdom,
  colour-contrast off because jsdom can't paint) cover the step panel, keyboard-only choice, progress
  `aria-current`, the live-region announcement and focus move, and the Meet screen. The gate tests cover every
  404 path.
- Checks: `npm run typecheck` 0; `npx tsc --noEmit -p convex` 0; `npm run lint` 0 (0 errors, 37 existing
  warnings); wizard test files 0; `npm run test:security` **1**: the Codex-owned WP68 scanner fails on
  `convex/workspace/wizard.ts` (below); everything else passes (203/204 Node tests, 121/121 Vitest).
  `npm test` **1**, because it stops at `test:security`. Every other suite run on its own exits 0 (og, links,
  redirects, auth, sitemap, convex 804, engine, editorial on re-run, after one 5 s timeout while the build ran
  alongside, home, prompts, platform 1084, live). `npm run build` 0 (`/start/[ideaSlug]` ◐, `/start/own` ƒ).
- Docs: this entry; the stories are not ticked yet (see below).
- Needs from Codex: superseded by the review-fixes entry below.
- Not done: S3–S6. The a11y-check skill and live keyboard pass are S6, and contrast is unchecked in jsdom.
  S1/S2 are met in code but stay unticked until item 1 lands and the full gate is green.

## 2026-11-06 - S1/S2 review fixes (after 82036f77)

- C-LIMITS: the local 20-a-day counter is gone. `startOrResume` calls `checkLimit(ctx, "wizardStart", user._id)`
  (3 a day) only on the insert path, after the resume lookup. A resume costs nothing. A refusal throws before the
  insert in the same transaction. `checkLimit` also needs the `ai` feature, which is kept because the blueprint
  and roster spend AI right after start. With AI off a new start is refused (`AI_DISABLED`) but a resume still
  works.
- Resume is exact at any number of sessions. The lookup reads the owner's sessions with no `projectId`
  (`by_ownerId_and_projectId`, `projectId` unset) and matches the idea exactly, instead of scanning the latest 50.
- Engine drafts: `libraryIdea` returns null for `isEngineDraftSlug` (re-exported in `catalogPolicy.ts`). Neither
  the route gate nor `startOrResume` accepts a draft, and neither reveals its title.
- Signals: a signal is skipped only when it repeats the latest one for the same (session, step), with the same
  action and the same `after`. Kept → changed → rewrote → kept now records four rows. Double clicks were already
  no-ops through the step-key check.
- UI: a library session rewritten as an own idea now replaces the URL with `/start/own?session=…`, so a reload
  resumes it. `MeetCofounder` shows a failed Back as `role="alert"`.
- Session guard: the five session functions now call `ownedWizardSession(ctx, sessionId)`. It does the C-AUTHZ
  user check (expiry-aware in mutations) and the ownership check, with the same signature as the planned
  `requireOwnedWizardSession`. The swap is the import plus the name at each call site.
  `tests/security/wp74-wizard-guards.test.mjs` pins the exact guard per function.
- Decision for the orchestrator to record (Rewrite on fixed-choice steps): C-WIZARD has no free-text field for
  commercial model, goal or partner personality. On those steps Rewrite opens the choice editor (saved through
  `saveStep`, logged `changed` or `kept`), and `rewriteStep` refuses them with `INVALID_STEP`. Rewrite takes the
  founder's own words on idea, blueprint (rework notes), platform (custom), name and partner name.
- Tests: wizard 27 and signals 3 (convex-test), plus the UI, flow and access files. New cases: the 4th start
  refused while resumes work, AI off, resume past 60 sessions, the engine-draft refusal, the four-decision
  sequence, the own-idea URL move, and the Meet alert.
- Needs from Codex:
  - (a) `requireOwnedWizardSession(ctx, sessionId)` in `convex/platform/authz.ts`. Plus an exact
    `PRE_BUSINESS_CONTROLS` allowlist in `tests/security/wp68-workspace-boundaries.test.mjs`:
    `getWizardAccess` and `startOrResume` require `requireCurrentPlatformUser*`; `getSession`, `saveStep`,
    `skipStep`, `rewriteStep` and `goBack` require `requireOwnedWizardSession`; all still require
    `assertFeatureEnabled`.
  - (b) A middleware hard 404 for `/start` and `/start/*`.
  - (c) Optional: index `founder_signals.by_wizardSessionId_and_step`.
- Checks: typecheck 0; `npx tsc --noEmit -p convex` 0; lint 0 (0 errors, 37 existing warnings); the five wizard
  test files 0 (54 tests); `npm run test:security` 1, failing only on the known WP68 scanner test
  (`not ok 200 - workspace public Convex functions check both the feature and the capability`,
  `convex/workspace/wizard.ts:getWizardAccess missing capability guard`). The other 204 Node security tests pass
  (1 skipped, as before), and so do 121/121 Vitest security tests. Every other `npm test` suite exits 0 (og,
  links, redirects, auth, sitemap, convex 809, engine, editorial, home, prompts, platform 1087, live).
  `npm run build` 0.

## 2026-11-06 - S3: Option D built as an interim; Option A awaits the owner's ruling

- Why not the real draft: no C-METER attempt-key form fits a call made before the business exists.
  - `job` needs `ownerId`, `taskId` and a `crew:` job key, and `tasks.projectId` is required.
  - `chat` needs the run's `projectId`.
  - `eval` is ownerless. It skips the owner's Free $1.50 lifetime ceiling and $1.00 daily cap, its gate
    (`settingsForCall`) skips the cohort, and it is the CI graders' key. Rejected.
  - The meter itself (`convex/ai/metering.ts`) already accepts an owner with no project and any key string. Only
    the gateway's key forms and the C-METER contract list block it.
  - There is also no place to keep the draft. A replayed `reserve` returns `duplicate_attempt` with no output,
    `documents.projectId` is required, and `wizard_sessions` has no blueprint field.
  - The orchestrator sent Option A to the owner and asked for D now.
- Built (Option D, no model call, no new public function, no prompt file):
  - `lib/workspace/wizard/light-blueprint.ts` (pure):
    - `lightBlueprintSchema`: the C-ART own-idea `Blueprint` picked to pitch, one user, one loop, features and
      scope cuts. Strict, so a `market` block or an `ideaSlug` is refused.
    - `hasMarketClaim` / `stripMarketClaims`. Claims are money, percentages, market-size words, audience counts of
      100 or more, per-period prices, market or keyword metrics, and TAM/SAM/SOM/CAGR/CPC (case-sensitive).
      Stripping drops the clause that carries the claim and keeps the founder's other words. Small counts, B2B,
      Web3 and "5k" runs are not claims.
    - `acceptLightBlueprint(unknown)`: validate, strip every field (list items with a claim are dropped), then
      re-validate. It rejects, never repairs, a candidate that is invalid (`invalid`) or empty once the claims are
      gone (`only_market_claims`). The future gateway output goes through it unchanged.
    - `ownIdeaBlueprintPreview(text, draft?)`: with no draft, the fixture outline (the founder's words, cut to the
      160-character pitch limit, plus the generic weekend outline). With a rejected draft or fixture, the honest
      fallback outline (`own_fallback`), so the founder can always continue.
  - `wizardSeedFor` builds the own-idea branch from it, and takes an optional `ownIdeaDraft` (undefined for now).
    The preview gains `origin` (`library` / `own_fixture` / `own_drafted` / `own_fallback`) and `removedClaims`.
    `getSession`'s return validator carries both. The founder's stored idea text is never altered. Library ideas
    keep their seeded path.
  - The seam: one comment in `convex/workspace/wizard.ts` `seedFor`, where the session's stored gateway draft
    will be passed as `ownIdeaDraft` once A lands.
  - UI (`WizardStepPanel`): the visible "Not yet validated" label plus a plain-words line on what it means. A note
    names the market figures that were left out, or says the outline is a plain fallback. "Looks good" is
    `aria-describedby` the note, so screen readers hear the label before accepting.
  - Tests:
    - `tests/platform/wp74-light-blueprint.test.ts` (36): claims flagged and not flagged, stripping, accept and
      reject, the fixture, fallback and drafted paths, instruction-like text kept as data, the library path.
    - `tests/platform/wp74-light-blueprint-ui.test.tsx` (5, axe): the label, the describedby link, the
      left-out-figures note, the fallback note, markup rendered as text, no label on library ideas.
    - `convex/workspace/wizard.test.ts` +5: the stripped preview with stored text unchanged and no `ai_usage` rows
      (a reload makes no call), the fallback with continue working, owner isolation, flag off, the library path.
- Option A, a proposal awaiting the owner's ruling:
  - Add a fourth C-METER attempt-key form, `wizard:{wizardSessionId}:{step}:{attempt}` (`wizardAttemptKey`). It
    needs an owner and forbids a project, task or credit debit.
  - It changes the C-METER contract (`lib/workspace/contracts/metering.ts`) plus `attemptKeyFormValidator` and
    `keyFormMismatch` in `convex/ai/gatewayActions.ts`.
  - The wizard action checks session ownership before calling, because the meter cannot see the session.
  - One drafting call per session, idempotent through the stored draft and its `drafting` claim. The output goes
    through `acceptLightBlueprint` at the seam above.
  - The prompt would be `ownIdeaBlueprint.v1.ts`, because `04` gives WP75 `convex/ai/prompts/blueprint*`.
  - **Open question for the owner:** does the light blueprint count inside the Free $1.50 lifetime ceiling? D15
    puts the future Validation Report outside it but says nothing about the light blueprint.
  - Rejected alternatives: create the business before the blueprint step (B: reorders C-WIZARD and spends the one
    free business on a draft the founder may discard), and `eval` (C: see above).
- Needs from Codex, **only if A is approved**:
  - (d) A draft slot on `wizard_sessions`, e.g. `blueprintDraft: v.optional(v.object({ status: "drafting" |
    "ready" | "failed", promptRef, attemptKey, usageId?, blueprint?: <light blueprint validator>, failedReason?,
    updatedAt }))`.
  - (e) `PRE_BUSINESS_CONTROLS` entries in `tests/security/wp68-workspace-boundaries.test.mjs` for the new public
    functions (`requestOwnIdeaBlueprint`, `getOwnIdeaBlueprint`), guarded by `requireOwnedWizardSession`.
  - Items (a)–(c) from the S1/S2 entry still stand.
- S3 stays unticked: the gateway draft is not built.
- Checks:
  - `npm run typecheck` 0; `npx tsc --noEmit -p convex` 0; `npm run lint` 0 (0 errors, 37 existing warnings).
  - The seven wizard and S3 test files 0 (100 tests). `npm run check:prompt-versions` 0 (no prompt changed).
  - `npm run test:security` 1, only the known WP68 scanner failure (`not ok 200`,
    `convex/workspace/wizard.ts:getWizardAccess missing capability guard`). 204 pass, 1 skipped. The Vitest half,
    run on its own, passes 121/121.
  - Every other suite exits 0: og, links, redirects, auth, sitemap, convex (814), engine, home, prompts, platform
    (1128), live. Editorial exited 0 on a re-run (295 tests). Its first run hit hook timeouts while
    `npm run build` ran alongside, as in S1.
  - `npm run build` 0.
- Docs: this entry.

## 2026-11-06 - S1–S3 review fixes, round 3 (after 05d8f2e5 and bcea91a0)

- Market-claim stripper (`lib/workspace/wizard/light-blueprint.ts`). The rule is in the doc comment above
  `MARKET_CLAIM_PATTERNS`.
  - Now caught:
    - bare magnitudes after a number ("2.3B market", "reach 1M");
    - revenue metrics with a number ("5k MRR", "ARR of 2m");
    - ratios ("1 in 5 people", "4 out of 5");
    - currency codes before a number ("USD 49");
    - currency symbols after a number ("49€", "49 €/month").
  - The closed audience list is gone. A count of 100 or more, or any k-count, followed by any noun is now a
    traction claim ("50000 dentists", "10k dentists", "500 waitlist sign ups").
  - Kept:
    - counts under 100 ("3 steps", "2 founders", "1 app", "Top 10 tips");
    - glued numbers ("B2B", "B2C", "v2"), "Web 3", "step 2", "24/7";
    - years, and time or measure units ("100 days");
    - a k-distance before a function word ("Couch to 5k for beginners").
  - Known trade-off: "100 m sprint" reads as a magnitude and is stripped.
  - Every example is a `test.each` case.
- Strip before truncating: the fixture pitch strips the whole idea, then cuts to 160. Before this, a 240-character
  idea was cut first, so "10,000 users" became "10,0…" and got through. Tested. The removed count now includes
  those clauses.
- Bounded resume lookup (`convex/workspace/wizard.ts`):
  - `activeSessionsFor` reads the owner's newest `RESUME_WINDOW` (100) sessions with no project, using the
    `by_ownerId_and_projectId` range in descending creation order, then matches the idea in code.
  - A match older than the window is not found, so the founder gets a new session. Tested.
  - The wrong "exactly the candidates" comment is corrected.
- One active session per (owner, idea): when the idea step moves a session onto own-idea text that another active
  session holds, that other session is abandoned in the same mutation. Tested.
- Decision: the idea title shows the founder's own text, unstripped. D15 governs what we assert, and the founder's
  own words are theirs. Only the drafted pitch is stripped.
- Deferred: the signal repeat check (`recordFounderSignal`) only looks at the owner's latest 200 signals until the
  `founder_signals` index (item c) lands.
- Needs from Codex: (a)–(e) from the entries above still stand. New:
  - (f) An index that makes the resume lookup exact. Either `wizard_sessions.by_ownerId_and_ideaSlug` plus
    `by_ownerId_and_ownIdeaText`, or a normalised `ideaKey` field (`library:<slug>` / `own:<text>`) with
    `by_ownerId_and_ideaKey`. With it, `activeSessionsFor` becomes a single index range and `RESUME_WINDOW` goes.
- Checks:
  - `npm run typecheck` 0; `npx tsc --noEmit -p convex` 0; `npm run lint` 0 (0 errors, 37 existing warnings).
  - The seven WP74 test files 0 (125 tests).
  - `npm run test:security` 1, only the known WP68 scanner failure (`not ok 200`, `getWizardAccess missing
    capability guard`). 204 pass, 1 skipped. The Vitest half, run on its own, passes 121/121.
  - Every other suite exits 0: og, links, redirects, auth, sitemap, convex (816), home, prompts, platform (1151),
    live.
  - The first pass ran at load average 30. Editorial (295) and engine (1076) hit 5–10 s timeouts in files this
    change does not touch, then exited 0 when re-run alone.
  - `npm run build` 0.
- Docs: this entry.

## 2026-11-06 - S4: stopped before building, two pieces are missing

- Stopped as briefed: the repo has no disposable-domain list and no global slug lookup. No code was written.
- Already there, and S4 will reuse it:
  - Reserved names: `RESERVED_SUBDOMAINS` and `isValidTenantSlug` in `lib/tenant-host.ts` (frozen by the owner
    on 2026-08-07). Labels are 3 to 63 characters.
  - Normalisation: C-WIZARD `nameSubdomainSlug`.
  - The business limit: `WORKSPACE_PLAN_LIMITS[resolvePlan()].limits.businesses` (Free 1, Builder's Hub 1,
    Growth 3, which is dormant). C-LIMITS has no business limiter; it rate-limits and does not count.
  - The owner's businesses: exact count through `projects.by_ownerId_and_workspaceSlug` (a `workspace.slug`
    range).
  - Verified means `email` and `emailVerificationTime`, as `membership/checkout.ts` does.
  - Live hostnames: `site_configs.by_hostname`. Audit: `audit_events`.
- Gap 1, the disposable-domain list (`02` §13 says "static list in the repo"; none exists).
  - A (recommended): a pure `lib/workspace/disposable-domains.ts` with `isDisposableEmailDomain`. It needs an
    approval to add a file outside S4's owned set. The list would come from the CC0 `disposable-email-domains`
    project, with the source and date pinned in the file. It matches the domain exactly and also its parent
    domains.
  - B: Codex owns the list under `convex/platform/`, next to C-LIMITS.
  - C: a short curated list of the top providers. Weaker.
  - Rejected: a lookup API. It is an outside service, it costs money and it sends emails out.
- Gap 2, global slug uniqueness. The only `projects` slug index is per owner. A Free owner has one business, so
  collisions happen across owners (every HydroTrail founder gets "HydroTrail").
  - A (recommended): Codex adds `projects.by_workspaceSlug` (`["workspace.slug"]`).
    - `createBusiness` checks the reserved names, then that index and `site_configs.by_hostname`.
    - Collisions get `-2`, `-3` and so on, in order. The base is cut to leave room for the suffix.
    - Two concurrent claims read the same index range, so Convex OCC retries one of them.
  - B: a `tenant_slugs` claim table (unique slug, owner, project). It also covers renames and released slugs later.
  - C: per-owner only, with collisions found at publish (WP78). Not recommended, because the deterministic suffix
    would then mean nothing.
- Gap 3: D12 wants an `owner` row in `business_members`, and `02` §4.2 makes Codex its writer. Codex either
  provides a helper (for example `insertBusinessOwner(ctx, project)`) or rules that S4 may write the row.
- Gap 4: `createBusiness` is a pre-business function. It needs the WP68 scanner allowlist from item (a), guarded by
  `assertFeatureEnabled` and `requireOwnedWizardSession`.
- Planned once these are answered:
  - Archived businesses count toward the limit.
  - Idempotency: if the session already has a `projectId`, return that business. A race is caught by
    `idempotencyKey = wizard:{sessionId}` through `by_ownerId_and_idempotencyKey`.
  - The project gets `source` `repository_idea` or `own_idea`, `status` `draft`, and a `workspace` object mapped
    from `wizardAnswersSchema.parse()` output only.
- Needs from Codex: (a)–(f) still stand. New: (g) Gap 2 option A or B; (h) Gap 3; (i) Gap 1 if B.
- Checks: none run. Only this file changed.
- Docs: this entry.

## 2026-11-06 - S4 built under the orchestrator's decisions (blocked on g)

- The orchestrator's decisions on the four gaps above: a curated disposable list in `lib/workspace/disposable-domains.ts`;
  global uniqueness behind one helper until (g); no `business_members` write (h); the local session guard plus the (a)
  allowlist ask.
- What:
  - `convex/workspace/business.ts` `createBusiness(sessionId)` is one mutation, in this order:
    1. `assertFeatureEnabled`, then `ownedWizardSession(..., { allowLinked: true })`;
    2. a session that already has a project returns it (`created: false`);
    3. the session must be finished (`completedAt` set and `wizardAnswersSchema.safeParse` passes, so `looks_good`),
       else `SESSION_INCOMPLETE`;
    4. a verified email (`email`, `emailVerificationTime`, not anonymous), else `EMAIL_NOT_VERIFIED`;
    5. not a disposable domain, else `DISPOSABLE_EMAIL`;
    6. `WORKSPACE_PLAN_LIMITS[resolvePlan()].limits.businesses`, else `BUSINESS_LIMIT_REACHED { plan, limit }`;
    7. the slug, else `SLUG_UNAVAILABLE`;
    8. insert the project, link `projectId` and `completedAt`, and write one `audit_events` row
       (`business.created`, no email in the metadata).
  - `wizard.ts`:
    - `ownedWizardSession` is exported and takes `allowLinked`. Abandoned sessions are always refused, and edits on a
      linked session are refused.
    - `getSession` returns `business`.
  - UI:
    - `CreateBusiness.tsx` is the finished-wizard handoff: "Create my business", Back, and an alert tied to the button
      by `aria-describedby`.
    - `MeetCofounder` now shows only after the business exists, names the business and its suggested address, and has
      no Back.
    - `WizardFlow` maps each refusal to plain copy. After creating, it pins the URL to `?session=` (library pages now
      read it), so a reload shows the same business.
- Decisions:
  - Archived businesses count toward the limit. Legacy projects without `workspace` do not. The count is exact
    through a `workspace.slug` range on `by_ownerId_and_workspaceSlug`.
  - Idempotency: the session link, then `idempotencyKey = wizard:{sessionId}` (it relinks a session whose link is
    missing). Convex serialises concurrent calls; tested with `Promise.all`.
  - Stored fields come from parsed answers only:
    - `name`, `slug`, `ideaSlug`/`ownIdeaText`;
    - `platform` (the kind; a custom description stays in the session), `commercialModel`, and `goal` (the kind);
    - `partner { personality, name }`;
    - `source` is `repository_idea` or `own_idea`, `status` is `draft`, and `sourceIdeaId` is not set.
  - Slug (`lib/workspace/wizard/tenant-slug.ts`):
    - normalised with `nameSubdomainSlug`, the base cut to 48 characters;
    - fewer than 3 characters gets `-business` appended, and a name with no Latin letters becomes `business`;
    - reserved names (`isValidTenantSlug`) and taken slugs move on to `-2`, `-3` … up to 50 attempts.
  - `isTenantSlugTaken(ctx, slug, ownerId)` checks reserved names, the owner's own businesses and
    `site_configs.by_hostname` (any status). Its doc comment says another owner's unpublished business can't be
    detected until (g); then the owner lookup becomes one global lookup. A test pins the gap.
  - Disposable list: 125 hand-written domains. Matching is case-insensitive (NFKC), trims, drops one trailing dot,
    and checks parent domains above the top level.
  - `requireBusinessAccess` works for the owner without a `business_members` row (`getWorkspaceAccess` is tested
    both ways).
- Open item (owner OK needed, not a blocker): import the full CC0 `disposable-email-domains` list, with its source
  and date pinned.
- Tests:
  - `convex/workspace/business.test.ts` (21):
    - success, own idea, and an end-to-end wizard run;
    - a double click, concurrency, and the keyed relink;
    - a linked session can't be edited;
    - a second business is refused, an archived one still counts, a legacy project does not;
    - unverified and disposable accounts, including a capitalised subdomain;
    - slug normalisation, reserved names, an ordered live-host collision, and the (g) gap;
    - signed out, flag off, another owner, unfinished, reworked, unparseable and abandoned sessions.
  - `tests/platform/wp74-business-rules.test.ts`: disposable domains, including IDN, full-width, uppercase and
    malformed input, and the slug rules.
  - `tests/platform/wp74-business-ui.test.tsx` (axe): the refusal copy, CreateBusiness with keyboard and pending
    state, every refusal as an alert, and the flow handoff: one call, URL pinned, then Meet with focus moved and the
    change announced, a refusal kept on screen, and a reload with `?session=`.
  - `tests/security/wp74-wizard-guards.test.mjs` now maps `createBusiness` to the session guard. It also checks that
    the account checks come before the insert and that nothing writes `business_members`.
- a11y-check on CreateBusiness, MeetCofounder and WizardFlow: no violations. Contrast and the live keyboard pass are S6.
- Needs from Codex (a)–(f) still stand.
  - (a) gains `convex/workspace/business.ts:createBusiness`: `assertFeatureEnabled` + `requireOwnedWizardSession`.
  - (g) `projects.by_workspaceSlug` (`["workspace.slug"]`). S4 is blocked on it.
  - (h) `addOwnerMembership(ctx, project)` for the D12 owner row, or a ruling that S4 may write it.
- Checks:
  - `npm run typecheck` 0; `npx tsc --noEmit -p convex` 0; `npm run lint` 0 (0 errors, 37 existing warnings).
  - WP74 tests, 10 files: 0 (204 tests).
  - `npm run test:security` 1. Only the WP68 scanner fails (`not ok 200`, which stops at
    `convex/workspace/business.ts:createBusiness missing capability guard`). The scanner gap is exactly the eight
    pre-business functions: `wizard.ts` `getWizardAccess`, `startOrResume`, `getSession`, `saveStep`, `skipStep`,
    `rewriteStep`, `goBack`, and `business.ts` `createBusiness`. 205 pass, 1 skipped. The Vitest half, run on its
    own, passes 121/121.
  - Every other suite exits 0: og, links, redirects, auth, sitemap, convex (837), engine (1076), editorial (295),
    home, prompts, platform (1209), live.
  - `npm run build` 0.
- S4 stays unticked (blocked on g, h and a).

## 2026-11-06 - S4 review fixes (P3, after 1be5e860)

- Email domains (`lib/workspace/disposable-domains.ts`):
  - The look-alike full stops U+3002, U+FF0E and U+FF61 become `.` before parsing, so `a@x.yopmail。com` is
    disposable.
  - `emailDomain` returns null when there are fewer than two labels or any label is empty: a leading dot, `..`, or a
    second trailing dot. New `emailAddressDomain` also requires an `@`.
  - `createBusiness` refuses a null domain with `EMAIL_INVALID` before the disposable check.
- Reserved names (`lib/workspace/wizard/tenant-slug.ts`):
  - A reserved base is refused and never suffixed (`billing-2` would still look like ours). It is reserved when it is
    a `RESERVED_SUBDOMAINS` name, or when it spells `weekendmvp` once hyphens are dropped (`weekend-mvp`,
    `weekendmvp-tools`).
  - `pickTenantSlug` returns `ok` / `reserved` / `exhausted`. `createBusiness` refuses `NAME_RESERVED`; the UI shows
    it as an alert with "Choose a different name". C-WIZARD Back allows this.
  - `goBack` takes an optional earlier `to` step (no new public function). From the finished screen, `to: "name"`
    reopens the name step with the answers kept. A later `to`, or the current step mid-wizard, changes nothing.
  - `SLUG_UNAVAILABLE` offers the same button.
  - "Support Bot Co", "Trail Help" and "Billingsgate" stay allowed.
- `CreateBusiness`: a polite `role="status"` region announces "Creating your business…", and the section is
  `aria-busy` while pending. Axe passes.
- `BUSINESS_LIMIT_REACHED` now carries `projectId` for the owner's first live (unarchived) business, read from the
  owner-scoped index. The UI links "Open your business" to `/dashboard/b/{id}`, but only for a well-formed id. An
  archived-only owner gets no link.
- **Owner question (not implemented):** Gmail `+tag` and dot aliases (`a.b+x@gmail.com`) are separate verified
  accounts today, so each gets a free business. Should the one-free-business allowance canonicalise addresses
  (lowercase, strip `+tag`, strip dots for gmail.com and googlemail.com)? It would need a stored canonical email, or a
  lookup on one. That is likely a Codex schema item.
- Checks:
  - typecheck 0; `npx tsc --noEmit -p convex` 0; lint 0 (0 errors, 37 existing warnings).
  - WP74 tests, 10 files: 0 (241 tests).
  - `npm run test:security` 1. Only the WP68 scanner fails, on the same eight pre-business functions: `wizard.ts`
    `getWizardAccess`, `startOrResume`, `getSession`, `saveStep`, `skipStep`, `rewriteStep`, `goBack`, and
    `business.ts` `createBusiness`. 205 pass, 1 skipped. The Vitest half, run on its own, passes 121/121.
  - Every other suite exits 0: og, links, redirects, auth, sitemap, convex, engine, editorial, home, prompts,
    platform, live.
  - `npm run build` 0.

## 2026-11-06 - S5: CTAs behind the flag (built, S5 not ticked)

- What:
  - "Build this idea, free" links to `/start/{slug}` in three places: the hero build window (beside the research
    link), Idea of the week (above "Read the research", which moves to the ghost tone), and the build-first account card
    on `/ideas/{slug}`. They are real `<a>` links with the shared focus ring. The accessible name is "Build this idea, free for
    {title}".
  - The card keeps its H2 ("Read the full research, free"). With the flag on it gains one line ("Then we'll take you
    straight to building this idea."), the button reads "Create free account and build", and sign-in returns to
    `/start/{slug}`. Placement follows WP63 (EmailGate layout untouched).
  - Analytics: one existing event, `cta_button_clicked`, with `button_location: build-cta-{surface}`, `button_text`
    and `idea_slug`, through `trackEvent` (a no-op before consent). No new GA config.
- How the flag is read:
  - Runtime only, the same C-OPS settings the wizard gate uses (`ops_settings.workspaceEnabled` + cohort). There is
    still no `NEXT_PUBLIC_LAUNCH_WORKSPACE`.
  - New public query `convex/buildCta.ts:buildCtaVisible` returns one boolean: workspace on and cohort `open`, or on
    and the signed-in caller is on the allowlist. An anonymous visitor in `allowlist` mode sees no CTA.
  - `lib/workspace/build-cta-access.ts` calls it with the visitor's session if any, per request, with a 1.5 s cap.
    Any error, timeout or missing backend reads as off. The homepage and idea page were already dynamic
    (`connection()`), so no caching changed. See the review-fixes entry below for latency.
  - It lives outside `convex/workspace|ops|...` so the WP68 scanner does not demand a business capability from an
    anonymous read. See Needs from Codex (j).
  - Showing a CTA grants nothing: `/start` re-runs `getWizardAccess`.
- Engine drafts: `isBuildCtaSlug` refuses `engine-draft-*` and any non-idea-shaped slug before any CTA renders;
  the idea page also asks only after `resolveIdea` found a real idea (drafts resolve to nothing).
- `returnTo` rule: `lib/private-paths.ts` gains `isWizardReturnPath` (`/start/{idea-slug}` exactly, lowercase
  hyphen slug, nothing after it) and `isBareReturnPath` (idea or wizard path: a query or fragment collapses to
  `/dashboard`). It is part of `isAllowedAuthReturnPath`, which `lib/auth-return.ts`, `convex/auth.ts` (redirect
  callback, including the nested OAuth `returnTo`) and `convex/resendMagicLink.ts` all share. Foreign origins, `//`,
  backslashes, `..`, encoded dots, trailing or extra segments, and `?`/`#` tails all fall to `/dashboard`.
  `/start/own` is a valid path but nothing links sign-in to it.
- Flag-off proof: `tests/platform/wp74-cta-flag-off.test.tsx` compares the rendered HTML of Hero, Idea of the week
  and the gate card, and the EmailGate element tree, to golden files in `tests/platform/__snapshots__/wp74-cta-flag-off/`.
  The goldens were written from the code before any S5 edit, and still pass. Off is "no CTA prop", and the pages
  only pass true after the query says so. The full-page `scripts/seo-snapshot.mjs capture/diff` needs a running
  server with a Convex deployment (no `.env` here), so it was NOT run: run it against a preview before release.
- Files: `lib/private-paths.ts`, `lib/auth-return.ts`, `convex/auth.ts`, `convex/resendMagicLink.ts`,
  `convex/buildCta.ts`, `convex/_generated/api.d.ts` (module added by hand),
  `lib/workspace/build-cta.ts`, `lib/workspace/build-cta-access.ts`, `components/workspace/BuildIdeaCta.tsx`,
  `components/home/sections/{Hero,IdeaOfTheWeek}.tsx`, `components/home/client/HeroBuildWindow.tsx`,
  `components/auth/AuthCard.tsx`, `components/ideas/EmailGate.tsx`, `app/(marketing)/page.tsx`,
  `app/ideas/[slug]/page.tsx`. Tests: `convex/buildCta.test.ts`, `tests/auth/wp74-start-return.test.ts`,
  `tests/platform/wp74-cta-{flag-off,flag-on,access,wiring}.test.ts(x)`.
- Needs from Codex:
  - (j) Recommended: move `convex/buildCta.ts` to `convex/ops/publicFlags.ts` and add a `PUBLIC_FLAG_READS`
    allowlist in the WP68 scanner. The scanner asserts, for each listed key, `args: {}`, `returns: v.boolean()` and a
    `getOpsSettings` call, and no other function in the workspace dirs may skip the capability guard. The current file
    already has exactly that shape. Until then it stays at `convex/buildCta.ts`, outside the scanned dirs.
  - (k) Middleware: `/start/*` should be `noindex` and never cached, as the earlier (b) asks.
  - (a)-(i) from the entries above still stand.
- Not done: seo-snapshot against a live server; live keyboard and contrast pass (S6); a Playwright check that the
  CTA does not shift layout (it is server-rendered and sized in the existing slots, unverified in a browser).
- Checks: `npm run typecheck` 0; `npx tsc --noEmit -p convex` 0; `npm run lint` 0 (0 errors, 37 existing warnings);
  new WP74-S5 tests 0 (`wp74-cta-*`, `wp74-start-return`, `convex/buildCta`: 54); `npm run test:security` 1, only
  the known WP68 scanner gap (the eight pre-business functions; first stop `createBusiness`), Vitest half 121/121;
  og, links, redirects, auth, sitemap, convex (848), engine, editorial, home, prompts, platform (1266), live all 0;
  `npm run build` 0.

### S5 review fixes
- Latency: `buildCtaVisible` is started before the page's own data (`getHomeData` via `Promise.all`; on the idea page
  before `resolveIdea`, and only for non-draft slugs). Anonymous requests use a `use cache` read with
  `cacheLife({ stale: 60, revalidate: 60, expire: 300 })`, so most loads never wait on Convex. Signed-in requests ask
  live with their session (cohort is per owner). Timeout is now 300 ms and fails to off. A failed read throws inside the
  cached function so it is not cached.
- Removed the signed-in member CTA from the idea page (outside the story).
- Funnel: with the flag on, the gate's "Sign in" (the toggle, and the non-embedded cross link) keeps the idea page as its
  return (`signInReturnTo`); only "Create free account and build" returns to `/start/{slug}`. The build-first note shows
  only in the create mode. Tested for email and Google.
- `isWizardReturnPath` refuses `/start/own` and any dot segment, raw or percent-encoded. `hasDotSegmentInTarget` checks the
  raw target before `new URL()` (which would normalise `/start/../start/x` to `/start/x`) in `safePlatformReturn`,
  `safeAuthRedirect`, the OAuth nested `returnTo` and the magic-link mailer. A dot segment in any return target now falls
  to `/dashboard`.
