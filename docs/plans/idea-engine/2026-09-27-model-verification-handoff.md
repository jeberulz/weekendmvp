# Research models and verification — S3–S6 integration handoff

Status: recommendation for the concurrent implementation branch, not implemented provider behavior. PR83's focused repair changes evidence and quote binding only. Do not describe this engine as production-ready until the completion-plan gates pass.

## What is running now

At PR83 `3100f29`, discovery uses Perplexity `sonar-pro`, keyword metrics use DataForSEO, and synthesis uses OpenAI `gpt-5.6-sol` through Responses. `providers/pricing.ts` supplies a single synthesis rate card; `providers/openai.ts` has no separately configured verifier role or explicit reasoning effort. The seven-step pipeline performs deterministic grounding checks, not independent semantic entailment. A search answer is discovery material, not proof. A page containing matching words/numbers does not establish that the page asserts the proposed fact.

The current writer is already a capable model. The highest-value addition is an independent claim-verification stage with its own contract, evidence inputs and evals. Replacing the writer with a more expensive model alone cannot fix source attribution, unavailable pages, stale prices, misleading units, or publication authorization.

## Recommended role routing

| Role | Initial choice | Boundary |
| --- | --- | --- |
| Discovery | Keep existing Sonar Pro adapter | Find primary sources and counterevidence; never certify its own answer. |
| Keyword demand | Keep DataForSEO | Persist returned measurement, geography, date and unavailable states; no model-generated volume. |
| Extraction / canonicalization | Deterministic code first | Preserve source identity, exact text, hash and offsets; an optional smaller model may propose fields but cannot approve them. |
| Writer | Keep `gpt-5.6-sol` as the measured baseline | Use approved facts and labelled assumptions; cannot alter claim verdicts or publish. |
| Independent claim verifier | Evaluate `gpt-6-astra`, explicit `reasoning.effort: high` | Read claim plus fetched evidence and contradiction context, without the writer's confidence or scoring rationale. Return a bounded structured verdict. |
| Opportunity assessment | Separate verifier/assessment invocation | Buyer, recurring pain, workaround, willingness-to-pay evidence, distribution, differentiation, downside; accept/research-more/reject with evidence IDs. |
| Final approval | Super admin | Read full draft and material source evidence; approve the exact revision; publication is a separate authorized action. |

GPT-6 Astra is an available API model with Responses, structured outputs, and high reasoning support according to the [official model documentation](https://developers.openai.com/api/docs/models/gpt-6-astra), checked 2026-09-27. Account access and behavior still require a bounded live smoke. This routing is a proposed experiment, not evidence that Astra has passed this project's quality bar. Independent calls reduce self-approval; they do not guarantee independent errors. A second vendor is optional only if a held-out comparison shows a useful error reduction.

Do not implement an arbitrary model environment variable while retaining Sol's prices. Model ID, supported options, context limits and dated rate card must be one allowlisted configuration. Persist requested/returned model identity, reasoning effort, prompt/schema/policy versions, token usage, reservation, settled or unknown cost. If a dated model snapshot becomes available, evaluate and pin it. A model upgrade requires the same gate as a prompt change.

## Bounded workflow to implement inside the existing pipeline

1. Deduplicate buyer/job against the catalogue before paid research. Assign run ID, immutable brief version and a batch/run budget.
2. Discover supporting AND disconfirming sources with bounded calls. Fetch actual source pages through the existing restricted reader. Mark access failures explicitly; do not search indefinitely to force an answer.
3. Create atomic claims: subject, predicate, value, unit/currency, billing period, geography, population and observation date. Separate observed, derived and assumed claims. Derived claims retain formula and input claim IDs.
4. Bind proposed support to a fetched source hash and exact excerpt/offsets. Validate identities, amounts, units, dates and quotation text in code. Ambiguous lexical matches remain unresolved. Source retrieval date alone is not the observation date.
5. Send the verifier only bounded evidence, typed claim, relevant surrounding context and contradictory passages. Treat all source text as untrusted data; give this stage no arbitrary tool/network/filesystem access. Require a schema with claim ID, supported/contradicted/insufficient verdict, exact evidence spans and a concise reason. Refusal, truncation, malformed schema, unknown IDs or absent spans are insufficient evidence. Validate spans against the source server-side. A model verdict cannot override a hard mismatch or turn search-only text into page verification.
6. Assess the opportunity separately. Fetch failure means needs_research, not no demand. Reject generic ideas without a specific buyer/job and credible advantage. No single aggregated score can override a failed evidence gate.
7. Write from the resulting fact ledger. Any new factual statement in the draft must bind to a claim and pass verification, or be explicitly labelled as assumption/scenario. Re-extract claims after writing to catch unsupported additions; exact quotes bypass creative rewriting. Derive highlights from the same ledger.
8. Compile private drafts, audit MDX/destinations/tags/claims, then present all evidence and wording to the super admin. Approval binds record hash, draft hash, claim/source versions and policy. Any edit invalidates approval. Promotion rechecks current receipt and freshness; neither a model nor an automated retry can publish.

Use a fixed, bounded workflow rather than autonomous agents repeatedly debating until one says yes. At most one explicit research-more round within the remaining budget; otherwise persist the unresolved result. Model disagreement is a review signal, not a majority vote for publication. The same model in two roles must not share conversation state that contains the writer's preferred conclusion.

## Integration boundaries and acceptance checks

- **S3:** per-role allowlisted config/rate cards, timeouts, conservative reservation before dispatch, missing usage and interrupted calls remain unknown-cost reservations; include verification in the existing $4 estimate-based run cap and batch cap. No cheap-model fallback that silently changes verification policy. Persist redacted failures and resumable stages with input/policy hashes; do not replay paid success blindly.
- **S4:** typed fact ledger, verifier contract, independent assessment, approved-claim-only writing, contradiction search and unknown handling. Deterministic source-presence checks in S2 are not a semantic fact-checking certification. Mandatory material claims that cannot be supported prevent acceptance.
- **S5:** compare Sol baseline with Astra verification on the same frozen, human-labelled cases; retain held-out cases. Report unsupported accepted facts, misattribution, contradiction recall, false rejection, evidence coverage, decision confusion matrix, cost and latency. Include swapped subject/value, negation, projected versus observed, parent-company versus product, annual versus monthly, wrong geography/year, stale prices, copied sources, unavailable pages, source prompt injection and draft-added facts. Do not optimize only for attractive prose or word count. The existing 12-case set is a regression gate, not statistical proof of quality.
- **S6:** hash-bound human review and promotion, per-run audit trail, replay tests, production runbook and kill switch. A stronger verifier never bypasses deterministic gates or human approval.

Before enabling live operation: pass the completion-plan hermetic evaluation and full repo checks, then the explicitly budgeted live-smoke matrix with independently reviewed accepted drafts and appropriate rejects. No paid calls were made for this handoff. Keep publication blocked until this evidence exists. Monitor post-launch unsupported-claim corrections, source failures, rejection rates and unknown spend; pause promotion on regressions.

## Coding-agent handoff

Continue S3–S6 on your existing branch. Integrate the focused PR83 repair commit before modifying evidence/quote helpers. Preserve both regression suites. Implement the role contract and budget accounting together; do not add a new paid verifier without reserving its worst-case spend. Start with fixture replay and mocked provider contracts, then request the planned live smoke only when credentials and accounting are ready. Keep a high-capability review for security, evidence logic, model policy and promotion; use a cheaper coding agent for contained UI, plumbing and mechanical tests. Report implemented behavior separately from recommendations and unrun live checks.
