# Idea content quality report (Layer 0)

Generated 2026-09-24 by `npm run evals:run -- --all --report`. Do not edit by hand.

Layer 0 is the free, deterministic layer: structure, slop phrases, verbosity, unsourced numbers, source hygiene, placeholders, and cross-page duplication. Thresholds live in `evals/config.json`.

New or edited pages must reach `pass` or `warn` to merge. Pages below are existing debt, ranked worst first.

## Summary

| Status | Pages |
|---|---|
| fail | 31 |
| warn | 112 |
| pass | 82 |
| total | 225 |

## Findings by check

| Check | Pages failing | Pages warned |
|---|---|---|
| `structure` | 31 | 0 |
| `numbers.unsourced` | 0 | 98 |
| `verbosity.sentenceLength` | 0 | 29 |
| `verbosity.longSentences` | 0 | 24 |
| `sources.homepageOnly` | 0 | 11 |
| `verbosity.filler` | 0 | 8 |
| `slop.density` | 0 | 6 |
| `sources.duplicates` | 0 | 1 |

## Fix first: failing pages (31)

| Page | Fails | Warns | Checks | First failure |
|---|---|---|---|---|
| `markdown-client-proposals` | 2 | 1 | structure | body contains '{{' placeholder |
| `personal-wellness-coach` | 1 | 2 | structure | ## The Solution must contain **How it works:** followed by a numbered list |
| `shopify-trust-scanner` | 1 | 2 | structure | body word count 784 < 800 |
| `user-onboarding-builder` | 1 | 2 | structure | body has bare '<' that MDX would parse as JSX (escape as \< outside code fences) |
| `waitlist-manager` | 1 | 2 | structure | heading[7] expected '## Sources', got (missing) |
| `abandoned-cart-recovery` | 1 | 1 | structure | heading[7] expected '## Sources', got (missing) |
| `ai-agency-automation-control-panel` | 1 | 1 | structure | ## Sources needs ≥2 markdown links (got 0) |
| `ai-agent-error-translator` | 1 | 1 | structure | heading[7] expected '## Sources', got (missing) |
| `ai-coding-classroom-assistant` | 1 | 1 | structure | heading[7] expected '## Sources', got (missing) |
| `ai-feedback-triage-widget` | 1 | 1 | structure | heading[7] expected '## Sources', got (missing) |
| `ai-resume-tailorer` | 1 | 1 | structure | heading[7] expected '## Sources', got (missing) |
| `api-documentation-generator` | 1 | 1 | structure | heading[7] expected '## Sources', got (missing) |
| `content-repurposing-tool` | 1 | 1 | structure | heading[7] expected '## Sources', got (missing) |
| `expense-splitter-app` | 1 | 1 | structure | heading[7] expected '## Sources', got (missing) |
| `expert-mentorship-marketplace` | 1 | 1 | structure | ## The Solution must contain **How it works:** followed by a numbered list |
| `feature-voting-board` | 1 | 1 | structure | body has bare '<' that MDX would parse as JSX (escape as \< outside code fences) |
| `last-20-builder-rescue` | 1 | 1 | structure | heading[7] expected '## Sources', got (missing) |
| `one-star-attack-detection` | 1 | 1 | structure | body word count 797 < 800 |
| `recall-radar-ecommerce-sellers` | 1 | 1 | structure | heading[7] expected '## Sources', got (missing) |
| `single-event-app-builder` | 1 | 1 | structure | heading[7] expected '## Sources', got (missing) |
| `social-media-scheduler` | 1 | 1 | structure | heading[7] expected '## Sources', got (missing) |
| `subscription-analytics-dashboard` | 1 | 1 | structure | heading[7] expected '## Sources', got (missing) |
| `whatsapp-tour-guide-comms` | 1 | 1 | structure | body contains '{{' placeholder |
| `ai-code-coach-tutor` | 1 | 0 | structure | heading[7] expected '## Sources', got (missing) |
| `ai-knowledge-transfer-platform` | 1 | 0 | structure | ## The Solution must contain **How it works:** followed by a numbered list |
| `conversational-analytics-digest` | 1 | 0 | structure | heading[7] expected '## Sources', got (missing) |
| `corporate-knowledge-ai-assistant` | 1 | 0 | structure | ## The Solution must contain **How it works:** followed by a numbered list |
| `customer-feedback-aggregator` | 1 | 0 | structure | heading[7] expected '## Sources', got (missing) |
| `invoice-reminder-bot` | 1 | 0 | structure | body contains '{{' placeholder |
| `vehicle-recall-alert-service` | 1 | 0 | structure | heading[7] expected '## Sources', got (missing) |
| `vibe-coders-for-hire` | 1 | 0 | structure | heading[7] expected '## Sources', got (missing) |

