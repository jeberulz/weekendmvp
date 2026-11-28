# WP96 data map: where founder data is stored or sent

Draft for owner review. Not legal advice.

Scope: data of a signed-in founder (a `users` row). Every row cites the repo file. Anything the code cannot confirm is marked `UNCONFIRMED`. Researched read-only on branch `claude/wp96-privacy-deletion-af66c4`, base `013fdf23`, 2026-11-20.

Treatment key (a suggestion for WP96, not a decision):

- DELETE: erase the row when the founder deletes the account.
- KEEP-SCRUBBED: keep the row, blank the personal fields.
- KEEP-FINANCIAL: keep for money or audit reasons (see RULINGS 2026-08-05 WP22 data lifecycle).
- OPERATOR-OWNED: not founder data. It carries the operator's id or none.
- NOT-LINKABLE: the row may hold personal data but no index finds it by founder.

"Delete-by" is the index a delete job can use. Convex index prefixes work, so `by_ownerId_and_projectId` finds all rows for an owner.

---

## 1. Convex tables

Prod deployment: `first-squirrel-244`, region eu-west-1 (`convex/editorial/readerTarget.ts:6`, `docs/wp/backup-restore.md:95`). Schema files: `convex/schema.ts` (S), `convex/schema/workspace.ts` (W), `convex/schema/ai.ts` (A), `convex/schema/growth.ts` (G). The first column names the file in brackets.

### 1.1 Identity and sign-in

| Table | Personal / founder-authored fields | Owner key | Delete-by | Treatment |
|---|---|---|---|---|
| `users` [S, custom over `authTables`] | `email`, `name`, `image` (Google picture URL), `phone` (unused), `displayName`, `stripeCustomerId`, `tokenIdentifier`, `signupSrc`, `createdAt`, `accountClosureRequestedAt`, `platformOwnerAccess` | `_id` | `_id`; `email` index | KEEP-SCRUBBED (other tables point at this id). Written by `convex/authUser.ts` `createOrUpdateAuthUser`, `googleProfile` |
| `authSessions` [@convex-dev/auth `authTables`, `node_modules/@convex-dev/auth/dist/server/implementation/types.js`] | `userId`, `expirationTime` | `userId` | `userId` | DELETE |
| `authAccounts` [same] | `provider`, `providerAccountId` (the email, or Google subject), `secret` (unused here), `emailVerified` | `userId` | `userIdAndProvider` (prefix `userId`) | DELETE |
| `authRefreshTokens` [same] | `sessionId`, `expirationTime` | via session | `sessionId` | DELETE |
| `authVerificationCodes` [same] | `accountId`, `provider`, `code` (magic-link code), `emailVerified` | via account | `accountId` | DELETE |
| `authVerifiers` [same] | PKCE `signature`, optional `sessionId` | none | only `signature` | NOT-LINKABLE. Short-lived OAuth step; no TTL code found in repo (library behaviour UNCONFIRMED) |
| `authRateLimits` [same] | `identifier` = the email typed at sign-in (`verifyCodeAndSignIn.js` uses `params.email`), attempt counters | email | `identifier` | DELETE by normalized email. Library resets it on a good sign-in (`resetSignInRateLimit`), so a row usually does not exist |
| `super_admins` [S] | `userId` of the operator | `userId` | `userId` | OPERATOR-OWNED |

### 1.2 Newsletter, legacy payments, offer lists

| Table | Personal fields | Owner key | Delete-by | Treatment |
|---|---|---|---|---|
| `subscriptions` [S] | `email`, `normalizedEmail`, `source`, `utm`, `beehiivStatus`. Written by public mutation `convex/subscriptions.ts` `record`, called from `app/api/subscribe/route.ts` | email | `by_email`, `by_normalizedEmail` | DELETE (Beehiiv keeps its own copy, see 3.1) |
| `account_beehiiv_sync` [S] | `userId`, `email`, `state`, `result`. Created on sign-up by `convex/authUser.ts` `enqueueAccountBeehiiv` | `userId` | `by_user` | DELETE |
| `stripe_events` [S] | `email`, `customerId`, `amount`, `currency`, `paymentLinkId`, `rawPayload` (field exists; no writer found in `convex/` or `app/`). Legacy ship·able workshop payments, `convex/payments.ts` `insertEventOnce` | email (no index) | only `by_stripeEventId` | NOT-LINKABLE. Needs a scan or a new index (Codex-owned) |
| `offer_cohorts` [S] | `emailHash` = SHA-256 of a fixed public prefix plus the lowercased email (`convex/platform/membership/cohortHash.ts`). Not salted | email hash | `by_emailHash` (compute `cohortEmailHash(users.email)`) | DELETE possible. Whether an unsalted hash counts as personal data is a legal call: UNCONFIRMED |

### 1.3 Idea library activity (all in [S])

