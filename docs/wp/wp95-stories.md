# WP95 Stories - Beta feedback loop

Branch: `claude/wp95-feedback-loop-b1b359`
Lane: Work Package
Registry: `docs/PROJECT_STRATEGY.md`
Definition of done: `npm run typecheck`, `npm run lint`, `npm test` and `npm run build` green; a11y-check passed on the
feedback control and the admin page; screenshots from the local fixture backend; the Codex schema need written down in
`docs/wp/wp95-progress.md` and the PR.

## Why

L1 is invite-only and the owner is adding testers, but cannot learn from them. There is no way to send a note from the
app, no record of what broke for a founder (no Sentry or similar), and GA4 fires only on the build CTAs. WP95 gives the
owner three things: feedback with automatic context, a private error log, and funnel events for the core loop.

## Rules this package holds to

- **Privacy.** Feedback context is route, business id, launch step states and build version. Never chat text, business
  names, idea text or any other content. Error records are route, business id and error class only: never a message,
  stack or URL query. Funnel events carry enums and counts only: no free text, email or idea content.
- **No third party.** Errors land in Convex. A hosted tracker is a recommendation for the owner, written up in the
  progress file, not a dependency.
- **Server derives identity.** `ownerId` comes from the session, never from an argument. A `projectId` is accepted only
  if the caller owns it.
- **Owner-only reads.** Every admin read starts with `requireSuperAdmin`, and the page checks again on the server.
- **Consent-gated analytics.** Funnel events go through `lib/track.ts`; with no consent there is no `window.gtag`, so
  nothing is sent and nothing is marked as sent.
- **Schema is Codex's.** New tables are specified in `docs/wp/wp95-progress.md` ("Codex need"). The code is built and
  tested against them; the PR waits on Codex for the schema.

## Stories

- [ ] `WP95-S1` - Convex feedback and error modules
  - Scope: `convex/feedback/**` (tables definition, `submit`, `reportError`, owner-only reads), tests in
    `convex/feedback/*.test.ts`.
  - Acceptance criteria:
    - `feedback.submit` stores a note (1 to 1,000 characters after trimming), an optional integer rating 1 to 5, the
      surface (`workspace` or `wizard`), a sanitised route, build version, the owner id from the session, an optional
      owned business id and a bounded list of launch step states.
    - A caller who does not own the business id gets the same refusal as any missing business; nothing is stored.
    - Signed-out callers cannot submit. Feedback is rate limited per owner.
    - `feedback.reportError` never throws to the client. It stores source, error class, sanitised route, optional owned
      business id and build version, drops anything that does not look like an error class, de-duplicates a repeat
      within a short window and caps rows per owner per minute.
    - Every admin read (`listFeedback`, `listErrors`, `summary`) throws `FORBIDDEN` for anyone but the bound super
      admin, is paginated or bounded, and returns no chat text because none is ever stored.
  - Verification:
    - `npx vitest run convex/feedback`

- [ ] `WP95-S2` - "Send feedback" control in the workspace shell and the wizard
  - Scope: `components/workspace/feedback/**`, `components/workspace/shell/WorkspaceFrame.tsx`,
    `components/workspace/wizard/WizardFlow.tsx`, helper code under `lib/feedback/**`.
  - Acceptance criteria:
    - A "Send feedback" button is in the workspace sidebar and in the wizard header. It opens an accessible dialog with
      a note field (limit shown), an optional 1 to 5 rating and Send / Cancel.
    - The dialog says what is attached (page, business, launch step progress, app version) and that chat is never sent.
    - The control attaches route, business id, launch step states (workspace only) and build version automatically.
    - Focus moves into the dialog, Tab stays inside, Escape closes it, focus returns to the button. After sending, a
      polite status line says it was sent and the dialog closes.
    - A failure keeps the note and says so in words.
  - Verification:
    - `npx vitest run tests/platform` (control logic) and the a11y-check skill in a real browser.

- [ ] `WP95-S3` - Error capture
  - Scope: `app/start/error.tsx`, new `app/(launch-workspace)/dashboard/b/[projectId]/error.tsx`,
    `components/workspace/feedback/useReportError.ts`, `components/workspace/chat/WrenChatPanel.tsx`, the founder-facing
    action catch blocks in `components/workspace/**`.
  - Acceptance criteria:
    - A client error that reaches a route error boundary is reported once with route, business id and error class.
    - A Convex action the founder sees fail (review decision, chat send or retry, wizard step or create business) is
      reported with the error class only (a `ConvexError` code, else the error name).
    - A Wren reply that ends as "couldn't finish" or "stopped partway" is reported once per message.
    - Reporting never blocks the founder's flow and never surfaces its own failure.
  - Verification:
    - `npx vitest run tests/platform`, plus a forced error in the browser.

- [ ] `WP95-S4` - Funnel events through `lib/track.ts`
  - Scope: `lib/track.ts`, `components/workspace/**` call sites.
  - Acceptance criteria:
    - New `trackWorkspaceEvent` with an allowlist of props per event, like `trackDashboardEvent`.
    - Events: `wizard_step_finished` (step name), `business_created`, `launch_piece_waiting` (piece, once per
      business and piece), `review_approved`, `review_changes_asked` (piece), `first_wren_message` (once per business),
      `workspace_return` (a day bucket, once per UTC day on a later day).
    - Once-only events are remembered in `localStorage` only when GA actually received them, so a visit before consent
      does not use up the one shot. Storage failures never throw.
    - No event carries free text, an email, a name or idea content.
  - Verification:
    - `npx vitest run tests/platform`

- [ ] `WP95-S5` - Owner-only `/admin/feedback`
  - Scope: `app/admin/feedback/**` (layout, page, simple admin header, two tabs), `lib/feedback/admin*`.
  - Acceptance criteria:
    - `/admin/feedback` lists feedback newest first (rating, note, route, business id, step states, version, owner id,
      time). `/admin/feedback?tab=errors` lists errors with counts by class and by route.
    - The page 404s for everyone but the bound super admin (middleware plus the server read). It is `noindex` and
      has its own simple header, not the AI console's.
    - Local `EDITORIAL_FIXTURE_MODE=local-demo` shows fictional data, like `/admin/ai`.
    - Reads are bounded and the page says when a list is cut off.
  - Verification:
    - `npx vitest run tests/platform`, a11y-check, screenshots.

- [ ] `WP95-S6` - Docs, error-tracker recommendation, handoff
  - Scope: `docs/wp/wp95-*`.
  - Acceptance criteria:
    - The Codex schema need is in the progress file and the PR with exact table definitions and indexes.
    - A short, honest write-up of hosted error trackers for the owner to decide.
    - `CLAUDE.md` is not edited (not this session's file). The line it should gain is in the progress file.
  - Verification:
    - `git diff --check`

## Out Of Scope

- Replying to feedback from the admin page, marking it handled, or emailing testers.
- Showing tester emails or names on `/admin/feedback` (owner id only; see progress file for the decision).
- Server-side capture of failed crew steps and launch failures (those already live in Convex tables; a later pass can
  join them into the error tab).
- Any third-party SDK, session replay or screenshot capture.
- `/admin/ai` and its components (WP94), settings, privacy and account deletion (WP96).
- Linking `/admin/feedback` from the AI console. The owner links the pages later.

## Notes

- Promote unknown product decisions to `docs/wp/RULINGS.md`.
- Another session may be editing the same checkout area; commit early.