## Review: pages with warnings (112)

| Page | Fails | Warns | Checks | First warning |
|---|---|---|---|---|
| `ai-grant-writing-assistant-nonprofits` | 0 | 3 | verbosity.sentenceLength, verbosity.longSentences, numbers.unsourced | average sentence is 26.3 words (warn > 25) |
| `ai-product-data-cleaner-for-ecommerce` | 0 | 3 | verbosity.sentenceLength, verbosity.longSentences, numbers.unsourced | average sentence is 28.4 words (warn > 25) |
| `branded-client-portal-builder-for-freelancers` | 0 | 3 | verbosity.sentenceLength, verbosity.longSentences, numbers.unsourced | average sentence is 27.1 words (warn > 25) |
| `chattracker` | 0 | 3 | verbosity.sentenceLength, verbosity.filler, numbers.unsourced | average sentence is 25.4 words (warn > 25) |
| `field-service-job-costing-tracker` | 0 | 3 | verbosity.sentenceLength, verbosity.longSentences, numbers.unsourced | average sentence is 27.7 words (warn > 25) |
| `vacation-rental-turnover-coordinator` | 0 | 3 | verbosity.sentenceLength, verbosity.longSentences, numbers.unsourced | average sentence is 27.5 words (warn > 25) |
| `ai-brake-inspection-analyser` | 0 | 2 | slop.density, numbers.unsourced | 1.52 stock AI words per 1k words (warn > 1.5): leverage x1 |
| `ai-chief-of-staff-consultants` | 0 | 2 | numbers.unsourced, sources.homepageOnly | 15 of 21 numbers in The Problem/Market Research/Competitive Landscape have no inline link or named source, e.g. (The Problem) "Solo consultants bill $150–$300 a |
| `ai-compliance-policy-generator-smbs` | 0 | 2 | verbosity.sentenceLength, verbosity.longSentences | average sentence is 29.5 words (warn > 25) |
| `ai-flash-sale-creator-for-shopify` | 0 | 2 | verbosity.sentenceLength, verbosity.longSentences | average sentence is 30.2 words (warn > 25) |
| `ai-insurance-claim-appeal-writer` | 0 | 2 | verbosity.sentenceLength, numbers.unsourced | average sentence is 25.1 words (warn > 25) |
| `ai-job-post-applicant-screener` | 0 | 2 | verbosity.sentenceLength, verbosity.longSentences | average sentence is 26 words (warn > 25) |
| `ai-material-estimator` | 0 | 2 | verbosity.sentenceLength, verbosity.filler | average sentence is 27 words (warn > 25) |
| `ai-proposal-generator-consultants` | 0 | 2 | verbosity.sentenceLength, verbosity.longSentences | average sentence is 26 words (warn > 25) |
| `ai-qa-test-case-generator-nocode` | 0 | 2 | verbosity.sentenceLength, verbosity.longSentences | average sentence is 27.3 words (warn > 25) |
| `ai-wiki-keeper` | 0 | 2 | verbosity.sentenceLength, verbosity.longSentences | average sentence is 26 words (warn > 25) |
| `anti-ghosting-recruitment-crm` | 0 | 2 | verbosity.sentenceLength, verbosity.longSentences | average sentence is 29.6 words (warn > 25) |
| `bnpl-for-digital-products` | 0 | 2 | verbosity.sentenceLength, verbosity.longSentences | average sentence is 27.1 words (warn > 25) |
| `career-transition-escape-plan` | 0 | 2 | verbosity.sentenceLength, verbosity.longSentences | average sentence is 27.2 words (warn > 25) |
| `chargeback-protection-for-ecommerce-sellers` | 0 | 2 | verbosity.sentenceLength, verbosity.longSentences | average sentence is 28.7 words (warn > 25) |
| `daily-ai-checkin-calls-for-seniors` | 0 | 2 | verbosity.sentenceLength, verbosity.longSentences | average sentence is 28.9 words (warn > 25) |
| `daily-standup-bot` | 0 | 2 | verbosity.filler, numbers.unsourced | 5 filler words per 1k words (warn > 4) |
| `focus-session-timer` | 0 | 2 | numbers.unsourced, sources.homepageOnly | 26 of 41 numbers in The Problem/Market Research/Competitive Landscape have no inline link or named source, e.g. (The Problem) "…proven rhythm. The upgrade path  |
| `high-school-athlete-highlight-reel` | 0 | 2 | numbers.unsourced, sources.homepageOnly | 18 of 26 numbers in The Problem/Market Research/Competitive Landscape have no inline link or named source, e.g. (The Problem) "Hudl already sits on 14 million-p |
| `kdp-niche-finder` | 0 | 2 | verbosity.sentenceLength, verbosity.longSentences | average sentence is 27 words (warn > 25) |
| `local-seo-citation-manager` | 0 | 2 | verbosity.sentenceLength, verbosity.longSentences | average sentence is 31.4 words (warn > 25) |
| `markdown-publish-everywhere` | 0 | 2 | numbers.unsourced, sources.duplicates | 15 of 22 numbers in The Problem/Market Research/Competitive Landscape have no inline link or named source, e.g. (Market Research) "…and content-tool SaaS produc |
| `micro-influencer-deliverable-tracker` | 0 | 2 | verbosity.sentenceLength, verbosity.longSentences | average sentence is 27.5 words (warn > 25) |
| `quickbooks-escape-ramp` | 0 | 2 | slop.density, numbers.unsourced | 1.69 stock AI words per 1k words (warn > 1.5): harness x3 |
| `rental-property-maintenance-dashboard` | 0 | 2 | verbosity.sentenceLength, verbosity.longSentences | average sentence is 28.2 words (warn > 25) |
| `slack-to-notion-docs` | 0 | 2 | verbosity.sentenceLength, verbosity.longSentences | average sentence is 26.8 words (warn > 25) |
| `youtube-algorithm-alerts` | 0 | 2 | verbosity.sentenceLength, verbosity.longSentences | average sentence is 27.3 words (warn > 25) |
| `adventure-date-night-app` | 0 | 1 | numbers.unsourced | 25 of 60 numbers in The Problem/Market Research/Competitive Landscape have no inline link or named source, e.g. (The Problem) "…ideas. “Experience gifts for cou |
| `ai-api-cost-optimizer-indie-builders` | 0 | 1 | verbosity.longSentences | 23% of sentences run over 35 words; longest is 60: "It's the daily reality showing up across developer communities at scale: r/aws (341K members) and r/devops ( |
| `ai-app-security-badge` | 0 | 1 | verbosity.sentenceLength | average sentence is 25.9 words (warn > 25) |
| `ai-arbitrage-agent-resellers` | 0 | 1 | numbers.unsourced | 23 of 31 numbers in The Problem/Market Research/Competitive Landscape have no inline link or named source, e.g. (The Problem) "…d KitchenAid, a lot of Lego, any |
| `ai-builder-hiring-marketplace` | 0 | 1 | numbers.unsourced | 12 of 17 numbers in The Problem/Market Research/Competitive Landscape have no inline link or named source, e.g. (Market Research) "- Macro AI software + service |
| `ai-cart-rescue-emotional-emails` | 0 | 1 | numbers.unsourced | 17 of 32 numbers in The Problem/Market Research/Competitive Landscape have no inline link or named source, e.g. (The Problem) "…ry benchmarks put average cart a |
| `ai-content-factory-human-qc` | 0 | 1 | numbers.unsourced | 23 of 37 numbers in The Problem/Market Research/Competitive Landscape have no inline link or named source, e.g. (The Problem) "…he actual job now: not writing,  |
| `ai-course-tutor-companion` | 0 | 1 | numbers.unsourced | 18 of 21 numbers in The Problem/Market Research/Competitive Landscape have no inline link or named source, e.g. (The Problem) "…nd cohort completion rates routi |
| `ai-cpg-packaging-designer` | 0 | 1 | numbers.unsourced | 23 of 27 numbers in The Problem/Market Research/Competitive Landscape have no inline link or named source, e.g. (The Problem) "…aging engagement with a real age |
| `ai-landing-page-generator-ecommerce` | 0 | 1 | numbers.unsourced | 14 of 21 numbers in The Problem/Market Research/Competitive Landscape have no inline link or named source, e.g. (The Problem) "…oney into paid ads — U.S. digita |
| `ai-lesson-planner-teachers` | 0 | 1 | numbers.unsourced | 18 of 24 numbers in The Problem/Market Research/Competitive Landscape have no inline link or named source, e.g. (The Problem) "…their certification. Meanwhile t |
| `ai-nutrition-planner-trainers` | 0 | 1 | numbers.unsourced | 32 of 41 numbers in The Problem/Market Research/Competitive Landscape have no inline link or named source, e.g. (The Problem) "…online coaches sell results. Nut |
| `ai-protein-tracker` | 0 | 1 | numbers.unsourced | 11 of 18 numbers in The Problem/Market Research/Competitive Landscape have no inline link or named source, e.g. (The Problem) "…has already validated the broade |
| `ai-schema-markup-tool` | 0 | 1 | numbers.unsourced | 17 of 39 numbers in The Problem/Market Research/Competitive Landscape have no inline link or named source, e.g. (The Problem) "…ON-LD into , broke the header, p |
| `ai-site-design-blueprints` | 0 | 1 | numbers.unsourced | 45 of 64 numbers in The Problem/Market Research/Competitive Landscape have no inline link or named source, e.g. (The Problem) "…expensive version. Shops buy Cla |
| `ai-slide-deck-maker` | 0 | 1 | numbers.unsourced | 21 of 29 numbers in The Problem/Market Research/Competitive Landscape have no inline link or named source, e.g. (Market Research) "…AI presentation makers marke |
| `ai-storybook-generator-for-kids` | 0 | 1 | verbosity.sentenceLength | average sentence is 25.9 words (warn > 25) |
| `ai-student-support-bot-online-educators` | 0 | 1 | numbers.unsourced | 16 of 29 numbers in The Problem/Market Research/Competitive Landscape have no inline link or named source, e.g. (Market Research) "…for course-support assistant |
| `ai-travel-planner` | 0 | 1 | numbers.unsourced | 9 of 11 numbers in The Problem/Market Research/Competitive Landscape have no inline link or named source, e.g. (Market Research) "- $317.4 billion by 2029 — the |
| `ai-verified-freelancer-marketplace` | 0 | 1 | verbosity.sentenceLength | average sentence is 27.5 words (warn > 25) |
| `ai-video-editor-for-creators` | 0 | 1 | verbosity.longSentences | 21% of sentences run over 35 words; longest is 52: "The category is officially in an "early-maturity but competitive" stage — mature enough that the core techno |
| `ai-website-launch-rescue` | 0 | 1 | numbers.unsourced | 19 of 55 numbers in The Problem/Market Research/Competitive Landscape have no inline link or named source, e.g. (The Problem) "…l. CVE-2025-48757 found row-leve |
| `ai-writing-coach-freelancers` | 0 | 1 | numbers.unsourced | 5 of 8 numbers in The Problem/Market Research/Competitive Landscape have no inline link or named source, e.g. (Market Research) "…tent creators who already sell |
| `ai-zoning-intelligence` | 0 | 1 | numbers.unsourced | 12 of 17 numbers in The Problem/Market Research/Competitive Landscape have no inline link or named source, e.g. (Market Research) "- AI in real estate is a $303 |
| `aws-cert-ai-study-buddy` | 0 | 1 | sources.homepageOnly | 57% of sources are bare homepages, which cannot back a specific number |
| `brake-repair-cost-estimator` | 0 | 1 | numbers.unsourced | 11 of 13 numbers in The Problem/Market Research/Competitive Landscape have no inline link or named source, e.g. (The Problem) "…ing, calls two shops, and gets e |
| `brake-safety-education-platform` | 0 | 1 | numbers.unsourced | 2 of 3 numbers in The Problem/Market Research/Competitive Landscape have no inline link or named source, e.g. (Market Research) "…e — educated leads convert hig |
| `brakes-maintenance-tracker-app` | 0 | 1 | numbers.unsourced | 2 of 3 numbers in The Problem/Market Research/Competitive Landscape have no inline link or named source, e.g. (Competitive Landscape) "…ed. Often subscription o |
| `client-portal` | 0 | 1 | numbers.unsourced | 20 of 33 numbers in The Problem/Market Research/Competitive Landscape have no inline link or named source, e.g. (Market Research) "The global client portal soft |
| `contract-analyzer` | 0 | 1 | numbers.unsourced | 19 of 27 numbers in The Problem/Market Research/Competitive Landscape have no inline link or named source, e.g. (The Problem) "…work: the cheapest small-busines |
| `contractor-ai-receptionist` | 0 | 1 | numbers.unsourced | 32 of 81 numbers in The Problem/Market Research/Competitive Landscape have no inline link or named source, e.g. (Market Research) "…y-killer CPCs. “HVAC answeri |
| `contractor-lead-refund-automation` | 0 | 1 | numbers.unsourced | 21 of 47 numbers in The Problem/Market Research/Competitive Landscape have no inline link or named source, e.g. (The Problem) "…trucks have to stay full. The bi |
| `course-completion-nudge-platform` | 0 | 1 | verbosity.filler | 4.46 filler words per 1k words (warn > 4) |
| `course-translation-resale-network` | 0 | 1 | numbers.unsourced | 24 of 45 numbers in The Problem/Market Research/Competitive Landscape have no inline link or named source, e.g. (The Problem) "…get 25 auto-translated languages |
| `data-freelancer-bounty-board` | 0 | 1 | numbers.unsourced | 25 of 45 numbers in The Problem/Market Research/Competitive Landscape have no inline link or named source, e.g. (The Problem) "…tor-pricing table by Friday. An  |
| `email-to-todo` | 0 | 1 | numbers.unsourced | 32 of 41 numbers in The Problem/Market Research/Competitive Landscape have no inline link or named source, e.g. (The Problem) "…y language, and output a clean s |
| `etsy-seo-optimizer` | 0 | 1 | verbosity.sentenceLength | average sentence is 25.3 words (warn > 25) |
| `expense-report-generator` | 0 | 1 | numbers.unsourced | 33 of 36 numbers in The Problem/Market Research/Competitive Landscape have no inline link or named source, e.g. (The Problem) "…waste 40+ hours a month on expen |
| `freelance-scope-creep-detector` | 0 | 1 | verbosity.filler | 4.65 filler words per 1k words (warn > 4) |
| `freelancer-late-payment-predictor` | 0 | 1 | numbers.unsourced | 25 of 54 numbers in The Problem/Market Research/Competitive Landscape have no inline link or named source, e.g. (The Problem) "A copywriter sends a $4,800 invoi |
| `freelancer-tax-filing-bot` | 0 | 1 | numbers.unsourced | 22 of 43 numbers in The Problem/Market Research/Competitive Landscape have no inline link or named source, e.g. (The Problem) "…t. Their “books” are a Notes app |
| `gamified-money-habit-app` | 0 | 1 | numbers.unsourced | 19 of 24 numbers in The Problem/Market Research/Competitive Landscape have no inline link or named source, e.g. (Market Research) "- The gamification market is  |
| `government-contract-finder` | 0 | 1 | verbosity.filler | 4.45 filler words per 1k words (warn > 4) |
| `gutcheck-ai-ad-optimization` | 0 | 1 | slop.density | 2.24 stock AI words per 1k words (warn > 1.5): dynamic x2, robust x1 |
| `habit-tracker` | 0 | 1 | numbers.unsourced | 24 of 37 numbers in The Problem/Market Research/Competitive Landscape have no inline link or named source, e.g. (The Problem) "…change works when it's simple. A |
| `inbox-zero-agent` | 0 | 1 | numbers.unsourced | 13 of 18 numbers in The Problem/Market Research/Competitive Landscape have no inline link or named source, e.g. (The Problem) "…nbox zero that never closes. A c |
| `invoice-coding-error-scanner` | 0 | 1 | numbers.unsourced | 24 of 32 numbers in The Problem/Market Research/Competitive Landscape have no inline link or named source, e.g. (The Problem) "…guessed categories. Twenty minut |
| `invoice-payment-reconciler` | 0 | 1 | numbers.unsourced | 19 of 21 numbers in The Problem/Market Research/Competitive Landscape have no inline link or named source, e.g. (The Problem) "…doing detective work every week: |
| `landlord-tenant-risk-screener` | 0 | 1 | numbers.unsourced | 15 of 43 numbers in The Problem/Market Research/Competitive Landscape have no inline link or named source, e.g. (Market Research) "- Large agencies run about 60 |
| `meeting-mood-ai` | 0 | 1 | numbers.unsourced | 20 of 29 numbers in The Problem/Market Research/Competitive Landscape have no inline link or named source, e.g. (Market Research) "- Global mood tracker app mar |
| `meeting-scheduler` | 0 | 1 | numbers.unsourced | 22 of 46 numbers in The Problem/Market Research/Competitive Landscape have no inline link or named source, e.g. (The Problem) "…endly dominates the scheduling-l |
| `mobile-brake-repair-marketplace` | 0 | 1 | numbers.unsourced | 5 of 6 numbers in The Problem/Market Research/Competitive Landscape have no inline link or named source, e.g. (The Problem) "…to schedule. Shops keep 9–5 hours; |
| `nasm-trainer-marketplace` | 0 | 1 | numbers.unsourced | 35 of 48 numbers in The Problem/Market Research/Competitive Landscape have no inline link or named source, e.g. (The Problem) "Meanwhile, the NASM-certified tra |
| `nocode-specialist-repair-marketplace` | 0 | 1 | numbers.unsourced | 30 of 58 numbers in The Problem/Market Research/Competitive Landscape have no inline link or named source, e.g. (The Problem) "A founder ships 80 percent of a B |
| `notion-backup-tool` | 0 | 1 | numbers.unsourced | 15 of 33 numbers in The Problem/Market Research/Competitive Landscape have no inline link or named source, e.g. (The Problem) "Notion is the second brain for an |
| `personalized-employee-wellness-platform` | 0 | 1 | numbers.unsourced | 15 of 24 numbers in The Problem/Market Research/Competitive Landscape have no inline link or named source, e.g. (The Problem) "…ndividual. For a 40-person compa |
| `phone-body-composition-scanner` | 0 | 1 | numbers.unsourced | 16 of 46 numbers in The Problem/Market Research/Competitive Landscape have no inline link or named source, e.g. (The Problem) "A Wegovy user steps on a $400 sma |
| `quiet-creator-personal-branding` | 0 | 1 | numbers.unsourced | 17 of 32 numbers in The Problem/Market Research/Competitive Landscape have no inline link or named source, e.g. (The Problem) "…watches a competitor's talking-h |
| `real-estate-workflow-automation` | 0 | 1 | numbers.unsourced | 6 of 7 numbers in The Problem/Market Research/Competitive Landscape have no inline link or named source, e.g. (The Problem) "…ool, an email drip platform, and a |
| `renter-deposit-documentation-app` | 0 | 1 | numbers.unsourced | 18 of 37 numbers in The Problem/Market Research/Competitive Landscape have no inline link or named source, e.g. (The Problem) "…tenant hands back the keys, ment |
| `s-corp-monthly-finance-desk` | 0 | 1 | numbers.unsourced | 43 of 54 numbers in The Problem/Market Research/Competitive Landscape have no inline link or named source, e.g. (The Problem) "…hangover is monthly. A one-perso |
| `saas-financial-toolkit` | 0 | 1 | slop.density | 1.53 stock AI words per 1k words (warn > 1.5): comprehensive x1, best-in-class x1 |
| `shopify-b2b-wholesale-setup` | 0 | 1 | numbers.unsourced | 18 of 55 numbers in The Problem/Market Research/Competitive Landscape have no inline link or named source, e.g. (The Problem) "…nto Basic, Grow, and Advanced. A |
| `shopify-review-intelligence` | 0 | 1 | sources.homepageOnly | 80% of sources are bare homepages, which cannot back a specific number |
| `small-order-wholesale-marketplace` | 0 | 1 | numbers.unsourced | 15 of 23 numbers in The Problem/Market Research/Competitive Landscape have no inline link or named source, e.g. (The Problem) "…boutique marketplace, brands han |
| `small-town-storefront-marketplace` | 0 | 1 | numbers.unsourced | 8 of 11 numbers in The Problem/Market Research/Competitive Landscape have no inline link or named source, e.g. (The Problem) "…her side of the same pain. Downto |
| `sms-time-tracker` | 0 | 1 | numbers.unsourced | 15 of 39 numbers in The Problem/Market Research/Competitive Landscape have no inline link or named source, e.g. (The Problem) "…the U.S. side-hustle population  |
| `solo-founder-health-score` | 0 | 1 | numbers.unsourced | 19 of 31 numbers in The Problem/Market Research/Competitive Landscape have no inline link or named source, e.g. (Market Research) "- 64 million independent work |
| `three-minute-money-habit-app` | 0 | 1 | verbosity.filler | 4.26 filler words per 1k words (warn > 4) |
| `tiktok-shop-fulfillment-automation` | 0 | 1 | numbers.unsourced | 16 of 26 numbers in The Problem/Market Research/Competitive Landscape have no inline link or named source, e.g. (The Problem) "…not a hypothetical. TikTok Shop' |
| `tiktok-trend-predictor-creators` | 0 | 1 | numbers.unsourced | 16 of 25 numbers in The Problem/Market Research/Competitive Landscape have no inline link or named source, e.g. (The Problem) "…rs live and die by timing. The d |
| `underused-venue-marketplace` | 0 | 1 | numbers.unsourced | 14 of 22 numbers in The Problem/Market Research/Competitive Landscape have no inline link or named source, e.g. (The Problem) "…for roughly six hours a week. A  |
| `video-sales-funnel-builder` | 0 | 1 | numbers.unsourced | 23 of 35 numbers in The Problem/Market Research/Competitive Landscape have no inline link or named source, e.g. (The Problem) "…s (Gisteo, Skyline) will build t |
| `viral-ad-licensing-dtc` | 0 | 1 | numbers.unsourced | 17 of 47 numbers in The Problem/Market Research/Competitive Landscape have no inline link or named source, e.g. (The Problem) "…UGC in Facebook ads can 4x CTR a |
| `virtual-knowledge-hub` | 0 | 1 | numbers.unsourced | 39 of 47 numbers in The Problem/Market Research/Competitive Landscape have no inline link or named source, e.g. (The Problem) "…s not want a LinkedIn course. Sh |
| `voice-desktop-workflow-macros` | 0 | 1 | numbers.unsourced | 13 of 19 numbers in The Problem/Market Research/Competitive Landscape have no inline link or named source, e.g. (Market Research) "…e and speech recognition sof |
| `website-accessibility-ada-scanner` | 0 | 1 | slop.density | 1.81 stock AI words per 1k words (warn > 1.5): comprehensive x1 |
| `wedding-event-staffing-marketplace` | 0 | 1 | sources.homepageOnly | 75% of sources are bare homepages, which cannot back a specific number |
| `wedding-flower-pinterest-budget` | 0 | 1 | numbers.unsourced | 34 of 42 numbers in The Problem/Market Research/Competitive Landscape have no inline link or named source, e.g. (The Problem) "…ot. She dumps a Pinterest board  |
| `workflow-audit-app-for-small-businesses` | 0 | 1 | numbers.unsourced | 15 of 33 numbers in The Problem/Market Research/Competitive Landscape have no inline link or named source, e.g. (The Problem) "…pecialist will happily charge an |

Run `npm run evals:run -- --slug <slug>` for every finding on one page.
