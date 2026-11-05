# Launch Workspace — architecture

**Status:** Ruled 2026-11-05. Read `01-strategy.md` and `06-decisions.md` first. Every
decision except D10 was approved as recommended, so every "we will" here is ruled; the
D-numbers show where each one comes from.

This document is grounded in a read-only survey of the repository on 2026-11-05
(branch `cursor/live-pages-21f5` at `a8a49e74`, and `origin/main` at `9dcb3f81`). File
references are to that tree. **Before writing code, every lane re-reads the files it
touches.** The repo moves daily.

---

## 1. Principles

1. **Merges deploy production.** `scripts/vercel-build.mjs` runs `convex deploy` before
   `next build`, so a merge to `main` changes the live backend (`first-squirrel-244`).
   Everything ships dormant: schema changes are additive only, new functions refuse
   to run until `ops_settings` turns them on, and new pages 404 while their flag is off.
2. **Reuse before adding.** The WP22 platform tables, the WP24 ledger, the WP64
   membership webhook, the rate limiter and the engine's provider adapters are
   built and tested. This program extends them (D19); it does not fork them.
3. **Convex is the system of record.** Every model call, credit movement, approval,
   send and publish is written to Convex, by Convex code. Next.js routes exist only
   where an outside service has to call us (Stripe and Resend webhooks, tenant hosts).
4. **Spend fails closed.** If a budget, the kill switch, an approval or a key is
   missing, the call does not run and nothing is charged.
5. **Nothing leaves without an approved approval.** Sends, posts, publishes, ad
   launches and credit spends each need an `approvals` row in state `approved`. The
   row is checked again in the same transaction as the action.
6. **Every model call is metered.** No call bypasses the gateway. A CI check fails
   the build if provider SDKs are imported outside `convex/ai/providers/`.
7. **Owner-only until D12 changes it.** Every new row carries `ownerId` and the
   business's `projectId`. Reads go through the existing ownership helpers, which
   answer `RESOURCE_NOT_FOUND` for "not yours" and "doesn't exist" alike.

## 2. What exists today (survey summary)

| Area | Where | State | We use it for |
|---|---|---|---|
| Auth | `convex/auth.ts`, `convex/authUser.ts`, `convex/platform/authz.ts` (`requirePlatformUser`, `requireOwnedProject`, `requireOwnedProjectChild`, `requireOwnedAccountRecord`) | Live | Every workspace function. |
| Super admin | `convex/admin/superAdmin.ts` (`requireSuperAdmin`) | Live | Ops console, kill switches. |
| Membership billing | `app/api/platform/membership/{checkout,portal,webhook,reconcile}`, `convex/platform/membership/{provider,events,checkout,state,planResolver}.ts`, tables `billing_customers`, `plan_subscriptions`, `membership_orders`, `plan_grants`, `founding_seats`, `billing_events` | **Live** (WP64, Managed Payments) | Growth plan, monthly credit grants. |
| Entitlements | `convex/platform/{plans,entitlements}.ts` (`PLAN_LIMITS`, `getEntitlements`, `requireFeature`, `UPGRADE_REQUIRED`) | Live | Workspace limits per plan. |
| Credit ledger | `convex/platform/billing/ledger.ts` (`applyLedgerDelta`, `debitTask`, `refundFailedTask`), tables `credit_accounts`, `credit_ledger` (append-only) | Built, tested (`billing.test.ts:318`), **called by nothing**, test mode only | Ledger v2 (§7). |
| Credit packs | `convex/platform/billing/{catalog,checkout,events}.ts`, `app/api/platform/billing/*` | Dormant, `cs_test_` hard-coded, ruling R9 | Not used (D20). |
| Platform data | `projects`, `tasks`, `task_steps`, `workflow_runs`, `documents`, `document_citations`, `site_configs`, `site_versions`, `leads`, `audit_events` | Frozen WP22 contract; nothing on `main` writes `tasks` or `workflow_runs` | Business, crew jobs, artifacts, landing page (D19). |
| Site publishing | `convex/platform/sites/{publish,read,leads}.ts`, `middleware.ts:360–402` (tenant rewrite to `/site/[slug]`, `/__lead`), `lib/tenant-host.ts` (`RESERVED_SUBDOMAINS`), `lib/tenant-publish-check.ts` (fails open) | Built, parked by WP44 R5 | Generated landing page (D2). |
| Rate limiter | `@convex-dev/rate-limiter` mounted in `convex/convex.config.ts` | Live | Chat caps, job starts, publishes. |
| Durable jobs | `@convex-dev/workflow` 0.4.4 and `@convex-dev/workpool` 0.4.7 in `package.json` | **Installed, not mounted** | Crew pipelines (D21). |
| Crons | `convex/crons.ts` (one job: editorial recover, every minute); `vercel.json` (membership reconcile 04:17, live reconcile 04:23) | Live | New jobs listed in §12. |
| Model calls | `lib/engine/providers/*` (OpenAI Responses, Perplexity, DataForSEO, source reader), `lib/og/providers/*` (Recraft, OpenAI Images) | **Local CLI only.** No hosted code calls a model | Adapter patterns, rate cards, micro-USD maths. |
| Cost maths | `lib/engine/cost.ts` (integer micro-USD, round up, `worstCaseMicroUsd`, `assertWithinCap`), `lib/engine/providers/pricing.ts` (dated rate cards) | Pure helpers | Gateway reserve/settle (§5). |
| Engine on Convex (reference) | Branch `codex/wp26-v1.1-engine` (`c99351bb`): Workflow manager, `retry:false` on `runAction`, failure classification, `onComplete` settlement, cost in `audit_events` | **Unmerged, old base, conflicts** | Patterns to port, not code to merge. |
| Dashboard | `app/dashboard/*`, `WorkspaceShell`, `components/platform/shell/workspace-current.ts` (nav), `components/platform/{billing,plan,builds,home,…}` | Live | Shell gains a business switcher and credit meter. |
| Tests | vitest 4 (`edge-runtime`), `convex-test` 0.0.54 in ~46 files, `node --test` suites, `tests/security/*`; CI: audit, typecheck, lint, test, idea tags, build, server traces | Live | Every WP adds tests in the same style. |

