# Launch Workspace — plan index

The plan for turning the "Weekend MVP Launch Experience" canvas
(https://claude.ai/artifact/DKGkhWuwpUxrBmgngy3fNG) into a product: a founder picks an
idea, answers eight wizard questions, and a small AI crew led by Wren builds their brand,
a live landing page with a waitlist, emails, posts, a launch plan and a build pack. The
founder approves every step. Free finishes one weekend launch; money starts with
compute, distribution and scale.

**Status:** Ruled 2026-11-05: every decision approved except D10 (SMS), which is
deferred. Rulings are in `docs/wp/RULINGS.md`. Building starts with Phase 0.
**Program:** WP67 (Program/Migration lane), work packages WP68–WP87 (reserved).
**Status board:** `docs/wp/wp67-progress.md`. **Kickoff prompts:** `briefs/kickoff-claude.md`
and `briefs/kickoff-codex.md`.
**Manifest:** `docs/wp/wp67-program-manifest.md`.

## Reading order

| # | File | Read it for |
|---|---|---|
| 1 | [`01-strategy.md`](01-strategy.md) | What we're building, why now, the plan ladder, credit prices, free-tier economics, promises, risks |
| 2 | [`06-decisions.md`](06-decisions.md) | The 21 decisions the owner must make, each with a recommendation. **Start here if you're the owner.** |
| 3 | [`02-architecture.md`](02-architecture.md) | What exists today, the data model (reused WP22 tables plus new ones), the AI runtime, crew pipelines, ledger v2, billing, publishing, email, connectors, security, flags |
| 4 | [`03-ai-cost-model.md`](03-ai-cost-model.md) | What every launch, chat turn and credit action costs us, the levers ranked, metering and budgets, the Phase 0 measurement spike |
| 5 | [`04-build-plan.md`](04-build-plan.md) | Phases 0–7, every work package with its lane, files, stories, acceptance and gate; the contract list; the calendar |
| 6 | [`05-lanes-codex-claude.md`](05-lanes-codex-claude.md) | How Codex and Claude split the work without conflicts: file ownership, single-writer files, branches, reviews, handoffs |
| 7 | [`07-landing-design.md`](07-landing-design.md) | How Leo and Iris avoid generic AI landing pages: where design quality is decided, the skills used at build time versus runtime, bans, the C-ART change before G0 (proposed, from [`briefs/design-skills-crew-brief.md`](briefs/design-skills-crew-brief.md)) |
| 8 | [`briefs/codex-lane.md`](briefs/codex-lane.md), [`briefs/claude-lane.md`](briefs/claude-lane.md) | Kickoff prompts to paste into each agent at the start of a work package |

## The numbers that matter

| | Value |
|---|---|
| AI cost of one free launch (library idea) | ≈ $0.54 estimated, target ≤ $0.75, hard ceiling $1.50 per free account |
| Same launch with Opus for every draft | ≈ $0.90 (why the model router matters) |
| Precompute for all 231 library ideas | ≈ $40–$51 per seed version (Opus, Batch API) |
| Provider cost rule for credits | ≤ $0.013 per credit (one credit earns $0.058 on Builder's Hub, $0.040 on Growth) |
| Credit action gross margin on Growth | 67–88% at recommended prices; video is the thinnest |
| Typical paid member, monthly provider cost | ≈ $3–$4 on Builder's Hub, ≈ $12 on Growth |
| Private beta (L1) | End of week 5 (about 2026-12-18) |
| Public launch (L3) | End of week 8 plus two holiday buffer weeks (about 2027-01-22) |

## Decisions (ruled 2026-11-05)

All approved as recommended except D10 (SMS), which is deferred: no SMS step and no
phone numbers until it is ruled. The Phase 0 set was D1 (one plan ladder, keep
Builder's Hub), D2 (un-park site publishing for generated landing pages), D3 (free-tier
cost ceiling), D4 (credit prices), D5 (real waitlist leads), D6 (separate tenant email
domain), D11 (Claude for the crew), D14 (reserve WP67–WP87), D19 (reuse the WP22
tables) and D21 (model calls in Convex). Details are in `06-decisions.md`.

## Week 0, who does what

| Who | Does |
|---|---|
| Owner | Merges the plan PR; approves the $25 cost spike when WP69 asks; starts Meta business verification and app review, the tenant Resend domain and the wildcard DNS plan |
| Claude | WP67 (status board, gate G0) and WP69 (artifact contracts, roster rules, cost spike) |
| Codex | WP68 (schema contract, union amendments, `requireBusinessAccess`, ops switches, dependencies) |
