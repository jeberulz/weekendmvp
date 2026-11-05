# WP69-S4 — Measurement spike results

Run: 2026-11-05, live, owner-approved cap $25. **Spend: $5.72.** The guard stopped
nothing. Scripts: `scripts/spikes/wp69-*` (not committed yet: the env-documentation
test needs `ANTHROPIC_API_KEY` in `.env.example`, Codex ask 8). The raw output (call
log, ledger, responses, contact sheet) is kept outside the repo, in the session
scratchpad.

Six businesses: hydration app (HydroTrail), wedding staffing marketplace, Python
course, field-service job costing (B2B), KDP niche finder, and an own idea (garage
coffee subscription). Two configs:
- **A:** every draft on Sonnet 5.5 at effort low, with bulk work on Haiku.
- **B:** the same, but with the social pack and email on Haiku.

## Headline

| | Estimate (`03` §3) | Measured |
|---|---|---|
| Typical free launch, config A | $0.54 | **$0.57** (range $0.35–$0.80) |
| Typical free launch, config B | — | $0.51 (range $0.28–$0.65) |
| Opus judge, mean of 4 criteria, all artifacts | — | A 4.28, B 4.21 |
| Judge, social pack + email only | — | A 4.02, B 3.70 |
| Seed precompute per idea (Opus, batch) | $0.17 | **$0.04** |

The typical launch figure adds the unmeasured chat and change-round estimates
($0.15) to the measured calls and images.

**Decision rule (`03` §10):**
- **Median launch under $0.75:** yes.
- **Haiku for the social pack and email:** fails the "within 0.3" quality test (a
  gap of 0.32), so **config A stays**: social pack and email stay on Sonnet.
- **Image provider:** only OpenAI was measured, so there was no choice to make.

## Rows more than 30% off the estimate

| Row | Estimate | Measured (A) | Cause | Effect |
|---|---|---|---|---|
| Social pack (7 posts) | $0.003 (Haiku) | $0.043 (Sonnet) | Config A keeps it on Sonnet, per the decision rule | Included in the $0.57; extra social pack stays at 5 credits ($0.0086 per credit) |
| Launch plan | $0.018 | $0.035 | About 1.8k output tokens, not 1.5k, plus a cache write on every call | Free-launch item only; no price affected |
| Quality checks | $0.006 | $0.008 (A) / $0.007 (B) | Longer artifacts | Negligible |
| Logo marks ×3 (OpenAI gpt-image-2 medium) | $0.09 | $0.159 | $0.053 per 1024² image, not $0.03 | Brand kit regenerate breaks the credit rule (below) |
| Hero ×1 (OpenAI) | $0.03 | $0.041 | Cost table price | Offer image breaks the credit rule (below) |
| Seeds per idea | $0.17 | $0.04 | About 5k input and 3k output tokens, against 25k and 12k assumed; the cached system block is reused across ideas | 231 ideas cost about $9 per seed version, not $40–$51 |

Within 30%: blueprint, brand kit text, landing spec, email (Sonnet), SEO pack, build
pack, ads drafts, and the policy check with memory summary.

## Credit rule (provider cost ≤ $0.013 per credit)

| Action | Credits | Measured | Per credit | Passes |
|---|---|---|---|---|
| Brand kit regenerate (OpenAI logos) | 10 | $0.186 | $0.0186 | **no** |
| Brand kit regenerate (Recraft, list price $0.035 × 3) | 10 | ≈ $0.132 | ≈ $0.0132 | **no, just over** |
| Offer / post image, standard (OpenAI) | 2 | $0.041 | $0.0205 | **no** |
| Offer / post image, standard (Recraft list price) | 2 | $0.035 | $0.0175 | **no** |
| Landing regenerate | 5 | $0.034 | $0.0067 | yes |
| Email regenerate (Sonnet) | 3 | $0.031 | $0.0104 | yes |
| Extra social pack (Sonnet) | 5 | $0.043 | $0.0086 | yes |
| Engineering pack regenerate | 8 | $0.077 | $0.0096 | yes |
| Short video ≤ 8 s | 30 | not measured | — | — |

## Not measured

- **Recraft:** the account has no credits, and the spike asked Recraft for a
  1536×1024 hero, a size V4.1 rejects (a spike bug; the hero has to use a size
  Recraft supports). A rerun of the image step needs about $1 on Recraft and $0.25 on
  OpenAI after a top-up; OpenAI also ran out after 3 businesses.
- **Video:** there is no provider. The OpenAI Videos API shut down on 2026-09-24, and D11
  names Veo, but there is no Google key.
- **Chat and change rounds:** these remain estimates ($0.04 and $0.11).

## Findings for the gateway and contracts

1. **Cache writes are 36% of Sonnet launch spend.** About 5.4k tokens are written on
   every drafting call and only about 3.1k are read back: first-run hit rates were
   40% (A) and 43% (B), and an immediate re-run reached 74%. A different output
   schema per artifact breaks reuse of the business block within a launch. WP71
   lever: put the cache breakpoint only on the system block shared across
   businesses, or check whether a stable business block before the schema-dependent
   part is read back. Worth about $0.02 a launch.
2. **Structured outputs:** 218 of 231 first attempts parsed (94%), and 12 of 13
   re-asks passed (the spike summary's count, from the final run). Re-parsing every
   stored first-attempt response against the current C-ART (`ef9575f8`) leaves only
   two failures; the others failed checks that were loosened or fixed later in the
   PR. The two that still fail are Haiku social packs cut off at
   `max_tokens` 4096: Haiku wrote 3.8k tokens median against Sonnet's 2.1k. The
   fast tier's 4096 limit is too low for any long artifact, which is moot while
   social stays on Sonnet.
3. **The grammar limit is real:** the landing spec and social pack schemas were
   rejected until the C-ART fix (`beec04fb`), which cost $1.84 of this run.
4. **Latency (median, Sonnet):**
   - build pack 39 s
   - SEO pack 23 s
   - social 16 s
   - launch plan and email about 14 s
   - landing and brand about 10 s
   - images 25–28 s each

   A parallel launch workflow (WP75 S2) finishes in about the time of the build pack.

## Proposals for the owner (before C-JOBS freezes)

1. **Offer / post image, standard: 2 → 3 credits** with Recraft as the default
   provider ($0.0117 per credit), or 4 credits if OpenAI is the default ($0.0103).
2. **Brand kit regenerate: 10 → 11 credits** with Recraft logos ($0.0120 per credit),
   or 15 credits with OpenAI logos ($0.0124).
3. **Default image provider: Recraft**, which has the lower list price and vector
   output for logos. Measure it first: top up Recraft, then rerun the image step
   only (about $1.25).
4. **Seed precompute budget:** the WP71 S5 approval ask drops from about $50 to
   about $15, covering 231 ideas plus a judge pass.
5. **Video:** stays unpriced until a provider key exists. The choice between 35
   credits and 6-second clips moves to WP82.
