# WP93 Stories - AI cost console

Branch: `claude/wp93-ai-cost-console`
Lane: Work Package (read-only admin UI over metering data; no schema, no writes)
Registry: `docs/PROJECT_STRATEGY.md`
Definition of done: the owner opens `/admin/ai` and sees what the live AI costs, who spends it, on which models and prompts, and how efficiently, as a decision tool for cost cuts, model choice and pricing. Phase 1 is read only. A PR against `main` is open with checks green, a11y-check passed, and screenshots against fixture data.

## Ground rules (from the brief, RULINGS and the code)

- **Access.** Every new Convex query calls `requireSuperAdmin` (`convex/admin/superAdmin.ts`). The pages also resolve the super admin on the server, and middleware already turns every `/admin/*` request from anyone else into a real 404 (`editorialAccessAllowed`, `middleware.ts`), so no middleware edit is needed. Pages are `noindex`, not in the sitemap (it only lists `content/**` and exported `*_SLUGS`), and nothing outside `/admin` links to them.
- **Metadata only (WP38).** `ai_usage` holds no prompt or reply text, and the console reads nothing else that does. It never reads `chat_messages.body`, artifact documents or business names. Seed failures show `idea_seed_items.errorKind` and `errorDetail` (the provider's one-line error), which the brief asks for.
- **Read only.** New queries live in `convex/admin/aiCosts.ts`. No mutation, no schema, cron, http or middleware change (Codex-owned).
- **Money.** Rows are converted with the meter's own `int64ToMicroUsd`. A call's charge is the meter's rule: `max(costMicroUsd, lateCostMicroUsd)` (what `settle`, `fail` and the late-settle adjustment add to the budgets; `convex/ops/spend.ts` uses the same rule). Totals are integer micro-USD sums; only the display rounds.

## Definitions the console uses

| Term | Definition (fields) |
|---|---|
| Charged | `max(costMicroUsd, lateCostMicroUsd ?? 0)` for `settled` and `failed` rows; `reserved` rows have no charge yet |
| Reserved (in flight) | `reservedMicroUsd` of rows still `status: "reserved"` |
| Failed spend | charged on rows that ended `failed` (`billed: "possible"` or `"actual"`) |
| Launch | a business (`projectId`) with at least one `crew-*` call. Its cost is every non-Wren call on that business, read in full through `by_projectId_and_createdAt` (not cut by the range) |
| Wren message | a settled `wren-chat` or `wren-plan-turn` call |
| Seed | a settled `crew-idea-seed` call (ownerless, batch, Opus) |
| Active founder-day | a distinct (owner, `dayKey`) pair with at least one call |
| Cache hit rate | `cacheReadTokens / (inputTokens + cacheReadTokens + cacheWriteTokens)` on Anthropic rows |
| Batch saving | standard-rate price of the batch rows' tokens minus what they were charged (re-priced with `anthropicCostMicroUsd`) |
| Over-reservation | on final rows, `reservedMicroUsd − charged` |
| Pool spend | charged on rows without `ownerBudgetBypass`, by `globalPool`: what the meter's pool counters hold |
| Owner, uncapped | rows with `ownerBudgetBypass: true` (WP68 owner access, #289). The meter keeps them on separate `owner-` counters, so the console shows them outside both pools but inside every total |

Thinking tokens are not metered apart: Anthropic bills thinking as output and `ai_usage` stores one `outputTokens` count. The console says so in the column header instead of inventing a split.

## Stories

- [x] `WP93-S1` - Bounded Convex reads (`convex/admin/aiCosts.ts`)
  - Scope: `usagePage` (one page of `ai_usage` rows in a time window, over the built-in `by_creation_time` index, projected to numbers), `ownerSummaries` (email, plan, `ai_budgets`, businesses, launches, cohort member), `launchCosts` (full per-business cost through `by_projectId_and_createdAt`), `ownerTimeline` (one owner's or the platform's calls, newest first, paginated, seed error details joined), `controlRoom` (ops settings, spend-alarm state, today's pool counters).
  - Acceptance criteria:
    - Each query refuses anyone but the bound super admin with `FORBIDDEN`.
    - Every read is bounded (page size, id-list size, per-business cap) and reports when it stopped early.
    - No query returns `chat_messages` bodies, artifact text or business names.
  - Verification: `convex/admin/aiCosts.test.ts` (access refusal, pagination, projection, bounds).

- [x] `WP93-S2` - Pure aggregation and pricing helpers (`lib/admin/ai-costs/`)
  - Scope: overview by range and pool, unit economics (median and p90 launch cost against $0.75, cost per Wren message, per seed, per active founder-day), by prompt, by model and tier, per owner, efficiency signals, what-if model swap (re-price real tokens at another Claude model's rates from `convex/ai/pricing.ts`), forecast, CSV.
  - Acceptance criteria:
    - Totals equal the integer sum of the meter's charge rule. A convex-test drives the real `reserve`/`settle`/`fail`/late `settle` mutations and checks the console's total equals the meter's own global and per-owner counters to the micro-dollar.
    - Every helper is pure and unit-tested on fixtures.
  - Verification: `tests/admin-ai/ai-costs.test.ts` (`npm run test:admin-ai`, in the `npm test` chain), `convex/admin/aiCosts.test.ts`.

- [x] `WP93-S3` - Server data layer
  - Scope: `lib/admin/ai-costs/server.ts`: resolves the super admin on the server (live), or local fixtures (development with `EDITORIAL_FIXTURE_MODE=local-demo`, the editorial demo switch the middleware already honours). Loops `usagePage` up to a row cap and marks the range cut off when it stops early.
  - Acceptance criteria: anyone the backend cannot vouch for gets `notFound()`; a production build has no fixture path.
  - Verification: the access probe is `controlRoom` (any refusal → 404); the fixture import sits behind `NODE_ENV !== "production"`, which Next inlines at build.

- [x] `WP93-S4` - Screens
  - Scope: `app/admin/ai/` — Overview (pools, alarm, calls, failures, unit economics, daily spend chart), Prompts and models (tables, share of spend, efficiency signals, what-if), Founders (one row per owner, CSV), Founder drill-down (call timeline, metadata only), Forecast (inputs → monthly cost next to Builder's Hub revenue).
  - Acceptance criteria: range switch Today / 7 days / 30 days; truncation is stated on screen; charts follow the `dataviz` skill and have a table or text equivalent; a11y-check passes; CSV export of the per-owner and per-prompt tables.

- [x] `WP93-S5` - Docs, checks, PR
  - Scope: this file, the progress log, the registry row, CLAUDE.md key path line, screenshots.
  - Verification: `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`.

## Codex needs (not built here; schema, crons and indexes are Codex-owned)

1. **Daily rollup table filled by a cron.** `usagePage` reads raw rows. The page stops at 20,000 rows per range (20 pages of 1,000) and says the range is cut off. During L1 that is weeks of headroom at the $10/day cap, but a 30-day view at full product volume needs a rollup: one row per (`dayKey`, `promptRef`, `model`, `tier`, `globalPool`, `plan`, `status`, `batch`) with call count, the six token sums and the charged, reserved and failed sums, written by a cron after each UTC day closes (and for today on read). The console's aggregation already groups on exactly these keys, so swapping the source is a data-layer change.
2. **`ai_usage` index `by_dayKey_and_promptRef`** (or `by_promptRef_and_createdAt`). Per-prompt drill-downs and the what-if over a long range now scan the whole window. Not needed until the rollup lands; the rollup may make it unnecessary.
3. **Optional `ai_usage.errorDetail`.** Only seed items keep the provider's error message (`idea_seed_items.errorDetail`). Crew and Wren failures carry only `errorClass`. If the owner wants the message on every failed call, the gateway should store the same one-line, 300-character detail on the usage row.
4. **Per-owner cap override** (needed for Phase 2 "raise one owner's cap"). `ai_budgets` has no override field and `OWNER_DAILY_CAP_MICRO_USD` is a constant. Phase 2 needs a nullable `dailyCapOverrideMicroUsd` (with `setBy`, `setAt`, `reason`) and the meter's owner check reading it.

## Phase 2 proposal — ops controls panel (approved 2026-11-20; see Phase 2 stories)

These are audited writes. They need the owner's go-ahead before any build, and each one already has (or needs) a server mutation that checks `requireSuperAdmin(ctx, now)` and writes an `audit_events` row.

| Control | Backend today | Proposed UI | Guardrails |
|---|---|---|---|
| Add or remove a beta tester | `ops/settings:setCohortMember` exists (audited, refuses anonymous users); no UI, so testers are added by hand in the Convex dashboard | On `/admin/ai/founders`, an "In cohort" column and an "Add to cohort" form that takes an account email, resolves it on the server to one verified user, and shows the match (masked email, created date) before a confirm | Email lookup runs server side only and refuses zero or several matches; confirm step names the account; removal asks for a reason that goes into the audit metadata (needs a `reason` arg on `setCohortMember`) |
| Pool budgets and kill switches | `ops/settings:updateForAdmin` exists (audited) | A "Controls" tab: free and paid pool budgets in dollars, each kill switch as a labelled switch, with the current value and today's spend beside it | Typed confirm for any switch that turns AI on, or a budget raise over 2× today's; a fresh sign-in (the editorial step-up pattern) before the write; show the resulting audit row after |
| Raise one owner's daily cap | Not possible: no override field (Codex need 4) | On the founder drill-down, "Raise today's cap" with an amount, an expiry (default end of UTC day) and a required reason | Hard ceiling (e.g. $25), expiry required, audited, visible in the founder row; never lifts the Free lifetime $1.50 |

Open questions for the owner before Phase 2: should a cap raise ever outlive one UTC day; should kill switches need step-up sign-in every time; and may the console show cohort members' emails unmasked (Phase 1 shows them, as the brief asks).

## Out Of Scope

- Phase 1: any write (Phase 2 above).
- Schema, index, cron, http or middleware changes (Codex).
- Showing prompt, reply, chat or artifact text, business names, or impersonating a founder.
- Live provider calls (the what-if is an estimate from stored tokens).
- Deploys, merges, `npx convex deploy`, any `--apply`.

## Notes

- Promote unknown product decisions to `docs/wp/RULINGS.md`.

## Phase 2 stories — ops controls (2026-11-20)

Branch: `claude/wp93-phase2-ops-controls` (from `main` at `3add0084`).
Lane: Work Package. These are audited writes to production controls, so they are high risk.

### Owner decisions (2026-11-20)

- **Per-founder cap raise: deferred.** It needs a schema field and a meter change that Codex owns. See `docs/wp/wp93-codex-cap-override.md`. Phase 2 builds the cohort and spend controls only.
- **Fresh sign-in only for risky changes.** A risky change needs a sign-in from the last 10 minutes (the editorial step-up: the session's creation time) and a typed confirm. Risky means:
  - turning any feature back on;
  - raising a pool budget from $0;
  - raising a pool budget above 2× today's spend in that pool.
  Turning things off and lowering budgets stay one click.
- **Emails are shown in full** when an account is looked up to add to the cohort. Phase 1 shows them in full too.

### Guardrails

- Every write calls `requireSuperAdmin(ctx, now)` and writes an `audit_events` row through the existing helpers in `convex/ops/settings.ts`.
- The server re-checks every rule. The browser only explains them.
- A pool budget above $100 a day is refused outright, as a typo guard.
- A form saved against settings that changed since it loaded is refused (`STALE`).
- Removing someone from the cohort needs a reason, which goes into the audit metadata.

### Stories

- [x] `WP93-P2-S1` - Server: `convex/admin/aiControls.ts`
  - `controlsState` returns the settings, the version, today's pool spend and the cohort (bounded) with emails.
  - `findAccount` looks up an account by email: zero, one or many matches; anonymous accounts are skipped.
  - `setCohort` adds or removes a cohort member. Adding needs a verified email; removing needs a reason.
  - `updateSpendControls` changes budgets and switches. It applies the risk rule, the step-up, the typed confirm, the $100 ceiling and the version check.
  - Recent changes: the latest `ops.*` audit rows, returned by `controlsState`, with the email of the account a cohort row names.
  - `convex/ops/settings.ts` exports its write and audit paths so the old and new mutations share them; `updateForAdmin` and `setCohortMember` keep their behaviour.
  - Acceptance: `FORBIDDEN` for everyone but the super admin; every refusal code is covered by a convex-test.
- [x] `WP93-P2-S2` - Pure rules: `lib/admin/ai-costs/controls.ts` (risk classification, dollar parsing), unit-tested.
- [x] `WP93-P2-S3` - UI: a "Controls" tab at `/admin/ai/controls` with three sections:
  - Spend controls: budgets in dollars beside today's spend, and the switches.
  - Beta cohort: the member list, an add-by-email lookup with a confirm, and removal with a reason.
  - Recent changes.
  Risky saves show the "Confirm it's you" step and a typed confirm. In fixture mode, writes go to an in-memory store and the step-up is simulated.
- [x] `WP93-P2-S4` - Checks:
  - typecheck, lint, the full `npm test`, build;
  - the a11y-check skill, with axe on the new screen;
  - a PR with screenshots on fixtures.

## Phase 3 stories — per-founder cap override, console side (2026-11-20)

Branch: `claude/wp93-phase3-cap-override` (from `main` at `b1be06d5`).

### Owner decision

- **Build the console side now** (2026-11-20), ahead of Codex request C2 (`docs/wp/codex-needs-beta.md`, spec `docs/wp/wp93-codex-cap-override.md`). The schema field and the meter change are not on `main`, so nothing live can be raised yet.

### How it stays off in production

- `CAP_OVERRIDE_LIVE` in `lib/admin/ai-costs/cap-override.ts` is `false`. While it is false, the live console shows a note on the founder page ("waiting on the meter change") and no form, and the live backend refuses any write with `NOT_AVAILABLE`.
- No Convex function is added: a write needs the schema field first. When C2 lands, a follow-up adds `setCapOverride` and `clearCapOverride` to `convex/admin/aiControls.ts` with the same rules, wires the live backend, and flips the flag.
- On local fixtures (`EDITORIAL_FIXTURE_MODE=local-demo`) the whole flow works against the in-memory store, so the owner can review it now.

### Rules (shared by the fixture store now and the Convex mutation later)

- An override is a raise: more than the founder's plan cap ($1 free, $5 paid), and at most **$25 a day**.
- It ends on its own: in 1 hour, in 4 hours, or at the end of the UTC day (the default). Never later than the end of the UTC day, as the spec says, unless the owner rules otherwise.
- A reason is required and goes into the audit row.
- Setting or changing one always needs a sign-in from the last 10 minutes and the typed "confirm". Ending one early is one click.
- It never lifts the Free lifetime ceiling ($1.50), the pool budgets or the kill switches. The form says so.

### Stories

- [x] `WP93-P3-S1` - Pure rules: `lib/admin/ai-costs/cap-override.ts` (ceiling, raise check, expiry choices clipped to the end of the UTC day, active check, effective cap), unit-tested.
- [x] `WP93-P3-S2` - Data: `ControlsBackend` gains `capOverrides`, `setCapOverride` and `clearCapOverride`. Fixtures apply the rules and write `ops.cap_override.set` / `ops.cap_override.cleared` rows to Recent changes; live refuses with `NOT_AVAILABLE`. Server actions validate input with zod.
- [x] `WP93-P3-S3` - UI:
  - the founder page gets a "Daily cap override" section: the active override with "End it now", or the raise form (amount, ends, reason, step-up, confirm);
  - the "Today vs daily cap" tile and the founders table show the raised cap and when it ends;
  - Recent changes on the Controls tab describe override rows.
- [x] `WP93-P3-S4` - Checks: typecheck, lint, the full `npm test`, build, the a11y-check skill with axe on the founder page, screenshots on fixtures, a PR.
