# WP54 S7 failure check: three live runs that stopped at `evidence_acceptance`

- **Date:** 2026-10-03
- **Code revision:** `02cd9b8` (`02cd9b84d23120782da5ee1711d26e29ad441398`, clean). Nothing under `lib/`, `scripts/` or `engine/` changed between `02cd9b8` and `e4b5f67` (only docs), so the code read here is the code that ran.
- **Contract:** record v2, pipeline v2. Rulings R5, R9 and R14 plus the R13–R15 implementation notes (`docs/plans/idea-engine/pr71-evidence-contract.md` §12).
- **Reviewer:** independent and read-only. I did not run `engine:research` or any paid call, and ran no git command that changes state.

| Brief | Run cost | Accepted prices | Vendors with an accepted price | Stopped at |
|---|---|---|---|---|
| ai-code-reviewer | $0.3266 | 3 | 1 (CodeRabbit, inferred below) | evidence_acceptance |
| ai-rfp-response-assistant | $0.3300 | 3 | 1 (RFP.ai, inferred below) | evidence_acceptance |
| ai-landing-page-generator-ecommerce | $0.3117 | 8 | 1 (PageFly) | evidence_acceptance |
| **Total** | **$0.9683** | | | |

All three failed on the same shortfall: "priced competitors: 1 vendors with an accepted price, need 3". All three stopped before any keyword or writer spend.

## Verdicts at a glance

| Brief | Classification | In one line |
|---|---|---|
| ai-code-reviewer | **Market limit** (plus an extraction-coverage miss) | Of the vendors' own pages, only CodeRabbit shows a seat price the grammar can bind. The others show usage pricing, a credit pack with no unit, or prices whose billing depends on a toggle. A neutral market page had a price table that acceptance would take, but the extractor never saw it, and the prices look stale. |
| ai-rfp-response-assistant | **Market limit** | Only RFP.ai publishes self-serve prices. Under the current contract the ceiling is 2 vendors: RFP.ai plus a third-party Loopio claim that Loopio's own page does not show. |
| ai-landing-page-generator-ecommerce | **Rule-intended false negative** | Instant and Replo publish real plan prices on their own Shopify App Store listings. §5 and R5 treat a marketplace host as a neutral page, so the price's clause must name the app, and it doesn't. With the same text treated as the app's own page, all 5 prices pass and the brief clears this gate. |

None of the rejections in these runs comes from code that departs from R5, R9 or R14. I found three problems in passing, none of which caused these failures:

- one implementation defect in text fidelity;
- two contract-level false positives.

They are described under "Found in passing".

## Method

1. **Pages.** I fetched every competitor page in the three reports (22 distinct URLs). I also fetched all 44 market and community pages, to check whether any of them states a vendor price.
   - All fetches used the owner's headless Chromium command, one at a time, with the prescribed profile.
   - `view-source:<url>` gave the server HTML that the engine reads. The plain URL gave the JavaScript-rendered DOM, which is what a person sees.
   - I did not log in, submit forms or follow links. Page dumps stay in the session scratch directory, outside the repo.
2. **Engine text.** I rebuilt each page's text offline with the repo's own `htmlToText` (`lib/engine/providers/sourceText.ts:460`).
   - **Exact (15 of 22 competitor pages):** the rebuilt text has the same SHA-256 as the run's `textSha256`, so it is byte-for-byte what the run read. These are:
     - CodeRabbit pricing and FAQ;
     - Qodo pricing;
     - Macroscope;
     - docs.bito.ai;
     - Responsive pricing and both Responsive blog posts;
     - rfp.ai pricing and home;
     - clawnewbie;
     - help.pagefly.io (EN and JA);
     - the Instant and Replo listings.
   - **Approx (7 pages):** bito.ai/pricing, the codeant.ai blog, loopio.com/pricing, loopio.com, pagefly.io/pages/pricing, apps.shopify.com/pagefly and unbounce.com/pricing differ from the run's hash. Findings on those rest on today's copy and are marked "approx".
