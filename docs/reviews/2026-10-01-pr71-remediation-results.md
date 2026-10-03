# PR #71 remediation — results (WP54)

Date: 2026-10-03. Status: **ready for an independent Codex review with the
live gate open** — F1–F7 are fixed and the full gate is green, but none of the
three representative live briefs produced a page (all failed closed at
evidence acceptance; §8). Not merged, not pushed, nothing published, seeded or
deployed. The next reviewer decides GO/NO-GO.

Plan: [pr71-remediation-plan.md](../plans/idea-engine/pr71-remediation-plan.md) ·
Review: [2026-10-01-pr71-idea-engine.md](2026-10-01-pr71-idea-engine.md) ·
Contract: [pr71-evidence-contract.md](../plans/idea-engine/pr71-evidence-contract.md) ·
Work package: [wp54-stories.md](../wp/wp54-stories.md), [wp54-progress.md](../wp/wp54-progress.md)

## 1. Revision

| | |
|---|---|
| Reviewed baseline | `b258ebb3ff3ec7dc84a232a2505039a0b0741b12` (`cursor/phase-7-skill-flip-d6b7`) |
| Actual PR #71 head when work started | `1c7240bdd30a4f6dff5d02eeab6d95fb36fc48df` (one commit past the review: `htmlToText` block line breaks; narrows but does not fix F5) |
| PR base | `7c4fdc3a4493a4a0e1452236912dca561fad0d6d` (`main`) |
| Repair branch | `claude/wp54-pr71-remediation` (local only; upstream unset) |
| Repaired code revision | `a7ca90cd3c20c722a9fd80986c0911e5fc96aeab` (`a7ca90c`; full gate §7) |
| Evidence/docs-only commits after it | `02cd9b8` (progress; the live runs ran here), `9bbe558` (contract R13 amendment), `e4b5f67` (live-run evidence), and the commit adding this report |
| PR #71 remote head now | `1c7240bdd30a4f6dff5d02eeab6d95fb36fc48df` (unchanged; open, mergeable against `main`) |

Workers: Claude Opus 5.5 subagents in separate `.worktrees/wp46-*` checkouts,
one writer per file, merged by the orchestrator. Overlap: PR #83 (WP45,
`codex/wp45-idea-engine-completion`) targets many of the same defects from an
older PR #71 head (`85d1db4`); it was not touched or merged. The owner decides
how the two packages reconcile.

## 2. Findings F1–F7

