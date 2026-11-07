# L1 private beta — the Monday cut (2026-11-09)

Owner decision 2026-11-07: split the launch. L1 ships on Monday 2026-11-09 with the core loop, and every other
workspace feature shows as "coming soon" and ships as it is ready. Rulings are in `docs/wp/RULINGS.md`
(2026-11-07, "L1 Monday cut", "L1 live test launches", "D26 timing").

L1 is invite-only (cohort `allowlist`), free only, no payments, nothing sends or posts.

## What ships Monday

| Area | What the founder gets | State today |
|---|---|---|
| Wizard | `/start/{idea}` or own idea, then Meet your co-founder | Merged (WP74). An idea with no `idea_crew_seeds` row gets a generic blueprint suggestion, labelled "Not yet validated" (D15). Before Monday, seed every idea we invite people to build, or the owner accepts the generic step (see the findings below). L1-C5 and L1-C7 fix the wizard's dead end and name |
| The launch | Blueprint → team → brand kit text → 4 waitlist emails + 7 social posts, with retries and refunds | Merged up to the email (WP75, WP76-S1a); social pack in review (WP76-S2a) |
| Wren chat home | Chat with Wren | Chat merged (WP77). The crew's `artifact_review` cards are **not** shown there unless a Wren reply attaches one, so reviews need L1-C6 (a "Waiting on you" list) before Monday |
| Email page | The four emails and the sequence's review card | Merged (WP76-S1b) |
| Social page | The seven posts, a copy button and character count per platform, the review card | To build (WP76-S2b) |
| Brand kit page | The kit (name, tagline, voice, palette, type) read-only, with its review card | To build (L1-C1) |
| Files | What Wren remembers about the business | Merged |

## What shows as "coming soon"

Site and logo marks, landing page and publishing, build pack, SEO pack, launch plan, ads, Studio, outbound,
credits and billing, Team pages beyond the roster. Their routes already render a placeholder; L1-C2 makes the nav
say "Coming soon" for each, so nothing looks broken.

## Work left before Monday

### Claude lane

| Id | Work | Notes |
|---|---|---|
| WP76-S2a | Social pack generator | Built; review passed; minors being fixed, then PR |
| WP76-S2b | Social page | As specified in `docs/wp/wp76-stories.md`; kit styles only (D26 later) |
| L1-C1 | Brand kit page (read-only) | Reads the newest brand kit document and its card; same card flow as the Email page |
| L1-C2 | Honest "coming soon" | Unbuilt rows and their placeholder pages say "Coming soon" in words. Today's placeholder lines mislead: Team HQ says "Nobody needs you right now" while reviews are waiting, and Brand kit says "Nothing here yet" after the kit exists |
| L1-C5 | A way into the workspace | "Meet your co-founder" (`/start/...`) ends with no link or button to `/dashboard/b/{id}`: a dead end (found in the local walkthrough) |
| L1-C6 | "Waiting on you" list and a blueprint view | The crew's review cards only reach the chat when a Wren reply attaches them, so the blueprint and brand kit cards are never shown. Team HQ lists every pending review card (approve / ask for changes, or a link to its page), and the blueprint gets a read-only view to review |
| L1-C7 | Wizard name suggestion | The suggested business name is the idea title cut mid-word ("Gamified posture tracking app for phone-") |
| L1-C8 | Homepage own-idea link | Canvas Main board: "Have your own idea? Start building with it" under the hero buttons and in the final call, through sign-up to `/start/own`. Behind the same flag as "Build this idea, free", so in `allowlist` mode only a signed-in cohort member sees it. `/start/own` joins the sign-in return allowlist as a bare path (a query collapses to `/dashboard`); the allowlist is shared with Convex Auth, so it ships with the Convex deploy |
| L1-C9 | Build entry points for signed-in testers | Owner request, 2026-11-07: signed-in testers had no way into the wizard except the homepage. A verified member on an idea page gets "Build this idea, free" beside Save, straight to `/start/{slug}` with no sign-up hop. This reverses the WP74-S5 rule of no CTA for members. `/dashboard` gets a "Start building" card, straight to `/start/own`, with a secondary link to the workspace library. Both sit behind the same flag (`buildCtaVisible`), and off, the pages are unchanged. Owner's call (b), same day: in `allowlist` mode signed-out visitors see the CTAs too (`buildCta:buildCtaVisible`), and a signed-in founder who is not on the allowlist gets "You're not in the beta yet" at `/start` instead of a 404 (`buildCta:awaitingInvite`, asked only after the wizard gate refuses). A signed-in non-member still sees no CTA. The Convex change ships with the Convex deploy. The wizard re-checks access |
| L1-C3 | Local fixture walkthrough | Whole journey on a disposable local backend, zero spend; findings fixed or logged |
| L1-C4 | Five live test launches | After the owner's deploy; different ideas; cost and quality recorded in `docs/wp/wp67-progress.md` |

