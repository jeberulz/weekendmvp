# Candidate research: AI Automation Client Handoff Pack

Date: 2026-10-03

Lane: Gate (candidate validation; no public content or production data change)

Status: **Editorial draft candidate, not approved for publication**

## The idea

An independent automation builder or small agency delivers an n8n, Make, or similar workflow to a business. The workflow works on delivery day, but the client does not know which settings they may change, who owns each account, how to spot a failure, or where the agency's support obligation ends. The product turns a short, structured intake into a client-readable handoff pack: purpose and inputs/outputs, owner and credential *locations* (never secret values), editable settings, common failure modes, escalation owner, acceptance tests, support boundary, and change log. The client can acknowledge the exact delivered version. Start with manually entered facts and a branded PDF/share link; importing workflow JSON and live monitoring are later possibilities, not weekend-MVP promises.

**Buyer:** a solo automation consultant or agency with several small-business clients.

**Job:** close a delivery cleanly, reduce repeat support questions, and make ownership understandable to a nontechnical client.

**Working title:** “AI Automation Client Handoff Pack.”

**Weekend build:** intake form, required-field checklist, editable preview, PDF/shareable export, version number, and client acknowledgement. No agent runtime, credentials vault, or compliance certification.

Discovery seed: Ideabrowser idea #8943's public teaser. Its scoring and unverified research claims were not used as evidence; the analysis below relies on separately checked sources.

## Why this candidate

- A practitioner asking how to hand over n8n workflows received an agency operator's description of documentation, a video walkthrough, client-owned credentials, and backup exports. This is direct evidence of a manual workaround, not a measure of market size. [n8n practitioner discussion](https://www.reddit.com/r/n8n/comments/1n4s57n/how_do_you_hand_off_n8n_workflows_to_clients/).
- In a separate discussion, a workflow builder described a labelled client-settings node and a one-page document covering triggers, outputs, likely breakages, and changes; the author said the process followed too many post-delivery support requests. The thread also shows another founder building a client portal, so the gap is contested. [n8n handoff discussion](https://www.reddit.com/r/n8n/comments/1s10m5n/what_i_send_clients_when_i_hand_off_an_n8n/).
- Microsoft's 2026 Work Trend Index reports that documented, repeatable agent workflows and human handoffs are more common among its self-identified advanced AI users than others: 26% versus 19% at team level, 29% versus 17% at function level, and 25% versus 14% at organization level. These are survey associations, **not** counts of agencies wanting to buy this product. [Microsoft 2026 Work Trend Index](https://www.microsoft.com/en-us/worklab/work-trend-index/agents-human-agency-and-the-opportunity-for-every-organization).
- McKinsey's 2025 AI survey reports 23% of respondents' organizations scaling agents in at least one function and another 39% experimenting. This is context for timing, **not** the addressable market for handoff software. [McKinsey State of AI 2025](https://www.mckinsey.com/capabilities/quantumblack/our-insights/the-state-of-ai-2025).
- NIST's voluntary AI risk framework calls for clear human roles and oversight procedures around AI systems. A small agency's handoff pack can make those responsibilities explicit without claiming NIST certification. [NIST AI RMF Govern playbook](https://airc.nist.gov/airmf-resources/playbook/govern/).

The idea is distinct from three nearby Weekend MVP entries: **AI Agency Automation Control Panel** covers multi-client deployment, error monitoring, usage billing, and ROI; **AI Agent Workflow Platform** is an execution runtime; **AI Coding Agent Dashboard** aggregates coding-agent activity. The proposed first version is a delivery artifact and acknowledgement flow, with no monitoring or execution. This is a narrow wedge, but an agency that already uses the control-panel idea could still use a handoff pack.

## What buyers use today

| Alternative | Verified offer and current public price | Implication |
| --- | --- | --- |
| Scribe | Captures and shares process guides; Pro Personal is **$35 per user/month** and Pro Team is **$85/month for up to five users**, according to Scribe's billing example. [Scribe invoice guide](https://support.scribehow.com/hc/en-us/articles/30267942021021-Understanding-Your-Scribe-Invoice) | Excellent visual walkthroughs, but the owner, failure, support, and acceptance fields are not the core product. |
| Whale | AI-assisted SOPs and training; Scale is **$249/month billed yearly**. [Whale pricing](https://usewhale.io/pricing/) | Proves teams pay for documentation systems; likely too broad and costly for an occasional small-agency handoff. |
| AgentOps | Agent tracing and cost monitoring; free tier, Pro starts at **$40/month**. [AgentOps pricing](https://www.agentops.ai/) | Useful technical operating evidence, but it is a developer observability tool rather than a client-readable transfer pack. |
| DIY documents and video | Agency operators describe a document, walkthrough, exported workflow, and credential handoff. [n8n practitioner discussion](https://www.reddit.com/r/n8n/comments/1n4s57n/how_do_you_hand_off_n8n_workflows_to_clients/) | The strongest substitute is a reusable Notion/Google Docs template, not another SaaS vendor. |

These prices show spending on **adjacent** jobs. They do not establish willingness to pay for this exact product. A client-settings portal mentioned in the second practitioner thread is a nearer competitive threat; its pricing and traction were not independently verified.

## First build and business hypothesis

The agency fills a guided form for one delivered workflow. Required fields are: client owner, agency owner, purpose, trigger, outputs, editable settings, external accounts and who owns them, alert location, three likely breakages and recovery steps, acceptance tests, change-request boundary, and support contact. A pack cannot be marked ready while a required field is unknown. Secret values are never accepted. The client receives a read-only link and can acknowledge a specific revision; later edits create a new version. An export contains the same information in PDF and Markdown so the agency can hand it over even if this service disappears.

**Pricing is a test assumption:** a free sample pack, then either $29 per completed handoff or $39/month for agencies doing several deliveries. The product should not present either price as a market-validated benchmark. A one-off fee may fit irregular project volume better than a subscription; interviews must decide. At $29 per pack, 10 paid packs/month would be $290 monthly revenue before payment fees and support. That arithmetic is a scenario, not a forecast. The cost structure should stay simple: no LLM is needed to produce a useful first pack, and any later AI drafting must be reviewed by the agency before client delivery.

**Weekend test:** interview five builders who delivered an automation to a paying client in the past six months. Ask to see a redacted actual handoff and the follow-up support questions; do not ask only whether they “like” the concept. Offer the structured pack to three of them for their next real delivery. Continue only if at least two complete a pack, a client uses or acknowledges it, and at least one builder pays or commits to pay for the next pack. If all three prefer their current document template or none has a delivery soon, treat this as `needs_research` and narrow or stop.

## Claims still unproven

- How often small agencies deliver a new workflow, and therefore whether a subscription would be used.
- The actual number of support hours avoided by a standard handoff; no savings percentage should appear in the article.
- Whether clients want to acknowledge a handoff through a new portal, or whether a PDF attached to an existing email is sufficient.
- Whether credential and support-boundary fields create legal/commercial friction that outweighs convenience.
- Whether Scribe, Whale, an agency's template, or the emerging client-settings portal already solves enough of the job.

**Editorial decision:** proceed to a source-backed article draft as a *testable opportunity*, with prices and unit economics labelled as assumptions. Do not describe it as a validated market, claim that handoff software is uncontested, or release it from the admin while WP46-E5–E7 remain unfinished. The user should review the exact article and sources before the current Git-backed publication path is used.
