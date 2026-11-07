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

## 2026-11-06 - WP76-S1a built (uncommitted, for review)

What was built:
- Prompt `crew-email-sequence@1` (`convex/ai/prompts/emailSequence.v1.ts`): `draft` tier, effort low, thinking
  between tools, C-ART `emailSequenceSchema` as the output schema. Founder text, the blueprint and the kit's voice
  arrive only as `crewShared` data blocks (`<blueprint>`, `<brand>`, `<founder_answers>`, plus the runner's revision
  blocks). Registered in `index.ts`, locked (`versions.lock.json`).
- Inputs (`lib/workspace/crew/inputs.ts`, `emailSequenceStepPlan`): the blueprint, the brand kit's `name`, `tagline.text`
  and `voice` (never palette or art), and the founder's answers (`answersForPrompt`).
- Launch registry (`convex/crew/steps.ts`): `email_sequence` is `built`, `runner: "generator"`, parent `brand_kit`,
  inputs blueprint, brand kit, wizard answers.
- Generator (`convex/crew/generators.ts`): `prepareCrewStep` builds the email step. Blueprint brief: approved, else (the
  launch's own email first draft) the launch's first-draft blueprint (S2b ruling). Brand kit: approved, else (same
  condition) the launch's own first-draft kit under the same rule (card pending inside its TTL or approved, document
  unchanged since the card). Both ids travel to `finishCrewStep` (`briefDocumentId`, new `brandKitDocumentId`), which
  re-checks both.
- Finish (`convex/crew/jobs.ts` `finishCrewStep`): for `email_sequence`, the draft plan is checked before any write, and
  the `sequences` / `sequence_steps` rows are written after the document, task, run, card and crew status, in the
  same transaction. Writer and plan: `convex/growth/drafts/emailSequence.ts`. An email finish without both
  `briefDocumentId` and `brandKitDocumentId` fails the step as permanent (review m1).
- Preflight (review m4): `prepareCrewStep` runs the same draft-conflict check (`emailDraftTarget`) before any model
  call, so a business whose drafts conflict refuses with no token and no gateway call. The finish's check stays the
  authority (drafts can appear between preflight and finish).
- Quality gate (review M1): `email_sequence` is in `QUALITY_GATED_KINDS`. Besides the shared `checkArtifact` checks,
  `lib/workspace/crew/checks/emailLinks.ts` adds a HARD `email_link_in_text` issue for link-like text in the
  sequence `name`, `senderName` and every email's subject, preview, body, goal and CTA label. A hard issue stores
  nothing. Detector (`findLinkLike`): refuses a scheme (`https://`, `ftp://`, `mailto:`, `tel:`, `sms:`), `www.`, an
  email address, and a bare domain with any top-level domain (dotted labels, then a final label of 2–63 letters in
  one case: `hydrotrail.shop`, `HYDROTRAIL.SHOP`, `maps.example.co.uk`). Allows "e.g.", "i.e.", "a.m.", decimals
  and versions ("2.5", "v1.2"), a run-on sentence ("trail.Then": mixed-case last label), and `.js` names
  ("Node.js"). Known trade-off: a file name ("plan.pdf") is refused; an email has no reason to name one.
- Owner-only read `api.growth.drafts.emailSequence.emailSequenceDraft({ projectId })`: workspace and AI gates,
  `requireBusinessAccess`. Returns `none`, `unavailable` (rows and document disagree, or more than one draft), or
  `ready` with the sequence status, name, sender name, the four emails in order (each read through the helper) and the
  document's newest `artifact_review` card (`approvalId`, status, round, `expiresAt`). The only id returned is the
  card's, which S1b's card actions need.
- Retry (`convex/crew/launch.ts` `failedLaunchSteps`): a failed email sequence is retryable only when a blueprint brief
  and a brand kit exist for it now under the same rules; otherwise it says why (`EMAIL_BRIEF_CHANGED_REASON`,
  `BRAND_KIT_CHANGED_REASON`). A business whose drafts conflict reads `retryable: false` with its own reason,
  `EMAIL_DRAFT_CONFLICT_REASON`, checked first (a retry could not help).
- Shared helpers generalised, behaviour unchanged for the blueprint and kit: `approvedBlueprint(…, kind)`,
  `isLaunchDraftBrief(…, kind)`, `launchDraftBlueprint(…, kind)`, `isLaunchFirstDraftTask` (any crew step),
  `newestFirstDraft` / `isFirstDraftOf` in `launchRoster.ts`; wrappers `approvedBrandKit`, `launchDraftBrandKit`.

