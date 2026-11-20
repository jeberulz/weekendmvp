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

### 2026-11-20 - WP95-S1 to S6

- Actions taken:
  - `convex/feedback/{tables,entries,errors,admin}.ts` plus shared rules in `lib/feedback/contracts.ts`. `submit` and
    `report` are rate limited per owner by index count (10 feedback an hour, 30 errors a minute), not by the
    rate-limiter component, so no `convex/platform/limits.ts` change.
  - Browser side in `components/workspace/feedback/`: `FeedbackControl` and `FeedbackDialog` (native modal
    `<dialog>`, portalled to `body`), `clientErrors.ts` (registry plus `reportClientError`), `ErrorReporterMount`,
    `ReportingBoundary`, `WorkspacePageBoundary` and `WorkspaceCrash`, `WorkspaceFunnel`, `useAnalyticsReady`.
  - Wired into `WorkspaceFrame` and `WorkspaceSidebar` (button above the user row, page boundary around the page
    area, mount for the reporter), `WizardFlow` (header button, step and business events, boundary that re-throws to
    `app/start/error.tsx`), `ArtifactReviewCard` (review events, action errors), `WrenChatPanel` (first message,
    failed or stopped replies, send errors), and the launch retry and approval catch blocks.
  - `lib/track.ts`: `trackWorkspaceEvent`, `trackWorkspaceEventOnce`, `trackWorkspaceReturn`. Values must be short
    lowercase tokens, so free text cannot be forwarded.
  - `/admin/feedback` (Feedback and Errors tabs, own header, fixtures for `EDITORIAL_FIXTURE_MODE=local-demo`).
- Decisions made:
  - Workspace crashes show `WorkspaceCrash` inside the shell instead of falling to the root error page: the
    workspace had no `error.tsx`, so a render error used to lose the nav and chat. No new `app/` file was needed.
  - The wizard boundary re-throws, so `app/start/error.tsx` still shows its own message; neither `app/` error file
    was edited.
  - A failed Wren reply is reported from the browser (class `wren_failed` or `wren_stopped`, one row per message id).
  - Chat approval cards (send, post) are not funnel events: `review_approved` and `review_changes_asked` mean a
    launch piece's review card. The chat card's failures are error-logged.
  - Fixed on the way: `useExample` in `WizardFlow.tsx` broke `react-hooks/rules-of-hooks` on main; main fixed the
    same line (`applyExample`) while this branch was open, and the rebase kept main's.
- Checks run (after rebasing on `origin/main` at `84d31018` and regenerating `convex/_generated` with
  `convex codegen` against a disposable local backend):
  - `npm run typecheck`: clean.
  - `npm run lint`: 0 errors, 45 warnings (same 45 as main).
  - Targeted: `npx vitest run convex/feedback tests/platform/wp95-feedback.test.tsx tests/platform/wp95-track.test.ts`:
    16 + 17 + 8 tests passing.
  - `npm test`: every chained suite passes (convex 1,466, engine 1,114, editorial 298, home 82, admin-ai 27,
    prompts 24, platform 2,927, live 38, security 121, auth 199) except one local-only check:
    `check:ideabrowser-runtime` flags `.claude/skills/newsletter/`, a git-ignored folder that exists only in this
    checkout, so it is not in a clean clone or CI. Because `npm test` chains with `&&`, that stop skipped the
    last two suites, so `npm run test:platform` and `npm run test:live` were run on their own.
  - `npm run build`: passes. The first run compiled, then stopped on a Next.js security-advisory notice; the same
    command passed on retry. Upgrading Next.js is not part of this package.
  - Two things the full run found and this package fixed: `tests/security/env-documentation.test.mjs` wants every
    env key named in `.env.example` (added `NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA`), and four wizard suites queried
    `[aria-live]` or `[role=status]`, or expected the first Tab to reach the idea field. The control now reads the
    route when it opens (no router hook) and mounts its status line at first open; `wp74-keyboard.test.tsx` expects
    the header's Send feedback as the first stop.