| Finding | Root cause | Repair | Main files | Regression tests (all in `npm test`) |
|---|---|---|---|---|
| **F1** rejected evidence leaked into prose | Quotes were checked after synthesis; the writer saw search answer prose and unverified page text; the compiler dropped `verified:false` quotes but kept the narrative written from them. | Evidence is extracted (paid, schema-only) and accepted deterministically **before** any writing; the writer gets the brief, the accepted bundle and keyword rows only; its JSON must pass the closed v2 record parse (up to three billable attempts, each later one given the issue list — R13). No free figures, number words or quoted spans (double, single, guillemet or corner-bracket quotes) in any writer field outside evidence tokens, with one shared allowlist for standard and version names (R6, R13); a live brief's title, audience and one-liner may hold no figure, so the writer never echoes one (refused before spend); tokens render their claim (R7); the auditor refuses unbound figures, quoted spans outside verified quote blocks and non-evidence links in every section. | `lib/engine/pipeline.ts`, `pipeline-sources.ts`, `pipeline-steps.ts`, `research-record.ts`, `evidence/{accept,tokens,contract}.ts`, `compile.ts`, `artifact-audit.ts` | `pipeline.evidence.test.ts` (writer input never contains the rejected "47 PRs / team of 8", "60% / 25%" claims, search prose or old narratives; invented metrics and unknown/rejected ids fail; paraphrase passes; early stop), `research-record.v2.test.ts` (writer-field figure/quotation rules), `replay.test.ts` (F1 end to end), `audit.*.test.ts` (figure guard on every section) |
| **F2** altered quotes and attribution passed | Bidirectional substring matching; attribution URL ignored. | Each blockquote is parsed with its attribution by the site's MDX parser; strict normalized equality with a selected accepted quote (`quoteMatchesExcerpt`); exact canonical source URL (`sameSource`) and source title; distinct identities by containment; inline quote links and quoted spans anywhere checked (single, typographic, guillemet and CJK quotation forms included — R13); whole-sentence, single-line community quotes only (R8), with sentence starts that follow the page's structure (R14); quotes and record text carrying bidi or invisible format controls are rejected (R15). | `artifact-audit.ts`, `scripts/audit-idea-mdx.mjs`, `evidence/quote.ts`, `page-format.ts` | `audit.quotes.test.ts`, `audit.links.test.ts`, `audit.cli.test.ts` (appended sentence, fake URL, same host/other thread, missing attribution, changed number, negation, reordering, ellipsis, duplicate reuse — real CLI exits 1), `replay.test.ts` mutations |
| **F3** stored drafts stayed discoverable | The seed only upserts, so the three `engine-draft-*` rows seeded on 2026-09-24 stayed in every Convex discovery query after PR #71 blocked their pages. | One predicate (`lib/engine-drafts.ts`) enforced server-side in every discovery read, count and new-work entry point (incl. preview claim); native pagination kept; member saves, notes, collections and plans preserved with a "Research retired" state; a draft's pre-deploy preview shows "Research retired" instead of the claim bar; no schema change, backfill or deletion. | `convex/ideas.ts`, `convex/platform/{catalogPolicy,ideas,legacyIdeas,weekendPlans,intake,promptPack,compare}.ts`, `convex/platform/preview/{generate,claim}.ts`, `lib/engine-drafts.ts`, `lib/home/library.ts`, `components/platform/**` | `convex/wp54DraftRetirement.test.ts`, `tests/platform/wp54-retired-drafts.test.tsx`, `tests/platform/wp54-retired-draft-views.test.tsx`, `tests/platform/wp54-retired-draft-preview.test.tsx`, `tests/sitemap/engine-drafts.test.mjs`, `tests/home/library.test.ts` |
| **F4** unbounded source downloads | Whole bodies buffered, each chunk retained; per-hop timeouts; unbounded `Promise.all` reads. | `SOURCE_LIMITS`: 2 MiB body (`maxBodyBytes`), 4 MiB connection bytes incl. framing (`maxSocketBytes`), 2 MiB decoded, 15 s for the whole read (DNS, every redirect, body), 5 redirects, 4 concurrent reads; one growing buffer; identity encoding only; per-run acquirer with dedupe and a semaphore. | `lib/engine/providers/sourceText.ts`, `lib/engine/acquire.ts` | `sourceText.transport.test.ts` (cap, one byte over, huge Content-Length, chunked, 1-byte chunks, decoded cap, deadlines, concurrency), `acquire.test.ts`, `__smoke__/tinyChunks.ts` (`--expose-gc` peak) |
| **F5** numbers grounded without their claim | Bare-number membership; a price credited when a sentence named the vendor and the number. | One constrained amount/price grammar; claims compare on amount, currency, magnitude, period, basis and qualifiers; vendor binding per claim (first-party host, nearest vendor in the clause, a vendor's own site never backs a rival — R5, comparison cues, plan binding, ambiguous billing — R9; the claimed vendor must be the nearest brand-like name before the price on every page, page-scoped billing toggles, move/migrate/after/over/replace cues — R14); stat subject, metric, year and projection bound to the sentence, every subject word present in it. | `lib/engine/evidence/{amount,accept,citation}.ts` | `accept.test.ts` (the plan's 9-row matrix + R5/R9 cases), `pipeline.evidence.test.ts` (rows 1–4 through the full pipeline), `replay.test.ts` |
| **F6** displayed ARR not recomputed | The auditor checked only the line's shape; fractional accounts were rounded; a min-one downside clamp. | `finance.ts`: integer cents, whole counts, `floor(base/2)` downside that may be zero, explicit seats; the compiler renders Year-One from it and the auditor recomputes every displayed value; tier rows must equal the record; revenue totals elsewhere are refused at parse and at audit (R13); the homepage shows engine rows from generated highlights only, never re-parsed tier lines (R15). | `lib/engine/finance.ts`, `compile.ts`, `artifact-audit.ts` | `finance.test.ts`, `audit.finance.test.ts` (45 × $100 → $54,000; downside 22 → $26,400; $24.99 cents; $5,400,000 fails; each mutation fails) |
| **F7** bodyless responses crashed or hung | 205 built a `Response` with a body inside an async callback; construction errors escaped the promise. | Null-body statuses (HEAD/204/205/304) and empty bodies are `no_content`; construction wrapped; one settle path for every error, abort and close; 101 settles at once. | `lib/engine/providers/sourceText.ts` | `sourceText.transport.test.ts` (205, 101, HEAD/204/304, empty 200, partial abort, socket error), child-process 205 smoke |
| Redirect credentials | Bearer reused across origins; HTTPS→HTTP allowed. | Only GET/HEAD follow redirects; after an origin change only user-agent/accept/accept-language are forwarded; authenticated HTTPS→HTTP refused. | `sourceText.ts` | transport tests (cross-origin bearer, cookie, custom header, downgrade) |
| Fractional accounts | `parseYearOne` rounded 0.4 to 0. | Whole counts only, last funnel stage equals paying accounts. | `finance.ts`, `research-record.ts` | `finance.test.ts`, `research-record.v2.test.ts` |

