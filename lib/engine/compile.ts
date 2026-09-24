/**
 * ResearchRecord → MDX + manifest stub (Mode A2 phase 6).
 *
 * Manifest source is always `engine:{slug}` — never `ideabrowser:`.
 * Writing bar: IB deep pages (course-translation-resale-network). Assemble from
 * the research record only — never inject cross-idea padding templates.
 */

import type {
  DataTable,
  EditorialFields,
  PricingTier,
  ResearchRecord,
  UnitEconRow,
  YearOnePlan,
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
  /comparison|\/best-|\/top-|roundup|alternatives|vs-|\/blog-posts\//i;

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

/**
 * Casing for a label used mid-sentence: "Indie developers" → "indie
 * developers", but acronyms stay ("SMB SaaS teams", "B2B buyers").
 */
export function midSentence(label: string): string {
  const first = label.split(/\s+/)[0] ?? "";
  const isAcronym = first.length > 1 && first === first.toUpperCase();
  const hasInnerCaps = /[A-Z]/.test(first.slice(1));
  if (isAcronym || hasInnerCaps) return label;
  return label.charAt(0).toLowerCase() + label.slice(1);
}

/** Short audience for repeated mentions; the full label appears once. */
function audienceShortLabel(record: ResearchRecord): string {
  return midSentence(
    record.editorial?.audienceShort?.trim() || audienceLabel(record),
  );
}

const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});
const count = new Intl.NumberFormat("en-US");

/**
 * Year-one funnel with compiler-computed ARR and a half-close-rate downside,
 * so revenue totals are arithmetic, never model prose.
 */
export function yearOneLines(plan: YearOnePlan): string {
  const arr = plan.payingAccounts * plan.monthlyRevenuePerAccount * 12;
  const downsideAccounts = Math.max(1, Math.floor(plan.payingAccounts / 2));
  const downsideArr = downsideAccounts * plan.monthlyRevenuePerAccount * 12;
  const monthly = usd.format(plan.monthlyRevenuePerAccount);
  const lines = [
    ...plan.funnel.map((f) => `- **${count.format(f.count)}** — ${f.stage}`),
    `- **${count.format(plan.payingAccounts)} × ${monthly}/mo = ${usd.format(arr)} ARR** — ${plan.tier} accounts paying by month 12`,
    `- **${usd.format(downsideArr)} ARR** — downside if the close rate halves (${count.format(downsideAccounts)} accounts)`,
  ];
  return [
    plan.assumptions ? plan.assumptions : null,
    lines.join("\n"),
  ]
    .filter(Boolean)
    .join("\n\n");
}