3. **What the extractor saw.** The extraction model never sees whole pages. I computed each page's excerpt with the repo's `extractionExcerpt` (`lib/engine/pipeline-sources.ts:335`).
   - A page whose role is not community contributes the sentences that hold a figure, plus two neighbours on each side, in page order. This is capped at 3,000 bytes (`pipeline-sources.ts:270`, `295–327`).
   - All pages share one budget of about 44.5 KB: 48,000 input tokens (`lib/engine/pipeline-steps.ts:130`) less framing and the 3,004-byte instructions.
   - With 21–24 readable pages per run, the per-page floor works out at 1,746, 1,586 and 1,841 bytes for the three runs. I assumed 160-character titles, so these floors are conservative.
   - I checked each page at both the floor and the 3,000-byte cap.
4. **What acceptance would do.** I called `acceptEvidence` offline (`lib/engine/evidence/accept.ts`) on the rebuilt text with hypothetical candidates. These are pure function calls, with no network, no provider and no repo writes. I call this the harness below.
5. **Which vendor was accepted.** The reports give accepted counts, not the accepted items, so I inferred each vendor from the harness:
   - **ai-code-reviewer:** the harness accepts exactly CodeRabbit's three card prices as first-party, and no price from any other cited vendor page the extractor saw. So the one vendor is CodeRabbit, not Bito.
   - **ai-rfp-response-assistant:** rfp.ai is the only cited vendor page with prices the grammar can read.

## 1. ai-code-reviewer ($0.3266)

