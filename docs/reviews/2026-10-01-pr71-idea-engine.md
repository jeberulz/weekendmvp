# PR #71 — Idea Engine pre-merge review

Reviewed 2026-10-01. PR: https://github.com/jeberulz/weekendmvp/pull/71

Head: `b258ebb3ff3ec7dc84a232a2505039a0b0741b12`. Base reported by GitHub: `7c4fdc3a4493a4a0e1452236912dca561fad0d6d` (`main`). Lane: Gate. Review branch: `codex/review-idea-engine-pr71`.

## Verdict: NO-GO

The operator-only CLI, explicit live/fixture modes, deterministic compiler, committed research records, provider cost controls, draft separation and connection-time SSRF checks are useful foundations. This does not need a wholesale rewrite. However, the new evidence gates do not yet justify making the engine the required publishing path. The passing live sample itself contains unverified claims, and adversarial edits pass the deep auditor. There are also source-reader robustness and existing-catalogue migration defects.

No application code was changed, no live paid research was run, and nothing was seeded, published, pushed or merged. Independent reviewers examined source-fetch security, research grounding, and compiler/auditor correctness. All findings below were checked against the reviewed source; the principal reproductions were also rerun by the lead reviewer.

## Findings

### F1 — P1: Reject unverified evidence before writing factual prose

Location: `lib/engine/pipeline.ts:1293–1311`; `lib/engine/compile.ts:413–421`.

Quote verification happens after synthesis. The compiler removes blockquotes marked `verified: false`, but keeps the narrative that synthesis already wrote using those claims. Meeting the minimum of two other verified signals lets the entire record proceed.

This is visible in the supposedly passing sample: `engine/drafts/engine-draft-ai-code-reviewer.mdx:14` asserts 47 PRs on a team of 8, and 60% of time reviewing versus 25% coding. The corresponding signals in `engine/records/ai-code-reviewer.json:118–131` are marked `verified: false`. The deep audit still passes with 3,195 words. These claims are unverified, not established to be false; the defect is that the engine publishes them as established evidence despite its own rejection.

Fix: extract and verify evidence before prose synthesis, then give the writer only accepted claims and source spans. Alternatively, invalidate and regenerate all prose dependent on rejected evidence. Add a regression combining valid and rejected signals and assert that rejected facts cannot survive as paraphrases.

### F2 — P2: Validate complete quotes together with their attribution

Location: `scripts/audit-idea-mdx.mjs:501–515`.

The auditor accepts either-direction substring matches between a rendered quote and a verified record quote. It does not compare the rendered attribution URL with the record's citation. Starting from the passing code-reviewer draft, both of these independent mutations still return `ok: true`, with no errors:

- Append “This product increased our engineering revenue by nine million dollars overnight.” inside a verified quotation.
- Change its Hacker News attribution URL to `https://example.org/fake-source`.

This affects the supported postcompile polishing workflow; rerunning the audit gives a false assurance of verified provenance. Parse the quote and its attribution together. Require complete normalized equality, or implement deliberate excerpt validation in the safe direction, and require the correct source URL. Mutate an authentic quotation and its URL in separate regression tests.

### F3 — P2: Removing seed input does not remove already-published drafts

Location: `scripts/seed-convex.mjs:189–200`, in combination with the new guard at `app/ideas/[slug]/page.tsx:179`.

The PR removes the three draft manifest entries and filters future seed input. `convex/seed.ts` only upserts supplied rows. It does not remove or retire omitted rows, and `convex/ideas.ts:list` and the hub queries still return those existing documents. The new idea-page guard refuses to render them. On an already-seeded deployment this leaves visible cards pointing to unavailable pages. The September 24 ruling explicitly records these drafts as public, so this is an existing-data transition, not just a hypothetical fresh-database case.

A disposable `convex-test` reproduction seeded `engine-draft-ai-code-reviewer`, reseeded a batch containing only `ordinary-idea`, and confirmed `api.ideas.list` still returned the draft. This used no live database. The temporary probe was removed after verification.

Fix: enforce draft exclusion consistently at discovery boundaries and provide an explicit retirement/reconciliation plan for existing rows. Preserve existing user saves/plans under the repository's soft-delete rules. Do not assume a seed run deletes omitted records or run a production cleanup implicitly.

### F4 — P2: Bound source responses while streaming

Location: `lib/engine/providers/sourceText.ts:249–260`.

The new HTTP transport stores every response chunk and concatenates the complete body. Later truncation of extracted text does not bound network response memory. A source selected through search can send a large response within the timeout, and concurrent citation reads multiply the allocation.

A hermetic transport test returned 64 chunks of 1 MiB; the reader accepted all 67,108,864 bytes. No network traffic was used. Add a streamed byte counter and destroy/reject the request above a conservative limit; reject an excessive Content-Length early as an optimization. Bound concurrency and preserve ordinary best-effort source failure handling. The byte counter, rather than the header alone, is the security boundary.

### F5 — P2: Numeric membership is not factual grounding

Location: `lib/engine/pipeline.ts:499–505, 520–522`.

The new validators match bare numbers without their units, magnitude, period or relationship to the named competitor. Reproductions accepted:

- `$20,000/month` against `$20,000/year`.
- `$1.4 billion` against `$1.4 million`.
- Loopio at `$30/month` from “Loopio costs $20,000/year while Qvidian costs $30/month.”