Draft contract for WP79:
- `sequences`: a business has at most one `draft` sequence. `title` is the C-ART sequence `name`. The finish inserts it
  when there is none, else rewrites the one draft in place (title, `updatedAt`). Rows with `approved`, `active` or
  `paused` are never read for writing or touched.
- `sequence_steps`: four rows, `order` 0–3 (int64) in `EMAIL_KINDS` order, `delayHours` and `subject` copied from the
  email, `documentId` the one `email_sequence` document, no `approvalId`. On a rewrite the existing rows are patched
  (ids stay stable) and missing orders inserted.
- `approvalId` rule (review m2): a draft step that carries an `approvalId` is never rewritten. If any step of the
  draft has one, the plan is a `conflict`: no document, no rows, the run closes `permanent`. WP79 must clear a step
  approval (or move the sequence out of `draft`) before a crew rewrite can run.
- `delayHours` (follow-up for WP79): C-ART's section header says the delays count "from the confirmation", but the
  field itself says hours after the previous email. S1a copies the field as written and treats it as hours after
  the previous email (welcome 0). WP79 must schedule the same way, or C-ART must be clarified first.
- Content: `emailStepContent(step, document)` in `lib/workspace/growth/emailDraft.ts` returns
  `emailsInOrder(parse(document.body))[order]` and fails closed (`document_mismatch`, `document_archived`,
  `document_unreadable`, `order_out_of_range`, `subject_mismatch`, `delay_mismatch`). Callers check owner and
  business first; the helper does not. `emailStepFromSequence(step, parsed)` is the same check against a body
  parsed once (the query reads four steps with one parse). Also `draftStepRows`, `parseEmailSequenceBody`,
  `stepsRewritable`.
- Read rule (review m3): the query requires exactly four steps with orders 0, 1, 2, 3 (once each), all in the
  business and all pointing at one non-archived `email_sequence` document of the business; anything else is
  `unavailable`. It prefers the one draft over any newer non-draft sequence.
- Revision rule: the change-round task's own `finishCrewStep` applies the same draft rule, so it repoints the draft's
  steps at the new document in that transaction; when the only sequence is no longer `draft`, a new draft is inserted.
- Fail closed: more than one `draft`, more than `SEQUENCES_READ_MAX` (50) sequences, or a draft whose steps are not
  orders 0–3 at most once: no document, no rows, the run closes `permanent` and the task fails (the usual note).
- `updatedAt`: the sequence, every step and the document all carry the finish's clock, which equals the card's
  `createdAt`, so `updated_at_with_children` sees the subject as unchanged at the card (tested).
- Nothing sends; no `send` approval is created.

Decisions (gaps the story left):
- Which `draft` sequence is "crew": `sequences` has no origin field and nothing else writes a draft, so every `draft`
  row counts. If WP79 or a later story writes drafts of its own, this needs an origin marker (a C-DATA change).
- Email revisions brief only from an approved blueprint and an approved brand kit, the same as a brand kit revision
  (the S2b launch rule is for first drafts). Nothing runs revision tasks on the pool yet (S6b / WP77); the tests run
  one directly through the generator.
- The email step's brand kit follows the same launch rule as the blueprint brief: the launch's own first-draft kit
  while its card is pending or approved and the document is unchanged; a kit whose card got `changes_requested`
  stops the email step until a kit is approved.
- Correction (review M1): the first build said the C-ART schema already refuses URLs. It does not for every field:
  C-ART refuses a URL only in `body`, against a closed list of top-level domains, and the subject is copied into
  `sequence_steps.subject` for WP79 to send. The email kind is now in the S3a gate with the link check above; the
  C-ART file is unchanged.
- m5: the email first draft briefs from the launch's pending first-draft kit (as the kit does from the launch's
  pending blueprint). Ruled "Draft in a launch" (`docs/wp/RULINGS.md`, 2026-11-06, WP76-S1a email brand-kit brief);
  the build already matches it (revisions and work outside a launch use approved documents only).
- The query reads `none` before the step runs and `unavailable` (never other text) when the rows and the document
  disagree.

