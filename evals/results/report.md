# Idea content quality report

Generated 2026-10-01 by `npm run evals:run -- --all --report`. Do not edit by hand.

Layers run: 0-3 (live). Layer 1 extracts factual claims; Layer 2 checks them against each page's cited sources. Layer 3 is the judge panel.

Run: 6 model call(s), $0.03 spent, 6 failed call(s); links: 1560 checked, 69 dead, 289 blocked by bot walls, 19 unknown.

Layer 0 is the free, deterministic layer: structure, slop phrases, verbosity, unsourced numbers, source hygiene, placeholders, and cross-page duplication. Thresholds live in `evals/config.json`.

New or edited pages must reach `pass` or `warn` to merge. Pages below are existing debt, ranked worst first.

## Summary

| Status | Pages |
|---|---|
| fail | 36 |
| warn | 189 |
| pass | 0 |
| total | 225 |

## Findings by check

| Check | Pages failing | Pages warned |
|---|---|---|
| `structure` | 31 | 0 |
| `judges.fake_data` | 4 | 77 |
| `judges.specificity` | 3 | 6 |
| `judges.consistency` | 1 | 9 |
| `judges.disagree` | 0 | 189 |
| `claims.unsupported` | 0 | 180 |
| `numbers.unsourced` | 0 | 97 |
| `sources.unreachable` | 0 | 67 |
| `sources.dead` | 0 | 55 |
| `verbosity.sentenceLength` | 0 | 29 |
| `claims.outdated` | 0 | 28 |
| `verbosity.longSentences` | 0 | 24 |
| `sources.homepageOnly` | 0 | 11 |
| `verbosity.filler` | 0 | 8 |
| `slop.density` | 0 | 6 |
| `judges.error` | 0 | 3 |
| `sources.duplicates` | 0 | 1 |

## Claims (225 page(s))

Factual claims extracted from The Problem, Market Research and Competitive Landscape, checked against each page's cited sources.

| Supported | Contradicted | Outdated | Not found in source | Unsourced | Unverifiable |
|---|---|---|---|---|---|
| 317 | 0 (0 page(s)) | 30 | 514 | 1552 | 537 |

## Judge scores (225 page(s))

Median of each page's judge median, 1-5. Rubric: `evals/rubric.md`.

| Dimension | Corpus median | Pages at 2 or below |
|---|---|---|
| `specificity` | 5 | 3 |
| `slop` | 5 | 0 |
| `verbosity` | 4 | 0 |
| `fake_data` | 4 | 4 |
| `consistency` | 5 | 1 |
| `actionability` | 5 | 0 |

## Fix first: failing pages (36)

| Page | Fails | Warns | Checks | First failure |
|---|---|---|---|---|
| `markdown-client-proposals` | 2 | 6 | structure | body contains '{{' placeholder |
| `last-20-builder-rescue` | 2 | 5 | structure, judges.specificity | heading[7] expected '## Sources', got (missing) |
| `ai-storybook-generator-for-kids` | 2 | 4 | judges.fake_data, judges.consistency | fake_data 2/5 (claude-haiku-4.5 4, gemini-3.8-flash 2, gpt-5.6-luna 2): "The global personalized children's books market was valued at USD 569 million in 2024 a |
| `brake-safety-education-platform` | 2 | 2 | judges.specificity, judges.fake_data | specificity 2/5 (claude-haiku-4.5 3, gemini-3.8-flash 2, gpt-5.6-luna 2): "- **YouTube DIY channels** — Rich video, zero progression tracking, no local shop int |
| `feature-voting-board` | 1 | 7 | structure | body has bare '<' that MDX would parse as JSX (escape as \< outside code fences) |
| `ai-agent-error-translator` | 1 | 6 | structure | heading[7] expected '## Sources', got (missing) |
| `ai-knowledge-transfer-platform` | 1 | 6 | structure | ## The Solution must contain **How it works:** followed by a numbered list |
| `personal-wellness-coach` | 1 | 6 | structure | ## The Solution must contain **How it works:** followed by a numbered list |
| `shopify-trust-scanner` | 1 | 6 | structure | body word count 784 < 800 |
| `user-onboarding-builder` | 1 | 6 | structure | body has bare '<' that MDX would parse as JSX (escape as \< outside code fences) |
| `ai-code-coach-tutor` | 1 | 4 | structure | heading[7] expected '## Sources', got (missing) |
| `content-repurposing-tool` | 1 | 4 | structure | heading[7] expected '## Sources', got (missing) |
| `conversational-analytics-digest` | 1 | 4 | structure | heading[7] expected '## Sources', got (missing) |
| `expert-mentorship-marketplace` | 1 | 4 | structure | ## The Solution must contain **How it works:** followed by a numbered list |
| `recall-radar-ecommerce-sellers` | 1 | 4 | structure | heading[7] expected '## Sources', got (missing) |
| `vibe-coders-for-hire` | 1 | 4 | structure | heading[7] expected '## Sources', got (missing) |
| `abandoned-cart-recovery` | 1 | 3 | structure | heading[7] expected '## Sources', got (missing) |
| `ai-coding-classroom-assistant` | 1 | 3 | structure | heading[7] expected '## Sources', got (missing) |
| `ai-collectible-verification-platform` | 1 | 3 | judges.fake_data | fake_data 2/5 (claude-haiku-4.5 3, gemini-3.8-flash 2, gpt-5.6-luna 2): "Data Insights Market — AI-Powered Detection Tool Market - OpenPR — AI Content Detection |
| `ai-feedback-triage-widget` | 1 | 3 | structure | heading[7] expected '## Sources', got (missing) |
| `api-documentation-generator` | 1 | 3 | structure | heading[7] expected '## Sources', got (missing) |
| `expense-splitter-app` | 1 | 3 | structure | heading[7] expected '## Sources', got (missing) |
| `invoice-reminder-bot` | 1 | 3 | structure | body contains '{{' placeholder |
| `microschool-admin-platform` | 1 | 3 | judges.specificity | specificity 2/5 (claude-haiku-4.5 4, gemini-3.8-flash 2, gpt-5.6-luna 2): "Generic school-management platforms — Established systems offer attendance, grades, b |
| `one-star-attack-detection` | 1 | 3 | structure | body word count 797 < 800 |
| `single-event-app-builder` | 1 | 3 | structure | heading[7] expected '## Sources', got (missing) |
| `tiktok-trend-predictor-creators` | 1 | 3 | judges.fake_data | fake_data 2/5 (claude-haiku-4.5 3, gemini-3.8-flash 2, gpt-5.6-luna 2): "“TikTok trend prediction tools for creators” tracks ~94K+ monthly search volume (Ideabr |
| `waitlist-manager` | 1 | 3 | structure | heading[7] expected '## Sources', got (missing) |
| `ai-agency-automation-control-panel` | 1 | 2 | structure | ## Sources needs ≥2 markdown links (got 0) |
| `ai-resume-tailorer` | 1 | 2 | structure | heading[7] expected '## Sources', got (missing) |
| `corporate-knowledge-ai-assistant` | 1 | 2 | structure | ## The Solution must contain **How it works:** followed by a numbered list |
| `social-media-scheduler` | 1 | 2 | structure | heading[7] expected '## Sources', got (missing) |
| `subscription-analytics-dashboard` | 1 | 2 | structure | heading[7] expected '## Sources', got (missing) |
| `whatsapp-tour-guide-comms` | 1 | 2 | structure | body contains '{{' placeholder |
| `customer-feedback-aggregator` | 1 | 1 | structure | heading[7] expected '## Sources', got (missing) |
| `vehicle-recall-alert-service` | 1 | 1 | structure | heading[7] expected '## Sources', got (missing) |

