# Launch Workspace — AI cost model

**Status:** Planning estimates, 2026-11-05. Every number below is an estimate until
the Phase 0 spike (§10) measures it. Replace estimates with measured values in this
file when the spike lands, and keep the date on each.

The short version:

- **A free weekend launch on a library idea should cost about $0.55 in AI calls**
  (range $0.40–$0.70), under the $0.75 target. The heaviest single item is the build
  pack, then the landing page and brand kit. Images are about a fifth of the total.
- **Running every drafting call on Opus instead of Sonnet would cost about $0.90**,
  over target. The model router is the most important cost control we have, after
  precomputing per-idea material.
- **The worst-case free account reaches the $1.50 ceiling** only by using every free
  change round and the full chat cap. The ceiling is a guard, not the normal case.
- **Every credit action keeps 67–88% gross margin on Growth** at the recommended
  prices. Video is the thinnest and is allowed only on the cheapest provider tier.

## 1. Prices used (dated)

| Item | Price | Source |
|---|---|---|
| Claude Haiku 5.5 | $0.10 in / $0.50 out per MTok (prompts ≤ 100K tokens); cache read 0.1×, 5-min cache write 1.25×; tokenizer counts about 30% more tokens than older models | Claude API reference, 2026-11 |
| Claude Sonnet 5.5 | $2 in / $10 out per MTok; cache read $0.20; 5-min cache write $2.50 | Claude API reference, 2026-11 |
| Claude Opus 5.5 | $4 in / $20 out per MTok; cache read $0.20 | Claude API reference, 2026-11 |
| Message Batches | 50% off every token, cache reads and writes included | Claude API reference, 2026-11 |
| Images | $0.006–$0.06 per image across current models and quality settings. Planning value: **$0.03** for a logo mark or hero, $0.02 for a standard offer image, $0.05 for high quality | Web pricing surveys, Oct 2026 (sources at the end) |
| Video | $0.05–$0.40 per second across current API models. Planning value: **$0.05/s** (cheapest tier) | Web pricing surveys, Aug–Oct 2026 |
| OpenAI `gpt-5.6-sol` (engine only) | $5 / $30 per MTok | `lib/engine/providers/pricing.ts` |

Thinking tokens bill as output. Sonnet 5.5 defaults to adaptive thinking at `high`
effort, so every estimate below assumes **effort set explicitly** (`low`, thinking off
between tools, for drafting) as the architecture requires (`02` §5.2). An unset effort
could double the output column.

## 2. How a request is shaped

Every crew request has three parts (`02` §5.4):

| Block | Size (tokens) | Cached? |
|---|---|---|
| System (crew charter, rules) | ~2,000 | Yes, shared by every business |
| Business context (blueprint, brand summary, choices, Wren memory) | ~4,000 | Yes, written once per business per burst |
| Task (instructions and inputs) | 1,000–6,000 | No |

The first drafting call for a business writes the cache; the next calls within five
minutes read it at a tenth of the price (Sonnet) or a twentieth (Opus).

## 3. One free launch, library idea

Assumes per-idea seeds exist (§4), Sonnet for drafts, Haiku for bulk, effort `low`.

