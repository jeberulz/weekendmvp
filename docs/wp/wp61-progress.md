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

## 2026-10-07 - WP61-S5, wave 7 (22 ideas)

- Ideas: the 22 slugs of wave 7 in the manifest (`quiet-creator-personal-branding` to `tiktok-trend-predictor-creators`). Same method as waves 2 to 6, written in four batches (6, 6, 6, 4). Every batch passed a dry run of the lint before it was applied. No lint warnings on any page.
- One lint change, made because a prompt exposed a real false positive: the product "Catalog Clerk" tripped the Clerk login rule (and the Clerk with Supabase rule). `scripts/lib/prompt-standard.mjs` now strips that product name before it checks services and logins, and `tests/prompts` has a test that the name passes and a real "sign in with Clerk" still fails. The new test was checked to fail without the change. 23 tests pass.
- Scope calls where an idea's own old prompts did not fit a weekend, or could not be built honestly (each is a cut a reviewer can overrule):
  - **The Shopify apps** (Knownly, Catalog Clerk, ReviewIQ, the SEO Keyword Tool, Trust Layer) run against one development store with a custom app token. OAuth installation, App Bridge and the App Store path are fenced. Catalog Clerk stops at a scan, a dry-run plan and a runbook, because a wrong mutation changes a live store, so apply and rewind are the next package. The SEO tool reads the store and writes nothing back. Trust Layer reads public HTML only (5 pages, robots.txt honored, no screenshots or model) with a rubric file that names its sources.
  - **ReviewIQ** takes reviews by CSV. The old page said the Admin API, but Shopify has no first-party review feed, so the review app's export is the real source.
  - **Runway** takes invoice-line CSVs. The lint treats a payment processor named in Project Setup as billing, so the processor connection is the next step, which also fits a weekend.
  - **Recur** fixes a gap in its own spec. The old detector dropped any group with under 3 charges, which hides annual charges (24 months holds at most 2). The prompt shows an annual pair as "possible" with confidence capped at 0.7. Cancellations count as done only when a later statement shows no new charge.
  - **Verdicts and numbers decided in code**: the Feature Usage Auditor decides Keep, Investigate or Sunset by written rules and only asks the model for the paragraph. It reads the export in the browser and sends only hashed totals. Buildline and Coinstack compute their scores in code and check that any text the model writes only repeats real numbers.
  - **Honest claims**: TrendScout no longer promises a peak time or scrapes anything, and measures how often its flags helped. ClearChain says "documents on file, confirmed by the brand" and encodes no named law. Buildline reads GitHub counts and a 10-second check-in (no wearables or calendar) and rejects clinical words. RentGuard says tamper-evident, not tamper-proof.
  - **Sending and reading kept behind a person**: Transom sends nothing to a lead without an approval click. SlackToDoc reads only the thread it is mentioned in.
  - **Smaller cuts**: Monthlii is the operator console only (no client portal) and every percentage is typed by the operator, with no default salary or tax rate. ShopAutopilot imports Seller Center CSVs and uses the EasyPost test key. AdMotion renders in the browser with ffmpeg.wasm and uploads nothing.
  - Ideas with no product name in the old page got "pick a short working name" in Branding where needed (the Feature Usage Auditor and the SEO Keyword Tool).
- Notes:
  - A human should read these first: RentGuard (the state letter template needs a lawyer, and it is one state), Monthlii (the tax and CPA boundary), TextTrack (business texting rules), SlackToDoc (it reads work messages), ClearChain (what the public page may say), Buildline (wellbeing-adjacent), Recur and Coinstack (money habits) and Home Upkeep (it must not read as an inspection).
  - AdMotion's biggest risk is browser limits: a 15-second 1080p render with ffmpeg.wasm may be slow or run out of memory. That is the first thing to test.
  - `shopify-trust-scanner` has go-to-market notes after the last fence (the applier kept them in place).
- Gates (`gates.sh`), all pass:
  - `audit:prompts` for the wave: 22 of 22.
  - `audit:idea --all`: 200 of 227. The failing set is now 27: `shopify-trust-scanner` left it and none joined. The baseline file was replaced by the 27-item set.
  - Only the prompts section changed on every page.
  - The prompt reader sees four real prompts and a first prompt of 8 or more lines on all 22.
  - `tests/prompts`: 23 tests pass, and the ratchet now lints 137 ideas.