Independent re-review of `7a16647` (final correctness reviewer, scratch copies,
33 new and 22 adapted mutants): **F1–F7, redirect credentials and fractional
accounts FIXED**, P2-A…P2-H closed, no new P0/P1. Rounds 5–6 then closed its
one new P2 (a figure in the code-reviewer brief that the writer would echo)
and the security reviewer's JSON-LD finding. The S7 diagnosis found two
further F5-class contract gaps in price billing and hedges (§10, items 2–3);
they did not affect any live record.

## 3. Original red evidence

Every reproduction ran against the original code (PR head `1c7240b`, or a
revision whose files under test were byte-identical to it). Raw outputs are
kept, sanitized, in `docs/reviews/evidence/wp54/`.

- **F1** (old pipeline): a "$2024 billion" market stat backed only by
  "Published in 2024" entered `market.stats`; a quote marked
  `verified: false` stayed in the record while `problemNarrative` still said
  "A team of 8 reviews 47 PRs a week and spends 60% of its time reviewing
  versus 25% coding." The committed `ai-code-reviewer.json` parsed with three
  unverified signals and a narrative mentioning 47 PRs.
- **F2 / F6** (old auditor, real CLI on the committed code-reviewer draft):
  unmodified PASS (3,195 words); a sentence appended inside the HN quote PASS;
  the HN attribution changed to `https://example.org/fake-source` PASS;
  `$54,000 ARR` changed to `$5,400,000 ARR` PASS — each exit 0, `ok: true`.
  Old `parseYearOne` turned `payingAccounts: 0.4` into 0, and `yearOneLines`
  gave a one-account base a one-account downside (a zero-account base showed
  a $1,200 downside above its $0 base).
- **F3**: the review's probe failed with `+ "engine-draft-ai-code-reviewer"`
  still returned by `api.ideas.list` after a reseed without it; the new suite
  failed 10 of 12 on the old code; a disposable local backend on the old code
  returned drafts from the archive, `latest`, `byTool(replit)`, `byCategory`,
  `byRevenueGoal`, `allForSitemap`, `relatedFor` and `bySlug`.
- **F4 / F7 / redirects** (old transport through its real callbacks):
  HTTP 205 left the promise pending with an uncaught
  `TypeError: Response constructor: Invalid response status code 205`; a
  3 MiB stream resolved; a huge Content-Length stayed pending; a cross-origin
  redirect target received `authorization: bearer dummy-bearer-token`; an
  HTTPS→HTTP downgrade delivered it; a 4-hop chain resolved after 613 ms under
  a 400 ms deadline; the child-process 205 smoke exited 1. After the first
  repair, the independent review found 1-byte chunked bodies still peaked at
  +354 MiB per read and 1,649 MiB for four (fixed by the connection-byte cap).
- **F5** (old helpers): `isGroundedFigure` accepted `$20,000/month` against
  `$20,000/year`, `$1.4 billion` against `$1.4 million` and `$2024 billion`
  against "Published in 2024"; `isGroundedForCompetitor` credited Loopio with
  Qvidian's `$30/month`; `quoteAppearsIn` joined fragments across an ellipsis.
- **Independent review of the first repair (`f1351ac`)**: 22 page-level
  bypasses exited 0 on that auditor (inline quote edits, fabricated quotes as
  paragraphs/lists/tables, figures in proposal sections, spelled-out and
  Unicode digits, footnotes and fences, revenue totals, tier rows, relabelled
  rows, bare links, fixture records on public slugs, unchecked highlights).
  All exit 1 now; outputs in `docs/reviews/evidence/wp54/review-final-f1351ac/`.

- **Later rounds** (each reproduced as a failing test or probe before its
  fix): on `e8e6c30` an invented quote in single or CJK quotation marks, a
  `<br>` sentence start that dropped a negation, a rival's price with no
  comparison cue, a billing toggle four lines above a price, the homepage
  re-reading engine tier lines as prices, and standard names such as SOC 2
  refused (round 3); the auditor's revenue-total regex never finishing on
  "ARR" + 20,000 spaces (round 4); a raw `<` in the JSON-LD script text for an
  idea whose How-it-works step holds `</script>`, and crafted pages taking
  the MDX parser 15–58 s (round 5); "Python 4000 developers" passing the
  writer rules and a figure in the code-reviewer brief's audience that the
  writer would echo (round 6).

## 4. Contract changes

