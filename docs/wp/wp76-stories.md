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

The founder reviews the four emails (subject, preview, body, CTA label, delay, goal), sees the card state and can
approve or ask for changes through WP77's existing card actions. Read-only otherwise; no send button. a11y-check.

### WP76-S2 to S6

Planned in `04`; detailed before each starts.
