# Idea engine: audit and completion plan

Date: 2026-09-27. Reviewed PR #71 at `85d1db483a38802e483c1187ceafa81c66ab9343` (`cursor/phase-7-skill-flip-d6b7`), including the earlier engine already on main. Gate lane; documentation only. Review branch: `codex/idea-engine-audit-20260927`, in `.worktrees/idea-engine-audit-20260927`. No merge, publishing, backend mutation, paid research run, or credential change performed.

## Decision

Keep the architecture and complete it. It is a useful operator-run research-and-content pipeline, but is **not yet a reliable startup opportunity engine or ready for unattended publication**. Reddit access is one blocker, not the only blocker. Do not retire the remaining Ideabrowser integration or call phase 7 complete on unit-test results alone.

Preserve `lib/engine/` provider adapters, the seven-step pipeline, JSON records, deterministic compiler, citation indexing, real DataForSEO metrics, cost estimation, DNS/SSRF checks, and draft exclusion. Do not introduce a new framework, database, workflow service, admin UI, or customer-facing research product for this completion.

The immediate goal is trustworthy research and a deliberate publish/reject decision for a supplied candidate. Automated harvesting and a scored idea catalogue are explicitly outside the current operator plan (`overview.md`) and remain WP32 work. A title-to-article pipeline cannot honestly be described as having already implemented those capabilities.

## Findings, with evidence

Line references below refer to the reviewed commit. Existing issues in earlier phases are included because the requested outcome is a complete engine, not merely approval of this PR's diff.

| ID | Severity | Finding and consequence | Evidence |
|---|---|---|---|
| F1 | P1 | Generated prose can cross into executable MDX. Escaping braces without handling preceding backslashes is not a security boundary. | `lib/engine/compile.ts:93–100`; renderer `lib/mdx.tsx:195`. Independent compile-only probe with `problemNarrative = '\\{12345 + 67890}'` produced an executable arithmetic expression in the actual MDX compiler output. No malicious expression was executed. |
| F2 | P1 | Ordinary compilation writes directly into public content before approval or deep audit. The manifest's `auditPassed:false` is descriptive, not an enforced release gate. | `scripts/engine-compile.mjs:91–119`, `lib/engine/compile.ts:654`, `scripts/seed-convex.mjs:191–195`. Draft-prefix exclusion is good, but changing the slug avoids that protection. CI runs tests/tags/build, not deep audits of every engine publication. |
| F3 | P1 | Numeric grounding checks digits, not the claimed fact. Source attribution to a search answer is weaker than verifying the source page. | `lib/engine/pipeline.ts:475–490,703,722`. `isGroundedFigure('$20 billion', 'The price is $20 per seat')`, `('$0', 'No pricing provided')`, and `('Free', 'Pricing available on request')` all return true. Magnitude, currency, billing period, subject, date and context are lost. |
| F4 | P1 | No enforced opportunity rejection decision. Buyer, workaround, wedge and duplication are chat instructions; optional model scores do not establish viability. | `pipeline.ts:751–771,1074–1100`; `.claude/skills/publish-idea/SKILL.md` “Idea gate”. A well-formed generic idea with enough rows can proceed. |
| F5 | P1 | Evaluation does not demonstrate engine quality. It counts features of old pages, not the quality or rejection behaviour of current generated outputs. | `scripts/engine-eval.mjs:18–28`. Three legacy gold pages pass, while the current code-reviewer draft fails the deep audit with zero verified quotes, missing year-one math and generic schema. |
| F6 | P2 | Quote rows do not establish independent evidence; the auditor can match an excerpt without binding it to its displayed URL. | `pipeline.ts:1111`; `scripts/audit-idea-mdx.mjs:503–505` uses substring matching in either direction. Compiler `compile.ts:415–416` includes signals whose verification is absent. Two rows from one discussion can satisfy the verified-row minimum. |
| F7 | P2 | Verification cannot be replayed from the record. Mode, prompt/version identity and bounded source evidence are absent. | `research-record.ts:147–151`, `pipeline.ts:1147–1150`. A persisted `verified:true` is an assertion without the text, retrieval time and identity needed to review it. Fixture and live outputs have no explicit provenance-mode barrier. |
| F8 | P2 | Authenticated source redirects forward Reddit bearer credentials across origins. | `providers/sourceText.ts:289–303`. Mocked 302 from `oauth.reddit.com` to another public host retained `authorization: bearer dummy-token`. This is a latent redirect leak; an exploitable live Reddit redirect was not established. |
| F9 | P2 | Unknown provider charges disappear from the cap ledger; some calls can hang and source bodies are unbounded. | `pipeline.ts:935–951`, `providers/openai.ts:85–128`, `providers/sourceText.ts:249–260`. A billed request with a lost/unparseable response can be retried without retaining its reservation. Missing usage becomes zero. A cited public page can exhaust memory before excerpt truncation. |
| F10 | P2 | Generic pricing/economics remain publishable fallbacks; prose length is over-weighted as a quality proxy. | `compile.ts:261–313` supplies generic tiers and margin/payback targets; `scripts/lib/idea-quality.mjs:11–14` requires 2,200 words. Longer unsupported prose is not better evidence. |