Tests: `convex/growth/drafts/emailSequence.test.ts` (28, convex-test, fixture mode, the launch DAG on the pool):
HydroTrail draft, four ordered steps, one card, no send, version policy; prompt data blocks; runs only after the kit;
refusal, invalid output, a kit changed mid-step and a blueprint changed mid-step write nothing; a link in a subject
or a CTA label stores nothing; a finish without either brief id fails permanent; two drafts appearing mid-step fail
at the finish; two drafts already there fail at preflight (no gateway call, no token spent, `retryable: false` with
`EMAIL_DRAFT_CONFLICT_REASON`, retry spends nothing); a fifth step, a duplicate order and another business's step
fail closed at the finish; more than `SEQUENCES_READ_MAX` sequences fail closed; `EMAIL_BRIEF_CHANGED_REASON` and
`BRAND_KIT_CHANGED_REASON` from `launchProgress`; replay; revision repoints in place; a revision refuses when the
kit is not approved, and when a draft step has an `approvalId`; non-draft untouched; query views, a duplicate order
reads unavailable, the draft wins over a newer approved sequence, another business of the same owner reads none (and
a cross-wired sequence reads unavailable), refusals (other owner, workspace off, AI off). Mutation-checked: removing
the gate entry, the preflight check, the `approvalId` rule or the query's order check each turns its test red.
Pure: `tests/platform/workspace-growth-email-draft.test.ts` (33: the helpers, `emailStepFromSequence`, the link
detector on both sides, the gate on the fixture and on a link in each field kind). Updated: `convex/crew/launch.test.ts` (the email step now
runs after the kit in five run-throughs), `convex/crew/steps.test.ts` (pool steps).

Checks (worktree): `git diff --check` 0, `npm run typecheck` 0, `npx tsc -p convex --noEmit` 0, `npm run lint` 0
(warnings only, none in changed files), `npm run check:prompt-versions` 0, `npm run test:security` 0,
`npm run test:convex` 0 (1275 tests), `npm run test:platform` 0 (2200 tests). `npm run build` not run (orchestrator).
Re-run after the review fixes, same results (lint: 43 warnings, none in changed files).

Docs: this file, `docs/wp/wp76-stories.md`, and `docs/wp/RULINGS.md` (the owner's "Draft in a launch" ruling for the email's brief, which closes review minor 5).

Open follow-ups:
- WP79: schedule `delayHours` as hours after the previous email (see the draft contract), and honour the `approvalId`
  rule.
- Launches created before this change get no email task: `ensureLaunchStepTasks` runs only in the blueprint's
  finish. No launches exist while the platform is dormant, so no backfill is needed.
- `convex/crew/jobs.ts` reads a document's cards without `.order("desc")` before `take` (pre-existing, left alone);
  the new code reads newest first. Align it in a later small fix.
- S1b: the Email page reads `emailSequenceDraft`.
- S6b / WP77: re-run policy when the blueprint or kit changes after the email was written (the email stays built on
  the earlier kit, like the kit on the earlier blueprint).

### S1a re-check (narrow Opus re-check: ready to commit; 0 blockers, 0 majors)

Every finding from the review was confirmed fixed and pinned by a test; no regressions in the blueprint, brand kit,
quality gate or launch DAG paths. One new Minor, logged as follow-ups to fix before WP79 activates sends (every email
is still reviewed by the founder first):
- The link detector misses title-case TLDs (`HydroTrail.Com`, `Hydrotrail.App`), a non-ASCII letter before the dot
  (`café.com`), fullwidth or ideographic dots (`hydrotrail．com`), and defanged forms (`hydrotrail dot com`,
  `hydrotrail[.]com`). Fix: refuse a mixed-case final label that lowercases to a common TLD; use a `\p{L}\p{N}` label
  class; treat `[.．。]`, ` dot `, `[.]` and `(dot)` as dots.
- A business whose name is a domain (`Cal.com`) can never get an email sequence, and Try again still says it would
  help. Fix: refuse domain-like names earlier (wizard or brand kit), or give that failure its own non-retryable reason.
- Accepted trade-off: run-together lowercase prose (`water.and`) and file names (`plan.pdf`) are refused.
- Optional: `approvedBlueprint` and its siblings now take a `kind` but keep blueprint names.

## Needs from Codex

- S1a: none (it used the existing `sequences` / `sequence_steps` tables as they are).
- S2c (C-DATA): `social_posts` needs a `day` field (`fri`…`thu`, or an integer `order` 0–6) so each row maps to one
  post of the pack, and a revision can rewrite the rows in place. Optional `platform` if a row is meant per
  platform; today a post is one row for every platform (copy-and-post, D7).