An offline fixture run changing only synthesis output also accepted a `$2024 billion` market figure on the strength of the source's year `2024`. This missing guarantee predates the PR; the finding is that its newly introduced grounding gate does not establish the factual assurance claimed for the engine-default switch.

Fix: preserve source spans with structured entity, amount, currency, magnitude and billing period. Validate each claim as a unit against its supporting span. If ambiguous, fail closed or mark it explicitly for human review rather than labeling it grounded.

### F6 — P2: Recompute displayed ARR in the auditor

Location: `scripts/audit-idea-mdx.mjs:466–477`.

The compiler computes ARR, but the final audit checks only the presence/format of the line and its tier name. Changing `45 × $100/mo = $54,000 ARR` to `45 × $100/mo = $5,400,000 ARR` in the passing draft still passes the deep audit. Compare displayed operands, ARR and downside with the record's computed values. This matters because the skill permits postcompile edits.

### F7 — P2: Handle HTTP 205 and reject response-construction errors

Location: `lib/engine/providers/sourceText.ts:259–260`.

HTTP 205 is also a bodyless status. The code supplies an empty Buffer because it handles only 204/304/HEAD. `new Response(...)` throws `Response constructor: Invalid response status code 205`. Construction happens in the asynchronous `end` listener without a catch, so the error escapes the promise rather than becoming a best-effort unreadable-source result. A hermetic 205 reproduction produced an uncaught exception and an unresolved top-level await.

Fix the null-body statuses and catch/reject construction failures within the listener. Add a transport-level test, not just a mocked Fetch Response test.

## Additional hardening

- **Redirect credential handling:** `sourceText.ts:293–303` reuses Reddit's bearer header across origins and permits HTTPS-to-HTTP redirects. A mocked OAuth response followed by a mocked redirect to `http://public-attacker.example/collect` sent a dummy bearer token to that destination. Strip credentials on origin changes and reject authenticated downgrades. No actual Reddit open redirect was established, so this is conditional hardening rather than a demonstrated external credential exploit.
- **Integer account counts:** `research-record.ts:268` rounds `payingAccounts: 0.4` to zero after validating positivity. The downside clamp at `compile.ts:216` then makes a zero-account base case have a one-account downside. Require positive integer counts and ensure downside revenue cannot exceed the base. The normal pipeline's later record parsing may reject a rounded zero; direct parser/compiler helpers still violate their own invariant.
- **Design:** split acquisition, accepted evidence, and editorial synthesis into explicit stages. Keep exact evidence spans and fetched-source hashes/timestamps in records, so reviewers can replay verification. A shared canonical quote/financial representation should drive compilation and final auditing; divergent regex checks are already drifting.
- **Quality evaluation:** the gold-page eval audits three existing handwritten pages. It is useful regression coverage but does not measure new engine quality. Add adversarial evidence fixtures and stable saved provider responses, then measure the actual research → compile → audit path. Do not substitute word count for usefulness, source credibility, or weekend-build feasibility.

## Verification

| Check | Result |
|---|---|
| `npm ci --ignore-scripts` | Pass; isolated installation |
| `npm run typecheck` | Pass |
| `npm run lint` | Pass: 0 errors, 35 warnings |
| `npm test` | Pass: 1,301 tests, including 108 engine tests |
| `npm run build` | Pass |
| `npm run check:server-traces` | Pass |
| `npm run validate:idea-tags` | Pass: 225/225 |
| `npm run engine:eval` | Pass: 3/3 existing gold pages; not a new live research run |
| Code-reviewer draft deep audit | Pass, despite F1; 3,195 words |
| RFP draft deep audit | Fail: `https://rfp.ai/` used for two competitors |
| Ecommerce draft deep audit | Fail: generic schema, unit economics, missing Year-One Math, unverified quotes |
| Adversarial quote/URL/ARR probes | Incorrectly accepted; see F2/F6 |
| Existing-draft reseed probe | Confirmed stale public listing; F3 |
| 64 MiB source / HTTP 205 / redirect probes | Confirmed behaviors described above |
| Local production server | Draft and nonexistent idea routes returned 404; no live-backend catalogue claim |
| `git diff origin/main...HEAD --check` | Two trailing-whitespace lines in `artifacts/quote-gate-live-verification.md` |

The PR head was rechecked and remained `b258ebb`. GitHub CI and Vercel reported success; CodeRabbit was pending at the time checked. No fresh paid-provider run was performed, so the PR's historical live outcomes were not independently reproduced against current providers. The recorded successful live research run predates the latest price-validator change. Stored drafts can prove compiler/auditor behavior; they cannot prove current live research success.

## Conditions for a GO

1. Fix F1–F7 with regressions that fail on this reviewed head and pass with the fixes.
2. Resolve the documented competitor-source mix-up and quote-fidelity failures. Run the representative three-brief research/compile/audit set against the final head, preserving provider responses/evidence and honest failure output.
3. Review source accuracy and product usefulness in those outputs, not just auditor status. Agree any smaller acceptance set explicitly; the current documents disagree about one versus three successful briefs.
4. Verify the existing-draft transition with a seeded disposable backend and confirm public catalogue links resolve after deployment.
5. Repeat the standard gate on the final revision, and keep production activation separate.

Docs updated: this review report. Product instructions, source code and production data were not changed during the review.