| Table | Personal / founder-authored fields | Owner key | Delete-by | Treatment |
|---|---|---|---|---|
| `saved_ideas` | `userId`, `ideaId`, `savedAt` | `userId` | `by_user` | DELETE |
| `idea_intents` | `ideaId`, `saved`, `interested` | `ownerId` | `by_ownerId_and_ideaId` (prefix) | DELETE |
| `member_activity` | Visit counts, focused time, last measured activity and up to 20 recent page templates | `ownerId` | `by_ownerId` | DELETE |
| `user_preferences` | `tools`, `weeklyHours`, `goal`, `dismissed` | `ownerId` | `by_ownerId` | DELETE |
| `weekend_plans` | `ideaId`, `steps`, `coreFeature` (free text), `liveUrl` | `ownerId` | `by_ownerId_and_ideaId` (prefix) | DELETE |
| `collections` | `name` (free text) | `ownerId` | `by_ownerId_and_updatedAt` | DELETE (has soft `deletedAt`; physical delete needed) |
| `collection_items` | `ideaId` | `ownerId` | `by_ownerId_and_ideaId` | DELETE |
| `idea_notes` | `body` (free text note) | `ownerId` | `by_ownerId_and_ideaId` | DELETE |
| `idea_requests` | `title`, `problem`, `category` (free text, shown publicly by `convex/ideaRequests.ts` `listTop`/`listForSuggest`), `submitterKey`, `voteCount` | `submitterKey` = `user:<subject>` | `by_submitterKey` | DELETE or KEEP-SCRUBBED. The subject is `userId\|sessionId` (`tokens.js:24`; `lib/idea-requests.ts:92`), so find rows by a string range on the `userId\|` prefix. Other voters' counts live on the row: owner decision |
| `idea_request_votes` | `voterKey` (same shape), `requestId` | `voterKey` | `by_voterKey` | DELETE. `voteCount` on the request is denormalised: decrement or accept drift |

### 1.4 Businesses and their artifacts ([S], founder-authored)

