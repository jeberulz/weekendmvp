# WP61 Progress - Weekend prompt standard and backfill

Append-only progress log. Do not rely on chat history for project state.

## 2026-10-07 - Setup

- Branch/worktree: `codex/wp61-prompt-backfill`, cut from `origin/main` at `4b442e8`. Independent of WP58 to WP60, which touch only homepage code. No worktree.
- Assignment: single agent. Lane: Program/Migration. Owner decisions: no billing in prompts, Branding Package stays required, backfill all 176 `ideabrowser` ideas.
- File boundaries: the prompts section of the 176 pages, `scripts/*prompt*`, `scripts/lib/idea-quality.mjs`, `scripts/audit-idea-mdx.mjs`, `ideas/SECTIONS.md`, `ideas/prompt-standard.json`, `tests/prompts/*`, docs. Not touched: other sections of any page, `ideas/manifest.json`, Convex, seeding, homepage code.
- Required checks: per wave, the lint and the audit baseline. At the end, typecheck, lint, test and build.
- Initial risks: unreviewed AI rewrites of customer-facing content, drift from each page's Stack and Business Model sections, and facts invented for an idea.

## 2026-10-07 - WP61-S1 to S3 (audit, standard, tooling)

- Audit, read-only, all 225 ideas:
  - 102 first prompts are a single line (88 of them `ideabrowser`).
  - 170 put Stripe or billing in prompt 1. 48 name four or more services there. 32 pair Clerk with Supabase, 13 with row rules.
  - 5 have any `Done when` line. 19 say what not to build.
  - 42% pin Next.js 14, 16% pin 15, 1% pin 16. The repo runs 16.3.
  - Only 2 ideas come from the engine. 176 come from `ideabrowser`.
  - The deep audit applies only to engine pages. It requires every Business Model tier name inside Project Setup (which forces billing into prompt 1) and a Branding Package prompt.
- Baseline: `npm run audit:idea -- --all` passed 198 of 227, with 29 failing for other reasons (saved as the comparison set). `audit:prompts` under standard v1: 0 of 225 pass. Errors by rule: `done-when` 749, `titles` 211, `branding-missing` 185, `setup-fence` 182, `setup-tables` 149, `setup-billing` 145, `next-pin` 139, `setup-structure` 119, `branding-tool` 40, `setup-auth-rls` 31, `setup-services` 20, `setup-auth` 4.
- Actions taken:
  - Wrote the standard into `ideas/SECTIONS.md`, and the lint in `scripts/lib/prompt-standard.mjs` with a report CLI (`npm run audit:prompts`).
  - Added the ratchet: `ideas/prompt-standard.json` lists the pages that must keep passing. `audit:idea` fails a listed page and warns once for the rest.
  - Relaxed the tier-in-setup rule in `scripts/lib/idea-quality.mjs`.
  - Added `tests/prompts` (21 tests) and `test:prompts` in the `npm test` chain.
  - Froze `docs/wp/wp61-program-manifest.md`: 9 waves, 176 slugs, 30 marked as taking payment as their function.
- Decisions made:
  - Exactly four prompts with fixed titles. The audit and engine already use them, and a fixed set makes the lint mechanical.
  - A `Do not build:` line may name billing without counting as using it.
  - A Setup that never mentions billing owes no tier names, so the standard is reachable for new ideas.
  - Payment may stay in Core Feature only where payment is the product's function. 30 ideas are marked for that.
  - A ratchet list, not a global error, so each wave locks in without failing the ideas not yet rewritten.
  - Not wiring `audit:idea` to error for unlisted ideas until the engine template is aligned (S7).
- Checks run:
  - `npx vitest run tests/prompts lib/engine/audit.redos.test.ts lib/engine/audit.page.test.ts`: 80 tests pass.
  - `npm run audit:idea -- --all`: the failing set is identical to the baseline. Every page gets the one-line warning.
  - `npm run engine:eval`: 3 of 3 gold pages ok.
- Gotchas the tests caught in my own lint, fixed before use:
  - The compliant fixture failed because its `Do not build: billing...` line named billing. A fence line must not count as using what it excludes. The tier check shares the same rule.
  - "Supabase (..., Auth with Google)" was not read as a login provider, and "nextjs 15" was not read as a pin.
  - The first pin regex would have flagged prose such as "next 7 days". It now needs `Next.js` or `nextjs` and a version.