| Page (text) | What it shows | What the run did | Correct per contract? | Classification |
|---|---|---|---|---|
| coderabbit.ai/pricing (exact) | A toggle line "Annual Save 20% Monthly". Essentials "$24 / developer / month", Team $48 and Advanced $72, each with "Billed annually" on the next line. Agent add-on "$0.40 per agent minute". | 3 prices accepted: the run's only priced vendor, and exactly the three the harness accepts (first-party). "$0.40 per agent minute" was rejected as `unparseable_amount`. | Yes. A qualifier on the next line continues the expression (`amount.ts:63`, `readGap` `919–939`), so "Billed annually" binds and the toggle rule is satisfied. Per-minute units are outside the grammar (`amount.ts:808–856`). | Accepted. The usage price is a rule-intended false negative. |
| coderabbit.ai/faq and /FAQ (exact, same text) | FAQ prose: "$30 per developer per month, or $24 per developer per month when billed annually". Also "$0.25 per reviewed file". | "$0.25 per reviewed file" and "$0.40 per agent minute" were rejected as `unparseable_amount` (`accept.ts:1469–1470`). | Yes. Neither is a period or basis unit. See "Found in passing" item 2 for the $30 sentence. | Rule-intended false negative |
| bito.ai/pricing (approx) | A Monthly/Annual toggle. The Team card holds "$12 $15" (both toggle states are in the DOM), then "monthly per seat" as a separate heading. Professional "$20 $25". A self-host add-on at "$5/seat/month". | Nothing proposed. | Yes. Nothing in the text says which figure is the annual one, so R9/R14 call it ambiguous billing, and the instruction at `pipeline.ts:706` says to skip it. The grammar also cannot read "$15", a line break, then "monthly": an adverb may not follow a line break (`amount.ts:899`). Harness: "$15 monthly per seat" is `unparseable_amount`; the add-on is `qualifier_dropped` (toggle above it, no billing in its clause). | Market / page-format limit |
| qodo.ai/pricing (exact) | The "Pro Team" card shows a bare "$30" with no period and no basis. The amount follows a credit-pack radio button (`data-plan-price` $30 / $60 / $240 for 2,500 / 5,000 / 20,000 credits). A period appears only in a feature bullet about 20 lines lower: "Monthly billing • no commitment". The plan is "Designed for up to 30 users"; there is no seat price. | "$30" proposed; rejected as `unparseable_amount`. | Yes. The price's expression has no period, and "No period → not a price" (`amount.ts:62`, `1014`). Claiming "$30/month" would fail too, because no such expression exists on the page. The model's excerpt of this page was 278 bytes ("Pro Team", "$30" and a tagline), so it never saw a period. | Market / page-format limit |
| macroscope.com/content/best-… (exact) | Macroscope's own pricing is usage-based: "$0.05 per KB reviewed" and "$0.01 per credit". The page also gives a team-cost estimate and a listicle of rivals' prices. | "$0.05/KB reviewed" was rejected as `unparseable_amount`. | Yes for the usage price. Rival prices on this page fail R5. Harness: Cursor BugBot and Greptile prices are `ambiguous_attribution`, because macroscope.com is Macroscope's own site. Macroscope is a known vendor because the run proposed a Macroscope price. The report omits candidate names, so that vendor name is inferred. | Rule-intended false negative |
| codeant.ai/blogs/best-… (approx) | CodeAnt's own listicle, with a 12-vendor price table (CodeRabbit, Copilot, Greptile, Graphite, Codacy, Bito, …). | Nothing proposed. | Yes. The rival prices fail whatever the run knew. If CodeAnt is a known vendor, R5 rejects them as `ambiguous_attribution`. If it is not, each rival's "Pricing:" line omits the vendor's name, so they fail as `vendor_not_in_context`; the harness confirms both cases. CodeAnt's own price ("Premium $24/user/mo") sits on a comparison path (the path contains "best") and does not name CodeAnt in its clause, so it also fails as `vendor_not_in_context` (`accept.ts:1335–1338`, confirmed in the harness). | Rule-intended false negative |
| docs.bito.ai/…/overview (exact) | No prices. | — | — | — |
| digitalapplied.com/blog/…-2025 (exact; cited for market) | A 2025 pricing table with rows "Cursor Bugbot 14-day trial $40/mo $40/mo Custom" and "GitHub Copilot — $10/mo $19/mo $39/mo". | Never shown to the extractor. The page's excerpt is 2,904 bytes even at the cap, and is filled by market-statistic runs above the table. | The harness would accept "Cursor Bugbot $40/month" and "GitHub Copilot $10/month" as secondary prices. With CodeRabbit that is 3 vendors. But the typed claims drop the per-seat basis of the Team column, and the table is a year old. codeant.ai, a rival's page, says Bugbot changed its pricing model in June 2026. | Extraction miss: excerpt coverage, by design. It would have passed on likely stale prices. |
| zylos.ai/research/… (exact; cited for market) | Per-tool "Pricing:" bullets under tool headings ("Individual : $12/month", "Team : $18/month per user"), and a matrix row "Codacy … Comprehensive SAST $18/mo". | Not proposed. The bullets reach the excerpt only near the cap; the matrix row never does. | Harness: the bullets are `vendor_not_in_context`, because the tool is named in the heading, not the clause. The Codacy row is `ambiguous_attribution`: the nearest brand-like word is "Comprehensive", and R14 fails closed. | Rule-intended false negative |

**Verdict.** This is mainly a market limit, not a binding defect. Of the vendors whose own pricing pages were cited:

- only CodeRabbit shows a per-seat price the grammar can bind, and acceptance took all three of its card prices;
- Qodo sells a team credit pack whose card has no period;
- Bito shows both toggle states with no billing words next to either price;
- Macroscope and CodeRabbit's add-ons are metered by minutes, files or kilobytes, which the grammar deliberately excludes.

The rival prices on Macroscope's and CodeAnt's own blogs are correctly blocked. R5 handles Macroscope's. CodeAnt's fail under R5 or the clause rule, depending on whether CodeAnt was a known vendor. One route to 3 vendors did exist under the current contract: the 2025 price table on digitalapplied.com, a neutral page cited for market data. The harness accepts its Cursor Bugbot and GitHub Copilot rows. But the extractor never saw those rows, because excerpts take figure runs in page order, and the table looks stale. If that route had worked, the brief would have passed on prices that probably no longer hold.

**Checks on your diagnosis.**

