# WP77 Stories - Wren chat and the approvals loop

Branch: `claude/wp77-wren-approvals`
Lane: Work Package (Claude lane, high), inside the WP67 Program/Migration lane
Plan: `docs/plans/launch-workspace/04-build-plan.md` (WP77, contracts table C-APPROVAL, C-LIMITS, C-JOBS),
`02-architecture.md` §5 (gateway), §6.3 (revisions), §13 (rate limits), §14 (security), §16 (frontend);
`06-decisions.md` D13 (Autopilot limits), D17 (two free change rounds), D23 (no tool loops)
Owns: `convex/workspace/{approvals,chat,memory,files}.ts`, `convex/ai/prompts/wren*`, workspace Dashboard, chat
panel, Files ("What Wren knows") under `app/(launch-workspace)/dashboard/b/[projectId]/**` and
`components/workspace/**`
Depends on: WP71 (gateway action, #192), WP72 (shell, #183), C-LIMITS (WP70, #191), C-LEDGER (WP73, #179)
Definition of done (`04` WP77 acceptance):
- a founder can run the whole weekend from the chat and the cards;
- prompt-injection corpus cases cannot trigger a side effect.

Standing rules:
- Every new function guarded by `assertFeatureEnabled` (C-OPS) and `requireBusinessAccess` (C-AUTHZ); pages 404
  with the flag off; schema changes are Codex's (request them).
- Every model call goes through the WP71 gateway action (`convex/ai/gatewayActions.ts`); fixture mode in tests.
- No `any`, no `console.log`, no inline styles. WCAG 2.1 AA; a11y-check on every changed screen.
- C-APPROVAL merges first so Codex can build WP78 publishing and WP79 sending against it.

## Stories

- [x] `WP77-S1` - Approvals and C-APPROVAL
  - Scope: `convex/workspace/approvals.ts`, tests.
  - `createApproval`, `decideApproval` (approve / request changes / cancel), expiry, and
    `assertApproved(ctx, approvalId, subject)` for Codex's publisher, sender and connectors. `assertApproved`
    re-checks that the approval is approved, belongs to the subject's business and owner, has the right kind,
    and still matches the subject's current version.
  - Acceptance: exactly-once decisions; stale or mismatched subject fails closed; owner-only; dormant.

- [ ] `WP77-S2` - Change rounds
  - Two free "Ask for changes" rounds per artifact (D17), then a credit card with the C-JOBS price; a `spend`
    approval before any debit; `PRICE_NOT_SET` actions cannot be bought.

- [ ] `WP77-S3` - Wren chat
  - Streaming by message deltas written to Convex; Haiku first, Sonnet for plan-changing turns, capped
    escalations; daily caps via C-LIMITS with a calm "tomorrow" card; approval clicks don't count against caps.

- [ ] `WP77-S4` - Wren's tools create cards only
  - Approval, explain and navigate cards. No tool sends, posts, spends or publishes (D13, D23). Prompt-injection
    corpus tests.

- [ ] `WP77-S5` - Memory and Files
  - Summary and facts in `wren_memory`; the Files page shows them; the founder can edit or delete a fact.

- [ ] `WP77-S6` - Accessibility
  - Live region for new messages, focus handling on cards, a11y-check, keyboard run-through.

## Out of scope

- Publishing, sending and posting themselves (Codex: WP78, WP79, WP83). Autopilot (later phase).