- `RESEARCH_RECORD_CONTRACT_VERSION` 2, `PIPELINE_VERSION` 2, `EVIDENCE_CONTRACT_VERSION` 1 (`lib/engine/evidence/contract.ts`).
- Pipeline order: brief → searches → bounded source acquisition → paid schema-only extraction → deterministic acceptance → **early stop on thin accepted evidence** → keywords → editorial writer (accepted bundle + keyword rows only) → closed-schema record parse. Extraction ≤2 billable attempts; the writer ≤3 in total (provider retry or issues-only regeneration, R13). Pinned worst case $3.922 of the $4.00 cap.
- `parseResearchRecord` is v2 only; v1 throws `LegacyResearchRecordError` with a re-research instruction. `readLegacyResearchRecordV1` is history-only (tests). The three committed v1 records stay as history; their old drafts fail `audit:idea` with the legacy message.
- Evidence items carry id (hash of kind, URL, excerpt and typed claim), canonical source URL and title, the source's own excerpt and its SHA-256, retrieval time and attribution; stats and prices carry typed claims parsed by one constrained grammar; rejections are operator-only and never rendered.
- Orchestrator rulings R1–R16 (contract §12): claim-bearing ids; forward-scoped projections; asymmetric quote comparison; records prove consistency, authenticity comes from replay and source inspection; a vendor's own site is not evidence for a rival's price; no free figures or quotations in any writer field; tokens render their claim; whole-sentence community quotes; per-claim binding; the page holds only audited facts; fixture isolation; the run report names the code revision (R1–R12); one shared allowlist and quotation detector for parser and auditor, three writer attempts (R13, amended for version shape, SAML/SCIM and brief figures); binding follows the page's structure (R14); untrusted titles, format controls and credential-like URLs (R15); bounded audit input (R16).
- Engine pages carry an `engine: true` frontmatter marker written by the compiler; the deep bar and the handwritten-page guard read it (`engine:compile` never replaces a handwritten idea without `--replace-handwritten`).

## 5. Security

- **Limits** (`SOURCE_LIMITS`): body 2,097,152 bytes; connection bytes
  4,194,304 (status lines, headers, chunk framing and body); decoded 2,097,152;
  one 15 s deadline per read covering DNS, every redirect and the body;
  5 redirects; 4 concurrent reads per run with dedupe of identical canonical
  URLs (including the supplement search). Four concurrent 2 MiB reads peak at
  33–37 MiB client-side.
- **SSRF**: the original URL, every redirect target and the socket's own DNS
  answer must be public. Loopback, private, link-local/metadata, CGNAT,
  multicast, IPv4-mapped/compatible, NAT64 (well-known and local-use), 6to4,
  SIIT, ULA and site-local IPv6 are refused; IP-literal hosts are checked by
  the transport itself because Node skips a custom lookup for them. The
  pre-existing SSRF tests are unchanged and green.
- **Redirects**: GET/HEAD only; after an origin change only `user-agent`,
  `accept` and `accept-language` are forwarded and never restored;
  authenticated HTTPS→HTTP is refused; URL userinfo is stripped.
- **Exception paths**: HEAD/204/205/304 and empty bodies settle as
  `no_content`; 101 settles at once; response, socket and request errors,
  premature close, abort and deadline each settle exactly once with listeners
  removed; transfer-codings other than (identity,) chunked and any
  content-encoding other than identity fail `unsupported_encoding`. The
  child-process 205 smoke runs inside `npm test`.
- **Redaction**: errors, reports and CLI output pass through `redactUrl` /
  `redactText` (userinfo, fragments, non-identifying query values,
  credential-like path segments, bearer/basic values and local paths removed;
  linear time). Citation URLs carrying credential or signature parameters are
  refused outright (`canonicalSourceUrl` → null).
- **Page safety**: compiled text is escaped once (`escapeMdxText`): no JSX,
  expressions, ESM, raw HTML, images or headings from untrusted text, and a
  U+2060 word joiner stops GFM autolinks inside `http(s)://`, `www.` and
  emails. The auditor fails closed on MDX-only nodes and on any link that is
  not a used evidence source.
- **Untrusted text** (R15): citation titles over 120 characters, or carrying
  figures, links or format controls, are replaced by the host label; bidi and
  invisible format controls anywhere in a record fail the parse; citations
  whose path or query holds a credential-like value are refused and listed in
  the run report's `refusedCitations` (host and reason only).
- **JSON-LD** (found by the security re-review; predates this branch):
  `components/primitives/JsonLd.tsx` now writes `<`, `>`, `&`, U+2028 and
  U+2029 as `\u` escapes after `JSON.stringify`, so idea text (for example a
  How-it-works step containing `</script>`) cannot end the script element.
  All 380 prerendered JSON-LD blocks parse; red evidence in
  `tests/security/jsonld-script.test.tsx`.
- **Bounded audit input** (R16): every auditor and base-bar regex is linear
  (`lib/engine/audit.redos.test.ts` compares n with 4n; "ARR" + 20,000
  spaces went from never finishing to about 30 ms). The auditor refuses an
  MDX file over 64 KiB, and in one linear pass before parsing, a block with
  more than 1,024 emphasis/strikethrough delimiters or brackets or more than
  16 KiB, and a page with more than 1,024 table lines (crafted pages took the
  MDX parser 15–58 s; now refused in about 0.2 s; slowest allowed page about
  1 s). Published pages are far inside these bounds.