- Sampling: the dry-run lint and the diff checked every page. The pages were re-read once as authored. No page from this wave was re-read line by line after applying.
- Next: wave 8.

## 2026-10-07 - WP61-S5, wave 8 (22 ideas)

- Ideas: the 22 slugs of wave 8 in the manifest (`timed-tool-access-contractors` to `book-formatting-for-self-publishers`). Same method as waves 2 to 7, written in four batches (6, 6, 6, 4). Every batch passed a dry run of the lint on the first try. No lint warnings on any page. No lint or auditor code changed in this wave.
- Scope calls where an idea's own old prompts did not fit a weekend, or could not be built honestly (each is a cut a reviewer can overrule):
  - **Access that is not open on every plan**: Tempkey covers Trello only, where the API can add and remove a board member. Slack, Google Workspace and Notion removals need admin plans or APIs that are not open to every customer, so they are the next package.
  - **Money kept out of the apps**: OffHours (requests only, no payment or insurance), Gigvow (shifts, claims and reliability, no escrow), VibeCoders (matching and vetting, no payouts), Vintage Ride Revival (a catalog and a reviewed supplier flow, no payments).
  - **Safety lines held**: Vintage Ride Revival lists non-safety parts only and refuses a safety-critical part at upload. Every request page says the part is not tested for road safety, and a low-confidence photo match goes to a person. Repair Estimate Translator only lets lines on a fixed safety-system list say a delay is a safety risk, and prices come from the shop, never from the model.
  - **Nothing posts, sends or merges on its own**: WikiKeeper opens a pull request for a person and never commits to the main branch. The AI Search Publicist drafts pieces for the freelancer to publish and promises no placement (no money-back, no score, no outreach). Pagely never invents a testimonial or a lift figure. Handraised sends code only when the student confirms a hint request.
  - **Honest reframing**: AlgoAlly stops claiming to detect "algorithm shifts". It reports what moved in a tracked cohort against its own 30-day norm, with the sample size on every number and an age window so views per day are comparable. Firstflow takes hours only from what the owner typed. FormatFlex does not claim to be "KDP-ready" and checks its EPUB with EPUBCheck in a test.
  - **One platform or source in place of a connector set**: Doctor Debug (n8n), TourChat (a WhatsApp test number and approved templates), AccountCoach (no embeddings), the Smart Feedback widget (Postgres rate limit in place of Redis), Sayso (copy and CSV in place of a write to a field service tool) and the Nutrition Planner (a printable page in place of a client portal).
  - **Sayflow** is macOS only, has no voice trigger and no undo, never records keys typed into a password field, and stops on three Escape presses.
  - **Children and messaging**: TeamComm holds parents' contact details and a child's first name only, parents opt in themselves, a roster CSV imports names and emails only, and replies use a plain YES or NO grammar with no model.
- Notes:
  - A human should read these first: Vintage Ride Revival (safety), AccessCheck (it must never read as legal advice), the AI Search Publicist (what counts as an honest placement), TeamComm (children's data and business texting), Handraised (students' code), the Nutrition Planner (health, with a calorie floor kept in one config file), Sayflow (OS-level input capture), TourChat (WhatsApp template rules) and Doctor Debug (redaction before the model).
  - Two things to test early, because they depend on platform limits: AccessCheck runs a serverless Chromium on Vercel (package size and time limits), and the wave 7 AdMotion renders video in the browser.
  - `website-accessibility-ada-scanner` and `wedding-event-staffing-marketplace` have go-to-market notes after the last fence (the applier kept them in place).
- Gates (`gates.sh`), all pass:
  - `audit:prompts` for the wave: 22 of 22.
  - `audit:idea --all`: 200 of 227, the failing set identical to the baseline of 27.
  - Only the prompts section changed on every page.
  - The prompt reader sees four real prompts and a first prompt of 8 or more lines on all 22.
  - `tests/prompts`: 23 tests pass, and the ratchet now lints 159 ideas.
- Sampling: the dry-run lint and the diff checked every page. The pages were re-read once as authored. No page from this wave was re-read line by line after applying.
- Next: wave 9 (17 ideas), then the program gate.