| Step | Model | Task input | Output | Est. cost |
|---|---|---|---|---|
| Blueprint personalise (seeds + wizard answers) | Sonnet | 5k | 1.5k | $0.030 |
| Brand kit text (names, voice, palette, type, taglines) | Sonnet | 2k (+4k cache write) | 2k | $0.034 |
| Landing spec (LandingSpec JSON, waitlist) | Sonnet | 3k | 3k | $0.037 |
| Email sequence (4 emails) | Sonnet | 1.5k | 2.5k | $0.029 |
| SEO pack (titles, meta) and first article (~1,000 words) | Sonnet | 1.5k | 3k | $0.034 |
| Launch plan | Sonnet | 1k | 1.5k | $0.018 |
| Build pack (4 phases, 8 prompts, from the idea's existing prompts) | Sonnet | 6k | 6k | $0.073 |
| **Drafting subtotal** | | | | **$0.26** |
| Social pack (7 posts, one call) | Haiku | 1k | 2k | $0.003 |
| Ads drafts | Haiku | 1k | 1k | $0.002 |
| Quality checks (one per artifact, 9) | Haiku | 4k each | 0.2k each | $0.006 |
| Publish policy check, memory summaries | Haiku | | | $0.003 |
| **Bulk subtotal** | | | | **$0.014** |
| Logo marks ×3 | Recraft | | | $0.09 |
| Landing hero image ×1 | Image model | | | $0.03 |
| **Images subtotal** | | | | **$0.12** |
| Wren chat, typical (25 turns: 90% Haiku ≈ $0.0006, 10% Sonnet ≈ $0.010) | Mixed | | | $0.04 |
| Free change rounds, typical (3 revisions at ≈ $0.035) | Sonnet | | | $0.11 |
| **Typical free launch** | | | | **≈ $0.54** |

Roster, contrast checks, the build-pack compile step and launch-plan dates are code,
not model calls, and cost nothing.

**Variants:**

| Variant | Est. cost | Note |
|---|---|---|
| Own idea (no seeds, light blueprint, D15) | ≈ $0.62 | Blueprint from the founder's text; brand and landing calls run about 20% longer. |
| Every drafting call on Opus 5.5 | ≈ $0.90 | Over target. Opus is for batch precompute and evals only. |
| Effort left at the Sonnet default | ≈ $0.75–$1.00 | Thinking output on every draft. The registry forbids an unset effort. |
| No prompt caching | ≈ $0.58 | Output dominates, so caching saves only ~$0.04 here; it matters more for chat. |

**Worst case for one free account (everything used, no abuse controls bypassed):**
drafting $0.26 + bulk $0.01 + images $0.12 + chat at the cap (120 turns over three
days, Sonnet escalations capped at 5 a day) $0.21 + every free change round on every
artifact (9 × 2, logo marks regenerated on each brand round) $0.90 = **≈ $1.50**. The
50 starter credits add at most $0.65, and are excluded from the ceiling by D3.

## 4. Per-idea precompute

| Item | Estimate |
|---|---|
| Input per idea (MDX body, research, existing prompts) | ~25k tokens |
| Output per idea (blueprint, brand seeds, landing seeds, email and social angles, build-pack seeds) | ~12k tokens |
| Opus 5.5 on the Batch API | $0.05 in + $0.12 out ≈ **$0.17 per idea** |
| Optional judge pass | ≈ $0.05 per idea |
| All 231 library ideas, one seed version | **≈ $40–$51** |

A seed version is regenerated when the seed prompt changes or an idea's content
changes. Expect two or three versions during the program: about $150 in total.

## 5. Chat

| Plan | Daily cap | Sonnet escalations / day | Typical month | Worst month |
|---|---|---|---|---|
| Free | 40 | 5 | $0.04 per launch | $0.21 per launch weekend |
| Builder's Hub | 300 | 30 | ≈ $0.50 | ≈ $14 |
| Growth | 600 | 30 | ≈ $1 | ≈ $20 |

Chat input stays flat because each turn sends the cached system and business blocks,
a rolling memory summary and only the last 8 turns, never the whole thread. Wren
escalates to Sonnet only for turns that change the plan or call a tool; everything else
runs on Haiku.

## 6. Paid plans: monthly provider cost per member

| | Builder's Hub ($29) | Growth ($79) |
|---|---|---|
| Credits, all used (≤ $0.013 a credit) | ≤ $6.50 | ≤ $26 |
| Credits, typical (40% used) | ≈ $2.60 | ≈ $10 |
| First launch per business (free drafts) | ≈ $0.55 once | ≈ $1.65 once (3 businesses) |
| Chat, typical / worst | $0.50 / $14 | $1 / $20 |
| **Typical month** | **≈ $3–$4 (≈ 88% gross margin before fees)** | **≈ $12 (≈ 85%)** |
| **Worst month** | ≈ $21 | ≈ $48 |

Margins are before Stripe and Managed Payments fees. Unused credits expire (no
rollover), which is margin we do not plan around.

**Founding Lifetime (D1b):** 50 seats at the Builder's Hub worst case is about $1,050 a
month, or about $3k–$9k a year at realistic use, as strategy §5 states.

## 7. Credit action margins

Rule: provider cost ≤ $0.013 per credit. One credit earns $0.058 on Builder's Hub and
$0.040 on Growth.

| Action | Est. provider cost | Credits | Cost per credit | Revenue (BH / Growth) | Gross margin on Growth |
|---|---|---|---|---|---|
| Offer image, standard | $0.02 (must stay ≤ $0.026) | 2 | $0.010 | $0.12 / $0.08 | 75% |
| Offer image, high quality | $0.05 | 5 | $0.010 | $0.29 / $0.20 | 75% |
| Story / post image | $0.02 | 2 | $0.010 | $0.12 / $0.08 | 75% |
| Short video ≤ 8 s (cheapest tier) | $0.40 | 30 | $0.013 | $1.74 / $1.20 | **67%** |
| Launch film ≤ 30 s (cheapest tier, paid only) | $1.50 | 150 | $0.010 | $8.70 / $6.00 | 75% |
| Brand kit regenerate | $0.12 | 10 | $0.012 | $0.58 / $0.40 | 70% |
| Landing regenerate | $0.04 | 5 | $0.008 | $0.29 / $0.20 | 80% |
| Email sequence regenerate | $0.03 | 3 | $0.010 | $0.17 / $0.12 | 75% |
| Extra social pack (7) | $0.003–$0.03 | 5 | ≤ $0.006 | $0.29 / $0.20 | ≥ 85% |
| Hire a skipped specialist | $0.05–$0.10 | 20 | ≤ $0.005 | $1.16 / $0.80 | ≥ 88% |
| Engineering pack regenerate | $0.075 | 8 | $0.009 | $0.46 / $0.32 | 77% |

Video sits below the 70% margin target on Growth. Two ways to fix it if the spike
confirms the cost: price short video at 35 credits, or default clips to 6 s.

## 8. Cost levers, ranked by savings

| # | Lever | Where | Saving (planning) |
|---|---|---|---|
| 1 | **Per-idea precompute** with Batch: launches personalise seeds instead of generating from nothing | `02` §5.6 | 30–40% of drafting output per launch |
| 2 | **Model router**: Haiku for chat and bulk, Sonnet for drafts, Opus only in batch and evals | `02` §5.2 | ≈ 40% against Opus-everywhere |
| 3 | **Explicit effort and thinking off for drafts** | Prompt registry | Avoids up to 2× output |
| 4 | **One structured call per artifact** (7 posts in one call, 4 emails in one call) | Prompt specs | Fewer repeated prefixes and retries |
| 5 | **Prompt caching** of the system and business blocks | `02` §5.4 | ~$0.04 per launch; large for chat |
| 6 | **Bounded chat**: memory summary + last 8 turns, Haiku first, capped escalations | `02` §5, §13 | Keeps chat flat as threads grow |
| 7 | **Caps**: two free change rounds, daily chat caps, workpool concurrency, job-start limits | `02` §13 | Bounds the worst case |
| 8 | **Code instead of models** for roster, contrast, dates, build-pack compile, policy patterns | `02` §6 | Removes whole calls |
| 9 | **Section-level regenerate** for the landing page and brand kit | Revisions | 50–70% of a full regenerate |
| 10 | **Output budgets** sized per artifact (`maxTokens` per prompt spec) | Prompt specs | Stops long rambles |
| 11 | **Batch for evals** | `evals/crew` | 50% of eval spend |

## 9. Metering, budgets and alarms

**What is recorded:** one `ai_usage` row per provider call (`02` §4.2): prompt id and
version, model, tier, every token class, images, video seconds, cost in micro-USD,
whether the cost is estimated, latency and stop reason. Rows are never deleted.

**What is enforced, before the call:**

1. `ops_settings.killSwitches.ai` (and per-feature switches).
2. Global daily budget (default **$50/day** during the beta, raised by the owner).
   A sharded counter avoids a hot document. At 100%, free generation pauses with a
   calm Wren card; paid credit actions continue up to a separate paid budget.
3. Per-owner lifetime free ceiling ($1.50, D3).
4. Per-owner daily cap (Free $1.00/day, so a whole launch fits in one evening; paid
   $5/day by default; a super admin can raise one owner).

**What alerts:** 80% and 100% of the global daily budget; any owner past $3 in a day;
median launch cost over $0.75 across the last 50 launches; cache hit rate under 50%
on any prompt with more than 100 calls a day; refusal or schema-failure rate over 5%.

**Where it shows:** `/admin/ops` (super admin): spend today against budget, by model,
by prompt version, by plan; top spenders; median and p90 cost per launch; failed jobs
and refunds; queue depth; kill switches.

## 10. Phase 0 measurement spike (part of WP69)

**Goal:** replace §3 and §7 estimates with measured numbers before any prices or
budgets are frozen.

**Spend cap: $25, live keys, owner approval required before it runs.**

1. Pick 5 library ideas across categories (including a course idea and a
   marketplace) and 1 own idea.
2. Generate seeds for the 5 with Opus on the Batch API. Record cost per idea.
3. Run every step of §3 for each, twice: once at Sonnet `low`, once with the
   social pack and email sequence on Haiku. Record tokens by class, cost and latency.
4. Re-run the second business's calls within five minutes to measure cache hits.
5. Generate 3 logo marks and 1 hero per business on two image providers. Record cost
   and judge quality side by side.
6. Render one 8 s clip on two video tiers. Record cost, time to render and failure
   rate.
7. Judge every artifact with the Opus rubric (`02` §5.7).

**Decision rule:** if the median launch is over $0.75, apply the levers in §8 in
order and re-measure. If a cheaper model or tier scores within 0.3 of the better one
on the rubric, use the cheaper one. Record the results and the choices in this file
and in `docs/wp/wp69-progress.md`.

## Sources (non-Claude prices)

- [8 Best AI Video Generation APIs in 2026](https://apiframe.ai/blog/best-ai-video-generation-apis)
- [AI Video Model Pricing (Aug 2026)](https://invideo.io/blog/ai-video-model-pricing/)
- [AI Video API Pricing 2026 — CometAPI](https://www.cometapi.com/ai-video-api-pricing/)
- [AI Video Pricing 2026 — fluxnote](https://fluxnote.io/guides/ai-video-model-pricing-comparison-2026)
- [Image Generation Models Compared — OpenRouter](https://openrouter.ai/blog/insights/image-generation-models-compared/)
- [Image and Video Generation API Pricing, Oct 2026 — Developers Digest](https://www.developersdigest.tech/blog/image-video-generation-api-pricing-2026)
- [OpenAI image generation API pricing — Developers Digest](https://www.developersdigest.tech/models/image-generation/openai)
- [Cheapest AI Image Generation APIs 2026 — Atlas Cloud](https://www.atlascloud.ai/blog/tips/cheapest-ai-image-generation-api-2026)
- [OpenAI image generation API pricing — Modellix](https://www.modellix.ai/blog/openai-image-generation-api-pricing)
