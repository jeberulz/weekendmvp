/**
 * Pain Engine — pain-signal extraction and normalisation.
 *
 * Deterministic heuristics only (no LLM in Phase 1, so nothing here can
 * invent a quote or a stat). A finding counts as a pain when its text
 * matches a pain phrase or carries strong agreement, and it is normalised
 * into the shared PainFinding shape every listener must produce.
 */
import type { PainFinding } from "./types.ts";

/** Phrases that mark a complaint, a workaround, or a wish for a tool. */
export const PAIN_PHRASES = [
  "i wish",
  "i hate",
  "frustrated",
  "frustrating",
  "painful",
  "waste of time",
  "wastes time",
  "takes forever",
  "manual",
  "tedious",
  "annoying",
  "struggling",
  "struggle with",
  "can't find",
  "cannot find",
  "does anyone know",
  "is there a tool",
  "looking for a tool",
  "alternative to",
  "switching from",
  "switched from",
  "gave up on",
  "too expensive",
  "costs too much",
  "paying for",
  "i pay for",
  "spreadsheet hell",
  "copy and paste",
  "copy-paste",
  "every time i have to",
  "why is there no",
  "why isn't there",
  "nobody has built",
  "i would pay",
  "would pay for",
  "hours every week",
  "every day i",
  "broken",
  "doesn't work",
  "does not work",
];

const WORKAROUND_PHRASES = [
  "paying for",
  "i pay for",
  "would pay for",
  "i would pay",
  "hired someone",
  "pay someone",
  "subscription",
  "too expensive",
  "costs too much",
];

/** True when the text reads like a pain / complaint / tool wish. */
export function isPainSignal(text: string): boolean {
  const lower = text.toLowerCase();
  return PAIN_PHRASES.some((phrase) => lower.includes(phrase));
}

/** 0–10: how strongly worded the complaint is. */
export function painIntensity(text: string): number {
  const lower = text.toLowerCase();
  let hits = 0;
  for (const phrase of PAIN_PHRASES) if (lower.includes(phrase)) hits += 1;
  // 1 phrase = 4, 2 = 7, 3+ = 10. Caps so one rant cannot max the axis alone.
  return Math.min(10, hits === 0 ? 0 : hits === 1 ? 4 : hits === 2 ? 7 : 10);
}

/** True when the text says someone already pays (or would pay) for a fix. */
export function mentionsWorkaroundSpend(text: string): boolean {
  const lower = text.toLowerCase();
  return WORKAROUND_PHRASES.some((phrase) => lower.includes(phrase));
}

const MAX_TEXT_CHARS = 2000;

/** Trim, collapse whitespace, and cap length. Quotes stay verbatim. */
export function cleanText(text: string): string {
  return text.replace(/\s+/g, " ").trim().slice(0, MAX_TEXT_CHARS);
}

/**
 * Pick the most quotable sentence: the first sentence (≤190 chars, the
 * manifest problemQuote limit) that itself contains a pain phrase.
 * Returns "" when no sentence qualifies — the writer must then quote
 * nothing rather than invent one.
 */
export function pickQuote(text: string): string {
  const sentences = cleanText(text).split(/(?<=[.!?])\s+/);
  for (const sentence of sentences) {
    if (sentence.length > 0 && sentence.length <= 190 && isPainSignal(sentence)) {
      return sentence;
    }
  }
  return "";
}

/**
 * Real prices found in the evidence, for the value ladder. Only prices
 * actually written in a source text are returned — the writer must show
 * an empty ladder (and a gap) when this returns [], never invent one.
 * Matches "$79/mo", "$500 one-time setup", "$19 per month" and the like.
 */
export function extractPrices(
  text: string,
  url: string,
  context: string,
): { amount: string; cadence: string; context: string; url: string }[] {
  const found: { amount: string; cadence: string; context: string; url: string }[] = [];
  const seen = new Set<string>();
  const re =
    /\$(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)\s*(\/mo|\/month|per month|\/yr|\/year|per year|one-time|once|setup)?/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    const amount = `$${match[1]}`;
    const raw = (match[2] ?? "").toLowerCase();
    const cadence =
      raw === "/mo" || raw === "/month" || raw === "per month"
        ? "per month"
        : raw === "/yr" || raw === "/year" || raw === "per year"
          ? "per year"
          : raw === "one-time" || raw === "once" || raw === "setup"
            ? "one-time"
            : "one-off";
    const key = `${amount}|${cadence}`;
    if (seen.has(key)) continue;
    seen.add(key);
    found.push({ amount, cadence, context, url });
    if (found.length >= 5) break;
  }
  return found;
}

const COMPETITOR_PATTERNS = [
  /alternative to ([A-Z][A-Za-z0-9 .&'-]{1,40})/i,
  /switch(?:ing|ed)? from ([A-Z][A-Za-z0-9 .&'-]{1,40})/i,
  /replac(?:e|ing) ([A-Z][A-Za-z0-9 .&'-]{1,40})/i,
];

/**
 * The status-quo tool named in a finding ("alternative to Notion",
 * "switching from Xero") — the named competitor to beat. Returns ""
 * when no finding names one; the writer then says the status quo is
 * manual work, and flags the naming as a gap.
 */
export function namedStatusQuoCompetitor(text: string): string {
  for (const pattern of COMPETITOR_PATTERNS) {
    const match = pattern.exec(text);
    if (!match) continue;
    const name = match[1]
      .split(/\s+(and|with|because|to|for|so|but)\s/i)[0]
      .replace(/[.,;:!?]+$/, "")
      .trim();
    if (name.length >= 2) return name;
  }
  return "";
}

/** Build a PainFinding from raw listener fields, applying the shared rules. */
export function normaliseFinding(input: {
  source: string;
  url: string;
  title: string;
  text: string;
  context: string;
  date: string;
  agreementCount: number;
}): PainFinding {
  const text = cleanText(input.text);
  const title = cleanText(input.title).slice(0, 200);
  return {
    source: input.source,
    url: input.url,
    title,
    text,
    context: input.context,
    date: input.date,
    agreementCount: Math.max(0, Math.floor(input.agreementCount || 0)),
    quote: pickQuote(text || title),
  };
}