- Next: wave 1 (pilot).

## 2026-10-07 - WP61-S4 (wave 1, pilot, 5 ideas)

- Ideas: `meeting-mood-ai`, `marketplace-meetup-safety`, `ai-code-coach-tutor`, `contractor-ai-receptionist`, `tattoo-dm-booking-agent`.
- Method: for each idea, printed a packet of its own facts (description, Solution, How it works, Tech Stack, Business Model tier names, the old prompts), wrote four prompts by hand, and applied them with a helper that rewrites only the prompts section, lints it, and refuses on any error. The helper and the per-wave source files live in the session scratchpad and are not committed, because the diff of the pages is the record.
- What changed and what was kept:
  - Kept each idea's own tables, columns, enums, copy, palette and rules (for example SafeMeet's rule that a spot is never shown as verified without a source and a date, and InkReply's rule never to invent an exact sleeve price).
  - Removed billing, plans, a second calendar provider, Clerk, extra services and version pins. Added a `Do not build:` fence and a `Done when:` line to every prompt.
  - Folded or dropped prompts outside the four: Code Coach's Freemium Gating (billing, now fenced), SafeMeet's Verified Spot Pipeline (an admin tool, now fenced, with its trust rule kept in Core Feature), the tattoo agent's separate Stripe and Calendar prompt (the deposit step moved into Core Feature, the calendar sync fenced).
  - Added Landing Page and Branding Package where an idea had none (tattoo agent, contractor receptionist's brand, SafeMeet, Code Coach), using only the page's own headline, steps and tone.
  - The standard flexes by stack. SafeMeet is Expo with Supabase, Code Coach is a local VS Code extension with no server (its "tables" are three local storage records from its own settings, cache and triggers), and the tattoo agent starts on a mock inbox because its own old Setup already did.
- MeetingMood AI, the evaluation's example, now: Google Calendar only with read-only scope in the same sign-in, one login, four tables with row rules, the service-role key marked server only for the Sunday job (which resolves the old "no admin read path" contradiction), a 4-week backfill at first sign-in, buttons plus keys alongside the swipe, three SQL group-bys instead of a regression, an empty state, and no billing.
- Checks run (gates in the manifest):
  - `npm run audit:prompts -- --slugs <the five>`: 5 of 5 pass. One warning, `core-billing` on the tattoo agent, which is intended because deposits are its function.
  - `npm run audit:idea -- --all`: 198 of 227, the failing set identical to the baseline of 29. None of the five pages carries a warning.
  - `npx vitest run tests/prompts`: 21 tests pass, and the ratchet test now lints the five.
  - Only the prompts section changed in each page, checked by comparing every other line against `HEAD`.
  - The homepage's prompt reader parses each page as four real prompts, and the first prompt is 15 to 17 lines, so all five can now be a weekly hero.
- Sampling: MeetingMood AI's section was read in full after applying. The other four were written from their packets and checked by the lint and the diff. They were not re-read line by line after applying.
- The `*` payment tag in the manifest is a keyword match. `marketplace-meetup-safety` matched on "marketplace" and takes no payment, so its Core Feature has none.
- Next: wave 2 (22 ideas).

## 2026-10-07 - WP61-S5, wave 2 (22 ideas)

- Ideas: the 22 slugs of wave 2 in the manifest (`adspark` to `ai-lesson-planner-teachers`).
- Method: the same as wave 1, written in four batches of 5 to 6 ideas, each dry-run through the lint before it was applied.
- What the lint caught while writing, all fixed in the prompts and not by weakening the rule:
  - A "Providers" line that said "Anthropic and Gemini come later" still counted as naming a service. The later providers moved into the `Do not build:` fence.
  - `usage_events` is on the engine's generic table list, so SpendLens counted two idea-specific tables instead of three. The call log was renamed to `proxied_calls`, which is what it is.
- One rule change, made because a prompt exposed a real false positive: a bare `checkout` no longer counts as billing. CartRescue's "a test abandoned checkout is stored" uses Shopify's word for a cart. The rule now matches `checkout flow`, `checkout page` and `checkout session`. A test and the standard's wording were updated, and the 16 ideas already on the list still pass.
- Scope calls made where an idea's own old prompts did not fit a weekend (each one is a cut, recorded here so a reviewer can overrule it):
  - ClientStack: n8n only, by API key. Make and Zapier, ROI reports and template deploys are fenced.
  - RelayOS: two mock tools, with Temporal kept because durable runs are the idea. Salesforce and HubSpot connectors are fenced.
  - AgentBay: payments, payouts and the edge proxy are fenced. The metered proxy is a route handler.
  - Billable: the proposal watchdog is the one feature. The scheduler is fenced, and approval before any send is a rule.
  - Coding Agent Dashboard: GitHub webhooks only. Cursor, Claude Code and Codex connectors, Slack and email are fenced.
  - Collectible Verification: sneakers only, with raw model output and the human-approved report kept apart, and no "guaranteed authentic".
  - Surepair and TrustBadge take payment as their function. Surepair keeps escrow in test mode in Core Feature, and TrustBadge fences payments and invoices the first audits by hand.
  - Stitchframe: one SKU and a six-plate sheet in place of the 60-page book. PromoBrain: a Sync now button in place of a nightly queue.
- Trailing go-to-market notes after the last fence (on `ai-builder-hiring-marketplace`, `ai-chief-of-staff-consultants` and `ai-course-tutor-companion`) were kept in place by the applier.
- Gates (`gates.sh`, the manifest's list), all pass:
  - `audit:prompts` for the wave: 22 of 22. Warnings are `core-billing` only, on ideas where payment is the function.
  - `audit:idea --all`: 198 of 227, the failing set identical to the baseline of 29.
  - Only the prompts section changed on every page.
  - The homepage prompt reader sees four real prompts and a first prompt of 8 or more lines on all 22.
  - `tests/prompts`: 22 tests pass, and the ratchet now lints 27 ideas.
- Sampling: the end of `ai-chief-of-staff-consultants` was read as it renders (the kept notes sit after the Branding block and agree with the new Core Feature rule). The rest were checked by the lint and the diff, not re-read line by line.
- Next: wave 3.

## 2026-10-07 - WP61-S5, wave 3 (22 ideas)

- Ideas: the 22 slugs of wave 3 in the manifest (`ai-material-estimator` to `ai-vocal-coach-realtime-pitch`). Same method as wave 2. All 22 passed the lint on the first dry run after the wave-2 rule changes.
- Scope calls where an idea's own old prompts did not fit a weekend (each is a cut a reviewer can overrule):
  - Embeddings: the old schemas use `vector(1536)` without naming a provider. Prompts say "an embeddings API that returns 1536 dimensions" with an `EMBEDDINGS_API_KEY`, and do not name one.
  - Code sandboxes and long media jobs: VerifiedAI grades written work only (no sandboxed code runner). CutReady and PodcastPilot run ffmpeg in a small separate worker and fence the queue service, audiograms, music matching and partial re-rendering.
  - Integrations cut to the idea's one core source: ProposalPro shares and tracks views in-app (no PDF, no email). MatchTutor records bookings and fences payments. MergeGate runs inline after replying to the webhook and fences Slack, Redis and billing. AgentLedger scans GitHub only and fences the usage APIs. SchemaLift's only inject method is a copyable script tag.
  - Mobile and desktop: TaskFocus is iPhone only, with calendar blocks read on the device and only the blocks sent. The Mac widget, Google Calendar and RevenueCat are fenced. AI Protein Tracker fences gap-fill suggestions, and HeroTales fences print and subscriptions.
  - Trust rules kept from the old prompts, because they are what the idea sells: HeroTales keeps photos private and deletable and never uses them for anything else, Collectible-style "never guaranteed" language was already in wave 2, MatchTutor stores a first name only, and Note By Note's "never invent an assignment".
- Notes:
  - `ai-prompt-optimization-marketers` carries one lint warning (`short`): its Landing Page prompt is brief because the page's one job is to link to the audit form.
  - HeroTales, TaskFocus and the music-teacher app are the first pages whose subject involves children's photos or lesson audio. Their prompts add consent, deletion and discard rules from the old FAQs. A human should check these three first.
- Gates (`gates.sh`), all pass:
  - `audit:prompts` for the wave: 22 of 22.
  - `audit:idea --all`: 198 of 227, failing set identical to the baseline of 29.
  - Only the prompts section changed on every page.
  - The prompt reader sees four real prompts and a first prompt of 8 or more lines on all 22.
  - `tests/prompts`: 22 tests pass, and the ratchet now lints 49 ideas.
- Sampling: the dry-run lint and the diff checked every page. No page from this wave was re-read line by line after applying.
- Next: wave 4.

## 2026-10-07 - WP61-S5, wave 4 (22 ideas)

- Ideas: the 22 slugs of wave 4 in the manifest (`ai-website-launch-rescue` to `creator-manufacturer-partnership-marketplace`). Same method as waves 2 and 3, written in four batches (6, 6, 5, 5). Every batch passed a dry run of the lint before it was applied.
- Scope calls where an idea's own old prompts did not fit a weekend (each is a cut a reviewer can overrule):
  - One source in place of a connector set: Persist takes pipeline data by CSV (Bullhorn, Recruit CRM and Crelate fenced). Refundra takes leads and transcripts by CSV (CallRail, Twilio and audio transcription fenced). NudgeLearn takes progress by CSV (Zapier and platform APIs fenced, email only, no SMS). Revoice takes orders by CSV (YouTube analytics, Kajabi and Teachable webhooks fenced).
  - Money kept out of the apps: Handsel moves no money. Escrow, milestone payouts and e-signature are fenced, and both parties confirm each milestone in the app. Revoice fences Connect splits and the 30 percent fee. Secondread gives fix effort in hours, not dollar quotes. BNPL for Digital Products keeps the plan test-mode only and records what would be advanced.
  - Automation fenced where the old prompt filed or held something for the user: Refundra drafts each claim and the contractor files it on the platform's own form (no Playwright). SellerShield flags orders and never holds fulfillment or submits a dispute. Secondread reads public repos only through a read-only token (no GitHub App, no private code, no stored file contents).
  - Embeddings dropped where full-text search is enough: HistoryPal uses Postgres full-text search over one figure's public-domain passages, so it needs one outside service, not two.
  - Numbers the old pages stated without a source were not copied into landing prompts. Refundra, Revoice and NudgeLearn use placeholders for a recovery story, a market figure and a completion lift. Competitor prices were removed from Secondread and ChatTracker landings.
  - Checks moved into code where the idea sells trust: ContractDecoder and Refundra drop any clause or quote that does not appear word for word in the source text. ChatTracker's briefing may cite only numbers in `insights.stats`. Secondread drops a finding whose file is not in the scanned tree.
- Notes:
  - Landing prompts that the old page used for a dashboard (NudgeLearn, Creator Launch Kit) were rewritten to the standard's landing shape.
  - HistoryPal is the first page in the program that serves minors in a classroom. Its prompts join students by class code and first name through anonymous sign-in, collect no student email, keep students from reading each other's chats, and label every answer as an AI answering from sources. A human should check this one first.
  - ContractDecoder (legal text) carries "not legal advice" and "never tell the user to sign" rules. BNPL for Digital Products (credit) is test-mode only. A human should check both.
  - `creator-manufacturer-partnership-marketplace` has go-to-market notes after the last fence. The applier kept them in place.
- Gates (`gates.sh`), all pass:
  - `audit:prompts` for the wave: 22 of 22, with no warnings after one fix (SellerShield's Core Feature said "billing address", so it now says "bill-to address").
  - `audit:idea --all`: 198 of 227, failing set identical to the baseline of 29.
  - Only the prompts section changed on every page.
  - The prompt reader sees four real prompts and a first prompt of 8 or more lines on all 22.
  - `tests/prompts`: 22 tests pass, and the ratchet now lints 71 ideas.
- Sampling: the dry-run lint and the diff checked every page. The 10 pages written in the last two batches were re-read once as authored. No page from this wave was re-read line by line after applying.
- Next: wave 5.

## 2026-10-07 - WP61-S5, wave 5 (22 ideas)

- Ideas: the 22 slugs of wave 5 in the manifest (`daily-ai-checkin-calls-for-seniors` to `invoice-payment-reconciler`). Same method as waves 2 to 4, written in four batches (6, 6, 6, 4). Every batch passed a dry run of the lint before it was applied. No lint warnings on any page.
- Scope calls where an idea's own old prompts did not fit a weekend (each is a cut a reviewer can overrule):
  - CSV in place of a connected source, so the idea's core check can be tested in a weekend: Income-Proof Generator (bank statements), MyTaxGuy (bank and payout exports), HealthSync (daily metrics), HR Insight Engine (employee file), Winnow (coded bills), Where's My Payment (invoices and deposits), GutCheck (ad results, no ad platform connection), Dispatchr (comment cards, no Meta, X or LinkedIn connection), LatePay (invoices).
  - Access that needs outside approval or a native app was fenced: Inbox Zero Agent is Gmail only, read and draft scopes, own account in Google's testing mode, no Chrome extension and no send. HydroTrail is a web app with the screen on (browser geolocation), not Expo with background location. Tendly reads one source (SAM.gov), with no scraper. The Helpdesk Cloner reads Zendesk with a token that is never stored, and writes nothing to the destination.
  - Money and filing kept out: Fanstart records pledges and charges nothing, so the "hold until the threshold" escrow is fenced and the first test measures pledge confirmation, not payment. ProofSet moves no money (no escrow, bids or vetting), so the quality gate is the product. MyTaxGuy never e-files and stores no identity fields. Its line table is checked against the current year's form instructions in place of line numbers in the prompt.
  - A model only where words are needed, with the checks in code: ProofSet's gate, SheetDoctor's detection and fixes, and the First International Hire Assistant's path and pack use no model. LatePay's score comes from a fixed rubric and the model only reads the proposal. HealthSync drops any insight with a number that is not in the computed summary. GutCheck rejects a batch where a variant changes two fields and never calls a winner under the conversion minimum.
  - Privacy rules kept or added where the data is personal: WellRing keeps text only (no audio), asks for consent and pauses on "stop". The Hold-Time Call Bot stores labels only. HealthSync sends no identifiers to the model. HR Insight Engine sends category names only and hides any group under 5 people. The Income-Proof Generator never says "verified" because the input is uploaded files.
  - Numbers and claims the old pages stated without a source were not copied into landing prompts: market and competitor prices, "79 percent of HR leaders", SOC 2, GDPR and CCPA badges, capture manager salaries and lift figures are placeholders or removed.
  - Several ideas have no product name in their old pages. Their Branding prompts say "pick a short working name" (First International Hire Assistant, Focus Session Timer, Income-Proof Generator, Helpdesk Cloner, Hold-Time Call Bot, HR Insight Engine, Inbox Zero Agent).
- Notes:
  - WellRing (older adults, phone calls), HealthSync (health data), MyTaxGuy (tax), the First International Hire Assistant (employment law) and the Income-Proof Generator (financial proof for lenders) are the pages in this wave that most need a human read. Each carries a "not advice" or "not verified" rule in Core Feature and in the landing page.
  - `fan-funded-creator-products` has go-to-market notes after the last fence. The applier kept them in place.
- Gates (`gates.sh`), all pass:
  - `audit:prompts` for the wave: 22 of 22.
  - `audit:idea --all`: 198 of 227, failing set identical to the baseline of 29.
  - Only the prompts section changed on every page.
  - The prompt reader sees four real prompts and a first prompt of 8 or more lines on all 22.
  - `tests/prompts`: 22 tests pass, and the ratchet now lints 93 ideas.
- Sampling: the dry-run lint and the diff checked every page. The pages were re-read once as authored. No page from this wave was re-read line by line after applying.
- Next: wave 6.

## 2026-10-07 - WP61-S5, wave 6 (22 ideas)

- Ideas: the 22 slugs of wave 6 in the manifest (`kdp-niche-finder` to `quickbooks-escape-ramp`). Same method as waves 2 to 5, written in four batches (6, 6, 6, 4). Every batch passed a dry run of the lint before it was applied, apart from two fixes the lint asked for: Fmttr's `documents` table became `posts` (a generic table name does not count toward the three idea tables), and TaskPatch's Project Setup named five no-code platforms that the lint read as five services, so the list moved to Core Feature. No lint warnings on any page.
- Scope calls where an idea's own old prompts did not fit a weekend, or could not be built honestly (each is a cut a reviewer can overrule):
  - **LeanScan** is the biggest cut. The old idea sold a muscle versus fat estimate from a phone scan. A photo without depth cannot support that, and the old page said "honesty is the feature". The prompts build a weekly photo read in the browser that charts shoulder and hip proportions as 4-week bands with a confidence cue, and fence body fat, muscle and DEXA claims. The owner should decide whether that is still the product.
  - **ProofCheck** drops the composite score and the ranking of applicants that the old page described, because both look like a consumer report and invite fair-housing risk. It keeps flags that quote evidence, never approves or denies, stores no applicant details beyond a label, and drops public records and eviction searches.
  - **CabinetSafe** has no model write any medical text. It shows the record as published with a link to its source, says "No record found in our data" and never "safe", and loads its interaction records from a CSV the builder assembles from published sources, since the old prompt did not say where they come from. The camera scan is fenced.
  - **BirthBuddy** runs a deterministic safety check before anything else, uses no model, drops providers, video and chat, and shows crisis resources from one config file checked against official sources. It is written for a few trusted testers only.
  - **Legato** shows no fees, dollar estimates or market-timing claims. It matches names against public list files imported by hand, with the snapshot date on every hit, and sends nothing on its own.
  - **WellnessIQ** drops the engaged versus disengaged ROI comparison, HRIS imports and wearables. The employer sees department totals through a database function that returns nothing for a group under 5.
  - **Downcrane** reads tilt only while a session is open (a web app cannot track all day), labels neck age an estimate, and asks for a physical therapist to review the stretches before launch.
  - **Photo-Based Health Tracker** covers meals only. The model names foods and grams, and the calories and macros come from USDA data in code. Workouts and Health app writes are fenced.
  - **Money kept out of the apps**: TaskPatch moves no money (no escrow or bump), the Escape Ramp writes nothing to a destination and only exports after the balances foot, and Legato has no fee exhibits.
  - **One source or CSV in place of a connector set**: NicheFinder (pasted listings, no scraper), Ratingwire (CSV with a Replay button, no review-site API), Market Close (Square and generic CSV), the Quarterly Tax Estimator (manual entry and CSV), Workframe (the student runs Python locally and uploads the output file, so no student code runs on the server), the n8n Academy (vault and grader only), Staffer (three tools, one send tool behind an approval), the Smart Meeting Scheduler (Google only, one host) and the Microschool platform (CSV roster, no parent logins).
  - **Claims dropped** because the old pages gave no source: the January 2027 MLC cliff, fee percentages, competitor prices, subreddit member counts and a lift or savings figure here and there.
  - Ideas with no product name in the old page got "pick a short working name" in Branding: the Smart Meeting Scheduler, the Microschool platform, the non-toxic appliance platform, the Photo-Based Health Tracker, the Quarterly Tax Estimator and the Escape Ramp.
- Notes:
  - A human should read these first: ProofCheck (housing), CabinetSafe (medicines), BirthBuddy (postpartum mental health), Legato (bereaved families), WellnessIQ (employer and health data), the Microschool platform (children's records), LeanScan (body image) and the Quarterly Tax Estimator (tax constants come from IRS tables, not from the prompt).
  - `one-star-attack-detection` has go-to-market notes after the last fence (the applier kept them in place). They still mention a yearly price.
- Gates (`gates.sh`), all pass:
  - `audit:prompts` for the wave: 22 of 22.
  - `audit:idea --all`: 199 of 227. The failing set is now 28: `one-star-attack-detection` left it (its old prompts were the cause) and none joined. The gate script prints DIFFERENT for that reason. The baseline file was replaced by the 28-item set; the original 29 are kept in the scratchpad.
  - Only the prompts section changed on every page.
  - The prompt reader sees four real prompts and a first prompt of 8 or more lines on all 22.
  - `tests/prompts`: 22 tests pass, and the ratchet now lints 115 ideas.
- Sampling: the dry-run lint and the diff checked every page. The pages were re-read once as authored. No page from this wave was re-read line by line after applying.
- Next: wave 7.