## 2026-10-07 - WP61-S5, wave 9 (17 ideas)

- Ideas: the 17 slugs of wave 9, the last wave in the manifest (`conversational-analytics-digest` to `wedding-flower-pinterest-budget`). Same method as waves 2 to 8, written in three batches (6, 6, 5). Every batch passed a dry run of the lint on the first try. No lint warnings on any page. No lint or auditor code changed in this wave.
- Scope calls where an idea's own old prompts did not fit a weekend, or could not be built honestly (each is a cut a reviewer can overrule):
  - **Rights and likeness**: the Ad Licensing Desk lists a post only when the creator's agreement is recorded with a note, and records payments and refunds for the operator without making them. The Retro Ad Generator lets the image model draw the backdrop only. The logo, the product and the words are placed by code, a test checks the logo is pixel-identical, and a deny list refuses celebrities and brands the user does not own.
  - **A child's film**: Highlight Reel is manual. The parent marks the plays, the reel is an ordered playlist of clips on a private, expiring, noindex page, and the player and ball tracking are fenced. Delete removes the Mux assets.
  - **Terms and data sources**: Listening Brief reads Reddit through the official read-only API, tells the builder to check Reddit's current commercial terms, has every draft disclose who is writing and never posts. Recall Radar and Vehicle Recall Alerts use one public government feed each, word every alert as a possible match and never pause or edit anything.
  - **Numbers from data, not from a model**: the Analytics Digest drops any insight whose number is not in the computed facts and says "not enough data" for a small site. The Wedding Flower Budget prices from a wholesale sheet you fill in and a markup range, lists unknown flowers as not priced and builds swap-downs by rule. StorefrontMatch computes nothing: each fact shows who entered it and when. The Video Funnel Builder hides any percentage under 30 viewers.
  - **No money in the apps**: Last 20 (free pilot), Smallshelf (order requests, no payout), the Virtual Knowledge Hub (booking and a library, no payment) and the Ad Licensing Desk.
  - **A simpler engine in place of a heavy one**: the Knowledge Hub matches with full-text search, tags and one re-rank, with no embeddings. Markmint draws the PDF directly with react-pdf, with no headless browser, and records the export time. The Lightroom Preset Generator measures images in the browser and maps differences to sliders by documented formulas, with no vision model, and leaves white balance alone.
  - **Privacy at the edge**: the Single-Event App Builder strips location data from guest photos, approves each photo by hand and keeps guest emails and RSVPs out of the keepsake. Lead Magnets store an email only with a consent line.
- Notes:
  - A human should read these first: Highlight Reel (a minor's video), the Ad Licensing Desk (rights), the Retro Ad Generator (likeness and brands), Listening Brief (Reddit's terms), Vehicle Recall Alerts and Recall Radar (safety wording), the Single-Event builder (guest photos) and the Knowledge Hub (advice disclaimers).
  - Two things to test by hand before trusting them: the Lightroom preset file must import in Lightroom Classic with the sliders landing on the listed values, and the Markmint export time should be read from a real run.
  - `markdown-client-proposals` has go-to-market notes after the last fence (the applier kept them in place).
- Gates (`gates.sh`), all pass:
  - `audit:prompts` for the wave: 17 of 17.
  - `audit:idea --all`: 200 of 227, the failing set identical to the baseline of 27.
  - Only the prompts section changed on every page.
  - The prompt reader sees four real prompts and a first prompt of 8 or more lines on all 17.
  - `tests/prompts`: 23 tests pass, and the ratchet now lints 176 ideas, which is every `ideabrowser` idea.
- Sampling: the dry-run lint and the diff checked every page. The pages were re-read once as authored. No page from this wave was re-read line by line after applying.
- Next: the program gate (S6).

## 2026-10-07 - WP61-S6 and S7, program gate

