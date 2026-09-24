# Quote-gate live N=3 — PR #71 merge gate

Updated: 2026-09-24 (UTC). Branch: `cursor/phase-7-skill-flip-d6b7` @ `1c98c9e`.
**Do not merge from this gate.** Skill flip / phases 8–9 / mcp.json untouched.

## Re-run 2 (post DataForSEO top-up) — this verdict

John topped up DataForSEO and said READY. Re-ran live N=3 on tip `1c98c9e`.

### Secret gate

| Secret | Status |
|---|---|
| `OPENAI_API_KEY` | present |
| `PERPLEXITY_API_KEY` | present |
| `DATAFORSEO_LOGIN` | present |
| `DATAFORSEO_PASSWORD` | present |
| `REDDIT_CLIENT_ID` / `REDDIT_CLIENT_SECRET` | **missing** (needed for OAuth quote fetch on this network; documented in `.env.example` after `817d5af`) |

### DataForSEO probe

| Check | Result |
|---|---|
| Balance before | **$49.92** (`total` top-up $51) |
| Keyword live probe | task `20000 Ok.`, cost $0.09 |
| Balance after N=3 attempts | **$49.83** (early-stop avoided keyword/synthesis spend) |

### Verdict

**Clear to merge from quote-gate side? NO.**

Blocker: **Reddit HTTP 403** on public `.json` from this Cloud Agent network. Soft-retry with `ENGINE_QUOTE_FETCH_UA` did not fix it. `REDDIT_CLIENT_ID` / `REDDIT_CLIENT_SECRET` are not in the environment, so the OAuth path added in `817d5af` was not used. All three briefs stopped at `community_signals` (need ≥2 readable cited pages) before compile/audit. ≥2 verified-quotes rule was **not** weakened.

### Pass/fail per brief (re-run 2)

| Brief | Research | Compile | Audit | Detail |
|---|---|---|---|---|
| `rfp-assistant` (BidRelay) | **FAIL** | skipped | skipped | Attempt 1 (default UA): `0/8` readable, all Reddit 403. Attempt 2 (custom UA): `0/8` readable, all Reddit 403. |
| `code-reviewer` (DiffBeacon) | **FAIL** | skipped | skipped | Custom UA: `1/8` readable (need ≥2); 7× Reddit 403. |
| `landing-page-generator-ecommerce` (ClickWeave) | **FAIL** | skipped | skipped | Custom UA: `0/8` readable, all Reddit 403. |

`engine/records/*` and `engine/drafts/*` **not** overwritten (still Round-3 / prior compile timestamps).

### Quote-check / UA retry (re-run 2)

| Item | Result |
|---|---|
| Failure mode | Early-stop at `community_signals`: `only N/M cited community pages could be read; need ≥2` — error text names Reddit 403 and asks for `REDDIT_CLIENT_ID` / `REDDIT_CLIENT_SECRET` |
| `ENGINE_QUOTE_FETCH_UA` soft-retry | **Yes** — RFP retried with `WeekendMVP-IdeaEngine/1.0 (+https://weekendmvp.app; research-bot)`; CR + landing also run with that UA |
| UA fixed Reddit? | **No** |
| HN path | Not exercised on these packs (citations were Reddit-dominated; CR had 1 non-403 page but still below the ≥2 readable bar) |
| Invented workarounds? | **No** — did not weaken ≥2 verified quotes; did not invent Reddit credentials |

### Costs (re-run 2)

No pack wrote `costUsd` (failed before keywords/synthesis). Spend ≈ three Perplexity community searches × 3 briefs (+ market/competitors for each before community), plus the $0.09 DFS keyword probe. DFS balance drop $49.92 → $49.83 matches the probe only (early-stop working as designed).

### Artifacts (re-run 2)

| Path | What |
|---|---|
| `/opt/cursor/artifacts/quote-gate-live/rerun2-rfp-research-1.log` | RFP no-UA — 0/8 Reddit 403 |
| `/opt/cursor/artifacts/quote-gate-live/rerun2-rfp-research-ua.log` | RFP UA retry — 0/8 |
| `/opt/cursor/artifacts/quote-gate-live/rerun2-code-reviewer-research.log` | CR — 1/8 |
| `/opt/cursor/artifacts/quote-gate-live/rerun2-landing-research.log` | Landing — 0/8 |
| `/opt/cursor/artifacts/quote-gate-live/rerun2-matrix.txt` | condensed exits |
| `/opt/cursor/artifacts/quote-gate-live/failure-matrix.txt` | copy of matrix |
| `artifacts/quote-gate-live-verification.md` | coordinator summary |

### Unblock for YES

1. Set Cloud Agent secrets `REDDIT_CLIENT_ID` + `REDDIT_CLIENT_SECRET` (free script app at reddit.com/prefs/apps), **or** re-run from a network that can read Reddit public `.json`.
2. Re-run the three `engine:research --live` → compile `engine-draft-*` → `audit:idea` with ≥2 live-verified quotes each.
3. Then update this file with YES only if all three clear research + compile + audit.

---

## Prior run (re-run 1, pre DFS top-up) — historical

**Clear to merge? NO** (then). Secrets present; Reddit 403 (UA no help); then DataForSEO balance −$0.08 → keywords 402. See git history of this file at `26f4f48` for full tables. Follow-up code since then: OAuth Reddit fetch + early-stop before paid steps (`817d5af`), figure grounding / yearOne fixes (`70f914e`, `1c98c9e`).