- **Independent security reviews**: on `f1351ac` (transport, SSRF,
  settlement, F3 authorization, secrets and MDX injection verified; two P2s
  and the P3s fixed in the fix wave), on `e8e6c30` (original P2s fixed; new
  P3s N1–N6 fixed in round 3) and on `7a16647` (every earlier finding fixed;
  no new P0/P1/P2 in the remediation; the pre-existing JSON-LD issue and an
  R16 timing gap fixed in round 5).
- **Known limits**: a stalled `getaddrinfo` keeps a libuv thread busy after the
  read times out (documented; `dns.Resolver` would bypass system resolver
  configuration); GET/HEAD bodies are not stripped on cross-origin redirects
  (no caller sends one); acceptance of a 2 MiB page of blank lines costs about
  4.7 s of CPU per source (linear, after the fetch deadline); one-byte TLS
  records are bounded by the 15 s deadline (about 8 s of CPU at the 4 MiB
  connection cap).

## 6. Catalogue (F3)

- **Rule**: `lib/engine-drafts.ts` (`isEngineDraftSlug`, range bound
  `engine-draft.`), imported by Convex. `excludeEngineDrafts` filters
  `slug < "engine-draft-" || slug >= "engine-draft."` before `.paginate()`,
  `.take()`, `.first()` or `.collect()` on the existing indexes.
