/**
 * Editorial evidence tokens (WP46, contract §5 "Editorial tokens").
 *
 * Editorial text references accepted evidence as `[[ev:<id>]]`; the compiler
 * expands each token into canonical text rendered from the validated item,
 * so a figure on the page comes from the evidence, not from the writer.
 *
 * findUnboundFigures is a GUARD, not proof of truth. It flags figures the
 * writer typed outside tokens in fact-bearing fields, so source-backed
 * numbers can only arrive through accepted evidence. It cannot tell whether
 * qualitative prose is accurate, and it deliberately does not flag:
 *   - digits inside words or names: B2B, Web3, S3, G2, Q3, 3D, 2FA;
 *     "Letter-digit" names such as GPT-4 or COVID-19;
 *   - a bare four-digit year 1990–2039 (also "2020s"), which also means a
 *     count written as "2024 users" passes;
 *   - most spelled-out numbers ("a team of eight", "a million users"). It
 *     does flag spelled percentages ("sixty percent"), hyphenated number
 *     words ("forty-seven") and number words before a magnitude ("two
 *     million").
 * Human review of the rendered page remains required.
 */

import { formatAmount, formatPriceTerms } from "./amount.ts";
import {
  EVIDENCE_TOKEN_RE,
  type AcceptedEvidence,
  type EvidenceKind,
  type MarketStatEvidence,
} from "./contract.ts";

/** Thrown by expandEvidenceTokens for an id that is not an accepted item. */
export class EvidenceReferenceError extends Error {
  readonly id: string;

  constructor(id: string) {
    super(`Unknown evidence id "${id}" in editorial text`);
    this.name = "EvidenceReferenceError";
    this.id = id;
  }
}

function tokenRe(): RegExp {
  return new RegExp(EVIDENCE_TOKEN_RE.source, "g");
}

/** Every `[[ev:<id>]]` id in order of appearance (repeats included). */
export function evidenceRefs(text: string): string[] {
  return [...text.matchAll(tokenRe())].map((m) => m[1] ?? "").filter((id) => id !== "");
}

/** Text with every valid token replaced by spaces, so indices stay aligned. */
function maskTokens(text: string): string {
  return text.replace(tokenRe(), (token) => " ".repeat(token.length));
}

const FIGURE_RE = new RegExp(
  String.raw`(?<![\p{L}\p{N}_])` +
    String.raw`(?:US\$|CA\$|C\$|AU\$|A\$|[$€£]|(?:USD|EUR|GBP|CAD|AUD)[ \u00A0]?)?` +
    String.raw`\d+(?:[.,:/]\d+)*` +
    String.raw`(?:[ \u00A0]?(?:%|percent(?!\p{L})|per[ \u00A0]cent(?!\p{L})|thousand(?!\p{L})|million(?!\p{L})|billion(?!\p{L})|trillion(?!\p{L})|bn(?!\p{L})|mn(?!\p{L})|tn(?!\p{L})|(?:USD|EUR|GBP|CAD|AUD)(?!\p{L}))|[kKmMbBtTxX](?![\p{L}\p{N}]))?` +
    String.raw`(?![\p{L}\p{N}])`,
  "gu",
);

const BARE_YEAR_RE = /^(?:19[89]\d|20[0-3]\d)$/;
const DECADE_RE = /^(?:19[89]0|20[0-3]0)s$/;

const NUMBER_WORD =
  "(?:zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred)";
const NUMBER_PHRASE = `${NUMBER_WORD}(?:[-\\s]+${NUMBER_WORD})*`;

const SPELLED_FIGURE_RES: readonly RegExp[] = [
  new RegExp(`(?<![\\p{L}])(?:a\\s+|one\\s+)?${NUMBER_PHRASE}\\s*(?:percent|per\\s+cent|%)(?![\\p{L}])`, "giu"),
  new RegExp(`(?<![\\p{L}])${NUMBER_PHRASE}\\s+(?:thousand|million|billion|trillion)(?![\\p{L}])`, "giu"),
  /(?<![\p{L}])(?:twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)-(?:one|two|three|four|five|six|seven|eight|nine)(?![\p{L}])/giu,
];

/** A digit run that is part of a "Letter-digit" name such as GPT-4. */
function isHyphenatedName(text: string, index: number): boolean {
  return text[index - 1] === "-" && /\p{L}/u.test(text[index - 2] ?? "");
}

/**
 * Figures outside `[[ev:…]]` tokens: any number (with currency, %, magnitude
 * or "x"), except a bare year 1990–2039 not adjacent to a currency sign or
 * code, %, or a magnitude word; plus spelled-out percentages and the other
 * spelled forms listed at the top of this file. A guard, not proof of truth.
 */
