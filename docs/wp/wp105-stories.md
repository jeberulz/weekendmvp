# WP105 Stories - Editor verify-claim action

Branch: `marley/pain-engine-verify-claim`
Lane: Work Package
Registry: `docs/PROJECT_STRATEGY.md`
Definition of done: An editor can verify one material claim in the admin panel after checking it against its sources; verifying clears that claim's UNSUPPORTED_CLAIM blocker; guards refuse non-editors, approved snapshots, assumed claims and already-verified claims; all required checks green; draft PR open for Codex review.

## Stories

- [ ] `WP105-S1` - Editor authority for claim verification
  - Scope: `lib/editorial/contracts/evidence.ts`, `convex/editorial/validators.ts` (via the shared enum)
  - Acceptance criteria:
    - `VERIFICATION_AUTHORITIES` gains an editor authority value; the Convex claim/source validators accept it through the shared enum.
    - `engine_receipt` is not reused for editor verification; status "verified" is never paired with authority "none".
  - Verification:
    - `npm run typecheck`
    - Convex validator test proving the new authority passes

- [ ] `WP105-S2` - Repository verifyClaim command
  - Scope: `lib/editorial/contracts/repository.ts`, `lib/editorial/core/repository.ts`, `lib/editorial/contracts/views.ts` (activity action)
  - Acceptance criteria:
    - `verifyClaim(revisionId, claimId, note)` on `EditorialRepository`, implemented in `EditorialCore` following the `markReviewed` pattern (editor-only guard, working-draft-only, refuse on approved snapshot).
    - Refuses a non-editor, a non-material claim, an "assumed" claim, and an already-verified claim.
    - Sets `claim.verification` to `{ status: "verified", reason: <note> }` and `claim.verificationAuthority` to the editor authority; records an audit entry with actor + timestamp + note; stamps the idea.
    - Verifying a claim clears its UNSUPPORTED_CLAIM blocker on the next derived view.
  - Verification:
    - Repository-level tests in the contract suite / live-core tests
    - `npm test`

- [ ] `WP105-S3` - Convex mutation and live adapter
  - Scope: `convex/editorial/commands.ts`, `lib/editorial/adapters/live/repository.ts`
  - Acceptance criteria:
    - A `verifyClaim` Convex mutation delegates to the shared core, following the `markReviewed` mutation exactly.
    - The live adapter exposes `verifyClaim` through `api.editorial.commands.verifyClaim`.
    - A non-editor calling the mutation is denied (denials test).
  - Verification:
    - `npm test` (convex editorial suites)
    - `npm run typecheck`

- [ ] `WP105-S4` - Server action and EvidencePanel button
  - Scope: `app/admin/editorial/_actions/review.ts`, `components/admin/editorial/workspace/EvidencePanel.tsx`, `components/admin/editorial/workspace/IdeaWorkspace.tsx`
  - Acceptance criteria:
    - `verifyClaimAction` follows the `markReviewedAction` pattern (`withWorkspace` + `withView`, fresh revision view returned).
    - A Verify button appears next to each verifiable claim (material, not assumed, not already verified) in the EvidencePanel, with an optional note via the existing `ReasonDialog`.
    - Clicking it clears that claim's blocker and updates the checklist, blockers and Approve state without a reload.
    - No emoji or text-symbol icons; reuses `textButtonClass` and existing UI patterns.
  - Verification:
    - `npm run build`
    - `npm run lint`

## Out Of Scope

- E7 activation, releases, publishing, or any change to the release switch.
- The three already-submitted Pain Engine drafts (no re-submission, no production data change).
- Any change to the old engine's Source Critic or verification receipts.
- WP44, WP104, Codex/Claude lanes.

## Notes

- Verifying a claim changes the review item's dependencyHash (it includes verification + authority), so that item goes stale and needs re-attestation. That is by design; do not work around it.
- The three submitted ideas (idea_smgigzcnudylhj3z2cfg, idea_gtej7sq3kjkh23zdufbp, idea_q6hfj2gbilhylr4i76gz) each carry UNSUPPORTED_CLAIM blockers because their claims landed unverified; this WP is what lets the editor clear them after checking the sources.
