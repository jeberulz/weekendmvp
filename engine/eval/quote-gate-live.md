# Quote-gate live N=3 — PR #71 merge gate

Updated: 2026-09-24 (UTC). Branch: `cursor/phase-7-skill-flip-d6b7` @ `a24495f` + re-run 3 note.
**Do not merge from this gate.** Skill flip / phases 8–9 / mcp.json untouched.

## Re-run 3 (Mac private worker / home egress) — this verdict

Ran on a home Mac worker against tip `a24495f`, expecting home IP to allow Reddit public `.json` where Cloud Agent could not.

### Secret gate

| Secret | Status |
|---|---|
| `OPENAI_API_KEY` | **missing** in shell; `.env.local` has empty line |
| `PERPLEXITY_API_KEY` | **missing** (shell + `.env.local`) |
| `DATAFORSEO_LOGIN` | **missing** (shell + `.env.local`) |
| `DATAFORSEO_PASSWORD` | **missing** (shell + `.env.local`) |
| `REDDIT_CLIENT_ID` / `REDDIT_CLIENT_SECRET` | **missing** (acceptable *if* public `.json` worked) |

Cloud Agent research secrets were **not** injected into this private-worker shell. Only unrelated keys (`IDEABROWSER_API_KEY`, `NEON_API_KEY`) were present.

### Probe (this host)

| Check | Result |
|---|---|
| Reddit `www` thread `.json` / `.json` | **HTTP 403** (~190KB theme-beta HTML block page) |
| Reddit listing `hot.json` | **HTTP 403** |
| `old.reddit.com` `.json` | **HTTP 302** → login interstitial (no JSON body) |
| Soft-retry `ENGINE_QUOTE_FETCH_UA=WeekendMVP-IdeaEngine/1.0 (+https://weekendmvp.app; research-bot)` | **HTTP 403** unchanged |
| HN Algolia item | **HTTP 200** OK |

### Verdict

**Clear to merge from quote-gate side? NO.**

Blocker: **Reddit public `.json` is still HTTP 403 from this home egress IP.** The home-network alternate does **not** unblock Reddit. Same failure class as Cloud Agent re-runs 1–2. Live N=3 research/compile/audit was **not** started (early stop per gate instructions — do not burn N=3 when Reddit probe fails). ≥2 verified-quotes rule was **not** weakened. Phases 8–9 / mcp.json / claim-preview secret / UI / skill rewrite untouched.

Secondary: even if Reddit had returned 200, this worker lacked `OPENAI_API_KEY` / `PERPLEXITY_API_KEY` / `DATAFORSEO_*` so a full live pack could not have completed without secret injection.

### Pass/fail per brief (re-run 3)

| Brief | Research | Compile | Audit | Detail |
|---|---|---|---|---|
| `rfp-assistant` (BidRelay) | **SKIPPED** | skipped | skipped | Reddit probe 403 → early stop |
| `code-reviewer` (DiffBeacon) | **SKIPPED** | skipped | skipped | Reddit probe 403 → early stop |
| `landing-page-generator-ecommerce` (ClickWeave) | **SKIPPED** | skipped | skipped | Reddit probe 403 → early stop |

### Artifacts (re-run 3)

| Path | What |
|---|---|
| agent-store `quote-gate-live-mac-rerun3/probe.log` | Reddit/HN probe statuses |
| agent-store `quote-gate-live-mac-rerun3/probe-detail.log` | multi-UA / old.reddit variants |
| agent-store `quote-gate-live-mac-rerun3/secret-gate.txt` | boolean secret presence |
| agent-store `quote-gate-live-mac-rerun3/failure-matrix.txt` | condensed NO + blockers |
| agent-store `quote-gate-live-mac-rerun3/verification-summary.txt` | same summary for coordinator |
| `artifacts/quote-gate-live-mac-rerun3/*` | repo-local copy of the same |

### Unblock for YES

1. Set `REDDIT_CLIENT_ID` + `REDDIT_CLIENT_SECRET` (script app) on the runner that has the other live secrets, **or** find a network/IP that actually receives Reddit public JSON 200 (this home IP is not it).
2. Ensure `OPENAI_API_KEY`, `PERPLEXITY_API_KEY`, `DATAFORSEO_LOGIN`, `DATAFORSEO_PASSWORD` are available on that same runner.
3. Re-run the three `engine:research --live` → compile into `engine/drafts/` → deep `audit:idea` with ≥2 live-verified quotes each.
4. Update this file with YES only if all three clear research + compile + audit.

---

## Re-run 2 (post DataForSEO top-up, Cloud Agent) — historical

The operator topped up DataForSEO and said READY. Re-ran live N=3 on tip `1c98c9e`.

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