- Result: all 176 `ideabrowser` ideas have four build prompts that pass weekend prompt standard v1, and all 176 are on the ratchet list `ideas/prompt-standard.json`. `npm run audit:prompts -- --source ideabrowser` reports 176 of 176. Across all 225 live ideas it reports 176 of 225. The other 49 ideas (other sources) fail the standard, as scoped; they are reported, not rewritten.
- The gate was run twice, each check on its own exit code (`program-gate.sh` prints one exit line per check).
  - First run: `audit:prompts` 0, `typecheck` 2, `lint` 0, `npm test` 1, `build` 0. Two real findings, one more found while reading the output:
    - `typecheck`: three `@ts-expect-error` comments in `tests/prompts/prompt-standard.test.ts` were unused, because `allowJs` types the `.mjs` modules. Removed.
    - `npm test`: `lib/engine/replay.test.ts` failed. The warning added in S3 ("prompt standard v1: 7 issue(s)") fired on the engine's own compiled page, and that test expects a compiled page with no warnings. This was S7, which the manifest had left conditional. It was needed now, so it was done.
    - `audit:prompts --json` cut its output off at 64 KB when piped, because the script called `process.exit` right after a large write. It now sets `process.exitCode`.
  - Final run, on the final tree: `audit:prompts` 0 (176 of 176), `typecheck` 0, `lint` 0, `npm test` 0 (every sub-suite; the engine suite runs 1,076 tests and the prompts suite 23), `build` 0.
- S7, the engine template (`lib/engine/compile.ts`): Project Setup no longer carries the Stripe catalog, the plan column, the Stripe price env vars or the `usage_events` table. Every prompt now has a `Do not build:` or `Done when:` line as the standard asks, Branding opens by saying to use a design tool, and the Landing prompt ends in a waitlist. The idea's pricing proposal and competitor strip stay in the Landing prompt. The prompts still hold no figure of their own, which the engine's own audit checks. Two `compile.test.ts` assertions were updated (the pricing string now sits in the Landing prompt, and Project Setup is checked against the standard). A new test compiles the engine fixture and lints it; it was checked to fail on the old template. One ruling row records the waitlist change, for the owner to overrule.
- `audit:idea --all`: 200 of 227. The failing set is 27, a strict subset of the original 29: `one-star-attack-detection` and `shopify-trust-scanner` now pass, and no page joined it.
- The branch: 193 files changed against `main`. The content change is the prompts section of 176 pages, the ratchet list, the lint and its tests, the auditor rule, the engine template and the docs. No `seed:convex`, no deploy, no Convex change, no manifest change and no PR.
- Sampling, stated plainly: every page passed the lint on a dry run before it was applied, and a diff check showed only the prompts section changed on every page. The pages were re-read once as authored. The agent did not re-read any page line by line after applying, so the 176 pages have had a machine check and one authoring pass, and no human read.
- What a human reviewer still owes (the pages where being wrong costs the most), grouped by why:
  - Children and students: HeroTales, TaskFocus, the music-teacher app, HistoryPal, the Microschool platform, TeamComm, Highlight Reel.
  - Health and the body: WellRing, HealthSync, CabinetSafe, BirthBuddy, WellnessIQ, LeanScan, the Nutrition Planner, Downcrane, the Photo-Based Health Tracker.
  - Money, tax and law: BNPL for Digital Products, ContractDecoder, MyTaxGuy, the Income-Proof Generator, the Quarterly Tax Estimator, Monthlii, the First International Hire Assistant, ProofCheck, RentGuard, Legato, AccessCheck, the Ad Licensing Desk, the Retro Ad Generator.
  - Safety and public claims: Vintage Ride Revival, Recall Radar, Vehicle Recall Alerts, ClearChain, the AI Search Publicist, Listening Brief (Reddit's terms).
  - Messaging and capture: TextTrack, TourChat, Sayflow, SlackToDoc.
- Product calls made by the agent that the owner may overrule are in each wave's entry. The biggest: LeanScan no longer promises a fat or muscle estimate, ProofCheck has no composite score, Fanstart records pledges and charges nothing, and every marketplace in the program moves no money.
- Checks that only a person can do: import the Lightroom preset in Lightroom Classic and confirm the sliders land on the listed values, read a real Markmint export time, and try the platform-limit risks (AccessCheck's serverless Chromium on Vercel, AdMotion's in-browser video render).
- Follow-ups, none started:
  - Rewrite or retire the 49 other-source ideas, then flip the `audit:idea` warning to an error for any idea not on the ratchet list.
  - The `/publish-idea` skill was not checked or changed in this program. It should point new ideas at the standard.
  - No pull request is open for WP61. Its branch starts from `main`. The WP58, WP59 and WP60 branches are stacked on each other and also have no pull requests.
