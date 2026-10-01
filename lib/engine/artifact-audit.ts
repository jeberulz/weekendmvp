/**
 * Final artifact audit for engine pages (WP46-S4: review findings F2 and F6,
 * plus the F1 defense in the published page; evidence contract §9).
 *
 * The page is parsed with the same Markdown stack the site renders with
 * (@mdx-js/mdx + remark-gfm), so a sentence appended to a quote as a lazy
 * continuation line, a link hidden in a list or a fence that swallows text
 * is read exactly as a reader would see it. Every factual block is then
 * compared with the contract v2 record:
 *
 *   Quotes (F2)   Each blockquote is one unit: the quote paragraphs plus a
 *                 last line "— [title](url)". The quote's MDX text must
 *                 strictly equal a selected accepted quote
 *                 (quoteMatchesExcerpt, ruling R3) and the link must be the
 *                 same source (sameSource after the compiler's linkUrl form;
 *                 a different HN thread on the same host fails). Missing,
 *                 malformed or ambiguous attribution fails; Markdown inside
 *                 a quote fails; a blockquote that is not a selected quote
 *                 fails; every selected quote must appear; the minimum
 *                 counts distinct quote ids, so a repeated quote adds nothing.
 *   Rows          Market signal rows must show the canonical rendering of a
 *                 selected stat with its own source; competitor rows must
 *                 show exactly their competitor's accepted prices, each with
 *                 its own source and a "(via host)" label when secondary.
 *                 Labels and notes may be polished; figures may not.
 *                 A pricing URL may back several competitors only when every
 *                 price on it is a separately bound secondary price.
 *   Figures (F1)  In The Problem, Market Research and Competitive Landscape,
 *                 a figure in prose that is not the canonical rendering of
 *                 evidence the record references (or a bare year) is an
 *                 "unbound figure". This is a guard against figures typed
 *                 into the page, not proof that any prose is true.
 *   Money (F6)    Year-One Math is recomputed with finance.ts and the
 *                 displayed accounts, per-account price, period, ARR, tier,
 *                 seats, downside and funnel are compared exactly. Business
 *                 Model must hold exactly one base and one downside line and
 *                 no other ARR/MRR total.
 *
 * The record proves consistency, not authenticity (ruling R4); this audit
 * proves the page matches the record.
 */

import { createProcessor } from "@mdx-js/mdx";
import remarkGfm from "remark-gfm";

import { comparePriceTerms, parsePriceTerms } from "./evidence/amount.ts";
import { canonicalSourceUrl, sameSource, sourceHostLabel } from "./evidence/citation.ts";
import { EVIDENCE_MINIMUMS, type AcceptedEvidence, type ResearchRecordV2 } from "./evidence/contract.ts";
import { quoteMatchesExcerpt } from "./evidence/quote.ts";
import { evidenceRefs, findUnboundFigures, renderEvidenceInline } from "./evidence/tokens.ts";
import { computeYearOne, formatUsdCents, YearOneMathError, yearOneTierTerms, type YearOneMath } from "./finance.ts";
import {
  keywordRowText,
  LABEL,
  linkUrl,
  parseYearOneLine,
  periodAbbrev,
  PUBLISHED_PRICING,
  splitViaLabel,
  type DisplayedYearOneLine,
} from "./page-format.ts";
import { LegacyResearchRecordError, parseResearchRecordV2, ResearchRecordParseError } from "./research-record.ts";

// ---------------------------------------------------------------------------
// Record loading
// ---------------------------------------------------------------------------

export type RecordLoad = { ok: true; record: ResearchRecordV2 } | { ok: false; error: string };

const MAX_ISSUES_SHOWN = 12;

/**
 * Parse an engine page's research record with parseResearchRecordV2. A v1
 * record yields the LegacyResearchRecordError re-research message; any other
 * invalid record lists its first issues. Never upgrades or trusts a record.
 */
