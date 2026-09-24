/**
 * ResearchRecord → MDX + manifest stub (Mode A2 phase 6).
 *
 * Manifest source is always `engine:{slug}` — never `ideabrowser:`.
 * Writing bar: IB deep pages (course-translation-resale-network). Assemble from
 * the research record only — never inject cross-idea padding templates.
 */

import type {
  EditorialFields,
  PricingTier,
  ResearchRecord,
  UnitEconRow,
} from "./research-record.ts";

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
const MIN_SOURCE_LINKS = 2;
const HOW_IT_WORKS_LABEL = "**How it works:**";

export const COMPILE_SLUG_PATTERN = /^_?[a-z0-9-]+$/;

const MEGA_TAM_RE =
  /global saas|worldwide saas|saas market.{0,40}\$\s?\d{2,4}|global ai (software|tools|market).{0,40}\$/i;

const ROUNDUP_URL_RE =
  /comparison|\/best-|roundup|alternatives|vs-|\/blog-posts\/best/i;

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
    opportunity: number;
    pain: number;
    timing: number;
    builder_confidence: number;
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
  slug?: string;
  category?: string;
  tools?: string[];
  audiences?: string[];
  buildTime?: string;
  revenueGoal?: string;
  applicationCategory?: string;
  publishedAt?: string;
};