Keep the existing SSRF protections, including socket-time DNS checks. They are valuable; F8/F9 require targeted hardening, not replacement. Prompt injection is a data-boundary problem: external text must never determine tool permissions, destinations, secrets, executable output or publication status.

## Product and research direction

Judge the opportunity before writing the article. Each candidate needs a named buyer, recurring job, current workaround, evidence of material pain, a reachable acquisition channel, and a narrow differentiated outcome that a weekend prototype can actually test. The engine must actively search for reasons the idea should fail: incumbent coverage, low willingness to pay, acquisition friction, integration access, data dependence and unrealistic scope.

Use three outcomes: `accept`, `needs_research`, `reject`. `accept` means suitable for an editorially reviewed hypothesis, not validated product-market fit. Use `needs_research` for inaccessible sources, unknown pricing or insufficient evidence; use `reject` for substantiated duplication, no credible wedge, impossible weekend scope or a fatal dependency. Do not convert network failures into “no demand”. Never promise that a scoring formula can guarantee successful startups.

Recommended initial policy, to implement explicitly and calibrate against labelled cases:

- At least two independent pain evidence units from distinct discussions/respondents or organisations; two excerpts from one thread are one unit. Prefer more than one source family when relevant, but do not require Reddit specifically.
- A documented spending/workaround signal, not just likes, upvotes, broad search volume or model enthusiasm. An observed price proves a vendor charges, not that this buyer will pay for this wedge.
- Direct competitor/workaround analysis with first-party pricing where available. Record “not publicly disclosed” honestly; do not invent a third paid competitor to fill a template. Compare spreadsheets/manual labour and “do nothing” too.
- Claim-level sources for factual numbers, material assertions about named entities and factual comparisons. Label proposed prices, funnel conversion, margins and revenue as assumptions or scenarios, never measured findings.
- Search metrics retain provider, query, market, language, retrieval date and measurement period. Advertising competition is not startup competitive intensity. Sparse keywords should remain missing, not fabricated zeroes.
- A specific buyer + job + wedge duplication check against the existing catalogue. Exact duplicates reject; nearby ideas require a recorded distinction. Do not rely on slug uniqueness or an LLM's similarity score alone.
- A weekend experiment with a concrete deliverable, realistic integrations, excluded scope, and a falsifiable success/stop criterion. Revenue calculations must be dimensionally correct and use explicit inputs; ARR at a run rate is not first-year recognised revenue.

Retain concise writing and repetition checks. Replace the hard 2,200-word proxy only as part of a documented quality-policy change: require evidence and useful section coverage, keep length as a warning, and fail unsupported padding. Do not simply lower the threshold to make the three current drafts pass. Preserve the eight public headings and existing SEO/tag contracts.