| Table | Personal / founder-authored fields | Owner key | Delete-by | Treatment |
|---|---|---|---|---|
| `projects` | `title`; `workspace.name`, `workspace.slug`, `ideaSlug`, `ownIdeaText` (the founder's idea, free text), `platform`, `commercialModel`, `goal`, `partner.name`; `wizardSessionId`, `deletionRequestedAt` | `ownerId` | `by_ownerId` | DELETE |
| `briefs` | links to a brief document, `revision` | `ownerId` | `by_ownerId_and_projectId_and_revision` | DELETE |
| `submissions` | `payload` (JSON of the brief: title, problem, audience, outcome, constraints; `convex/platform/briefPayload.ts`) | `ownerId` | `by_ownerId_and_idempotencyKey` (prefix) | DELETE |
| `tasks` | `title`, `employeeKey`, `jobKey` | `ownerId` | `by_ownerId_and_idempotencyKey` (prefix) | DELETE |
| `task_steps` | type, status only | `ownerId` | `by_projectId_and_status_and_createdAt` (no owner prefix) | DELETE via each owned project |
| `documents` | `title`, `body` (generated blueprint, brand kit, emails, social pack, landing spec, briefs; kinds in `convex/platform/validators.ts` `DOCUMENT_KIND_VALUES`), `storageId`, `promptRef` | `ownerId` | `by_projectId_and_updatedAt` (no owner prefix) | DELETE via each owned project |
| `document_citations` | `url`, `title`, `publisher` | `ownerId` | `by_projectId_and_createdAt` | DELETE via project |
| `site_configs` | `hostname` (public `{slug}.weekendmvp.app`), `takedownReason` | `ownerId` | `by_ownerId_and_projectId` | DELETE after unpublish. A published site is public web content; a takedown writes a key to Vercel Global Config (`convex/platform/sites/takedown.ts`) |
| `site_versions` | `landingSpec` (the page content, JSON), `storageId` | `ownerId` | `by_projectId_and_status_and_createdAt` | DELETE via project |
| `leads` | `email`, `payload`, `consentText`, `source`, `doubleOptInAt`, `unsubscribedAt` of the founder's site visitors. Today the capture path inserts `synthetic: true` rows only (`convex/platform/sites/leads.ts:171`). Real capture follows D5 | `ownerId` | `by_ownerId_and_createdAt` | DELETE. Existing D5 purge physically deletes (`convex/platform/sites/retention.ts:221`) |
| `workflow_runs` | ids, `errorCode` | `ownerId` | `by_ownerId_and_idempotencyKey` (prefix) | DELETE |
| `preview_capabilities` | `renderSpec` (visitor-supplied page content), `tokenHash`, `claimedByUserId`, `claimedProjectId` | none until claimed | `by_claimedByUserId_and_createdAt` | DELETE if claimed. Unclaimed rows are NOT-LINKABLE and there is no purge job (see 5) |
| `audit_events` | `actorUserId`, `action`, `subjectId`, `metadata` (JSON string; e.g. hostname, takedown reason: `convex/platform/sites/publish.ts` `audit`, `takedownState.ts`) | `ownerId` | `by_ownerId_and_createdAt` | KEEP-SCRUBBED (blank `metadata`). Append-only by ruling 2026-08-05; `APPEND_ONLY_TABLE_NAMES` in `convex/platform/validators.ts:224` |

### 1.5 Money and plans ([S])

| Table | Personal fields | Owner key | Delete-by | Treatment |
|---|---|---|---|---|
| `credit_accounts` | balance | `ownerId` | `by_ownerId` | KEEP-FINANCIAL |
| `credit_ledger` | `providerEventId`, `purchaseId`, amounts | `ownerId` | `by_ownerId_and_idempotencyKey` (prefix) | KEEP-FINANCIAL (append-only) |
| `purchases` | amounts, Stripe checkout and payment-intent ids (dormant credit packs, RULINGS 2026-11-05 D20) | `ownerId` | `by_ownerId_and_idempotencyKey` (prefix) | KEEP-FINANCIAL |
| `billing_customers` | `stripeCustomerId` | `ownerId` | `by_ownerId` | KEEP-FINANCIAL |
| `plan_subscriptions` | `stripeSubscriptionId`, `stripeCustomerId`, status, period end | `ownerId` | `by_ownerId_and_updatedAt` | KEEP-FINANCIAL |
| `membership_orders` | Stripe session and payment-intent ids, seat, amount, currency | `ownerId` | `by_ownerId_and_idempotencyKey` (prefix) | KEEP-FINANCIAL |
| `plan_grants` | grant kind, seat number | `ownerId` | `by_ownerId` | KEEP-FINANCIAL |
| `founding_seats` | `ownerId`, `orderId`, seat number | `ownerId` (no owner index) | `by_seatNumber`, found through `membership_orders.seatNumber` | KEEP-FINANCIAL |
| `workshop_orders` | Stripe session id, seat, `lookupKey` | `ownerId` | `by_ownerId_and_status` | KEEP-FINANCIAL |
| `workshop_seats` | `ownerId`, `orderId` | `ownerId` (no owner index) | `by_eventKey_and_status_and_seatNumber` (about 20 rows per event) | KEEP-FINANCIAL for paid seats; DELETE for expired holds |
| `billing_events` | Stripe event id, type, outcome; no email, amount or payload (schema comment) | none | n/a | No personal data |
| `workshop_seat_counts`, `live_builds` | counts, schedule | none | n/a | No personal data |

### 1.6 Workspace and crew ([W], founder-authored)

All have `ownerId` and, except the first two, `projectId`. Delete-by `by_ownerId_and_projectId` unless stated.

| Table | Personal / founder-authored fields | Delete-by | Treatment |
|---|---|---|---|
| `wizard_sessions` | `ownIdeaText`, `ideaSlug`, `answers` (idea text, rework notes, platform description, goal, business name and alternatives, partner custom name, signal notes) | `by_ownerId_and_updatedAt` | DELETE |
| `wizard_idea_improvements` (WP100) | `inputText`, `originalText`, `suggestion`, `changeNote`, `hints` (the founder's idea and the AI suggestions for it) | `by_ownerId_and_createdAt` | DELETE |
| `founder_signals` | `before`, `after` (free text the founder kept or changed) | `by_ownerId_and_createdAt` | DELETE |
| `roster_plans` | hired and skipped roles with reasons | `by_ownerId_and_projectId` | DELETE |
| `crew_members` | `displayName` (lead name the founder chose) | `by_ownerId_and_projectId` | DELETE |
| `workstreams` | `title`, `blocker`, document and file ids | `by_ownerId_and_projectId` | DELETE |
| `launch_plan_items` | `title` | `by_ownerId_and_projectId` | DELETE |
| `approvals` | `note` (the founder's change request text), subject ids | `by_ownerId_and_projectId` | DELETE |
| `chat_messages` | `body` (founder and Wren messages) | `by_ownerId_and_projectId` | DELETE |
| `wren_memory` | `facts[]`, `summary` (model-written notes about the founder's business; cap 20 facts, 200 chars each, `lib/workspace/contracts/wrenMemory.ts`) | `by_ownerId_and_projectId` | DELETE |
| `business_files` | `storageId`, `mime`, `alt` | `by_ownerId_and_projectId` | DELETE, and delete the stored file (see 1.9) |
| `provider_jobs` | `provider`, `externalId` | `by_ownerId_and_projectId` | DELETE |
| `business_members` | `userId`, `invitedBy`, `role` (only `owner` active, RULINGS 2026-11-05 D12) | `by_userId` (as member), `by_ownerId_and_projectId` (as owner) | DELETE |

### 1.7 AI metering and operator tables ([A], [W])

| Table | Contents | Owner key | Delete-by | Treatment |
|---|---|---|---|---|
| `ai_usage` [A] | tokens, cost, prompt ref, model, timestamps, ids. No prompt or reply text (`convex/admin/aiCosts.ts:31`) | `ownerId` optional, `projectId`, `taskId` | `by_ownerId_and_createdAt` | KEEP-FINANCIAL (WP96-S3 AC says unchanged so meter totals match). Ids become dangling |
| `ai_budgets` [A] | per-owner spend counters | `ownerId` | `by_ownerId` | KEEP-FINANCIAL |
| `workspace_cohort` [A] | founder allowed into the beta, `addedBy` (operator) | `ownerId` | `by_ownerId` | DELETE |
| `ops_settings` [A] | kill switches, budgets | operator's `ownerId` | n/a | OPERATOR-OWNED |
| `idea_crew_seeds` [W] | per-idea seed from the public idea page; `ownerId` = the sole super admin (`convex/crew/seeds.ts` `soleSuperAdmin`) | operator | n/a | OPERATOR-OWNED. Not a founder's id. A row with `projectId` set would be a business's; the only writer sets none: UNCONFIRMED for old rows |
| `idea_seed_runs`, `idea_seed_items` [W] | run state; `sourceJson` = public idea page; `errorDetail` = provider message | operator | n/a | OPERATOR-OWNED |

### 1.8 Growth and tenant email ([G], all founder-owned)

All have `ownerId`; delete-by `by_ownerId_and_projectId` unless stated.

| Table | Personal / founder-authored fields | Treatment |
|---|---|---|
| `business_email_settings` | `fromName`, `replyTo` (founder email), `postalAddress` (founder postal address) | DELETE |
| `lead_email_tokens` | `tokenHash`, `leadId`, `expiresAt` (hashed tokens for a lead) | DELETE |
| `lead_retention_jobs` | ids, counters, `deletionRequestedAt`, `deleteDueAt`; delete-by `by_ownerId_and_projectId` | KEEP-SCRUBBED (no personal field; it is the timer record) |
| `account_closure_jobs` | ids, cursor; delete-by `by_ownerId` | KEEP-SCRUBBED. Dormant: `convex/platform/sites/accountClosure.ts` `requestAccountClosure`, gated by `TENANT_LEAD_DELETE_REQUESTS_ENABLED` |
| `sequences`, `sequence_steps` | `title`, `subject`, document id | DELETE |
| `enrollments` | `leadId`, state | DELETE |
| `email_sends` | `resendId`, `componentEmailId`, status; delete-by also `by_ownerId_and_createdAt` | DELETE. The Resend component and Resend keep a copy (3.5) |
| `social_accounts` | `platform`, `encryptedTokenRef` (reference to a social token) | DELETE. Any stored token is outside this table: UNCONFIRMED |
| `social_posts` | `externalId`, schedule | DELETE |
| `ad_campaigns` | `objective`, `dailyBudgetCents`, `readiness`, `decisionLog` | DELETE |
| `outbound_lists` | `name`, `attestationText` | DELETE |
| `outbound_messages` | status, document id | DELETE |

### 1.9 File storage and Convex components

- `_storage` is referenced by `documents.storageId`, `site_versions.storageId`, `business_files.storageId`. No non-test code calls `ctx.storage` (grep of `convex/`), and RULINGS 2026-08-05 WP22 documents says no user uploads in v1. Whether any stored file exists in prod is UNCONFIRMED. Convex backups include file storage (`docs/wp/backup-restore.md:8`).
- Component tables (mounted in `convex/convex.config.ts`, not in `schema.ts`):
  - rate-limiter: keys are `Id<"users">` (`convex/platform/limits.ts:29`), and `ip:<address>` for anonymous preview generation, IPv6 cut to /64 (`app/api/platform/preview/_server.ts`, `convex/platform/preview/generate.ts:157`). Row TTL: UNCONFIRMED.
  - resend (tenant mail): holds queued and sent email records. Cleanup crons delete finalized after 7 days and abandoned after 30 (`convex/crons.ts:26-29`). Fields stored: UNCONFIRMED. No `sendEmail` call exists in non-test code and `activateSequence` always throws `SEQUENCE_ACTIVATION_UNAVAILABLE` (`convex/growth/email/activation.ts`), so tenant send looks unreachable today.
  - workpool (`crewWorkpool`): args are ids only (`convex/crew/launch.ts:290`).
  - workflow: mounted; no `WorkflowManager` use found. sharded-counter: global AI spend counter, no personal data (`convex/ai/budgets.ts:19`).

### 1.10 Tables checked and not founder data

`ideas`, `idea_tools`, `idea_audiences`, `articles`, `newsletter_issues`, `categories`, `revenue_goals`, `audiences`, `build_times`, `tools`, `problems`, `live_builds`, `editorial_*` tables (all in `convex/schema.ts`): public content or operator-only. Operator-private editorial tables are gated by `super_admins`.

---

## 2. Anthropic (Claude) prompts

All crew and Wren text calls go to Anthropic through one gateway. `routeSpec` returns `provider: "anthropic"` for every prompt (`convex/ai/router.ts`). Images are not routed there. Callers of the gateway action `convex/ai/gatewayActions.ts` `runPrompt`: `convex/workspace/chatActions.ts` (Wren), `convex/crew/runner.ts` (via `convex/crew/generators.ts`, `jobs.ts`), `convex/crew/seedsBatch.ts` (operator seeds). The `wizard` attempt-key form exists (`gatewayActions.ts` `keyFormMismatch`) but no non-test caller was found; `convex/workspace/wizard.ts:245` marks the own-idea draft as an unbuilt seam. So the wizard makes no model call today.

Provider mode defaults to fixture and only `AI_PROVIDER_MODE=live` reaches the network (`convex/ai/providers/mode.ts` `providerMode`). Whether prod runs live is an env value: UNCONFIRMED from code. RULINGS 2026-11-07 (L1 live test launches) say live launches are planned.

### 2.1 Models and request shape

- Models by tier (`lib/workspace/contracts/prompts.ts:55-59`): fast = `claude-haiku-5-5`, draft = `claude-sonnet-5-5`, deep = `claude-opus-5-5`. Ruling: RULINGS 2026-11-05 D11 (Haiku chat and bulk, Sonnet live drafts, Opus only for the per-idea batch and capped escalation).
- Request body (`convex/ai/providers/anthropic.ts` `buildMessageParams`, line 277): `model`, `max_tokens`, `system` blocks, one user message, `thinking`, `output_config` (`effort`, and `format: json_schema` for structured output, or the schema in a system block for `outputMode: "prompted"`). No `metadata`, no `user_id`, no tools, no beta header, SDK retries off. Header allowlist and fixed host `https://api.anthropic.com` (`ANTHROPIC_BASE_URL`).
- Prompt caching: system blocks carry `cache_control: { type: "ephemeral", ttl: "5m" }` (`anthropic.ts:286`). `systemBlocksFor` (`convex/ai/gateway.ts:798`) puts the stable rules in block 1 and, for `per_business` prompts, the founder's business context in block 2, each with a cache breakpoint. So founder context is written to Anthropic's cache for 5 minutes.
- Streaming: Wren turns use `messages.stream` (`anthropic.ts`, WP77-S3 note).
- Batch API: only `crew-idea-seed@3` (`mode: "batch"`, `createAnthropicBatchAdapter`, `anthropic.ts:736`), from `convex/crew/seedsBatch.ts`. Input is the public idea page.
- Zero data retention, training opt-out, or a contract tier: nothing in code, docs or `.env.example` (grep for ZDR, retention, training). UNCONFIRMED. Anthropic's own retention for API and batch results: UNCONFIRMED.
- What is stored locally: `ai_usage` holds counts and cost, not text (`convex/admin/aiCosts.ts:31`). The reply is stored as the artifact (`documents.body`) or `chat_messages.body`.
- No tool loops (RULINGS 2026-11-05 D23). Founder text is quoted as JSON inside tagged blocks (`convex/ai/prompts/crewShared.ts` `quotedData`).

### 2.2 Prompts

Registered in `convex/ai/prompts/index.ts` `PROMPT_ENTRIES`. Nine entries.

| Prompt id@ver | Tier / mode | Builder files | Founder fields in the user message | Founder fields in the business-context block (system block 2) |
|---|---|---|---|---|
| `wren-chat@4` | fast, realtime, streamed | system `convex/ai/prompts/wrenShared.ts` `WREN_SYSTEM_RULES`; user `wrenTaskBlock`; context `convex/workspace/chat.ts` `wrenBusinessContext`, loaded in `loadWrenTurn` | `<founder_message>` (the founder's text); `<conversation_history>` = last 12 finished founder and Wren messages (`WREN_HISTORY_MESSAGES`, `lib/workspace/wren.ts:31`; `chat.ts` `loadWrenTurn`) | business name (`workspace.name` or `project.title`), `libraryIdea` slug, `founderIdea` (`ownIdeaText`), `platform`, `commercialModel`, `goal`, `partner.name` and `personality`, Wren memory (`summary`, `facts`), `approvable` (kind, table, id, label of items awaiting approval), `waitingOnYou` (names of pending reviews) |
| `wren-plan-turn@4` | draft, realtime, streamed | same files; chosen by the routing rule in `lib/workspace/wren.ts` when a turn changes the plan and an escalation is left | same as `wren-chat` | same as `wren-chat` |
| `crew-blueprint-own-idea@3` | draft, realtime | `convex/ai/prompts/blueprintOwnIdea.v3.ts`; inputs `lib/workspace/crew/inputs.ts` `blueprintStepPlan`; runner `convex/crew/generators.ts` | `<own_idea>` (founder's idea text), `<idea_outline>` (light outline built from it), `<founder_answers>` (below); on a revision: `<previous_draft>` (prior AI output) and `<founder_note>` (founder's change note, `convex/workspace/changeRounds.ts` `revisionNoteFor`) | crew context (`lib/workspace/crew/context.ts` `crewBusinessContext`): business `name`, `source`, `founderIdea`, `platform`, `commercialModel`, `goal`, Wren memory. No blueprint yet |
| `crew-blueprint-personalise@3` | draft, realtime | `blueprintPersonalise.v3.ts`; same builders | `<idea_seed>` and `<library_idea>` (public content), `<founder_answers>`; revision blocks as above | same crew context |
| `crew-brand-kit@3` | draft, realtime | `brandKit.v3.ts`; `brandKitStepPlan` | `<blueprint>` (stored blueprint JSON, derived from the founder's input), `<founder_answers>`, design candidates (static data), optional seed angles; revision blocks | crew context plus the stored `blueprint` |
| `crew-email-sequence@3` | draft, realtime | `emailSequence.v3.ts`; `emailSequenceStepPlan` | `<blueprint>`, `<brand>` (kit name, tagline, voice), `<founder_answers>`, optional `<idea_angles>` (public seed text); revision blocks | crew context plus `blueprint` |
| `crew-social-pack@4` | fast, realtime, `outputMode: "prompted"` | `socialPack.v4.ts`; `socialPackStepPlan` | `<blueprint>`, `<brand>`, optional `<idea_angles>`; no wizard answers; revision blocks | crew context plus `blueprint` |
| `crew-idea-seed@3` | deep, batch | `ideaSeed.v3.ts`; `convex/crew/seedRequest.ts` | `<idea_page>` = the published library idea page. No founder data | none (`business: "none"`) |
| `internal-registry-probe@2` | fast | `registryProbe.ts`, ownerless eval only | none | none |

`<founder_answers>` is built by `answersForPrompt` (`lib/workspace/crew/inputs.ts`): `platform` (including the custom description), `commercialModel`, `goal`, `name` (chosen and alternatives), `partnerPersonality`, and `signals` (kept or edited, with the optional `note` the founder typed). It leaves out the idea text (own block), `blueprintDecision` notes and `partnerName`.

Crew steps that call a model today are the four in `convex/crew/generators.ts` (blueprint, brand kit, email sequence, social pack) plus Wren chat. Other artifact kinds (SEO pack, launch plan, ads drafts, build pack) have no registered prompt: UNCONFIRMED whether they are built another way.

---

## 3. Other processors

Privacy policy status below is read from `app/(marketing)/privacy-policy/page.tsx` (last updated 29 Oct 2026) and `lib/legal/content.ts` `PRIVACY_MEMBERSHIP`. `app/(marketing)/terms/page.tsx` and the legal content name none of the vendors marked "not named".

| Processor | Founder-related data sent | Policy names it? |
|---|---|---|
| Anthropic | see section 2 | Not named. No AI processing text in policy or terms |
| Beehiiv | email, UTM, automation id (3.1) | Yes (email collection) |
| Google Analytics 4 | page views and events, after consent (3.2) | Yes, as "anonymized usage data" |
| Meta Pixel | page views and mirrored events, after consent (3.2) | Not named |
| Impact.com (Lovable affiliate script) | the visitor's browser requests a script from `utt.impactcdn.com` on every page, with no consent check (3.2) | Not named |
| Stripe / Link | email, order id, plan term (3.4) | Yes (Stripe; Link as merchant of record in the membership section) |
| Resend | magic-link email address and link (3.5) | Not named |
| Google (sign-in) | OAuth sign-in; Google returns email, name, picture (`convex/auth.ts` `Google`, `convex/authUser.ts` `googleProfile`) | Not named |
| Convex | primary database, hosting of backend code | Not named |
| Vercel | hosting, logs, Global Config (3.7) | Not named |
| OpenAI Images, Recraft | operator art only (3.3) | Not named |
| OpenAI, Perplexity, DataForSEO | public idea research only (3.6) | Not named |
| Luma, Cal.com | outbound links; Luma link gets copied UTM tags (`components/live/LumaRegisterLink.tsx`, `lib/live/attrib.ts`) | Luma: generic line about the "live session tool" |

### 3.1 Beehiiv

- Sign-up forms and idea email gate: `app/api/subscribe/route.ts` posts `email`, optional `first_name` (as custom field), `automation_ids` (allowlisted), `form_id`, `utm_source`, `utm_medium`, `utm_campaign` to `https://api.beehiiv.com/v2/publications/{id}/subscriptions` through `lib/beehiiv.ts` `beehiivSubscribe`. It also logs the email to Convex `subscriptions` (after the response, fire and forget).
- Account sign-up: `convex/accountBeehiiv.ts` `syncBeehiivAccount` sends the verified account `email`, `utm_source: "platform_account"`, `utm_medium: "account_creation"`, the account automation id, `double_opt_override: "on"`, `reactivate_existing: false`, `send_welcome_email: false`. It looks the email up first (`by_email`) and, for an active subscriber, posts a journey for the automation. Retries: max 5 (`MAX_ATTEMPTS`).
- Paid ship·able buyers: `app/api/stripe-webhook/route.ts` enrols the buyer email with `utm_medium: "paid"`.
- Rules file: `BEEHIIV_CURSOR_RULES.md`. Beehiiv retention and deletion: UNCONFIRMED (outside the repo).

### 3.2 GA4, Meta Pixel, Impact script

- Consent state: `components/consent/ConsentProvider.tsx`. Key `analytics_consent`, 365 days, kept in localStorage and mirrored to a cookie of the same name (line 50). The policy mentions localStorage only. One "Analytics" toggle in `ConsentCustomizeModal.tsx` covers both GA and Meta.
- Gate: `components/consent/AnalyticsScripts.tsx` renders nothing unless `consent === true`. It also skips `/email-signin`, `/auth/callback`, `/admin`, and tenant hosts. GA loads from `googletagmanager.com` with `anonymize_ip: true`; the `/preview/{token}` path and `claimPreview` param are redacted (`lib/analytics-redaction.ts`).
- Not excluded: `/dashboard/**`. Workspace URLs contain the Convex project id (`app/(launch-workspace)/dashboard/b/[projectId]/...`). A consenting founder's page path therefore reaches Google and Meta with that id. Whether GA4 sends later route changes with the same path: UNCONFIRMED.
- Meta Pixel loads from `connect.facebook.net` when `NEXT_PUBLIC_META_PIXEL_ID` is set. The id is documented in `README-ANALYTICS.md` and `docs/plans/2026-06-12-001-refactor-nextjs-convex-migration-plan.md:973`. The prod env value: UNCONFIRMED. The browser banner text says "analytics" only (`ConsentBanner.tsx`).
- Events: `lib/track.ts` `trackEvent` calls `gtag` and mirrors to `fbq` (map of standard events, others as custom events). Dashboard events use an allowlist of enum props (`DASHBOARD_EVENT_PROPS`, `trackDashboardEvent`). Other events carry: `email_domain` (the part after `@`, `components/forms/BeehiivSubscribeForm.tsx`), `idea_slug` (`components/workspace/BuildIdeaCta.tsx`), `button_text`, `tool`, `template`, `scroll depth`. A raw email never appears in props. No `user_id` is set anywhere (grep of `gtag(` and `set_user`). The ship·able purchase sends `value: 9` and a time-based `transaction_id` (`app/(marketing)/shipable/ShipableSeat.tsx:60`).
- Impact: `app/layout.tsx:14,35` injects a `beforeInteractive` script from `https://utt.impactcdn.com/...` on every page. No consent check, and it runs on `/dashboard` too. It calls `impactStat('transformLinks')` and `trackImpression`. Cookies or identifiers it sets: UNCONFIRMED (third-party code).
- Fonts: `next/font` self-hosts Geist and Newsreader at build (`app/layout.tsx`, `lib/fonts.ts`). No runtime request to Google Fonts found. Vercel Analytics, Sentry, PostHog and similar are not in `package.json`.

### 3.3 Image providers

- OpenAI Images (`gpt-image-2`) and Recraft adapters live in `convex/ai/providers/openaiImages.ts` and `recraft.ts`. `runImageGateway` (`convex/ai/gateway.ts:1213`) has no caller in `convex/`, `app/` or `lib/` outside tests. So no founder prompt reaches them today (D11 plans founder images later; UNCONFIRMED when).
- Operator-run only: `scripts/generate-crew-avatars.mjs` (Recraft, static avatar prompts) and `scripts/generate-og-cards.mjs` with `lib/og/providers/{openai,recraft}.mjs` (prompts from the public manifests). Keys: `OPENAI_API_KEY`, `RECRAFT_API_KEY`, `RECRAFT_STYLE_ID` (`.env.example`).

### 3.4 Stripe

- Membership checkout (`app/api/platform/membership/_server.ts` `checkoutSessionParams`): `customer_email` (account email) or an existing `customer` id, `client_reference_id` = our order id, `metadata` { `purpose`, `order_id`, `term` }, promotion codes on, terms consent required, Managed Payments on or automatic tax. Card, name and billing address are collected by Stripe and Link, not by us.
- Live Build-Along (`app/api/live/_server.ts`): `customer_email`, `customer_creation: "always"`, order metadata.
- Webhooks write ids and outcomes only: `billing_events` (no email, amount or payload).
- Legacy ship·able payments (`app/api/stripe-webhook/route.ts`): stores `email`, customer id, amount, currency, payment link in `stripe_events`. The route also logs the buyer email with `console.log` and `console.error` (lines 67-75 and 172-182), so it lands in Vercel runtime logs. Log retention: UNCONFIRMED.
- The public mutation `convex/payments.ts` `recordEvent` still accepts events from any client until the rollout's contract step removes it (file comment).

### 3.5 Resend

- Auth mail: `convex/resendMagicLink.ts` `deliverResendMagicLink` posts to `https://api.resend.com/emails` with `from`, `to` (the account email), subject "Confirm your Weekend MVP sign in", and html and text holding the sign-in link and code. Key `AUTH_RESEND_KEY`. It does not use the Convex component, so no Convex copy.
- Tenant mail: separate Resend project via the Convex component (`convex/growth/email/provider.ts`, `TENANT_RESEND_*`, test mode unless `TENANT_EMAIL_LIVE_ENABLED=true`). Sender, reply-to and postal address come from `business_email_settings`. Not reachable today (1.9).
- Retention at Resend: RULINGS 2026-11-06 says up to 30 days in the US for sent-email content and logs. That ruling is about tenant mail. For auth mail: UNCONFIRMED (likely the same provider terms).

### 3.6 Research engine

`lib/engine/providers/openai.ts` (`api.openai.com/v1/responses`), `perplexity.ts` (`api.perplexity.ai`), `keywordData.ts` (`api.dataforseo.com`), `sourceText.ts` (fetches cited public URLs). They run from operator scripts (`package.json`: `engine:research`, `engine:compile`, `publish:ideas`), not from Convex or Next routes (grep: no import of `engine/providers` outside `lib/engine` and tests). Inputs are public idea topics. Models pinned by RULINGS 2026-08-06 (`gpt-5.6-sol`). No founder data goes there. One handoff exists: `convex/ideaRequests.ts` `listForSuggest` exposes visitor-written request titles and problems, and its comment says the engine does not call it today.

### 3.7 Hosting and logs

- Convex prod in eu-west-1 (section 1). Convex backup retention and point-in-time options: UNCONFIRMED. Operator snapshots of prod were downloaded to ignored local files on 2026-10-04 (`docs/wp/backup-restore.md:97,130`). They predate the workspace tables but hold users and ideas data. Where they live now: UNCONFIRMED.
- Vercel: the Next app. `vercel.json` sets no `regions`, so function region is UNCONFIRMED. Request and runtime log retention: UNCONFIRMED. Tenant takedown writes a key built from the business slug to Vercel Global Config (`convex/platform/sites/takedown.ts`).
- Middleware sends security headers and `Referrer-Policy: no-referrer` on private routes (`middleware.ts`).

---

## 4. Client-side storage

| Name | Kind | What | Lifetime | File |
|---|---|---|---|---|
| `__Host-__convexAuthJWT`, `__Host-__convexAuthRefreshToken`, `__Host-__convexAuthOAuthVerifier` (no prefix on localhost) | cookie, httpOnly | Convex Auth session | session cookie (`cookieConfig: { maxAge: null }`) | `node_modules/@convex-dev/auth/dist/nextjs/server/cookies.js:23-25`; `middleware.ts:347,429` |
| `wmvp_signed_in` | cookie, readable | value `1`, hint that a session exists | session cookie; path `/`, SameSite Lax, Secure on https | `lib/auth-session-cookie.ts:9`; `middleware.ts:379` |
| `analytics_consent` | cookie and localStorage | `{value, timestamp}` | 365 days | `components/consent/ConsentProvider.tsx:14-50` |
| `weekendmvp_subscribed` | localStorage | `"true"` after a newsletter form | none set | `components/forms/BeehiivSubscribeForm.tsx:102`; `components/layout/SignupModal.tsx:77` |
| `wvm-idea-request-anon-id` | localStorage | random anonymous id | none set | `lib/idea-requests.ts:38` |
| `wmvp:pending-save` | localStorage | idea slug and title saved before sign-in | short window (`PendingSaveRunner`) | `lib/pending-save.ts:8` |
| `weekendmvp:own-idea-intake` | localStorage | random UUID (draft key, not the text) | none set | `components/platform/intake/OwnIdeaIntake.tsx:120` |
| `wmvp:dismissed:<id>`, `wmvp:workspace-sidebar`, `wmvp:ideas-layout`, `wmvp:idea-view`, `wmvp-live-banner-dismissed` | localStorage | UI preferences | none set (banner has a dismiss timestamp) | `components/platform/home/dismiss-state.ts:8`, `shell/sidebar-state.ts:7`, `explore/layout-pref.ts:10`, `public/IdeaBrowser.tsx:9`, `live/LiveBanner.tsx:20` |
| `wp27:claimPreview` | sessionStorage | preview capability token during sign-in | tab | `components/preview/PreviewClaimHandoff.tsx:32` |
| `wmvp:membership-checkout` | sessionStorage | term and start time | tab; 24 h max age | `components/platform/plan/checkout.ts:105` |
| `wmvp-live-attrib` | sessionStorage | first-touch UTM tags | tab | `lib/live/attrib.ts:7` |
| GA (`_ga*`), Meta (`_fbp`) cookies | cookie, set by vendors after consent | vendor ids | vendor-defined | UNCONFIRMED (not in repo) |
| Impact cookies | cookie, set by vendor | vendor ids | UNCONFIRMED | `app/layout.tsx:14` |

---

## 5. Retention facts found in code

| Item | Fact | Source |
|---|---|---|
| Preview capability | valid 7 days (`CAPABILITY_LIFETIME_MS`). Expiry is checked on read. No job deletes expired rows: the `by_expiresAt` index has no reader and no delete call exists | `convex/platform/preview/capabilities.ts:34,88`; RULINGS 2026-08-06 WP27 capability lifetime |
| Magic link | 1 hour (`EMAIL_MAGIC_LINK_MAX_AGE_SECONDS`) | `convex/resendMagicLink.ts:6` |
| Session | Library defaults: 30 days total, 30 days inactive, JWT 1 hour. No override in repo; `AUTH_SESSION_*` env in Convex: UNCONFIRMED | `node_modules/@convex-dev/auth/dist/server/implementation/sessions.js:4`, `refreshTokens.js:2`, `tokens.js:4` |
| `ai_usage.expiresAt` | A reservation sweep deadline (15 min realtime, 25 h batch), not a retention date. Nothing deletes `ai_usage` rows | `lib/workspace/contracts/metering.ts:247-255`; `convex/ai/metering.ts` `sweepStale` |
| Approval cards | open 7 days (`APPROVAL_PENDING_TTL_MS`) | `lib/workspace/contracts/approvals.ts:248` |
| Consent | 365 days | `ConsentProvider.tsx:15` |
| Anthropic prompt cache | 5 minutes | `anthropic.ts:286` |
| Tenant leads | deleted 30 days after an explicit "Delete business" or account closure (`LEAD_RETENTION_WINDOW_MS`). Archiving starts no timer. Dormant until `TENANT_LEAD_DELETE_REQUESTS_ENABLED=true`; prod value UNCONFIRMED. Hourly recovery cron | `convex/platform/sites/retention.ts:6,32`; `convex/crons.ts:31` |
| Resend component records | finalized 7 days, abandoned 30 days (daily crons) | `convex/crons.ts:26-29` |
| Resend (provider) | up to 30 days in the US, per ruling | RULINGS 2026-11-06 WP78/79 D5 contact deletion |
| Workshop seat hold | 35 minutes | `convex/schema.ts` `workshop_seats` comment |
| Credit ledger, audit events | append-only | `convex/platform/validators.ts:224`; RULINGS 2026-08-05 WP22 data lifecycle |
| Cached research (engine) | kept indefinitely; public data | RULINGS 2026-08-06 WP26 |
| Everything else in section 1 | no TTL or purge job found | grep of `db.delete` and `convex/crons.ts` |

### Rulings that bear on deletion (paraphrased)

- 2026-08-05, WP22 data lifecycle: no destructive deletion in v1. Records may be archived or soft-deleted. Ledger and audit stay immutable. Physical deletion, expiry or backfill needs a later policy and a separately gated migration. WP96 is that later work and needs a ruling row (see `docs/wp/wp96-stories.md` Notes).
- 2026-08-05, WP22 authorization: private data is owner-only. No support or admin bypass.
- 2026-08-05, WP22 documents: no user file uploads in v1.
- 2026-08-06, WP26: engine research kept indefinitely; a later privacy ruling may add expiry.
- 2026-08-07, WP28: tenant leads synthetic only until privacy and retention text exist.
- 2026-10-09, WP64: owner signed off the Terms, refund and membership privacy section. Company name and number lines are still an email placeholder.
- 2026-11-05, D5 tenant leads: real leads allowed once three things ship together: a privacy notice naming the founder as controller and Weekend MVP as processor, retention (kept while active, deleted 30 days after business deletion or account closure), and CSV export plus per-contact delete.
- 2026-11-05, D12: data is modelled by business; every row has `projectId` and `ownerId`.
- 2026-11-05, D22: ownerless AI usage for platform work.
- 2026-11-06, WP78 D5 timer: only an explicit "Delete business" or account closure starts the 30-day timer.
- 2026-11-06, WP78/79 D5 contact deletion: immediate erasure in Weekend MVP; disclosed limits are Resend's 30-day retention and that sent email cannot be recalled; component records cleaned after 7 days.
- 2026-11-06, WP78 D5 privacy work while off: export, per-contact delete and the due purge may run while the workspace is off.
- 2026-11-06, WP78-S4e2b2: an already-requested closure may keep scheduling its 30-day lead jobs while the workspace is off.

---

## 6. Gaps and UNCONFIRMED

- Anthropic: zero data retention, training opt-out, account or contract tier, and retention of API logs and batch results. Nothing in code or docs.
- Whether prod runs `AI_PROVIDER_MODE=live` today.
- Whether `NEXT_PUBLIC_META_PIXEL_ID` and `NEXT_PUBLIC_GA_ID` are set in the prod build (docs name both ids).
- What cookies or identifiers the Impact.com script, GA and Meta set.
- Whether GA4 sends SPA route changes (with the project id in the path) beyond the first `page_path`.
- Privacy policy and terms name no AI provider, Convex, Vercel, Resend, Google sign-in, Meta or Impact. (This is read from the page text; it is a gap to review, not a legal finding.)
- Beehiiv retention and its handling of a deletion request.
- Vercel function region, runtime log retention, and whether buyer emails from `app/api/stripe-webhook/route.ts` logs persist.
- Convex backup retention, and where the 2026-10-04 operator snapshots are kept.
- Resend retention for auth mail (the ruling covers tenant mail).
- Whether any `_storage` file exists in prod.
- Rate-limiter component row TTL for `ip:<address>` keys.
- Resend component stored fields, and how a Convex-side tenant email record is deleted by recipient.
- Whether old `idea_crew_seeds` rows carry a founder's `projectId`.
- Library cleanup of expired `authVerifiers`, `authVerificationCodes` and `authSessions` rows.
- `stripe_events` rows: cannot be found by founder (no email index). `rawPayload` has no writer, but older rows may hold one.
- `authVerifiers`: not linkable by founder.
- Whether an unsalted `offer_cohorts.emailHash` is personal data.
- Social tokens: `social_accounts.encryptedTokenRef` points somewhere outside this table; where is UNCONFIRMED.
- Whether SEO pack, launch plan, ads drafts and build pack are produced without a model call.
- Whether the dormant D5 and account-closure flags are on in prod.
- Whether any real (non-synthetic) lead exists in prod.
