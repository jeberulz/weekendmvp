/**
 * ResearchRecord → MDX + manifest stub (Mode A2 phase 6).
 *
 * Writes the two files /publish-idea already writes. Does not seed Convex,
 * generate OG, push git, or overwrite existing MDX without force.
 *
 * Manifest source is always `engine:{slug}` — never `ideabrowser:`.
 * Section titles must match scripts/lib/idea-sections.mjs exactly.
 *
 * Writing bar (IB deep pages, e.g. course-translation-resale-network):
 * named product, zero stock filler, named How-it-works steps, priced tiers
 * with unit math, four AI prompts incl. Branding, niche sizing only.
 * Never pad with repeated boilerplate to hit a word floor.
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
/** Keep in sync with MIN_SOURCE_LINKS in scripts/lib/idea-sections.mjs */
const MIN_SOURCE_LINKS = 2;
const HOW_IT_WORKS_LABEL = "**How it works:**";

/**
 * Auditor slug shape (scripts/lib/idea-sections.mjs), plus an optional
 * leading `_` for throwaway drafts the site ignores. Anything else — `/`,
 * `.`, `..` — could write outside content/ideas.
 */
export const COMPILE_SLUG_PATTERN = /^_?[a-z0-9-]+$/;

/** Mega-TAM patterns — dropped from Market Research (niche sizing only). */
const MEGA_TAM_RE =
  /global saas|worldwide saas|saas market.{0,40}\$\s?\d{2,4}|global ai (software|tools|market).{0,40}\$/i;

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

/** Split `Title — description` (em/en dash or hyphen) into parts. */
export function splitNamedStep(step: string): { title: string; body: string } {
  const m = step.match(/^(.+?)\s+[—–-]\s+(.+)$/);
  if (m) {
    const title = m[1]!.trim().replace(/^\*\*|\*\*$/g, "");
    const body = m[2]!.trim();
    if (title && body && !/^step\s*\d+$/i.test(title)) {
      return { title, body };
    }
  }
  // Derive a short title from the first 4–6 words when synthesis forgot the dash.
  const words = step.trim().split(/\s+/);
  const titleWords = words.slice(0, Math.min(4, Math.max(2, words.length - 2)));
  let title = titleWords.join(" ");
  title = title.replace(/[^A-Za-z0-9]+$/g, "");
  if (/^step\s*\d+$/i.test(title) || title.length < 2) {
    title = "Workflow";
  }
  // Title-case lightly for display
  title = title
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
  return { title, body: step.trim() };
}

/** Steps come from research only; a record without them cannot compile. */
function howItWorksSteps(record: ResearchRecord): Array<{ title: string; body: string }> {
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
  // Strip trailing "for …" audience clauses from the brief title.
  return record.brief.title.replace(/\s+for\s+.+$/i, "").trim() || record.brief.title;
}

function audienceLower(record: ResearchRecord): string {
  return record.brief.targetCustomer.trim().replace(/\s+/g, " ").toLowerCase();
}

function nicheStats(record: ResearchRecord) {
  return record.market.stats.filter(
    (s) => !MEGA_TAM_RE.test(`${s.claim} ${s.value}`),
  );
}

function defaultTiers(record: ResearchRecord): PricingTier[] {
  const fromEd = record.editorial?.pricingTiers;
  if (fromEd && fromEd.length >= 2) return fromEd;
  // Parse crude "$X/mo" fragments from pricingNotes when synthesis omitted tiers.
  const notes = record.goToMarket.pricingNotes;
  return [
    {
      name: "Starter",
      price: "priced under the enterprise floor in research",
      includes: `Core workflow for ${audienceLower(record)}; limited seats`,
    },
    {
      name: "Pro",
      price: notes.slice(0, 120) || "seat or usage tier from research",
      includes: "Full workflow, citations/exports, team review",
    },
    {
      name: "Team",
      price: "higher seat / workspace tier",
      includes: "Shared library, admin controls, priority support",
    },
  ];
}

function defaultUnitEcon(record: ResearchRecord): UnitEconRow[] {
  const fromEd = record.editorial?.unitEconomics;
  if (fromEd && fromEd.length >= 2) return fromEd;
  return [
    { label: "COGS per active workspace", value: "LLM + storage — meter from day one" },
    { label: "Target gross margin", value: "≥70% on Pro after prompt caching" },
    { label: "Payback", value: "under 3 months of seat revenue at target CAC" },
  ];
}