## Target flow and record contract

`candidate → research → evidence checks → opportunity decision → draft compile → content/security audit → human review → promotion`

Extend the existing record with a versioned v2 schema; keep a read adapter for v1 historical records, but v1 cannot be promoted as new verified research. Prefer small modules beside `pipeline.ts` instead of adding more unrelated logic to that file.

Required additions:

1. `run`: ID, live/fixture mode, code/pipeline/prompt versions, actual provider model IDs, timestamps, status, costs with known/estimated/unknown attribution. Record failure stages too.
2. `sources`: stable evidence ID, canonical URL, publisher/source family, retrieval time, publication time if known, bounded relevant excerpt, content hash, read outcome, retention/removal policy. Keep full responses private and untracked; store only permitted excerpts. Hashes establish identity, not truth.
3. `claims`: claim text, evidence IDs, observed/derived/assumed classification, typed value/unit/currency/period/geography/subject where applicable, exact supporting excerpt and verification result/reason. Search-answer-only claims stay provisional.
4. `signals`: exact quote + canonical source and post/comment identity, relevant pain context, independence grouping, verification result. Do not persist unnecessary personal identifiers.
5. `assessment`: buyer/job/workaround/wedge, supporting and disconfirming evidence IDs, feasibility/dependencies, closest existing ideas, decision and reason codes. Scores are secondary and carry rationale/confidence.
6. `review`: hashes of record, MDX, tags/highlights and quality-policy version plus reviewer approval. Any change invalidates approval. A locally editable hash file does not defend against a malicious repository maintainer; the threat model is accidental/agent publication under protected repository review.

## Implementation sequence for another agent

This is the scoped completion backlog for the independent operator-engine plan, not an amendment to the Build Platform manifest. Before implementation, register a free WP identifier in `docs/PROJECT_STRATEGY.md`, create its stories/progress, and link this plan. Do not reuse occupied WP numbers or start WP29–31. One story at a time; no broad cleanup.

### S1 — Close executable content and premature publication (first gate)

Scope: `lib/engine/compile.ts`, `compile-write.ts`, `scripts/engine-compile.mjs`, `scripts/audit-idea-mdx.mjs`, narrow new promotion/safety modules and engine tests. Later integrate seed/CI guards in S6.

- Default every compilation to `engine/drafts/`, independent of slug. Keep existing public pages readable. No automatic public MDX/manifest writes, tags or dates before promotion.
- Use safe Markdown text serialization and parse the final content with the actual installed MDX parser. Reject expression, JSX and ESM nodes; permit literal fenced code. Validate destinations as HTTP(S), reject credential-bearing links, and bound field sizes. Do not change the whole site's rendering framework.
- Promotion must refuse absent/false verification and fixture-mode records. Until v2 exists, do not add an interim bypass for old records.
- Tests: preceding backslashes of both parities, braces, JSX, import/export, injected fences, link labels/URLs and Unicode; prove the actual MDX output has no executable nodes. A bad record leaves public files byte-for-byte unchanged.

### S2 — Replayable evidence and source-safe providers

Scope: `research-record.ts`, `providers/sourceText.ts`, provider types, pipeline evidence helpers and tests.

- Implement v2 evidence identity, bounded excerpts/hashes, explicit mode/version metadata and v1 read compatibility.
- Bind quotes to exact normalised quote text AND canonical source/post identity. Canonicalise equivalent URLs; do not accept fabricated suffixes/prefixes via substring matching. Require independent evidence units.
- Fetch the actual pages supporting statistics and prices; check the complete typed claim against its excerpt. A semantic verifier can assist, but unsupported/ambiguous claims stay unresolved; model judgement alone must not turn search summaries into verified facts.
- Define freshness windows by evidence type and recheck before promotion; changed/deleted supporting material invalidates verification until reviewed. Retrieval timestamps alone do not establish that a price is current.
- Preserve all existing DNS/redirect SSRF tests. Refuse authenticated cross-origin and HTTPS downgrade redirects. Bound streamed bytes, total time, redirects and concurrency; add explicit provider-call deadlines and secret-safe errors.
- Tests include `$20` versus `$20 billion`, annual/monthly, percent/count, wrong date/geography, absent/free/contact-sales prices, unrelated digits, copied quotes with wrong URLs, duplicate threads, deleted pages, injection text and large responses.