- **Usage prices (CodeRabbit per agent minute and per reviewed file, Macroscope per KB):** confirmed.
- **Qodo:** confirmed that it has no unit, with a correction. The unit is not in a neighbouring element: the card has none. "$30" is a credit-pack price for the whole team, not a seat price.
- **"R14 never binds a price across lines":** not quite. The grammar does continue a unit or qualifier across one line break, which is how CodeRabbit's "Billed annually" binds. The Qodo problem is simply that no unit exists near the price.
- **Bito as the accepted vendor:** refuted. The accepted vendor is CodeRabbit. Bito's seat prices exist but are toggle-ambiguous and split across lines, and the extractor rightly skipped them.

## 2. ai-rfp-response-assistant ($0.3300)

| Page (text) | What it shows | What the run did | Correct per contract? | Classification |
|---|---|---|---|---|
| loopio.com/pricing (approx) | No numeric price, either in the server HTML or on the rendered page. "Get Started with a Custom Quote". The FAQ says the Foundations tier "includes 10 seats". | Nothing proposed. | Yes | Market limit |
| loopio.com (approx) | No price. | — | — | Market limit |
| responsive.io/pricing (exact) | Emerging Edition "Starting from $10,000", followed by "Contact sales". The other editions are contact-sales only. An FAQ further down says the platform fee is an annual subscription. | Nothing proposed. | Yes. The price's expression has no period (`amount.ts:1014`). Harness: "Starting from $10,000" is rejected, and so is "…per year", because no such expression exists on the page. The instruction also says to skip contact-sales pricing. | Rule-intended false negative (the term is stated only in a separate FAQ) |
| responsive.io/blog/responsive-pricing-compared-… (exact) | "We operate on a custom pricing model", plus hypothetical ROI figures and ranges. | — | Yes. It states no price, and R5 would block any rival price on Responsive's own blog. | Market limit |
| responsive.io/blog/rfp-pricing (exact) | No price expression. | — | — | Market limit |
| rfp.ai/pricing (exact) | EUR plans: Starter "€49 per month" and "or €40.83/mo billed annually"; Professional €129; Enterprise €449; one-time packs at €39 and €99. | 3 prices accepted: the run's only priced vendor. | Yes | Accepted |
| rfp.ai (exact) | The same plans, in one sentence. | — | — | — |
| clawnewbie.com/compare/loopio-vs-responsive-2026 (exact) | A third-party comparison. It says Loopio's "Foundations tier starts at $20,000 USD per year", and that Responsive's "final plan pricing is not self-serve". | In the excerpt at both bounds; not proposed. | Harness: accepted as a secondary price, "Loopio Foundations: from $20,000/year", when the plan is claimed. Without the plan it is rejected, because R14 finds "Foundations" as the nearest brand-like name. Loopio's own pricing page shows no such figure today. | Extraction miss per contract, but it does not change the outcome (ceiling 2 vendors). |
| Other cited pages (market reports, HN threads, autorfp.ai, Hugging Face forum) | Only ranges ("$100-500 per month", excluded by the grammar), funding rounds and HN figures unrelated to any vendor. | — | — | — |

**Verdict.** This is a market limit. RFP.ai is the only cited vendor that publishes a complete price.

- Loopio is quote-led, with no figure on its own site.
- Responsive's only figure is a "Starting from $10,000" with no period, next to "Contact sales".

The only extra price any cited page offers is the comparison site's Loopio claim. The contract would accept it as a secondary price, but Loopio's own page does not confirm it today. Even accepted, it brings the run to 2 vendors, not 3.

**Checks on your diagnosis.**

- **"Loopio publishes no price":** confirmed.
- **"Responsive publishes no price":** partly. Responsive publishes "Starting from $10,000" without a billing period, which correctly does not bind.
- **"The extractor proposed only that vendor's prices":** confirmed. There are no competitor_price rejections, and acceptance is deterministic.
- **Another page that should have been proposed:** yes, the clawnewbie Loopio claim, with no effect on the outcome.

## 3. ai-landing-page-generator-ecommerce ($0.3117)

