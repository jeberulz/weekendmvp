# L1 private beta — the Monday cut (2026-11-09)

Owner decision 2026-11-07: split the launch. L1 ships on Monday 2026-11-09 with the core loop, and every other
workspace feature shows as "coming soon" and ships as it is ready. Rulings are in `docs/wp/RULINGS.md`
(2026-11-07, "L1 Monday cut", "L1 live test launches", "D26 timing").

L1 is invite-only (cohort `allowlist`), free only, no payments, nothing sends or posts.

## Status on 2026-11-16

**The build is done. The release is held at the L1 gate.** Every Claude-lane and Codex-lane item below is merged,
and production deployed `18dcb3fd` (#282) on 2026-11-08. Nothing has merged since. Monday 2026-11-09 passed with
the gate open:

- **Live AI calls failed until #282.** The first live run on production (the 5-idea seed spike, 2026-11-08) was
  rejected by Anthropic for every prompt with a reply schema: Wren, both blueprint prompts, brand kit, email, social
  and the idea seed. Nothing was charged. #282 sends the schema in the accepted form. The L1 launches would have
  failed the same way before it.
- **Live calls still fail after #282.** The owner re-ran the spike on 2026-11-16 (`--seed-version 2026-11-08.1
  --prod --limit 5 --apply`). All five items failed again as `bad_request`, and nothing was charged. The cause is
  unknown: see "Live seed run (2026-11-16)" below. **This blocks L1:** every crew step and Wren's chat use the same
  request path.
- **Five live test launches (L1-C4): not recorded.** No cost or quality notes are in `wp67-progress.md`.
- **The `Crew seeds` workflow skips every day.** It has run daily since 2026-11-09 and stops with "Crew seeds are
  not configured" because the `CONVEX_PROD_DEPLOY_KEY` secret or the `CREW_SEED_VERSION` variable is missing.
  Until it runs, or an operator seeds by hand, an unseeded idea shows the generic "Not yet validated" blueprint step.
- **Owner steps 4–5** (ops settings, cohort) are not recorded in the repo.

What is left, in order: find and fix the live `bad_request`, get one live seed run to pass, run the five live launches and record them, confirm the ops settings, then invite the beta.
The full checks and the a11y-check on the merged tree passed on 2026-11-16 (see "Gate re-run (2026-11-16)"); that
walkthrough found two copy issues worth fixing before invites (F1, F2), both fixed on `claude/l1-gate-1116`.

## What ships Monday

| Area | What the founder gets | State (2026-11-16) |
|---|---|---|
| Wizard | `/start/{idea}` or own idea, then Meet your co-founder | Merged (WP74). Dead end and name fixed (L1-C5, L1-C7, #261). Per-idea seeds built (WP90 #278, WP92 #280), but no seed has been written on prod yet, so every idea still gets the generic "Not yet validated" step (D15) |
| The launch | Blueprint → team → brand kit text → 4 waitlist emails + 7 social posts, with retries and refunds | Merged (WP75, WP76-S1a #247, WP76-S2a #258); the idea picks the team (WP91 #279). Live calls only work since #282; no live launch is recorded |
| Wren chat home | Chat with Wren | Merged (WP77). Review cards reach the founder through Team HQ's "Waiting on you" (L1-C6), and Wren sees open reviews (#274) |
| Email page | The four emails and the sequence's review card | Merged (WP76-S1b #251) |
| Social page | The seven posts, a copy button and character count per platform, the review card | Merged (WP76-S2b #260) |
| Brand kit page | The kit (name, tagline, voice, palette, type) read-only, with its review card | Merged (L1-C1; landed through #267, because #262 never reached main) |
| Files | What Wren remembers about the business | Merged |

## What shows as "coming soon"

Site and logo marks, landing page and publishing, build pack, SEO pack, launch plan, ads, Studio, outbound,
credits and billing, Team pages beyond the roster. Their routes already render a placeholder; L1-C2 makes the nav
say "Coming soon" for each, so nothing looks broken.

## Work for L1 (status updated 2026-11-16)

### Claude lane

| Id | Work | Status (2026-11-16) | Notes |
|---|---|---|---|
| WP76-S2a | Social pack generator | Merged (#258) | Built; review passed; minors being fixed, then PR |
| WP76-S2b | Social page | Merged (#260) | As specified in `docs/wp/wp76-stories.md`; kit styles only (D26 later) |
| L1-C1 | Brand kit page (read-only) | Merged (via #267) | Reads the newest brand kit document and its card; same card flow as the Email page |
| L1-C2 | Honest "coming soon" | Merged (#261) | Unbuilt rows and their placeholder pages say "Coming soon" in words. Today's placeholder lines mislead: Team HQ says "Nobody needs you right now" while reviews are waiting, and Brand kit says "Nothing here yet" after the kit exists |
| L1-C5 | A way into the workspace | Merged (#261) | "Meet your co-founder" (`/start/...`) ends with no link or button to `/dashboard/b/{id}`: a dead end (found in the local walkthrough) |
| L1-C6 | "Waiting on you" list and a blueprint view | Merged (via #267) | The crew's review cards only reach the chat when a Wren reply attaches them, so the blueprint and brand kit cards are never shown. Team HQ lists every pending review card (approve / ask for changes, or a link to its page), and the blueprint gets a read-only view to review |
| L1-C7 | Wizard name suggestion | Merged (#261) | The suggested business name is the idea title cut mid-word ("Gamified posture tracking app for phone-") |
| L1-C8 | Homepage own-idea link | Merged (#270) | Canvas Main board: "Have your own idea? Start building with it" under the hero buttons and in the final call, through sign-up to `/start/own`. Behind the same flag as "Build this idea, free", so in `allowlist` mode only a signed-in cohort member sees it. `/start/own` joins the sign-in return allowlist as a bare path (a query collapses to `/dashboard`); the allowlist is shared with Convex Auth, so it ships with the Convex deploy |
| L1-C9 | Build entry points for signed-in testers | Merged (#272) | Owner request, 2026-11-07: signed-in testers had no way into the wizard except the homepage. A verified member on an idea page gets "Build this idea, free" beside Save, straight to `/start/{slug}` with no sign-up hop. This reverses the WP74-S5 rule of no CTA for members. `/dashboard` gets a "Start building" card, straight to `/start/own`, with a secondary link to the workspace library. Both sit behind the same flag (`buildCtaVisible`), and off, the pages are unchanged. Owner's call (b), same day: in `allowlist` mode signed-out visitors see the CTAs too (`buildCta:buildCtaVisible`), and a signed-in founder who is not on the allowlist gets "You're not in the beta yet" at `/start` instead of a 404 (`buildCta:awaitingInvite`, asked only after the wizard gate refuses). A signed-in non-member still sees no CTA. The Convex change ships with the Convex deploy. The wizard re-checks access |
| L1-C9 | Team and lead name decided by the idea | Merged as WP91 (#279). This id is used twice; this row is the roster one | `docs/wp/roster-per-idea/PLAN.md` (owner decisions 2026-11-07, RULINGS). S1: the chat uses the founder's lead name (today it always says "Wren"). S2: varied lead-name suggestions. S2b: about 6 lead avatars (one-time image spend, confirm first). S3–S5: the blueprint call proposes the team with a fallback to today's rules; core Lead, Brand, Email, Social. If S3–S5 slip, S1–S2 ship alone and the fallback keeps launches safe |
| L1-C3 | Local fixture walkthrough | Done 2026-11-07; blockers fixed in #261 and #267. Re-run on `45ac7371` 2026-11-16: no blockers, findings F1–F6 below | Whole journey on a disposable local backend, zero spend; findings fixed or logged |
| L1-C4 | Five live test launches | **Open.** Not recorded. Needs #282 (merged) and a passing live seed run first | After the owner's deploy; different ideas; cost and quality recorded in `docs/wp/wp67-progress.md` |

### Codex lane (ship gates for the launch)

- **Codex 13 and 18:** every five minutes, `workspace crew run recovery` in `convex/crons.ts` schedules
  `internal.crew.jobs.recoverStaleCrewRuns({})` and `internal.crew.launch.recoverStalledLaunches({})` as
  separate mutations. The first settles expired runs. The second re-advances launches and requeues stranded
  steps within the owner's workspace and AI gates. Each worker owns its pagination. Deploy the cron registration
  before L1.
- **Status (2026-11-16): merged and deployed.** Codex 13 #259, Codex 18 #263, and #264 runs the sweep on the same
  five-minute tick. Both shipped to production with the 2026-11-08 deploy. That the cron is ticking on prod is not
  recorded.

### Owner (John)

Status 2026-11-16 in brackets.

1. Merge the PRs above once green. (Done, last merge #282 on 2026-11-08.)
2. Deploy Convex to production (`first-squirrel-244`) and Vercel. (Done: Vercel Production deployed `18dcb3fd`
   on 2026-11-08, and the Vercel build deploys Convex.)
3. Production Convex env: `AI_PROVIDER_MODE=live` and `ANTHROPIC_API_KEY`. No Recraft or OpenAI key: logos and
   Studio are coming soon. (Done: the 2026-11-16 seed run reported `submitted (live)`, so prod is in live mode with
   a key.)
4. Ops settings (super admin): workspace on, cohort `allowlist`, kill switch `ai` off, and the $10 daily cap split
   across both AI pools, because paid-plan owners (and any credit-funded work) draw from the paid pool, which
   defaults to zero: for example free pool $7 and paid pool $3. Free and paid together never pass $10;
   `email`, `social`, `publish`, `ads` and `studioVideo` stay on (off for the product). (Not recorded.)
5. Add the test accounts to the cohort, run (or watch) the five live launches, then add the beta invitees. (Not
   recorded.)
6. Added 2026-11-16: to let the `Crew seeds` workflow run, set the `CONVEX_PROD_DEPLOY_KEY` secret and the
   `CREW_SEED_VERSION` variable in GitHub. Live spend stays off until `CREW_SEEDS_AUTO_APPLY=true` (WP92).

## After L1 (behind the same workspace gate)

| Id | Work | Release | Notes |
|---|---|---|---|
| WP67-EP | Employee pages, `/dashboard/b/{id}/team/{role}` | After L1, behind the same workspace gate | One page per specialist: profile, status, what is waiting on you, now and next, drafts, activity trail and the job in full. Coming-soon and not-hired employees get the profile and say why, with no invented work. Every name and avatar in the workspace links there (one link per person). No schema change; data gaps for Codex are in `docs/wp/employee-pages/BRIEF.md`. Merging puts it in front of the cohort straight away, because there is no extra flag. Hold the merge until after Monday, or accept it for L1. **Merged 2026-11-07 (#275)**, so it ships with L1 when the workspace is turned on. |

## L1 gate (replaces G2 for this release only)

Status 2026-11-16 in brackets.

- `npm run typecheck`, `npm run lint`, `npm test` and `npm run build` pass on the merged tree. (**Passed
  2026-11-16 on `45ac7371`** after a clean `npm ci`: typecheck 0, lint 0 errors and 45 warnings, `npm test` 6,659
  passed and 0 failed across all suites, build 0. See "Gate re-run (2026-11-16)" below.)
- Codex 13 and 18 live. (Merged and deployed; ticking on prod not recorded.)
- Five live launches complete, with both pools together under the $10 daily cap, median cost per launch ≤ $0.75. Any step failure is
  understood and either fixed or accepted in writing. (**Open.**)
- a11y-check passes on every screen that ships. (**Passed 2026-11-16 on `45ac7371`**, local fixture backend, in a
  real browser: wizard, Meet your co-founder, dashboard with the chat column (1440px) and drawer (375px), Team HQ,
  Brand kit, Email, Social, Files and two employee pages. No screen-reader pass. See "Gate re-run (2026-11-16)".)
- Nothing sends, posts or publishes: the kill switches above are on. (Not recorded; see owner step 4.)

The full G2 (20 live launches) runs during the beta, before L2.

## Gate re-run (2026-11-16)

Merged tree `45ac7371`, branch `claude/l1-gate-1116`, worktree `.worktrees/l1-gate-1116`, after `npm ci`.

| Check | Exit | Result |
|---|---|---|
| `npm run typecheck` | 0 | no errors |
| `npm run lint` | 0 | 0 errors, 45 existing warnings |
| `npm test` | 0 | 6,659 passed, 0 failed (every chained suite, including `test:engine` and `test:editorial`) |
| `npm run build` | 0 | build completed |

**Walkthrough (L1-C3 re-run).** Local fixture backend (`AI_PROVIDER_MODE` unset, zero spend), test founder
`founder-a@example.test`, idea `ai-protein-tracker`. Idea page "Build this idea, free" → wizard (8 steps) → Meet
your co-founder (Ezra, 8 hired, 5 skipped, both links into the workspace) → dashboard (5 of 5 ready, 4 pending
cards) → a chat question to Ezra (fixture reply listing every open review) → Email "Approve all 4" (focus moves to
the status, live message "Sending is off during the beta") → Team HQ, Brand kit, Social, Files, employee pages for
Iris and Leo. The founder was at the free plan's one-business limit, so the local `addBusiness` helper created the
business, as before.

**a11y-check.** In-browser script on each screen: heading order (one h1, no skips), names on every button and link,
labels on every input, `alt` on every image, no stray SVGs, no `style` attributes in `main`, no horizontal scroll,
and WCAG contrast on every visible text node (4.5:1, 3:1 for large text). Result: pass on every screen, with no
contrast failures. Keyboard: focus rings visible (Meet's links measure 6.4:1 on their dark panel). The 375px chat
drawer moves focus to its close button, keeps Tab inside, closes on Escape and returns focus to "Chat with Ezra".
Not done: a VoiceOver pass, and the failed or paused launch states (the fixture launch always completes).

**Findings** (none blocks the gate):

- **F1 (fix before invites): a "Start sending this email sequence" card in chat.** Besides the Email page's review
  card (`artifact_review` on the document), Wren can raise a `send` card on the draft sequence
  (`approvableSubjects` in `convex/workspace/chat.ts`; title from `approvalCardTitle` in `lib/workspace/wrenCards.ts`).
  The fixture reply does, and a live Wren reply can. In L1 the founder sees an Approve button on "Start sending this
  email sequence" while sending is off, and approves the same four emails twice. After the click the card says
  "Approved. Sending is off during the beta, so nothing goes out yet", so nothing misleads after approval, but the
  title does before it. **Fixed on `claude/l1-gate-1116`:** `approvalKindSwitchedOn` (`convex/ops/settings.ts`) maps
  `publish`, `send`, `post` and `ad_launch` to their kill switches. `approvableSubjects` leaves a switched-off kind out
  of what Wren is offered, and `raiseApprovalCard` refuses (and does not reuse) a card of that kind, so a live model
  naming an id it was not offered is refused too. Review and spend cards are unaffected.
- **F2 (fix before invites): the free change round count is off by one.** Email, Brand kit and Social show
  "1 free round of changes left." on a fresh draft, while Meet your co-founder and the "Asking for changes" help say
  two free rounds per piece. `freeRoundsLeft` (`lib/workspace/changeRounds.ts`) is the count left after the round
  being previewed, and `freeRoundsCopy` (`lib/workspace/emailPage.ts`) prints it as the current count. **Fixed on
  `claude/l1-gate-1116`:** `previewLine` counts the previewed round as still the founder's (`freeRoundsLeft + 1`), so a
  fresh draft reads "2 free rounds of changes left." The server contract is unchanged. The page tests had mocked the
  preview with values the server never sends (round 1 with 2 left), which hid the bug; they now use the real ones.
- **F3 (low): the wizard Name step** says "Alternatives are there if you want them" with only one name shown (no
  seed, fixture). Recheck once a seed exists.
- **F4 (low): duplicate ids on a full page load.** A hidden React streaming container (`<div hidden id="S:0">`) stays
  in the DOM with a second copy of the shell (`workspace-main`, `workspace-nav-panel`, the chat). Hidden, so screen
  readers skip it; seen in `next dev` only, not checked on a production build.
- **F5 (low): the employee page** for Iris lists "Brand kit · Done" under Now and next while its review card waits.
- **F6 (low): an at-limit founder** who resumes an older wizard session can finish all eight steps before "Create my
  business" refuses. New sessions are refused at the start (#273), so only old sessions reach this.

## Local walkthrough findings (2026-11-07, fixture mode)

The whole journey ran on a disposable local backend: sign-in, the wizard, business creation, the team, and a launch
that wrote the blueprint, team, brand kit and email with three pending review cards; the Email page's Approve worked
with focus return and the live message. The blockers found are L1-C2, L1-C5, L1-C6 and L1-C7 above. Also:

- With no `idea_crew_seeds` row for an idea, the wizard's blueprint suggestion is generic ("The one person who feels
  this problem most"). Live launches personalise the blueprint, but the wizard step reads boilerplate for every idea
  that has no seed. Decide before Monday: seed the ideas we invite people to, or accept it. (Owner ruled: seed every
  public idea, WP90 #278, with WP92 #280 to keep seeds current. No seed is on prod yet; see the status section.)
- The Email page says "Sequence status: Draft" right after the founder approves (the row stays draft until WP79
  activates it). Reword to say it is approved and not sending yet. (Fixed in #267: the line is gone, and an approved
  sequence reads "Nothing is sent yet." Not rechecked in a browser.)

## Live seed run (2026-11-16)

Run `zd72txwgg442hzmypyx3aqert18jbtrg`, seed version `2026-11-08.1`, batch `msgbatch_01J8S67Vo457F1EruQRXbqcV`.
Five validated idea pages sent, none refused, $1.20 reserved at the batch rate.

- **Outcome: all five failed** (`phone-neck-score-app`, `timed-tool-access-contractors`,
  `contractor-ai-receptionist`, `ai-site-design-blueprints`, `ai-fashion-lookbook-studio`), each `bad_request`.
  Charged $0.00. This is the same failure the 2026-11-08 run reported, so #282 is **not** proven live.
- **Why we can't see the cause:** the batch adapter (`convex/ai/providers/anthropic.ts`, the `errored` case) keeps only
  the error type, which maps to 400 and then `bad_request`. Anthropic's message is dropped.
- **Ruled out locally:**
  - The request matches the documented API: `claude-opus-5-5`, adaptive thinking, effort `medium`, 16,384 max
    tokens, and `output_config.format`. Batches support structured outputs.
  - The seed schema as sent (`z.toJSONSchema` then `wireOutputSchema`) has 62 properties, 3 optional, no unions,
    `minItems` only 0 or 1, and no `minLength`, `maxLength`, `pattern`, `format`, numeric limits or `oneOf`.
- **Next:**
  1. Read the real error from Anthropic. The batch results are kept 29 days, and the owner can read them in the
     Console or with `GET /v1/messages/batches/msgbatch_01J8S67Vo457F1EruQRXbqcV/results` (read only, no spend).
  2. Small fix: keep a short form of the provider's error message on failed items, so `crew:seeds --status` prints
     it.

## Known gaps accepted for L1

- No live site, so no waitlist leads are captured.
- Paid change rounds have no screen (`spend` cards are not listed anywhere); free rounds work.
- The email and social link detectors have known gaps (title-case TLDs, fullwidth dots, defanged forms).
- No screen raises a fresh review after a card expires or is cancelled.
- The desk and the workspace keep separate shells until D26 lands after Monday.