- **Enforced in**: `ideas.{list,byCategory,byRevenueGoal,byTool,byAudience,latest,relatedFor,allForSitemap,bySlug}`,
  `platform.ideas.{library,libraryPage}`, `legacyIdeas.explore`,
  `compare.ideas`, `weekendPlans.{start,startPreview}`,
  `intake.startRepositoryIdea`, `promptPack.source`,
  `preview.generateFromBridge` and `preview.claim` (a draft's pre-deploy
  preview cannot start a new project; a claim made before the retirement
  replays to the member's existing project). Page, sitemap, MDX and seed
  guards stay as defence in depth.
- **Pagination**: cursors untouched; a read bound can still return a short or
  empty page with `isDone: false`, and every consumer loops on
  `continueCursor` (tested with a first page full of drafts).
- **Counts**: discovery counts and facets describe visible ideas; member-work
  counts include the member's own drafts, each labelled "Research retired"
  with no link to the withheld page.
- **Member work**: saves, intents, notes, collections and plans on a draft
  stay owner-scoped and readable; another member stays denied; nothing is
  deleted or archived; unsave stays possible.
- **Seeded-data reproduction**: convex-test seeds the three drafts and
  ordinary ideas through the real seed, reseeds without the drafts, and shows
  the rows stored but undiscoverable. A disposable anonymous local Convex
  backend (ports 3410/3411, scratch copy, never 3210 or cloud) with 3 drafts +
  225 ideas showed drafts in eight queries on the old code and none after;
  `next start -p 3489` served the archive and five hubs without drafts, a
  normal idea page with a draft-free related rail, and 404 for every draft
  page. Processes stopped and the scratch backend deleted afterwards.
- **Accessibility**: the changed member views (retired tag and titles,
  plan, prompts, start page, saved rows, shortlist, building card, pending
  save, preview notice) pass the `a11y-check` checklist; axe-core 4.12.1
  (WCAG 2.0/2.1 A and AA) on the 30 distinct views rendered by the three
  `wp54-retired-*` test files, in the workspace shell's colours, at 1280×720
  and 375×812: 0 violations apart from the owner-accepted decorative preview
  watermark (WP27-S6); contrast the tool could not measure was checked by
  hand (retired tag 7.8:1, meta text 5.3:1).
- **Rollout**: deploy the Convex backend before the frontend that blocks the
  draft pages; `use cache` pages tagged `ideas` may serve pre-deploy HTML for
  up to about an hour unless the tag is revalidated. **Rollback**: frontend,
  then backend; code only, no data to restore. No production mutation was
  made. Ruling recorded 2026-10-01 in `docs/wp/RULINGS.md` (supersedes the
  2026-09-24 "public" row from this change on).

## 7. Checks

Final gate on the repaired code `a7ca90c` (orchestrator run, 2026-10-03,
Node 22.23.1). Summary and per-suite counts:
[`evidence/wp54/gate-a7ca90c.txt`](evidence/wp54/gate-a7ca90c.txt).

| Command | Exit | Result |
|---|---|---|
| `npm run typecheck` | 0 | clean |
| `npm run lint` | 0 | 0 errors, 35 warnings (unchanged baseline; none in `lib/engine`) |
| `npm test` | 0 | **2,173** tests: og 91, links 6, redirects 38 + 76, auth 85, security 82 + 86, sitemap 11, convex 390, engine 1,021, home 42, platform 245 |
| `npm run validate:idea-tags` | 0 | 225/225 |
| `npm run engine:eval` | 0 | 3/3 handwritten gold pages (a legacy auditor regression, **not** evidence of engine output) |
| `npm run build` | 0 | passes; all 380 prerendered JSON-LD blocks parse |
| `npm run check:server-traces` | 0 | clean |
| `npm audit --omit=dev --audit-level=high` | 0 | 0 vulnerabilities |
| `git diff --check` | 0 | clean |
| `git diff --check origin/main...HEAD` | 0 | clean (the two PR lines in `artifacts/quote-gate-live-verification.md` fixed) |
| `npm run engine:replay` | 0 | fixture research → compile → deep audit: 3 quotes, 3 stats, 3 prices accepted; 2,713 words (floor 2,200); 2 verified quotes; 0 unbound figures |
| `npm run audit:idea -- --all` | 1 | 196 pass / 29 fail, byte-identical before and after rounds 5–6 (the 29 are pre-existing handwritten-page findings, unchanged by this work; the three old v1 engine drafts fail with the legacy-record message) |

Test count: measured baseline at the PR head was **1,202** (og 91, links 6,
redirects 38 + 76, auth 85, security 82 + 84, sitemap 7, convex 372,
engine 109, home 34, platform 218). The review's 1,301 for `b258ebb`
differs by more than the one test `1c7240b` added; probably a counting
difference. Removed or replaced: 11 numeric-membership and renumbering
tests for the deleted grounding path (reasons in the test file header), and
`research-record.test.ts` became `research-record.legacy.test.ts`. Earlier
full gates: `f1351ac` 1,735; `e8e6c30` 1,949; `7a16647` 2,150 — all green.

Warnings and limits: the lint warnings are pre-existing; `npm run build`
prints Next's pre-existing notice that the "middleware" file convention is
deprecated;
timing-based tests owned by other suites (`accept.test.ts` 2 s budget,
transport redaction, `pipeline.cli.test.ts` 5 s) can fail under extreme
parallel load (three full engine suites at once), never in a normal run;
the intermediate commit `e6ddb41` alone can flake its own timing test
(fixed by the next commit).

## 8. Live matrix

One paid research attempt per brief, strictly sequential, on 2026-10-03 at
`02cd9b8` (a progress-log commit; code identical to `a7ca90c`;
`codeRevision.dirty: false` in every report). Runner: an operator script
that refuses a dirty tracked tree, loads the four provider keys from the
main checkout's `.env.local` inside a subshell for the research child only,
and writes path-scrubbed transcripts. Pipeline 2, record contract 2,
evidence contract 1; models: `gpt-5.6-sol` (brief normalization,
extraction), Perplexity `sonar-pro` (searches), DataForSEO (keywords, not
reached). Cap $4.00 per run (pinned worst case $3.922).

| | code-reviewer | rfp-assistant | landing-page-generator-ecommerce |
|---|---|---|---|
| Brief file SHA-256 | `5481529c…652d0f` | `c5d6bad2…c8fd1f` | `8558cc1b…f9f17c` |
| Report `briefSha256` (known fields, sorted) | `031c3aa0f70d…` | `14b8db84bb89…` | `3a0e53419b70…` |
| Run (UTC) | 05:50:15–05:51:52 | 05:51:52–05:53:38 | 05:53:38–05:55:16 |
| Outcome | **failed closed** at `evidence_acceptance` | **failed closed** at `evidence_acceptance` | **failed closed** at `evidence_acceptance` |
| Shortfall | 1 vendor with an accepted price (need 3) | 1 vendor (need 3) | 1 vendor (need 3) |
| Cost | $0.3266 | $0.3300 | $0.3116 |
| Billable attempts | normalization 1, 3 searches 1 each, extraction 1 | normalization 1, searches 1/1/2, extraction 1 | normalization 1, 3 searches 1 each, extraction 1 |
| Pages read / failed | 22 / 2 (HTTP 403: Reddit, one market report) | 24 / 8 | 21 / 3 |
| Accepted (quotes / stats / prices) | 8 / 7 / 3 | 3 / 8 / 3 | 3 / 8 / 8 |
| Rejected (main reasons) | prices: 5 `unparseable_amount` (usage units and a unitless "$30"); stats: 5 `unparseable_amount`, 3 `subject_not_in_context`; quotes: 8 `over_cap`, 4 `span_not_found`, 3 `span_bounds` | **no** price rejected; stats: 2 `unparseable_amount`, 2 `over_cap`, 4 other (unit, subject, projection, year); quotes: 1 `span_bounds` | prices: 5 `vendor_not_in_context` (Shopify App Store listings for Instant and Replo); stats: 3 `over_cap`, 1 `metric_unit_mismatch`, 1 `unparseable_amount`; quotes: 3 `span_not_found`, 3 `span_bounds` |
| Record / draft | none written (a failed run writes no record) | none | none |
| Compile / deep audit | not run (no record) | not run | not run |
| Evidence | [report](evidence/wp54/live/ai-code-reviewer.report.json), [commands](evidence/wp54/live/ai-code-reviewer.commands.txt) | [report](evidence/wp54/live/ai-rfp-response-assistant.report.json), [commands](evidence/wp54/live/ai-rfp-response-assistant.commands.txt) | [report](evidence/wp54/live/ai-landing-page-generator-ecommerce.report.json), [commands](evidence/wp54/live/ai-landing-page-generator-ecommerce.commands.txt) |

Total spend $0.97. No run reached keyword or editorial spend, so the writer
rules (R6, R13) were not exercised live. **The plan's target of three
successful representative briefs is not met; the live gate stays open.**
No brief was re-run (plan §11: no loop until a lucky sample passes).

**Why each run stopped** (independent read-only check of every cited
competitor page; 15 of 22 rebuilt byte-for-byte to the run's `textSha256`;
offline `acceptEvidence` calls on that text; full table in
[`evidence/wp54/live/s7-failure-check.md`](evidence/wp54/live/s7-failure-check.md)):

| Brief | Classification | Detail |
|---|---|---|
| code-reviewer | **Market limit** (plus an extraction-coverage miss) | Only CodeRabbit's own page shows seat prices the grammar binds ($24/$48/$72 per developer, billed annually — the three accepted). Macroscope and CodeRabbit add-ons are metered (per minute, file or KB; outside the grammar by design); Qodo's card is a team credit pack with no unit; Bito shows both toggle states with no billing words. A neutral 2025 table (digitalapplied.com) held Cursor Bugbot and GitHub Copilot prices that acceptance would take, but the extraction excerpt filled with market figures first — and those prices look stale. |
| rfp-assistant | **Market limit** | Only rfp.ai publishes self-serve prices. Loopio shows no figure; Responsive's "Starting from $10,000" has no period beside "Contact sales". Ceiling under the current contract: 2 vendors (adding a third-party Loopio claim the extractor did not propose and Loopio's own page does not confirm). |
| landing-page-generator-ecommerce | **False negative intended by the rules** | Instant and Replo publish real plan prices on their own Shopify App Store listings, but the contract treats a marketplace host as a neutral page (§5, R5; `isFirstPartyHost` names apps.shopify.com), where the app must be named in the price's clause, and it is not. Treated as the app's own listing, all 5 prices pass and the brief clears the gate. |

