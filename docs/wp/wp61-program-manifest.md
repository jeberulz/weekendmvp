# WP61 Program Manifest - Weekend prompt standard backfill

Source of truth for the WP61 Program/Migration lane. Frozen at the start of the backfill. Workers may not re-scope an entry. If reality disagrees with this manifest, stop and escalate.

Branch: `codex/wp61-prompt-backfill`
Lane: Program/Migration (a content change across 176 pages, with a rule change to the auditor)
Standard: `ideas/SECTIONS.md`, "Weekend prompt standard v1". Lint: `npm run audit:prompts`.
Rulings: `docs/wp/RULINGS.md` (2026-10-07 WP61 rows).
Owner decisions (2026-10-07): no billing in prompts, Branding Package stays required, backfill all 176 `ideabrowser` ideas.

## Why

An audit of all 225 ideas found: 102 first prompts are a single line, 170 put Stripe or billing in prompt 1, 48 name four or more services there, 32 pair Clerk with Supabase, 5 have a `Done when` line, and 42% pin Next.js 14 while the repo runs 16. 176 ideas come from the older `ideabrowser` source. MeetingMood AI, featured that week, showed the pattern: Clerk, Stripe, two calendar providers, Resend and an LLM in one paragraph, with an OAuth step that no prompt covered.

## Scope

- In: the `## AI Prompts to Build This` section of 176 `content/ideas/*.mdx` files whose manifest `source` starts with `ideabrowser:`. Four prompts each, to standard v1.
- In: the auditor rules (`scripts/lib/idea-quality.mjs`), the lint (`scripts/lib/prompt-standard.mjs`), `ideas/SECTIONS.md`, the ratchet list `ideas/prompt-standard.json`.
- Out: every other section of every page, `ideas/manifest.json`, Convex data, seeding, OG art, deploys. No `seed:convex`. Checked-in MDX is canonical for ideas that are not editorially released (`lib/canonical-idea-body.ts`), so a merge is the only release step.
- Out: the 49 ideas from other sources. They are linted and reported, not rewritten.
- Last wave, if the earlier waves hold: align the engine compiler's Project Setup template (`lib/engine/compile.ts`) to the standard, so new ideas start compliant.

## Gates (every wave)

1. `npm run audit:prompts -- --slugs <wave>` reports zero errors.
2. `npm run audit:idea -- --all` has no new failure against the baseline of 29 failing pages (198 of 227 passed before WP61).
3. Every wave slug is added to `ideas/prompt-standard.json`, sorted. `tests/prompts` then lints it forever.
4. Only the prompts section of each page changed (checked by diff).
5. `npm run typecheck`, `npm run lint`, `npm test` and `npm run build` pass at the end of the program, not on every wave.
6. Commit and push per wave. Rollback is `git revert` of one wave commit.

## Rewrite rules

A rewrite keeps what is specific to the idea (its tables, its core feature, its copy, its palette) and changes only what the standard asks. Billing, plans, extra providers and unneeded services go. Facts about the idea are never invented: a table, feature or claim must come from the page's own Solution, How it works, Tech Stack or existing prompts. Where the old prompts had a feature prompt that is not Core Feature or Landing Page, it folds into Core Feature as numbered steps. Ideas marked `*` matched a payment keyword in their title or description (invoice, payout, checkout, marketplace and similar). It is a hint, not a finding. Check each one. Only where taking payment really is the product's function may Core Feature keep a payment step.

## Waves

