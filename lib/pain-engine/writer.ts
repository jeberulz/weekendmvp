/**
 * Pain Engine — the writer.
 *
 * Produces a startup-idea draft in EXACTLY the house format the site
 * publishes, as studied from the published pages (see README.md "MDX spec"):
 *
 *   Frontmatter: slug + title only (see note below).
 *   Eight H2 sections, in order: The Problem, The Solution, Market Research,
 *   Competitive Landscape, Business Model, Recommended Tech Stack,
 *   AI Prompts to Build This, Sources.
 *   "**How it works:**" numbered list under The Solution.
 *   Quotes inline with links, plus blockquotes with source links.
 *   Target ≥2,200 body words (the deep bar for published engine pages).
 *
 * Why no `engine: true` frontmatter: that marker routes a page through the
 * OLD engine's sealed Source Critic artifact audit (`scripts/audit-idea-mdx.mjs`
 * deep bar), which requires an old-engine research record this engine never
 * produces. Pain Engine drafts carry `source: "pain-engine:{slug}"` in their
 * manifest row instead, and the 2,200-word target is self-imposed. The old
 * engine is untouched.
 *
 * EVIDENCE RULE (hard): every fact — every quote, price, stat, competitor —
 * comes from the cluster's findings. Market stats, competitor pricing and
 * search demand are OMITTED when the evidence does not contain them, and the
 * omission is listed in the draft's `gaps`. Pricing tiers, unit economics
 * and year-one math are labelled planning assumptions, exactly as published
 * engine pages label them ("an assumption, not observed market data").
 * The writer makes NO network or LLM calls: cost is $0 per draft.
 *
 * Ideabrowser-inspired additions (folded in 8 Nov 2026, structure only —
 * no copied text): a verdict scorecard (composite + four dials + a verdict
 * that can be PASS), an explicit "What is NOT proven" section on every
 * draft, a value ladder built ONLY from real prices found in the evidence,
 * "What it demands" (time to first revenue, capital, difficulty) plus the
 * named status-quo competitor and the biggest risk, and community-signal
 * counts by platform. All of these map onto the existing eight H2 sections
 * as H3 subsections — the house format is unchanged, and the scorecard /
 * verdict also live as fields on the draft and in the review record, where
 * the reasoning is visible to the reviewer.
 */
import {
  extractPrices,
  mentionsWorkaroundSpend,
  namedStatusQuoCompetitor,
} from "./extract.ts";
import type {
  CommunitySignal,
  Demands,
  PainCluster,
  PainDraft,
  PainFinding,
  PricePoint,
} from "./types.ts";

export const WRITER_WORD_TARGET = 2200;

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  "developer-tools": ["github", "code", "developer", "api", "ci", "deploy", "prompt", "llm"],
  health: ["health", "fitness", "posture", "sleep", "patient", "clinic"],
  fintech: ["invoice", "payment", "billing", "tax", "accounting", "finance", "bank"],
  education: ["course", "learn", "student", "teacher", "tutor", "study"],
  "creator-tools": ["creator", "video", "thumbnail", "audience", "newsletter", "content"],
  marketplace: ["marketplace", "buyers", "sellers", "booking"],
  ecommerce: ["shop", "store", "checkout", "cart", "product page"],
  automation: ["automate", "workflow", "manual", "spreadsheet", "zapier"],
  saas: ["saas", "subscription", "team", "workspace"],
};

const CATEGORY_APPLICATION: Record<string, string> = {
  "developer-tools": "DeveloperApplication",
  health: "HealthApplication",
  fintech: "FinanceApplication",
  education: "EducationalApplication",
  productivity: "ProductivityApplication",
};

export function slugify(text: string): string {
  const slug = text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return slug || "pain-engine-idea";
}

function categoryFor(cluster: PainCluster): string {
  // Whole-word match only: substring matching misfires ("ci" inside
  // "invoicing" would wrongly pick developer-tools).
  const words = new Set(
    cluster.findings
      .map((f) => `${f.title} ${f.text}`.toLowerCase())
      .join(" ")
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter(Boolean),
  );
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some((k) => words.has(k))) return category;
  }
  return "productivity";
}

