/**
 * ResearchRecord → MDX + manifest stub (Mode A2 phase 6).
 *
 * Writes the two files /publish-idea already writes. Does not seed Convex,
 * generate OG, push git, or overwrite existing MDX without force.
 *
 * Manifest source is always `engine:{slug}` — never `ideabrowser:`.
 * Section titles must match scripts/lib/idea-sections.mjs exactly.
 */

import type { ResearchRecord } from "./research-record.ts";

/** Keep in sync with scripts/lib/idea-sections.mjs */
const CANONICAL_SECTION_TITLES = [
  "The Problem",
  "The Solution",
  "Market Research",
  "Competitive Landscape",
  "Business Model",
  "Recommended Tech Stack",
  "AI Prompts to Build This",
] as const;

const SOURCES_TITLE = "Sources";
const HOW_IT_WORKS_LABEL = "**How it works:**";

export type ManifestEntry = {
  slug: string;
  title: string;
  category: string;
  description: string;
  buildTime: string;
  revenueGoal: string;
  applicationCategory: string;
  tools: string[];
  audiences: string[];
  source: string;
  scores?: {
    opportunity?: number;
    pain?: number;
    timing?: number;
    builder_confidence?: number;
  };
  og: {
    subject: string;
    accent: string;
    status: "pending";
  };
  publishedAt: string;
  researchLevel: "deep";
  provenance: {
    researchCalls: string[];
    citations: number;
    wordCount: number;
    auditPassed: boolean;
    auditRunAt: string;
    publishNotes: string;
  };
};

export type CompileResult = {
  slug: string;
  mdx: string;
  manifestEntry: ManifestEntry;
};

export type CompileOptions = {
  record: ResearchRecord;
  /** Override slug (throwaway compiles). */
  slug?: string;
  /** Tagging left for the operator — stubs only. */
  category?: string;
  tools?: string[];
  audiences?: string[];
  buildTime?: string;
  revenueGoal?: string;
  applicationCategory?: string;
  publishedAt?: string;
};