/** Always-present tables; the idea's own tables go between them. */
function setupTables(
  planCheck: string,
  dataModel: DataTable[] | undefined,
): string {
  const ideaTables = (dataModel ?? [])
    .map((t) => `- ${t.table}(${t.columns})`)
    .join("\n");
  return [
    `- workspaces(id uuid pk, name text, plan text check plan in (${planCheck}), created_at timestamptz)`,
    "- members(id, workspace_id fk, user_id, role text check role in ('owner','admin','member'))",
    ideaTables ||
      "- documents(id, workspace_id fk, title, body, source)\n- jobs(id, workspace_id fk, status, input jsonb, output jsonb)",
    "- usage_events(id, workspace_id fk, tokens int, usd_micros bigint)",
  ].join("\n");
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
  const audience = audienceShortLabel(record);
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
 * Drop later copies of any ≥8-word sentence (research sometimes restates
 * the same line in problem + market). Preserves code fences untouched.
 */
export function collapseDuplicateSentences(text: string): string {
  const parts = text.split(/(```[\s\S]*?```)/g);
  const seen = new Set<string>();
  return parts
    .map((part) => {
      if (part.startsWith("```")) return part;
      return part
        .split("\n")
        .map((line) => {
          // Quote attributions, list rows, and headings carry links and
          // titles; a "sentence" there is not prose and must stay whole.
          if (/^\s*(>|[-*]\s|\d+\.\s|#)/.test(line)) return line;
          // Mask markdown links so a '.' or '?' inside a title or URL is
          // never read as a sentence end.
          const links: string[] = [];
          const masked = line.replace(/\[[^\]]*\]\([^)]*\)/g, (m) => {
            links.push(m);
            return `\u0000${links.length - 1}\u0000`;
          });
          const deduped = masked.replace(/[^.!?]+[.!?]+/g, (sentence) => {
            const words = sentence.match(/[A-Za-z0-9][A-Za-z0-9'-]*/g) || [];
            if (words.length < 8) return sentence;
            const key = words.join(" ").toLowerCase();
            if (seen.has(key)) return "";
            seen.add(key);
            return sentence;
          });
          return deduped.replace(/\u0000(\d+)\u0000/g, (_, i) => links[Number(i)]!);
        })
        .join("\n");
    })
    .join("")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n");
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

  const audienceShort = audienceShortLabel(record);

  const competitorLines = record.competitors
    .map((c) => {
      const notes = trimDot(
        c.notes?.trim() ||
          `${c.name} competes with ${name} for ${audienceShort}`,
      );
      const pricing = trimDot(c.pricing);
      if (ROUNDUP_URL_RE.test(c.url)) {
        return `- **${c.name}** — ${notes}. Published pricing: ${pricing}.`;
      }
      return `- **${c.name}** — ${notes}. Published pricing: ${pricing}. ${mdLink(`${c.name} pricing`, c.url)}`;
    })
    .join("\n");

  const statLines = stats
    .map(
      (s) =>
        `- **${s.claim}**: ${s.value} (${mdLink(s.citation.title, s.citation.url)}).`,
    )
    .join("\n");

  // Only quotes the pipeline found on the cited page (or legacy records that
  // predate the check). A quote it checked and could not find never ships.
  const signalBlocks = record.community.signals
    .filter((s) => s.verified !== false)
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
        `- **${k.term}** — ${k.volume}/mo, competition ${k.competition}, CPC $${k.cpc.toFixed(2)}`,
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
      `${record.brief.oneLiner} That is the job ${name} owns for ${midSentence(audience)}.`,
      record.community.summary,
      `Why now: ${record.whyNow}`,
    ]);

  const solutionNarrative =
    ed.solutionNarrative?.trim() ||
    joinBlocks([
      `${name} is not another undifferentiated AI tool. ${record.goToMarket.positioning}`,
    ]);

  const problemBody = joinBlocks([problemNarrative, signalBlocks]);

  const solutionBody = joinBlocks([
    solutionNarrative,
    HOW_IT_WORKS_LABEL,
    "",
    howItWorksList,
    "",
    dontBuild,
  ]);

  const marketBody = joinBlocks([
    record.market.summary,
    problemNarrative.includes(trimDot(record.whyNow))
      ? null
      : `Why now: ${record.whyNow}`,
    stats.length > 0 ? `**Market signals**\n\n${statLines}` : null,
    keywordLines
      ? `**Search demand** (DataForSEO, US monthly)\n\n${keywordLines}`
      : null,
  ]);

  const competitiveBody = joinBlocks([
    ed.competitiveNarrative?.trim() ||
      `${name} wins by staying narrower than the platforms below.`,
    competitorLines,
    "**Your Opportunity**",
    record.goToMarket.positioning,
  ]);

  const businessBody = joinBlocks([
    record.goToMarket.pricingNotes,
    tierLines,
    "**Unit Economics**",
    unitLines,
    ed.yearOne ? "**Year-One Math**" : null,
    ed.yearOne ? yearOneLines(ed.yearOne) : null,
    channelLines ? `**Channels**\n\n${channelLines}` : null,
  ]);

  const tableNames = (ed.dataModel ?? []).map((t) => t.table);
  const stackBody = joinBlocks([
    ed.stackNotes?.trim() ||
      `Next.js + TypeScript, Postgres, auth, Stripe for the ${tiers.map((t) => t.name).join(" / ")} tiers, Vercel hosting. Add LLM/embeddings only where a How-it-works step needs them (${stepTitles}).`,
    [
      `- **Next.js + TypeScript** — screens for ${stepTitles}`,
      `- **Postgres (Supabase or Neon)** — ${tableNames.length > 0 ? tableNames.join(", ") : "workspaces, members, usage meters"}`,
      "- **Auth (Clerk or Supabase Auth)** — workspace seats and roles",
      `- **Stripe Billing** — ${tiers.map((t) => t.name).join(" / ")} subscriptions`,
      "- **Vercel** — previews and production",
    ].join("\n"),
  ]);

  const coreFeatureLines = steps.map((s, i) => {
    const firstSentence = s.body.split(/(?<=[.!?])\s+/)[0] ?? s.body;
    return `${i + 1}. ${s.title}: ${trimDot(firstSentence)}.`;
  });

  const brandBrief =
    ed.brandBrief?.trim() ||
    `Position ${name} as ${trimDot(record.goToMarket.positioning)}.`;

  const promptsBody = [
    `Copy these ${name} build prompts into Claude, Cursor, or your AI coding tool.`,
    "",
    "**1. Project Setup**",
    "",
    "```text",
    `Create a Next.js App Router (TypeScript, Tailwind) app named ${name} for ${audienceShort}.`,
    "Postgres tables with constraints:",
    setupTables(planCheck, ed.dataModel),
    `Stripe catalog must match the pricing tiers exactly: ${tierSummary}. Webhook enforces plan limits and seat caps; meter usage_events before starting another job.`,
    `Env: DATABASE_URL, STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, ${priceEnv}, OPENAI_API_KEY or ANTHROPIC_API_KEY, NEXT_PUBLIC_APP_URL.`,
    `Non-goals: ${dontBuild}`,
    "```",
    "",
    "**2. Core Feature**",
    "",
    "```text",
    `Build ${name}'s core workflow as ${steps.length} screens, in order:`,
    ...coreFeatureLines,
    `Persist state between screens so a user can leave and resume. Acceptance: on sample data, a new workspace goes ${steps.map((s) => s.title).join(" → ")} without leaving the app, and every generated item links back to its source.`,
    "```",
    "",
    "**3. Landing Page**",
    "",
    "```text",
    `One-pager for ${name}. Hero: "${record.brief.oneLiner}"`,
    `Sections: the problem for ${audienceShort}; how ${name} works (${stepTitles}); competitor strip (${record.competitors.map((c) => `${c.name}: ${trimDot(c.pricing)}`).join("; ")}); pricing (${tierSummary}); one CTA into the first workflow step.`,
    "```",
    "",
    "**4. Branding Package**",
    "",
    "```text",
    `Brand ${name} for ${audienceShort}. ${brandBrief}`,
    `Deliverables: wordmark and a small mark, hex palette with one accent, type pairing, logo clearspace rules, three CTA lines, a pricing-page headline, and two onboarding email subject lines. Always say ${name}, never "our AI platform".`,
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

  const body = collapseDuplicateSentences(
    [
      ...CANONICAL_SECTION_TITLES.map(
        (title) => `## ${title}\n\n${escapeOutsideFences(sections[title]!)}\n`,
      ),
      `## ${SOURCES_TITLE}\n\n${escapeMdxProse(sourceLinks)}\n`,
    ]
      .join("\n")
      .replace(/(?<!\.)\.\.(?!\.)/g, "."),
  );

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