- S2c (C-CONNECT): `SocialPlatform` in `convex/growth/connectors/types.ts` has 5 values (`instagram`, `facebook`,
  `x`, `linkedin`, `other`); C-ART's `SOCIAL_PLATFORMS` has 8 (adds `tiktok`, `youtube`, `threads`, `pinterest`, no
  `other`). One list should win before S2c calls `CopyConnector`.

## WP76-S1b built (Email page)

### What was built
- `app/(launch-workspace)/dashboard/b/[projectId]/email/page.tsx`: the placeholder is replaced by a server page
  (`requireWorkspaceAccess`, Files-page header, one h1) rendering the client panel.
- `components/workspace/email/EmailSequencePanel.tsx`: reads `emailSequenceDraft`; states loading, `none`,
  `unavailable` (calm copy, no retry), `ready`. Sequence name (h2), sender and status in words, the review card, then
  an ordered list of the four emails (h3 each, facts in a description list). Text is always text nodes; the body is
  split into paragraphs on blank lines; `{first name}` is shown as written.
- `lib/workspace/emailPage.ts`: pure wording (delay, kind, CTA target, statuses, note rule, outcome and error copy).
- `tests/platform/workspace-email-page.test.tsx`: 22 tests (helpers, each state, order and wording, HTML not parsed,
  approve and ask-for-changes arguments, empty note refused, Escape/Cancel focus, in-flight `aria-disabled`, non-pending
  and expired cards show no buttons, axe).

### Decisions that fill gaps
- The decision outcome copy is the chat card's `approvalDecisionCopy` / `approvalDecisionErrorCopy`, plus page-specific
  lines: `changesOutcomeCopy` turns the server's change-round answer (free, spend required, not available / busy) into
  words (chat shows nothing for those, because the card stays `pending`); changed-subject errors say "These emails
  changed since this was raised. Reload the page", not "Ask Wren again".
- No existing "ask for changes" note UI existed in `components/workspace/**`; a new inline form was built with the
  limit shown as `APPROVAL_NOTE_MAX_LENGTH` (2,000, trimmed, via `normalizeApprovalNote`) and a character count.
- Because approval does not change the sequence status (WP79 activates), an approved card shows "Approved. Nothing is
  sent yet." so "Draft" is not confusing.
- Expiry is judged once at mount (`Date.now()` vs `expiresAt`); a stale approve is not refused by the server: it marks the card expired (`decideApproval`), and the page announces that.
- The chat card's focus helpers, `errorCode` and `STATUS_LABEL` are now exported from `WrenChatCards.tsx` (additive) and
  `CHANGED_CODES` from `lib/workspace/wrenCards.ts`; the panel reuses them. (Superseded below: `STATUS_LABEL` and `errorCode`
  now live in `lib/workspace/wrenCards.ts`.) Credit UI for paid rounds: none, as the story says.
- Change round number and approval ids are never shown.

### a11y-check
- [x] Icon-only buttons have `aria-label`: none exist
- [x] Decorative icons have `aria-hidden`: no icons used
- [x] CSS/mask logos: none
- [x] Form inputs have labels: note textarea has a visible label, hint and error tied by `aria-describedby`
- [x] Images: none
- [x] External links: none
- [x] Focus rings visible: kit `FOCUS` on buttons, field and status line
- [x] No color-only indicators: statuses are words
- [x] Heading hierarchy: h1 route, h2 sequence, h3 review and each email
- [x] Keyboard: Escape/Cancel close the form and return focus; focus to status after a decision; polite live region

### Follow-ups
- Not run in a browser; axe (jsdom) is clean. Contrast of `home-clay-ink` on the page paper is inherited from the kit.
- `docs/wp/wp76-stories.md:86` has trailing whitespace (pre-existing uncommitted edit) so `git diff --check` exits 2.

### WP76-S1b review fixes

Opus review: 0 blockers, 3 majors, 7 minors, all addressed.
- M1: a result with no change-round answer falls back to `approvalDecisionCopy(status)` (an expired result is announced);
  the form and note stay open on a `not_available` answer and close on `free`, `spend_required` or any other result.
- M2: the panel uses the chat's focus helpers with `onFocus` / `onBlur` tracking, so a live update that removes the buttons
  returns focus to the status line unless the founder moved it.