| Page (text) | What it shows | What the run did | Correct per contract? | Classification |
|---|---|---|---|---|
| pagefly.io/pages/pricing (approx); help.pagefly.io EN and JA (exact) | PageFly's plan prices, on PageFly's own hosts. | 8 accepted. | Yes | Accepted |
| apps.shopify.com/instant-builder (exact) | The listing for "Instant AI Page Builder", developer "Instant Commerce B.V.". Plans: Starter "$39 / month" and then "or $374.40/year and save 20%"; Pro $99 or $950.40/year; Business $249 or $2,390.40/year. No plan row names the app. | The 3 annual prices were proposed (the only prices the grammar reads on this page). All 3 were rejected as `vendor_not_in_context`. | Yes, as the contract is written. The code treats a marketplace host as not first-party: `isFirstPartyHost` (`citation.ts:263–274`) names apps.shopify.com explicitly, and "shopify" is on the listing-host list (`pipeline-sources.ts:199–205`). So §5 requires "Instant" in the price's clause (`accept.ts:1334–1338`). The plan names sit six lines above the price, so no reading of R9/R14 lets them bind. What-if: the same text on the app's own host gets all 3 accepted as first-party. | Rule-intended false negative |
| apps.shopify.com/alchemy (exact) | The listing for "Replo Landing Page Builder", developer "Replo". The slug is Replo's old name. Starter "$119 / month" with "or $1,188/year and save 17%"; Pro $599 or $5,988/year. | 2 annual prices were rejected as `vendor_not_in_context`. | Same reasoning as Instant. What-if: both accepted. | Rule-intended false negative |
| apps.shopify.com/pagefly (approx) | PageFly's listing. The grammar reads only "$990/year". | Not proposed. | If it had been proposed, the harness gives `vendor_not_in_context`, consistent with the two listings above. | — |
| unbounce.com/pricing (approx) | A Monthly/Yearly toggle ("Save 25% with yearly billing"). Each card carries both "$22 USD / month" and "$29 USD / month", then "$29 Billed annually (Save 25%)". | Nothing proposed. | Yes. Which price applies depends on the toggle, and the clause states neither billing. R9/R14 reject that, and the instruction says to skip it. In the engine's text the price reads `$ 22␠␠USD␠␠␠/ month`, which the grammar cannot read at all (item 1 under "Found in passing"). With browser-like text it parses, and is then rejected as ambiguous billing. | Market / page-format limit |
| pagefly.io/blogs/shopify/shopify-pricing-plans | HTTP 404 in the run. | — | — | — |
| Market and community pages | No landing-page-builder vendor prices. | — | — | — |

**Verdict.** This is a rule-intended false negative. The listing prices really are the vendors' own:

- each listing names the app and its developer, Instant Commerce B.V. and Replo;
- the plan table is the price Shopify bills for the app.

The extractor did the right thing: it proposed exactly the 5 prices the grammar can read. Acceptance rejected them because the contract treats a marketplace host as a neutral page, where the vendor must be named in the price's clause. The code matches §5, R5's note on neutral pages, and the documented intent in `isFirstPartyHost`.

R14's "(or its own plan name)" makes no difference here: the plan names are six lines away from the price. If a listing counted as the app's own page, the harness accepts all five prices and the brief reaches 3 vendors (PageFly, Instant, Replo). Unbounce stays out under every rule, because its toggle hides which price is which.

## Code path compared with the rulings (rejections seen in these runs)

