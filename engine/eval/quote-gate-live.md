# Quote-gate live N=3 — PR #71 merge gate

Updated: 2026-09-24 (UTC). Branch: `cursor/phase-7-skill-flip-d6b7` @ `418d5aa` (+ this report).
**Do not merge from this gate.** Skill flip / phases 8–9 / mcp.json untouched.

## Secret gate

| Secret | Status |
|---|---|
| `OPENAI_API_KEY` | present |
| `PERPLEXITY_API_KEY` | present |
| `DATAFORSEO_LOGIN` | present |
| `DATAFORSEO_PASSWORD` | present |

## Verdict

**Clear to merge from gate side? NO.**

Live research did not produce new records/drafts. Quote verification path was exercised once (RFP, default UA) and failed closed on Reddit 403s. UA retry did not unblock Reddit. Mid-session DataForSEO balance went negative → subsequent packs died at `keywords_demand` with task status `40200 Payment Required`.

## Pass/fail per brief

| Brief | Research | Compile | Audit | Notes |
|---|---|---|---|---|
| `rfp-assistant` (BidRelay) | **FAIL** | skipped | skipped | Attempt 1: quote verification `0/5` (all Reddit). Attempt 2 (UA): competitor shortfall (≥3 priced). Attempt 3 (UA): DataForSEO 402. |
| `code-reviewer` (DiffBeacon) | **FAIL** | skipped | skipped | UA run: `keywords_demand` provider 402. |
| `landing-page-generator-ecommerce` (ClickWeave) | **FAIL** | skipped | skipped | UA run: `keywords_demand` provider 402. |

Drafts under `engine/drafts/` and Round-3 `engine/records/*` were **not** overwritten (research never wrote a new record).

## Quote-check failures

### Attempt 1 — RFP, default UA (`weekendmvp-idea-engine/1.0 …`)

`quote verification: 0/5 … need ≥2`. All misses were Reddit:

| Quote (truncated) | URL | Host |
|---|---|---|
| "It's frustrating that all 800 questions…" | `…/r/salesengineers/comments/149fnfy/…` | Reddit |
| "At least in my industry, it's pretty common…" | `…/r/salesengineers/comments/suy7ae/…` | Reddit |
| "Often these are submitted in painful formats…" | `…/r/salesengineers/comments/suy7ae/…` | Reddit |
| "It could range from 10 to hundreds…" | `…/r/salesengineers/comments/y4zre1/…` | Reddit |
| "It comes with a deadline to submit…" | `…/r/salesengineers/comments/y4zre1/…` | Reddit |

No HN citations in that synthesis pack → no Algolia verify path exercised on this pack.

### `ENGINE_QUOTE_FETCH_UA` retry

| Item | Result |
|---|---|
| Needed? | **Yes** — first failure was Reddit fetch / 0 verified quotes |
| Value used | `WeekendMVP-IdeaEngine/1.0 (+https://weekendmvp.app; research-bot)` |
| Fixed Reddit? | **No** — `www.reddit.com` / `api.reddit.com` / `old.reddit.com` still **HTTP 403** (bot/IP block; Cursor egress is unrestricted) |
| HN fetch? | **OK** — Algolia `hn.algolia.com/api/v1/items/8863` returns 200; `createSourceTextProvider().fetchText` reads ~25k chars |

## Costs

Exact per-pack `costUsd` was **not written** (pipeline throws before `parseResearchRecord` / `--out`). Do not invent precise totals.

| Signal | Value |
|---|---|
| Prior Round-3 pack cost (reference) | ~$0.33–$0.35 / pack |
| DataForSEO account after this session | `balance: -0.08`, `total: 1` (top-up) |
| Live keyword probe | task `40200 Payment Required` (cost 0 — refused) |
| Budget bar ≤$4/pack | Not violated by completed packs (none completed); account is now empty |

Rough burn: ≥2 near-complete RFP synthesis runs (OpenAI + Perplexity + DataForSEO) before keywords went 402, plus shorter CR/landing runs that paid search then failed at keywords. **Top up DataForSEO before re-running.**

## Artifacts / logs

| Path | What |
|---|---|
| `/opt/cursor/artifacts/quote-gate-live/rfp-research.log` | Attempt 1 — Reddit quote fail |
| `/opt/cursor/artifacts/quote-gate-live/rfp-research-ua.log` | Attempt 2 — competitor shortfall |
| `/opt/cursor/artifacts/quote-gate-live/rfp-research-ua2.log` | Attempt 3 — DFS 402 |
| `/opt/cursor/artifacts/quote-gate-live/code-reviewer-research-ua.log` | DFS 402 |
| `/opt/cursor/artifacts/quote-gate-live/landing-research-ua.log` | DFS 402 |
| `/opt/cursor/artifacts/quote-gate-live/reddit-probe.log` | curl 403 matrix |
| `/opt/cursor/artifacts/quote-gate-live/hn-quote-probe.log` | live HN OK + Reddit FAIL w/ UA |
| `/opt/cursor/artifacts/quote-gate-live/failure-matrix.txt` | condensed exits |
| `artifacts/quote-gate-live-verification.md` | coordinator copy |

## Why not clear to merge

1. **N=3 live re-run did not complete** — no new records, no compile, no deep-audit pass on quote/`yearOne`/`dataModel` fields.
2. **Reddit quote verification is blocked from this Cloud Agent network** even with `ENGINE_QUOTE_FETCH_UA`; fail-closed behavior is correct, but the live Reddit half of the gate cannot pass here.
3. **DataForSEO credits exhausted** mid-gate (`402 Payment Required`) — cannot finish keywords for the remaining packs without a top-up.

## Re-run recipe (after DFS top-up; ideally from a network Reddit allows)

```bash
export ENGINE_QUOTE_FETCH_UA='WeekendMVP-IdeaEngine/1.0 (+https://weekendmvp.app; research-bot)'
npm run engine:research -- --brief engine/briefs/rfp-assistant.json --live
npm run engine:compile -- --record engine/records/ai-rfp-response-assistant.json --slug engine-draft-ai-rfp-response-assistant --force
npm run audit:idea -- --slug engine-draft-ai-rfp-response-assistant --record engine/records/ai-rfp-response-assistant.json
# repeat for code-reviewer + landing-page-generator-ecommerce
```