- Local walkthrough (disposable local Convex on port 3510, Next dev on 3520, fixture AI mode, synthetic
  `@example.test` accounts, nothing near production). Screenshots in `docs/wp/evidence/wp95/`:
  1. `01-wizard-feedback-dialog.jpg`: the wizard header button and dialog.
  2. `02-workspace-shell-send-feedback.jpg`: the sidebar control on Team HQ with four launch pieces waiting.
  3. `03-workspace-feedback-dialog.jpg`: the dialog with a note and a rating of 5.
  4. `04-workspace-page-error-fallback.jpg`: a forced client error (a temporary throw, removed) replaced by the in-shell
     fallback; the error landed in `client_errors` as `TypeError`, `/dashboard/b/[id]/files`, `boundary`.
  5. `05-admin-feedback-tab.jpg` and `06-admin-errors-tab.jpg`: `/admin/feedback` read live from the local backend as
     the bound super admin.
  6. `07-mobile-feedback-dialog-375.jpg`: the dialog at 375px.
  Funnel events were observed through a `window.gtag` stub (consent was declined): `wizard_step_finished` for each of
  platform, commercial_model, goal, name, partner_personality and partner_name, `business_created`,
  `launch_piece_waiting` for blueprint, brand_kit, email_sequence and social_pack, `review_approved` (brand_kit),
  `review_changes_asked` (email_sequence) and `first_wren_message`. `wizard_step_finished` for the idea step is
  sent from the own-idea start (added after this run, covered by reading the code path only); the `blueprint` step
  came through only in the first pass because a hot reload cleared the stub mid-run.
- a11y-check (jstack:a11y-check, WCAG 2.1 AA), on the feedback control and `/admin/feedback`:
  - Icon-only close button has `aria-label`; icons are `aria-hidden`; every field has a label (rating is a
    fieldset with a legend and radios named "N out of 5"); no images; no external links.
  - Focus: visible rings on every control (`has-[:focus-visible]` on the rating labels); the native modal traps Tab,
    Escape closes it, focus returns to the button (checked in the browser at 375px too: the mobile menu panel stays
    open behind it, because the dialog stops the Escape from reaching the sidebar).
  - Headings: dialog h2 under the page h1; admin page one h1 then h2s. No inline `style` attributes.
  - In-browser script on both admin tabs at 1440px and 375px: one main, names on every control, no contrast failures
    (4.5:1, 3:1 for large text), no page-level horizontal scroll (wide tables scroll inside a focusable, labelled
    region). axe-core (jsdom) on the open dialog: no violations (colour contrast not computable in jsdom, covered by
    the browser script).
  - Not done: a VoiceOver pass.
- Result: S1 to S6 built. Waiting on Codex for the schema.
- Gotchas:
  - `window.gtag` appears only after consent and after the page is interactive, so once-only events retry through
    `useAnalyticsReady` instead of firing once at mount.
  - The funnel `workspace_return` records the visit day only once analytics is ready, so a visitor who never
    consents is never given a stored date.
  - A returnTo of `/admin/feedback` is not on the sign-in allowlist and falls back to `/dashboard`, same as
    `/admin/ai`.
- Next: Codex wires `feedbackTables` into the schema; the owner decides on the error tracker, on showing emails, and
  on linking `/admin/feedback` from the AI console (WP94 owns that file).

### CLAUDE.md line for the owner to add (not edited here)

> `convex/feedback/**`, `app/admin/feedback/**`, `components/workspace/feedback/**`, `lib/feedback/**` - the beta
> feedback loop (WP95). In-app feedback and a private error log go to Convex tables `feedback_entries` and
> `client_errors`, read only by the super admin at `/admin/feedback`. Never store chat text; errors keep route,
> business id and error class only. Funnel events go through `trackWorkspaceEvent` in `lib/track.ts`.