## Review: pages with warnings (189)

| Page | Fails | Warns | Checks | First warning |
|---|---|---|---|---|
| `ai-flash-sale-creator-for-shopify` | 0 | 10 | verbosity.sentenceLength, verbosity.longSentences, claims.unsupported, judges.disagree, judges.fake_data, judges.consistency, sources.dead | average sentence is 30.2 words (warn > 25) |
| `ai-product-data-cleaner-for-ecommerce` | 0 | 9 | verbosity.sentenceLength, verbosity.longSentences, numbers.unsourced, claims.unsupported, sources.unreachable, judges.fake_data, judges.disagree, sources.dead | average sentence is 28.4 words (warn > 25) |
| `ai-app-security-badge` | 0 | 8 | verbosity.sentenceLength, claims.unsupported, judges.disagree, judges.consistency, sources.dead | average sentence is 25.9 words (warn > 25) |
| `ai-verified-freelancer-marketplace` | 0 | 8 | verbosity.sentenceLength, claims.outdated, claims.unsupported, sources.unreachable, judges.disagree | average sentence is 27.5 words (warn > 25) |
| `client-portal` | 0 | 8 | numbers.unsourced, claims.unsupported, sources.unreachable, judges.disagree, judges.fake_data, sources.dead | 20 of 33 numbers in The Problem/Market Research/Competitive Landscape have no inline link or named source, e.g. (Market Research) "The global client portal soft |
| `daily-ai-checkin-calls-for-seniors` | 0 | 8 | verbosity.sentenceLength, verbosity.longSentences, claims.outdated, claims.unsupported, judges.disagree, sources.dead | average sentence is 28.9 words (warn > 25) |
| `habit-tracker` | 0 | 8 | numbers.unsourced, claims.unsupported, sources.unreachable, judges.disagree, sources.dead | 24 of 37 numbers in The Problem/Market Research/Competitive Landscape have no inline link or named source, e.g. (The Problem) "…change works when it's simple. A |
| `bnpl-for-digital-products` | 0 | 7 | verbosity.sentenceLength, verbosity.longSentences, claims.outdated, claims.unsupported, judges.fake_data, judges.disagree | average sentence is 27.1 words (warn > 25) |
| `career-transition-escape-plan` | 0 | 7 | verbosity.sentenceLength, verbosity.longSentences, claims.outdated, claims.unsupported, judges.disagree, judges.fake_data | average sentence is 27.2 words (warn > 25) |
| `government-contract-finder` | 0 | 7 | verbosity.filler, claims.unsupported, sources.unreachable, judges.fake_data, judges.disagree, sources.dead | 4.45 filler words per 1k words (warn > 4) |
| `markdown-publish-everywhere` | 0 | 7 | numbers.unsourced, sources.duplicates, claims.unsupported, sources.unreachable, judges.fake_data, judges.disagree | 15 of 22 numbers in The Problem/Market Research/Competitive Landscape have no inline link or named source, e.g. (Market Research) "…and content-tool SaaS produc |
| `rental-property-maintenance-dashboard` | 0 | 7 | verbosity.sentenceLength, verbosity.longSentences, claims.unsupported, judges.fake_data, judges.disagree, sources.dead | average sentence is 28.2 words (warn > 25) |
| `tiktok-shop-fulfillment-automation` | 0 | 7 | numbers.unsourced, claims.unsupported, sources.unreachable, judges.fake_data, judges.disagree, sources.dead | 16 of 26 numbers in The Problem/Market Research/Competitive Landscape have no inline link or named source, e.g. (The Problem) "…not a hypothetical. TikTok Shop' |
| `voice-desktop-workflow-macros` | 0 | 7 | numbers.unsourced, claims.unsupported, sources.unreachable, judges.fake_data, judges.disagree, judges.consistency | 13 of 19 numbers in The Problem/Market Research/Competitive Landscape have no inline link or named source, e.g. (Market Research) "…e and speech recognition sof |
| `ai-brake-inspection-analyser` | 0 | 6 | slop.density, numbers.unsourced, claims.unsupported, judges.fake_data, judges.disagree, sources.dead | 1.52 stock AI words per 1k words (warn > 1.5): leverage x1 |
| `ai-nutrition-planner-trainers` | 0 | 6 | numbers.unsourced, claims.outdated, claims.unsupported, judges.disagree | 32 of 41 numbers in The Problem/Market Research/Competitive Landscape have no inline link or named source, e.g. (The Problem) "…online coaches sell results. Nut |
| `ai-student-support-bot-online-educators` | 0 | 6 | numbers.unsourced, claims.unsupported, judges.disagree, judges.fake_data | 16 of 30 numbers in The Problem/Market Research/Competitive Landscape have no inline link or named source, e.g. (Market Research) "…for course-support assistant |
| `ai-travel-planner` | 0 | 6 | numbers.unsourced, claims.unsupported, judges.fake_data, judges.disagree, sources.dead | 9 of 11 numbers in The Problem/Market Research/Competitive Landscape have no inline link or named source, e.g. (Market Research) "- $317.4 billion by 2029 — the |
| `automated-multi-modal-marketing-tools` | 0 | 6 | claims.outdated, claims.unsupported, judges.disagree, sources.dead | 1 claim(s) quote an older version of their source, e.g. "$8.23 billion in 2025 → $14.73 billion in 2029 at 15.7% CAGR" but thebusinessresearchcompany.com now sa |
| `brakes-maintenance-tracker-app` | 0 | 6 | numbers.unsourced, sources.unreachable, judges.disagree, judges.fake_data | 2 of 3 numbers in The Problem/Market Research/Competitive Landscape have no inline link or named source, e.g. (Competitive Landscape) "…ed. Often subscription o |
| `chattracker` | 0 | 6 | verbosity.sentenceLength, verbosity.filler, numbers.unsourced, claims.unsupported, judges.fake_data, judges.disagree | average sentence is 25.4 words (warn > 25) |
| `contract-analyzer` | 0 | 6 | numbers.unsourced, claims.outdated, claims.unsupported, judges.fake_data, judges.disagree | 19 of 27 numbers in The Problem/Market Research/Competitive Landscape have no inline link or named source, e.g. (The Problem) "…work: the cheapest small-busines |
| `email-to-todo` | 0 | 6 | numbers.unsourced, claims.unsupported, sources.unreachable, judges.disagree, sources.dead | 32 of 41 numbers in The Problem/Market Research/Competitive Landscape have no inline link or named source, e.g. (The Problem) "…y language, and output a clean s |
| `freelancer-tax-filing-bot` | 0 | 6 | numbers.unsourced, claims.outdated, claims.unsupported, judges.disagree, sources.dead | 22 of 43 numbers in The Problem/Market Research/Competitive Landscape have no inline link or named source, e.g. (The Problem) "…t. Their “books” are a Notes app |
| `gamified-money-habit-app` | 0 | 6 | numbers.unsourced, claims.unsupported, sources.unreachable, judges.disagree, sources.dead | 19 of 24 numbers in The Problem/Market Research/Competitive Landscape have no inline link or named source, e.g. (Market Research) "- The gamification market is  |
| `kdp-niche-finder` | 0 | 6 | verbosity.sentenceLength, verbosity.longSentences, claims.unsupported, judges.disagree | average sentence is 26.7 words (warn > 25) |
| `meeting-mood-ai` | 0 | 6 | numbers.unsourced, claims.outdated, claims.unsupported, judges.disagree | 20 of 29 numbers in The Problem/Market Research/Competitive Landscape have no inline link or named source, e.g. (Market Research) "- Global mood tracker app mar |
| `nasm-trainer-marketplace` | 0 | 6 | numbers.unsourced, claims.unsupported, sources.unreachable, judges.disagree, sources.dead | 35 of 48 numbers in The Problem/Market Research/Competitive Landscape have no inline link or named source, e.g. (The Problem) "Meanwhile, the NASM-certified tra |
| `personalized-employee-wellness-platform` | 0 | 6 | numbers.unsourced, claims.unsupported, judges.disagree, judges.consistency | 15 of 24 numbers in The Problem/Market Research/Competitive Landscape have no inline link or named source, e.g. (The Problem) "…ndividual. For a 40-person compa |
| `quickbooks-escape-ramp` | 0 | 6 | slop.density, numbers.unsourced, claims.unsupported, judges.fake_data, judges.disagree | 1.69 stock AI words per 1k words (warn > 1.5): harness x3 |
| `slack-to-notion-docs` | 0 | 6 | verbosity.sentenceLength, verbosity.longSentences, claims.outdated, claims.unsupported, judges.disagree, sources.dead | average sentence is 26.8 words (warn > 25) |
| `virtual-knowledge-hub` | 0 | 6 | numbers.unsourced, claims.outdated, claims.unsupported, judges.fake_data, judges.disagree | 39 of 47 numbers in The Problem/Market Research/Competitive Landscape have no inline link or named source, e.g. (The Problem) "…s not want a LinkedIn course. Sh |
| `wedding-event-staffing-marketplace` | 0 | 6 | sources.homepageOnly, sources.unreachable, judges.specificity, judges.disagree, judges.fake_data | 75% of sources are bare homepages, which cannot back a specific number |
| `adventure-date-night-app` | 0 | 5 | numbers.unsourced, sources.unreachable, judges.disagree, sources.dead | 25 of 60 numbers in The Problem/Market Research/Competitive Landscape have no inline link or named source, e.g. (The Problem) "…ideas. “Experience gifts for cou |
| `ai-cart-rescue-emotional-emails` | 0 | 5 | numbers.unsourced, claims.unsupported, judges.fake_data, judges.disagree, sources.dead | 17 of 32 numbers in The Problem/Market Research/Competitive Landscape have no inline link or named source, e.g. (The Problem) "…ry benchmarks put average cart a |
| `ai-chief-of-staff-consultants` | 0 | 5 | numbers.unsourced, sources.homepageOnly, claims.unsupported, sources.unreachable, judges.fake_data | 15 of 21 numbers in The Problem/Market Research/Competitive Landscape have no inline link or named source, e.g. (The Problem) "Solo consultants bill $150–$300 a |
| `ai-cpg-packaging-designer` | 0 | 5 | numbers.unsourced, claims.unsupported, judges.fake_data, judges.disagree | 23 of 27 numbers in The Problem/Market Research/Competitive Landscape have no inline link or named source, e.g. (The Problem) "…aging engagement with a real age |
| `ai-insurance-claim-appeal-writer` | 0 | 5 | verbosity.sentenceLength, numbers.unsourced, claims.unsupported, judges.disagree, sources.dead | average sentence is 25.1 words (warn > 25) |
| `ai-proposal-generator-consultants` | 0 | 5 | verbosity.sentenceLength, verbosity.longSentences, claims.unsupported, judges.fake_data, judges.disagree | average sentence is 26.1 words (warn > 25) |
| `ai-slide-deck-maker` | 0 | 5 | numbers.unsourced, claims.unsupported, judges.disagree, judges.fake_data | 21 of 29 numbers in The Problem/Market Research/Competitive Landscape have no inline link or named source, e.g. (Market Research) "…AI presentation makers marke |
| `ai-video-editor-for-creators` | 0 | 5 | verbosity.longSentences, claims.unsupported, sources.unreachable, judges.disagree | 21% of sentences run over 35 words; longest is 52: "The category is officially in an "early-maturity but competitive" stage — mature enough that the core techno |
| `ai-writing-coach-freelancers` | 0 | 5 | numbers.unsourced, claims.unsupported, sources.unreachable, judges.fake_data, sources.dead | 5 of 8 numbers in The Problem/Market Research/Competitive Landscape have no inline link or named source, e.g. (Market Research) "…tent creators who already sell |
| `anti-ghosting-recruitment-crm` | 0 | 5 | verbosity.sentenceLength, verbosity.longSentences, claims.outdated, claims.unsupported, judges.disagree | average sentence is 29.6 words (warn > 25) |
| `course-completion-nudge-platform` | 0 | 5 | verbosity.filler, claims.unsupported, judges.disagree | 4.46 filler words per 1k words (warn > 4) |
| `daily-standup-bot` | 0 | 5 | verbosity.filler, numbers.unsourced, claims.unsupported, sources.unreachable, judges.disagree | 5 filler words per 1k words (warn > 4) |
| `etsy-seo-optimizer` | 0 | 5 | verbosity.sentenceLength, claims.unsupported, judges.disagree, sources.dead | average sentence is 25.3 words (warn > 25) |
| `gutcheck-ai-ad-optimization` | 0 | 5 | slop.density, claims.outdated, claims.unsupported, judges.fake_data, judges.disagree | 2.24 stock AI words per 1k words (warn > 1.5): dynamic x2, robust x1 |
| `high-school-athlete-highlight-reel` | 0 | 5 | numbers.unsourced, sources.homepageOnly, claims.unsupported, sources.unreachable, judges.fake_data | 18 of 26 numbers in The Problem/Market Research/Competitive Landscape have no inline link or named source, e.g. (The Problem) "Hudl already sits on 14 million-p |
| `local-seo-citation-manager` | 0 | 5 | verbosity.sentenceLength, verbosity.longSentences, judges.disagree, judges.consistency | average sentence is 31.4 words (warn > 25) |
| `micro-influencer-deliverable-tracker` | 0 | 5 | verbosity.sentenceLength, verbosity.longSentences, judges.disagree, sources.dead | average sentence is 27.5 words (warn > 25) |
| `n8n-freelancer-academy` | 0 | 5 | claims.unsupported, judges.disagree | 11 of 15 claims are unsourced (7) or not found in their cited source (4), e.g. "The global e-learning market is projected to grow from $218.9 billion in 2025 to |
| `nocode-specialist-repair-marketplace` | 0 | 5 | numbers.unsourced, sources.unreachable, judges.disagree, sources.dead | 30 of 58 numbers in The Problem/Market Research/Competitive Landscape have no inline link or named source, e.g. (The Problem) "A founder ships 80 percent of a B |
| `non-toxic-appliance-verification-platform` | 0 | 5 | claims.unsupported, sources.unreachable, judges.specificity, judges.fake_data, judges.disagree | 14 of 16 claims are unsourced (13) or not found in their cited source (1), e.g. "The broader global appliance market is measured in the hundreds of billions of  |
| `notion-backup-tool` | 0 | 5 | numbers.unsourced, claims.unsupported, judges.disagree, sources.dead | 15 of 33 numbers in The Problem/Market Research/Competitive Landscape have no inline link or named source, e.g. (The Problem) "Notion is the second brain for an |
| `renter-deposit-documentation-app` | 0 | 5 | numbers.unsourced, claims.outdated, claims.unsupported, judges.disagree | 19 of 38 numbers in The Problem/Market Research/Competitive Landscape have no inline link or named source, e.g. (The Problem) "…tenant hands back the keys, ment |
| `saas-financial-toolkit` | 0 | 5 | slop.density, claims.unsupported, judges.disagree, sources.dead | 1.53 stock AI words per 1k words (warn > 1.5): comprehensive x1, best-in-class x1 |
| `shopify-review-intelligence` | 0 | 5 | sources.homepageOnly, claims.unsupported, judges.fake_data, judges.disagree, sources.dead | 80% of sources are bare homepages, which cannot back a specific number |
| `skill-path-course-finder` | 0 | 5 | claims.outdated, claims.unsupported, sources.unreachable, judges.fake_data, judges.disagree | 1 claim(s) quote an older version of their source, e.g. "The e-learning market was about $258.7B in 2024, projected to $712.46B by 2032 at a 13.5% CAGR" but sky |
| `small-order-wholesale-marketplace` | 0 | 5 | numbers.unsourced, claims.unsupported, judges.disagree, judges.fake_data | 15 of 23 numbers in The Problem/Market Research/Competitive Landscape have no inline link or named source, e.g. (The Problem) "…boutique marketplace, brands han |
| `sms-time-tracker` | 0 | 5 | numbers.unsourced, claims.unsupported, judges.disagree | 15 of 39 numbers in The Problem/Market Research/Competitive Landscape have no inline link or named source, e.g. (The Problem) "…the U.S. side-hustle population  |
| `static-ad-to-video-generator` | 0 | 5 | claims.outdated, claims.unsupported, judges.fake_data, judges.disagree | 1 claim(s) quote an older version of their source, e.g. "**Global digital video advertising** is projected at **$140.18 billion in 2025**, up from $104.65 billi |
| `supply-chain-transparency-platform` | 0 | 5 | claims.outdated, claims.unsupported, judges.fake_data, judges.disagree | 2 claim(s) quote an older version of their source, e.g. "The AI in supply chain market is projected to grow from $9.94B in 2025 to $192.51B by 2034, a 39% CAGR" |
| `three-minute-money-habit-app` | 0 | 5 | verbosity.filler, sources.unreachable, judges.disagree, sources.dead | 4.26 filler words per 1k words (warn > 4) |
| `underused-venue-marketplace` | 0 | 5 | numbers.unsourced, claims.unsupported, sources.unreachable, judges.disagree, sources.dead | 14 of 22 numbers in The Problem/Market Research/Competitive Landscape have no inline link or named source, e.g. (The Problem) "…for roughly six hours a week. A  |
| `vacation-rental-turnover-coordinator` | 0 | 5 | verbosity.sentenceLength, verbosity.longSentences, numbers.unsourced, judges.disagree | average sentence is 27.5 words (warn > 25) |
| `viral-ad-licensing-dtc` | 0 | 5 | numbers.unsourced, claims.unsupported, judges.disagree, sources.dead | 17 of 47 numbers in The Problem/Market Research/Competitive Landscape have no inline link or named source, e.g. (The Problem) "…UGC in Facebook ads can 4x CTR a |
| `youtube-algorithm-alerts` | 0 | 5 | verbosity.sentenceLength, verbosity.longSentences, claims.unsupported, judges.disagree | average sentence is 27.3 words (warn > 25) |
| `agent-storefront-platform` | 0 | 4 | claims.unsupported, judges.disagree, judges.fake_data | 12 of 15 claims are unsourced (3) or not found in their cited source (9), e.g. "ClawHub already has 3,000+ published skills and 50,000 monthly installs" |
| `ai-api-cost-optimizer-indie-builders` | 0 | 4 | verbosity.longSentences, numbers.unsourced, claims.unsupported, judges.disagree | 23% of sentences run over 35 words; longest is 60: "It's the daily reality showing up across developer communities at scale: r/aws (341K members) and r/devops ( |
| `ai-content-factory-human-qc` | 0 | 4 | numbers.unsourced, claims.unsupported, sources.unreachable, judges.disagree | 23 of 37 numbers in The Problem/Market Research/Competitive Landscape have no inline link or named source, e.g. (The Problem) "…he actual job now: not writing,  |
| `ai-grant-writing-assistant-nonprofits` | 0 | 4 | verbosity.sentenceLength, verbosity.longSentences, numbers.unsourced, judges.disagree | average sentence is 26.3 words (warn > 25) |
| `ai-job-post-applicant-screener` | 0 | 4 | verbosity.sentenceLength, verbosity.longSentences, claims.unsupported, judges.disagree | average sentence is 26 words (warn > 25) |
| `ai-landing-page-generator-ecommerce` | 0 | 4 | numbers.unsourced, claims.outdated, claims.unsupported, judges.fake_data | 14 of 21 numbers in The Problem/Market Research/Competitive Landscape have no inline link or named source, e.g. (The Problem) "…oney into paid ads — U.S. digita |
| `ai-lesson-planner-teachers` | 0 | 4 | numbers.unsourced, claims.unsupported, judges.disagree | 18 of 24 numbers in The Problem/Market Research/Competitive Landscape have no inline link or named source, e.g. (The Problem) "…their certification. Meanwhile t |
| `ai-material-estimator` | 0 | 4 | verbosity.sentenceLength, verbosity.filler, claims.unsupported, judges.fake_data | average sentence is 26.5 words (warn > 25) |
| `ai-meeting-notes-cleaner` | 0 | 4 | claims.unsupported, judges.fake_data, judges.disagree, sources.dead | 3 of 5 claims are unsourced (0) or not found in their cited source (3), e.g. "MarketsandMarkets projects the broader conversational AI segment exceeding $40B by |
| `ai-practice-plan-generator-music-teachers` | 0 | 4 | claims.unsupported, judges.disagree, judges.fake_data | 13 of 18 claims are unsourced (9) or not found in their cited source (4), e.g. "r/pianoteachers (about 8,900)" |
| `ai-site-design-blueprints` | 0 | 4 | numbers.unsourced, sources.unreachable, judges.disagree | 45 of 64 numbers in The Problem/Market Research/Competitive Landscape have no inline link or named source, e.g. (The Problem) "…expensive version. Shops buy Cla |
| `ai-tutor-matchmaker` | 0 | 4 | claims.unsupported, sources.unreachable, judges.fake_data, sources.dead | 11 of 17 claims are unsourced (7) or not found in their cited source (4), e.g. "American families spend more than $7 billion a year on private tutoring" |
| `ai-wiki-keeper` | 0 | 4 | verbosity.sentenceLength, verbosity.longSentences, claims.unsupported, judges.disagree | average sentence is 26 words (warn > 25) |
| `ai-youtube-script-generator` | 0 | 4 | claims.outdated, claims.unsupported, judges.disagree | 1 claim(s) quote an older version of their source, e.g. "A narrower estimate puts script-writing software at USD 140.24M (2024) growing to USD 305.91M by 2031 — |
| `ai-zoning-intelligence` | 0 | 4 | numbers.unsourced, claims.unsupported, judges.fake_data, judges.disagree | 12 of 17 numbers in The Problem/Market Research/Competitive Landscape have no inline link or named source, e.g. (Market Research) "- AI in real estate is a $303 |
| `auto-repair-estimate-translator` | 0 | 4 | claims.unsupported, sources.unreachable, judges.disagree, sources.dead | 8 of 13 claims are unsourced (4) or not found in their cited source (4), e.g. "Bosch, Autel, and Hitachi sell AI-assisted hardware in the thousands" |
| `aws-cert-ai-study-buddy` | 0 | 4 | sources.homepageOnly, sources.unreachable, judges.fake_data, judges.disagree | 57% of sources are bare homepages, which cannot back a specific number |
| `book-formatting-for-self-publishers` | 0 | 4 | claims.outdated, claims.unsupported, judges.disagree | 1 claim(s) quote an older version of their source, e.g. "The global book publishers market was valued at about 103.7 billion dollars in 2025 and is forecast to  |
| `brake-repair-cost-estimator` | 0 | 4 | numbers.unsourced, claims.unsupported, sources.unreachable, judges.error | 11 of 13 numbers in The Problem/Market Research/Competitive Landscape have no inline link or named source, e.g. (The Problem) "…ing, calls two shops, and gets e |
| `branded-client-portal-builder-for-freelancers` | 0 | 4 | verbosity.sentenceLength, verbosity.longSentences, claims.unsupported, judges.disagree | average sentence is 26.8 words (warn > 25) |
| `chargeback-protection-for-ecommerce-sellers` | 0 | 4 | verbosity.sentenceLength, verbosity.longSentences, claims.unsupported, judges.disagree | average sentence is 28.7 words (warn > 25) |
| `chat-with-historical-figures` | 0 | 4 | claims.unsupported, judges.fake_data, judges.disagree | 9 of 9 claims are unsourced (7) or not found in their cited source (2), e.g. "The global chatbot market reached $10.25B in 2025 and is projected at $13.28B by t |
| `contractor-lead-refund-automation` | 0 | 4 | numbers.unsourced, claims.unsupported, judges.disagree, sources.dead | 21 of 47 numbers in The Problem/Market Research/Competitive Landscape have no inline link or named source, e.g. (The Problem) "…trucks have to stay full. The bi |
| `creator-manufacturer-partnership-marketplace` | 0 | 4 | claims.unsupported, sources.unreachable, judges.fake_data, judges.disagree | 6 of 7 claims are unsourced (5) or not found in their cited source (1), e.g. "Reddit's r/influencermarketing (130K+)" |
| `customized-lead-magnets` | 0 | 4 | sources.unreachable, judges.fake_data, judges.disagree, sources.dead | 4 of 6 cited sources could not be read (67%): hubspot.com (200), canva.com (403), mycodelesswebsite.com (200) |
| `excel-formula-repair-ai` | 0 | 4 | claims.unsupported, judges.disagree | 8 of 10 claims are unsourced (7) or not found in their cited source (1), e.g. "Excel holds an estimated 80%+ of the spreadsheet market" |
| `expense-report-generator` | 0 | 4 | numbers.unsourced, claims.unsupported, judges.disagree | 33 of 36 numbers in The Problem/Market Research/Competitive Landscape have no inline link or named source, e.g. (The Problem) "…waste 40+ hours a month on expen |
| `feed-free-social-workspace` | 0 | 4 | claims.unsupported, sources.unreachable, judges.disagree | 10 of 12 claims are unsourced (6) or not found in their cited source (4), e.g. "“Social media scheduler” alone does about 165,000 monthly searches" |
| `field-service-job-costing-tracker` | 0 | 4 | verbosity.sentenceLength, verbosity.longSentences, numbers.unsourced, judges.disagree | average sentence is 27.7 words (warn > 25) |
| `focus-session-timer` | 0 | 4 | numbers.unsourced, sources.homepageOnly, claims.unsupported, sources.unreachable | 26 of 41 numbers in The Problem/Market Research/Competitive Landscape have no inline link or named source, e.g. (The Problem) "…proven rhythm. The upgrade path  |
| `freelance-scope-creep-detector` | 0 | 4 | verbosity.filler, judges.disagree, sources.dead | 4.65 filler words per 1k words (warn > 4) |
| `freelancer-late-payment-predictor` | 0 | 4 | numbers.unsourced, claims.unsupported, judges.disagree | 25 of 54 numbers in The Problem/Market Research/Competitive Landscape have no inline link or named source, e.g. (The Problem) "A copywriter sends a $4,800 invoi |
| `hold-time-call-bot` | 0 | 4 | claims.unsupported, judges.fake_data, judges.disagree, sources.dead | 14 of 17 claims are unsourced (14) or not found in their cited source (0), e.g. "Ideabrowser’s brief puts average U.S. phone-tree-and-hold time at about ten hou |
| `invoice-coding-error-scanner` | 0 | 4 | numbers.unsourced, judges.disagree, sources.dead | 24 of 32 numbers in The Problem/Market Research/Competitive Landscape have no inline link or named source, e.g. (The Problem) "…guessed categories. Twenty minut |
| `landlord-tenant-risk-screener` | 0 | 4 | numbers.unsourced, claims.unsupported, sources.unreachable, judges.disagree | 15 of 40 numbers in The Problem/Market Research/Competitive Landscape have no inline link or named source, e.g. (Market Research) "- Large agencies run about 60 |
| `marketplace-meetup-safety` | 0 | 4 | claims.unsupported, sources.unreachable, judges.disagree, sources.dead | 6 of 9 claims are unsourced (6) or not found in their cited source (0), e.g. "The secondhand market is projected around $227 billion (Ideabrowser highlight on t |
| `mobile-brake-repair-marketplace` | 0 | 4 | numbers.unsourced, claims.unsupported, sources.unreachable, judges.fake_data | 5 of 6 numbers in The Problem/Market Research/Competitive Landscape have no inline link or named source, e.g. (The Problem) "…to schedule. Shops keep 9–5 hours; |
| `no-code-ai-agent-platform` | 0 | 4 | claims.unsupported, judges.fake_data, judges.disagree | 14 of 15 claims are unsourced (11) or not found in their cited source (3), e.g. "Reddit’s r/AI_Agents sits at 118k members" |
| `phone-body-composition-scanner` | 0 | 4 | numbers.unsourced, claims.unsupported, judges.disagree, sources.dead | 16 of 46 numbers in The Problem/Market Research/Competitive Landscape have no inline link or named source, e.g. (The Problem) "A Wegovy user steps on a $400 sma |
| `photo-meal-workout-tracker` | 0 | 4 | claims.unsupported, judges.disagree, judges.fake_data | 14 of 20 claims are unsourced (9) or not found in their cited source (5), e.g. "manual-entry fitness-app churn near 70 percent within three months" |
| `postpartum-recovery-platform` | 0 | 4 | claims.unsupported, sources.unreachable, judges.disagree, sources.dead | 11 of 16 claims are unsourced (8) or not found in their cited source (3), e.g. "and is projected to reach $25B–$38B by 2033–2035" |
| `quiet-creator-personal-branding` | 0 | 4 | numbers.unsourced, claims.unsupported, judges.fake_data, judges.disagree | 17 of 32 numbers in The Problem/Market Research/Competitive Landscape have no inline link or named source, e.g. (The Problem) "…watches a competitor's talking-h |
| `real-estate-workflow-automation` | 0 | 4 | numbers.unsourced, claims.unsupported, sources.unreachable, judges.fake_data | 6 of 7 numbers in The Problem/Market Research/Competitive Landscape have no inline link or named source, e.g. (The Problem) "…ool, an email drip platform, and a |
| `saas-feature-usage-auditor` | 0 | 4 | claims.unsupported, sources.unreachable, judges.fake_data, judges.disagree | 14 of 17 claims are unsourced (11) or not found in their cited source (3), e.g. "Facebook’s Product Analytics with devtodev group (4.3K) and the Power BI suppor |
| `small-town-storefront-marketplace` | 0 | 4 | numbers.unsourced, claims.unsupported, judges.specificity, judges.fake_data | 8 of 11 numbers in The Problem/Market Research/Competitive Landscape have no inline link or named source, e.g. (The Problem) "…her side of the same pain. Downto |
| `solo-founder-health-score` | 0 | 4 | numbers.unsourced, claims.unsupported, judges.disagree | 19 of 31 numbers in The Problem/Market Research/Competitive Landscape have no inline link or named source, e.g. (Market Research) "- 64 million independent work |
| `video-sales-funnel-builder` | 0 | 4 | numbers.unsourced, claims.unsupported, sources.unreachable, sources.dead | 23 of 35 numbers in The Problem/Market Research/Competitive Landscape have no inline link or named source, e.g. (The Problem) "…s (Gisteo, Skyline) will build t |
| `vintage-ride-revival-3d-printed-parts` | 0 | 4 | claims.unsupported, judges.fake_data, judges.disagree | 13 of 15 claims are unsourced (11) or not found in their cited source (2), e.g. "The cited research places the global automotive 3D-printing market around $3.4– |
| `warranty-service-plan-tracker` | 0 | 4 | sources.unreachable, judges.disagree, sources.dead | 3 of 6 cited sources could not be read (50%): cpscentral.com (200), servicexrg.com (404), fortunebusinessinsights.com (403) |
| `website-accessibility-ada-scanner` | 0 | 4 | slop.density, sources.unreachable, judges.disagree | 1.81 stock AI words per 1k words (warn > 1.5): comprehensive x1 |
| `wedding-flower-pinterest-budget` | 0 | 4 | numbers.unsourced, claims.unsupported, judges.disagree | 34 of 42 numbers in The Problem/Market Research/Competitive Landscape have no inline link or named source, e.g. (The Problem) "…ot. She dumps a Pinterest board  |
| `adspark` | 0 | 3 | claims.unsupported, sources.unreachable, judges.disagree | 6 of 9 claims are unsourced (6) or not found in their cited source (0), e.g. "Facebook's "Small Business Digital Marketing" group runs 70,000 members deep" |
| `ai-accountability-coach` | 0 | 3 | claims.unsupported, judges.fake_data, judges.disagree | 8 of 10 claims are unsourced (7) or not found in their cited source (1), e.g. "Reddit’s r/RemoteJobs (286K members), r/WorkOnline (654K), and r/DigitalNomad (2. |
| `ai-agent-workflow-platform` | 0 | 3 | claims.outdated, judges.disagree | 1 claim(s) quote an older version of their source, e.g. "Precedence Research puts the AI agents market at $7.92 billion in 2025, reaching $236.03 billion by 203 |
| `ai-arbitrage-agent-resellers` | 0 | 3 | numbers.unsourced, claims.unsupported, judges.disagree | 23 of 31 numbers in The Problem/Market Research/Competitive Landscape have no inline link or named source, e.g. (The Problem) "…d KitchenAid, a lot of Lego, any |
| `ai-bookkeeping-for-freelancers` | 0 | 3 | claims.unsupported, judges.fake_data, judges.disagree | 10 of 11 claims are unsourced (8) or not found in their cited source (2), e.g. "Threads on r/Bookkeeping and r/smallbusiness (1.6M+ members) routinely cross 100 |
| `ai-builder-hiring-marketplace` | 0 | 3 | numbers.unsourced, claims.unsupported, sources.unreachable | 12 of 17 numbers in The Problem/Market Research/Competitive Landscape have no inline link or named source, e.g. (Market Research) "- Macro AI software + service |
| `ai-coding-agent-dashboard` | 0 | 3 | claims.unsupported, judges.fake_data, judges.disagree | 8 of 11 claims are unsourced (0) or not found in their cited source (8), e.g. "r/github (196K members)" |
| `ai-compliance-policy-generator-smbs` | 0 | 3 | verbosity.sentenceLength, verbosity.longSentences, judges.disagree | average sentence is 29.5 words (warn > 25) |
| `ai-course-tutor-companion` | 0 | 3 | numbers.unsourced, judges.disagree | 18 of 23 numbers in The Problem/Market Research/Competitive Landscape have no inline link or named source, e.g. (The Problem) "…nd cohort completion rates routi |
| `ai-dance-form-coach` | 0 | 3 | claims.unsupported, judges.fake_data, judges.disagree | 12 of 16 claims are unsourced (10) or not found in their cited source (2), e.g. "A single drop-in hip-hop or contemporary class runs $15–$30 in most US cities" |
| `ai-fashion-lookbook-studio` | 0 | 3 | claims.outdated, claims.unsupported, judges.disagree | 1 claim(s) quote an older version of their source, e.g. "Dataintelo puts AI-generated fashion photography at $1.42B in 2024, headed to $13.66B by 2033 at a 27.8 |
| `ai-meeting-copilot` | 0 | 3 | claims.outdated, claims.unsupported, judges.fake_data | 1 claim(s) quote an older version of their source, e.g. "The intelligent virtual assistant market is projected to grow from USD 22.37B in 2025 to USD 80.95B by  |
| `ai-podcast-producer` | 0 | 3 | claims.unsupported, judges.disagree | 9 of 10 claims are unsourced (7) or not found in their cited source (2), e.g. "r/podcasting sits at roughly 250,000 members" |
| `ai-protein-tracker` | 0 | 3 | numbers.unsourced, claims.unsupported, judges.disagree | 11 of 18 numbers in The Problem/Market Research/Competitive Landscape have no inline link or named source, e.g. (The Problem) "…has already validated the broade |
| `ai-qa-test-case-generator-nocode` | 0 | 3 | verbosity.sentenceLength, verbosity.longSentences, judges.disagree | average sentence is 27.5 words (warn > 25) |
| `ai-schema-markup-tool` | 0 | 3 | claims.unsupported, judges.disagree | 12 of 19 claims are unsourced (11) or not found in their cited source (1), e.g. "Yoast alone sits north of 5 million active installs" |
| `ai-sentiment-landing-page-design` | 0 | 3 | claims.outdated, claims.unsupported, judges.disagree | 1 claim(s) quote an older version of their source, e.g. "Landing page builders are projected to grow from $715.5M in 2025 to $2.72B by 2035 at a 14.3% CAGR" but |
| `ai-vocal-coach-realtime-pitch` | 0 | 3 | claims.unsupported, sources.unreachable, judges.disagree | 13 of 19 claims are unsourced (11) or not found in their cited source (2), e.g. "Facebook's Vocal Training group sits above 205,000 members" |
| `ai-website-launch-rescue` | 0 | 3 | numbers.unsourced, judges.disagree | 19 of 52 numbers in The Problem/Market Research/Competitive Landscape have no inline link or named source, e.g. (The Problem) "…l. CVE-2025-48757 found row-leve |
| `ai-workflow-library-solopreneurs` | 0 | 3 | claims.unsupported, sources.unreachable, judges.fake_data | 4 of 5 claims are unsourced (4) or not found in their cited source (0), e.g. "Global **workflow automation** is projected around **USD 23.77 billion in 2025** r |
| `contractor-ai-receptionist` | 0 | 3 | numbers.unsourced, judges.disagree | 32 of 81 numbers in The Problem/Market Research/Competitive Landscape have no inline link or named source, e.g. (Market Research) "…y-killer CPCs. “HVAC answeri |
| `course-translation-resale-network` | 0 | 3 | numbers.unsourced, judges.disagree, sources.dead | 24 of 45 numbers in The Problem/Market Research/Competitive Landscape have no inline link or named source, e.g. (The Problem) "…get 25 auto-translated languages |
| `data-freelancer-bounty-board` | 0 | 3 | numbers.unsourced, claims.unsupported, sources.dead | 25 of 45 numbers in The Problem/Market Research/Competitive Landscape have no inline link or named source, e.g. (The Problem) "…tor-pricing table by Friday. An  |
| `gamified-coding-rpg` | 0 | 3 | claims.unsupported, sources.unreachable, judges.disagree | 14 of 18 claims are unsourced (14) or not found in their cited source (0), e.g. "the research around this idea cites dropout on the order of 60% for traditional |
| `gauge-photo-meter-reading` | 0 | 3 | judges.disagree, sources.dead | fake_data: judges differ by 2 points (claude-haiku-4.5 4, gemini-3.8-flash 5, gpt-5.6-luna 3); review by hand |
| `healthsync-personal-health-dashboard` | 0 | 3 | claims.outdated, judges.disagree | 1 claim(s) quote an older version of their source, e.g. "The global healthcare distribution market is valued at approximately $1.19 trillion in 2025 and is proj |
| `hr-insight-engine` | 0 | 3 | claims.outdated, claims.unsupported, judges.disagree | 1 claim(s) quote an older version of their source, e.g. "growing at roughly 9.3% CAGR toward at least $76.9B by 2029" but einpresswire.com now says "reaching $7 |
| `hydration-app-for-hikers` | 0 | 3 | claims.unsupported, judges.disagree | 9 of 17 claims are unsourced (3) or not found in their cited source (6), e.g. "r/hiking sits at 2.1 million members" |
| `inbox-zero-agent` | 0 | 3 | numbers.unsourced, claims.unsupported, judges.disagree | 13 of 18 numbers in The Problem/Market Research/Competitive Landscape have no inline link or named source, e.g. (The Problem) "…nbox zero that never closes. A c |
| `music-royalty-recovery-heirs` | 0 | 3 | claims.unsupported, judges.disagree | 10 of 19 claims are unsourced (7) or not found in their cited source (3), e.g. "r/musicbusiness (24.7K) keeps getting the follow-up" |
| `on-device-privacy-ai` | 0 | 3 | claims.unsupported, judges.fake_data, judges.disagree | 16 of 17 claims are unsourced (13) or not found in their cited source (3), e.g. "Specialized on-device AI forecasts put the market near USD 10.6 billion in 2025 |
| `phone-neck-score-app` | 0 | 3 | claims.unsupported, sources.unreachable, judges.disagree | 11 of 15 claims are unsourced (11) or not found in their cited source (0), e.g. "Reddit’s r/Posture has about 456,000 members trading pillow hacks, chin-tuck fo |
| `python-training-for-professionals` | 0 | 3 | claims.unsupported, sources.unreachable, judges.disagree | 12 of 18 claims are unsourced (11) or not found in their cited source (1), e.g. "Employers already prefer bootcamp-shaped proof of skill (research cites ~65% em |
| `quarterly-tax-estimator-freelancers` | 0 | 3 | claims.unsupported, judges.fake_data, judges.disagree | 13 of 13 claims are unsourced (7) or not found in their cited source (6), e.g. "Every quarter, freelancers play a guessing game with the IRS and usually lose" |
| `reactive-dog-post-op-recovery-planner` | 0 | 3 | sources.unreachable, judges.disagree | 4 of 6 cited sources could not be read (67%): avma.org (200), doi.org (403), pubmed.ncbi.nlm.nih.gov (203) |
| `reddit-discord-listening-cmos` | 0 | 3 | claims.outdated, claims.unsupported, judges.disagree | 1 claim(s) quote an older version of their source, e.g. "AI platforms: $24 billion in 2025 to $165.6 billion in 2035 (21.3%, Future Market Insights)" but future |
| `remote-team-documentation-tool` | 0 | 3 | sources.unreachable, judges.fake_data, sources.dead | 2 of 4 cited sources could not be read (50%): fortunebusinessinsights.com (403), notion.so (404) |
| `s-corp-monthly-finance-desk` | 0 | 3 | numbers.unsourced, sources.unreachable, judges.disagree | 43 of 54 numbers in The Problem/Market Research/Competitive Landscape have no inline link or named source, e.g. (The Problem) "…hangover is monthly. A one-perso |
| `shopify-ai-support-context` | 0 | 3 | claims.unsupported, sources.unreachable, judges.disagree | 3 of 5 claims are unsourced (2) or not found in their cited source (1), e.g. "repeat buyers expect recognition, WISMO ("where is my order") remains the highest- |
| `shopify-b2b-wholesale-setup` | 0 | 3 | numbers.unsourced, judges.disagree | 18 of 55 numbers in The Problem/Market Research/Competitive Landscape have no inline link or named source, e.g. (The Problem) "…nto Basic, Grow, and Advanced. A |
| `shopify-seo-keyword-tool` | 0 | 3 | claims.unsupported, judges.disagree | 13 of 16 claims are unsourced (7) or not found in their cited source (6), e.g. "Ahrefs starts at $99/month and climbs toward $999" |
| `tattoo-dm-booking-agent` | 0 | 3 | claims.outdated, claims.unsupported, judges.disagree | 1 claim(s) quote an older version of their source, e.g. "The broader tattoo market grows near 9.7% CAGR, from about USD 2.14 billion in 2024 toward USD 4.5 bill |
| `voice-copilot-field-technicians` | 0 | 3 | claims.unsupported, judges.disagree, sources.dead | 13 of 20 claims are unsourced (7) or not found in their cited source (6), e.g. "Field service management software is a roughly $4 billion to $6 billion global m |
| `workflow-audit-app-for-small-businesses` | 0 | 3 | numbers.unsourced, claims.unsupported, judges.disagree | 15 of 33 numbers in The Problem/Market Research/Competitive Landscape have no inline link or named source, e.g. (The Problem) "…pecialist will happily charge an |
| `ai-api-docs-generator` | 0 | 2 | claims.unsupported, judges.disagree | 11 of 15 claims are unsourced (7) or not found in their cited source (4), e.g. "Reddit's r/technicalwriting (52.7K members)" |
| `ai-code-reviewer` | 0 | 2 | claims.unsupported, judges.disagree | 5 of 7 claims are unsourced (4) or not found in their cited source (1), e.g. "Stack Overflow Developer Survey: code review is consistently the 2nd most time-con |
| `ai-customer-interview-analyzer` | 0 | 2 | sources.unreachable, judges.disagree | 3 of 5 cited sources could not be read (60%): openpr.com (403), marketgrowthreports.com (403), cleverx.com (202) |
| `ai-merge-inspector` | 0 | 2 | judges.fake_data, judges.disagree | fake_data 3/5 (claude-haiku-4.5 3, gemini-3.8-flash 5, gpt-5.6-luna 3): "$10.12 billion in 2026, with a path to $91.09 billion by 2035 (Ideabrowser idea 8902, t |
| `ai-prompt-optimization-marketers` | 0 | 2 | sources.unreachable, judges.disagree | 3 of 6 cited sources could not be read (50%): grandviewresearch.com (403), promptbase.com (403), reddit.com (403) |
| `ai-rfp-response-assistant` | 0 | 2 | claims.unsupported, sources.unreachable | 7 of 9 claims are unsourced (5) or not found in their cited source (2), e.g. "Public pricing for category leaders starts around five figures annually with annua |
| `ai-search-publicist-freelancers` | 0 | 2 | judges.disagree | fake_data: judges differ by 2 points (claude-haiku-4.5 4, gemini-3.8-flash 5, gpt-5.6-luna 3); review by hand |
| `ai-startup-governance-copilot` | 0 | 2 | claims.unsupported, judges.fake_data | 10 of 14 claims are unsourced (4) or not found in their cited source (6), e.g. "The AI governance market is estimated around $308 million to $414 million in 202 |
| `ai-top-three-task-widget` | 0 | 2 | claims.unsupported, judges.disagree | 12 of 15 claims are unsourced (7) or not found in their cited source (5), e.g. "Todoist Premium is about $4/mo" |
| `ai-website-redesign-service` | 0 | 2 | claims.unsupported, sources.dead | 14 of 17 claims are unsourced (11) or not found in their cited source (3), e.g. "Roughly 50% of small businesses still operate without any real website" |
| `college-retention-early-help-router` | 0 | 2 | sources.unreachable, judges.disagree | 4 of 6 cited sources could not be read (67%): pcc.edu (200), govstech.apsu.edu (200), policy.cuny.edu (200) |
| `contractor-osha-safety-grade` | 0 | 2 | sources.unreachable, judges.disagree | 5 of 6 cited sources could not be read (83%): st.hzcdn.com (200), jchs.harvard.edu (200), grandviewresearch.com (403) |
| `creator-launch-kit` | 0 | 2 | claims.unsupported, judges.disagree | 10 of 11 claims are unsourced (9) or not found in their cited source (1), e.g. "North America accounts for 40–45.6% of that market—about $32–34B in 2025—and is  |
| `fan-funded-creator-products` | 0 | 2 | claims.unsupported, judges.consistency | 20 of 20 claims are unsourced (17) or not found in their cited source (3), e.g. "Fan funding platforms projected from roughly $2.1B (2024) toward $7.8B by 2033  |
| `first-international-hire-assistant` | 0 | 2 | judges.disagree, sources.dead | fake_data: judges differ by 2 points (claude-haiku-4.5 5, gemini-3.8-flash 5, gpt-5.6-luna 3); review by hand |
| `helpdesk-workflow-migration-cloner` | 0 | 2 | claims.unsupported, judges.disagree | 6 of 7 claims are unsourced (4) or not found in their cited source (2), e.g. "Enterprise data migration — the parent category that ticket export tools sell into |
| `invoice-payment-reconciler` | 0 | 2 | numbers.unsourced, judges.disagree | 19 of 21 numbers in The Problem/Market Research/Competitive Landscape have no inline link or named source, e.g. (The Problem) "…doing detective work every week: |
| `lightroom-preset-generator` | 0 | 2 | claims.unsupported, judges.disagree | 6 of 10 claims are unsourced (2) or not found in their cited source (4), e.g. "Adobe already ships Adaptive Presets inside Lightroom Classic / CC and owns 80%+  |
| `medication-interaction-checker` | 0 | 2 | claims.unsupported, judges.disagree | 10 of 14 claims are unsourced (10) or not found in their cited source (0), e.g. "A senior taking seven or more daily medications is not an edge case, it is the  |
| `meeting-scheduler` | 0 | 2 | numbers.unsourced, claims.unsupported | 22 of 46 numbers in The Problem/Market Research/Competitive Landscape have no inline link or named source, e.g. (The Problem) "…endly dominates the scheduling-l |
| `payment-reconciliation-market-vendors` | 0 | 2 | claims.unsupported, judges.error | 16 of 17 claims are unsourced (16) or not found in their cited source (0), e.g. "Ideabrowser's trend snapshot returned about 107,000 monthly searches across rel |
| `retro-ad-generator` | 0 | 2 | judges.fake_data, judges.disagree | fake_data 3/5 (claude-haiku-4.5 3, gemini-3.8-flash 4, gpt-5.6-luna 3): "AI marketing spend was cited at $27.83 billion in 2024 to $35.54 billion in 2025 in the |
| `subscription-audit-assistant` | 0 | 2 | claims.unsupported, judges.disagree | 14 of 14 claims are unsourced (11) or not found in their cited source (3), e.g. "The average household is carrying somewhere between eight and fifteen recurring |
| `timed-tool-access-contractors` | 0 | 2 | claims.unsupported, judges.disagree | 5 of 8 claims are unsourced (4) or not found in their cited source (1), e.g. "Reddit’s r/sysadmin holds about 1.3 million members" |
| `youth-sports-team-messaging-hub` | 0 | 2 | claims.unsupported, judges.disagree | 16 of 19 claims are unsourced (12) or not found in their cited source (4), e.g. "The U.S. unified communications market alone was $36B in 2024, growing to $144B |
| `code-audit-for-ai-built-apps` | 0 | 1 | judges.disagree | fake_data: judges differ by 3 points (claude-haiku-4.5 4, gemini-3.8-flash 5, gpt-5.6-luna 2); review by hand |
| `freelancer-income-proof-generator` | 0 | 1 | judges.disagree | fake_data: judges differ by 2 points (claude-haiku-4.5 4, gemini-3.8-flash 5, gpt-5.6-luna 3); review by hand |

Run `npm run evals:run -- --slug <slug>` for every finding on one page.
