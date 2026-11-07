# L1 private beta — the Monday cut (2026-11-09)

Owner decision 2026-11-07: split the launch. L1 ships on Monday 2026-11-09 with the core loop, and every other
workspace feature shows as "coming soon" and ships as it is ready. Rulings are in `docs/wp/RULINGS.md`
(2026-11-07, "L1 Monday cut", "L1 live test launches", "D26 timing").

L1 is invite-only (cohort `allowlist`), free only, no payments, nothing sends or posts.

## What ships Monday

| Area | What the founder gets | State today |
|---|---|---|
| Wizard | `/start/{idea}` or own idea, then Meet your co-founder | Merged (WP74) |
| The launch | Blueprint → team → brand kit text → 4 waitlist emails + 7 social posts, with retries and refunds | Merged up to the email (WP75, WP76-S1a); social pack in review (WP76-S2a) |
| Wren chat home | Chat, plus approve / ask-for-changes cards for every artifact | Merged (WP77) |
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
| L1-C2 | "Coming soon" in the nav | Unbuilt rows say so in words, not by colour alone |
| L1-C3 | Local fixture walkthrough | Whole journey on a disposable local backend, zero spend; findings fixed or logged |
| L1-C4 | Five live test launches | After the owner's deploy; different ideas; cost and quality recorded in `docs/wp/wp67-progress.md` |

### Codex lane (ship gates for the launch)

- **Codex 13:** a cron for `internal.crew.jobs.recoverStaleCrewRuns` (no args, every few minutes). Without it a run
  that dies mid-step stays stuck until the founder acts.
- **Codex 18:** the launch sweep on the same cron (re-advance owners with a launch in progress; re-enqueue a running
  step marker whose work is gone).

### Owner (John)

1. Merge the PRs above once green.
2. Deploy Convex to production (`first-squirrel-244`) and Vercel.
3. Production Convex env: `AI_PROVIDER_MODE=live` and `ANTHROPIC_API_KEY`. No Recraft or OpenAI key: logos and
   Studio are coming soon.
4. Ops settings (super admin): workspace on, cohort `allowlist`, global daily budget $10, kill switch `ai` off;
   `email`, `social`, `publish`, `ads` and `studioVideo` stay on (off for the product).
5. Add the test accounts to the cohort, run (or watch) the five live launches, then add the beta invitees.

## L1 gate (replaces G2 for this release only)

- `npm run typecheck`, `npm run lint`, `npm test` and `npm run build` pass on the merged tree.
- Codex 13 and 18 live.
- Five live launches complete, each under the $10 daily cap, median cost per launch ≤ $0.75. Any step failure is
  understood and either fixed or accepted in writing.
- a11y-check passes on every screen that ships.
- Nothing sends, posts or publishes: the kill switches above are on.

The full G2 (20 live launches) runs during the beta, before L2.

## Known gaps accepted for L1

- No live site, so no waitlist leads are captured.
- Paid change rounds have no screen (`spend` cards are not listed anywhere); free rounds work.
- The email and social link detectors have known gaps (title-case TLDs, fullwidth dots, defanged forms).
- No screen raises a fresh review after a card expires or is cancelled.
- The desk and the workspace keep separate shells until D26 lands after Monday.
