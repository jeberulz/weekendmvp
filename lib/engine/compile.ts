/**
 * ResearchRecordV2 → MDX body + manifest stub (WP54, evidence contract §9;
 * rulings R10 and R11).
 *
 * Manifest source is always `engine:{slug}` — never `ideabrowser:`.
 *
 * What the compiled page guarantees, and what it does not:
 *   - Measured facts come only from accepted evidence and are printed by the
 *     evidence module, never retyped: quote blockquotes (community.quoteIds)
 *     `> "<excerpt>"`, `>`, `> — [source title](url)` (a quote is one line
 *     of its source, ruling R8); market signal rows (market.statIds) that
 *     are renderEvidenceInline and the source (marketSignalRow: the
 *     rendering names subject, metric and period, ruling R7); competitor
 *     rows whose "Published pricing:" items are renderEvidenceInline of each
 *     accepted price, "(via host)" for a secondary source, and the source
 *     link; `[[ev:<id>]]` tokens in prose as links whose text is
 *     renderEvidenceInline(item) and whose target is the evidence source
 *     (plain renderings inside the build-prompt fences). Every link on the
 *     page targets an evidence source the record uses, and ## Sources lists
 *     exactly those sources (usedEvidenceIds). The record parser allows a
 *     token only in the writer fields WRITER_FIELD_TOKEN_KINDS lists.
 *   - Search demand rows are provider keyword metrics, printed as recorded.
 *   - Proposals and planning assumptions are labelled as such on the page
 *     (proposalLabels): How it works, what not to build yet, pricing tiers,
 *     unit economics, Year-One Math, channels and the stack. Their figures
 *     (tier prices and includes, unit-economics values, Year-One counts and
 *     seats, data-model columns) are the writer's proposals, not research.
 *   - Year-One Math totals are plain arithmetic by finance.ts (exact cents,
 *     floor(base/2) downside that may be zero).
 *   - Everything else is model writing: narratives, summaries, notes,
 *     positioning, steps and briefs. The record parser and the final audit
 *     guard it (no free figures, no quotations outside quote evidence, no
 *     links), which is not proof that it is true. A matching source proves
 *     the source said it when it was read, not that it is right.
 *   - The compiler's own wording carries no figure, number word or quotation,
 *     so every figure on the page traces to the record.
 *
 * Escaping happens exactly once, where text is inserted: escapeMdxText (the
 * one module shared with the auditor) for record text in Markdown, nothing
 * inside code fences, and mdLink for links. Nothing is escaped twice.
 *
 * There are no publishable fallbacks: a record without the editorial fields
 * the deep audit needs (narratives, pricing tiers, unit economics, year-one,
 * an idea-specific data model, …) fails with CompileError instead of being
 * padded with generic text. A mode "fixture" record compiles only to an
 * engine-draft-* or _temp slug unless the caller passes allowFixture (tests).
 */

import { ENGINE_DRAFT_PREFIX } from "../engine-drafts.ts";
import { formatPriceTerms, parsePriceTerms } from "./evidence/amount.ts";
import { sourceHostLabel } from "./evidence/citation.ts";
import {
  EVIDENCE_TOKEN_RE,
  type AcceptedEvidence,
  type CommunityQuoteEvidence,
  type CompetitorPriceEvidence,
  type EvidenceKind,
  type MarketStatEvidence,
  type PriceTerms,
  type ResearchMode,
  type ResearchRecordV2,
  type YearOnePlanV2,
} from "./evidence/contract.ts";
import { escapeMdxText } from "./evidence/quote.ts";
import { evidenceRefs, renderEvidenceInline } from "./evidence/tokens.ts";
import { computeYearOne, yearOneTierTerms } from "./finance.ts";
import {
  HOW_IT_WORKS_LABEL,
  ideaHighlights,
  keywordRowMdx,
  LABEL,
  marketSignalRow,
  mdLink,
  pageProductName,
  PROMPT_TITLES,
  promptHeadingText,
  proposalLabels,
  PUBLISHED_PRICING,
  SEARCH_DEMAND_NOTE,
  SECTION_TITLES,
  SOURCES_TITLE,
  tidyProse,
  usedEvidenceIds,
  viaLabel,
  yearOneBaseLine,
  yearOneDownsideLine,
  yearOneFunnelLine,
  type IdeaHighlights,
} from "./page-format.ts";
import {
  parseResearchRecord,
  type DataTable,
  type PricingTier,
  type UnitEconRow,
} from "./research-record.ts";