| Rejection | Code path | Ruling | Code does what the ruling says? |
|---|---|---|---|
| competitor_price `unparseable_amount` (priceText) | `accept.ts:1469–1470` → `amount.ts:1075` `parsePriceTerms` → `1012–1014` `readPriceAt` (no period gives null). Unit words are in `amount.ts:808–856`; "minute", "reviewed" and "KB" are not period or basis words, and one unknown unit invalidates the expression (`readUnits` `941–970`). | §5, and the grammar header: "Exactly one period", "No period → not a price". | Yes |
| competitor_price `vendor_not_in_context` | `accept.ts:1334–1338`. The first-party bypass at `1335` applies only when `isFirstPartyHost` is true (`citation.ts:268–274`). | §5: a non-first-party page needs the vendor named in the price's own clause. R5: "Pages that are no known vendor's own site keep the clause binding rules". R14: the nearest brand-like name. | Yes. `isFirstPartyHost`'s docstring names Shopify App Store listings as not first-party. |
| R5 `ambiguous_attribution` (harness only) | `accept.ts:1280–1290`, called at `1476` | R5 | Yes |
| R14 nearest-name `ambiguous_attribution` (harness only) | `accept.ts:1173–1178`, `1208–1227`, `1321–1333` | R14 and its implementation note: fails closed. | Yes |
| `qualifier_dropped` for ambiguous billing (harness only) | `amount.ts:1323–1357`, via `accept.ts:1353–1368` | R9, and R14's page-scoped toggles | Yes |
| What the extractor sees | `pipeline-sources.ts:270`, `295–327`, `399–428`; budget at `pipeline-steps.ts:130` | Contract §2: "schema-only candidate extraction" from bounded excerpts | Yes. Coverage is a design limit, not a deviation. |

## Found in passing (none caused these failures)

1. **Implementation defect: the engine's page text does not follow the page's structure.**
   - **Where:** `htmlToText` (`sourceText.ts:460–478`) keeps the HTML source's own newlines and indentation, and turns every tag into a space. R14 assumes line breaks reflect page structure, and the function's own comment says it keeps block boundaries. In practice it also adds breaks the page does not have.
   - **Concrete failure, Instant listing:** the markup is `<h3 aria-label="$39/month"><span>$39</span><span>/ month</span></h3>`, with source newlines inside the spans. The engine text becomes "$39", two blank lines, "/ month". The grammar lets a unit continue across only one line break (`readGap`, `amount.ts:919–939`), so "$39/month" does not exist for acceptance.
   - **Concrete failure, Unbounce:** the markup is `<span>$</span>22<span> USD </span><span>/ month</span>`. The engine text becomes `$ 22␠␠USD␠␠␠/ month`, and an ISO suffix allows only one space (`amount.ts:283`), so there is no price.
   - **Effect on these runs:** none. On browser-like text the harness still rejects both: Instant as `vendor_not_in_context`, Unbounce as ambiguous billing.
   - **Fix direction (implementation, not contract):** collapse whitespace the way a browser does, and break lines only at block tags and `<br>`. This changes every page's `textSha256` and re-baselines the fixtures.
2. **Contract-level false positive: one billing qualifier is applied to two prices.**
   - **Where:** `readPriceAt` reads qualifiers from the whole clause (`amount.ts:1012–1036`). The grammar header documents this: "Every qualifier in the clause applies to every price in that clause" (`amount.ts:78`).
   - **Concrete failure:** on coderabbit.ai/faq, the harness accepts "CodeRabbit Essentials: $30/user/month, billed annually", which is false: $30 is the monthly-billing price. It rejects the true claim "$30 per developer per month" as `qualifier_dropped`.
   - **Status:** the code does what its documentation says, so this is a contract question.
   - **Owner decision:** fail closed when a clause holds two or more price expressions and a billing qualifier.
3. **Contract-level risk: a hedged estimate becomes a list price.**
   - **Where:** hedges are allowed and ignored (`amount.ts:44`).
   - **Concrete failure:** macroscope.com says "Macroscope costs approximately $152/month at the historical average", for a 10-person, 160-review scenario. The harness accepts it as a first-party "Macroscope: $152/month".
   - **Status:** the run did not propose it.
   - **Owner decision:** allow no hedges in competitor_price, and keep them for stats.

## Contract options that would let these briefs pass without lowering the source bar

These are owner decisions. None of them loosens binding in general. I verified the effects with the harness unless a row says otherwise.