| Wave | Name | Ideas | Slugs (`*` = payment keyword match, check) |
|---|---|---|---|
| 1 | Pilot | 5 | `meeting-mood-ai`, `marketplace-meetup-safety`*, `ai-code-coach-tutor`, `contractor-ai-receptionist`, `tattoo-dm-booking-agent` |
| 2 | Wave 2 | 22 | `adspark`, `adventure-date-night-app`*, `agent-storefront-platform`*, `ai-agency-automation-control-panel`, `ai-agent-workflow-platform`*, `ai-api-cost-optimizer-indie-builders`, `ai-api-docs-generator`, `ai-app-security-badge`, `ai-arbitrage-agent-resellers`*, `ai-bookkeeping-for-freelancers`, `ai-builder-hiring-marketplace`*, `ai-cart-rescue-emotional-emails`, `ai-chief-of-staff-consultants`, `ai-coding-agent-dashboard`, `ai-collectible-verification-platform`, `ai-content-factory-human-qc`, `ai-course-tutor-companion`, `ai-cpg-packaging-designer`, `ai-dance-form-coach`, `ai-fashion-lookbook-studio`, `ai-flash-sale-creator-for-shopify`, `ai-lesson-planner-teachers` |
| 3 | Wave 3 | 22 | `ai-material-estimator`, `ai-meeting-copilot`, `ai-merge-inspector`, `ai-podcast-producer`, `ai-practice-plan-generator-music-teachers`, `ai-product-data-cleaner-for-ecommerce`*, `ai-prompt-optimization-marketers`, `ai-proposal-generator-consultants`, `ai-protein-tracker`, `ai-schema-markup-tool`*, `ai-sentiment-landing-page-design`, `ai-site-design-blueprints`, `ai-slide-deck-maker`, `ai-startup-governance-copilot`, `ai-storybook-generator-for-kids`, `ai-student-support-bot-online-educators`, `ai-top-three-task-widget`, `ai-travel-planner`, `ai-tutor-matchmaker`*, `ai-verified-freelancer-marketplace`*, `ai-video-editor-for-creators`, `ai-vocal-coach-realtime-pitch` |
| 4 | Wave 4 | 22 | `ai-website-launch-rescue`, `ai-website-redesign-service`, `ai-workflow-library-solopreneurs`, `ai-writing-coach-freelancers`, `ai-youtube-script-generator`, `ai-zoning-intelligence`, `anti-ghosting-recruitment-crm`, `automated-multi-modal-marketing-tools`, `aws-cert-ai-study-buddy`, `bnpl-for-digital-products`*, `branded-client-portal-builder-for-freelancers`*, `career-transition-escape-plan`, `chargeback-protection-for-ecommerce-sellers`*, `chat-with-historical-figures`, `chattracker`, `code-audit-for-ai-built-apps`, `contract-analyzer`, `contractor-lead-refund-automation`*, `course-completion-nudge-platform`, `course-translation-resale-network`, `creator-launch-kit`, `creator-manufacturer-partnership-marketplace`* |
| 5 | Wave 5 | 22 | `daily-ai-checkin-calls-for-seniors`, `data-freelancer-bounty-board`*, `etsy-seo-optimizer`, `excel-formula-repair-ai`, `fan-funded-creator-products`, `feed-free-social-workspace`, `first-international-hire-assistant`, `focus-session-timer`, `freelancer-income-proof-generator`, `freelancer-late-payment-predictor`*, `freelancer-tax-filing-bot`, `gamified-coding-rpg`, `government-contract-finder`, `gutcheck-ai-ad-optimization`, `healthsync-personal-health-dashboard`, `helpdesk-workflow-migration-cloner`, `hold-time-call-bot`, `hr-insight-engine`, `hydration-app-for-hikers`, `inbox-zero-agent`, `invoice-coding-error-scanner`*, `invoice-payment-reconciler`* |
| 6 | Wave 6 | 22 | `kdp-niche-finder`, `landlord-tenant-risk-screener`, `markdown-publish-everywhere`, `medication-interaction-checker`, `meeting-scheduler`, `microschool-admin-platform`, `music-royalty-recovery-heirs`, `n8n-freelancer-academy`, `no-code-ai-agent-platform`, `nocode-specialist-repair-marketplace`*, `non-toxic-appliance-verification-platform`, `on-device-privacy-ai`, `one-star-attack-detection`, `payment-reconciliation-market-vendors`*, `personalized-employee-wellness-platform`, `phone-body-composition-scanner`, `phone-neck-score-app`, `photo-meal-workout-tracker`, `postpartum-recovery-platform`, `python-training-for-professionals`, `quarterly-tax-estimator-freelancers`*, `quickbooks-escape-ramp` |
| 7 | Wave 7 | 22 | `quiet-creator-personal-branding`, `real-estate-workflow-automation`, `rental-property-maintenance-dashboard`, `renter-deposit-documentation-app`, `s-corp-monthly-finance-desk`, `saas-feature-usage-auditor`, `saas-financial-toolkit`, `shopify-ai-support-context`, `shopify-b2b-wholesale-setup`, `shopify-review-intelligence`, `shopify-seo-keyword-tool`, `shopify-trust-scanner`, `skill-path-course-finder`, `slack-to-notion-docs`, `sms-time-tracker`*, `solo-founder-health-score`, `static-ad-to-video-generator`, `subscription-audit-assistant`, `supply-chain-transparency-platform`, `three-minute-money-habit-app`, `tiktok-shop-fulfillment-automation`, `tiktok-trend-predictor-creators` |
| 8 | Wave 8 | 22 | `timed-tool-access-contractors`, `underused-venue-marketplace`*, `vibe-coders-for-hire`, `vintage-ride-revival-3d-printed-parts`*, `voice-copilot-field-technicians`, `voice-desktop-workflow-macros`, `website-accessibility-ada-scanner`, `wedding-event-staffing-marketplace`*, `whatsapp-tour-guide-comms`, `workflow-audit-app-for-small-businesses`, `youth-sports-team-messaging-hub`, `youtube-algorithm-alerts`, `ai-accountability-coach`, `ai-agent-error-translator`, `ai-coding-classroom-assistant`, `ai-feedback-triage-widget`, `ai-landing-page-generator-ecommerce`, `ai-nutrition-planner-trainers`, `ai-search-publicist-freelancers`, `ai-wiki-keeper`, `auto-repair-estimate-translator`, `book-formatting-for-self-publishers` |
| 9 | Wave 9 | 17 | `conversational-analytics-digest`, `customized-lead-magnets`, `high-school-athlete-highlight-reel`, `last-20-builder-rescue`, `lightroom-preset-generator`, `markdown-client-proposals`, `recall-radar-ecommerce-sellers`, `reddit-discord-listening-cmos`, `retro-ad-generator`, `single-event-app-builder`, `small-order-wholesale-marketplace`*, `small-town-storefront-marketplace`*, `vehicle-recall-alert-service`, `video-sales-funnel-builder`*, `viral-ad-licensing-dtc`, `virtual-knowledge-hub`*, `wedding-flower-pinterest-budget` |

Order: the pilot spans a single-line prompt, a payments idea, a five-prompt idea and an already-structured one. After it, ideas that can be featured on the homepage come first (148 of 176), then the rest, each group alphabetical.

## Risks

- Unreviewed AI rewrites of customer-facing content. A human samples each wave before merge. The program records the sampling it did, not a claim of review.
- A rewrite that drifts from the page: Stack and Business Model sections still name Clerk, Stripe and tiers. The prompt says what to leave out this weekend, and the page keeps the full-product picture.
- The auditor ratchet fails a later edit to a listed page that breaks the standard. That is intended.

## Result

All nine waves landed and passed their gates, and the program gate passed on the final tree (176 of 176; typecheck, lint, test and build each exit 0). The engine template was aligned too (S7). The evidence, the calls made and the human review still owed are in `docs/wp/wp61-progress.md`.