### S3 — Provider resilience and source availability

Scope: `providers.ts`, adapters, `cost.ts`, `pipeline-steps.ts`, run accounting and CLI diagnostics.

- Add a no-secret-value preflight for required configuration. Distinguish configured from actually authorised; live smoke is the latter.
- Hold worst-case cost reservation across unknown outcomes; reconcile trustworthy usage, never equate missing usage with zero. Persist a redacted failure/cost report before exiting. Bound retries/backoff and honour provider rate-limit guidance. Do not retry rejected credentials or payment-required responses blindly.
- Add a bounded non-Reddit discovery path using the existing search adapter and HN/page readers. Try source families appropriate to the buyer (HN, public vendor/community forums, permitted review pages); check accessibility early and retain the same quote requirements. A failed Reddit read must not cause infinite search or lower the evidence bar.
- Add source capability states (`unconfigured`, `approval_required`, `ready`, `rate_limited`, `unavailable`) and actionable failure reasons. Do not use logged-in browser cookies or proxy workarounds as API credentials.
- Verify model availability/rate cards against provider documentation and an authorised smoke at implementation time; never change providers just because a cheaper model is available. The $4 estimate-based run cap remains; enforce a batch cap and report unknown-cost reservations separately.
- Tests: billed-but-disconnected response, absent usage, malformed JSON, permanent 4xx, 429, timeout, exhausted cap and fallback exhaustion. No live calls in CI.

### S4 — Opportunity decision and useful content

Scope: brief/record assessment fields, small assessment module, pipeline prompts, compiler editorial sections and tests.

- Implement the decision policy above with deterministic hard failures and evidence-backed editorial judgements. Save rejection/research-more reports; do not force every run into an article.
- Build a cheap exact/normalised buyer-job catalogue screen before paid research and a reviewed semantic distinction afterwards. Persist nearest existing ideas and the proposed difference.
- Add explicit disconfirmation research inside the existing bounded budget. Keep external text in delimited untrusted data blocks and deny source-authored instructions.
- Remove generic publishable tier/economics fallbacks. Compute economics from explicit inputs, include scenario labels and downside, and preserve unknowns. Make highlights derive from approved claims rather than separately handwritten numbers.
- Distinguish observed demand, inferred opportunity and an experiment. Retain the section contract and idea-specific build prompts without demanding boilerplate tables or prose solely to hit a word count.
- Tests: generic “AI tool for everyone”, same buyer/job as an existing idea, high-volume irrelevant query, contradictory evidence, unrealistic regulated/integration-heavy weekend build, plausible niche with sparse search metrics, and a strong evidenced wedge. Assert reason codes, not a magic score.
- Economics tests require paying accounts to equal the terminal funnel count, selected tier and revenue per account to agree with explicit seat/usage assumptions, annual billing to be normalised explicitly, and ARR to remain distinct from first-year revenue.

### S5 — Evaluation that measures the engine

Scope: `scripts/engine-eval.mjs`, `engine/eval/`, frozen provider fixtures, engine tests and package scripts.

- Keep the current gold-page check as a clearly named legacy regression check. New engine evaluation must replay providers → record → decision → compile → deep audit in temporary output directories with network disabled.
- Use an initial human-labelled set of 12 cases: four credible candidates, four weak/reject cases, four evidence/access-ambiguous cases. Add a separate adversarial security/evidence suite. Label decision reasons and source sufficiency before tuning prompts; keep at least four cases held out from tuning.
- Required hard results: zero unsupported accepted facts in reviewed outputs, zero fabricated/misattributed quotes, all security probes blocked, all expected rejection cases rejected, unavailable-data cases reported as research-more, no fixture promotion, no public-file mutation. Accepted cases must clear the actual deep audit, not merely word counts.
- Report confusion matrix, source/claim coverage, reviewer disagreements, costs, and failure stages. This small set is a release regression gate, not statistical proof of business success.

