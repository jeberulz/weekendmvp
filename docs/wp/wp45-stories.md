# WP45 Stories - Operator idea engine completion

Branch: `codex/wp45-idea-engine-completion`
Lane: Work Package
Registry: `docs/PROJECT_STRATEGY.md`
Definition of done: S1 through S6 from `docs/plans/idea-engine/2026-09-27-completion-plan.md` are implemented on `85d1db483a38802e483c1187ceafa81c66ab9343`. New engine output stays in private drafts until hash-bound human review promotes it. The final gate reports accept, needs_research, and reject honestly. Live spend, deploy, seed, push, and merge are not part of this package.

## Stories

- [x] `WP45-S1` - Close executable content and premature publication
  - Scope: `lib/engine/compile.ts`, `lib/engine/compile-write.ts`, `scripts/engine-compile.mjs`, `scripts/audit-idea-mdx.mjs`, narrow promotion and safety modules, engine tests
  - Acceptance criteria:
    - Every compilation writes under `engine/drafts/`, independent of slug
    - Existing public idea pages stay readable
    - Compilation does not write public MDX, manifest rows, tags, or dates
    - Generated Markdown is serialized as text and parsed with the installed MDX parser
    - The parser rejects expression, JSX, and ESM nodes, and permits literal fenced code
    - Destinations are HTTP or HTTPS only, with no credentials in the URL, and field sizes are bounded
    - Promotion refuses a record that is unverified or fixture-mode
    - Until the v2 record exists, old records have no interim promotion bypass
    - A bad record leaves public files byte-for-byte unchanged
  - Verification:
    - Failing regression tests for F1 and F2 land before the fix
    - `npm run test:engine`

- [x] `WP45-S2` - Replayable evidence and source-safe providers
  - Scope: `lib/engine/research-record.ts`, `lib/engine/providers/sourceText.ts`, provider types, pipeline evidence helpers, engine tests
  - Acceptance criteria:
    - v2 records carry evidence identity, bounded excerpts, content hashes, and explicit mode and version metadata
    - v1 records remain readable and cannot be promoted as new verified research
    - A quote binds to exact normalised quote text and a canonical source or post identity
    - Equivalent URLs canonicalise. A fabricated suffix or prefix does not match by substring
    - Independent evidence units are required. Two excerpts from one discussion count as one unit
    - Statistics and prices are checked against the fetched page excerpt as typed claims
    - Unsupported or ambiguous claims stay unresolved. A model judgement does not verify a search summary
    - Freshness windows are defined by evidence type and rechecked before promotion
    - Authenticated cross-origin redirects and HTTPS downgrades are refused
    - Streamed bytes, total time, redirects, and concurrency are bounded
    - Existing DNS and redirect SSRF tests still pass
  - Verification:
    - Failing regression tests for F3, F6, F7, and F8 land before the fix
    - `npm run test:engine`

- [ ] `WP45-S3` - Provider resilience and source availability
  - Scope: `lib/engine/providers.ts`, provider adapters, `lib/engine/cost.ts`, `lib/engine/pipeline-steps.ts`, run accounting, CLI diagnostics, engine tests
  - Acceptance criteria:
    - Preflight reports missing configuration without printing secret values
    - Configured and authorised stay distinct. Live smoke is the only authorised check
    - A worst-case cost reservation survives an unknown outcome
    - Missing usage is not recorded as zero
    - A redacted failure and cost report is persisted before exit
    - Retries and backoff are bounded. Rejected credentials and payment-required responses are not retried blindly
    - A bounded non-Reddit discovery path uses the existing search adapter and HN or page readers
    - A failed Reddit read does not loop search or lower the evidence bar
    - Source capability states are `unconfigured`, `approval_required`, `ready`, `rate_limited`, and `unavailable`
    - The $4 estimate-based run cap remains. A batch cap is enforced. Unknown-cost reservations are reported separately
    - CI makes no live provider calls
  - Verification:
    - Failing regression tests for F9 land before the fix
    - `npm run test:engine`

