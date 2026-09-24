# PR #71 quote-gate live verification (re-run 3 — Mac private worker)

**Branch:** `cursor/phase-7-skill-flip-d6b7` @ `a24495f`  
**Gate doc:** `engine/eval/quote-gate-live.md`  
**Clear to merge (quote gate)? NO**

## One-liner

Home-egress Mac private worker still gets **Reddit public `.json` HTTP 403** (egress `80.252.122.75`). HN Algolia 200. Live N=3 skipped (early stop). Research secrets also absent on this worker. Same blocker class as Cloud Agent re-runs; home path does not unblock Reddit.

## Probe

| Target | Status |
|---|---|
| Reddit www `.json` | 403 |
| Reddit + `ENGINE_QUOTE_FETCH_UA` | 403 |
| old.reddit `.json` | 302 → login |
| HN Algolia | 200 |

## Per brief

| Brief | Research | Compile | Audit |
|---|---|---|---|
| rfp-assistant (BidRelay) | SKIPPED | skip | skip |
| code-reviewer (DiffBeacon) | SKIPPED | skip | skip |
| landing-page-generator-ecommerce (ClickWeave) | SKIPPED | skip | skip |

## Remaining blocker

**Reddit 403 from home IP `80.252.122.75`** without working public JSON. Set `REDDIT_CLIENT_ID` / `REDDIT_CLIENT_SECRET` on a runner that also has OpenAI/Perplexity/DataForSEO, then re-run all three packs through research + compile + deep audit with ≥2 verified quotes. Do not merge on quote-gate grounds until then.

## Logs

Agent-store + `artifacts/quote-gate-live-mac-rerun3/`
