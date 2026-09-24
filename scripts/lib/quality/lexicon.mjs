/**
 * Slop lexicon checks: banned stock phrases and watch-word density.
 *
 * Phrase lists live in evals/slop-lexicon.json. Matching is
 * case-insensitive and whole-word, where a hyphen counts as part of a word
 * so "leverage" does not match "leveraged" and "robust" does not match
 * "non-robust".
 */

import { excerpt, per1k } from "./parse.mjs";

function phraseRegex(phrase) {
  const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?<![A-Za-z0-9-])${escaped}(?![A-Za-z0-9-])`, "gi");
}

/**
 * Count each phrase in `prose`. Returns only phrases with at least one hit,
 * with an excerpt of the first hit.
 */
export function countPhrases(prose, phrases) {
  const hits = [];
  for (const phrase of phrases) {
    const matches = [...prose.matchAll(phraseRegex(phrase))];
    if (matches.length === 0) continue;
    hits.push({
      phrase,
      count: matches.length,
      example: excerpt(prose, matches[0].index),
    });
  }
  return hits;
}

const total = (hits) => hits.reduce((sum, h) => sum + h.count, 0);

/**
 * Slop metrics for one page.
 * `banned` is every banned phrase found. `watchPer1k` is watch-word hits per
 * 1,000 words of prose.
 */
export function checkSlop(prose, wordCount, lexicon) {
  const banned = countPhrases(prose, lexicon.ban);
  const watch = countPhrases(prose, lexicon.watch);
  const watchCount = total(watch);
  return {
    banned,
    watch,
    watchCount,
    watchPer1k: per1k(watchCount, wordCount),
  };
}

export function countFiller(prose, lexicon) {
  return total(countPhrases(prose, lexicon.filler));
}
