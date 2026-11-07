# WP76 — Growth drafts: email, social, SEO, launch plan, ads

Lane: Claude (mid; crew pipeline parts high). Program: WP67 Launch Workspace, phase 2 (G2).
Source: `docs/plans/launch-workspace/04-build-plan.md` WP76; `02-architecture.md` §4 (`sequences`,
`sequence_steps`), §6.2 (launch workflow).
Owns: `convex/growth/drafts/**`, `convex/ai/prompts/{email,social,seo,plan,ads}*`, workspace pages for Email,
Social, SEO, Launch plan, Tasks and Ads (drafts). It also flips its own slots in the WP75 launch registry
(`convex/crew/steps.ts`, `pending_wp76` → `built`) and adds each generator to `convex/crew/generators.ts`.
Depends on: WP75-S2a runner and S2b DAG (merged, #216 and #239), C-ART (`lib/workspace/contracts/artifacts.ts`),
C-APPROVAL (WP77-S1), C-CONNECT (`convex/growth/connectors/types.ts`, Codex). Codex's WP79 (tenant email) reads
S1's draft contract below.

Definition of done (`04` WP76 acceptance): every growth artifact exists as an approvable draft for HydroTrail, and
nothing sends or posts.

Standing rules (same as WP75):
- Ship dormant: every public function calls `assertFeatureEnabled` and `requireBusinessAccess`; crew actions are
  internal and start from a mutation that already authorised the caller.
- Every model call goes through the WP71 gateway with the C-METER `job` attempt key. Fixture mode in every test.
- The model never writes HTML or URLs. Founder text and seeds are data blocks, never instructions.
- Every stored artifact is parsed with its C-ART schema and written through `assertGeneratedDocumentBody`.
- New prompt specs are registered in `convex/ai/prompts/index.ts` and locked (`npm run check:prompt-versions`).
- Schema, `package.json`, crons, `convex/platform/**`, `convex/growth/{email,connectors}/**`, `middleware.ts` are
  Codex's: requests go under "Needs from Codex" in the progress file.
- No `any`, no `console.log`, no inline styles. WCAG 2.1 AA; a11y-check on every changed screen.
- One reviewable commit per story (about 1,500 lines at most).

## Story map

| Plan story | Split | Why split |
|---|---|---|
| S1 email sequence | S1a generator and draft rows, S1b Email page | Backend and the review page are each a full review |
| S2 social pack | S2 | One call, one page |
| S3 SEO pack and article | S3 | Needs the DataForSEO record read; may need a Codex table |
| S4 launch plan | S4 | Approve-all needs one approval per item |
| S5 ads drafts | S5 | Deterministic readiness checks only |
| S6 Tasks page | S6 | Read-only page and a11y pass |

## Stories

### WP76-S1a — Email sequence draft (generator and rows)

Goal: the launch writes a 4-email waitlist sequence as a draft the founder can review, and the rows WP79 will
later activate.

- Prompt `emailSequence.v1` (`convex/ai/prompts/emailSequence.v1.ts`), `draft` tier, registered and locked.
  Output: C-ART `emailSequenceSchema` (welcome at 0 hours, then value, offer, follow-up; `{first name}` the only
  merge tag; no URLs; CTAs by target `site` / `waitlist` / `reply`). Inputs, server-built: the business blueprint
  the launch uses (the approved one, else the launch's own first draft under the S2b ruling), the brand kit's voice
  and name, and the founder's wizard answers as data blocks.
- Launch registry: `email_sequence` becomes `built` with `runner: "generator"`. Its parent becomes `brand_kit`
  (it already lists the brand kit as an input, and `02` §6.2 draws it under the brand kit branch), so it runs only
  after the kit is done and never without its voice.
- Finish (one transaction, through the S2a runner's `finishCrewStep` path): the `email_sequence` document, the task,
  the employee status and the `artifact_review` card, as every crew artifact does; plus the draft rows below.
- Draft contract for WP79 (documented in the progress file and a pure helper in `lib/workspace/growth/`):
  - `sequences`: the business has at most one crew `draft` sequence. The finish inserts it, or updates it in place
    while it is still `draft`. `title` is the sequence `name`.
  - `sequence_steps`: four rows, `order` 0–3 in `EMAIL_KINDS` order, `delayHours` and `subject` copied from the
    email, `documentId` the `email_sequence` document. A step's full content is
    `emailsInOrder(parse(document.body))[order]`; the helper returns it and fails closed when the stored subject or
    delay does not match the document.
  - A revision (change round) rewrites the draft sequence's steps to the new document in the same transaction. A
    sequence that is no longer `draft` (Codex owns `approved` / `active` / `paused`) is never touched: the
    revision gets a new `draft` sequence instead.
  - More than one crew `draft` sequence for a business fails closed (no write, the step fails as permanent).
  - Nothing sends; no `send` approval is created here (WP79 activates).
- Reads: an owner-only query for the Email page (sequence status, the four emails in order, the card state). No ids
  beyond what the page needs.
- Tests (convex-test, fixture mode): HydroTrail launch produces the document, one draft sequence and four steps in
  order; the step runs only after the brand kit; a refusal or invalid output writes nothing; replay is idempotent;
  a revision repoints the steps; a non-draft sequence is left alone; two draft sequences fail closed; the query
  refuses another owner, the workspace off and AI off; the helper rejects a mismatched step.

Done when: the HydroTrail fixture launch shows a draft email sequence with four ordered steps and one
`artifact_review` card, nothing sends, and the full gate passes.

### WP76-S1b — Email page

Goal: on `/dashboard/b/{projectId}/email` the founder reads the crew's four emails and approves the sequence draft or
asks for changes. No send button and no send settings: WP79 activates sending later.

- Replaces the route placeholder (`app/(launch-workspace)/dashboard/b/[projectId]/email/page.tsx`). Server page
  gated by `requireWorkspaceAccess` (404 with the flag off), same header pattern as the Files page; a client panel
  reads S1a's `api.growth.drafts.emailSequence.emailSequenceDraft`.
- States: loading; `none` ("Your email sequence is on its way. Your team writes it after your brand kit.");
  `unavailable` (calm copy, no detail, no retry); `ready`.
- `ready` shows the sequence name, the sender name and the status in words (draft, approved, active, paused), then
  the four emails in order. Each email shows its kind as a plain label (Welcome, Value, Offer, Follow-up), when it
  goes ("As soon as someone confirms", then "N hours after the previous email" / days when whole), the subject,
  the preview text, the body as plain text with paragraphs kept (never as HTML or markdown), the CTA label and
  where it goes in words (your site / your waitlist / a reply), and the goal. `{first name}` shows as a visible
  token, never filled in.
- The card: while the newest `artifact_review` card is pending (and not past `expiresAt`), Approve and Ask for
  changes. Ask for changes opens a labelled text field for the founder's note and sends
  `decideApproval({ decision: "request_changes", note })`; Approve sends `decision: "approve"`. Reuse the WP77 kit
  (`components/workspace/kit` approval styles and the chat card's decision copy, focus return and live region
  pattern in `components/workspace/chat/WrenChatCards.tsx`) rather than new patterns. Other card states show their
  status in words. A paid change round surfaces the server's answer as it does in chat; no credit UI is built here.
- Never shows ids, raw statuses or internal reasons. All text from the server is rendered as text nodes.
- a11y: one h1 (the route label), h2 for the sequence, h3 per email; the email list is an ordered list; the note
  field has a visible label and its error is tied with `aria-describedby`; buttons stay focusable while a decision
  is in flight (`aria-disabled`); focus returns to the card's status line after a decision; a polite live region
  carries the outcome; colour is never the only signal. Run the a11y-check skill.
- Tests (`tests/platform/`, Testing Library, the query and mutation mocked like the existing workspace panel
  tests): each state renders; the four emails in order with the delay wording; body text is not parsed as HTML;
  approve and ask-for-changes call the mutation with the right arguments; an empty note is refused before sending;
  focus and live-region behaviour; a non-pending card shows no buttons; an expired pending card shows no buttons.

Done when: the HydroTrail fixture state renders the four emails with a working approve / ask-for-changes card, the
page 404s with the flag off, a11y-check passes and the full gate passes.

### WP76-S2 to S6

Planned in `04`; detailed before each starts.
