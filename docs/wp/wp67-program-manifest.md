# WP67 Program Manifest - Launch Workspace (AI crew, credits, publishing)

**Status: RATIFIED and frozen, 2026-11-05.** The owner approved every decision in
`docs/plans/launch-workspace/06-decisions.md` except D10 (SMS), which is deferred. The
rulings are recorded in `docs/wp/RULINGS.md` under that date. This manifest is now the
source of truth for the WP67 Program/Migration lane. Workers may not re-scope an entry.
If reality disagrees with this manifest, stop and escalate.

Branch (plan): `claude/wp67-launch-crew-plan`
Lane: Program/Migration (new product surface across data, billing, AI runtime,
publishing, email and UI; touches the live payments path and the live Convex backend)
Plan: `docs/plans/launch-workspace/` (strategy, architecture, cost model, build plan,
lanes, decisions, briefs)
Design source: "Weekend MVP Launch Experience" canvas,
https://claude.ai/artifact/DKGkhWuwpUxrBmgngy3fNG
Rulings: the WP67 rows dated 2026-11-05 in `docs/wp/RULINGS.md` (D1–D21; D10 deferred).
Existing rulings that constrain the program are listed under Scope.

## Why

The canvas defines a free weekend launch run by an AI crew, with credits, Studio
media and paid distribution. The repo already has most of the foundations, built and
mostly unused: the WP22 platform tables, the WP24 credit ledger, WP27/WP28 preview and
tenant hosting, and live Builder's Hub billing (WP64). No hosted code calls a model
today. This program connects those foundations, adds a metered AI runtime, and ships
the workspace in phases, with Codex and Claude building in parallel.

## Scope

- **In:** the business workspace under `/dashboard/b/{projectId}`, the wizard under
  `/start`, the AI gateway and crew pipelines in Convex, metering and budgets, ledger
  v2 with monthly credits, the Growth plan, generated landing pages on
  `{slug}.weekendmvp.app`, tenant waitlist email, copy-and-post social, ads drafts,
  Studio images and video, Autopilot (bounded), members and custom domains (Phase 6).
- **In:** additive amendments to the WP22 closed unions (D19), and un-parking the
  WP29/WP30/WP31 slices needed for generated landing pages (D2).
- **Out:** credit packs (ruling R9 stands), the parked repository-preview funnel
  (`/build/{slug}`), the hosted own-idea Validation Report (a later program; D15),
  SMS of any kind, including collecting phone numbers (D10 deferred), outbound at scale (D9), running founders' product code, payments
  on behalf of founders.
- **Constraints from existing rulings:** engine model rulings (RULINGS.md lines 33,
  37) are unchanged and cover the research engine only; no model may synthesise
  keyword volume, CPC or competition (line 38); ledger and audit rows are immutable
  (line 26); the Builder's Hub price ladder (2026-10-04) and the WP64 go-live rulings
  stand.

## Phases and work packages

| Phase | Weeks | Work packages (lane) | Gate | Release |
|---|---|---|---|---|
| 0. Decide and freeze | W0–W1 | WP67 (Claude, orchestrator), WP68 (Codex), WP69 (Claude) | G0 | — |
| 1. Foundations | W1–W2 | WP70 (Codex), WP71 (Claude), WP72 (Claude), WP73 (Codex) | G1 | — |
| 2. The free weekend | W2–W5 | WP74, WP75, WP76, WP77 (Claude); WP78, WP79 (Codex) | G2 | L1 private beta |
| 3. Money | W5–W7 | WP80 (Codex), WP81 (Claude) | G3 | L2 credits live |
| 4. Studio | W6–W8 | WP82 (Claude) | G4 | L3 public launch |
| 5. Distribution | W8–W10 | WP83 (Codex), WP84 (Claude) | G5 | L4 |
| 6. Scale | W10–W12 | WP85 (Codex), WP86 (Claude) | G6 | L5 |
| 7. Program gate | W12 | WP87 (Gate: Claude orchestrates, Codex reviews) | G7 | Close |

Details per WP (files owned, stories, acceptance) are in
`docs/plans/launch-workspace/04-build-plan.md`. Lane rules are in
`docs/plans/launch-workspace/05-lanes-codex-claude.md`.

## Gates (every phase)

1. `npm run typecheck`, `npm run lint`, `npm test` and `npm run build` pass on the
   merged tree; results recorded in `docs/wp/wp67-progress.md`.
2. Every merge is dormant: additive schema, functions guarded by
   `assertFeatureEnabled`, pages 404 with the flag off, new env entries optional.
3. Money and side-effect paths have exactly-once tests; webhook replays are covered.
4. No live model, image, video, email or social call in tests or CI.
5. a11y-check on every new or changed screen.
6. Independent review by the other lane for authorization, approvals, ledger, Stripe,
   publishing and sending changes.
7. Phase-specific checks in `04-build-plan.md` (G0–G7), including measured AI cost
   (G2: median ≤ $0.75 over 20 live test launches).
8. Release steps (cohort on, credits on, public CTAs on, native features on) are owner
   actions, taken only after the gate passes.

## Risks

- Merges deploy the live backend. Mitigation: dormant-by-default rules above.
- Free-tier abuse becomes a compute bill. Mitigation: per-account ceiling, daily
  global budget, kill switches, verified email, one free business.
- Two lanes collide. Mitigation: contract-first Phase 0, single-writer files,
  directory ownership, separate worktrees, reserved WP numbers.
- Real waitlist leads make Weekend MVP a data processor. Mitigation: D5 privacy,
  retention and export before real capture.
- Platform approvals (Meta) take weeks. Mitigation: apply in Phase 0; copy-and-post
  ships first; native features are flagged.
- Video provider prices or availability change. Mitigation: adapter with fallback;
  credit prices set from measured cost.

## Result

Phase 0 started 2026-11-05. Rulings are recorded and WP67–WP87 are reserved in the plan
PR. Next: WP68 (Codex) and WP69 (Claude) in parallel; see `docs/wp/wp67-progress.md`.
