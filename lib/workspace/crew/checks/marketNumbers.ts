/**
 * WP75-S4a: market numbers in own ideas (D15).
 *
 * An own idea has no validated market, so none of its artifacts may assert
 * one: no prices, percentages, market sizes, revenue metrics or traction
 * counts. This wraps the WP74 detector (`hasMarketClaim`, the one the light
 * blueprint uses) rather than forking it, after removing text that is not a
 * claim: bracketed placeholders and product measures ("250 ml", "600 m
 * climb"). Numbers of time and distance are already exempt in the detector.
 *
 * Library ideas carry researched market data; this check is for own ideas
 * only. Kinds whose numbers are plans, not claims (roster, launch plan, ads
 * budgets) are not in `MARKET_CHECKED_KINDS`.
 */
import { hasMarketClaim } from "../../wizard/light-blueprint";
import { issue, snippet, type CheckIssue } from "./types";
import { isCopyPath, stringLeaves, stripPlaceholders } from "./walk";

/** Artifact kinds an own idea may not put a market number into. */
export const MARKET_CHECKED_KINDS = [
  "blueprint",
  "brand_kit",
  "landing_spec",
  "email_sequence",
  "social_pack",
  "seo_pack",
] as const;

/** Product measures the detector reads as counted nouns or magnitudes. */
const MEASURES = new RegExp(
  [
    String.raw`\b\d[\d,.]*\s?(?:ml|cl|dl|l|litres?|liters?|oz|g|mg|cm|mph|bpm|hz|gb|mb|tb)\b`,
    String.raw`\b\d[\d,.]*\s(?:m)\s+(?:climb|gain|elevation|ascent|descent|altitude|high|deep|long|wide|away|sprint|dash|swim|run)\b`,
    String.raw`\b\d[\d,.]*\s?°\s?[CF]\b`,
  ].join("|"),
  "giu",
);

/** The text with placeholders and product measures taken out. */
export const withoutNonClaims = (text: string): string => stripPlaceholders(text).replace(MEASURES, " ");

/** True when the text carries a market number once non-claims are removed. */
export function carriesMarketNumber(text: string): boolean {
  return hasMarketClaim(withoutNonClaims(text));
}

/** One hard issue per string in an own idea's artifact that carries a market number. */
export function checkMarketNumbers(artifact: unknown): CheckIssue[] {
  const issues: CheckIssue[] = [];
  for (const { value, path } of stringLeaves(artifact, (p) => !isCopyPath(p))) {
    if (carriesMarketNumber(value)) {
      issues.push(
        issue(
          "hard",
          "own_idea_market_number",
          path,
          `An own idea asserts no market numbers, prices or traction counts ("${snippet(withoutNonClaims(value))}"). Remove the number.`,
        ),
      );
    }
  }
  return issues;
}