- M3: a `changes_requested` card offers "Ask for changes" again (no Approve; the server re-asks via `reaskChangeRound`).
  `spend_required` copy: "Another round of changes costs credits. Paying for it isn't available yet, so your team keeps
  the current emails." An already-running re-ask (no change) says the team is already working on it.
- Minors and nits: in-flight guard on Ask for changes; closed-review line for expired and cancelled cards; subject-changed
  copy says to look at the newest version; `RateLimited` has its own line; label maps typed over the contract unions with no
  fallback; `{first name}` is a styled token with an sr-only "(merge tag)"; "Sequence status" and "Review status" labels;
  counter in `aria-describedby`; "Email N of {emails.length}".

Needs / follow-ups:
- No surface lists `spend` cards yet (`listPendingApprovals` has no consumer), so a paid change round cannot be approved from
  the UI; the Email page says it is not available yet.
- There is no "raise it again" path for an expired or cancelled review card; the page says the team raises a new one when
  the emails change.

### WP76-S1b second re-check fixes

- Paid round dead end (M3): the Review card reads `previewChangeRound` for a `pending` or `changes_requested` card and
  decides from it before offering anything. `free`: "Ask for changes" as before, plus "N free rounds of changes left."
  `spend_required`: no Ask button and no `request_changes` is ever sent; a pending card keeps Approve and says "Another
  round of changes costs N credits. Paying for changes isn't open yet, so you can approve these emails as they are." (a
  `changes_requested` card says "The next round ... so your emails stay as they are"). `not_available`: no Ask button and
  the plain reason. Loading or a failed preview (a `QuietErrorBoundary` around the preview) shows no Ask button; Approve
  stays on a pending card. "Your team is working on your changes." shows only after a free round started, after a re-ask
  that changed nothing, or while the preview says `busy`.
- A re-ask that changes nothing keeps the form and the note and says the note was not sent.
- Closed copy (expired and cancelled): "This review closed without a decision. Your emails stay as they are."
- Focus: the focus-return effect also keys on `card.status`, so a live move from `pending` to `changes_requested` returns
  focus from Approve to the status line.
- `STATUS_LABEL` and `errorCode` moved into `lib/workspace/wrenCards.ts` (pure); `WrenChatCards.tsx` and the panel import
  them. Chat behaviour is unchanged (platform tests pass).
- Follow-ups unchanged: no surface lists or pays `spend` cards (`listPendingApprovals` has no consumer); no path raises a
  fresh review after an expired or cancelled one.

### WP76-S1b third re-check fixes

- "Your team is working on your changes." now comes only from the preview reporting the artifact busy (`previewIsBusy`);
  the sticky `revisionRunning` state and `startedRevision` are gone. A no-change re-ask still keeps the form and says the
  note wasn't sent.
- The focus-return effect also keys on `canAsk`, so focus moves to the status line when the preview turns busy while focus
  is on Ask for changes.
- The `stale` / `conflict` reasons use the plain "Changes can't be asked for on this right now."

## 2026-11-07 - S2 planned; S2a started (branch `claude/wp76-s2a-social-generator`, worktree `.worktrees/wp76-social-pack`)

- S2 is split into S2a (generator), S2b (Social page) and S2c (`social_posts` rows, blocked on Codex). Owner ruling
  "Ship now, rows later" (`docs/wp/RULINGS.md`, 2026-11-07).

## 2026-11-07 - WP76-S2a built (uncommitted, for review)