export function loadEngineRecord(raw: unknown, label: string): RecordLoad {
  try {
    return { ok: true, record: parseResearchRecordV2(raw) };
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

/** What a reader sees: text values, alt text, line breaks; no code fences. */
function visible(node: MdNode): string {
  if (node.type === "text" || node.type === "inlineCode") return node.value ?? "";
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

type Section = { title: string; nodes: MdNode[] };

function sectionsOf(root: MdNode): Section[] {
  const out: Section[] = [];
  for (const node of root.children) {
    if (node.type === "heading" && node.depth === 2) out.push({ title: norm(visible(node)), nodes: [] });
    else out[out.length - 1]?.nodes.push(node);
  }
  return out;
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

type Evidence = {
  byId: ReadonlyMap<string, AcceptedEvidence>;
  /** Items the record selects or references with a token, rendered once. */
  referenced: Array<{ item: AcceptedEvidence; rendering: string }>;
};

function evidenceOf(record: ResearchRecordV2): Evidence {
  const byId = new Map(record.evidence.accepted.map((item) => [item.id, item]));
  const ids = new Set<string>([
    ...record.market.statIds,
    ...record.competitors.flatMap((c) => c.priceIds),
    ...record.community.quoteIds,
    // Tokens anywhere outside the evidence block (JSON keeps `[[ev:…]]` verbatim).
    ...evidenceRefs(JSON.stringify({ ...record, evidence: null })),
  ]);
  const referenced: Evidence["referenced"] = [];
  for (const id of ids) {
    const item = byId.get(id);
    if (item) referenced.push({ item, rendering: norm(renderEvidenceInline(item)) });
  }
  referenced.sort((a, b) => b.rendering.length - a.rendering.length);
  return { byId, referenced };
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

// ---------------------------------------------------------------------------
// Quotes (F2)
// ---------------------------------------------------------------------------

type Attribution = { ok: true; url: string } | { ok: false; reason: string };

function readAttribution(paragraph: MdNode): Attribution {
  const parts = paragraph.children.filter((c) => !(c.type === "text" && norm(c.value ?? "") === ""));
  const [dash, link, ...rest] = parts;
  if (!dash || dash.type !== "text" || !/^[—–-]{1,2}$/.test(norm(dash.value ?? ""))) {
    return { ok: false, reason: 'its last line must be "— [source title](url)"' };
  }
  if (!link || link.type !== "link" || !link.url) return { ok: false, reason: "the attribution line has no source link" };
  if (rest.length > 0) return { ok: false, reason: "the attribution line holds more than one link or extra text (ambiguous)" };
  if (norm(visible(link)) === "") return { ok: false, reason: "the source link has no title" };
  if (canonicalSourceUrl(link.url) === null) return { ok: false, reason: `the source link ${clip(link.url)} is not an http(s) URL` };
  return { ok: true, url: link.url };
}

/** GFM's bare-URL/email links show their own address; anything else is formatting. */
function isLiteralAutolink(node: MdNode): boolean {
  if (node.type !== "link" || !node.url) return false;
  const text = norm(visible(node));
  return text === node.url || `mailto:${text}` === node.url || `http://${text}` === node.url;
}

function formattingIn(paragraph: MdNode): string | null {
  for (const child of paragraph.children) {
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

/** Prose found inside rows (labels, notes) for the unbound-figure guard. */
type ProsePiece = { section: string; text: string; line: number; allowed?: string[] };

function inlineRows(list: MdNode): Array<{ item: MdNode; paragraph: MdNode | null }> {
  return list.children
    .filter((item) => item.type === "listItem")
    .map((item) => {
      const paragraph = item.children.length === 1 && item.children[0]?.type === "paragraph" ? item.children[0] : null;
      return { item, paragraph };
    });
}

function textOnly(nodes: MdNode[]): string | null {
  return nodes.every((n) => n.type === "text") ? nodes.map((n) => n.value ?? "").join("") : null;
}

function auditMarketRows(
  ctx: Ctx,
  section: Section,
  record: ResearchRecordV2,
  ev: Evidence,
  handled: Set<MdNode>,
  prose: ProsePiece[],
): number {
  const stats = itemsOf(record.market.statIds, ev, "market_stat");
  const labelIndex = section.nodes.findIndex((n) => isBoldLabel(n, LABEL.marketSignals));
  const list = labelIndex >= 0 ? section.nodes[labelIndex + 1] : undefined;
  if (labelIndex < 0 || !list || list.type !== "list") {
    ctx.errors.push(`Market Research needs its **${LABEL.marketSignals}** list (one row per selected market stat)`);
    return 0;
  }
  const labelNode = section.nodes[labelIndex];
  if (labelNode) handled.add(labelNode);
  handled.add(list);
  const shown = new Set<string>();
  let rows = 0;
  for (const { item, paragraph } of inlineRows(list)) {
    const where = `market signal row at line ${lineOf(ctx, item.start)}`;
    const [label, ...rest] = paragraph?.children ?? [];
    const links = rest.filter((n) => n.type === "link");
    const link = links[0];
    if (!paragraph || !label || label.type !== "strong" || links.length !== 1 || !link?.url) {
      ctx.errors.push(`${where}: expected "**label**: <figure> ([source](url))." with exactly one source link`);
      continue;
    }
    const at = rest.indexOf(link);
    const before = textOnly(rest.slice(0, at));
    const after = textOnly(rest.slice(at + 1));
    const middle = before === null ? "" : norm(before);
    if (before === null || after === null || !middle.startsWith(":") || !middle.endsWith("(") || !/^\)\.?$/.test(norm(after))) {
      ctx.errors.push(`${where}: expected "**label**: <figure> ([source](url))." (no other formatting)`);
      continue;
    }
    rows += 1;
    const rendering = norm(middle.slice(1, -1));
    const labelText = norm(visible(label));
    const sameFigure = stats.filter((s) => norm(renderEvidenceInline(s)) === rendering);
    const match = sameFigure.find((s) => sameLinkedSource(link.url ?? "", s.sourceUrl));
    if (!match) {
      ctx.errors.push(
        sameFigure[0]
          ? `${where}: "${rendering}" links to ${link.url}, but its evidence source is ${sameFigure[0].sourceUrl}`
          : `${where}: "${rendering}" is not the rendering of a selected market stat (expected one of: ${stats.map((s) => renderEvidenceInline(s)).join(" | ")})`,
      );
      continue;
    }
    shown.add(match.id);
    prose.push({ section: "Market Research", text: labelText, line: lineOf(ctx, item.start), allowed: [match.subject] });
  }
  for (const s of stats) {
    if (!shown.has(s.id)) {
      ctx.errors.push(`market signal fidelity: selected stat ${s.id} ("${renderEvidenceInline(s)}") has no matching row`);
    }
  }
  return rows;
}

function auditKeywordRows(ctx: Ctx, section: Section, record: ResearchRecordV2, handled: Set<MdNode>): void {
  const labelIndex = section.nodes.findIndex((n) => {
    if (n.type !== "paragraph") return false;
    const first = n.children[0];
    return first?.type === "strong" && norm(visible(first)) === LABEL.searchDemand;
  });
  if (labelIndex < 0) return;
  const label = section.nodes[labelIndex];
  if (label) handled.add(label);
  const list = section.nodes[labelIndex + 1];
  if (!list || list.type !== "list") return;
  handled.add(list);
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

type PriceShown = { text: string; via: string | null; url: string };

type CompetitorRow = {
  name: string;
  line: number;
  /** Inline nodes of the editorial notes (before "Published pricing:"). */
  notes: MdNode[];
  prices: PriceShown[];
};

/** Split a competitor row at "Published pricing:" into notes and price items. */
function readCompetitorRow(paragraph: MdNode): { ok: true; row: Omit<CompetitorRow, "line"> } | { ok: false; reason: string } {
  const [name, ...rest] = paragraph.children;
  if (!name || name.type !== "strong") return { ok: false, reason: "a competitor row starts with **Name**" };
  let markerAt = -1;
  let markerOffset = -1;
  rest.forEach((node, i) => {
    if (node.type !== "text") return;
    const offset = (node.value ?? "").lastIndexOf(PUBLISHED_PRICING);
    if (offset >= 0) {
      markerAt = i;
      markerOffset = offset;
    }
  });
  const markerNode = rest[markerAt];
  if (markerAt < 0 || !markerNode) return { ok: false, reason: `no "${PUBLISHED_PRICING}" list` };
  const markerText = markerNode.value ?? "";
  const notes: MdNode[] = [
    ...rest.slice(0, markerAt),
    { ...markerNode, value: markerText.slice(0, markerOffset), children: [] },
  ];
  const prices: PriceShown[] = [];
  let pending = markerText.slice(markerOffset + PUBLISHED_PRICING.length);
  for (const node of rest.slice(markerAt + 1)) {
    if (node.type === "text") {
      pending += node.value ?? "";
      continue;
    }
    if (node.type !== "link" || !node.url) return { ok: false, reason: `unexpected ${node.type} in the price list` };
    const { text, via } = splitViaLabel(norm(pending).replace(/^[;,]\s*/, ""));
    prices.push({ text: norm(text), via, url: node.url });
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

function auditCompetitorRows(
  ctx: Ctx,
  section: Section,
  record: ResearchRecordV2,
  ev: Evidence,
  handled: Set<MdNode>,
  prose: ProsePiece[],
  links: CompetitorLink[],
): number {
  const rows: CompetitorRow[] = [];
  for (const list of section.nodes.filter((n) => n.type === "list")) {
    for (const { item, paragraph } of inlineRows(list)) {
      if (paragraph?.children[0]?.type !== "strong") continue;
      handled.add(item);
      const where = `competitor row at line ${lineOf(ctx, item.start)}`;
      const read = readCompetitorRow(paragraph);
      if (!read.ok) {
        ctx.errors.push(`${where}: ${read.reason}`);
        continue;
      }
      rows.push({ ...read.row, line: lineOf(ctx, item.start) });
    }
    if (list.children.every((item) => handled.has(item))) handled.add(list);
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
    prose.push({ section: "Competitive Landscape", text: inlineProse(ctx, row.notes, ev, row.line), line: row.line });
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
// Unbound figures (F1 defense)
// ---------------------------------------------------------------------------

const FIGURE_SECTIONS = ["The Problem", "Market Research", "Competitive Landscape"];

/** Inline prose with every evidence link checked against its own source. */
function inlineProse(ctx: Ctx, nodes: MdNode[], ev: Evidence, line: number): string {
  return nodes
    .map((node) => {
      if (node.type === "link") {
        const text = norm(visible(node));
        const same = ev.referenced.filter((r) => r.rendering === text);
        if (same.length > 0 && !same.some((r) => sameLinkedSource(node.url ?? "", r.item.sourceUrl))) {
          ctx.errors.push(
            `evidence link "${clip(text, 60)}" near line ${line} points to ${node.url ?? "(none)"}, but its evidence source is ${same[0]?.item.sourceUrl ?? "unknown"}`,
          );
        }
        return ` ${text} `;
      }
      if (node.type === "text" || node.type === "inlineCode") return node.value ?? "";
      if (node.type === "break") return " ";
      if (node.type === "image") return node.alt ?? "";
      return inlineProse(ctx, node.children, ev, line);
    })
    .join("");
}

function collectProse(ctx: Ctx, section: string, nodes: MdNode[], ev: Evidence, handled: Set<MdNode>, out: ProsePiece[]): void {
  for (const node of nodes) {
    if (handled.has(node) || node.type === "blockquote" || node.type === "code") continue;
    const line = lineOf(ctx, node.start);
    if (INLINE_CONTAINERS.has(node.type)) {
      out.push({ section, text: inlineProse(ctx, node.children, ev, line), line });
      continue;
    }
    collectProse(ctx, section, node.children, ev, handled, out);
  }
}

function auditFigures(ctx: Ctx, pieces: ProsePiece[], ev: Evidence): number {
  let count = 0;
  for (const piece of pieces) {
    let text = norm(piece.text);
    for (const { rendering } of ev.referenced) {
      if (rendering) text = text.split(rendering).join(" ".repeat(rendering.length));
    }
    const allowed = new Set((piece.allowed ?? []).flatMap((a) => findUnboundFigures(a).map((f) => f.figure)));
    for (const hit of findUnboundFigures(text)) {
      if (allowed.has(hit.figure)) continue;
      count += 1;
      const context = text.slice(Math.max(0, hit.index - 40), hit.index + hit.figure.length + 40);
      ctx.errors.push(
        `${piece.section}: unbound figure "${hit.figure}" near line ${piece.line} ("…${norm(context)}…") — not a rendering of the record's evidence (guard, not proof of truth)`,
      );
    }
  }
  return count;
}

// ---------------------------------------------------------------------------
// Year-One Math (F6)
// ---------------------------------------------------------------------------

const REVENUE_TOTAL_RE = /\b(?:ARR|MRR)\b|annual\s+recurring\s+revenue|monthly\s+recurring\s+revenue/i;
const CURRENCY_FIGURE_RE = /[$€£]\s?\d/;

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
    const paragraph = block.node.children[0];
    const [first, second] = paragraph?.type === "paragraph" ? paragraph.children : [];
    if (first?.type === "strong" && second?.type === "text" && /^\s*\(/.test(second.value ?? "")) {
      names.push(norm(visible(first)));
    }
  }
  return names;
}

type YearOneShown = {
  base: Array<Extract<DisplayedYearOneLine, { kind: "base" }> & { block: Block }>;
  downside: Array<Extract<DisplayedYearOneLine, { kind: "downside" }> & { block: Block }>;
  funnel: Array<Extract<DisplayedYearOneLine, { kind: "funnel" }>>;
};

function auditYearOne(ctx: Ctx, section: Section | undefined, record: ResearchRecordV2 | null): void {
  if (!section) return;
  if (!section.nodes.some((n) => isBoldLabel(n, LABEL.yearOneMath))) {
    ctx.errors.push("Business Model needs **Year-One Math** (funnel → paying accounts → ARR, plus downside)");
    return;
  }
  const blocks = businessBlocks(section.nodes);
  const shown: YearOneShown = { base: [], downside: [], funnel: [] };
  for (const block of blocks) {
    const parsed = block.node.type === "listItem" ? parseYearOneLine(block.text) : null;
    if (parsed?.kind === "base") shown.base.push({ ...parsed, block });
    else if (parsed?.kind === "downside") shown.downside.push({ ...parsed, block });
    else if (REVENUE_TOTAL_RE.test(block.text) && CURRENCY_FIGURE_RE.test(block.text)) {
      ctx.errors.push(
        `Business Model states another revenue total at line ${lineOf(ctx, block.node.start)} ("${clip(block.text)}"); only the Year-One Math base and downside lines may state ARR or MRR`,
      );
    }
  }
  const base = shown.base[0];
  const yearOneList = base?.block.list ?? null;
  if (yearOneList) {
    for (const block of blocks) {
      if (block.list !== yearOneList || block === base?.block) continue;
      const parsed = parseYearOneLine(block.text);
      if (parsed?.kind === "funnel") shown.funnel.push(parsed);
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
  if (!record || shown.base.length !== 1 || shown.downside.length !== 1 || !base) return;
  compareYearOne(ctx, record, base, shown.downside[0], shown.funnel);
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

const MDX_ONLY_NODES = new Set(["mdxJsxFlowElement", "mdxJsxTextElement", "mdxFlowExpression", "mdxTextExpression", "mdxjsEsm", "html"]);

/**
 * Audit an engine page body (frontmatter removed) against its contract v2
 * record. With `record` null (missing, legacy or invalid record — reported
 * by the caller) only the record-independent Year-One structure is checked.
 * `lineOffset` is added to reported line numbers (the frontmatter's lines).
 */
export function auditEngineArtifact(
  body: string,
  record: ResearchRecordV2 | null,
  options: { lineOffset?: number } = {},
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
  walk(parsed.root, (node) => {
    if (MDX_ONLY_NODES.has(node.type)) {
      ctx.errors.push(`${node.type} at line ${lineOf(ctx, node.start)}: engine pages render record text literally (no JSX, expressions or HTML)`);
    }
  });
  const sections = sectionsOf(parsed.root);
  const section = (title: string) => sections.find((s) => s.title === title);
  auditYearOne(ctx, section("Business Model"), record);
  if (!record) return result;

  const ev = evidenceOf(record);
  const handled = new Set<MdNode>();
  const prose: ProsePiece[] = [];
  result.metrics.verifiedQuotes = auditQuotes(ctx, parsed.root, record, ev);
  const market = section("Market Research");
  if (market) {
    result.metrics.marketRows = auditMarketRows(ctx, market, record, ev, handled, prose);
    auditKeywordRows(ctx, market, record, handled);
  }
  const competitive = section("Competitive Landscape");
  if (competitive) {
    result.metrics.competitorRows = auditCompetitorRows(ctx, competitive, record, ev, handled, prose, result.competitorLinks);
  }
  for (const title of FIGURE_SECTIONS) {
    const s = section(title);
    if (s) collectProse(ctx, title, s.nodes, ev, handled, prose);
  }
  result.metrics.unboundFigures = auditFigures(ctx, prose, ev);
  return result;
}