### S6 — Promotion, CI and operator handoff

Scope: promotion CLI, `scripts/seed-convex.mjs`, `.github/workflows/ci.yml`, package scripts, existing skill copies that actually exist, `ideas/SECTIONS.md`, engine docs and tests.

- One promotion command recomputes schema, evidence, decision, MDX safety, deep audit, tags/highlights and review-hash checks. Validate before any write; refuse overwrite by default. Serialize manifest writes, recover from interruption, and prove no lost update or partial public pair. Do not build a distributed publishing service.
- Seed preflight rejects new/changed engine entries without a current receipt. CI deep-audits every newly promoted/changed engine artifact, including changed records and manifest entries. A stale `auditPassed:true` flag must not pass.
- Prove edits to MDX, record/source excerpts, tags/highlights or quality policy invalidate the receipt. Test concurrent/interrupted publication against real temporary filesystem writes, not just mocked success paths.
- Keep canonical skill instructions synchronized and test that synchronization; the isolated PR checkout lacks the `.agents/skills/publish-idea` copy claimed by the old overview. Resolve the actual tracked delivery paths before editing ignored local skill files. Keep content publishing separate from paused tenant-site publishing.
- Human review opens representative source pages, checks every material unsupported/derived claim, reviews the whole article for usefulness and confirms the exact artifact. Human approval is not an arbitrary prose-repair escape hatch.
- No automatic push, merge, production seed, deployment, paid-plan activation or MCP retirement. Approval of research artifacts does not authorise those operations.

## Release gate and live test protocol

1. Finish S1–S6 and get an independent high-quality review of security/evidence changes. A lower-cost agent can implement bounded stories and tests; do not economise on the final trust-boundary review.
2. Run `npm run typecheck`, `npm run lint`, `npm test`, `npm run validate:idea-tags`, the new engine eval, `npm run build`, `npm run check:server-traces`, and `git diff --check` on the final commit. Include changed-content promotion checks in CI.
3. With working provider credentials and a declared spend ceiling, run the three existing briefs into draft storage, then three unfamiliar candidates plus two deliberately weak candidates. Use at most $4 per run and $32 for the eight-run batch, with conservative unknown-cost accounting. This is a proposed future test budget, not spend performed by this audit. Do not rerun paid failures indefinitely.
4. A research-more/reject is a legitimate research outcome. For the three historical briefs, pass only if accepted outputs clear all gates OR independent review agrees a documented rejection is correct; do not claim a publishable-output gate from rejection alone. Demonstrate at least three accepted, independently reviewed live drafts overall before enabling normal operator promotion.
5. Record run IDs, commit/prompt/model versions, source outcomes, decision reasons, actual/estimated costs, audit results and human review. Never commit keys, raw provider payloads, owner IPs/hostnames or unnecessary personal data.
6. Preview promotion in an isolated local/test copy. Verify the actual page headings, citations, assumptions, highlights and prompts against a production build, plus draft exclusion from routes/sitemap/seed. HTTP 200 alone does not establish research or render correctness. No shared Convex backend required for the research loop.

## Reddit setup status and accurate unblock path

Chrome is signed in and the legacy app form at `https://www.reddit.com/prefs/apps` is accessible. Prepared “Weekend MVP Research”, with the public site URL, a localhost callback and a truthful public-discussion editorial-research description. The owner explicitly approved CAPTCHA, app creation and the displayed terms; CAPTCHA completed and the form was submitted. Reddit refused creation and displayed a link to its Responsible Builder Policy. **No client ID/secret was generated.** Repeating CAPTCHA or changing the app to pretend personal use is not the unblock; pursue the existing approval request or permitted alternative sources.