- [ ] `WP45-S4` - Opportunity decision and useful content
  - Scope: brief and record assessment fields, a small assessment module, pipeline prompts, compiler editorial sections, engine tests
  - Acceptance criteria:
    - Outcomes are `accept`, `needs_research`, and `reject`, with reason codes
    - `accept` means an editorially reviewed hypothesis, not validated product-market fit
    - Network failure is not recorded as no demand
    - Rejection and research-more reports are saved. A run is not forced into an article
    - A cheap exact or normalised buyer-job catalogue screen runs before paid research
    - Nearest existing ideas and the proposed difference are persisted
    - Disconfirmation research stays inside the existing bounded budget
    - External text stays in delimited untrusted data blocks
    - Generic publishable tier and economics fallbacks are removed
    - Economics come from explicit inputs, with scenario labels and a downside
    - Highlights derive from approved claims
    - The eight public headings and existing SEO and tag contracts stay
    - Word count stays a warning. The 2,200-word hard fail is not lowered to make current drafts pass
  - Verification:
    - Failing regression tests for F4 and F10 land before the fix
    - `npm run test:engine`

- [ ] `WP45-S5` - Evaluation that measures the engine
  - Scope: `scripts/engine-eval.mjs`, `engine/eval/`, frozen provider fixtures, engine tests, package scripts
  - Acceptance criteria:
    - The current gold-page check remains, named as a legacy regression
    - New evaluation replays providers, record, decision, compile, and deep audit in a temporary directory with network disabled
    - The labelled set has 12 cases. Four are credible, four are weak or reject, and four are evidence or access ambiguous
    - A separate adversarial security and evidence suite exists
    - At least four cases are held out from prompt tuning
    - Hard results are zero unsupported accepted facts, zero fabricated or misattributed quotes, all security probes blocked, all expected rejections rejected, unavailable data reported as `needs_research`, no fixture promotion, and no public-file mutation
    - Accepted cases clear the deep audit
    - The report includes a confusion matrix, source and claim coverage, reviewer disagreements, costs, and failure stages
    - Legacy gold-page counts are not reported as engine quality
  - Verification:
    - `npm run engine:eval` for the legacy check
    - The new engine evaluation command, named in package.json when S5 lands

- [ ] `WP45-S6` - Promotion, CI, and operator handoff
  - Scope: promotion CLI, `scripts/seed-convex.mjs`, `.github/workflows/ci.yml`, package scripts, tracked skill copies that exist, `ideas/SECTIONS.md`, engine docs, tests
  - Acceptance criteria:
    - One promotion command recomputes schema, evidence, decision, MDX safety, deep audit, tags, highlights, and review-hash checks
    - Validation finishes before any write. Overwrite is refused by default
    - Manifest writes are serialized and recoverable after interruption
    - Seed preflight rejects a new or changed engine entry without a current receipt
    - CI deep-audits every newly promoted or changed engine artifact
    - A stale `auditPassed: true` flag does not pass
    - An edit to MDX, a record excerpt, tags, highlights, or the quality policy invalidates the receipt
    - Canonical skill instructions that are actually tracked stay synchronized
    - Content publishing stays separate from paused tenant-site publishing
    - No automatic push, merge, production seed, deployment, paid-plan activation, or MCP retirement
  - Verification:
    - Filesystem tests for concurrent and interrupted publication
    - `npm run typecheck`
    - `npm run lint`
    - `npm test`
    - `npm run validate:idea-tags`
    - the new engine eval
    - `npm run build`
    - `npm run check:server-traces`
    - `git diff --check`

## Out Of Scope

- Framework rewrite
- Convex schema changes
- Customer reports
- Admin UI
- Tenant publishing
- Scheduled harvest
- MCP retirement
- Production mutations
- Live provider spend, deploy, seed, push, and merge
- WP29, WP30, WP31, and WP32 through WP37
- Lowering quality gates so current fixtures pass
- Manufacturing sources, patching verified booleans, or treating legacy gold-page counts as engine quality

## Notes

- The quality policy in the completion plan is the implementation scope for this package. It is not an existing ruling in `docs/wp/RULINGS.md`.
- Unresolved evidence-policy or security choices stop and escalate. Do not invent a ruling.
- Base revalidation on 2026-09-27. `origin/cursor/phase-7-skill-flip-d6b7` is still `85d1db483a38802e483c1187ceafa81c66ab9343`. Line-level F1 through F10 revalidation is recorded in `docs/wp/wp45-progress.md` before S1 code.
