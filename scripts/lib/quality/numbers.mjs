/**
 * Numeric-claim checks for the factual sections (The Problem, Market
 * Research, Competitive Landscape).
 *
 * Every money figure, percentage, "X million" and comma-grouped number is a
 * claim a reader will repeat. Each claim is classed by the evidence sitting
 * in the same paragraph or list item:
 *
 *   linked    - an inline markdown link
 *   named     - a named source ("Grand View", "according to", "r/Posture")
 *   listed    - a bolded name that also appears in the ## Sources list
 *   unsourced - none of the above
 *
 * Years ("2030") and small bare integers ("three-hour", "4 steps") are not
 * claims and are ignored. This is a heuristic: it finds numbers that lack
 * evidence nearby. Whether a cited source actually supports the number is
 * Layer 2's job.
 */

import { excerpt, toProse } from "./parse.mjs";

const MAGNITUDE = String.raw`(?:[Mm]illion|[Bb]illion|[Tt]rillion|bn|[KMB](?![A-Za-z]))`;

export const NUMERIC_CLAIM_RE = new RegExp(
  [
    String.raw`[$€£]\s?\d[\d,]*(?:\.\d+)?(?:\s?${MAGNITUDE})?`,
    String.raw`\b\d[\d,]*(?:\.\d+)?\s?(?:%|percent\b)`,
    String.raw`\b\d+(?:\.\d+)?\s?(?:[Mm]illion|[Bb]illion|[Tt]rillion)\b`,
    String.raw`\b\d+(?:\.\d+)?[KMB]\b`,
    String.raw`\b\d{1,3}(?:,\d{3})+(?:\.\d+)?\b`,
  ].join("|"),
  "g",
);

const SOURCE_CUE_RE =
  /\b(?:according to|reports?|reported|survey(?:ed|s)?|stud(?:y|ies)|data from|estimates? from|analysts?|cites?|cited|collated|press release|research from|Grand View|Statista|Gartner|McKinsey|Forrester|IDC|Pew|Census|BLS|Bureau of Labor|IBISWorld|Mordor|Fortune Business|MarketsandMarkets|Markets and Markets|Precedence Research|Allied Market|Verified Market|Deloitte|PwC|Nielsen|eMarketer|Similarweb|Sensor Tower|Crunchbase|G2|Capterra|Ideabrowser|App Store|Google Play|Product Hunt|Glassdoor|Reddit|r\/\w+|YouTube|Google Trends|DataForSEO|Ahrefs|Semrush)\b/i;

const HEDGE_RE =
  /\b(?:inferred|guess(?:ed|timate)?|assum(?:e|ed|ing|ption)|ballpark|unverified|hypothetical)\b/i;

const INLINE_LINK_RE = /\]\(https?:\/\//;
const BOLD_RE = /\*\*([^*]{3,80})\*\*/g;
const LIST_ITEM_RE = /^\s*(?:[-*+]|\d+\.)\s+/;

/** Split a section into paragraphs, with each list item as its own unit. */
export function splitUnits(markdown) {
  const units = [];
  for (const block of markdown.split(/\n\s*\n/)) {
    let current = [];
    for (const line of block.split("\n")) {
      if (LIST_ITEM_RE.test(line) && current.length > 0) {
        units.push(current.join("\n"));
        current = [];
      }
      current.push(line);
    }
    if (current.length > 0) units.push(current.join("\n"));
  }
  return units.map((u) => u.trim()).filter(Boolean);
}

/** Lowercased link texts + hosts from the Sources section, for "listed". */
export function sourceHaystack(sourcesContent) {
  if (!sourcesContent) return "";
  const parts = [];
  for (const m of sourcesContent.matchAll(/\[([^\]]*)\]\((https?:\/\/[^)\s]+)\)/g)) {
    parts.push(m[1]);
    try {
      parts.push(new URL(m[2]).hostname);
    } catch {
      // Invalid URLs are reported by the sources check.
    }
  }
  return parts.join(" \n ").toLowerCase();
}

function isListed(unit, haystack) {
  if (!haystack) return false;
  for (const m of unit.matchAll(BOLD_RE)) {
    const name = m[1].trim().toLowerCase();
    // Bolded figures ("**$12.5 billion**") are claims, not names.
    if (/^[\d$€£~≈<>.,%\s-]/.test(name)) continue;
    if (name.length >= 4 && haystack.includes(name)) return true;
  }
  return false;
}

/**
 * Numeric-claim metrics across the factual sections.
 */
export function checkNumbers(sections, { factualSections, sourcesTitle }) {
  const haystack = sourceHaystack(
    sections.find((s) => s.title === sourcesTitle)?.content,
  );
  const counts = { claims: 0, linked: 0, named: 0, listed: 0, unsourced: 0 };
  const unsourcedExamples = [];
  const hedged = [];

  for (const section of sections) {
    if (!factualSections.includes(section.title)) continue;
    for (const unit of splitUnits(section.content)) {
      const prose = toProse(unit);
      const matches = [...prose.matchAll(NUMERIC_CLAIM_RE)];
      if (matches.length === 0) continue;

      const n = matches.length;
      counts.claims += n;
      let evidence = "unsourced";
      if (INLINE_LINK_RE.test(unit)) evidence = "linked";
      else if (SOURCE_CUE_RE.test(prose)) evidence = "named";
      else if (isListed(unit, haystack)) evidence = "listed";
      counts[evidence] += n;

      if (evidence === "unsourced" && unsourcedExamples.length < 5) {
        unsourcedExamples.push({
          section: section.title,
          text: excerpt(prose, matches[0].index),
        });
      }
      const hedge = prose.match(HEDGE_RE);
      if (hedge) {
        hedged.push({
          section: section.title,
          marker: hedge[0],
          text: excerpt(prose, hedge.index),
        });
      }
    }
  }

  return {
    ...counts,
    unsourcedShare:
      counts.claims > 0
        ? Math.round((counts.unsourced / counts.claims) * 100) / 100
        : 0,
    unsourcedExamples,
    hedged,
  };
}
