/**
 * Final artifact audit for engine pages (WP54: review findings F1, F2 and F6;
 * evidence contract §9; rulings R10 and R11).
 *
 * The page is parsed with the same Markdown stack the site renders with
 * (@mdx-js/mdx + remark-gfm), so a sentence appended to a quote as a lazy
 * continuation line, a bare URL that GFM turns into a link, a link hidden
 * in a list or a fence that swallows text is read exactly as a reader would
 * see it. The page holds only audited facts (R10); the record proves
 * consistency, not authenticity (ruling R4), and this audit proves the page
 * matches the record:
 *
 *   Structure     Only what the compiler writes: no JSX, expressions, HTML,
 *                 images, footnotes, link definitions or reference links, no
 *                 raw "[[ev:…]]" token; fenced code only in "AI Prompts to
 *                 Build This"; nothing before ## The Problem or after
 *                 ## Sources; ## Sources is a single list of source links;
 *                 the proposal labels stay.
 *   Links (R10)   Every link targets an evidence source the record uses
 *                 (usedEvidenceIds), and its text is that source's title or
 *                 renderEvidenceInline of one of that source's used items.
 *                 Quote attributions, market rows and price links carry their
 *                 own item's source title; ## Sources lists exactly the used
 *                 sources; a competitor's notes cite only its own prices.
 *                 Visible text drops the invisible U+2060 that escapeMdxText
 *                 puts into URLs, www hosts and emails (AUTOLINK_BREAK_CHAR).
 *   Quotes (F2)   Each blockquote is one unit: the quote paragraphs plus a
 *                 last line "— [title](url)". The quote's MDX text must
 *                 strictly equal a selected accepted quote
 *                 (quoteMatchesExcerpt, ruling R3), the link must be the
 *                 same source (sameSource after the compiler's linkUrl form;
 *                 a different HN thread on the same host fails) and its text
 *                 that source's title. Missing, malformed or ambiguous
 *                 attribution fails; Markdown inside a quote fails; a
 *                 blockquote that is not a selected quote fails; every
 *                 selected quote must appear; the minimum counts distinct
 *                 quote ids, so a repeated quote adds nothing. Outside the
 *                 quote blocks, a double-quoted span of three or more words
 *                 (findQuotedSpans) must be a quote the record uses.
 *   Rows          Market signal rows (marketSignalRow): the rendering of a
 *                 selected stat, which names its subject, metric and period
 *                 (R7), and its own source; no label to relabel. A used
 *                 stat's subject must be figure-free (it is masked inside the
 *                 verified rendering). Competitor rows: the record's name and exactly
 *                 its accepted prices, each with its own source and a
 *                 "(via host)" label when secondary. A pricing URL may back
 *                 several competitors only when every price on it is a
 *                 separately bound secondary price (ruling R5; defense in
 *                 depth). Keyword rows, pricing tier rows and unit-economics
 *                 values print the record exactly. Competitor notes and other
 *                 labels may be polished; figures may not.
 *   Figures (F1)  In every section, a figure (findUnboundFigures) outside the
 *                 allowlisted spots is an "unbound figure": linked evidence
 *                 renderings (link text = rendering, target = that item's
 *                 source), verified evidence rows, source-title links,
 *                 keyword rows, tier rows and unit-economics values equal to
 *                 the record, the Year-One lines, bare years, and digits
 *                 inside competitor names. A bare (unlinked) rendering is not
 *                 allowlisted, and a market stat's model-written subject
 *                 never is. Inside a prompt fence, figures must be evidence
 *                 renderings or NUMERIC_PROPOSAL_FIELDS text (tier prices and
 *                 includes, unit-economics values, data-model columns).
 *                 findUnboundFigures reads number words and any script's
 *                 digits (R6). A guard against typed-in figures, not proof.
 *   Money (F6)    Year-One Math is recomputed with finance.ts and the
 *                 displayed accounts, per-account price, period, ARR, tier,
 *                 seats, downside and funnel are compared exactly. Business
 *                 Model holds exactly one base and one downside line. No
 *                 section states another revenue total (a money amount beside
 *                 ARR, MRR, revenue, run-rate, sales or income) or a
 *                 Year-One-style computation (N × $X/… = $Y).
 *   Identity      A mode "fixture" record backs only an engine-draft-* page
 *                 (R11). A manifest row's highlights must equal
 *                 ideaHighlights(record) and its provenance.researchMode the
 *                 record's mode.
 */

import { createProcessor } from "@mdx-js/mdx";
import remarkGfm from "remark-gfm";

import { isEngineDraftSlug } from "../engine-drafts.ts";
import { comparePriceTerms, parsePriceTerms } from "./evidence/amount.ts";
import { canonicalSourceUrl, sameSource, sourceHostLabel } from "./evidence/citation.ts";
import {
  EVIDENCE_MINIMUMS,
  EVIDENCE_TOKEN_RE,
  NUMERIC_PROPOSAL_FIELDS,
  type AcceptedEvidence,
  type CommunityQuoteEvidence,
  type ResearchRecordV2,
} from "./evidence/contract.ts";
import { AUTOLINK_BREAK_CHAR, quoteMatchesExcerpt } from "./evidence/quote.ts";
import { findQuotedSpans, findUnboundFigures, renderEvidenceInline } from "./evidence/tokens.ts";
import { computeYearOne, formatUsdCents, YearOneMathError, yearOneTierTerms, type YearOneMath } from "./finance.ts";
import {
  ideaHighlights,
  keywordRowText,
  LABEL,
  linkUrl,
  pageProductName,
  parseYearOneLine,
  periodAbbrev,
  PROMPT_TITLES,
  PROMPTS_TITLE,
  promptHeadingText,
  proposalLabels,
  PUBLISHED_PRICING,
  recordTextsAt,
  SOURCES_TITLE,
  splitViaLabel,
  tidyProse,
  usedEvidenceIds,
  type DisplayedYearOneLine,
} from "./page-format.ts";
import { LegacyResearchRecordError, parseResearchRecord, ResearchRecordParseError } from "./research-record.ts";

// ---------------------------------------------------------------------------
// Record loading
// ---------------------------------------------------------------------------

export type RecordLoad = { ok: true; record: ResearchRecordV2 } | { ok: false; error: string };

const MAX_ISSUES_SHOWN = 12;

/**
 * Parse an engine page's research record with parseResearchRecord. A v1
 * record yields the LegacyResearchRecordError re-research message; any other
 * invalid record lists its first issues. Never upgrades or trusts a record.
 */