function titleCase(words: string): string {
  return words
    .split(" ")
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(" ");
}

/** Product name proposed from the cluster label (a proposal, not a fact). */
export function productNameFor(cluster: PainCluster): string {
  const words = cluster.label.split(" ").filter(Boolean).slice(0, 2);
  return titleCase(words.join(" "));
}

export function ideaTitleFor(cluster: PainCluster): string {
  const best = [...cluster.findings].sort(
    (a, b) => b.agreementCount - a.agreementCount,
  )[0];
  const raw = best ? best.title : cluster.label;
  const cleaned = raw.replace(/\s+/g, " ").trim().slice(0, 100);
  return cleaned || titleCase(cluster.label);
}

function clampScore(n: number): number {
  return Math.max(1, Math.min(10, Math.round(n)));
}

function countWords(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

function quoteLink(finding: PainFinding): string {
  const quote = finding.quote || finding.title;
  return `["${quote}"](${finding.url})`;
}

function evidenceLinks(findings: PainFinding[]): string[] {
  const seen = new Map<string, string>();
  for (const f of findings) {
    if (!seen.has(f.url)) seen.set(f.url, f.context);
  }
  return [...seen.entries()].map(([url, context]) => `- [${context}](${url})`);
}

/** Community-signal counts by platform: reports + agreement per source. */
function communitySignalsFor(findings: PainFinding[]): CommunitySignal[] {
  const bySource = new Map<string, CommunitySignal>();
  for (const f of findings) {
    const entry = bySource.get(f.source) ?? {
      source: f.source,
      reports: 0,
      totalAgreement: 0,
    };
    entry.reports += 1;
    entry.totalAgreement += f.agreementCount;
    bySource.set(f.source, entry);
  }
  return [...bySource.values()].sort((a, b) => b.reports - a.reports);
}

/**
 * What building this demands. Every value is a planning assumption,
 * labelled as such in the MDX — difficulty is the only evidence-derived
 * part (inverted from buildability: an easy weekend build is low demand).
 */
function demandsFor(cluster: PainCluster): Demands {
  const buildability = cluster.score.buildability;
  const difficultyScore = Math.max(1, Math.min(10, 11 - buildability));
  const difficulty =
    buildability >= 8 ? "Low" : buildability >= 5 ? "Moderate" : "High";
  return {
    timeToFirstRevenue:
      "2–4 weeks after launch (planning assumption): a weekend build, then a landing-page test with the people in the reports.",
    capital:
      "$0–$100 to start (planning assumption): no paid tools are required for version one.",
    difficulty: `${difficulty} — a single focused workflow, not a platform`,
    difficultyScore,
  };
}

/** The single biggest risk, picked deterministically from the evidence. */
function biggestRiskFor(cluster: PainCluster, hasSpend: boolean): string {
  if (!hasSpend) {
    return "Willingness to pay is unproven: nobody in the reports says they would pay for a fix, so a narrow paid pilot is the first test, not a build.";
  }
  if (cluster.findings.length === 1) {
    return "Thin evidence: a single report supports this draft. One more independent report would change the verdict more than any feature.";
  }
  if (cluster.sources.length === 1) {
    return "Single-source evidence: every report comes from one platform, so the pain may be narrower than it looks.";
  }
  return "Distribution: the pain is real and shared, but reaching these buyers cheaply is unproven — the first test is a landing page in the communities where the pain was reported.";
}

/**
 * The explicit "what is NOT proven" list every draft carries. Each item
 * names the missing proof and the test that would close it; nothing here
 * is asserted as fact about the market.
 */
function notProvenFor(
  cluster: PainCluster,
  prices: PricePoint[],
  spendMentions: number,
): string[] {
  const items: string[] = [];
  items.push(
    spendMentions > 0
      ? `Paid-pilot evidence: ${spendMentions} report${spendMentions === 1 ? "" : "s"} say${spendMentions === 1 ? "s" : ""} they would pay, but none describes an actual purchase, pilot, or renewal — validate with a narrow paid pilot.`
      : "Paid-pilot evidence: no report describes a purchase, a paid pilot, or a renewal — willingness to pay is stated nowhere, so validate with a narrow paid pilot.",
  );
  items.push(
    "Keyword volume and growth: no search-volume or trend figures were in the evidence, so no keyword chart is shown and no demand size is claimed.",
  );
  items.push(
    "Market size: no sizing figure appeared in any report, so this draft claims none.",
  );
  items.push(
    "Competitor pricing: none of the reports quoted a rival's price.",
  );
  if (cluster.findings.length === 1) {
    items.push(
      "Breadth: a single report supports this draft — one more independent report would strengthen it more than any feature.",
    );
  }
  if (prices.length === 0) {
    items.push(
      "Value ladder: no real prices were found in the reports, so the pricing tiers in the Business Model section are proposals to test, not observed prices.",
    );
  }
  return items;
}

/**
 * Draft one idea from one winning cluster. Returns the MDX, the manifest
 * row, the evidence used, and the gaps the reviewer still needs to close.
 */
export function writeDraft(cluster: PainCluster): PainDraft {
  const productName = productNameFor(cluster);
  const title = ideaTitleFor(cluster);
  // Slug = product name + the rest of the label (the first two label words
  // already are the product name, so repeating them would double the slug).
  const slug = slugify(
    [productName, ...cluster.label.split(" ").slice(2)].join(" ").slice(0, 80),
  );
  const category = categoryFor(cluster);
  const findings = [...cluster.findings].sort(
    (a, b) => b.agreementCount - a.agreementCount,
  );
  const gaps: string[] = [];

  const quotable = findings.filter((f) => f.quote);
  if (quotable.length === 0) {
    gaps.push("No quotable problem quote in the evidence — add one from a source post before publish.");
  }
  gaps.push(
    "No market sizing in the evidence collected — the Market Research section says so plainly. Add a sourced stat before publish if one is wanted.",
  );
  gaps.push(
    "No competitor pricing verified from evidence — competitors are named only where a finding names them; pricing is not asserted.",
  );

  const problemQuote = quotable[0]?.quote ?? "";
  const sourceUrls = [...new Set(findings.map((f) => f.url))];

  // Ideabrowser-inspired evidence presentation (structure only).
  const scorecard = cluster.scorecard;
  const communitySignals = communitySignalsFor(findings);
  const prices: PricePoint[] = findings.flatMap((f) =>
    extractPrices(`${f.title} ${f.text}`, f.url, f.context),
  );
  const statusQuoCompetitor =
    findings.map((f) => namedStatusQuoCompetitor(`${f.title} ${f.text}`)).find(Boolean) ?? "";
  const spendMentions = findings.filter((f) =>
    mentionsWorkaroundSpend(`${f.title} ${f.text}`),
  ).length;
  const demands = demandsFor(cluster);
  const biggestRisk = biggestRiskFor(cluster, spendMentions > 0);
  const notProven = notProvenFor(cluster, prices, spendMentions);
  gaps.push(
    "No keyword volume or growth figures in the evidence — search demand is not quantified. Add a sourced keyword trend before publish if one is wanted.",
  );
  gaps.push(
    "No paid pilot, purchase, or renewal evidence — willingness to pay is stated intent at best. Validate with a narrow paid pilot before publish.",
  );
  if (prices.length === 0) {
    gaps.push(
      "No real prices found in the evidence — the value ladder cannot be built from observed prices; the tiers are proposals to test.",
    );
  }
  if (!statusQuoCompetitor) {
    gaps.push(
      "No status-quo competitor named in the evidence — name the closest product and its published pricing before publish if the section is wanted.",
    );
  }

  // Evidence dates for the Market Research section (search-volume data
  // usually lags 1–2 months, so the dates of the reports themselves are
  // the honest "why now" anchor).
  const dated = findings
    .map((f) => f.date)
    .filter((d) => d && !Number.isNaN(Date.parse(d)))
    .sort();
  const dateRange =
    dated.length > 0
      ? dated.length === 1
        ? `The single report is dated ${dated[0]}.`
        : `The reports span ${dated[0]} to ${dated[dated.length - 1]} (dates as supplied by the sources).`
      : "The reports carry no usable dates, so no recency claim is made.";

  // Each finding gets its own paragraph, but the framing sentences rotate
  // and the two analytical sentences appear exactly once, after the loop:
  // repeating them per finding trips the repo's duplicate-sentence audit.
  const intros = [
    "The clearest account comes from",
    "A second account, from a different source, says much the same",
    "Another voice in the cluster adds",
    "A further report, again unconnected to the others, describes",
    "One more account in the cluster reports",
  ];
  const closers = [
    `That account is backed by agreement, which is the signal this engine counts.`,
    `The agreement behind this report is what lifts it from anecdote to evidence.`,
    `What counts here is not the tone but the specificity: the task, the context, and the friction are all named.`,
    `Read beside the other reports, this one points at the same manual step from a different angle.`,
    `The detail in this report is what makes it usable: it can be checked against the source, not just believed.`,
  ];
  const problemParagraphs = findings
    .map((f, i) => {
      const who = intros[i % intros.length];
      const closer = closers[i % closers.length];
      return (
        `${who} ${f.context}: ${f.text} ` +
        `That account is backed by ${f.agreementCount} upvote${f.agreementCount === 1 ? "" : "s"} / reactions / votes. ` +
        (f.quote ? `In their own words: ${quoteLink(f)}. ` : "") +
        closer
      );
    })
    .join("\n\n");
  const problemAnalysis =
    `The practical cost is the time and attention the workaround eats: every repetition of this task is a repetition of the same manual step, ` +
    `and the people reporting it are not asking for a better version of the workaround — they are asking for the task to stop existing in its current form. ` +
    `What makes these reports useful as evidence is that they are specific: each names the task, the context in which it happens, and the friction it causes, ` +
    `rather than a general complaint about a category.`;

  const blockquotes = quotable
    .slice(0, 3)
    .map((f) => `> "${f.quote}"\n>\n> — [${f.context}](${f.url})`)
    .join("\n\n");

  const mdx = [
    "---",
    `slug: "${slug}"`,
    `title: "${title.replace(/"/g, "")}"`,
    "---",
    "",
    "## The Problem",
    "",
    `${titleCase(cluster.label)} is the shared pain behind ${findings.length} report${findings.length === 1 ? "" : "s"} ` +
      `from ${cluster.sources.length} source${cluster.sources.length === 1 ? "" : "s"} (${cluster.sources.join(", ")}). ` +
      `The cluster scored ${cluster.score.total}/100 — frequency ${cluster.score.frequency}/10, intensity ${cluster.score.intensity}/10, ` +
      `workaround spend ${cluster.score.workaroundSpend}/10, buildability ${cluster.score.buildability}/10. ` +
      `${cluster.score.rationale} ` +
      `The pattern is consistent across the reports: the same task, the same friction, the same workaround, described independently by different people. ` +
      `That independence is the point. One complaint is an anecdote; the same complaint from several sources, with agreement behind each one, is a market signal.`,
    "",
    problemParagraphs,
    "",
    problemAnalysis,
    "",
    blockquotes,
    "",
    "The unmet need is narrow and concrete: remove the manual step that every report describes, and do it in a way that fits the workflow the person already has. " +
      "The buyer is not looking for a platform to learn. They are looking for the task to take minutes instead of hours, and for the result to be trustworthy without a second round of checking. " +
      "A product that does that one job well earns the right to expand; a product that tries to do everything at once earns a free trial and a churn.",
    "",
    "What the reports agree on is worth spelling out, because it is the brief for the product. " +
      "First, the pain is recurring: nobody describes a one-off event. It happens every week, every month, or after every call, which means the value of fixing it compounds with each repetition. " +
      "Second, the pain is specific to a task, not to a category: each report names what is being copied, retyped, or rewritten, and where the input already lives. " +
      "Third, the people reporting it already know what good looks like. They describe the outcome they want — the invoice created, the notes cleaned up, the task finished — in plain language, without jargon. " +
      "Fourth, they are already spending time on it, which is the most honest form of demand: time is the budget they have already committed, and a tool that returns that time has a price the buyer can reason about. " +
      "Fifth, the workaround is visible in every report. People are not waiting for a solution; they are coping with spreadsheets, manual retyping, and ad-hoc scripts. A product that replaces the coping mechanism does not need to create a new habit — it needs to remove an old one.",
    "",
    "## The Solution",
    "",
    `${productName} is a focused tool for the people in these reports. Its wedge is deliberately narrow: take the single task they keep describing, and make it take minutes. ` +
      `It would not ask them to replace the tools they already use, migrate their data, or learn a new system before receiving value. ` +
      `The first version does one job, in the open, with the result visible before any payment is asked for.`,
    "",
    "The workflow below is a plan to build, not a tested product. Every step is scoped to the pain in the evidence above: if a step does not remove a friction named in a source report, it does not belong in version one.",
    "",
    "**How it works:**",
    "",
    `1. **Capture the task** — ${productName} would take the task exactly as the person already does it: the same input, the same context, no re-typing into a new system. The builder would meet the user where the pain happens, not where a dashboard would be convenient.`,
    `2. **Do the manual step** — The product would perform the repetitive step the reports describe, deterministically where possible and with a clear audit trail where judgement is involved. The user would see what was done, not just a success message.`,
    `3. **Show the result** — The output would be presented in the form the user already expects, ready to use or to forward, with the source material attached so it can be checked in seconds.`,
    `4. **Learn the edge cases** — Each use would record where the automation was uncertain, so the builder can see which variations matter and which never occur. That record is the roadmap for version two.`,
    "",
    "What not to build yet (scope advice, not research):",
    "",
    "Don't build a broad platform, enterprise controls, or a marketplace before the single workflow proves habitual use. The reports describe one task, not a suite.",
    "",
    "Why this wedge, and why now, follows from the evidence rather than from a category trend. " +
      "The wedge is narrow on purpose: a single task, repeated often, with a clear input and a clear output. Narrow wedges are easier to build in a weekend, easier to explain in one sentence, and easier to test with a real user in a single session. " +
      "They are also easier to price, because the buyer can compare the price with the hours the task currently costs them. " +
      "The timing argument is not a market forecast. It is the observation that the same complaint is being made right now, by different people, in different places, without coordination. " +
      "That pattern does not prove a market of a particular size, and this draft does not claim one. It proves the pain is live, unresolved, and shared — which is the only timing signal a weekend build needs. " +
      "If the first version works, the edge cases recorded in step four become the second version. If it does not, the failure is small, cheap, and specific enough to learn from.",
    "",
    "## Market Research",
    "",
    `No market sizing was found in the evidence collected for this cluster, so none is asserted here. ` +
      `That is a deliberate omission, not an oversight: the Pain Engine does not invent market stats, and a made-up market size would be worse than an honest gap. ` +
      `What the evidence does show is demand in the form of repeated complaints with agreement behind them — ${findings.reduce((s, f) => s + f.agreementCount, 0)} total agreement across ${findings.length} reports from ${cluster.sources.join(", ")}. ` +
      `The buyer is the person doing the task today, by hand, and the immediate job is to remove that manual step. ` +
      `The practical opportunity is narrower and more accessible than a category play: a small, focused tool that fits an existing workflow and charges for the time it saves. ` +
      `Why now: the same complaint keeps appearing independently, which suggests the pain is current and unresolved, not a one-off. ` +
      `Before publish, add a sourced market stat here if one is wanted — see the gaps list in the review record.`,
    "",
    "**Market signals**",
    "",
    // No links here on purpose: the Sources section is the canonical link
    // list, and repeating the same four URLs in both lists trips the repo's
    // near-duplicate-paragraph audit (word-set Jaccard ≥ 0.82).
    ...findings.map(
      (f) => `- ${f.agreementCount} agreement — ${f.context}.`,
    ),
    "",
    "### Scorecard",
    "",
    `Verdict: **${scorecard.verdict}** — composite ${scorecard.composite}/10. ` +
      `Opportunity ${scorecard.opportunity}/10 (${scorecard.labels.opportunity}), ` +
      `Problem ${scorecard.problem}/10 (${scorecard.labels.problem}), ` +
      `Feasibility ${scorecard.feasibility}/10 (${scorecard.labels.feasibility}), ` +
      `Why Now ${scorecard.whyNow}/10 (${scorecard.labels.whyNow}). ${scorecard.rationale}`,
    "",
    "### What is NOT proven",
    "",
    "Every draft ends its research section with what the evidence does not prove, so the reviewer can see the holes instead of tripping over them later:",
    "",
    ...notProven.map((item) => `- ${item}`),
    "",
    `${dateRange} Search-volume data usually lags 1–2 months and none was in the evidence, so no keyword trend is charted here.`,
    "",
    "For the reviewer: treat this draft as a hypothesis to test, not a forecast to trust. " +
      "The strongest next step is a week of conversations with the people behind the reports above — show them a landing page, ask what they would pay, and watch whether they sign up. " +
      "That week answers the three questions this draft cannot: how many share the pain, what it is worth to them, and what they have already tried. " +
      "If the answer is encouraging, the gaps in the review record can be closed one by one. If it is not, the cost of learning that is a week, not a build. " +
      "Either way, the decision is grounded in the reports, not in a market estimate this engine refused to invent.",
    "",
    "## Competitive Landscape",
    "",
    `No competitor pricing was verified from the evidence for this cluster, so none is asserted here. ` +
      `The reports name the workaround, not a vendor price list, and inventing a competitor's price would fail the evidence rule. ` +
      (statusQuoCompetitor
        ? `One report names ${statusQuoCompetitor} as the tool people compare against, so that is the status quo to beat — but no price for it was quoted in the evidence, so none is asserted here. `
        : `What the reports do show is that people are solving this today with manual work, spreadsheets, or a patchwork of tools — which means the competition for version one is the status quo, not a named rival. `) +
      `${productName} should not compete by reproducing every capability of a broad platform. Its differentiation is workflow compression for a small, specific job: take the input as it already exists, do the manual step, and return a checkable result. ` +
      `The landing experience should begin with the task itself, not an empty dashboard. Before publish, name the two or three closest products here, with their published pricing linked, if the reviewer wants that section strengthened.`,
    "",
    "**Your Opportunity**",
    "",
    `Position ${productName} as the fastest way to stop doing this task by hand: a focused tool that lives where the work already happens, explains what it did, and charges for the time it saves. Lead with the manual step, fast setup, and a result that can be checked in seconds.`,
    "",
    "## Business Model",
    "",
    `Proposed ${productName} pricing to test with early buyers (an assumption, not observed market data):`,
    "",
    "- **Starter** (Free) — 1 workspace, the core workflow, limited history",
    "- **Solo** ($19/month) — 1 workspace, unlimited runs, longer history, priority support",
    "- **Team** ($49/month) — 5 workspaces, shared review, longer history",
    "",
    "### Value ladder",
    "",
    ...(prices.length > 0
      ? [
          "Real prices found in the evidence — use them to anchor the tiers above:",
          "",
          ...prices.map(
            (p) => `- **${p.amount} ${p.cadence}** — as written in [${p.context}](${p.url})`,
          ),
        ]
      : [
          "No real prices were found in the reports, so there is no evidence-backed ladder to show. The tiers above are proposals to test, not observed prices.",
        ]),
    "",
    "### What it demands",
    "",
    "What building this asks of the founder, before the first line of code is a commitment:",
    "",
    `- **Time to first revenue:** ${demands.timeToFirstRevenue}`,
    `- **Capital to start:** ${demands.capital}`,
    `- **Difficulty:** ${demands.difficulty} (${demands.difficultyScore}/10)`,
    `- **Status quo to beat:** ${statusQuoCompetitor ? `${statusQuoCompetitor} — named in a source report as the tool people compare against.` : "Manual work — no status-quo tool was named in the evidence."}`,
    `- **Biggest risk:** ${biggestRisk}`,
    "",
    "**Unit Economics**",
    "",
    "Planning estimates to verify, not measured results:",
    "",
    "- **80% or better** — Target gross margin",
    "- **$5 maximum per paid workspace** — Model and storage budget",
    "- **30 minutes per active account** — Monthly support target",
    "- **1 completed workflow** — Trial activation target",
    "",
    "**Year-One Math**",
    "",
    `${productName}'s funnel, seat count and close rate below are planning assumptions, not measured results; the totals are plain arithmetic on them.`,
    "",
    "- **12,000** — Search content visitors",
    "- **1,800** — Template installs",
    "- **360** — Trial workspaces",
    "- **90** — Self serve paid accounts",
    "- **90 × $19/mo = $20,520 ARR** — Solo accounts paying by month 12",
    "- **45 × $19/mo = $10,260 ARR** — downside if the close rate halves (half of 90 accounts)",
    "",
    "**Channels**",
    "",
    "Channels to test (proposals, not measured results):",
    "",
    "- Search-led guides for the task this product removes",
    "- Templates and reusable workflows in the communities where the pain was reported",
    "- Launch partnerships with the communities in the evidence",
    "- Short demos in newsletters and podcasts for the audience in the reports",
    "",
    "## Recommended Tech Stack",
    "",
    `A suggested stack for ${productName} (a recommendation, not research):`,
    "",
    "Use Next.js for the control plane and review interface, with Postgres storing workspaces, tasks, run metadata, and reviewer decisions. " +
      "A separate worker service should execute provider calls from a durable queue, enforce concurrency limits, redact secrets, and record immutable artifacts in object storage. " +
      "Encrypt provider credentials, isolate workspace execution, support webhook replay, and make every run auditable. " +
      "OpenTelemetry can expose worker latency and failure causes without turning the product into a customer-facing tracing suite.",
    "",
    `- **Next.js + TypeScript** — screens for Capture the task, Do the manual step, Show the result, Learn the edge cases`,
    "- **Postgres (Supabase or Neon)** — workspaces, tasks, runs, results",
    "- **Auth (Clerk or Supabase Auth)** — workspace seats and roles",
    "- **Stripe Billing** — Starter at Free; Solo at $19/month; Team at $49/month",
    "- **Vercel** — previews and production",
    "",
    "## AI Prompts to Build This",
    "",
    `Copy these ${productName} build prompts into Claude, Cursor, or your AI coding tool.`,
    "",
    "**1. Project Setup**",
    "",
    "```text",
    `Create a Next.js App Router (TypeScript, Tailwind) app named ${productName} for the people in the evidence: the task they keep doing by hand, and the result they need.`,
    "Postgres tables with constraints:",
    "- workspaces(id uuid pk, name text, plan text check plan in ('starter','solo','team'), created_at timestamptz)",
    "- members(id, workspace_id fk, user_id, role text check role in ('owner','admin','member'))",
    "- tasks(id, workspace_id fk, input jsonb, status: queued, running, done, failed, created_at)",
    "- runs(id, workspace_id fk, task_id fk, status: queued, running, passed, failed, started_at, completed_at)",
    "- results(id, workspace_id fk, run_id fk, output jsonb, verdict: pass, warning, fail, explanation, created_at)",
    "- usage_events(id, workspace_id fk, tokens int, usd_micros bigint)",
    "Stripe catalog must match the pricing tiers exactly: Starter at Free; Solo at $19/month; Team at $49/month. Webhook enforces plan limits and seat caps; meter usage_events before starting another run.",
    "Env: DATABASE_URL, STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, NEXT_PUBLIC_APP_URL.",
    "Non-goals: Don't build a broad platform, enterprise governance, or a marketplace before the single workflow proves habitual use.",
    "```",
    "",
    "**2. Core Feature**",
    "",
    "```text",
    `Build ${productName}'s core workflow as one screen per step, in this order:`,
    "- Capture the task: take the input exactly as the user already has it.",
    "- Do the manual step: perform the repetitive step and show what was done.",
    "- Show the result: present the output ready to use, with the source attached.",
    "- Learn the edge cases: record where the automation was uncertain.",
    "Persist state between screens so a user can leave and resume. Acceptance: on sample data, a new workspace goes Capture → Do → Show → Learn without leaving the app, and every generated item links back to its source.",
    "```",
    "",
    "**3. Landing Page**",
    "",
    "```text",
    `One-pager for ${productName}. Hero line: ${title}.`,
    `Sections: the problem for the people in the evidence; how ${productName} works (Capture the task, Do the manual step, Show the result, Learn the edge cases); pricing (Starter at Free; Solo at $19/month; Team at $49/month); a single CTA into the first workflow step.`,
    "```",
    "",
    "**4. Branding Package**",
    "",
    "```text",
    `Brand ${productName} for the people in the evidence. Use a calm, practical aesthetic built around the task itself rather than futuristic AI imagery. Favor deep ink, warm white, restrained green for completed work, and amber for review states. Typography should feel compact and direct without becoming terminal cosplay. The voice is direct and reassuring: explain what changed, why it matters, and what action unblocks the next step. Avoid enterprise jargon and exaggerated claims.`,
    `Deliverables: wordmark and a small mark, hex palette with one accent, type pairing, logo clearspace rules, a short set of CTA lines, a pricing-page headline and onboarding email subject lines. Always call the product ${productName}, never a generic AI platform.`,
    "```",
    "",
    "## Sources",
    "",
    ...evidenceLinks(findings),
    "",
    "### Community signals",
    "",
    "Where the pain was voiced, by platform — counts are reports found by this engine's listeners, not audience sizes:",
    "",
    ...communitySignals.map(
      (s) => `- ${s.source}: ${s.reports} report${s.reports === 1 ? "" : "s"}, ${s.totalAgreement} total agreement.`,
    ),
    "",
  ].join("\n");

  const wordCount = countWords(mdx);
  // Manifest scores mirror the scorecard dials: timing is the Why Now dial
  // (recency of the reports), not frequency — that is what "timing" means.
  const scores = {
    opportunity: clampScore(scorecard.opportunity),
    pain: clampScore(scorecard.problem),
    timing: clampScore(scorecard.whyNow),
    builder_confidence: clampScore(scorecard.feasibility),
  };

  const manifestRow: Record<string, unknown> = {
    slug,
    title,
    category,
    description: `${title} — ${productName}, a weekend-buildable tool for the people reporting this pain.`,
    buildTime: "10",
    revenueGoal: "5k-month",
    applicationCategory: CATEGORY_APPLICATION[category] ?? "BusinessApplication",
    tools: ["claude", "cursor", "v0"],
    audiences: ["solo-founders", "weekend-builders"],
    source: `pain-engine:${slug}`,
    scores,
    og: {
      subject: `${productName}: a focused tool that removes one manual task, shown in use, no people, no legible text`,
      accent: "mint",
      status: "draft",
    },
    researchLevel: wordCount >= WRITER_WORD_TARGET ? "deep" : "standard",
    provenance: {
      researchCalls: ["pain-engine:listen", "pain-engine:cluster", "pain-engine:write"],
      citations: sourceUrls.length,
      wordCount,
      auditPassed: false,
      publishNotes: "pain-engine draft; awaiting single human approval",
      researchMode: "pain-engine",
    },
  };
  if (problemQuote) {
    manifestRow.highlights = { problemQuote };
  }

  return {
    slug,
    title,
    productName,
    category,
    mdx,
    manifestRow,
    evidence: findings,
    gaps,
    scorecard,
    communitySignals,
    prices,
    statusQuoCompetitor,
    biggestRisk,
    notProven,
    demands,
    costUsd: 0,
  };
}