No rejection in these runs comes from code that departs from R5, R9 or R14.
The check also found three problems that did not cause these failures (§10).

## 9. Editorial assessment

**No live idea page exists to assess.** All three runs stopped before the
writer, so the plan's editor questions (specific buyer and weekend-sized
first version, proposals and assumptions labelled, current prices with
billing basis, build prompts matching the product, padding, evidence
supporting the claim made) remain unanswered for live output, and no draft
was rendered: there is nothing new to render, and the public route's draft
guard was left untouched. The only end-to-end page is the deterministic
fixture (2,713 words, deep bar, 0 unbound figures); its sources are
synthetic, so it shows the pipeline's mechanics, not live editorial quality.

What the evidence stage does show:

- **Fail-closed works and is cheap.** Each run refused to write after
  $0.31–$0.33, naming the shortfall and the top rejection reasons, instead of
  filling the competitor section with unverified prices as the v1 engine did.
- **Price evidence is the binding constraint.** B2B tools increasingly price
  by usage, behind sales, or inside marketplace listings. The contract's
  "three competitors with a verified price" rule (inherited from v1, which
  let the model write the prices) is not reachable for two of the three
  representative markets without a contract change, and the third needs a
  marketplace rule (§10, options A and C2).
- **Accepted is not credible.** Market statistics were accepted 7–8 per run,
  mostly from market-research aggregator pages (marketintelo, dataintelo,
  intelmarketresearch, researchandmarkets, mordorintelligence and similar).
  Acceptance proves the figure, subject, metric and year are on the cited
  page; it does not make a report-mill estimate reliable. An editor should
  treat such rows as weak, and a source-quality rule is an owner decision.
- **Community evidence was practitioner discussion** (in the code-reviewer
  run: Hacker News threads, Atlassian Community, the ITK forum; Reddit
  returned HTTP 403 to the fetcher), 3–8 accepted quotes per run. The v1
  record's unverified "47 PRs / team of 8 / 60% / 25%" narrative cannot
  reach a page the same way: writer text holds no figure outside accepted
  evidence tokens, and no writer ran.