What was built:
- Prompt `crew-social-pack@1` (`convex/ai/prompts/socialPack.v1.ts`): `fast` tier, effort `low`, thinking `disabled`,
  `maxTokens` 4,096 (the tier ceiling), C-ART `socialPackSchema` as the output schema. The system prompt explains the
  seven days (`fri` launch day to `thu`), the kinds and formats, the stand-alone short caption (280 characters, X), alt
  text only on image and carousel posts, poll options only on polls, hashtags without `#`, no URLs, web addresses,
  email addresses or @handles ("link in bio" is allowed), no invented facts, prices, dates, figures, testimonials or
  user counts, and the brand voice (traits, say, dontSay, the exact business name). Inputs arrive only as `crewShared`
  data blocks (`<blueprint>`, `<brand>`, plus the runner's revision blocks). Registered in `index.ts`, locked.
- Inputs (`lib/workspace/crew/inputs.ts`): `SOCIAL_PACK_PROMPT_REF`, `socialPackStepPlan({ blueprint, brandKit })`: the
  blueprint and the kit's `name`, `tagline.text` and `voice` (the same slice as the email, now one `brandSlice` helper).
  No wizard answers, matching the registry inputs.
- Launch registry (`convex/crew/steps.ts`): `social_pack` is `built`, `runner: "generator"`, parent `brand_kit`, inputs
  blueprint and brand kit.
- Generator (`convex/crew/generators.ts`): `prepareCrewStep` accepts `crew_social_pack` and briefs exactly as the email
  does (blueprint and kit approved, else the launch's own first drafts for the launch's own first draft; a revision
  briefs only from approved documents). Returns `briefDocumentId` and `brandKitDocumentId`.
- Finish (`convex/crew/jobs.ts`): a social pack finish needs both ids and re-checks both (`briefStillValid`), as the
  email does; without either it fails as permanent. The document, task, run, card and crew status are written by the
  shared path. No draft rows: S2a writes no `social_posts` rows (ruling "Ship now, rows later").
- Retry reasons (`convex/crew/launch.ts`): a failed social pack is retryable only when both briefs exist now; otherwise
  `SOCIAL_BRIEF_CHANGED_REASON` or `SOCIAL_BRAND_KIT_CHANGED_REASON`. The per-step reasons are now two small maps; the
  email and brand kit reasons are unchanged.
- Quality gate: `social_pack` is in `QUALITY_GATED_KINDS`. `lib/workspace/crew/checks/socialLinks.ts` adds a HARD
  `social_link_in_text` issue for a link (`findLinkLike`, unchanged) or an @handle in every post's hook, caption,
  shortCaption, imageText, imageAlt, poll options and hashtags. A handle is `@` plus a letter, number or `_`, not
  preceded by one (so "name@host.tld" stays an email address, and "meet @ 6" is not a handle). The email check is
  untouched.
- Owner-only read `api.growth.drafts.socialPack.socialPackDraft({ projectId })`: workspace and AI gates,
  `requireBusinessAccess(…, "owner")`. Returns `none`, `unavailable` (the newest document does not parse), or `ready`
  with the seven posts in day order (`socialPostsInOrder`) and the newest `artifact_review` card (`approvalId`,
  status, round, `expiresAt`), the same card shape as `emailSequenceDraft`. The only id returned is the card's.

Decisions that fill gaps:
- Effort is written as the literal `"low"`: the prompt lock lets a prompt module import only `definePromptSpec` and
  types from C-PROMPT, so `TIER_RECOMMENDED_EFFORT` cannot be imported there. A platform test pins
  `effort === TIER_RECOMMENDED_EFFORT.fast`.
- Thinking `disabled`: the `fast` tier's thinking-off setting (Haiku accepts `disabled` at effort `high` or below),
  matching `wrenChat`.
- Which document the page reads: the business's newest non-archived `social_pack` document by `createdAt` (from the
  20 newest by `updatedAt`), so a revision supersedes its draft. Before S2c there are no rows to anchor the read.
- The query returns no status field: without `social_posts` rows the only state is the card's.
- Hashtags are checked too, as the brief asked, though C-ART's hashtag pattern already rules out `.`, `:` and `@`.
- Test harness (`onceEach` in `convex/crew/launch.test.ts`, `convex/growth/drafts/emailSequence.test.ts` and the new
  test): with the email sequence and the social pack now running at the same time under the kit, a repeated dynamic
  import of the mocked `generators` module returned the original module for the second step (probed: the mock never
  ran for it, the real action did), so it bypassed the test's fixture hooks. Each test now memoises the first load of
  every module. Test-only; no runtime change.

Tests: `convex/growth/drafts/socialPack.test.ts` (24, convex-test, fixture mode, the launch DAG on the pool): the
HydroTrail launch writes the document (`crew-social-pack@1`, body equals the fixture) and one pending card, no
`social_posts` rows, nothing but `artifact_review` approvals; the request goes to Haiku with `<blueprint>` and
`<brand>` blocks, no answers and no palette; the step waits under a failed kit; a refusal, three invalid outputs
(poll options on an image post, a 281-character short caption, a `#` hashtag) and a link or handle in each of six
fields write nothing; the blueprint and kit briefs are re-checked at the finish; a finish without either id fails
permanent; both retry reasons; replay is idempotent; a revision writes a new version (superseding the first) and a
new card (round 1) that the page reads; a revision refuses when the kit is not approved; the page read (seven posts
fri→thu equal to the fixture, the card, nothing more), `none` before the step, `unavailable` for an unparseable body,
another business reads `none`, refusals (other owner, workspace off, AI off). Mutation-checked: removing the gate
entry turns the six link tests red; removing the finish's social re-check turns the three brief tests red.
Pure: `tests/platform/workspace-growth-social-pack.test.ts` (26: the detector on both sides, the check's path per
field, the gate on the fixture and a handle on each day, the step inputs, the spec's tier/effort/thinking, the user
block). Updated: `convex/crew/launch.test.ts` (the social pack runs after the kit in five run-throughs, its marker at
position 9, `succeeded` in the progress view), `convex/crew/steps.test.ts` (pool steps, the social step's parent and
inputs).