export { marketSignalRow, mdLink } from "./page-format.ts";

const MIN_SOURCE_LINKS = 2;
/** The deep audit wants at least this many tiers, unit-economics rows and idea tables. */
const MIN_PRICING_TIERS = 2;
const MIN_UNIT_ECONOMICS_ROWS = 2;
const MIN_IDEA_TABLES = 3;

/**
 * Tables every Project Setup prompt already declares (or that a page used
 * to get as a generic fallback); they do not count as idea-specific. Keep in
 * sync with GENERIC_SETUP_TABLES in scripts/lib/idea-quality.mjs (a test checks).
 */
export const GENERIC_SETUP_TABLE_NAMES: readonly string[] = [
  "workspaces",
  "members",
  "usage_events",
  "documents",
  "jobs",
];

export const COMPILE_SLUG_PATTERN = /^_?[a-z0-9-]+$/;

/** The frontmatter line that marks a page as engine:compile output (P3-8). */
export const ENGINE_MARKER_LINE = "engine: true";
const ENGINE_MARKER_RE = /^engine[ \t]*:[ \t]*(["']?)true\1[ \t]*(?:#.*)?$/im;

/**
 * True when a page's own frontmatter carries the engine marker (any case,
 * quoted or with a trailing comment). The auditor applies the deep bar to
 * such a page; the compile writer may replace it with --force.
 */
export function hasEngineMarker(raw: string): boolean {
  if (!raw.startsWith("---")) return false;
  const end = raw.indexOf("\n---", 3);
  if (end === -1) return false;
  return ENGINE_MARKER_RE.test(raw.slice(0, end + 4));
}

/**
 * Slugs a fixture-mode record may compile to (ruling R11): engine-draft-*
 * drafts (withheld from the site) and _temp slugs (never loaded as pages).
 */
export function isFixtureSafeSlug(slug: string): boolean {
  return slug.startsWith(ENGINE_DRAFT_PREFIX) || slug.startsWith("_");
}

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
  /** Homepage highlights generated from selected evidence (ideaHighlights); absent when they cannot be filled. */
  highlights?: IdeaHighlights;
  publishedAt: string;
  researchLevel: "deep";
  provenance: {
    researchCalls: string[];
    citations: number;
    wordCount: number;
    auditPassed: boolean;
    auditRunAt: string;
    publishNotes: string;
    /** The record's research mode; "fixture" output never publishes (ruling R11). */
    researchMode: ResearchMode;
  };
};

export type CompileResult = {
  slug: string;
  mdx: string;
  manifestEntry: ManifestEntry;
};

export type CompileOptions = {
  record: ResearchRecordV2;
  slug?: string;
  category?: string;
  tools?: string[];
  audiences?: string[];
  buildTime?: string;
  revenueGoal?: string;
  applicationCategory?: string;
  publishedAt?: string;
  /**
   * Test-only: compile a mode "fixture" record to any slug. Without it a
   * fixture record compiles only to an engine-draft-* or _temp slug (R11).
   */
  allowFixture?: boolean;
};

/**
 * The record cannot become a publishable page (missing editorial fields,
 * too few sources, a field that would break a code fence). Lists every issue.
 */
export class CompileError extends Error {
  readonly issues: string[];

  constructor(issues: string[]) {
    super(`cannot compile a publishable page: ${issues.join("; ")}`);
    this.name = "CompileError";
    this.issues = issues;
  }
}

function countWords(text: string): number {
  const words = text.match(/[A-Za-z0-9][A-Za-z0-9'-]*/g);
  return words ? words.length : 0;
}

export function splitNamedStep(step: string): { title: string; body: string } {
  const m = step.match(/^(.+?)\s+[—–-]\s+(.+)$/);
  const named = m?.[1]?.trim().replace(/^\*\*|\*\*$/g, "") ?? "";
  const described = m?.[2]?.trim() ?? "";
  if (named && described && !/^step\s*\d+$/i.test(named)) {
    return { title: named, body: described };
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

/** SQL/env-safe slug from tier name — must match Business Model tiers. */
export function tierKey(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
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
 * Drop later copies of any ≥8-word prose sentence (a writer sometimes
 * restates one line in two fields). Quote, list, heading and numbered lines
 * are never touched, links are masked, and code fences are preserved.
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
          return deduped.replace(/\u0000(\d+)\u0000/g, (whole: string, i: string) => links[Number(i)] ?? whole);
        })
        .join("\n");
    })
    .join("")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n");
}

// ---------------------------------------------------------------------------
// Evidence rendering
// ---------------------------------------------------------------------------

type Ctx = {
  record: ResearchRecordV2;
  byId: ReadonlyMap<string, AcceptedEvidence>;
  /** Evidence ids that appear on the page, in first-use order (feeds Sources). */
  used: Set<string>;
};

function tokenRe(): RegExp {
  return new RegExp(EVIDENCE_TOKEN_RE.source, "g");
}

/** The accepted item behind an id; the parser guarantees it, so a miss is a defect. */
function evidence(ctx: Ctx, id: string, kind?: EvidenceKind): AcceptedEvidence {
  const item = ctx.byId.get(id);
  if (!item || (kind !== undefined && item.kind !== kind)) {
    throw new CompileError([`evidence ${id} is not an accepted ${kind ?? "item"} of this record`]);
  }
  ctx.used.add(id);
  return item;
}

function quoteItem(ctx: Ctx, id: string): CommunityQuoteEvidence {
  const item = evidence(ctx, id, "community_quote");
  if (item.kind !== "community_quote") throw new CompileError([`evidence ${id} is not a community quote`]);
  return item;
}

function statItem(ctx: Ctx, id: string): MarketStatEvidence {
  const item = evidence(ctx, id, "market_stat");
  if (item.kind !== "market_stat") throw new CompileError([`evidence ${id} is not a market stat`]);
  return item;
}

function priceItem(ctx: Ctx, id: string): CompetitorPriceEvidence {
  const item = evidence(ctx, id, "competitor_price");
  if (item.kind !== "competitor_price") throw new CompileError([`evidence ${id} is not a competitor price`]);
  return item;
}

/** Canonical inline rendering linked to its evidence source. */
function evidenceLink(item: AcceptedEvidence): string {
  return mdLink(renderEvidenceInline(item), item.sourceUrl);
}

/** Private-use markers that stand in for evidence links while prose is escaped. */
const MARK_OPEN = "\uE000";
const MARK_CLOSE = "\uE001";
const MARK_RE = /\uE000(\d+)\uE001/g;

/**
 * Editorial text as MDX prose: tokens become evidence links, everything
 * else is escaped once with escapeMdxText (tokens are swapped for private-use
 * markers first, so line-start rules see the real prose). A stray ".." is
 * tidied to "." (tidyProse); evidence text is never touched.
 */
function proseMdx(text: string, ctx: Ctx, path: string): string {
  if (text.includes(MARK_OPEN) || text.includes(MARK_CLOSE)) {
    throw new CompileError([`${path}: contains reserved private-use characters U+E000/U+E001`]);
  }
  const links: string[] = [];
  const marked = tidyProse(text).replace(tokenRe(), (_token: string, id: string) => {
    links.push(evidenceLink(evidence(ctx, id)));
    return `${MARK_OPEN}${links.length - 1}${MARK_CLOSE}`;
  });
  return escapeMdxText(marked).replace(MARK_RE, (_mark: string, index: string) => {
    const link = links[Number(index)];
    if (link === undefined) throw new CompileError([`${path}: evidence marker ${index} has no link (compiler defect)`]);
    return link;
  });
}

/** Editorial text for a code fence: tokens become their plain canonical rendering; nothing is escaped. */
function fenceText(text: string, ctx: Ctx): string {
  return text.replace(tokenRe(), (_token: string, id: string) => renderEvidenceInline(evidence(ctx, id)));
}

/**
 * A quote blockquote: `> "<excerpt>"`, `>`, `> — [title](url)`. Since ruling
 * R8 an excerpt is one line of its source; a line break would still be kept,
 * each line prefixed.
 */
export function quoteBlock(item: CommunityQuoteEvidence): string {
  const lines: string[] = [];
  for (const raw of escapeMdxText(item.excerpt.trim()).split(/\r\n|\r|\n/)) {
    const line = raw.trim();
    if (line === "" && (lines.length === 0 || lines[lines.length - 1] === "")) continue;
    lines.push(line);
  }
  while (lines.length > 0 && lines[lines.length - 1] === "") lines.pop();
  const quoted = lines.map((line, i) => {
    const open = i === 0 ? '"' : "";
    const close = i === lines.length - 1 ? '"' : "";
    const text = `${open}${line}${close}`;
    return text === "" ? ">" : `> ${text}`;
  });
  return [...quoted, ">", `> — ${mdLink(item.sourceTitle, item.sourceUrl)}`].join("\n");
}

/** One price of a competitor row: rendering, "(via host)" when secondary, evidence link. */
function priceItemMdx(item: CompetitorPriceEvidence): string {
  const via = item.attribution === "secondary" ? ` ${viaLabel(escapeMdxText(sourceHostLabel(item.sourceUrl)))}` : "";
  return `${escapeMdxText(renderEvidenceInline(item))}${via} ${mdLink(item.sourceTitle, item.sourceUrl)}`;
}

/** Plain competitor-strip text for the landing-page prompt (same renderings, no links). */
function priceItemPlain(item: CompetitorPriceEvidence): string {
  const via = item.attribution === "secondary" ? ` ${viaLabel(sourceHostLabel(item.sourceUrl))}` : "";
  return `${renderEvidenceInline(item)}${via}`;
}

// ---------------------------------------------------------------------------
// Year-One Math
// ---------------------------------------------------------------------------

/**
 * Funnel, base and downside lines computed by finance.ts: exact cents, the
 * seats stated when an account pays for more than one, and a downside of
 * floor(base / 2) accounts, which may be zero (no minimum-one clamp).
 */
export function yearOneLines(plan: YearOnePlanV2, tiers: ReadonlyArray<PricingTier>): string {
  const resolved = yearOneTierTerms(plan.tier, tiers);
  if (!resolved.ok) throw new CompileError([`editorial.yearOne.tier: ${resolved.issue}`]);
  const math = computeYearOne(plan, resolved.terms);
  const seats =
    math.seatsPerAccount > 1
      ? { count: math.seatsPerAccount, priceText: seatPriceText(resolved.tier.price, resolved.terms) }
      : null;
  return [
    ...plan.funnel.map((stage) => yearOneFunnelLine(stage.count, stage.stage)),
    yearOneBaseLine(
      {
        accounts: math.baseAccounts,
        perAccountCents: math.perAccountCents,
        period: math.period,
        arrCents: math.arrCents,
      },
      plan.tier,
      seats,
    ),
    yearOneDownsideLine(
      {
        accounts: math.downsideAccounts,
        perAccountCents: math.perAccountCents,
        period: math.period,
        arrCents: math.downsideArrCents,
      },
      math.baseAccounts,
    ),
  ].join("\n");
}

/**
 * The seat note's unit price: the tier's own wording ("$20/developer/month")
 * when it is exactly one price, else the canonical rendering of its terms
 * (a tier price carrying an evidence token is more than one price).
 */
function seatPriceText(price: string, terms: PriceTerms): string {
  return evidenceRefs(price).length === 0 && parsePriceTerms(price) ? price.trim() : formatPriceTerms(terms);
}

// ---------------------------------------------------------------------------
// Required editorial fields
// ---------------------------------------------------------------------------

type Editorial = {
  problemNarrative: string;
  solutionNarrative: string;
  competitiveNarrative: string;
  dontBuildYet: string;
  stackNotes: string;
  brandBrief: string;
  pricingTiers: PricingTier[];
  unitEconomics: UnitEconRow[];
  yearOne: YearOnePlanV2;
  dataModel: DataTable[];
};

/** The editorial fields the deep audit needs, or CompileError naming every gap. */
function requireEditorial(record: ResearchRecordV2): Editorial {
  const ed = record.editorial ?? {};
  const issues: string[] = [];
  const text = (key: "problemNarrative" | "solutionNarrative" | "competitiveNarrative" | "dontBuildYet" | "stackNotes" | "brandBrief") => {
    const value = ed[key]?.trim() ?? "";
    if (!value) issues.push(`editorial.${key} is missing`);
    return value;
  };
  const problemNarrative = text("problemNarrative");
  const solutionNarrative = text("solutionNarrative");
  const competitiveNarrative = text("competitiveNarrative");
  const dontBuildYet = text("dontBuildYet");
  const stackNotes = text("stackNotes");
  const brandBrief = text("brandBrief");
  const pricingTiers = ed.pricingTiers ?? [];
  if (pricingTiers.length < MIN_PRICING_TIERS) {
    issues.push(`editorial.pricingTiers needs ≥${MIN_PRICING_TIERS} tiers (got ${pricingTiers.length})`);
  }
  const unitEconomics = ed.unitEconomics ?? [];
  if (unitEconomics.length < MIN_UNIT_ECONOMICS_ROWS) {
    issues.push(`editorial.unitEconomics needs ≥${MIN_UNIT_ECONOMICS_ROWS} rows (got ${unitEconomics.length})`);
  }
  const dataModel = ed.dataModel ?? [];
  const ideaTables = dataModel.filter((t) => !GENERIC_SETUP_TABLE_NAMES.includes(t.table));
  if (ideaTables.length < MIN_IDEA_TABLES) {
    issues.push(
      `editorial.dataModel needs ≥${MIN_IDEA_TABLES} idea-specific tables beyond ${GENERIC_SETUP_TABLE_NAMES.join("/")} (got ${ideaTables.length})`,
    );
  }
  const yearOne = ed.yearOne;
  if (!yearOne) issues.push("editorial.yearOne is missing (funnel, tier, payingAccounts, seatsPerAccount)");
  if (issues.length > 0 || !yearOne) {
    throw new CompileError([
      ...issues,
      "re-run engine:research; the compiler no longer fills these with generic text",
    ]);
  }
  return {
    problemNarrative,
    solutionNarrative,
    competitiveNarrative,
    dontBuildYet,
    stackNotes,
    brandBrief,
    pricingTiers,
    unitEconomics,
    yearOne,
    dataModel,
  };
}

/** Short audience for repeated mentions; the full brief label appears in the narrative. */
function audienceShortLabel(record: ResearchRecordV2): string {
  return midSentence(
    record.editorial?.audienceShort?.trim() || record.brief.targetCustomer.trim().replace(/\s+/g, " "),
  );
}

/** Sources in first-use order, one per canonical evidence URL. */
function sourceList(ctx: Ctx): Array<{ url: string; title: string }> {
  const seen = new Set<string>();
  const out: Array<{ url: string; title: string }> = [];
  for (const id of ctx.used) {
    const item = ctx.byId.get(id);
    if (!item || seen.has(item.sourceUrl)) continue;
    seen.add(item.sourceUrl);
    out.push({ url: item.sourceUrl, title: item.sourceTitle });
  }
  return out;
}

function fence(lines: string[]): string {
  const body = lines.join("\n");
  if (/`{3,}/.test(body)) {
    throw new CompileError(["a build prompt would contain ``` (from record text), which would break its code fence"]);
  }
  return ["```text", body, "```"].join("\n");
}

/**
 * Compile a contract v2 research record into the MDX body and a manifest
 * stub. The record is re-validated with parseResearchRecord first (a v1
 * record throws LegacyResearchRecordError); a record that cannot become a
 * publishable page throws CompileError.
 */
export function compileResearchRecord(options: CompileOptions): CompileResult {
  const record = parseResearchRecord(options.record);
  const slug = (options.slug ?? record.brief.slug).trim().toLowerCase();
  if (!COMPILE_SLUG_PATTERN.test(slug)) {
    throw new Error(`slug '${slug}' must match ${COMPILE_SLUG_PATTERN}`);
  }
  if (record.mode === "fixture" && !options.allowFixture && !isFixtureSafeSlug(slug)) {
    throw new CompileError([
      `record mode is "fixture" (synthetic research): compile it only to an engine-draft-* or _temp slug, not '${slug}' (ruling R11; tests may pass --allow-fixture)`,
    ]);
  }
  const ed = requireEditorial(record);

  const ctx: Ctx = {
    record,
    byId: new Map(record.evidence.accepted.map((item) => [item.id, item])),
    used: new Set(),
  };
  const name = pageProductName(record);
  const labels = proposalLabels(name);
  const audienceShort = audienceShortLabel(record);
  const steps = record.howItWorks.map(splitNamedStep);
  const tiers = ed.pricingTiers;
  const tierKeys = tiers.map((t) => tierKey(t.name));
  const prose = (text: string, path: string) => proseMdx(text, ctx, path);

  // --- The Problem: narrative, community summary, verbatim quotes ---------
  const quotes = record.community.quoteIds.map((id) => quoteItem(ctx, id));
  const problemBody = joinBlocks([
    prose(ed.problemNarrative, "editorial.problemNarrative"),
    prose(record.community.summary, "community.summary"),
    quotes.map(quoteBlock).join("\n\n"),
  ]);

  // --- The Solution: narrative, How it works, what not to build -----------
  const howItWorksList = steps
    .map((s, i) => `${i + 1}. **${escapeMdxText(s.title)}** — ${prose(s.body, `howItWorks[${i}]`)}`)
    .join("\n");
  const solutionBody = joinBlocks([
    prose(ed.solutionNarrative, "editorial.solutionNarrative"),
    escapeMdxText(labels.howItWorks),
    HOW_IT_WORKS_LABEL,
    howItWorksList,
    escapeMdxText(labels.dontBuildYet),
    prose(ed.dontBuildYet, "editorial.dontBuildYet"),
  ]);

  // --- Market Research: summary, why now, evidence rows, keyword rows -----
  const stats = record.market.statIds.map((id) => statItem(ctx, id));
  const keywordLines = record.keywords.map(keywordRowMdx).join("\n");
  const marketBody = joinBlocks([
    prose(record.market.summary, "market.summary"),
    `Why now: ${prose(record.whyNow, "whyNow")}`,
    `**${LABEL.marketSignals}**`,
    stats.map(marketSignalRow).join("\n"),
    keywordLines ? `**${LABEL.searchDemand}** ${SEARCH_DEMAND_NOTE}` : null,
    keywordLines || null,
  ]);

  // --- Competitive Landscape: narrative, one row per competitor -----------
  const competitorPrices = record.competitors.map((c) => ({
    name: c.name,
    notes: c.notes,
    prices: c.priceIds.map((id) => priceItem(ctx, id)),
  }));
  const competitorLines = competitorPrices
    .map((c, i) => {
      const notes = c.notes ? ` — ${prose(trimDot(c.notes), `competitors[${i}].notes`)}.` : " —";
      return `- **${escapeMdxText(c.name)}**${notes} ${PUBLISHED_PRICING} ${c.prices.map(priceItemMdx).join("; ")}.`;
    })
    .join("\n");
  const competitiveBody = joinBlocks([
    prose(ed.competitiveNarrative, "editorial.competitiveNarrative"),
    competitorLines,
    `**${LABEL.yourOpportunity}**`,
    prose(record.goToMarket.positioning, "goToMarket.positioning"),
  ]);

  // --- Business Model: proposals and planning assumptions -----------------
  const tierLines = tiers
    .map(
      (t, i) =>
        `- **${escapeMdxText(t.name)}** (${prose(t.price, `editorial.pricingTiers[${i}].price`)}) — ${prose(t.includes, `editorial.pricingTiers[${i}].includes`)}`,
    )
    .join("\n");
  const unitLines = ed.unitEconomics
    .map(
      (u, i) =>
        `- **${prose(u.value, `editorial.unitEconomics[${i}].value`)}** — ${prose(u.label, `editorial.unitEconomics[${i}].label`)}`,
    )
    .join("\n");
  const channelLines = record.goToMarket.channels
    .map((c, i) => `- ${prose(c, `goToMarket.channels[${i}]`)}`)
    .join("\n");
  const businessBody = joinBlocks([
    prose(record.goToMarket.pricingNotes, "goToMarket.pricingNotes"),
    escapeMdxText(labels.pricing),
    tierLines,
    `**${LABEL.unitEconomics}**`,
    escapeMdxText(labels.unitEconomics),
    unitLines,
    `**${LABEL.yearOneMath}**`,
    escapeMdxText(labels.yearOne),
    ed.yearOne.assumptions ? prose(ed.yearOne.assumptions, "editorial.yearOne.assumptions") : null,
    yearOneLines(ed.yearOne, tiers),
    `**${LABEL.channels}**`,
    escapeMdxText(labels.channels),
    channelLines,
  ]);

  // --- Recommended Tech Stack ---------------------------------------------
  const stepTitles = steps.map((s) => s.title).join(", ");
  const tableNames = ed.dataModel.map((t) => t.table);
  const stackBody = joinBlocks([
    escapeMdxText(labels.stack),
    prose(ed.stackNotes, "editorial.stackNotes"),
    [
      `- **Next.js + TypeScript** — screens for ${escapeMdxText(stepTitles)}`,
      `- **Postgres (Supabase or Neon)** — ${escapeMdxText(tableNames.join(", "))}`,
      "- **Auth (Clerk or Supabase Auth)** — workspace seats and roles",
      `- **Stripe Billing** — ${escapeMdxText(tiers.map((t) => t.name).join(" / "))} subscriptions`,
      "- **Vercel** — previews and production",
    ].join("\n"),
  ]);

  // --- AI Prompts (plain text inside fences; no figure or quote of our own) --
  const planCheck = tierKeys.map((k) => `'${k}'`).join(",");
  const priceEnv = tierKeys.map((k) => `STRIPE_PRICE_${k.toUpperCase()}`).join(", ");
  const tierSummary = tiers.map((t) => `${t.name} at ${fenceText(t.price, ctx)}`).join("; ");
  const dontBuild = fenceText(ed.dontBuildYet, ctx);
  const coreFeatureLines = steps.map((s) => {
    const body = fenceText(s.body, ctx);
    const firstSentence = body.split(/(?<=[.!?])\s+/)[0] ?? body;
    return `- ${s.title}: ${trimDot(firstSentence)}.`;
  });
  const competitorStrip = competitorPrices
    .map((c) => `${c.name}: ${c.prices.map(priceItemPlain).join(", ")}`)
    .join("; ");
  const setupTables = [
    `- workspaces(id uuid pk, name text, plan text check plan in (${planCheck}), created_at timestamptz)`,
    "- members(id, workspace_id fk, user_id, role text check role in ('owner','admin','member'))",
    ...ed.dataModel.map((t) => `- ${t.table}(${fenceText(t.columns, ctx)})`),
    "- usage_events(id, workspace_id fk, tokens int, usd_micros bigint)",
  ];
  const promptFences: Record<(typeof PROMPT_TITLES)[number], string[]> = {
    "Project Setup": [
      `Create a Next.js App Router (TypeScript, Tailwind) app named ${name} for ${audienceShort}.`,
      "Postgres tables with constraints:",
      ...setupTables,
      `Stripe catalog must match the pricing tiers exactly: ${tierSummary}. Webhook enforces plan limits and seat caps; meter usage_events before starting another job.`,
      `Env: DATABASE_URL, STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, ${priceEnv}, OPENAI_API_KEY or ANTHROPIC_API_KEY, NEXT_PUBLIC_APP_URL.`,
      `Non-goals: ${dontBuild}`,
    ],
    "Core Feature": [
      `Build ${name}'s core workflow as one screen per step, in this order:`,
      ...coreFeatureLines,
      `Persist state between screens so a user can leave and resume. Acceptance: on sample data, a new workspace goes ${steps.map((s) => s.title).join(" → ")} without leaving the app, and every generated item links back to its source.`,
    ],
    "Landing Page": [
      `One-pager for ${name}. Hero line: ${record.brief.oneLiner}`,
      `Sections: the problem for ${audienceShort}; how ${name} works (${stepTitles}); competitor strip (${competitorStrip}); pricing (${tierSummary}); a single CTA into the first workflow step.`,
    ],
    "Branding Package": [
      `Brand ${name} for ${audienceShort}. ${fenceText(ed.brandBrief, ctx)}`,
      `Deliverables: wordmark and a small mark, hex palette with one accent, type pairing, logo clearspace rules, a short set of CTA lines, a pricing-page headline and onboarding email subject lines. Always call the product ${name}, never a generic AI platform.`,
    ],
  };
  const promptsBody = [
    `Copy these ${escapeMdxText(name)} build prompts into Claude, Cursor, or your AI coding tool.`,
    ...PROMPT_TITLES.flatMap((title, i) => ["", `**${promptHeadingText(i)}**`, "", fence(promptFences[title])]),
  ].join("\n");

  // --- Sources: every evidence URL the page uses --------------------------
  const expectedUsed = usedEvidenceIds(record);
  const unrendered = [...expectedUsed].filter((id) => !ctx.used.has(id));
  const unexpected = [...ctx.used].filter((id) => !expectedUsed.has(id));
  if (unrendered.length > 0 || unexpected.length > 0) {
    throw new CompileError([
      `compiler defect: the page's evidence differs from usedEvidenceIds (not rendered: ${unrendered.join(", ") || "none"}; not expected: ${unexpected.join(", ") || "none"})`,
    ]);
  }
  const citations = sourceList(ctx);
  if (citations.length < MIN_SOURCE_LINKS) {
    throw new CompileError([
      `record cites ${citations.length} distinct source(s); the auditor needs ≥${MIN_SOURCE_LINKS}`,
    ]);
  }
  const sourceLinks = citations.map((c) => `- ${mdLink(c.title, c.url)}`).join("\n");

  const sections: Record<(typeof SECTION_TITLES)[number], string> = {
    "The Problem": problemBody,
    "The Solution": solutionBody,
    "Market Research": marketBody,
    "Competitive Landscape": competitiveBody,
    "Business Model": businessBody,
    "Recommended Tech Stack": stackBody,
    "AI Prompts to Build This": promptsBody,
  };

  const body = collapseDuplicateSentences(
    [
      ...SECTION_TITLES.map((title) => `## ${title}\n\n${sections[title]}\n`),
      `## ${SOURCES_TITLE}\n\n${sourceLinks}\n`,
    ].join("\n"),
  );

  // ENGINE_MARKER_LINE marks the page as compiler output, so the auditor
  // holds it to the deep bar wherever it sits (P3-8) and a later compile
  // knows it may replace it. The site reads only title and publishedAt from
  // frontmatter; the marker is ignored there.
  const mdx = [
    "---",
    `slug: ${JSON.stringify(slug)}`,
    `title: ${JSON.stringify(record.brief.title)}`,
    ENGINE_MARKER_LINE,
    "---",
    "",
    body,
  ].join("\n");

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
  const highlights = ideaHighlights(record);

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
    ...(highlights ? { highlights } : {}),
    publishedAt: options.publishedAt ?? new Date().toISOString().slice(0, 10),
    researchLevel: "deep",
    provenance: {
      researchCalls: record.provenance.providerCalls.map((c) => `${c.provider}:${c.operation}`),
      citations: citations.length,
      wordCount: countWords(body),
      auditPassed: false,
      auditRunAt: record.provenance.ranAt,
      publishNotes: `engine compile; product=${name}; costUsd=${record.provenance.costUsd.toFixed(4)}; tagging left for operator`,
      researchMode: record.mode,
    },
  };

  return { slug, mdx, manifestEntry };
}
