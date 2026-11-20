# WP95 Progress - Beta feedback loop

Append-only progress log. Do not rely on chat history for project state.

## 2026-11-20 - Setup

- Branch/worktree: `claude/wp95-feedback-loop-b1b359`, worktree `.claude/worktrees/wp95-feedback-loop-b1b359`. Started
  from `013fdf23`.
- Assignment: build WP95 (feedback loop for the L1 beta). WP94 (tester panel inside `/admin/ai`) and WP96 (privacy and
  account deletion) run in parallel sessions.
- File boundaries:
  - Owned: `components/workspace/**`, `lib/track.ts`, `app/admin/feedback/**`, `convex/feedback/**`, `docs/wp/wp95-*`.
  - New, same purpose: `lib/feedback/**` (pure helpers shared by the control, the page and the tests). Added because
    the rules name no home for shared helpers; nothing else uses that directory.
  - Small edits outside the owned list, both inside the workspace and wizard surfaces the brief assigns: `app/start/error.tsx`
    (reports the error) and a new `app/(launch-workspace)/dashboard/b/[projectId]/error.tsx` (the workspace had no
    boundary of its own).
  - Not touched: `components/admin/ai-costs/*`, `app/admin/ai/**`, `app/dashboard/settings/**`, `convex/account/**`,
    privacy and terms pages, `CLAUDE.md`, `AGENTS*`, `package.json` scripts, `docs/wp/l1-release-plan.md`.
  - Codex-owned: `convex/schema*`, `convex/crons.ts`, http and middleware. See "Codex need" below.
- Required checks: `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`, a11y-check.
- Initial risks:
  - New tables are a schema change, which is Codex's (one writer per merge window).
  - The workspace shell is shared by every workspace page; the control must not shift layout or add a landmark.
  - GA events must stay consent-gated and carry no content.

## Codex need - schema (exact definitions)

Two new tables. They are defined once in `convex/feedback/tables.ts` (exported as `feedbackTables`), so Codex only has
to spread them into the schema:

```ts
// convex/schema.ts
import { feedbackTables } from "./feedback/tables";
// ...inside defineSchema({ ... })
  ...feedbackTables,
```

What `feedbackTables` contains, for review:

```ts
feedback_entries: defineTable({
  ownerId: v.id("users"),                       // derived from the session, never an argument
  projectId: v.optional(v.id("projects")),      // only if the caller owns it
  surface: v.union(v.literal("workspace"), v.literal("wizard")),
  note: v.string(),                             // founder-written, 1..1000 chars after trim
  rating: v.optional(v.number()),               // integer 1..5
  route: v.string(),                            // pattern with the business id masked, e.g. /dashboard/b/[id]/email
  stepStates: v.array(v.object({ key: v.string(), state: v.string() })), // launch steps, at most 16, [a-z_] only
  buildVersion: v.string(),                     // short commit sha or "dev"
  createdAt: v.number(),
})
  .index("by_createdAt", ["createdAt"])
  .index("by_ownerId_and_createdAt", ["ownerId", "createdAt"]),

client_errors: defineTable({
  ownerId: v.id("users"),
  projectId: v.optional(v.id("projects")),
  source: v.union(v.literal("boundary"), v.literal("action"), v.literal("wren")),
  errorClass: v.string(),                       // ConvexError code or Error name, /^[A-Za-z0-9_.:-]{1,64}$/
  route: v.string(),
  buildVersion: v.string(),
  dedupeKey: v.optional(v.string()),            // e.g. the Wren message id: one row per key
  createdAt: v.number(),
})
  .index("by_createdAt", ["createdAt"])
  .index("by_ownerId_and_createdAt", ["ownerId", "createdAt"])
  .index("by_ownerId_and_dedupeKey", ["ownerId", "dedupeKey"]),
```

No data migration, no backfill, additive only. Both tables start empty. `feedback_entries` has no chat text by
construction: the only free text is the note the founder types into the feedback dialog.

**State of the branch.** To run typecheck, tests and the local backend, this branch carries the one-line wiring in
`convex/schema.ts` as its own commit (`chore(wp95): wire feedbackTables into the schema (stand-in for Codex)`). It is a
stand-in: Codex either takes that commit or makes the same change in its schema window and this commit is dropped.
**Until then the PR must not merge.**

## 2026-11-20 - Error tracking: recommendation for the owner (no decision taken)

What WP95 ships is a private, Convex-backed log: route, business id and error class, three sources (route boundary,
failed action the founder saw, Wren "couldn't finish"). It tells the owner that something broke and where, not why.
It has no stack traces, no source maps, no grouping across releases and no alerts.

If the owner wants more once the beta grows, the options, cheapest first:

1. **Do nothing yet.** Right for the first cohort. The tab plus `npx convex logs` covers a handful of testers.
2. **Vercel's own runtime logs and observability.** Already in the stack. Server errors only; client errors in the
   browser stay invisible. No new vendor, no consent question.
3. **Sentry (or a similar hosted tracker).** The usual answer: stack traces with source maps, release tracking, alerts,
   grouping. Costs: a new vendor and SDK in the client bundle, a privacy review (it captures URLs, and optionally
   replays, so it needs scrubbing rules and a mention in the privacy page, which is WP96's), and a decision about
   consent, because the site's analytics are consent-gated and an error tracker is not analytics but is still
   third-party processing. Start with errors only: no replay, no performance tracing, `sendDefaultPii` off.
4. **PostHog or similar product analytics plus errors.** Bigger scope than this package asks for. Worth it only if the
   owner wants funnels and session replay in one place instead of GA4.

Recommendation: keep WP95's log for the L1 beta, and add Sentry's free tier, errors only, before L2 opens to people the
owner does not know. That is the point where a tester will not message the owner about a broken page.

## Decisions

- **Owner id only on the admin page.** The brief says feedback is stored "with the owner id". The page shows that id,
  not an email or a name. Showing the email so the owner can reply is a one-line change in `convex/feedback/admin.ts`,
  and an owner call because it puts a tester's email on a screen. Not done.
- **Step states are sent by the client**, read from the same `launchProgress` query the workspace pages already show,
  and sanitised on the server (known character set, at most 16 entries). The server does not re-derive them, because
  the launch read needs the feature flags and the roster and is a query; it would couple this package to `convex/crew`
  internals for context that only the sender's own business can affect.
- **Wren failures are reported from the browser**, once per message id, because `convex/workspace/**` is not this
  package's. A reply that failed while nobody had the chat open is not recorded; the Wren message row still is.
- **`app/dashboard/error.tsx` (the legacy library page) is not instrumented.** It is outside the workspace and wizard.

## Funnel events (GA4, consent-gated)

| Event | Props (enums and counts only) | When |
|---|---|---|
| `wizard_step_finished` | `step` | The wizard moves forward one step (never on Back) |
| `business_created` | `source` (`library` or `own_idea`) | `createBusiness` returns |
| `launch_piece_waiting` | `piece` | A launch piece's review first shows "Waiting on you"; once per business and piece |
| `review_approved` | `piece` | The founder approves a review card |
| `review_changes_asked` | `piece` | The founder sends "Ask for changes" |
| `first_wren_message` | none | The first message a founder sends to Wren in a business; once per business |
| `workspace_return` | `days_away` (`1`, `2_6`, `7_plus`) | The workspace opens on a later UTC day than the last visit; once per day |

Once-only events are remembered in `localStorage` (try/catch around every access) and only after GA accepted the event.

## Log

(Entries are appended below as stories finish.)