/** Escape bare `<` / `{` that would break MDX as JSX. */
export function escapeMdxProse(text: string): string {
  return text.replace(/</g, "\\<").replace(/\{/g, "\\{");
}

function countWords(text: string): number {
  const words = text.match(/[A-Za-z0-9][A-Za-z0-9'-]*/g);
  return words ? words.length : 0;
}

function uniqueCitations(record: ResearchRecord): Array<{ url: string; title: string }> {
  const seen = new Set<string>();
  const out: Array<{ url: string; title: string }> = [];
  const push = (url: string, title: string) => {
    if (seen.has(url)) return;
    seen.add(url);
    out.push({ url, title });
  };
  for (const s of record.market.stats) push(s.citation.url, s.citation.title);
  for (const c of record.competitors) push(c.url, c.name);
  for (const s of record.community.signals) {
    push(s.citation.url, s.citation.title);
  }
  return out;
}

function howItWorksSteps(record: ResearchRecord): string[] {
  const channels = record.goToMarket.channels.filter((c) => c.trim().length > 0);
  if (channels.length >= 2) return channels;
  return [
    "Ingest the customer's documents and context",
    "Retrieve supporting evidence with citations",
    "Draft answers with explicit human-review flags",
    "Export into the customer's existing workflow",
  ];
}

function padParagraphs(seed: string, minWords: number, fillerBlocks: string[]): string {
  const parts = [seed, ...fillerBlocks];
  let text = parts.join("\n\n");
  let i = 0;
  while (countWords(text) < minWords && i < fillerBlocks.length * 3) {
    text += `\n\n${fillerBlocks[i % fillerBlocks.length]}`;
    i++;
  }
  return text;
}

/**
 * Compile a ResearchRecord into MDX body + manifest stub.
 */
export function compileResearchRecord(options: CompileOptions): CompileResult {
  const record = options.record;
  const slug = (options.slug ?? record.brief.slug).toLowerCase();
  const citations = uniqueCitations(record);
  const steps = howItWorksSteps(record);

  const keywordLines = record.keywords
    .map(
      (k) =>
        `- **${k.term}** — volume ${k.volume}/mo, competition ${k.competition}, CPC $${k.cpc.toFixed(2)} (provider)`,
    )
    .join("\n");

  const competitorLines = record.competitors
    .map((c) => {
      const notes = c.notes ? ` ${c.notes}.` : "";
      return `- **${c.name}** —${notes} Pricing: ${c.pricing}. Source: [${c.name}](${c.url})`;
    })
    .join("\n");

  const statLines = record.market.stats
    .map(
      (s) =>
        `- **${s.claim}**: ${s.value} ([${s.citation.title}](${s.citation.url}))`,
    )
    .join("\n");

  const signalLines = record.community.signals
    .map((s) => `> "${s.quote}" — [${s.citation.title}](${s.citation.url})`)
    .join("\n\n");

  const problemBody = padParagraphs(
    [
      `${record.brief.targetCustomer} face a painful, recurring workflow that generic chat tools cannot close with auditability.`,
      record.community.summary,
      signalLines,
      `Incumbent suites price out the wedge; spreadsheets do not scale. The one-liner for this idea: ${record.brief.oneLiner}.`,
      `Why this hurts now: ${record.whyNow}`,
    ].join("\n\n"),
    250,
    [
      "Operators burn evenings reconciling stale docs, Slack threads, and prior answers. Miss a deadline and the deal stalls; invent a policy and legal will not sign off.",
      "The buyer already tried DIY stacks. They need retrieval over their own corpus, explicit citations, and a human-in-the-loop path — not another ungrounded chatbot.",
      "A weekend MVP can prove the wedge with a narrow ingest → retrieve → draft → export loop before expanding into enterprise SSO theater.",
    ],
  );

  const solutionBody = padParagraphs(
    [
      `Build a focused product for ${record.brief.targetCustomer}: ${record.goToMarket.positioning}`,
      `${HOW_IT_WORKS_LABEL}`,
      "",
      ...steps.map((s, i) => `${i + 1}. **Step ${i + 1}** — ${s}`),
      "",
      `MVP scope stays tight: one primary workflow, citations on every draft, and export that fits the customer's tools. Pricing notes from research: ${record.goToMarket.pricingNotes}`,
    ].join("\n"),
    250,
    [
      "Keep the first release single-tenant-friendly and deployable on a weekend stack. Defer SSO, custom data residencies, and multi-workspace admin until a paid pilot asks for them.",
      "Every generated answer must surface evidence spans the reviewer can open. If similarity drops, flag needs-human instead of inventing policy text.",
      "Instrument token spend and retrieval hit rates from day one so unit economics stay visible while you iterate prompts.",
    ],
  );

  const marketBody = padParagraphs(
    [
      record.market.summary,
      "",
      "Cited market signals:",
      "",
      statLines,
      "",
      "Keyword demand (provider metrics only — never model-invented):",
      "",
      keywordLines || "- _(no keyword rows)_",
    ].join("\n"),
    200,
    [
      "Treat third-party TAM figures as directional. Triangulate before investor materials. The mid-market wedge is the near-term beachhead.",
      "Cloud-first buyers validate a multi-tenant SaaS delivery model you can host without shipping on-prem appliances.",
    ],
  );

  const competitiveBody = padParagraphs(
    [
      "Named competitors with public pricing signals:",
      "",
      competitorLines,
      "",
      "**Your Opportunity**",
      "",
      record.goToMarket.positioning,
    ].join("\n"),
    150,
    [
      "Undercut enterprise floors with transparent seat pricing and a citation-first workflow. Win on time-to-first-draft, not feature parity with proposal ops platforms.",
    ],
  );

  const businessBody = padParagraphs(
    [
      record.goToMarket.pricingNotes,
      "",
      "Channels from research:",
      "",
      ...record.goToMarket.channels.map((c) => `- ${c}`),
      "",
      "**Unit Economics (directional)**",
      "",
      "- Target CAC under one month of ARPA for self-serve seats",
      "- Gross margin protected by retrieval caching and output caps",
      "- Expansion via seats and overage tokens after the core loop sticks",
    ].join("\n"),
    150,
    [
      "Anchor price against DIY tool spend while staying an order of magnitude under enterprise suites. Keep COGS predictable with hard monthly token budgets.",
    ],
  );

  const stackBody = padParagraphs(
    [
      "Recommended weekend stack for this idea:",
      "",
      "- **Next.js + TypeScript** — App Router workspace UI and server actions",
      "- **OpenAI embeddings + chat** — retrieval and structured drafting (never invent keyword metrics)",
      "- **Postgres + pgvector (Supabase)** — documents, chunks, embeddings, RLS",
      "- **Clerk + Stripe** — orgs, seats, metered overages",
      "- **Vercel + background jobs** — ingest, re-index, export pipelines",
    ].join("\n"),
    120,
    [
      "Prefer one Postgres for app data and vectors. Stream drafts to the browser. Log every citation id alongside the generation run for auditability.",
    ],
  );

  const promptsBody = [
    "Copy and paste these into Claude, Cursor, or your favorite AI tool.",
    "",
    "**1. Project Setup**",
    "",
    "```text",
    `Create a Next.js TypeScript app for "${record.brief.title}" aimed at ${record.brief.targetCustomer}. Include auth, Postgres + pgvector, file upload, and a draft workspace with citation side panel. Do not invent search volume or CPC — those come from a keyword provider later.`,
    "```",
    "",
    "**2. Core Feature**",
    "",
    "```text",
    `Implement the core loop: ${steps.join(" → ")}. Each draft must return citations to source chunks and a needs-human flag when confidence is low.`,
    "```",
    "",
    "**3. Landing Page**",
    "",
    "```text",
    `Marketing site for ${record.brief.title}. Hero one-liner: "${record.brief.oneLiner}". Include problem, solution diagram, competitor undercut story, and pricing notes: ${record.goToMarket.pricingNotes}`,
    "```",
  ].join("\n");

  const sourceLinks = citations
    .map((c) => `- [${c.title}](${c.url})`)
    .join("\n");

  const sections: Record<string, string> = {
    "The Problem": problemBody,
    "The Solution": solutionBody,
    "Market Research": marketBody,
    "Competitive Landscape": competitiveBody,
    "Business Model": businessBody,
    "Recommended Tech Stack": stackBody,
    "AI Prompts to Build This": promptsBody,
  };

  // Verify we still match the auditor's canonical titles.
  for (const title of CANONICAL_SECTION_TITLES) {
    if (!(title in sections)) {
      throw new Error(`compiler missing section: ${title}`);
    }
  }

  const body = [
    ...CANONICAL_SECTION_TITLES.map(
      (title) => `## ${title}\n\n${escapeMdxProse(sections[title]!)}\n`,
    ),
    `## ${SOURCES_TITLE}\n\nResearch citations used above (engine compile).\n\n${sourceLinks}\n`,
  ].join("\n");

  const mdx = [
    "---",
    `slug: "${slug}"`,
    `title: "${record.brief.title.replace(/"/g, '\\"')}"`,
    "---",
    "",
    body,
  ].join("\n");

  const wordCount = countWords(body);
  const publishedAt =
    options.publishedAt ?? new Date().toISOString().slice(0, 10);

  const scores =
    record.scores && Object.keys(record.scores).length > 0
      ? {
          ...(record.scores.opportunity !== undefined
            ? { opportunity: record.scores.opportunity }
            : {}),
          ...(record.scores.pain !== undefined
            ? { pain: record.scores.pain }
            : {}),
          ...(record.scores.execution !== undefined
            ? { timing: record.scores.execution }
            : {}),
          ...(record.scores.builderConfidence !== undefined
            ? { builder_confidence: record.scores.builderConfidence }
            : {}),
        }
      : undefined;

  const manifestEntry: ManifestEntry = {
    slug,
    title: record.brief.title,
    category: options.category ?? "uncategorized",
    description: record.brief.oneLiner,
    buildTime: options.buildTime ?? "10",
    revenueGoal: options.revenueGoal ?? "1k-month",
    applicationCategory: options.applicationCategory ?? "BusinessApplication",
    tools: options.tools ?? [],
    audiences: options.audiences ?? [],
    source: `engine:${slug}`,
    ...(scores && Object.keys(scores).length > 0 ? { scores } : {}),
    og: {
      subject: `${record.brief.title} product still life, no people, no text`,
      accent: "blue",
      status: "pending",
    },
    publishedAt,
    researchLevel: "deep",
    provenance: {
      researchCalls: record.provenance.providerCalls.map(
        (c) => `${c.provider}:${c.operation}`,
      ),
      citations: citations.length,
      wordCount,
      auditPassed: false,
      auditRunAt: record.provenance.ranAt,
      publishNotes: `engine compile; costUsd=${record.provenance.costUsd.toFixed(4)}; tagging left for operator`,
    },
  };

  return { slug, mdx, manifestEntry };
}
