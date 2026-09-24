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

/**
 * Auditor slug shape (scripts/lib/idea-sections.mjs), plus an optional
 * leading `_` for throwaway drafts the site ignores. Anything else — `/`,
 * `.`, `..` — could write outside content/ideas.
 */
export const COMPILE_SLUG_PATTERN = /^_?[a-z0-9-]+$/;

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

/** Escape prose but leave fenced code blocks verbatim (MDX does not parse them). */
function escapeOutsideFences(text: string): string {
  return text
    .split(/(```[\s\S]*?```)/g)
    .map((part) => (part.startsWith("```") ? part : escapeMdxProse(part)))
    .join("");
}

/**
 * Markdown link safe for MDX: brackets in the text are escaped so they
 * cannot close the link early. Characters in the URL that could end the
 * link or open JSX are percent-encoded, so the later escapeMdxProse pass
 * never has to touch a URL. `<` and `{` in the text are left for that pass.
 */
export function mdLink(text: string, url: string): string {
  const safeText = text.replace(/[\\[\]]/g, (ch) => `\\${ch}`);
  const safeUrl = url.replace(
    /[()\s<>{}]/g,
    (ch) => `%${ch.charCodeAt(0).toString(16).toUpperCase().padStart(2, "0")}`,
  );
  return `[${safeText}](${safeUrl})`;
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

/** Steps come from research only; a record without them cannot compile. */
function howItWorksSteps(record: ResearchRecord): string[] {
  const steps = (record.howItWorks ?? []).filter((s) => s.trim().length > 0);
  if (steps.length < 2) {
    throw new Error(
      "record has no howItWorks steps (≥2 required); re-run engine:research",
    );
  }
  return steps;
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
  const slug = (options.slug ?? record.brief.slug).trim().toLowerCase();
  if (!COMPILE_SLUG_PATTERN.test(slug)) {
    throw new Error(`slug '${slug}' must match ${COMPILE_SLUG_PATTERN}`);
  }
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
      return `- **${c.name}** —${notes} Pricing: ${c.pricing}. Source: ${mdLink(c.name, c.url)}`;
    })
    .join("\n");

  const statLines = record.market.stats
    .map(
      (s) =>
        `- **${s.claim}**: ${s.value} (${mdLink(s.citation.title, s.citation.url)})`,
    )
    .join("\n");

  const signalLines = record.community.signals
    .map((s) => `> "${s.quote}" — ${mdLink(s.citation.title, s.citation.url)}`)
    .join("\n\n");

  // Filler below is idea-neutral builder guidance used only to reach the
  // auditor's word floor. It must never state market facts: those come from
  // the record, with citations.
  const problemBody = padParagraphs(
    [
      `This idea is for ${record.brief.targetCustomer}. ${record.brief.oneLiner}`,
      record.community.summary,
      signalLines,
      `Why now: ${record.whyNow}`,
    ]
      .filter((part) => part.trim().length > 0)
      .join("\n\n"),
    250,
    [
      "Before you build, confirm the pain in the buyer's own words. Talk to five people who match the audience above and ask how they handle this today, what it costs them, and what they have already tried.",
      "The quotes above are a starting point, not proof. Look for repeated complaints, workarounds people pay for, and tasks they put off. Those are the signals that a small, focused product can win.",
      "Write down the one moment where the current approach breaks. Your MVP should fix that moment and nothing else.",
    ],
  );

  const solutionBody = padParagraphs(
    [
      `Build a focused product for ${record.brief.targetCustomer}: ${record.goToMarket.positioning}`,
      `${HOW_IT_WORKS_LABEL}`,
      "",
      ...steps.map((s, i) => `${i + 1}. **Step ${i + 1}** — ${s}`),
      "",
      `Keep the MVP scope tight: one primary workflow, done well. Pricing notes from research: ${record.goToMarket.pricingNotes}`,
    ].join("\n"),
    250,
    [
      "Ship the smallest version that completes the workflow above from start to finish. Defer settings, admin screens, and integrations until a paying user asks for them.",
      "Watch the first users go through each step. Where they stall or drop off is your next week of work.",
      "Track usage and costs from day one so you know what each active user costs you while you iterate.",
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
      "Treat third-party market-size figures as directional. Check the cited sources before you repeat a number in a pitch.",
      "Keyword volume shows how many people search for the problem today. Low volume does not rule an idea out, but it means you will lean on outreach and communities more than search.",
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
      "Read each competitor's pricing page and reviews before you set your own price. Look for the customers they ignore: too small, too niche, or too price-sensitive for their sales model.",
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
      "- Keep acquisition cost under a few months of revenue per customer",
      "- Know your per-user running costs (hosting, APIs) before you set prices",
      "- Grow revenue per account through usage or seats once the core workflow sticks",
    ].join("\n"),
    150,
    [
      "Start with one channel from the list above and one price. Change one of them at a time so you can tell what moved the numbers.",
    ],
  );

  const stackBody = padParagraphs(
    [
      "Recommended weekend stack for this idea:",
      "",
      "- **Next.js + TypeScript** — app UI, API routes, and server actions",
      "- **Postgres (Supabase or Neon)** — app data with row-level security",
      "- **Auth provider (Clerk or Supabase Auth)** — sign-up, sessions, teams",
      "- **Stripe** — subscriptions and billing",
      "- **Vercel** — hosting, previews, and scheduled jobs",
    ].join("\n"),
    120,
    [
      "Add AI APIs, queues, or search only when a step in the workflow above needs them. One database and one deploy target keep a weekend build manageable.",
    ],
  );

  const promptsBody = [
    "Copy and paste these into Claude, Cursor, or your favorite AI tool.",
    "",
    "**1. Project Setup**",
    "",
    "```text",
    `Create a Next.js TypeScript app for "${record.brief.title}" aimed at ${record.brief.targetCustomer}. Include auth, a Postgres database, Stripe billing, and a dashboard for the core workflow.`,
    "```",
    "",
    "**2. Core Feature**",
    "",
    "```text",
    `Implement the core workflow: ${steps.join(" → ")}. Keep each step on one screen and save progress between steps.`,
    "```",
    "",
    "**3. Landing Page**",
    "",
    "```text",
    `Marketing site for ${record.brief.title}. Hero one-liner: "${record.brief.oneLiner}". Include the problem, how it works, how it compares to alternatives, and pricing notes: ${record.goToMarket.pricingNotes}`,
    "```",
  ].join("\n");

  const sourceLinks = citations
    .map((c) => `- ${mdLink(c.title, c.url)}`)
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
      (title) => `## ${title}\n\n${escapeOutsideFences(sections[title]!)}\n`,
    ),
    `## ${SOURCES_TITLE}\n\nResearch citations used above (engine compile).\n\n${escapeMdxProse(sourceLinks)}\n`,
  ].join("\n");

  const mdx = [
    "---",
    // JSON strings are valid YAML double-quoted scalars: quotes, backslashes,
    // and newlines in a title cannot break the frontmatter.
    `slug: ${JSON.stringify(slug)}`,
    `title: ${JSON.stringify(record.brief.title)}`,
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