- **Weekend-MVP feasibility** of the three ideas was not reassessed; the
  published handwritten pages for these slugs are unchanged.

## 10. Remaining work and limits

**Open gate**

1. **Live evaluation: 0 of 3 representative briefs produced a page.** All
   three failed closed at `evidence_acceptance` (§8). The plan's target is not
   met and no owner waiver is assumed. A new three-brief evaluation needs an
   owner decision first, and must run all three on the new revision:
   - **A.** Treat a marketplace listing as the app's own page when its header
     names the app or developer (unblocks landing pages; risk: listing prices
     can differ from the vendor's site, and a wrong match credits one app with
     another's prices).
   - **C2.** Count a first-party "pricing not public / contact sales"
     statement toward the three-competitor minimum, with at least one or two
     accepted prices (unblocks RFP; a product decision about what the page
     claims).
   - **B.** Usage units as their own price kind (code-reviewer reaches only 2
     vendors; touches finance, tokens and the auditor).
   - **D + E.** Price runs first in extraction excerpts, only together with a
     freshness rule for secondary prices.
   - Code-reviewer has no path to three priced vendors that keeps first-party
     binding except C2.

**Found during S7, not fixed** (no live record was affected; each changes
verification, so batch them with the decision above)

2. **F5-class contract gap — one billing qualifier applies to every price in
   its clause** (`lib/engine/evidence/amount.ts:78`, `1012–1036`). On
   coderabbit.ai/faq an offline check accepts the false "Essentials
   $30/user/month, billed annually" and rejects the true monthly claim.
   Proposed: fail closed when a clause holds two or more prices and a billing
   qualifier.
3. **F5-class contract risk — hedges are ignored** (`amount.ts:44`):
   "approximately $152/month" for a modelled team is accepted as a list
   price. Proposed: no hedges in competitor prices (keep them for stats).
4. **Text fidelity — `htmlToText`** (`lib/engine/providers/sourceText.ts:460–478`)
   keeps the HTML source's newlines and indentation and turns tags into
   spaces, so prices split across spans ("$39" … "/ month") cannot be read.
   Fix: collapse whitespace like a browser and break lines only at block
   tags; this re-baselines every `textSha256` and the fixtures.

**Reviewer residuals (P3, recorded, not fixed)**

5. Some billing-toggle lines are not recognised ("Monthly Yearly (save
   $48)"); all-caps, lowercase or after-the-price rival names escape the
   brand rule unless hinted; vague quantities ("half", "a third"); metric
   "other" accepts a growth sentence; an invented italic quote without quote
   marks passes; meaning reversed by an adjacent sentence; a linked rendering
   inside a misleading sentence; a duplicate `chunked` transfer-encoding is
   refused; transport mutants M16b, M18d, M38 and M39 survive.
6. The homepage marks engine rows by manifest `source`, not the
   `engine: true` marker; a brief's `revenueModel` is not figure-checked;
   compiled How-it-works text keeps MDX backslashes in JSON-LD (cosmetic,
   pre-existing); a ban on `<`/`>` in writer text is an owner option (the
   JSON-LD sink is now escaped).
7. Timing tests owned by other suites can fail under extreme parallel load;
   R16 still allows pages that take about 1 s to audit.

**Not run**

8. Source and editorial inspection of live pages, and rendering of new
   drafts (none exist). A live, authenticated tab-through of the member views
   with a seeded draft (render tests and axe scans cover the states; §6).
   Production deploy, seed, publication and Convex rollout (out of scope).

**Repository and process**

9. The repair branch `claude/wp54-pr71-remediation` is local only. Nothing
   was pushed, merged, published, seeded or deployed, and PR #71's remote
   head is unchanged at `1c7240b`. The independent Codex review needs this
   branch: push it on the owner's instruction or review it locally.
10. `main` moved to `6f8a259` (PR #91–#93) after PR #71's base. PR #71 needs
    its own `main` sync before any merge; `main` was not merged into this
    repair.
11. PR #83 (WP45, head `5b08304`, open) overlaps S1–S3 in intent and was not
    touched. The owner decides how the two packages reconcile.
12. The three legacy v1 records and their `engine-draft-*` drafts stay as
    history and fail `audit:idea` with the legacy message; no v2 record
    exists to rebuild them from.
13. Project `CLAUDE.md` still says idea highlights are written by
    `/publish-idea`; engine pages now generate them (not edited here). The
    gstack `browse` daemon cannot start on this machine (its Playwright
    Chromium build is not installed); source checks used the locally
    installed headless Chromium instead. An untracked
    `convex-backup-before-wp46.zip` in the main checkout belongs to another
    session.
