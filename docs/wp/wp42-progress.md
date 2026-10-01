# WP42 Progress - Fix idea pages contradicted by their own sources

Append-only progress log.

## 2026-10-01 - Setup

- Branch: `claude/tender-carson-s0bvo8` (no worktree)
- Input: WP41 sweep (`evals/results/report.md`, verify-v2): 27 contradicted claims on 23 pages.
- Checked: none of the 23 has a structural failure; only `ai-material-estimator` also fails a judge (`fake_data`); `ideas/manifest.json` repeats none of the stale figures; bodies are MDX (no reseed).
- Method: read the cited source's cached text around the evidence (`evals/cache/sources/`), set the page figure to the source's, state year/period, fix dependent arguments, keep structure and voice.

## 2026-10-01 - WP42-S1 corrections

Each figure now matches the page's own cited source (text read from the cached fetch, 2026-10-01):

| Page | Was | Now (source) |
|---|---|---|
| ai-api-cost-optimizer-indie-builders | AI software $294.7B (2025), 32.4% CAGR | $292.71B (2025) → $995.45B by 2030, 26.7% (The Business Research Company) |
| ai-code-reviewer | CodeRabbit $15 Pro → $30 Ent; "below CodeRabbit's $15 floor"; dead TechCrunch link | Essentials (ex-Pro) $30/dev/mo ($24 annual), Team $60; "under a third of CodeRabbit's $30 Essentials"; live TechCrunch URL; "10K+ repos" (not in source) removed |
| ai-merge-inspector | CodeRabbit $15 Pro → $30 Ent | Essentials $30/dev/mo ($24 annual) → Team $60 |
| ai-course-tutor-companion | AI companion $18.35B (2025) → $54.19B (2034) | DataIntelo (narrow definition) $600.0M (2025) → $4.44B (2034), 24.9%; BRI's broader $18.35B kept, attributed (BRI blocks bots, unverified) |
| ai-dance-form-coach | $1.49B (2023) → $5.33B (2030), ~20% | ~$1.25B (2025), $1.4B (2026) → ~$3.6B (2034), ~12.4% (For Insights) |
| ai-material-estimator | smart materials $63.58–99.83B (2025), up to $284.87B by 2032, 8–16% | $84.57B (2025) → $169.62B (2034), 8.04% (Precedence); $84.78B → $148.15B (2032), 8.3% (Coherent MI). Judges' fake_data fail: "$50 per bad guess" labelled as Ideabrowser's estimate; unit economics labelled planning targets |
| ai-proposal-generator-consultants | $208M (2025) → $295M (2030), 7.2% | $208.00M (2025) → $222.82M (2026) → $343.96M (2032), 7.44% (360iResearch); dead pricing link fixed |
| ai-qa-test-case-generator-nocode | LCNC ~$65B (2026), 26.1% | ~$26–35B (2025) → ~$32–50B+ (2026), definition-dependent (ToolJet) |
| ai-schema-markup-tool | SEO services $90.35B → $106.9B; Yoast $99/yr | $92.74B (2025) → $203.83B (2030), 17.1% (TBRC); DesignRush's $106.9B kept, attributed; Yoast Premium $118.80/yr ex VAT |
| ai-student-support-bot-online-educators | $17.8B by 2033, 28.2% | $2.74B (2024) → ~$24.2B (2033), 27.8% (Growth Market Reports); dead Google Edu link fixed |
| ai-website-launch-rescue | $3.1–3.8B (2025); NA ~38% | $2.69B (2025) → $3.24B (2026) → $17.43B (2035), 20.55%; NA ~43% (Hostinger / Precedence) |
| branded-client-portal-builder-for-freelancers | $5.2–7.4B (2023–24) → $21.9B, 8–18.35% | $1.7B (2023) → $3.5B (2032), 8% (GMI); $1.81B (2024) → $3.38B (2031), 8.15% (VMR) |
| chat-with-historical-figures | $15.57B (2025) → $46.64B (2029), 24.53% | $10.25B (2025) → $13.28B (2026) → $37.53B (2030), 29.7% (Research and Markets via Exploding Topics) |
| field-service-job-costing-tracker | HVAC net margin 2.5–3.5% | 5–12% average, 13%+ top quartile (Contractor In Charge) |
| freelancer-income-proof-generator | Income Checker ~$14.99 | as low as $5 per report; dead Truework link → Truework pricing |
| freelancer-late-payment-predictor | $7.65B (2025) → $14.39–16.54B (2030), 16.7–17.7% | $5.6B (2024) → $13.8B (2030), 16.1% (ResearchAndMarkets via GlobeNewswire); Barchart's $16.54B kept, attributed |
| inbox-zero-agent | $6.5B (2023) → $13.5B (2032), ~8.5% | $3.72B (2025) → $9.7B (2034), 11.2% (DataIntelo) |
| kdp-niche-finder | Publisher Rocket $97 one-time (also in a build prompt) | $199 one-time, lifetime (list $299). Dead publishing.com infographics removed with the two figures they backed ("~75% share", "$12B by 2027") |
| landlord-tenant-risk-screener | $3.28B (2023) → $5.37B (2030) credited to VMR; $1.5B credited to Precision | VMR: $1.5B (2023) → $2.7B (2031), 9.3%; the $3.28B series removed (no source shows it) |
| lightroom-preset-generator | $349.6M (2023), 17.7% (Grand View / GMI) | $336.3M (2023), 17.5%+ 2024–2032 (GMI) |
| renter-deposit-documentation-app | Rocket Lawyer ~$39.99/mo or ~$49.99/doc; dead Mordor Document AI link | Standard $34.99/mo or $149/yr, up to Pro $64.99/mo; Mordor IDP market $3.17B (2026) → $7.18B (2031), 17.78% |
| shopify-seo-keyword-tool | $1.2B (2024) → $2.5B (2033) | $1.2B (2025) → $2.5B (2034) per VMR, same figures a year earlier per Archive; dead SE Ranking / Ubersuggest / Mangools links → current pricing URLs |
| skill-path-course-finder | ~$61.59B (2026), ~13% to 2030 | US$40.58B (2026) → US$46.16B (2031), 2.61% (Statista), narrative adjusted |

- Checks run:
  - Live Layers 1-3 + links on the 23 pages (`npm run evals:changed -- --base HEAD --layers 3 --live --check-links`): 0 fail, 0 contradicted, 0 dead links, 2 outdated (warn). 170 calls, $0.37.
  - `ai-material-estimator`: fake_data median 2 → 3 (warn).
  - `npm run evals:calibrate -- --live --report`: PASS, 7/7 caught, 0/5 false fails.
  - Full report regenerated: 36 fail (31 structural, 4 fake_data, 3 specificity, 1 consistency), 189 warn; contradicted 27 → 0; dead links 78 → 69.
  - `npm run typecheck` pass; `npm run lint` 0 errors; `npm test` pass; `npm run build` pass; `git diff --check` clean.
- Note: 6 judge calls fail on every run (3 pages show `judges.error`); the panel still scores those pages from the other two judges. Worth a look in a follow-up.