The existing adapter uses server-side `client_credentials`; it needs `REDDIT_CLIENT_ID` and `REDDIT_CLIENT_SECRET`, not the user's password or browser cookies. Use a correctly registered server application for the disclosed business use case; do not describe it as personal/non-commercial to obtain access. A localhost callback is only registration metadata for this app-only flow. Do not assume a client ID/secret means the account has data access approval.

Reddit's [Developer Platform & Accessing Reddit Data](https://support.reddithelp.com/hc/en-us/articles/14945211791892-Developer-Platform-Accessing-Reddit-Data) and [Responsible Builder Policy](https://support.reddithelp.com/hc/en-us/articles/42728983564564-Responsible-Builder-Policy), checked 2026-09-27, require approval and explicit permission for commercial use. The request should disclose the business purpose, relevant public discussions, short attributed quotations, AI-assisted synthesis, third-party processing, expected volume and retention/removal handling. Do not assume the academic researcher route applies. PR #71 says a review is pending, but this audit has not verified a ticket or approval; avoid submitting duplicate requests blindly.

Recommend making Reddit optional while its approval is unresolved. Equivalent permitted source evidence should satisfy the engine; source access must never determine whether fabricated evidence is accepted. Keep secrets in ignored local environment files or the approved secret store, never JSON research records, Git, terminal output or frontend variables. Verify token plus one permitted read without printing credentials before marking the adapter ready.

## Copy/paste assignment for Claude or another implementation agent

> Complete the existing operator idea engine using `docs/plans/idea-engine/2026-09-27-completion-plan.md`, starting from PR #71 commit `85d1db483a38802e483c1187ceafa81c66ab9343` or its verified successor. Read repo instructions and register a work package, branch and stories/progress before code. Revalidate findings if the base changed. Implement S1 first, then S2–S6 sequentially, with tests and a concise progress update for each story. Preserve existing architecture; no framework rewrite, Convex schema/customer reports/admin UI, tenant publishing, scheduled harvest, MCP retirement or production mutations. Write failing regression tests for the confirmed defects before fixing them. Keep all new output private drafts until hash-bound human-reviewed promotion. Do not lower quality gates to make fixtures pass, manufacture sources, patch verified booleans, or claim engine quality from legacy gold-page counts. Run the full final gate and report accepted/research-more/rejected outcomes honestly. Live provider spend, deploy, seed, push and merge remain separate explicit operator actions. Escalate unresolved evidence-policy/security choices for high-quality review; do not invent rulings.

## Verification performed during this audit

- `npm run test:engine`: 103/103 passed.
- `npm run engine:eval`: 3/3 legacy pages passed; does not certify generated research.
- `npm run validate:idea-tags`: 225/225 passed.
- `npm run typecheck`: passed.
- `npm run lint`: passed, 35 warnings and zero errors.
- `npm test`: passed (full configured suite).
- `audit:idea -- --slug engine-draft-ai-code-reviewer --record engine/records/ai-code-reviewer.json`: failed as expected; 15 reported errors including zero verified quotes.
- `npm run build`: passed after isolated `npm ci --ignore-scripts` (754 packages, zero reported vulnerabilities). The initial attempt using a symlink to root dependencies failed because Turbopack rejects a `node_modules` symlink outside its project root; that temporary symlink was removed. Earlier test/typecheck/lint results used the existing root dependency installation.
- `npm run check:server-traces`: passed after the isolated build. `git diff --check` and explicit whitespace check of this new plan passed.
- Independent review of this plan added freshness/revocation, economics consistency and receipt-invalidation acceptance tests.
- Independent read-only quality and security reviews supplied the reproductions above. No live research or new opportunity-quality claim is established by these checks.

Docs updated: this audit, scoped completion plan, acceptance tests and agent assignment. Product/runtime code unchanged. The Build Platform manifest and existing owner rulings are unchanged; proposed quality-policy changes above need to be recorded as part of the implementation scope rather than silently treated as existing rulings.