Checks (worktree, after `npm ci` there: the worktree had no `node_modules`): `git diff --check` 0,
`npm run typecheck` 0, `npx tsc -p convex --noEmit` 0, `npm run lint` 0 (43 warnings, none in changed files),
`npm run check:prompt-versions` 0 (8 versions match the lock), `npm run test:convex` 0 (91 files, 1317 tests),
`npm run test:platform` 0 (85 files, 2271 tests), `npm run test:security` 0 (221 node tests, 121 vitest tests),
`npm run build` 0.

Docs: this file only (stories and rulings already describe S2a).

Follow-ups:
- S2b: the Social page reads `socialPackDraft`; copy with `captionFor` and `PLATFORM_CAPTION_LIMITS`.
- S2c (blocked on Codex, see Needs from Codex): the seven `copy_ready` `social_posts` rows.
- The S1a re-check's link-detector gaps (title-case TLDs, non-ASCII labels, fullwidth dots, defanged forms) apply to
  the social check too, since it reuses `findLinkLike`; fix both together.
- The fixture pack's Wednesday post promises "the first 50 on the waitlist get early access, free", an offer the data
  does not state. It passes the gate (a soft count at most) and is only a fixture, but the live eval suite
  `crew-social-pack` should grade invented offers.
- Launches created before this change get no social task (`ensureLaunchStepTasks` runs only in the blueprint's
  finish); no launches exist while the platform is dormant.

Note (review nit 2): `socialPackDraft` reads the newest `social_pack` document of any subject. Today a business has
only the launch pack (`main`) and its revisions; once extra packs exist (WP77 `extra_social_pack`), S2b/S2c must
filter to the launch pack's lineage.

### WP76-S2a review fixes (independent review: 0 blockers, 0 majors)

- Minor 1: the @handle rule no longer refuses a time after `@` ("Meet us @6pm", "Q&A @noon Friday",
  "@6:30 PM", "@9 pm", "@12:30am", "@Midnight", "@6pm: bring water"). Exempt: an hour of one or two digits with
  optional `:mm` and optional am/pm (any case, optional space), or `noon` / `midnight`, ending there. Still refused:
  `@hydrotrail`, `@HydroTrail`, `@john_doe`, `@6pmclub`, `@noonrun`, `@2026hikers`, `@2026` (four digits is not an
  hour), `@6:30pmclub`. `findLinkLike` and the email check are unchanged.
- Minor 3: the prompt now says to keep posts short so all seven fit (a hook one short line, a caption under about
  900 characters, most posts far less). v1 is not on main, so v1 was edited in place: the uncommitted lock entry was
  reset to HEAD and re-locked with `--write` (`crew-social-pack@1` now `sha256:ef8c…e47e`).
- Minor 4: a revision with the kit approved but the blueprint not approved fails with no new document, no new card
  and no metered call (the kit-not-approved case got the same assertions).
- Minor 5: the other-owner refusal asserts `RESOURCE_NOT_FOUND`.
- Nit 4: the `runCrewGeneratorStep` and module doc comments now name the four step types. The type guard is unchanged.

Checks after the fixes (worktree): `git diff --check` 0, `npm run typecheck` 0, `npx tsc -p convex --noEmit` 0,
`npm run lint` 0 (43 warnings, none in changed files), `npm run check:prompt-versions` 0 (8 versions match),
`npm run test:convex` 0 (91 files, 1318 tests; `socialPack.test.ts` 25), `npm run test:platform` 0 (85 files, 2286
tests; `workspace-growth-social-pack.test.ts` 41), `npm run test:security` 0 (221 node tests, 121 vitest tests).
`npm run build` not re-run (no app code touched).