export function findUnboundFigures(text: string): Array<{ figure: string; index: number }> {
  const masked = maskTokens(text);
  const hits: Array<{ figure: string; index: number }> = [];
  for (const m of masked.matchAll(FIGURE_RE)) {
    const index = m.index ?? 0;
    const figure = m[0];
    if (BARE_YEAR_RE.test(figure)) continue;
    if (isHyphenatedName(masked, index)) continue;
    hits.push({ figure, index });
  }
  // "1000s of users" is a figure; a decade such as "2020s" is not.
  for (const m of masked.matchAll(/(?<![\p{L}\p{N}])\d+(?:[.,]\d+)*s(?![\p{L}\p{N}])/gu)) {
    if (!DECADE_RE.test(m[0])) hits.push({ figure: m[0], index: m.index ?? 0 });
  }
  for (const re of SPELLED_FIGURE_RES) {
    for (const m of masked.matchAll(new RegExp(re.source, re.flags))) {
      hits.push({ figure: m[0].trim(), index: m.index ?? 0 });
    }
  }
  hits.sort((a, b) => a.index - b.index || b.figure.length - a.figure.length);
  const out: Array<{ figure: string; index: number }> = [];
  let coveredUntil = -1;
  for (const hit of hits) {
    if (hit.index < coveredUntil) continue;
    out.push(hit);
    coveredUntil = hit.index + hit.figure.length;
  }
  return out;
}

const MALFORMED_TOKEN_RE = /\[\[\s*ev\s*:[^\]]*\]?\]?/gi;

/** Input to validateEditorialText. */
export type EditorialTextInput = {
  /** Record path for messages, e.g. "market.summary". */
  path: string;
  text: string;
  /** True for FACT_BEARING_FIELDS: figures must come through tokens. */
  factBearing: boolean;
  accepted: ReadonlyMap<string, AcceptedEvidence>;
  /** Kinds this field may reference; every kind when omitted. */
  allowedKinds?: ReadonlyArray<EvidenceKind>;
};

/**
 * Issues for one editorial field: malformed tokens, unknown (or rejected)
 * ids, kinds not allowed here and, when fact-bearing, unbound figures.
 */
export function validateEditorialText(input: EditorialTextInput): string[] {
  const { path, text, factBearing, accepted, allowedKinds } = input;
  const issues: string[] = [];
  for (const m of maskTokens(text).matchAll(MALFORMED_TOKEN_RE)) {
    issues.push(`${path}: malformed evidence token "${m[0].slice(0, 40)}"`);
  }
  for (const id of new Set(evidenceRefs(text))) {
    const item = accepted.get(id);
    if (!item) {
      issues.push(`${path}: unknown evidence id "${id}" (not an accepted item)`);
      continue;
    }
    if (allowedKinds && !allowedKinds.includes(item.kind)) {
      issues.push(`${path}: evidence ${id} is a ${item.kind}; allowed here: ${allowedKinds.join(", ")}`);
    }
  }
  if (factBearing) {
    for (const { figure, index } of findUnboundFigures(text)) {
      issues.push(
        `${path}: unbound figure "${figure}" at ${index}; cite accepted evidence with [[ev:<id>]] or remove it`,
      );
    }
  }
  return issues;
}

function renderStat(item: MarketStatEvidence): string {
  const amount = formatAmount(item.amount);
  if (item.period.kind === "measured") {
    return item.period.year !== undefined ? `${amount} (${item.period.year})` : amount;
  }
  return item.period.toYear !== undefined
    ? `${amount} by ${item.period.toYear} (projected)`
    : `${amount} (projected)`;
}

/**
 * Canonical plain text for a token: "$1.4 million (2024)", "$5.2 billion by
 * 2030 (projected)", "$24/user/month, billed annually (Essentials)", or a
 * quote in straight double quotes with whitespace collapsed.
 */
export function renderEvidenceInline(item: AcceptedEvidence): string {
  if (item.kind === "market_stat") return renderStat(item);
  if (item.kind === "competitor_price") {
    const price = formatPriceTerms(item.price);
    return item.plan ? `${price} (${item.plan})` : price;
  }
  return `"${item.excerpt.replace(/\s+/g, " ").trim()}"`;
}

/** Replace every token with `render(item)`; throws EvidenceReferenceError on an unknown id. */
export function expandEvidenceTokens(
  text: string,
  accepted: ReadonlyMap<string, AcceptedEvidence>,
  render: (item: AcceptedEvidence) => string = renderEvidenceInline,
): string {
  return text.replace(tokenRe(), (_token, id: string) => {
    const item = accepted.get(id);
    if (!item) throw new EvidenceReferenceError(id);
    return render(item);
  });
}