function joinBlocks(parts: Array<string | false | null | undefined>): string {
  return parts
    .filter((p): p is string => typeof p === "string" && p.trim().length > 0)
    .join("\n\n");
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
  const audience = audienceLower(record);
  const ed: EditorialFields = record.editorial ?? {};
  const stats = nicheStats(record);
  const tiers = defaultTiers(record);
  const unitEcon = defaultUnitEcon(record);

  const competitorLines = record.competitors
    .map((c) => {
      const notes = c.notes?.trim() || "Positioning gap vs the wedge above.";
      return `- **${c.name}** — ${notes} Pricing: ${c.pricing}. ${mdLink(`${c.name} (vendor page)`, c.url)}.`;
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

  const keywordDetail = record.keywords
    .map((k) => {
      return `- **${k.term}** — ${k.volume}/mo searches, competition ${k.competition}, CPC $${k.cpc.toFixed(2)} (DataForSEO/provider). High CPC with modest volume usually means commercial intent in a small niche — outbound and communities matter as much as SEO.`;
    })
    .join("\n");

  const channelDetail = record.goToMarket.channels
    .map(
      (c, i) =>
        `- **Channel ${i + 1}: ${c}** — Run this alone for two weeks before adding another. Measure reply/demo rate, not vanity followers.`,
    )
    .join("\n");

  const dontBuild =
    ed.dontBuildYet?.trim() ||
    `Do not build a generic chat box, a full enterprise content library, or integrations nobody asked for. Ship ${name}'s core workflow end-to-end first; if early buyers will not pay for that wedge, stop.`;

  const problemNarrative =
    ed.problemNarrative?.trim() ||
    joinBlocks([
      `${record.brief.oneLiner} That is the job ${name} owns for ${audience} — not "AI for documents" in the abstract.`,
      record.community.summary,
      `Why now: ${record.whyNow}`,
      `The buyer already tried spreadsheets, shared drives, and raw ChatGPT. What fails is retrieval of approved language under a deadline, with a human still accountable for the final send.`,
    ]);

  const solutionNarrative =
    ed.solutionNarrative?.trim() ||
    joinBlocks([
      `${name} is not another undifferentiated AI tool. ${record.goToMarket.positioning}`,
      `The wedge is specific: ${audience} need cited drafts from their own approved knowledge without buying an enterprise suite.`,
      `Scope is the How-it-works path below — one primary workflow, measurable completion, pricing that undercuts enterprise floors without pretending to be free forever.`,
    ]);

  const stepPlaybook = steps
    .map(
      (s, i) =>
        `For step ${i + 1} (**${s.title}**): ${s.body} Success looks like a user finishing this step without opening a side doc. Instrument drop-off here before you add settings screens.`,
    )
    .join("\n\n");

  const competitorContrast = record.competitors
    .slice(0, 4)
    .map(
      (c) =>
        `${c.name} at ${c.pricing} solves a neighboring job. ${name} wins only if the buyer who bounced off that price or complexity still completes the ${steps[0]?.title ?? "first"} step in under an hour.`,
    )
    .join(" ");

  const problemBody = joinBlocks([
    problemNarrative,
    "Community evidence (verbatim):",
    signalBlocks,
    `Interview five people in ${audience} before you widen scope past the wedge. Ask what they shipped last quarter, what they copy-pasted, and what they refused to buy.`,
    competitorContrast,
  ]);

  const solutionBody = joinBlocks([
    solutionNarrative,
    HOW_IT_WORKS_LABEL,
    "",
    howItWorksList,
    "",
    stepPlaybook,
    "",
    dontBuild,
  ]);

  const marketBody = joinBlocks([
    record.market.summary,
    stats.length > 0
      ? "Niche signals (global SaaS/AI mega-TAM figures omitted on purpose):\n\n" +
        statLines
      : "Niche sizing was thin in the research pack — treat keyword CPC and competitor price floors as demand proof until you have category-specific TAM.",
    "Keyword demand (provider metrics only — never model-invented):\n\n" +
      (keywordDetail || "- _(no keyword rows)_"),
    `Stage read for ${name}: if CPC is high and volume is low, you win with outbound and communities, not a content farm. If volume is healthy and competitors are expensive, price the wedge and ship.`,
  ]);

  const competitiveBody = joinBlocks([
    `Everyone ${name} gets compared to sells a neighboring job. Name the gap in one sentence, then price under their floor or above their complexity tax.`,
    competitorLines,
    "**Your Opportunity**",
    record.goToMarket.positioning,
    `Re-check each competitor on their own pricing or product page before you publish numbers. Roundup blogs are research breadcrumbs — not the link on your page.`,
  ]);

  const tierEssay = tiers
    .map(
      (t) =>
        `**${t.name}** at ${t.price}: ${t.includes}. Sell this tier when the buyer already feels the pain in the quotes above and can name a weekly questionnaire load. Do not invent a free forever plan that trains people to never upgrade.`,
    )
    .join("\n\n");

  const yearOneMath = joinBlocks([
    `Honest year-one math for ${name} (assumptions you are allowed to miss):`,
    `- 200 named accounts in ${audience} from the channels above`,
    `- 40 product demos / trials`,
    `- 10 paying ${tiers[1]?.name ?? "Pro"} workspaces at ${tiers[1]?.price ?? "the mid tier"}`,
    `- If close-rate halves, you still have a real agency-scale SaaS year — not a vanity launch`,
    `Miss the questionnaire-completion metric and none of the revenue math matters. Instrument ${steps.map((s) => s.title).join(" → ")} before you buy ads.`,
  ]);

  const businessBody = joinBlocks([
    `${name} monetizes the wedge with explicit tiers — not vague freemium. Research pricing notes (stated once here, not recopied into Solution or prompts as a second essay): ${record.goToMarket.pricingNotes}`,
    tierLines,
    tierEssay,
    "**Unit Economics**",
    unitLines,
    yearOneMath,
    "Acquisition channels (pick one to start):\n\n" + channelDetail,
  ]);

  const stackBody = joinBlocks([
    ed.stackNotes?.trim() ||
      `${name} should ship on a weekend stack: App Router UI, one Postgres, one auth provider, Stripe for seats, and the smallest retrieval/LLM path that keeps citations honest. Hard parts are grounding and review UX — not a custom deployment plane.`,
    [
      "- **Next.js + TypeScript** — app UI, API routes, server actions",
      "- **Postgres (Supabase or Neon)** — workspaces, docs, citations, usage meters",
      "- **Auth (Clerk or Supabase Auth)** — seats and team roles",
      "- **Stripe Billing** — tiered subscriptions matching the Business Model table",
      "- **Vercel** — hosting and previews",
      "- **LLM + embeddings** — only where a How-it-works step needs generation or retrieval; meter tokens per workspace",
    ].join("\n"),
    `Operational note: log cost per completed workflow from week one so ${name}'s unit economics stay honest when you raise limits.`,
  ]);

  const stepTitles = steps.map((s) => s.title).join(", ");
  const tierSummary = tiers
    .map((t) => `${t.name} at ${t.price}`)
    .join("; ");

  const promptsBody = [
    "Copy and paste these into Claude, Cursor, or your favorite AI tool.",
    "",
    "**1. Project Setup**",
    "",
    "```text",
    `Create a Next.js App Router (TypeScript, Tailwind) app named ${name} for ${audience}.`,
    `Postgres tables with constraints:`,
    `- workspaces(id uuid pk, name text, plan text check plan in ('starter','pro','team'), created_at timestamptz)`,
    `- members(id, workspace_id fk, user_id, role text check role in ('owner','admin','member'))`,
    `- documents(id, workspace_id fk, title, body, source, embedding vector null)`,
    `- jobs(id, workspace_id fk, status, input jsonb, output jsonb)`,
    `- answers(id, job_id fk, question, draft, confidence numeric)`,
    `- citations(id, answer_id fk, document_id fk, span text)`,
    `- usage_events(id, workspace_id fk, tokens int, usd_micros bigint)`,
    `Stripe Catalog: ${tierSummary}. Webhook enforces seat caps and plan changes. Meter usage_events before allowing another job.`,
    `Env vars: DATABASE_URL, STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, STRIPE_PRICE_STARTER, STRIPE_PRICE_PRO, STRIPE_PRICE_TEAM, OPENAI_API_KEY or ANTHROPIC_API_KEY, NEXT_PUBLIC_APP_URL.`,
    `Explicit non-goals: ${dontBuild}`,
    "```",
    "",
    "**2. Core Feature**",
    "",
    "```text",
    `Implement ${name}'s core workflow as separate routes/screens: ${stepTitles}.`,
    `Persist job state between steps. Show citations inline beside each draft answer. Flag confidence < 0.6 for human review before export.`,
    `Acceptance: a new workspace can finish ${steps.map((s) => s.title).join(" → ")} on sample data without leaving the app.`,
    "```",
    "",
    "**3. Landing Page**",
    "",
    "```text",
    `One-pager for ${name}. Hero (named product): "${record.brief.oneLiner}".`,
    `Sections: problem for ${audience}; how it works (${stepTitles}); competitor strip naming ${record.competitors.map((c) => c.name).join(", ")} with their prices; pricing table (${tierSummary}); single CTA into the core workflow.`,
    `Typography: Geist, near-black on off-white, one accent. Ban phrases: "an AI tool", "leveraging AI", global SaaS TAM.`,
    "```",
    "",
    "**4. Branding Package**",
    "",
    "```text",
    `Brand ${name}: wordmark + small mark that signals trust/citations (passport stamp / check-slash), not a chatbot bubble or sparkle.`,
    `Voice: operator-to-operator, specific buyers (${audience}), specific money. Three rules: (1) say ${name} every time — never "our AI platform"; (2) show keep-vs-enterprise price contrast using research floors; (3) never promise a feature grid you have not built.`,
    `Deliverables: one-page brand sheet (hex, type, logo clearspace), three CTA lines, two audit/onboarding email variants that open with the buyer's actual workload.`,
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
    `## ${SOURCES_TITLE}\n\nResearch citations used above (engine compile).\n\n${escapeMdxProse(sourceLinks)}\n`,
  ].join("\n");

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
      publishNotes: `engine compile; product=${name}; costUsd=${record.provenance.costUsd.toFixed(4)}; no filler pad; tagging left for operator`,
    },
  };

  return { slug, mdx, manifestEntry };
}