**Two traps the survey found:**

- `convex/convex.config.ts` declares a typed `env` block, and some entries are
  required (for example `PLATFORM_BILLING_BRIDGE_SECRET`). **A new required entry
  would block the next production deploy until it is set.** Every new env var in this
  program is declared optional, and the code that needs it fails closed when it is
  missing.
- Table validators must stay flat objects, because `convex/referenceTables.ts` reads
  `.fields` from them. Nested `v.object(...)` *fields* are fine; a table defined as a
  union is not.

## 3. Target shape

```
Browser (Next.js App Router)
  /ideas/{slug} ─ "Build this idea, free" ─► /start/{slug} (wizard, 8 steps)
  /dashboard/b/{projectId}/…  (workspace: Team HQ, plan, brand, site, build pack,
                               tasks, files, studio, email, social, ads, settings)
     │  Convex React: useQuery (live status, chat deltas) · useMutation
     ▼
Convex (first-squirrel-244)
  convex/workspace/*   business, wizard, roster, approvals, chat, launch plan, files
  convex/crew/*        role catalogue, generators, launch workflow (workflow + workpool)
  convex/ai/*          gateway ("use node"), router, prompt registry, providers,
                       metering, budgets, evals fixtures
  convex/studio/*      image and video jobs, provider job polling
  convex/growth/*      email sequences + sender, social posts, ads, outbound
  convex/platform/*    existing: authz, plans, entitlements, billing ledger (v2),
                       membership (+ grants), sites (+ WP30 gate)
  components:          rate-limiter (mounted) + workflow, workpool, sharded-counter,
                       resend (tenant mail)
     │
     ├─► Anthropic (crew text, chat)      ├─► OpenAI Images / Recraft (images)
     ├─► video provider (Studio)          ├─► Resend tenant project (D6)
     └─► Meta Graph / Ads (Phase 5, flagged)

Next.js routes that outside services call:
  /api/platform/membership/webhook (existing; gains invoice.paid → credit grant)
  {slug}.weekendmvp.app → middleware rewrite → /site/[slug] (existing) → LandingSpec renderer
  /__lead (existing; gains consent fields)      /u/{token} (unsubscribe, new)
  Convex http.ts: /resend/webhook (delivery events, new)
```

## 4. Data model

### 4.1 Reused WP22 tables, amended additively (D19)

| Table | Becomes | Additive change |
|---|---|---|
| `projects` | **The business.** One row per business; the UI never says "project". | Optional `workspace` object: `{ version: 1, name, slug, ideaSlug?, ownIdeaText?, platform, commercialModel, goal, partner: { personality, name }, wizardSessionId, createdVia: "wizard" }`. Index `by_ownerId_and_workspaceSlug` if the existing indexes don't cover the slug lookup. The existing `source`, `status`, `idempotencyKey` and `sourceIdea` fields keep their meaning. |
| `tasks` | **A crew job** (one generation, revision or Studio render). | New `type` literals: `crew_blueprint`, `crew_roster`, `crew_brand_kit`, `crew_landing`, `crew_email_sequence`, `crew_social_pack`, `crew_seo_pack`, `crew_launch_plan`, `crew_ads_drafts`, `crew_build_pack`, `crew_hire`, `studio_image`, `studio_video`. Optional fields: `employeeKey`, `creditCost` (int64, 0 for free work), `changeRound` (0–n), `revisionOfTaskId`, `approvalId`, `jobKey` (idempotency). |
| `task_steps`, `workflow_runs` | Step and run tracking for crew workflows. | New step types matching the job types. No other change. |
| `documents` | **Every text artifact**, versioned: blueprint, brand kit, landing spec, email sequence, social pack, SEO pack and article, launch plan, ads drafts, build pack. | New `kind` literals for each. Optional `supersedesDocumentId`, `schemaVersion`, `promptRef` (`id@version`). The existing 256 KiB cap holds; nothing we generate comes close. |
| `site_configs`, `site_versions` | The generated landing page and its published versions. | A version stores a validated `LandingSpec` (JSON) instead of free HTML. `site_configs` gains `takedownAt?`, `takedownReason?`. |
| `leads` | Waitlist signups. | Real capture only after D5: `consentText`, `consentVersion`, `doubleOptInAt?`, `unsubscribedAt?`, `deletedAt?`, `source`. Synthetic-only rule stays until then. |
| `credit_accounts`, `credit_ledger` | Ledger v2 (§7). | Account: `allowanceRemaining`, `allowancePeriodEnd`. Ledger: new reasons `plan_grant`, `starter_grant`, `allowance_expiry`; optional `bucket` (`allowance` / `bonus`) and `bucketSplit` on debits. |
| `audit_events` | Security log for publish, takedown, approvals that send or spend, Autopilot toggles, kill switches. | New event types only. **Not** used for usage or cost (it requires an owner and has no cost columns). |