| Option | Rule sketch | Effect on the three briefs | Risk |
|---|---|---|---|
| **A. A marketplace listing is the app's own listing** | On a known marketplace host (apps.shopify.com, …), a price is first-party for vendor V only when the page header names V as the app or as the developer. The slug does not count: `alchemy` is Replo. Every other check stays: R5 for rival prices on that listing, R9/R14 per clause, comparison cues and billing. The listing also counts as V's own site for R5. | Brief 3 passes (PageFly 8, Instant 3, Replo 2). No effect on briefs 1 and 2. | Listing prices are what Shopify bills, and can differ from the vendor's own site. Listings show other apps' names, so the per-clause R14 check must stay. Each marketplace needs a header rule, and a wrong app or developer match would credit one app with another's prices. |
| **B. Usage units as their own price kind** | Metered units (per minute, per reviewed file, per KB, per credit, per review) become a usage basis that stores its unit noun. It renders as written and is never compared with, or substituted for, a seat price. | Brief 1 gains Macroscope and reaches 2 vendors, still short. Qodo's "$.012/credit" is not a number in the grammar, and Bito's "$5 per 1K" has no unit word. Not run in the harness (needs code). | Changes `PriceTerms`, finance, writer tokens and the auditor. The writer could set usage prices against seat prices. Metered costs depend on volume. |
| **C. Unpriced competitor rows** | **C1 (as you framed it):** rows without a price that do not count toward the minimum. These make the page more honest, but on their own they unblock none of the three briefs. **C2:** require 3 competitors, each with either an accepted price or an accepted first-party statement that pricing is not public (Loopio's "Get Started with a Custom Quote", Responsive's "Contact sales"), and require at least 1–2 accepted prices. | C2 makes brief 2 pass: RFP.ai priced, Loopio and Responsive unpriced. Briefs 1 and 3 depend on how a vendor whose prices exist but don't bind (Bito, Qodo, Unbounce) is shown. Such a vendor must not be labelled "not public". | Needs a new evidence kind with its own acceptance rule. Makes the pricing section weaker, and the writer must not imply where an unpriced rival's price sits. C2 changes what the minimum counts, so it is a product decision, not a technical fix. |
| **D. Price runs first in the extraction excerpt** (pipeline, not contract) | Put runs that hold a grammar-valid price expression ahead of other figure runs on every cited page, or give competitor pages a higher byte floor. | The harness accepts the digitalapplied rows (Cursor Bugbot, GitHub Copilot), so brief 1 would reach 3 vendors and pass. | That pass would rest on a 2025 third-party table that is probably stale and drops the per-seat basis. Each run sends more input bytes. Only safe together with E. |
| **E. Freshness for secondary prices** (a tightening) | A secondary price counts toward the minimum only when its page shows a date within N months, or secondary prices never count. | Blocks D's stale pass and the unconfirmed clawnewbie Loopio figure, so briefs 1 and 2 get harder to pass. | Dates need yet another parser, and many good comparison pages carry no date. |
| **F. A billing period taken from a separate statement on the page** (a binding loosening; listed for completeness, not advised) | Bind Responsive's "Starting from $10,000" to the FAQ line that calls the platform fee an annual subscription. | Brief 2 reaches 3 vendors only together with the clawnewbie Loopio claim. | Binds a term across the page, which is the opposite of R9/R14's per-clause rule. Add-on and platform fees on the same page would bind wrongly. |

**Shortest path per brief.**

- **Brief 3:** option A.
- **Brief 2:** option C2.
- **Brief 1:** no option that keeps first-party binding gets it to three priced vendors. B reaches two. D reaches three only through stale secondary prices, and E would then block those. That leaves C2.

The text-fidelity fix (item 1 above) changes none of these outcomes. It does make listing monthly prices and Unbounce-style cards readable.

## Page text aimed at agents

No page text tried to instruct me. A scan of every fetched page found only passive affordances, none of which I followed:

- `llms.txt` links on several sites;
- a hidden "AI content index" link on macroscope.com;
- an `ai-content-license` meta tag on wiseguyreports.com;
- an in-page agent tool registry on autorfp.ai;
- an HN commenter discussing system prompts.