export function escapeMdxProse(text: string): string {
  return text.replace(/</g, "\\<").replace(/\{/g, "\\{");
}

function escapeOutsideFences(text: string): string {
  return text
    .split(/(```[\s\S]*?```)/g)
    .map((part) => (part.startsWith("```") ? part : escapeMdxProse(part)))
    .join("");
}

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

function uniqueCitations(
  record: ResearchRecord,
): Array<{ url: string; title: string }> {
  const seen = new Set<string>();
  const out: Array<{ url: string; title: string }> = [];
  const push = (url: string, title: string) => {
    if (seen.has(url)) return;
    seen.add(url);
    out.push({ url, title });
  };
  for (const s of record.market.stats) push(s.citation.url, s.citation.title);
  for (const c of record.competitors) {
    if (ROUNDUP_URL_RE.test(c.url)) continue;
    push(c.url, c.name);
  }
  for (const s of record.community.signals) {
    push(s.citation.url, s.citation.title);
  }
  return out;
}

export function splitNamedStep(step: string): { title: string; body: string } {
  const m = step.match(/^(.+?)\s+[—–-]\s+(.+)$/);
  if (m) {
    const title = m[1]!.trim().replace(/^\*\*|\*\*$/g, "");
    const body = m[2]!.trim();
    if (title && body && !/^step\s*\d+$/i.test(title)) {
      return { title, body };
    }
  }
  const words = step.trim().split(/\s+/);
  const titleWords = words.slice(0, Math.min(4, Math.max(2, words.length - 2)));
  let title = titleWords.join(" ").replace(/[^A-Za-z0-9]+$/g, "");
  if (/^step\s*\d+$/i.test(title) || title.length < 2) title = "Workflow";
  title = title
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
  return { title, body: step.trim() };
}

function howItWorksSteps(
  record: ResearchRecord,
): Array<{ title: string; body: string }> {
  const steps = (record.howItWorks ?? []).filter((s) => s.trim().length > 0);
  if (steps.length < 2) {
    throw new Error(
      "record has no howItWorks steps (≥2 required); re-run engine:research",
    );
  }
  return steps.map(splitNamedStep);
}

function productName(record: ResearchRecord): string {
  const ed = record.editorial?.productName?.trim();
  if (ed) return ed;
  return (
    record.brief.title.replace(/\s+for\s+.+$/i, "").trim() || record.brief.title
  );
}

/** Preserve research casing; only normalize whitespace. */
function audienceLabel(record: ResearchRecord): string {
  return record.brief.targetCustomer.trim().replace(/\s+/g, " ");
}

function nicheStats(record: ResearchRecord) {
  return record.market.stats.filter(
    (s) => !MEGA_TAM_RE.test(`${s.claim} ${s.value}`),
  );
}

function defaultTiers(record: ResearchRecord): PricingTier[] {
  const fromEd = record.editorial?.pricingTiers;
  if (fromEd && fromEd.length >= 2) return fromEd;
  const notes = record.goToMarket.pricingNotes;
  const audience = audienceLabel(record);
  const name = productName(record);
  return [
    {
      name: "Starter",
      price: "priced under the enterprise floor in research",
      includes: `${name} core workflow for ${audience}; limited seats`,
    },
    {
      name: "Team",
      price: notes.slice(0, 120) || `${name} mid tier from research`,
      includes: `${name} full workflow, team review, higher limits for ${audience}`,
    },
    {
      name: "Scale",
      price: `${name} top published tier from research`,
      includes: `${name} org controls, higher seats, priority support`,
    },
  ];
}

/** SQL/env-safe slug from tier name — must match Business Model tiers. */
export function tierKey(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

function defaultUnitEcon(record: ResearchRecord): UnitEconRow[] {
  const fromEd = record.editorial?.unitEconomics;
  if (fromEd && fromEd.length >= 2) return fromEd;
  const mid = record.editorial?.pricingTiers?.[1]?.name ?? "Team";
  const name = productName(record);
  return [
    {
      label: `${name} COGS per active workspace`,
      value: `${name} LLM + storage — meter from day one`,
    },
    {
      label: `${name} target gross margin on ${mid}`,
      value: `≥70% after ${name} prompt caching`,
    },
    {
      label: `${name} payback`,
      value: `under 3 months of ${name} seat revenue at target CAC`,
    },
  ];
}

function joinBlocks(parts: Array<string | false | null | undefined>): string {
  return parts
    .filter((p): p is string => typeof p === "string" && p.trim().length > 0)
    .join("\n\n");
}

function trimDot(s: string): string {
  return s.trim().replace(/\.+$/, "");
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
  if (citations.length < MIN_SOURCE_LINKS) {
    throw new Error(
      `record cites ${citations.length} distinct source(s); the auditor needs ≥${MIN_SOURCE_LINKS}`,
    );
  }
  const steps = howItWorksSteps(record);
  const name = productName(record);
  const audience = audienceLabel(record);
  const ed: EditorialFields = record.editorial ?? {};
  const stats = nicheStats(record);
  const tiers = defaultTiers(record);
  const unitEcon = defaultUnitEcon(record);
  const tierKeys = tiers.map((t) => tierKey(t.name));

  const competitorLines = record.competitors
    .map((c) => {
      const notes = trimDot(
        c.notes?.trim() ||
          `${c.name} competes with ${name} on the neighboring job for ${audience}`,
      );
      const pricing = trimDot(c.pricing);
      if (ROUNDUP_URL_RE.test(c.url)) {
        return `- **${c.name}** — ${notes}. Published pricing: ${pricing}.`;
      }
      return `- **${c.name}** — ${notes}. Published pricing: ${pricing}. ${mdLink(`${c.name} (vendor page)`, c.url)}`;
    })
    .join("\n");

  const statLines = stats
    .map(
      (s) =>
        `- **${s.claim}**: ${s.value}. Source: ${mdLink(s.citation.title, s.citation.url)}.`,
    )
    .join("\n");

  const signalBlocks = record.community.signals
    .map(
      (s) =>
        `> "${s.quote}"\n>\n> — ${mdLink(s.citation.title, s.citation.url)}`,
    )
    .join("\n\n");

  const howItWorksList = steps
    .map((s, i) => `${i + 1}. **${s.title}** — ${s.body}`)
    .join("\n");

  const tierLines = tiers
    .map((t) => `- **${t.name}** (${t.price}) — ${t.includes}`)
    .join("\n");

  const unitLines = unitEcon
    .map((u) => `- **${u.value}** — ${u.label}`)
    .join("\n");

  const keywordLines = record.keywords
    .map(
      (k) =>
        `- **${k.term}** — ${k.volume}/mo, competition ${k.competition}, CPC $${k.cpc.toFixed(2)} (provider)`,
    )
    .join("\n");

  const channelLines = record.goToMarket.channels
    .map((c) => `- ${c}`)
    .join("\n");

  const dontBuild =
    ed.dontBuildYet?.trim() ||
    `Ship ${name}'s core workflow end-to-end before expanding scope. If early buyers will not pay for that wedge, stop.`;

  const stepTitles = steps.map((s) => s.title).join(", ");
  const tierSummary = tiers.map((t) => `${t.name} at ${t.price}`).join("; ");
  const planCheck = tierKeys.map((k) => `'${k}'`).join(",");
  const priceEnv = tierKeys
    .map((k) => `STRIPE_PRICE_${k.toUpperCase()}`)
    .join(", ");

  const problemNarrative =
    ed.problemNarrative?.trim() ||
    joinBlocks([
      `${record.brief.oneLiner} That is the job ${name} owns for ${audience}.`,
      record.community.summary,
      `Why ${name} now for ${audience}: ${record.whyNow}`,
    ]);

  const solutionNarrative =
    ed.solutionNarrative?.trim() ||
    joinBlocks([
      `${name} is not another undifferentiated AI tool. ${record.goToMarket.positioning}`,
      `${name} is built for ${audience}, not a generic seat count.`,
    ]);

  const problemBody = joinBlocks([
    problemNarrative,
    signalBlocks,
  ]);

  const solutionBody = joinBlocks([
    solutionNarrative,
    HOW_IT_WORKS_LABEL,
    "",
    howItWorksList,
    "",
    dontBuild,
  ]);

  const whyLine = `Timing for ${name}: ${record.whyNow}`;
  const marketBody = joinBlocks([
    record.market.summary,
    problemNarrative.includes(trimDot(record.whyNow)) ? null : whyLine,
    stats.length > 0
      ? `Cited niche signals for ${audience}:\n\n${statLines}`
      : null,
    keywordLines
      ? `Keyword demand for ${name} (provider metrics):\n\n${keywordLines}`
      : null,
  ]);

  const competitiveBody = joinBlocks([
    ed.competitiveNarrative?.trim() ||
      `${name} wins for ${audience} by staying narrower than the platforms below.`,
    competitorLines,
    "**Your Opportunity**",
    `${name} opportunity for ${audience}: ${record.goToMarket.positioning}`,
  ]);

  const businessBody = joinBlocks([
    `${name} pricing for ${audience}: ${record.goToMarket.pricingNotes}`,
    tierLines,
    "**Unit Economics**",
    unitLines,
    channelLines
      ? `${name} channels:\n\n${channelLines}`
      : null,
  ]);

  const stackBody = joinBlocks([
    ed.stackNotes?.trim() ||
      `${name} for ${audience}: Next.js + TypeScript, Postgres, auth, Stripe for the ${tiers.map((t) => t.name).join(" / ")} tiers, Vercel hosting. Add LLM/embeddings only where a How-it-works step needs them (${stepTitles}).`,
    [
      `- **Next.js + TypeScript** — ${name} UI, API routes, and screens for ${audience}`,
      `- **Postgres (Supabase or Neon)** — ${name} workspaces, documents, usage meters`,
      `- **Auth (Clerk or Supabase Auth)** — ${name} seats and roles for ${audience}`,
      `- **Stripe Billing** — ${name} subscriptions matching ${tiers.map((t) => t.name).join(" / ")}`,
      `- **Vercel** — host ${name} previews and production`,
    ].join("\n"),
  ]);

  const brandMarkHint =
    ed.stackNotes?.trim()?.slice(0, 80) ||
    `a mark that fits ${name}'s job for ${audience}`;

  const promptsBody = [
    `Copy these ${name} build prompts into Claude, Cursor, or your AI coding tool.`,
    "",
    "**1. Project Setup**",
    "",
    "```text",
    `Create a Next.js App Router (TypeScript, Tailwind) app named ${name} for ${audience}.`,
    `Postgres: workspaces(id, name, plan text check plan in (${planCheck})), members(id, workspace_id, user_id, role), documents(id, workspace_id, title, body, source), jobs(id, workspace_id, status, input jsonb, output jsonb), usage_events(id, workspace_id, tokens, usd_micros).`,
    `Stripe catalog must match Business Model tiers exactly: ${tierSummary}. Env: DATABASE_URL, STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, ${priceEnv}, OPENAI_API_KEY or ANTHROPIC_API_KEY, NEXT_PUBLIC_APP_URL.`,
    `Non-goals for ${name}: ${dontBuild}`,
    "```",
    "",
    "**2. Core Feature**",
    "",
    "```text",
    `Implement ${name}'s workflow as separate screens: ${stepTitles}.`,
    `Persist ${name} job state between steps. Acceptance: a new workspace finishes ${steps.map((s) => s.title).join(" → ")} on sample data for ${audience}.`,
    "```",
    "",
    "**3. Landing Page**",
    "",
    "```text",
    `One-pager for ${name}. Hero: "${record.brief.oneLiner}".`,
    `Sections: problem for ${audience}; how ${name} works (${stepTitles}); competitor strip (${record.competitors.map((c) => c.name).join(", ")}); pricing (${tierSummary}); CTA into the ${name} core workflow.`,
    "```",
    "",
    "**4. Branding Package**",
    "",
    "```text",
    `Brand ${name}: wordmark plus ${brandMarkHint}. Voice: specific buyers (${audience}), specific money. Always say ${name} — never "our AI platform". One-page ${name} brand sheet (hex, type, three CTA lines).`,
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

  for (const title of CANONICAL_SECTION_TITLES) {
    if (!(title in sections)) {
      throw new Error(`compiler missing section: ${title}`);
    }
  }

  const body = [
    ...CANONICAL_SECTION_TITLES.map(
      (title) => `## ${title}\n\n${escapeOutsideFences(sections[title]!)}\n`,
    ),
    `## ${SOURCES_TITLE}\n\n${escapeMdxProse(sourceLinks)}\n`,
  ]
    .join("\n")
    .replace(/(?<!\.)\.\.(?!\.)/g, ".");

  const mdx = [
    "---",
    `slug: ${JSON.stringify(slug)}`,
    `title: ${JSON.stringify(record.brief.title)}`,
    "---",
    "",
    body,
  ].join("\n");

  const wordCount = countWords(body);
  const publishedAt =
    options.publishedAt ?? new Date().toISOString().slice(0, 10);

  const s = record.scores;
  const scores =
    s &&
    s.opportunity !== undefined &&
    s.pain !== undefined &&
    s.timing !== undefined &&
    s.builderConfidence !== undefined
      ? {
          opportunity: s.opportunity,
          pain: s.pain,
          timing: s.timing,
          builder_confidence: s.builderConfidence,
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
    ...(scores ? { scores } : {}),
    og: {
      subject: `${name} product still life, no people, no text`,
      accent: "lime",
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
      publishNotes: `engine compile; product=${name}; costUsd=${record.provenance.costUsd.toFixed(4)}; tagging left for operator`,
    },
  };

  return { slug, mdx, manifestEntry };
}