### Codex lane (ship gates for the launch)

- **Codex 13 and 18:** every five minutes, `workspace crew run recovery` in `convex/crons.ts` schedules
  `internal.crew.jobs.recoverStaleCrewRuns({})` and `internal.crew.launch.recoverStalledLaunches({})` as
  separate mutations. The first settles expired runs. The second re-advances launches and requeues stranded
  steps within the owner's workspace and AI gates. Each worker owns its pagination. Deploy the cron registration
  before L1.

### Owner (John)

1. Merge the PRs above once green.
2. Deploy Convex to production (`first-squirrel-244`) and Vercel.
3. Production Convex env: `AI_PROVIDER_MODE=live` and `ANTHROPIC_API_KEY`. No Recraft or OpenAI key: logos and
   Studio are coming soon.
4. Ops settings (super admin): workspace on, cohort `allowlist`, kill switch `ai` off, and the $10 daily cap split
   across both AI pools, because paid-plan owners (and any credit-funded work) draw from the paid pool, which
   defaults to zero: for example free pool $7 and paid pool $3. Free and paid together never pass $10;
   `email`, `social`, `publish`, `ads` and `studioVideo` stay on (off for the product).
5. Add the test accounts to the cohort, run (or watch) the five live launches, then add the beta invitees.

## After L1 (behind the same workspace gate)

| Id | Work | Release | Notes |
|---|---|---|---|
| WP67-EP | Employee pages, `/dashboard/b/{id}/team/{role}` | After L1, behind the same workspace gate | One page per specialist: profile, status, what is waiting on you, now and next, drafts, activity trail and the job in full. Coming-soon and not-hired employees get the profile and say why, with no invented work. Every name and avatar in the workspace links there (one link per person). No schema change; data gaps for Codex are in `docs/wp/employee-pages/BRIEF.md`. Merging puts it in front of the cohort straight away, because there is no extra flag. Hold the merge until after Monday, or accept it for L1. |

## L1 gate (replaces G2 for this release only)

- `npm run typecheck`, `npm run lint`, `npm test` and `npm run build` pass on the merged tree.
- Codex 13 and 18 live.
- Five live launches complete, with both pools together under the $10 daily cap, median cost per launch ≤ $0.75. Any step failure is
  understood and either fixed or accepted in writing.
- a11y-check passes on every screen that ships.
- Nothing sends, posts or publishes: the kill switches above are on.

The full G2 (20 live launches) runs during the beta, before L2.

## Local walkthrough findings (2026-11-07, fixture mode)

The whole journey ran on a disposable local backend: sign-in, the wizard, business creation, the team, and a launch
that wrote the blueprint, team, brand kit and email with three pending review cards; the Email page's Approve worked
with focus return and the live message. The blockers found are L1-C2, L1-C5, L1-C6 and L1-C7 above. Also:

- With no `idea_crew_seeds` row for an idea, the wizard's blueprint suggestion is generic ("The one person who feels
  this problem most"). Live launches personalise the blueprint, but the wizard step reads boilerplate for every idea
  that has no seed. Decide before Monday: seed the ideas we invite people to, or accept it.
- The Email page says "Sequence status: Draft" right after the founder approves (the row stays draft until WP79
  activates it). Reword to say it is approved and not sending yet.

## Known gaps accepted for L1

- No live site, so no waitlist leads are captured.
- Paid change rounds have no screen (`spend` cards are not listed anywhere); free rounds work.
- The email and social link detectors have known gaps (title-case TLDs, fullwidth dots, defanged forms).
- No screen raises a fresh review after a card expires or is cancelled.
- The desk and the workspace keep separate shells until D26 lands after Monday.