These amendments change WP22's closed unions, so they need the D19 ruling before the
schema PR lands.

### 4.2 New tables

All new tables carry `ownerId` and, where they belong to a business, `projectId`.
Names follow the repo's snake_case. "Writer" is the lane whose code writes the table
(`05-lanes-codex-claude.md`); the schema file itself has one owner (Codex).

| Table | Purpose and key fields | Indexes | Writer | Phase |
|---|---|---|---|---|
| `wizard_sessions` | One wizard run: `ideaSlug` or `ownIdeaText`, `step`, `answers` object, `startedAt`, `completedAt?`, `abandonedAt?`, `projectId?` | `by_ownerId_and_updatedAt` | Claude | 2 |
| `founder_signals` | Insert-only: `wizardSessionId`, `projectId?`, `step`, `action` (`kept` / `changed` / `skipped` / `rewrote`), short `before` / `after` | `by_ownerId_and_createdAt`, `by_step_and_action` | Claude | 2 |
| `roster_plans` | Why the team looks the way it does: `rulesVersion`, `hired[]`, `skipped[{ roleKey, reason }]` | `by_projectId` | Claude | 2 |
| `crew_members` | One employee: `roleKey`, `displayName`, `status` (`queued` / `working` / `needs_you` / `done` / `skipped`), `hiredBy` (`rule` / `founder`), `autopilot` (bool, default false) | `by_projectId_and_roleKey` | Claude | 2 |
| `workstreams` | An employee's current work: `title`, `status`, `blocker?`, `askApprovalId?`, `documentIds[]`, `fileIds[]` | `by_projectId_and_employeeId` | Claude | 2 |
| `launch_plan_items` | Weekend plan rows: `ownerEmployeeId`, `title`, `day` (thu–mon), `order`, `status`, `approvalId?` | `by_projectId_and_order` | Claude | 2 |
| `approvals` | The only gate for side effects: `kind` (`artifact_review` / `send` / `post` / `publish` / `spend` / `ad_launch` / `upgrade`), `subjectTable` + `subjectId`, `status` (`pending` / `approved` / `changes_requested` / `expired` / `cancelled`), `changeRound`, `costCredits?`, `note?`, `decidedAt?` | `by_projectId_and_status`, `by_subjectId` | Claude (create, decide); Codex reads before every send, post, publish and ad launch | 2 |
| `chat_messages` | Wren's thread: `author` (`wren` / `founder` / `system`), `body`, `status` (`streaming` / `done` / `failed`), `cardApprovalIds[]`, `usageId?` | `by_projectId_and_createdAt` | Claude | 2 |
| `wren_memory` | "What Wren knows": short facts list plus a rolling summary, so chat context stays small | `by_projectId` | Claude | 2 |
| `business_files` | Convex storage objects: `storageId`, `kind` (`logo` / `hero` / `offer_image` / `post_image` / `video` / `upload`), `mime`, `bytes`, `alt` (required for images), `sourceTaskId?` | `by_projectId_and_kind` | Claude | 2 |
| `provider_jobs` | Long-running provider renders (video, some images): `taskId`, `provider`, `externalId`, `status`, `pollAfter`, `attempts` | `by_status_and_pollAfter` | Claude | 4 |
| `idea_crew_seeds` | Per-idea precomputed material (§5.6): `ideaSlug`, `seedVersion`, `blueprint`, `brandSeeds`, `landingSeeds`, `emailAngles`, `socialAngles`, `buildPackSeeds`, `promptRefs` | `by_ideaSlug_and_seedVersion` | Claude | 1 |
| `ai_usage` | Insert-then-settle, never deleted: `ownerId?`, `projectId?`, `taskId?`, `promptRef`, `provider`, `model`, `tier`, `status` (`reserved` / `settled` / `failed`), `reservedMicroUsd`, `costMicroUsd`, `inputTokens`, `cacheReadTokens`, `cacheWriteTokens`, `outputTokens`, `images?`, `videoSeconds?`, `estimated` (bool), `latencyMs`, `stopReason?` | `by_ownerId_and_createdAt`, `by_status_and_createdAt`, `by_projectId_and_createdAt` | Codex (mutations), called by Claude's gateway | 1 |
| `ai_budgets` | Per owner: `freeLifetimeSpentMicroUsd`, `reservedMicroUsd`, `dayKey`, `daySpentMicroUsd` | `by_ownerId` | Codex | 1 |
| `ops_settings` | Singleton: `workspaceEnabled`, `cohortMode` (`allowlist` / `open`), `freeSignupsOpen`, `globalDailyBudgetMicroUsd`, `killSwitches` (`ai`, `studioVideo`, `publish`, `email`, `social`, `ads`) | single row | Codex (super admin only) | 0 |
| `workspace_cohort` | Allowlisted owners for the beta | `by_ownerId` | Codex | 0 |
| `business_members` | `projectId`, `userId`, `role` (`owner` / `editor`), `invitedBy`, `acceptedAt?`. Only `owner` rows until Phase 6 (D12) | `by_projectId`, `by_userId` | Codex | 1 (owner rows), 6 |
| `sequences`, `sequence_steps` | Email sequences: `status` (`draft` / `approved` / `active` / `paused`); steps: `order`, `delayHours`, `subject`, `documentId`, `approvalId?` | `by_projectId`, `by_sequenceId_and_order` | Claude writes drafts; Codex owns status changes after approval | 2 |
| `enrollments`, `email_sends` | `leadId`, `sequenceId`, `nextStepAt`, `state`; sends: `idempotencyKey`, `resendId`, `status` | `by_state_and_nextStepAt`, `by_idempotencyKey` | Codex | 2 |
| `social_accounts`, `social_posts` | Accounts: `platform`, `connector` (`copy` / `meta`), encrypted token reference; posts: `status` (`draft` / `copy_ready` / `approved` / `scheduled` / `posted` / `failed`), `scheduledFor?`, `approvalId?`, `externalId?` | `by_projectId_and_status`, `by_status_and_scheduledFor` | Claude writes drafts; Codex owns connectors and posting | 2 (copy), 5 (native) |
| `ad_campaigns` | `platform`, `objective`, `dailyBudgetCents` (founder's own money, D8), `status`, `readiness[]`, `decisionLog[]`, `approvalId?`, `externalId?` | `by_projectId_and_status` | Claude drafts; Codex launches | 2 (drafts), 5 (live) |
| `outbound_lists`, `outbound_messages` | Founder-uploaded, attested lists and drafts (D9) | `by_projectId` | Claude drafts; Codex sends | 5 |

**Schema layout.** `convex/schema.ts` is 975 lines and the busiest file in the repo.
Phase 0 splits the new tables into domain modules (`convex/schema/workspace.ts`,
`convex/schema/ai.ts`, `convex/schema/growth.ts`) that `schema.ts` spreads in. All
new tables land in **one** Phase 0 PR, unused, so later work packages rarely touch
schema. Changes after that go through the schema owner (§13).

### 4.3 Plan limits

`convex/platform/plans.ts` `PLAN_LIMITS` gains, per plan:

| Limit | Free | `builders_hub` | `growth` (new id, D1c) |
|---|---|---|---|
| `businesses` | 1 | 1 | 3 |
| `monthlyCredits` | 0 (50 starter, once) | 500 | 2,000 |
| `wrenMessagesPerDay` | 40 | 300 | 600 |
| `tenantEmailSends` | 50 lifetime | fair use (5,000 / month soft cap) | fair use (20,000 / month) |
| `outboundSendsPerDay` | 0 (drafts) | 20 | 100 |
| `members` | 1 | 1 | 3 |
| `autopilot`, `adsLive`, `nativePublishing`, `customDomain`, `studioLongVideo` | false | true | true |
| `hireSkippedRoles` | false | false | true |

`plans.ts:7` forbids the id `builder`; `growth` is new and free of collisions.
`deriveMembership` learns the Growth price keys; the order of precedence (lifetime
grant, then active or past-due subscription without dispute, then comp) does not change.

## 5. AI runtime (`convex/ai/*`)

### 5.1 One gateway

Every model call goes through one internal action, `convex/ai/gateway.ts`
(`"use node"`):

```
run({ promptRef, ownerId, projectId?, taskId?, inputs })
  1. load the prompt spec from the registry (tier, model, effort, max tokens,
     output schema, cache layout)
  2. reserve  ─ mutation (convex/ai/metering.ts):
       kill switch off? global daily budget left? owner allowed (Free ceiling,
       per-day cap)? → insert ai_usage {status: reserved, reservedMicroUsd:
       worst case from input bytes + max_tokens} and add it to ai_budgets.reserved.
       Otherwise throw BUDGET_EXHAUSTED. Nothing has been sent yet.
  3. call the provider adapter with an AbortSignal timeout
  4. validate the structured output against the zod schema; on failure, one
     re-ask (counted as a second call with its own reservation)
  5. settle ─ mutation: actual usage → micro-USD (dated rate card) → ai_usage
     {status: settled}, release the reservation, add to day and lifetime totals,
     bump the global counter
  6. on error: settle as failed. If the provider may have billed, charge the
     worst case (the engine's billedUsage rule), never zero.
```

Worst-case maths reuses `lib/engine/cost.ts` (integer micro-USD, round up). Rate cards
move to `convex/ai/pricing.ts` with dates, like `lib/engine/providers/pricing.ts`.

### 5.2 Model router

| Tier | Model | Used for | Default effort |
|---|---|---|---|
| `fast` | Claude Haiku 5.5 | Wren chat turns, social posts, ads drafts, quality checks, classification (policy, intent), memory summaries | `low` |
| `draft` | Claude Sonnet 5.5 | Blueprint personalisation, brand kit text, landing spec, email sequence, SEO pack and article, launch plan, build pack, Wren turns that change the plan | `low`, thinking off between tools |
| `deep` | Claude Opus 5.5 | Per-idea precompute (batch), eval judging, escalation after a failed draft | `medium` |

The tier is set by the prompt spec, not by the plan: paying founders get more work,
not a pricier model for the same work. A failed quality check may escalate a draft
once to `deep`; that escalation is counted and capped per account per day.

Effort and thinking are always set explicitly. Thinking tokens bill as output, and
Sonnet 5.5 defaults to adaptive thinking at `high`; leaving it unset is a hidden cost
line. Max tokens include thinking, and the reservation is sized from max tokens.

### 5.3 Prompt registry

Prompts live in code, not the database: `convex/ai/prompts/<id>.ts` exports
`{ id, version, tier, system, buildUser(inputs), schema, maxTokens, effort,
cacheLayout, evalSuite }`. Every `ai_usage` row records `id@version`. A CI script
fails when a prompt's text or schema changes without a version bump. Output schemas
are zod (already a dependency) converted to JSON Schema for the API's structured output
(`output_config.format`), then validated again on our side.

### 5.4 Prompt caching layout

Within one business, the crew's calls share a long prefix. Order every request:

1. **System block (stable across all businesses):** crew charter, the three
   promises, writing rules, safety rules. Cache breakpoint.
2. **Business context block (stable within one business):** blueprint, brand kit
   summary, founder choices, Wren memory summary. Cache breakpoint.
3. **Task block (changes per call):** the employee's instructions and inputs.

On Thursday night the launch workflow starts six to eight jobs within a few minutes
for the same business, so the 5-minute TTL is enough; we never pay for the 1-hour
write. Prefixes under the model's minimum cacheable length don't cache and don't
error, so an integration test asserts `cache_read_input_tokens > 0` on the second
identical call, and the ops console shows the hit rate per prompt.

### 5.5 Providers

`convex/ai/providers/{anthropic,openaiImages,recraft,video}.ts`, modelled on
`lib/engine/providers/*`: injectable `fetch`, a fixture mode, dated rate cards and a
`ProviderCost` result (`billedAs`, `estimated`, `units`).

- `AI_PROVIDER_MODE=fixture` is the default in development, tests and CI: no keys,
  no network, no spend. Live mode needs the key **and** `ops_settings.killSwitches.ai
  === false`.
- New dependency: `@anthropic-ai/sdk` (official SDK, used only inside
  `convex/ai/providers/anthropic.ts`). Images and video keep raw `fetch`, like the
  engine.
- New optional env (Convex): `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`,
  `RECRAFT_API_KEY`, `RECRAFT_STYLE_ID`, `VIDEO_PROVIDER`, `VIDEO_API_KEY`,
  `AI_PROVIDER_MODE`. None of these are in the Convex env today; the engine reads
  them from `.env.local` on a laptop.
- The research engine keeps its OpenAI, Perplexity and DataForSEO adapters and its
  rulings (D11). Keyword numbers shown by Sana come only from DataForSEO records.

### 5.6 Per-idea precompute

For each library idea, a batch job writes `idea_crew_seeds`: a full blueprint,
brand seeds (three name directions, palette and type options), landing section
drafts, email and social angles, and build-pack phase seeds. It runs on the Message
Batches API (50% off) with the `deep` tier, once per seed version, and again when the
idea's content or the seed prompt changes. The wizard then *personalises* seeds with
`draft` calls instead of generating from nothing. Cost: `03-ai-cost-model.md` §4.

Own ideas have no seeds; they get the light blueprint (D15) and a slightly more
expensive first pass.

### 5.7 Evals

`evals/crew/` holds a fixed corpus: 12 library ideas across categories (including a
course idea and a marketplace), 4 own ideas, and 3 adversarial inputs (prompt
injection in the idea text, a request for fake testimonials, a trademarked brand
name). Graders:

- **Deterministic (run in CI, fixture mode):** schema validity; colour contrast
  ≥ 4.5:1 for every text/background pair in the brand kit; a waitlist section in
  every app landing spec; no testimonial, statistic or customer-count field unless
  marked `placeholder: true`; build-pack prompts pass `npm run audit:prompts`
  (standard v1); length limits per platform for social posts.
- **Judge (run by hand, live, with a spend cap):** an Opus rubric per artifact (on
  brief, on brand, specific to the idea, no invented facts), scored 1–5.
- **Cost:** micro-USD per artifact and per full launch, from `ai_usage`.

A prompt version merges only if deterministic graders pass and the judge score does
not drop by more than 0.3 on the corpus. Results go in `evals/crew/results/*.json`.

### 5.8 Safety in the runtime

- Founder text and any fetched page text are data, wrapped in tagged blocks, never
  instructions. Side effects never come from model output directly: a model can only
  *propose* an approval card; a founder click approves it.
- A `refusal` stop reason fails the job and refunds it.
- The "never fake it" check runs after every generation (deterministic patterns for
  testimonials, star ratings, "trusted by", user counts, press logos).
- Brand names are checked against the reserved subdomain list and a short
  trademark watch list before they become a tenant slug.

## 6. Crew pipelines (`convex/crew/*`)

### 6.1 Roster

`convex/crew/roles.ts` holds the role catalogue (Wren, Iris, Leo, Sana, Marco, Elle,
Theo, Kai, Ada, plus Merch, Outbound, Curriculum and Community) and the hiring
rules as pure functions of the blueprint and wizard answers. No model call: the
team is deterministic and testable. The skip reason is a template filled from the
rule that fired ("No physical product, so no Merch").

### 6.2 Launch workflow

`convex/crew/launch.ts` defines a workflow started by "Meet your co-founder":

```
roster (deterministic) ──► blueprint personalise (draft)
                                │
              ┌─────────────────┼──────────────────┬──────────────┐
              ▼                 ▼                  ▼              ▼
        brand kit text     build pack         launch plan     SEO pack
          (draft)          (compile.ts +       (draft)        (draft)
              │             draft)
              ▼
        logo marks ×3 (Recraft) ──► landing spec (draft) ──► approval: publish
              │
              ├──► email sequence (draft) ──► approval per step
              ├──► social pack ×7 (fast)  ──► copy_ready
              └──► ads drafts (fast)      ──► readiness checks
```

- Steps run on a workpool with `maxParallelism` per owner (3) and a global cap, so a
  burst of sign-ups queues instead of spiking spend.
- Each step is a `tasks` row with `jobKey = crew:{projectId}:{type}:{revision}`.
  Re-running a step with the same key is a no-op.
- Retries belong to our executor, not the workflow (`retry:false` on `runAction`), with
  the WP26 branch's classes: retryable and unbilled, indeterminate, permanent.
- Each finished step writes its document, sets the employee's status, creates an
  `artifact_review` approval, and posts a Wren card in the chat.
- Target: the landing spec is ready for review within 5 minutes of "Meet your
  co-founder"; the site is live within 15 minutes for most founders (strategy §10).

### 6.3 Revisions

"Ask for changes" creates a revision job with the previous document and the
founder's note. Rounds 1 and 2 are free (D17). From round 3 the approval card shows
the credit cost, and the job debits only after the founder approves the spend.

### 6.4 Build pack

Kai's build pack starts from the idea's four existing prompts (already standard v1)
and `lib/engine/compile.ts`, then a `draft` call personalises and extends them to
four phases and eight prompts. Every prompt must pass `npm run audit:prompts` rules
before the document is saved; a failing prompt triggers one repair call.

## 7. Credits (ledger v2)

**Fixed price per action, debit at start, refund once on failure.** Prices are fixed
(strategy §6), so there is nothing to reserve and settle in credits. The variable
part, provider dollars, is reserved and settled separately in `ai_usage` (§5.1).
This keeps the tested `debitTask` / `refundFailedTask` path unchanged.

| Event | Ledger entry | Idempotency key |
|---|---|---|
| First business created on Free | `starter_grant` +50, bucket `bonus` | `starter-grant:{ownerId}` |
| Paid invoice for a membership subscription | `allowance_expiry` −(unused allowance), then `plan_grant` +500 or +2,000, bucket `allowance`; set `allowancePeriodEnd` | `plan-grant:stripe:{invoiceId}` |
| Lifetime or comp member, monthly | Same pair, from a daily cron on the grant anniversary (D1b) | `plan-grant:{grantId}:{periodStart}` |
| Job starts (credit price > 0) | `task_debit` −price; `bucketSplit` records how much came from allowance and bonus (allowance first) | `task-debit:{taskId}` (existing) |
| Job fails | `task_refund` +price to the same buckets | `task-refund:{debitId}` (existing) |
| Job cancelled before its provider call | `task_refund` (new: `transitions.ts` allows refund for `cancelled` as well as `failed`) | `task-refund:{debitId}` |
| Subscription refund or dispute | Existing `purchase_refund` / `dispute` handling; balance may go negative and paid actions pause (`paidActionsSuspended`) | Existing |

- `credit_accounts.balance` stays the single total. `allowanceRemaining` is a
  helper for display and for the expiry entry. A test asserts the sum of ledger
  entries equals `balance` after every operation.
- Past-due subscriptions keep the plan (as today) but get no new allowance, because
  grants come only from paid invoices.
- Free change rounds and free first drafts never touch the ledger.

## 8. Billing and plans

- **One subscription system.** Growth is a new Stripe product with monthly and annual
  prices under the existing membership purpose `weekendmvp_membership_v1`. No fifth
  Stripe purpose, no second webhook route. The credit-pack purpose stays dormant (D20).
- **Credit grants** hang off the existing membership webhook path
  (`app/api/platform/membership/webhook` → `membership/provider.ts accept` →
  `events.settle`): on a paid invoice, `events.settle` schedules the grant mutation.
  The daily reconcile cron (04:17) re-checks the last two invoices per active
  subscription and fills any missed grant (the idempotency key makes this safe).
- **Upgrade Builder's Hub → Growth:** a Phase 0 spike checks what Managed Payments
  allows (Customer Portal plan switch with proration, or a new hosted Checkout
  session for the existing customer). The plan is written for the portal switch.
- **Checkout returns to the blocked action:** the checkout session carries an
  allow-listed `returnTo` path and the `approvalId` that was blocked. The return page
  resumes that approval card.
- **Card entry is always on Stripe's hosted page (D16).**

## 9. Publishing and tenant hosting (D2)

- Reuse `convex/platform/sites/publish.ts` (`publish`, `rollback`, `unpublish`, all
  audited) and the tenant rewrite in `middleware.ts`.
- **WP30 gate, as part of WP78:** publish needs an approved `publish` approval; a
  deterministic content policy check plus a `fast` classifier (scams, adult,
  weapons, medical claims, impersonation); the reserved subdomain list; a per-owner
  publish rate limit (5 an hour); a global `publish` kill switch; per-site takedown
  by a super admin.
- **Fail-open stays for uptime, with one exception.** `lib/tenant-publish-check.ts`
  serves a site when the backend is unreachable. A taken-down slug must never be
  served, so takedowns are also written to a small list in Vercel Global Config that
  middleware reads first.
- **WP31 activation:** wildcard DNS `*.weekendmvp.app`, the Vercel wildcard domain
  and certificate, verified on a test slug before any founder slug.
- **The renderer** (`app/site/[slug]`) renders a `LandingSpec` through a fixed set of
  section components. The model never writes HTML, so a generated page cannot carry
  script. Every section meets WCAG 2.1 AA, and the page's colours come from the brand
  kit that already passed the contrast check.
- The waitlist form posts to the existing `/__lead`. Until D5 is ruled, the form runs
  in preview mode and stores synthetic leads only.

## 10. Tenant email (D6)

- Mount `@convex-dev/resend` for tenant mail only: it queues, rate-limits, dedupes
  and records delivery events. A separate Resend project and domain
  (`send.weekendmvp.app`); env `TENANT_RESEND_API_KEY`, `TENANT_RESEND_WEBHOOK_SECRET`
  (optional entries). Auth mail (`AUTH_RESEND_*`) is untouched.
- A Convex cron every 5 minutes sends due steps where the sequence **and** the step
  are approved, the lead is opted in and not unsubscribed, and the plan's cap allows
  it. Each send has `idempotencyKey = send:{enrollmentId}:{stepId}`.
- Every email has an unsubscribe link (`/u/{token}`, no sign-in) and the founder's
  postal address. A business can't send until the address is set.
- Double opt-in on enrolment: the first email is the confirmation.

## 11. Social, ads and outbound connectors

- Interfaces in `convex/growth/connectors/`: `SocialConnector` (`publish`, `status`)
  and `AdsConnector` (`createCampaign`, `pause`, `metrics`). The first
  implementations are `CopyConnector` (marks a post `copy_ready`; the founder copies
  and posts) and `FakeAdsConnector` (readiness checks, no network).
- Native Meta publishing and ads (Phase 5) sit behind flags and need Meta app review
  (D7, D8). OAuth tokens are encrypted with AES-GCM using a key in Convex env, and
  only the connector module can decrypt them.
- Ad spend is always on the founder's own ad account. We store the daily budget they
  set; we never charge it.
- Outbound sends (D9) use the tenant Resend domain with the plan's daily cap, only to
  founder-uploaded lists with a recorded attestation.

## 12. Background jobs

| Job | Where | Schedule | Owner |
|---|---|---|---|
| Sequence sender | Convex cron | every 5 min | Codex |
| Provider job poller (video) | Convex cron | every 1 min while jobs are pending | Claude |
| Stale job sweeper (reservations older than 15 min → settle failed, refund job) | Convex cron | every 10 min | Codex |
| Lifetime and comp credit grants | Convex cron | daily 03:30 UTC | Codex |
| Spend alarm (80% and 100% of the global daily budget) | Convex cron | every 15 min | Codex |
| Lead retention purge (D5) | Convex cron | daily | Codex |
| Credit grant reconcile | Existing Vercel cron 04:17 (membership reconcile) | daily | Codex |
| Per-idea seed refresh | Script, run by hand or on publish | on demand | Claude |

`convex/crons.ts` has one writer (Codex). Claude's poller is an internal function in
`convex/studio/`; Codex adds the cron entry that calls it.

## 13. Rate limits and abuse

Rate limiter definitions live in one file, `convex/platform/limits.ts` (Codex):

- Wren messages per plan per day (40 / 300 / 600); approval clicks never count.
- Crew job starts: 10 an hour per owner.
- Wizard starts: 3 a day per owner.
- Studio: 10 images and 2 videos a minute per owner.
- Publishes: 5 an hour per owner.
- Leads: existing tenant lead limits.

Abuse controls: one free business per verified account; disposable email domains
refused when the wizard creates the business (static list in the repo); global daily
spend budget with automatic pause of free generation at 100%; per-owner free
lifetime ceiling ($1.50, D3).

## 14. Security and authorization

- New helper `requireBusinessAccess(ctx, projectId, minRole)` in
  `convex/platform/authz.ts`, built on `requireOwnedProject`. Until D12 changes it,
  `minRole` is always `owner`. Every workspace query and mutation calls it first.
- Actions never trust a client-sent `ownerId`. They are internal, started from a
  mutation that has already authorised the caller.
- Approvals are re-read inside the mutation that performs the side effect, and a
  send, post or publish fails if the approval is not `approved` or its subject has
  changed since.
- Super-admin-only: `ops_settings`, cohort, takedowns, spend views.
- Public endpoints (`/__lead`, `/u/{token}`, Resend webhook) are rate-limited and
  signature-checked where the sender signs.
- Privacy: lead emails are personal data and follow D5 retention. No phone numbers
  are collected while D10 is deferred.
- `tests/security/*` gains: provider imports only inside `convex/ai/providers`; no
  workspace function without `requireBusinessAccess`; every side-effect mutation
  checks an approval.

## 15. Feature flags and rollout

| Flag | Kind | Turns on |
|---|---|---|
| `NEXT_PUBLIC_LAUNCH_WORKSPACE` | Build-time env | Workspace routes and "Build this idea, free" CTAs render (otherwise 404 and the old CTAs). |
| `ops_settings.workspaceEnabled` | Runtime | Backend accepts workspace mutations. |
| `ops_settings.cohortMode` + `workspace_cohort` | Runtime | Beta allowlist, then open. |
| `ops_settings.killSwitches.*` | Runtime | Instant off for AI, video, publish, email, social, ads. |
| `MEMBERSHIP_BILLING_MODE` (existing) | Env | Unchanged; Growth prices follow the same mode. |

Remember the GA lesson in the project CLAUDE.md: `NEXT_PUBLIC_*` values are inlined at
build time, so flipping the workspace flag needs a fresh build.

## 16. Frontend

- Routes: `app/start/[ideaSlug]` and `app/start/own` (wizard; `/build/[slug]` is
  taken by the parked preview funnel), and `app/dashboard/b/[projectId]/…` for the
  workspace pages listed in strategy §4.
- Components: new `components/workspace/*` (Claude). The shared shell
  (`WorkspaceShell`, `workspace-current.ts`) gains a business switcher and the credit
  meter; it has one writer (Claude) for the program.
- Live updates use Convex subscriptions: crew status, chat deltas (Wren's reply is
  written in chunks about every 250 ms), approvals.
- Accessibility (WCAG 2.1 AA, a11y-check skill on every screen): status always has
  a text label, Wren's new messages are announced in a polite live region, approval
  cards move focus predictably, all motion respects `prefers-reduced-motion`, every
  generated image needs alt text before it can be used on the site.
- Visual system: `home-*` tokens and shadcn/ui primitives (D18). Canvas row 05 is
  the acceptance reference for components and copy.

## 17. What we deliberately do not build

- A general agent framework. Wren is one chat loop with a fixed set of tools that
  create approval cards; specialists are pipeline steps, not autonomous agents.
  `@convex-dev/agent` is evaluated in the Phase 0 spike for Wren's thread storage
  only, and adopted only if it saves work without hiding usage from our metering.
- Model-written HTML, model-chosen recipients, or model-triggered sends.
- A second ledger, a second webhook route or a second plan catalogue.