export function loadEngineRecord(raw: unknown, label: string): RecordLoad {
  try {
    return { ok: true, record: parseResearchRecord(raw) };
  } catch (error) {
    if (error instanceof LegacyResearchRecordError) return { ok: false, error: error.message };
    if (error instanceof ResearchRecordParseError) {
      const shown = error.issues.slice(0, MAX_ISSUES_SHOWN);
      const more = error.issues.length > shown.length ? ` (+${error.issues.length - shown.length} more)` : "";
      return {
        ok: false,
        error: `research record ${label} is not a valid contract v2 record: ${shown.join("; ")}${more}`,
      };
    }
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Markdown tree
// ---------------------------------------------------------------------------

/** The parts of an mdast node this audit reads, with source offsets. */
export type MdNode = {
  type: string;
  value: string | null;
  url: string | null;
  alt: string | null;
  depth: number | null;
  start: number;
  end: number;
  children: MdNode[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function offsetOf(position: unknown, key: "start" | "end"): number {
  if (!isRecord(position)) return -1;
  const point = position[key];
  return isRecord(point) && typeof point.offset === "number" ? point.offset : -1;
}

function toNode(raw: unknown): MdNode {
  if (!isRecord(raw) || typeof raw.type !== "string") {
    return { type: "invalid", value: null, url: null, alt: null, depth: null, start: -1, end: -1, children: [] };
  }
  return {
    type: raw.type,
    value: typeof raw.value === "string" ? raw.value : null,
    url: typeof raw.url === "string" ? raw.url : null,
    alt: typeof raw.alt === "string" ? raw.alt : null,
    depth: typeof raw.depth === "number" ? raw.depth : null,
    start: offsetOf(raw.position, "start"),
    end: offsetOf(raw.position, "end"),
    children: Array.isArray(raw.children) ? raw.children.map(toNode) : [],
  };
}

let processor: ReturnType<typeof createProcessor> | null = null;

/** Parse an MDX body (no frontmatter) the way the site does, or the parser's error. */
export function parseMdxBody(body: string): { ok: true; root: MdNode } | { ok: false; error: string } {
  processor ??= createProcessor({ remarkPlugins: [remarkGfm] });
  try {
    const tree: unknown = processor.parse(body);
    return { ok: true, root: toNode(tree) };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

const INLINE_CONTAINERS = new Set(["paragraph", "heading", "strong", "emphasis", "delete", "link", "tableCell"]);

const AUTOLINK_BREAK_RE = new RegExp(AUTOLINK_BREAK_CHAR, "g");

/**
 * A text node's value as a reader sees it: escapeMdxText puts an invisible
 * U+2060 (AUTOLINK_BREAK_CHAR) inside "https://", "www." and before "@" so
 * GFM cannot autolink them; it renders as nothing, so it is dropped before
 * any comparison with record text.
 */
function textValue(node: MdNode): string {
  return (node.value ?? "").replace(AUTOLINK_BREAK_RE, "");
}

/** What a reader sees: text values, alt text, line breaks; no code fences. */
function visible(node: MdNode): string {
  if (node.type === "text" || node.type === "inlineCode") return textValue(node);
  if (node.type === "break") return "\n";
  if (node.type === "image") return node.alt ?? "";
  if (node.type === "code") return "";
  return node.children.map(visible).join(INLINE_CONTAINERS.has(node.type) ? "" : "\n");
}

function norm(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function walk(node: MdNode, visit: (node: MdNode) => void): void {
  visit(node);
  for (const child of node.children) walk(child, visit);
}

type Section = { title: string; heading: MdNode; nodes: MdNode[] };
type Layout = { preamble: MdNode[]; sections: Section[] };

function layoutOf(root: MdNode): Layout {
  const preamble: MdNode[] = [];
  const sections: Section[] = [];
  for (const node of root.children) {
    if (node.type === "heading" && node.depth === 2) {
      sections.push({ title: norm(visible(node)), heading: node, nodes: [] });
      continue;
    }
    const current = sections[sections.length - 1];
    if (current) current.nodes.push(node);
    else preamble.push(node);
  }
  return { preamble, sections };
}

function clip(text: string, max = 80): string {
  const t = norm(text);
  return t.length <= max ? t : `${t.slice(0, max - 1)}…`;
}

/** True when a paragraph is exactly one bold label (visible text `label`). */
function isBoldLabel(node: MdNode, label: string): boolean {
  if (node.type !== "paragraph") return false;
  const parts = node.children.filter((c) => !(c.type === "text" && norm(c.value ?? "") === ""));
  return parts.length === 1 && parts[0]?.type === "strong" && norm(visible(parts[0])) === label;
}

/** Same source after the compiler's link encoding is applied to both URLs. */
function sameLinkedSource(pageUrl: string, evidenceUrl: string): boolean {
  return sameSource(linkUrl(pageUrl), linkUrl(evidenceUrl));
}

/** The comparison key of a link target or evidence URL (canonical, in the compiler's link form). */
function sourceKey(url: string): string | null {
  return canonicalSourceUrl(linkUrl(url));
}

// ---------------------------------------------------------------------------
// Audit context
// ---------------------------------------------------------------------------

type Ctx = {
  body: string;
  lineOffset: number;
  errors: string[];
  warnings: string[];
};

function lineOf(ctx: Ctx, offset: number): number {
  if (offset < 0) return 0;
  let line = 1;
  for (let i = 0; i < offset && i < ctx.body.length; i += 1) if (ctx.body[i] === "\n") line += 1;
  return line + ctx.lineOffset;
}

type SourceEntry = { url: string; titles: Set<string>; items: AcceptedEvidence[] };

type Evidence = {
  byId: ReadonlyMap<string, AcceptedEvidence>;
  /** Items the page uses (usedEvidenceIds): selected ids plus tokens in the compiled fields. */
  used: AcceptedEvidence[];
  /** Normalized renderEvidenceInline text per used item id. */
  rendering: ReadonlyMap<string, string>;
  /** Used evidence sources by sourceKey: their titles and used items. */
  sources: ReadonlyMap<string, SourceEntry>;
  /** Community quotes the page uses. */
  quotes: CommunityQuoteEvidence[];
};

function evidenceOf(record: ResearchRecordV2): Evidence {
  const byId = new Map(record.evidence.accepted.map((item) => [item.id, item]));
  const used: AcceptedEvidence[] = [];
  for (const id of usedEvidenceIds(record)) {
    const item = byId.get(id);
    if (item) used.push(item);
  }
  const rendering = new Map(used.map((item) => [item.id, norm(renderEvidenceInline(item))]));
  const sources = new Map<string, SourceEntry>();
  for (const item of used) {
    const key = sourceKey(item.sourceUrl);
    if (key === null) continue;
    const entry = sources.get(key) ?? { url: item.sourceUrl, titles: new Set<string>(), items: [] };
    entry.titles.add(norm(item.sourceTitle));
    entry.items.push(item);
    sources.set(key, entry);
  }
  const quotes = used.filter((item): item is CommunityQuoteEvidence => item.kind === "community_quote");
  return { byId, used, rendering, sources, quotes };
}

function itemsOf<K extends AcceptedEvidence["kind"]>(
  ids: ReadonlyArray<string>,
  ev: Evidence,
  kind: K,
): Array<Extract<AcceptedEvidence, { kind: K }>> {
  const out: Array<Extract<AcceptedEvidence, { kind: K }>> = [];
  for (const id of ids) {
    const item = ev.byId.get(id);
    if (item && isKind(item, kind)) out.push(item);
  }
  return out;
}

function isKind<K extends AcceptedEvidence["kind"]>(
  item: AcceptedEvidence,
  kind: K,
): item is Extract<AcceptedEvidence, { kind: K }> {
  return item.kind === kind;
}

/** Each token as its canonical rendering, as in a prompt fence (an unknown id stays as written, so it never matches). */
function expandTokens(text: string, ev: Evidence): string {
  return text.replace(new RegExp(EVIDENCE_TOKEN_RE.source, "g"), (token: string, id: string) => {
    const item = ev.byId.get(id);
    return item ? renderEvidenceInline(item) : token;
  });
}

/** Record text as the page's prose shows it once the compiler has expanded it: tidyProse, then tokens. */
function plainProse(text: string, ev: Evidence): string {
  return expandTokens(tidyProse(text), ev);
}

// ---------------------------------------------------------------------------
// Text pieces and the rules that read them
// ---------------------------------------------------------------------------

/**
 * Where a run of visible text came from, which decides the rules it is
 * exempt from: "evidence" (a verified evidence rendering or source title,
 * a keyword row), "proposal" (a tier row or unit-economics value equal to
 * the record, a record value inside a prompt fence), "yearOne" (a verified
 * Year-One count or line) and "prose" (everything else).
 */
type SegKind = "prose" | "evidence" | "proposal" | "yearOne";
type Seg = { text: string; kind: SegKind };
type Piece = { section: string; line: number; segs: Seg[]; fence: boolean };

/** Figures: only prose counts. */
const FIGURE_MASK: ReadonlySet<SegKind> = new Set<SegKind>(["evidence", "proposal", "yearOne"]);
/** Quoted spans: verified evidence (renderings, titles) is exempt; proposals are not. */
const QUOTE_MASK: ReadonlySet<SegKind> = new Set<SegKind>(["evidence"]);
/** Revenue totals and Year-One-style lines: evidence and the verified Year-One lines are exempt. */
const MONEY_MASK: ReadonlySet<SegKind> = new Set<SegKind>(["evidence", "yearOne"]);

function pieceText(piece: Piece, masked: ReadonlySet<SegKind>): string {
  return piece.segs.map((s) => (masked.has(s.kind) ? " ".repeat(s.text.length) : s.text)).join("");
}

function relabel(segs: Seg[], from: SegKind, to: SegKind): Seg[] {
  return segs.map((s) => (s.kind === from ? { ...s, kind: to } : s));
}

const MONEY = String.raw`(?:(?:US|CA|AU|C|A)?[$€£]\s?\d[\d,]*(?:\.\d+)?|(?:USD|EUR|GBP|CAD|AUD)\s?\d[\d,]*(?:\.\d+)?|\d[\d,]*(?:\.\d+)?\s?(?:USD|EUR|GBP|CAD|AUD)\b)(?:\s?(?:k|m|mn|bn|b|thousand|million|billion|trillion)\b)?`;
const REVENUE_NOUN = String.raw`(?:ARR|MRR|revenue|run[- ]?rate|sales|income)`;
const REVENUE_MODIFIER = String.raw`(?:annual|annualized|yearly|monthly|recurring|new|total|gross|net|projected|expected)`;
/**
 * A revenue total: a money amount beside revenue wording, either way round.
 * "$54,000 ARR", "$5.4 million in annual revenue", "$1.2M a year in sales",
 * "ARR of $60,000", "Target ARR: 5,400,000 USD", "annual run-rate of $250k".
 * Between the amount and the wording only "in"/"of" and revenue modifiers
 * (annual, recurring, …) may stand, so a tier whose description mentions ARR
 * after its price ("$12/month) — ARR dashboards") is not one. A bare
 * "annual"/"annually" beside a price is a billing period, not revenue.
 */
const REVENUE_TOTAL_RE = new RegExp(
  String.raw`${MONEY}(?:\s*\/\s*(?:mo|month|yr|year))?(?:\s+(?:a|per)\s+(?:year|month))?(?:\s+(?:in|of))?(?:\s+${REVENUE_MODIFIER})*\s+${REVENUE_NOUN}\b` +
    String.raw`|\b(?:${REVENUE_MODIFIER}\s+)*${REVENUE_NOUN}\s*(?:[:=]|of|at|is|was|reaches|reaching|hits|hitting|to|totals?|totaling|near|around|about|over|above)?\s*(?:of\s+)?~?\s*${MONEY}`,
  "i",
);

/** A Year-One-style computation: a count times a money amount (per period) equals an amount. */
const YEAR_ONE_STYLE_RE = /\d[\d,]*\s*[×xX*]\s*(?:US)?[$€£]\s?\d[\d,]*(?:\.\d+)?(?:\s*\/\s*[A-Za-z]+)*\s*=\s*(?:US)?[$€£]?\s?\d/;

type State = {
  ctx: Ctx;
  record: ResearchRecordV2;
  ev: Evidence;
  /** Nodes a row audit already read (their figures and links are checked there). */
  handled: Set<MdNode>;
  pieces: Piece[];
  /** Competitor names the page prints bare: their digits are not figures (R10 "names"). */
  names: string[];
};

/**
 * The names whose digits the figure rule ignores (R10 "names"), longest
 * first. Only competitor names: they are the evidence's vendor names, while
 * the product and pricing-tier names are writer text that ruling R6 keeps
 * figure-free (WRITER_TEXT_FIELDS). A name without a letter is never one, so
 * a "name" made of a figure cannot hide that figure.
 */
function recordNames(record: ResearchRecordV2): string[] {
  const names = record.competitors.map((c) => c.name.trim()).filter((n) => /\p{L}/u.test(n));
  return [...new Set(names)].sort((a, b) => b.length - a.length);
}

/** Text with every whole occurrence of a name blanked (same length), for the figure rule. */
function blankNames(text: string, names: ReadonlyArray<string>): string {
  let out = text;
  for (const name of names) {
    for (let at = out.indexOf(name); at >= 0; at = out.indexOf(name, at + name.length)) {
      const end = at + name.length;
      if (isWordChar(out[at - 1] ?? "") || isWordChar(out[end] ?? "")) continue;
      out = `${out.slice(0, at)}${" ".repeat(name.length)}${out.slice(end)}`;
    }
  }
  return out;
}

type LinkVerdict =
  | { kind: "title" | "rendering" }
  | { kind: "untargeted" }
  | { kind: "misplaced"; item: AcceptedEvidence }
  | { kind: "unknown" };

/** What a link's text is, given its target (the target itself is checked page-wide). */
function classifyLink(ev: Evidence, url: string, text: string): LinkVerdict {
  const key = sourceKey(url);
  const entry = key === null ? undefined : ev.sources.get(key);
  if (!entry) return { kind: "untargeted" };
  if (entry.titles.has(text)) return { kind: "title" };
  if (entry.items.some((item) => ev.rendering.get(item.id) === text)) return { kind: "rendering" };
  const other = ev.used.find((item) => ev.rendering.get(item.id) === text);
  return other ? { kind: "misplaced", item: other } : { kind: "unknown" };
}

/**
 * A link inside prose: verified (title or rendering of its own source) or
 * reported and kept as prose. `at` is the offset of the nearest positioned
 * ancestor: GFM's autolinks carry no position of their own.
 */
function linkSeg(state: State, link: MdNode, at: number): Seg {
  const text = norm(visible(link));
  const url = link.url ?? "";
  const verdict = classifyLink(state.ev, url, text);
  if (verdict.kind === "title" || verdict.kind === "rendering") return { text, kind: "evidence" };
  const line = lineOf(state.ctx, link.start >= 0 ? link.start : at);
  if (verdict.kind === "misplaced") {
    state.ctx.errors.push(
      `evidence link "${clip(text, 60)}" near line ${line} points to ${url}, but its evidence source is ${verdict.item.sourceUrl}`,
    );
  } else if (verdict.kind === "unknown") {
    state.ctx.errors.push(
      `link "${clip(text, 60)}" at line ${line} to ${clip(url, 120)}: the text must be that source's title or the rendering of one of its evidence items`,
    );
  }
  return { text, kind: "prose" };
}

/** Inline nodes as segments; links are verified on the way. `at`: offset for nodes without a position. */
function inlineSegs(state: State, nodes: MdNode[], at = -1): Seg[] {
  const out: Seg[] = [];
  for (const node of nodes) {
    const here = node.start >= 0 ? node.start : at;
    if (node.type === "text" || node.type === "inlineCode") out.push({ text: textValue(node), kind: "prose" });
    else if (node.type === "break") out.push({ text: "\n", kind: "prose" });
    else if (node.type === "image") out.push({ text: node.alt ?? "", kind: "prose" });
    else if (node.type === "link") out.push(linkSeg(state, node, here));
    else out.push(...inlineSegs(state, node.children, here));
  }
  return out;
}

function addPiece(state: State, section: string, node: MdNode, segs: Seg[], fence = false): void {
  state.pieces.push({ section, line: lineOf(state.ctx, node.start), segs, fence });
}

/** Every node a row audit did not read, as pieces (blockquotes are the quote audit's). */
function collectPieces(state: State, section: Section, fenceValues: ReadonlyArray<{ text: string; kind: SegKind }>): void {
  const visit = (node: MdNode) => {
    if (state.handled.has(node) || node.type === "blockquote") return;
    if (node.type === "code") {
      // Outside the prompt section a fence is a structure error already.
      if (section.title === PROMPTS_TITLE) addPiece(state, section.title, node, maskValues(node.value ?? "", fenceValues), true);
      return;
    }
    if (INLINE_CONTAINERS.has(node.type)) {
      addPiece(state, section.title, node, inlineSegs(state, node.children, node.start));
      return;
    }
    for (const child of node.children) visit(child);
  };
  for (const node of section.nodes) visit(node);
}

function isWordChar(ch: string): boolean {
  return /[\p{L}\p{N}]/u.test(ch);
}

/**
 * Plain text with every occurrence of the given values (longest first, not
 * inside a word) marked with the value's kind; the rest is prose. Used for
 * prompt fences, which hold record values as plain text by design.
 */
function maskValues(text: string, values: ReadonlyArray<{ text: string; kind: SegKind }>): Seg[] {
  const kinds: Array<SegKind> = new Array<SegKind>(text.length).fill("prose");
  const taken: boolean[] = new Array<boolean>(text.length).fill(false);
  for (const value of values) {
    if (value.text.length === 0) continue;
    for (let at = text.indexOf(value.text); at >= 0; at = text.indexOf(value.text, at + 1)) {
      const end = at + value.text.length;
      if (isWordChar(text[at - 1] ?? "") || isWordChar(text[end] ?? "")) continue;
      if (taken.slice(at, end).some(Boolean)) continue;
      for (let i = at; i < end; i += 1) {
        kinds[i] = value.kind;
        taken[i] = true;
      }
    }
  }
  const segs: Seg[] = [];
  for (let i = 0; i < text.length; i += 1) {
    const kind = kinds[i] ?? "prose";
    const last = segs[segs.length - 1];
    if (last && last.kind === kind) last.text += text[i] ?? "";
    else segs.push({ text: text[i] ?? "", kind });
  }
  return segs;
}

/**
 * Record values a prompt fence may hold: renderings of the evidence the page
 * uses, and the text of the numeric proposal slots (NUMERIC_PROPOSAL_FIELDS:
 * tier prices and includes, unit-economics values, data-model columns; the
 * numeric counts are not text and never appear in a fence).
 */
function fenceValuesOf(record: ResearchRecordV2, ev: Evidence): Array<{ text: string; kind: SegKind }> {
  const values: Array<{ text: string; kind: SegKind }> = [
    ...ev.used.map((item) => ({ text: renderEvidenceInline(item), kind: "evidence" as const })),
    ...NUMERIC_PROPOSAL_FIELDS.flatMap((field) =>
      recordTextsAt(record, field).map(({ text }) => ({ text: expandTokens(text, ev), kind: "proposal" as const })),
    ),
  ];
  return values.sort((a, b) => b.text.length - a.text.length);
}

/** The four page-wide text rules; returns the number of unbound figures. */
function applyRules(state: State): number {
  const { ctx, ev } = state;
  let unbound = 0;
  for (const piece of state.pieces) {
    const figureText = blankNames(pieceText(piece, FIGURE_MASK), state.names);
    for (const hit of findUnboundFigures(figureText)) {
      unbound += 1;
      const context = norm(figureText.slice(Math.max(0, hit.index - 40), hit.index + hit.figure.length + 40));
      ctx.errors.push(
        piece.fence
          ? `${piece.section}: unbound figure "${hit.figure}" in a build prompt near line ${piece.line} ("…${context}…") — prompt figures must be record values (tier prices and includes, data-model columns) or evidence renderings`
          : `${piece.section}: unbound figure "${hit.figure}" near line ${piece.line} ("…${context}…") — not a rendering of the record's evidence (guard, not proof of truth)`,
      );
    }
    for (const { inner } of findQuotedSpans(pieceText(piece, QUOTE_MASK))) {
      if (ev.quotes.some((q) => quoteMatchesExcerpt(inner, q.excerpt))) continue;
      ctx.errors.push(
        `${piece.section}: quoted text "${clip(inner, 120)}" near line ${piece.line} is not an accepted community quote this record uses; quotations reach the page only through quote evidence`,
      );
    }
    const moneyText = pieceText(piece, MONEY_MASK);
    const revenue = REVENUE_TOTAL_RE.exec(moneyText);
    if (revenue) {
      ctx.errors.push(
        `${piece.section} states another revenue total at line ${piece.line} ("${clip(revenue[0], 80)}"); only the Year-One Math base and downside lines may state ARR, MRR or revenue totals`,
      );
    }
    const computation = YEAR_ONE_STYLE_RE.exec(moneyText);
    if (computation) {
      ctx.errors.push(
        `${piece.section}: a Year-One-style computation at line ${piece.line} ("${clip(computation[0], 80)}") outside Year-One Math; only its base and downside lines compute revenue`,
      );
    }
  }
  return unbound;
}

// ---------------------------------------------------------------------------
// Structure (record-independent)
// ---------------------------------------------------------------------------

const MDX_ONLY_NODES = new Set(["mdxJsxFlowElement", "mdxJsxTextElement", "mdxFlowExpression", "mdxTextExpression", "mdxjsEsm", "html"]);

/** An evidence token, valid or malformed, as text a reader would see. */
const RAW_TOKEN_RE = /\[\[\s*ev\s*:/i;

/** Markdown the compiler never writes, with the plural used in the message. */
const FOREIGN_NODES = new Map<string, string>([
  ["image", "images"],
  ["imageReference", "image references"],
  ["linkReference", "reference-style links"],
  ["definition", "link definitions"],
  ["footnoteDefinition", "footnotes"],
  ["footnoteReference", "footnote references"],
]);

function auditStructure(ctx: Ctx, root: MdNode, layout: Layout): void {
  walk(root, (node) => {
    if (MDX_ONLY_NODES.has(node.type)) {
      ctx.errors.push(`${node.type} at line ${lineOf(ctx, node.start)}: engine pages render record text literally (no JSX, expressions or HTML)`);
    }
    const foreign = FOREIGN_NODES.get(node.type);
    if (foreign) {
      ctx.errors.push(`${node.type} at line ${lineOf(ctx, node.start)}: an engine page contains no ${foreign} (the compiler never writes them)`);
    }
    if ((node.type === "text" || node.type === "inlineCode" || node.type === "code") && RAW_TOKEN_RE.test(textValue(node))) {
      ctx.errors.push(
        `raw evidence token at line ${lineOf(ctx, node.start)}: "[[ev:…]]" reached the page unexpanded (the compiler expands every token the record parser allows)`,
      );
    }
  });
  const first = layout.preamble[0];
  if (first) {
    ctx.errors.push(`content before ## The Problem at line ${lineOf(ctx, first.start)}: an engine page starts with its first section`);
  }
  for (const section of layout.sections) {
    if (section.title === PROMPTS_TITLE) continue;
    for (const node of section.nodes) {
      walk(node, (inner) => {
        if (inner.type === "code") {
          ctx.errors.push(
            `fenced code at line ${lineOf(ctx, inner.start)} in ${section.title}: code blocks belong only in "${PROMPTS_TITLE}"`,
          );
        }
      });
    }
  }
  const sourcesAt = layout.sections.findIndex((s) => s.title === SOURCES_TITLE);
  if (sourcesAt < 0) return;
  for (const later of layout.sections.slice(sourcesAt + 1)) {
    ctx.errors.push(
      `## ${later.title} at line ${lineOf(ctx, later.heading.start)} comes after ## ${SOURCES_TITLE}: an engine page ends with its Sources list`,
    );
  }
  for (const node of layout.sections[sourcesAt]?.nodes ?? []) {
    const what = node.type === "list" ? sourcesListShape(node) : node.type;
    if (what) {
      ctx.errors.push(
        `## ${SOURCES_TITLE} may hold only the list of evidence sources ("- [title](url)" lines); found ${what} at line ${lineOf(ctx, node.start)}`,
      );
    }
  }
}

/** The single link of a Sources item, or null when the item is anything else. */
function sourceItemLink(item: MdNode): MdNode | null {
  const paragraph = item.children.length === 1 && item.children[0]?.type === "paragraph" ? item.children[0] : null;
  const parts = (paragraph?.children ?? []).filter((c) => !(c.type === "text" && norm(c.value ?? "") === ""));
  const link = parts[0];
  return parts.length === 1 && link?.type === "link" ? link : null;
}

/** Null when every item of a Sources list is a single link, else what was found. */
function sourcesListShape(list: MdNode): string | null {
  for (const item of list.children) {
    if (item.type !== "listItem" || !sourceItemLink(item)) return "a list item that is not a single source link";
  }
  return null;
}

// ---------------------------------------------------------------------------
// Links and ## Sources (R10)
// ---------------------------------------------------------------------------

function auditLinkTargets(state: State, root: MdNode): void {
  const visit = (node: MdNode, at: number) => {
    const here = node.start >= 0 ? node.start : at;
    if (node.type === "link") {
      const url = node.url ?? "";
      const key = sourceKey(url);
      if (key === null || !state.ev.sources.has(key)) {
        state.ctx.errors.push(
          `link at line ${lineOf(state.ctx, here)} to ${clip(url, 120)} is not an evidence source this record uses (an engine page links only to its own evidence sources)`,
        );
      }
    }
    for (const child of node.children) visit(child, here);
  };
  visit(root, -1);
}

function auditSourcesList(state: State, section: Section | undefined): void {
  if (!section) return;
  const { ctx, ev } = state;
  const listed = new Map<string, number>();
  for (const list of section.nodes.filter((n) => n.type === "list")) {
    state.handled.add(list);
    for (const item of list.children) {
      const link = sourceItemLink(item);
      if (!link) continue;
      const key = sourceKey(link.url ?? "");
      const entry = key === null ? undefined : ev.sources.get(key);
      if (key === null || !entry) continue;
      listed.set(key, (listed.get(key) ?? 0) + 1);
      const title = norm(visible(link));
      if (!entry.titles.has(title)) {
        ctx.errors.push(`## ${SOURCES_TITLE} entry at line ${lineOf(ctx, item.start)}: "${clip(title)}" is not the title of ${entry.url}`);
      }
    }
  }
  for (const [key, entry] of ev.sources) {
    const count = listed.get(key) ?? 0;
    if (count === 0) ctx.errors.push(`## ${SOURCES_TITLE} is missing ${entry.url}, an evidence source the page's record uses`);
    if (count > 1) ctx.errors.push(`## ${SOURCES_TITLE} lists ${entry.url} ${count} times`);
  }
}

// ---------------------------------------------------------------------------
// Quotes (F2)
// ---------------------------------------------------------------------------

type Attribution = { ok: true; url: string; title: string } | { ok: false; reason: string };

function readAttribution(paragraph: MdNode): Attribution {
  const parts = paragraph.children.filter((c) => !(c.type === "text" && norm(c.value ?? "") === ""));
  const [dash, link, ...rest] = parts;
  if (!dash || dash.type !== "text" || !/^[—–-]{1,2}$/.test(norm(dash.value ?? ""))) {
    return { ok: false, reason: 'its last line must be "— [source title](url)"' };
  }
  if (!link || link.type !== "link" || !link.url) return { ok: false, reason: "the attribution line has no source link" };
  if (rest.length > 0) return { ok: false, reason: "the attribution line holds more than one link or extra text (ambiguous)" };
  const title = norm(visible(link));
  if (title === "") return { ok: false, reason: "the source link has no title" };
  if (canonicalSourceUrl(link.url) === null) return { ok: false, reason: `the source link ${clip(link.url)} is not an http(s) URL` };
  return { ok: true, url: link.url, title };
}

/** GFM's bare-URL/email links show their own address; anything else is formatting. */
function isLiteralAutolink(node: MdNode): boolean {
  if (node.type !== "link" || !node.url) return false;
  const text = norm(visible(node));
  return text === node.url || `mailto:${text}` === node.url || `http://${text}` === node.url;
}

function formattingIn(paragraph: MdNode): string | null {
  for (const child of paragraph.children) {
    // A literal autolink is the quote's own text; its target is checked page-wide (R10).
    if (child.type === "text" || child.type === "break" || isLiteralAutolink(child)) continue;
    return child.type;
  }
  return null;
}

/** The quote paragraphs' MDX source with each line's container prefix removed. */
function rawQuoteSource(ctx: Ctx, paragraphs: MdNode[]): string {
  const first = paragraphs[0];
  const last = paragraphs[paragraphs.length - 1];
  if (!first || !last || first.start < 0 || last.end < 0) return "";
  return ctx.body
    .slice(first.start, last.end)
    .split(/\r\n|\r|\n/)
    .map((line, i) => (i === 0 ? line : line.replace(/^[ \t]*(?:>[ \t]?)?/, "")))
    .join("\n");
}

/** Enough of a quote to show an appended or changed ending. */
const QUOTE_SHOWN = 240;

function auditQuotes(ctx: Ctx, root: MdNode, record: ResearchRecordV2, ev: Evidence): number {
  const selected = itemsOf(record.community.quoteIds, ev, "community_quote");
  const verified = new Set<string>();
  const blockquotes: MdNode[] = [];
  walk(root, (node) => {
    if (node.type === "blockquote") blockquotes.push(node);
  });
  for (const quote of blockquotes) {
    const where = `blockquote at line ${lineOf(ctx, quote.start)}`;
    const other = quote.children.find((c) => c.type !== "paragraph");
    if (other) {
      ctx.errors.push(`${where}: must hold only the quote and its attribution line (found ${other.type})`);
      continue;
    }
    const last = quote.children[quote.children.length - 1];
    const paragraphs = quote.children.slice(0, -1);
    const attribution = last && paragraphs.length > 0 ? readAttribution(last) : null;
    if (!attribution || !attribution.ok) {
      ctx.errors.push(
        `${where}: missing or malformed attribution — ${attribution ? attribution.reason : 'no "— [source title](url)" line'}`,
      );
      continue;
    }
    const formatting = paragraphs.map(formattingIn).find((f) => f !== null);
    if (formatting) {
      ctx.errors.push(`${where}: the quote contains Markdown (${formatting}); it must be the verbatim evidence excerpt`);
      continue;
    }
    const source = rawQuoteSource(ctx, paragraphs).trim();
    const wrapped = /^["“„«]([\s\S]*)["”»]$/.exec(source);
    if (!wrapped) {
      const closing = Math.max(source.lastIndexOf('"'), source.lastIndexOf("”"), source.lastIndexOf("»"));
      const tail = closing > 0 ? norm(source.slice(closing + 1)) : "";
      ctx.errors.push(
        tail
          ? `${where}: text after the closing quote mark is part of the quote ("${clip(tail, QUOTE_SHOWN)}"); a quote must equal its accepted excerpt exactly`
          : `${where}: the quote must be wrapped in double quotes`,
      );
      continue;
    }
    const inner = wrapped[1] ?? "";
    const match = selected.find((q) => quoteMatchesExcerpt(inner, q.excerpt));
    if (!match) {
      ctx.errors.push(
        `${where}: "${clip(inner, QUOTE_SHOWN)}" is not a selected evidence quote (community.quoteIds); a quote must equal its accepted excerpt exactly`,
      );
      continue;
    }
    if (!sameLinkedSource(attribution.url, match.sourceUrl)) {
      ctx.errors.push(
        `${where}: attribution links to ${attribution.url}, but this quote's evidence source is ${match.sourceUrl}`,
      );
      continue;
    }
    if (attribution.title !== norm(match.sourceTitle)) {
      ctx.errors.push(
        `${where}: attribution title "${clip(attribution.title, 120)}" is not the evidence source title "${norm(match.sourceTitle)}"`,
      );
    }
    verified.add(match.id);
  }
  if (verified.size < EVIDENCE_MINIMUMS.distinctQuotes) {
    ctx.errors.push(
      `needs ≥${EVIDENCE_MINIMUMS.distinctQuotes} distinct verified community quotes (got ${verified.size}); a repeated quote counts once`,
    );
  }
  for (const q of selected) {
    if (!verified.has(q.id)) {
      ctx.errors.push(`quote fidelity: selected quote ${q.id} ("${clip(q.excerpt, 60)}") is missing or no longer matches its evidence`);
    }
  }
  return verified.size;
}

// ---------------------------------------------------------------------------
// Evidence rows: market signals, keywords, competitors
// ---------------------------------------------------------------------------

function inlineRows(list: MdNode): Array<{ item: MdNode; paragraph: MdNode | null }> {
  return list.children
    .filter((item) => item.type === "listItem")
    .map((item) => {
      const paragraph = item.children.length === 1 && item.children[0]?.type === "paragraph" ? item.children[0] : null;
      return { item, paragraph };
    });
}

function textOnly(nodes: MdNode[]): string | null {
  return nodes.every((n) => n.type === "text") ? nodes.map(textValue).join("") : null;
}

function auditMarketRows(state: State, section: Section): number {
  const { ctx, record, ev } = state;
  const stats = itemsOf(record.market.statIds, ev, "market_stat");
  const labelIndex = section.nodes.findIndex((n) => isBoldLabel(n, LABEL.marketSignals));
  const list = labelIndex >= 0 ? section.nodes[labelIndex + 1] : undefined;
  if (labelIndex < 0 || !list || list.type !== "list") {
    ctx.errors.push(`Market Research needs its **${LABEL.marketSignals}** list (one row per selected market stat)`);
    return 0;
  }
  const labelNode = section.nodes[labelIndex];
  if (labelNode) state.handled.add(labelNode);
  state.handled.add(list);
  const shown = new Set<string>();
  let rows = 0;
  for (const { item, paragraph } of inlineRows(list)) {
    state.handled.add(item);
    const where = `market signal row at line ${lineOf(ctx, item.start)}`;
    const children = paragraph?.children ?? [];
    const links = children.filter((n) => n.type === "link");
    const link = links[0];
    const at = link ? children.indexOf(link) : -1;
    const before = textOnly(children.slice(0, Math.max(0, at)));
    const after = textOnly(children.slice(at + 1));
    const lead = before === null ? "" : norm(before);
    if (!paragraph || links.length !== 1 || !link?.url || before === null || after === null || !lead.endsWith("(") || !/^\)\.?$/.test(norm(after))) {
      ctx.errors.push(
        `${where}: expected "<evidence rendering> ([source title](url))." with exactly one source link and no other formatting (the rendering names the stat; rows carry no label)`,
      );
      continue;
    }
    rows += 1;
    const rendering = norm(lead.slice(0, -1));
    const sameRendering = stats.filter((s) => norm(renderEvidenceInline(s)) === rendering);
    const match = sameRendering.find((s) => sameLinkedSource(link.url ?? "", s.sourceUrl));
    if (!match) {
      ctx.errors.push(
        sameRendering[0]
          ? `${where}: "${rendering}" links to ${link.url}, but its evidence source is ${sameRendering[0].sourceUrl}`
          : `${where}: "${rendering}" is not the rendering of a selected market stat (expected one of: ${stats.map((s) => renderEvidenceInline(s)).join(" | ")})`,
      );
      continue;
    }
    shown.add(match.id);
    const title = norm(visible(link));
    if (title !== norm(match.sourceTitle)) {
      ctx.errors.push(`${where}: source title "${clip(title, 120)}" is not the evidence source title "${norm(match.sourceTitle)}"`);
    }
  }
  for (const s of stats) {
    if (!shown.has(s.id)) {
      ctx.errors.push(`market signal fidelity: selected stat ${s.id} ("${renderEvidenceInline(s)}") has no matching row`);
    }
  }
  return rows;
}

/**
 * A stat's subject is model-written text inside its rendering, which the
 * figure rule masks wherever the rendering is verified. So the subject of
 * every stat the page uses is checked on its own (security review P2; the
 * record parser refuses such a subject since ruling R9).
 */
function auditStatSubjects(state: State): void {
  for (const item of state.ev.used) {
    if (item.kind !== "market_stat") continue;
    for (const hit of findUnboundFigures(item.subject)) {
      state.ctx.errors.push(
        `Market Research: the subject of stat ${item.id} ("${clip(item.subject, 100)}") carries the figure "${hit.figure}"; a stat's subject is never allowlisted`,
      );
    }
  }
}

function auditKeywordRows(state: State, section: Section): void {
  const { ctx, record } = state;
  const labelIndex = section.nodes.findIndex((n) => {
    if (n.type !== "paragraph") return false;
    const first = n.children[0];
    return first?.type === "strong" && norm(visible(first)) === LABEL.searchDemand;
  });
  if (labelIndex < 0) return;
  const label = section.nodes[labelIndex];
  if (label) state.handled.add(label);
  const list = section.nodes[labelIndex + 1];
  if (!list || list.type !== "list") return;
  state.handled.add(list);
  const expected = new Set(record.keywords.map((k) => norm(keywordRowText(k))));
  for (const { item } of inlineRows(list)) {
    const text = norm(visible(item));
    if (!expected.has(text)) {
      ctx.errors.push(
        `keyword row at line ${lineOf(ctx, item.start)} "${clip(text)}" does not match the record's provider keyword metrics`,
      );
    }
  }
}

type PriceShown = { text: string; via: string | null; url: string; title: string };

type CompetitorRow = {
  name: string;
  line: number;
  item: MdNode;
  /** Inline nodes of the editorial notes (before "Published pricing:"). */
  notes: MdNode[];
  prices: PriceShown[];
};

/** Split a competitor row at "Published pricing:" into notes and price items. */
function readCompetitorRow(
  paragraph: MdNode,
): { ok: true; row: Omit<CompetitorRow, "line" | "item"> } | { ok: false; reason: string } {
  const [name, ...rest] = paragraph.children;
  if (!name || name.type !== "strong") return { ok: false, reason: "a competitor row starts with **Name**" };
  let markerAt = -1;
  let markerOffset = -1;
  rest.forEach((node, i) => {
    if (node.type !== "text") return;
    const offset = textValue(node).lastIndexOf(PUBLISHED_PRICING);
    if (offset >= 0) {
      markerAt = i;
      markerOffset = offset;
    }
  });
  const markerNode = rest[markerAt];
  if (markerAt < 0 || !markerNode) return { ok: false, reason: `no "${PUBLISHED_PRICING}" list` };
  const markerText = textValue(markerNode);
  const notes: MdNode[] = [
    ...rest.slice(0, markerAt),
    { ...markerNode, value: markerText.slice(0, markerOffset), children: [] },
  ];
  const prices: PriceShown[] = [];
  let pending = markerText.slice(markerOffset + PUBLISHED_PRICING.length);
  for (const node of rest.slice(markerAt + 1)) {
    if (node.type === "text") {
      pending += textValue(node);
      continue;
    }
    if (node.type !== "link" || !node.url) return { ok: false, reason: `unexpected ${node.type} in the price list` };
    const { text, via } = splitViaLabel(norm(pending).replace(/^[;,]\s*/, ""));
    prices.push({ text: norm(text), via, url: node.url, title: norm(visible(node)) });
    pending = "";
  }
  if (!/^\.?$/.test(norm(pending))) return { ok: false, reason: `text after the last price link: "${clip(pending, 40)}"` };
  if (prices.length === 0) return { ok: false, reason: "no linked price after Published pricing:" };
  return { ok: true, row: { name: norm(visible(name)), notes, prices } };
}

export type CompetitorLink = {
  competitor: string;
  url: string;
  attribution: "first_party" | "secondary" | "unverified";
};

function linksIn(nodes: MdNode[]): MdNode[] {
  const out: MdNode[] = [];
  for (const node of nodes) walk(node, (inner) => {
    if (inner.type === "link") out.push(inner);
  });
  return out;
}

function auditCompetitorRows(state: State, section: Section, links: CompetitorLink[]): number {
  const { ctx, record, ev } = state;
  const rows: CompetitorRow[] = [];
  for (const list of section.nodes.filter((n) => n.type === "list")) {
    for (const { item, paragraph } of inlineRows(list)) {
      if (paragraph?.children[0]?.type !== "strong") continue;
      state.handled.add(item);
      const where = `competitor row at line ${lineOf(ctx, item.start)}`;
      const read = readCompetitorRow(paragraph);
      if (!read.ok) {
        ctx.errors.push(`${where}: ${read.reason}`);
        continue;
      }
      rows.push({ ...read.row, line: lineOf(ctx, item.start), item });
    }
    if (list.children.every((item) => state.handled.has(item))) state.handled.add(list);
  }

  const owners = new Map<string, string>();
  for (const c of record.competitors) {
    for (const id of c.priceIds) owners.set(id, c.name);
  }
  const allPrices = itemsOf([...owners.keys()], ev, "competitor_price");
  const seenNames = new Set<string>();
  const urlUse = new Map<string, Array<{ competitor: string; secondaryLabelled: boolean }>>();

  for (const row of rows) {
    const where = `competitor row "${row.name}" (line ${row.line})`;
    const competitor = record.competitors.find((c) => c.name === row.name);
    if (!competitor) {
      ctx.errors.push(`${where}: not a competitor in the research record`);
      continue;
    }
    if (seenNames.has(row.name)) ctx.errors.push(`${where}: a second row for the same competitor`);
    seenNames.add(row.name);
    // Notes are polishable prose: the figure guard reads them, and their links are verified.
    addPiece(state, section.title, row.item, inlineSegs(state, row.notes, row.item.start));
    for (const link of linksIn(row.notes)) {
      const text = norm(visible(link));
      const cited = allPrices.find((p) => ev.rendering.get(p.id) === text && sameLinkedSource(link.url ?? "", p.sourceUrl));
      if (cited && !competitor.priceIds.includes(cited.id)) {
        ctx.errors.push(
          `${where}: its notes cite ${owners.get(cited.id) ?? "another competitor"}'s price "${text}"; a competitor's notes may cite only its own prices`,
        );
      }
    }
    const own = itemsOf(competitor.priceIds, ev, "competitor_price");
    const shown = new Set<string>();
    for (const price of row.prices) {
      const sameText = own.filter((p) => norm(renderEvidenceInline(p)) === price.text);
      const match = sameText.find((p) => sameLinkedSource(price.url, p.sourceUrl));
      if (!match) {
        links.push({ competitor: row.name, url: price.url, attribution: "unverified" });
        const elsewhere = allPrices.find(
          (p) => norm(renderEvidenceInline(p)) === price.text && owners.get(p.id) !== competitor.name,
        );
        ctx.errors.push(
          sameText[0]
            ? `${where}: price "${price.text}" links to ${price.url}, but its evidence source is ${sameText[0].sourceUrl}`
            : elsewhere
              ? `${where}: price "${price.text}" is ${owners.get(elsewhere.id) ?? "another competitor"}'s accepted price, not ${competitor.name}'s`
              : `${where}: published price "${price.text}" is not an accepted price for ${competitor.name} (accepted: ${own.map((p) => renderEvidenceInline(p)).join(" | ")})`,
        );
        continue;
      }
      shown.add(match.id);
      links.push({ competitor: row.name, url: price.url, attribution: match.attribution });
      if (price.title !== norm(match.sourceTitle)) {
        ctx.errors.push(
          `${where}: price "${price.text}" links with title "${clip(price.title, 120)}"; its evidence source title is "${norm(match.sourceTitle)}"`,
        );
      }
      const host = sourceHostLabel(match.sourceUrl);
      if (match.attribution === "secondary" && price.via !== host) {
        ctx.errors.push(`${where}: secondary price "${price.text}" must be labelled "(via ${host})"`);
      }
      if (match.attribution === "first_party" && price.via !== null) {
        ctx.errors.push(`${where}: first-party price "${price.text}" is labelled "(via ${price.via})"`);
      }
      const key = linkUrl(match.sourceUrl);
      const uses = urlUse.get(key) ?? [];
      uses.push({ competitor: row.name, secondaryLabelled: match.attribution === "secondary" && price.via === host });
      urlUse.set(key, uses);
    }
    for (const p of own) {
      if (!shown.has(p.id)) {
        ctx.errors.push(`${where}: accepted price "${renderEvidenceInline(p)}" (${p.id}) is missing from the row`);
      }
    }
  }
  for (const c of record.competitors) {
    if (!seenNames.has(c.name)) ctx.errors.push(`Competitive Landscape has no row for ${c.name}`);
  }
  for (const [url, uses] of urlUse) {
    const competitors = [...new Set(uses.map((u) => u.competitor))];
    if (competitors.length > 1 && uses.some((u) => !u.secondaryLabelled)) {
      ctx.errors.push(
        `pricing URL ${url} backs ${competitors.join(", ")}; a first-party URL may back one competitor, and a shared URL is allowed only for separately bound secondary prices labelled "(via host)"`,
      );
    }
  }
  return rows.length;
}

// ---------------------------------------------------------------------------
// Business Model rows: pricing tiers and unit economics (R10, P2-7)
// ---------------------------------------------------------------------------

/** A list item whose paragraph is "**Name** (price) — includes": a pricing tier row. */
function tierRowParagraph(item: MdNode): MdNode | null {
  const paragraph = item.children.length === 1 && item.children[0]?.type === "paragraph" ? item.children[0] : null;
  const [first, second] = paragraph?.children ?? [];
  return paragraph && first?.type === "strong" && second?.type === "text" && /^\s*\(/.test(second.value ?? "") ? paragraph : null;
}

function auditTierRows(state: State, section: Section): void {
  const { ctx, record, ev } = state;
  const tiers = record.editorial?.pricingTiers ?? [];
  const counts = new Map<string, number>();
  walk({ type: "root", value: null, url: null, alt: null, depth: null, start: -1, end: -1, children: section.nodes }, (item) => {
    if (item.type !== "listItem" || state.handled.has(item)) return;
    const paragraph = tierRowParagraph(item);
    if (!paragraph) return;
    state.handled.add(item);
    const name = norm(visible(paragraph.children[0] ?? item));
    const where = `pricing tier row "${clip(name, 60)}" at line ${lineOf(ctx, item.start)}`;
    const segs = inlineSegs(state, paragraph.children, item.start);
    const tier = tiers.find((t) => norm(t.name) === name);
    if (!tier) {
      ctx.errors.push(`${where} is not one of the record's pricing tiers (${tiers.map((t) => t.name).join(", ")})`);
      addPiece(state, section.title, item, segs);
      return;
    }
    counts.set(tier.name, (counts.get(tier.name) ?? 0) + 1);
    const shown = norm(visible(paragraph));
    const expected = norm(`${tier.name} (${plainProse(tier.price, ev)}) — ${plainProse(tier.includes, ev)}`);
    if (shown !== expected) {
      ctx.errors.push(
        `${where} shows "${clip(shown, 160)}"; the record's tier reads "${clip(expected, 160)}" (tier rows print the record's proposal and are not edited)`,
      );
      addPiece(state, section.title, item, segs);
      return;
    }
    addPiece(state, section.title, item, relabel(segs, "prose", "proposal"));
  });
  for (const tier of tiers) {
    const count = counts.get(tier.name) ?? 0;
    if (count === 0) ctx.errors.push(`Business Model has no row for the record's pricing tier "${tier.name}"`);
    if (count > 1) ctx.errors.push(`Business Model has ${count} rows for pricing tier "${tier.name}"`);
  }
}

function auditUnitRows(state: State, section: Section): void {
  const { ctx, record, ev } = state;
  const rows = record.editorial?.unitEconomics ?? [];
  const labelIndex = section.nodes.findIndex((n) => isBoldLabel(n, LABEL.unitEconomics));
  if (labelIndex < 0) return;
  let list: MdNode | undefined;
  for (const node of section.nodes.slice(labelIndex + 1)) {
    if (node.type === "list") {
      list = node;
      break;
    }
    if (node.type === "paragraph" && node.children.length === 1 && node.children[0]?.type === "strong") break;
  }
  if (!list) return;
  const items = inlineRows(list).filter(({ item }) => !state.handled.has(item));
  if (items.length !== rows.length) {
    ctx.errors.push(`Unit Economics shows ${items.length} rows; the record has ${rows.length}`);
  }
  items.forEach(({ item, paragraph }, i) => {
    state.handled.add(item);
    const value = paragraph?.children[0];
    if (!paragraph || value?.type !== "strong") {
      ctx.errors.push(`unit economics row at line ${lineOf(ctx, item.start)}: expected "**value** — label"`);
      addPiece(state, section.title, item, inlineSegs(state, paragraph?.children ?? item.children, item.start));
      return;
    }
    const valueSegs = inlineSegs(state, value.children, item.start);
    const restSegs = inlineSegs(state, paragraph.children.slice(1), item.start);
    const record_row = rows[i];
    const shown = norm(visible(value));
    const expected = record_row ? norm(plainProse(record_row.value, ev)) : null;
    if (expected === null || shown !== expected) {
      ctx.errors.push(
        `unit economics row ${i + 1} at line ${lineOf(ctx, item.start)} shows "${clip(shown, 80)}"; the record's value is "${expected === null ? "(no such row)" : clip(expected, 80)}"`,
      );
      addPiece(state, section.title, item, [...valueSegs, ...restSegs]);
      return;
    }
    addPiece(state, section.title, item, [...relabel(valueSegs, "prose", "proposal"), ...restSegs]);
  });
}

// ---------------------------------------------------------------------------
// Year-One Math (F6)
// ---------------------------------------------------------------------------

type Block = { node: MdNode; text: string; list: MdNode | null };

function businessBlocks(nodes: MdNode[]): Block[] {
  const out: Block[] = [];
  const visit = (node: MdNode, list: MdNode | null) => {
    if (node.type === "code") return;
    if (node.type === "listItem") {
      out.push({ node, text: norm(visible(node)), list });
      return;
    }
    if (INLINE_CONTAINERS.has(node.type)) {
      out.push({ node, text: norm(visible(node)), list: null });
      return;
    }
    for (const child of node.children) visit(child, node.type === "list" ? node : list);
  };
  for (const node of nodes) visit(node, null);
  return out;
}

function tierNamesShown(nodes: MdNode[]): string[] {
  const names: string[] = [];
  for (const block of businessBlocks(nodes)) {
    if (block.node.type !== "listItem") continue;
    const paragraph = tierRowParagraph(block.node);
    const first = paragraph?.children[0];
    if (first) names.push(norm(visible(first)));
  }
  return names;
}

type YearOneShown = {
  base: Array<Extract<DisplayedYearOneLine, { kind: "base" }> & { block: Block }>;
  downside: Array<Extract<DisplayedYearOneLine, { kind: "downside" }> & { block: Block }>;
  funnel: Array<Extract<DisplayedYearOneLine, { kind: "funnel" }> & { block: Block }>;
};

/** The Year-One list items the audit verified: base/downside lines and funnel stages. */
type YearOneNodes = { lines: Set<MdNode>; funnel: Set<MdNode> };

function auditYearOne(ctx: Ctx, section: Section | undefined, record: ResearchRecordV2 | null): YearOneNodes {
  const found: YearOneNodes = { lines: new Set(), funnel: new Set() };
  if (!section) return found;
  if (!section.nodes.some((n) => isBoldLabel(n, LABEL.yearOneMath))) {
    ctx.errors.push("Business Model needs **Year-One Math** (funnel → paying accounts → ARR, plus downside)");
    return found;
  }
  const blocks = businessBlocks(section.nodes);
  const shown: YearOneShown = { base: [], downside: [], funnel: [] };
  for (const block of blocks) {
    const parsed = block.node.type === "listItem" ? parseYearOneLine(block.text) : null;
    if (parsed?.kind === "base") shown.base.push({ ...parsed, block });
    else if (parsed?.kind === "downside") shown.downside.push({ ...parsed, block });
  }
  for (const line of [...shown.base, ...shown.downside]) found.lines.add(line.block.node);
  const base = shown.base[0];
  const yearOneList = base?.block.list ?? null;
  if (yearOneList) {
    for (const block of blocks) {
      if (block.list !== yearOneList || found.lines.has(block.node)) continue;
      const parsed = parseYearOneLine(block.text);
      if (parsed?.kind === "funnel") {
        shown.funnel.push({ ...parsed, block });
        found.funnel.add(block.node);
      }
    }
  }
  if (shown.base.length === 0) ctx.errors.push("Year-One Math is missing its computed ARR line");
  if (shown.base.length > 1) ctx.errors.push(`Year-One Math has ${shown.base.length} base ARR lines; exactly one is allowed`);
  if (shown.downside.length === 0) ctx.errors.push("Year-One Math is missing its downside case");
  if (shown.downside.length > 1) {
    ctx.errors.push(`Year-One Math has ${shown.downside.length} downside lines; exactly one is allowed`);
  }
  const tiers = tierNamesShown(section.nodes);
  if (base && tiers.length > 0 && !tiers.includes(base.tier)) {
    ctx.errors.push(`Year-One Math lands on tier "${base.tier}", which is not a pricing tier (${tiers.join(", ")})`);
  }
  if (!record || shown.base.length !== 1 || shown.downside.length !== 1 || !base) return found;
  compareYearOne(ctx, record, base, shown.downside[0], shown.funnel);
  return found;
}

function money(cents: number, period: "month" | "year"): string {
  return `${formatUsdCents(cents)}/${periodAbbrev(period)}`;
}

function compareYearOne(
  ctx: Ctx,
  record: ResearchRecordV2,
  base: Extract<DisplayedYearOneLine, { kind: "base" }>,
  downside: Extract<DisplayedYearOneLine, { kind: "downside" }> | undefined,
  funnel: Array<Extract<DisplayedYearOneLine, { kind: "funnel" }>>,
): void {
  const plan = record.editorial?.yearOne;
  const tiers = record.editorial?.pricingTiers ?? [];
  if (!plan) {
    ctx.errors.push("Year-One Math cannot be checked: the research record has no editorial.yearOne");
    return;
  }
  const resolved = yearOneTierTerms(plan.tier, tiers);
  if (!resolved.ok) {
    ctx.errors.push(`Year-One Math cannot be checked: ${resolved.issue}`);
    return;
  }
  let math: YearOneMath;
  try {
    math = computeYearOne(plan, resolved.terms);
  } catch (error) {
    if (error instanceof YearOneMathError) {
      ctx.errors.push(`Year-One Math cannot be checked: ${error.message}`);
      return;
    }
    throw error;
  }
  const expected = `${math.baseAccounts} × ${money(math.perAccountCents, math.period)} = ${formatUsdCents(math.arrCents)} ARR`;
  if (base.accounts !== math.baseAccounts) {
    ctx.errors.push(`Year-One Math shows ${base.accounts} paying accounts; the record's plan has ${math.baseAccounts} (${expected})`);
  }
  if (base.period !== math.period) {
    ctx.errors.push(`Year-One Math prices accounts per ${base.period}; the ${plan.tier} tier is priced per ${math.period} (${expected})`);
  }
  if (base.perAccountCents !== math.perAccountCents) {
    ctx.errors.push(
      `Year-One Math shows ${money(base.perAccountCents, base.period)} per account; the record computes ${money(math.perAccountCents, math.period)} (${plan.tier} at ${resolved.tier.price} × ${math.seatsPerAccount} seat${math.seatsPerAccount === 1 ? "" : "s"})`,
    );
  }
  if (base.arrCents !== math.arrCents) {
    ctx.errors.push(`Year-One Math shows ${formatUsdCents(base.arrCents)} ARR; the record computes ${expected}`);
  }
  if (base.tier !== plan.tier) {
    ctx.errors.push(`Year-One Math lands on tier "${base.tier}"; the record's plan uses "${plan.tier}"`);
  }
  if (math.seatsPerAccount > 1 && !base.seats) {
    ctx.errors.push(`Year-One Math must state the ${math.seatsPerAccount} seats per account behind ${money(math.perAccountCents, math.period)}`);
  }
  if (base.seats) {
    const unit = parsePriceTerms(base.seats.priceText);
    if (base.seats.count !== math.seatsPerAccount) {
      ctx.errors.push(`Year-One Math states ${base.seats.count} seats per account; the record's plan has ${math.seatsPerAccount}`);
    }
    if (!unit || comparePriceTerms(unit, resolved.terms) !== null) {
      ctx.errors.push(
        `Year-One Math seat price "${base.seats.priceText}" is not the ${plan.tier} tier price (${resolved.tier.price}); revenue per account is inconsistent`,
      );
    }
  }
  if (downside) {
    const expectedDownside = `${math.downsideAccounts} × ${money(math.perAccountCents, math.period)} = ${formatUsdCents(math.downsideArrCents)} ARR`;
    if (
      downside.accounts !== math.downsideAccounts ||
      downside.perAccountCents !== math.perAccountCents ||
      downside.period !== math.period ||
      downside.arrCents !== math.downsideArrCents
    ) {
      ctx.errors.push(
        `Year-One Math downside shows ${downside.accounts} × ${money(downside.perAccountCents, downside.period)} = ${formatUsdCents(downside.arrCents)} ARR; the record computes ${expectedDownside} (floor of ${math.baseAccounts} ÷ 2 accounts)`,
      );
    }
    if (downside.halfOf !== null && downside.halfOf !== math.baseAccounts) {
      ctx.errors.push(`Year-One Math downside says half of ${downside.halfOf} accounts; the plan has ${math.baseAccounts}`);
    }
  }
  const shownCounts = funnel.map((f) => f.count);
  const planCounts = plan.funnel.map((f) => f.count);
  if (shownCounts.length !== planCounts.length || shownCounts.some((n, i) => n !== planCounts[i])) {
    ctx.errors.push(
      `Year-One funnel shows [${shownCounts.join(", ")}]; the record's funnel is [${planCounts.join(", ")}]`,
    );
  }
}

/**
 * Without a usable record the text rules cannot run (they need its evidence),
 * but Business Model still may not state another revenue total: the same
 * check, on the visible text of every block but the Year-One lines.
 */
function auditRevenueWithoutRecord(ctx: Ctx, section: Section | undefined, yearOne: YearOneNodes): void {
  if (!section) return;
  for (const block of businessBlocks(section.nodes)) {
    if (yearOne.lines.has(block.node)) continue;
    const revenue = REVENUE_TOTAL_RE.exec(block.text);
    if (revenue) {
      ctx.errors.push(
        `${section.title} states another revenue total at line ${lineOf(ctx, block.node.start)} ("${clip(revenue[0], 80)}"); only the Year-One Math base and downside lines may state ARR, MRR or revenue totals`,
      );
    }
  }
}

/** Year-One list items as pieces: verified lines fully exempt, a funnel stage's count exempt. */
function yearOnePieces(state: State, section: Section, nodes: YearOneNodes): void {
  for (const item of nodes.lines) {
    state.handled.add(item);
    addPiece(state, section.title, item, [{ text: norm(visible(item)), kind: "yearOne" }]);
  }
  for (const item of nodes.funnel) {
    state.handled.add(item);
    const paragraph = item.children[0];
    const [count, ...rest] = paragraph?.type === "paragraph" ? paragraph.children : [];
    const segs = count?.type === "strong"
      ? [...relabel(inlineSegs(state, count.children, item.start), "prose", "yearOne"), ...inlineSegs(state, rest, item.start)]
      : inlineSegs(state, item.children, item.start);
    addPiece(state, section.title, item, segs);
  }
}

// ---------------------------------------------------------------------------
// Labels, prompt headings, identity
// ---------------------------------------------------------------------------

function markPromptHeadings(state: State, section: Section | undefined): void {
  if (!section) return;
  for (const node of section.nodes) {
    if (PROMPT_TITLES.some((_title, i) => isBoldLabel(node, promptHeadingText(i)))) state.handled.add(node);
  }
}

function auditProposalLabels(ctx: Ctx, layout: Layout, record: ResearchRecordV2): void {
  const labels = proposalLabels(pageProductName(record));
  const required: Array<[string, string]> = [
    ["The Solution", labels.howItWorks],
    ["The Solution", labels.dontBuildYet],
    ["Business Model", labels.pricing],
    ["Business Model", labels.unitEconomics],
    ["Business Model", labels.yearOne],
    ["Business Model", labels.channels],
    ["Recommended Tech Stack", labels.stack],
  ];
  for (const [title, label] of required) {
    const section = layout.sections.find((s) => s.title === title);
    if (!section) continue;
    if (!section.nodes.some((n) => n.type === "paragraph" && norm(visible(n)) === norm(label))) {
      ctx.errors.push(`${title}: the label "${label}" is missing; proposals and planning assumptions stay labelled as such`);
    }
  }
}

/** JSON with object keys sorted, for comparing manifest values. */
function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (isRecord(value)) {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value) ?? "undefined";
}

function auditIdentity(ctx: Ctx, record: ResearchRecordV2, slug: string | undefined, manifestRow: unknown): void {
  if (slug !== undefined && record.mode === "fixture" && !isEngineDraftSlug(slug)) {
    ctx.errors.push(
      `research record mode is "fixture" (synthetic research) but the page slug '${slug}' is not an engine-draft-* draft; fixture output never reaches a public page (ruling R11)`,
    );
  }
  if (manifestRow === undefined || manifestRow === null) return;
  const who = `manifest row for ${slug ?? record.brief.slug}`;
  if (!isRecord(manifestRow)) {
    ctx.errors.push(`${who} is not an object`);
    return;
  }
  const provenance = manifestRow.provenance;
  if (isRecord(provenance) && provenance.researchMode !== undefined && provenance.researchMode !== record.mode) {
    ctx.errors.push(
      `${who}: provenance.researchMode ${JSON.stringify(provenance.researchMode)} does not match the record's mode "${record.mode}"`,
    );
  }
  if (manifestRow.highlights === undefined) return;
  const generated = ideaHighlights(record);
  if (!generated) {
    ctx.errors.push(`${who}: highlights are present but the record generates none; remove them`);
    return;
  }
  const shown = manifestRow.highlights;
  if (stableJson(shown) === stableJson(generated)) return;
  const keys = ["problemQuote", "stats", "competitors"] as const;
  const shownObject = isRecord(shown) ? shown : {};
  const differing = keys.filter((key) => stableJson(shownObject[key]) !== stableJson(generated[key]));
  const key = differing[0];
  const detail = key
    ? `highlights.${key} is not what the record generates (shown ${clip(stableJson(shownObject[key]), 140)}, generated ${clip(stableJson(generated[key]), 140)})`
    : "highlights are not what the record generates (extra keys)";
  ctx.errors.push(`${who}: ${detail}; highlights come from engine:compile, never by hand`);
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

export type ArtifactAudit = {
  errors: string[];
  warnings: string[];
  /** Price links in competitor rows, for the auditor's pricing-page checks. */
  competitorLinks: CompetitorLink[];
  metrics: {
    verifiedQuotes: number;
    marketRows: number;
    competitorRows: number;
    unboundFigures: number;
  };
};

export type ArtifactAuditOptions = {
  /** Added to reported line numbers (the frontmatter's lines). */
  lineOffset?: number;
  /** The page slug, for the fixture-mode rule (R11); omitted → not checked. */
  slug?: string;
  /** The page's manifest row (unknown JSON); its highlights and researchMode are checked. */
  manifestRow?: unknown;
};

/**
 * Audit an engine page body (frontmatter removed) against its contract v2
 * record. With `record` null (missing, legacy or invalid record — reported
 * by the caller) only the record-independent checks run: structure and
 * Year-One Math's shape.
 */
export function auditEngineArtifact(
  body: string,
  record: ResearchRecordV2 | null,
  options: ArtifactAuditOptions = {},
): ArtifactAudit {
  const ctx: Ctx = { body, lineOffset: options.lineOffset ?? 0, errors: [], warnings: [] };
  const result: ArtifactAudit = {
    errors: ctx.errors,
    warnings: ctx.warnings,
    competitorLinks: [],
    metrics: { verifiedQuotes: 0, marketRows: 0, competitorRows: 0, unboundFigures: 0 },
  };
  const parsed = parseMdxBody(body);
  if (!parsed.ok) {
    ctx.errors.push(`MDX does not parse, so the factual blocks cannot be checked: ${clip(parsed.error, 160)}`);
    return result;
  }
  const layout = layoutOf(parsed.root);
  const section = (title: string) => layout.sections.find((s) => s.title === title);
  auditStructure(ctx, parsed.root, layout);
  const business = section("Business Model");
  const yearOne = auditYearOne(ctx, business, record);
  if (!record) {
    auditRevenueWithoutRecord(ctx, business, yearOne);
    return result;
  }

  auditIdentity(ctx, record, options.slug, options.manifestRow);
  const ev = evidenceOf(record);
  const state: State = { ctx, record, ev, handled: new Set(), pieces: [], names: recordNames(record) };
  auditLinkTargets(state, parsed.root);
  result.metrics.verifiedQuotes = auditQuotes(ctx, parsed.root, record, ev);
  const market = section("Market Research");
  if (market) {
    result.metrics.marketRows = auditMarketRows(state, market);
    auditKeywordRows(state, market);
  }
  auditStatSubjects(state);
  const competitive = section("Competitive Landscape");
  if (competitive) {
    result.metrics.competitorRows = auditCompetitorRows(state, competitive, result.competitorLinks);
  }
  if (business) {
    yearOnePieces(state, business, yearOne);
    auditTierRows(state, business);
    auditUnitRows(state, business);
  }
  auditSourcesList(state, section(SOURCES_TITLE));
  markPromptHeadings(state, section(PROMPTS_TITLE));
  auditProposalLabels(ctx, layout, record);
  const fenceValues = fenceValuesOf(record, ev);
  for (const s of layout.sections) collectPieces(state, s, fenceValues);
  result.metrics.unboundFigures = applyRules(state);
  return result;
}
