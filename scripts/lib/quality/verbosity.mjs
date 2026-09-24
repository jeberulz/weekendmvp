/**
 * Verbosity checks: sentence length, long-sentence share, filler density,
 * and sentences repeated within one page.
 */

import { countWords, per1k } from "./parse.mjs";

const LIST_MARKER_RE = /^\s*(?:[-*+]|\d+\.)\s+/;

/**
 * Split prose into sentences. Each line is split on its own so list items
 * without end punctuation do not merge into one giant sentence. Fragments
 * under 4 words (labels, prices) are dropped.
 */
export function splitSentences(prose) {
  return prose
    .split(/\n+/)
    .map((line) => line.replace(LIST_MARKER_RE, "").trim())
    .filter(Boolean)
    .flatMap((line) => line.split(/(?<=[.!?])\s+(?=["'(]?[A-Z0-9])/))
    .map((s) => s.trim())
    .filter((s) => countWords(s) >= 4);
}

function normalise(sentence) {
  return sentence
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Verbosity metrics for one page. `fillerCount` comes from the lexicon.
 */
export function checkVerbosity(prose, wordCount, fillerCount, { longSentenceWords }) {
  const sentences = splitSentences(prose);
  const lengths = sentences.map(countWords);
  const sentenceCount = sentences.length;
  const totalWords = lengths.reduce((a, b) => a + b, 0);
  const longCount = lengths.filter((n) => n > longSentenceWords).length;

  let longest = { words: 0, text: "" };
  sentences.forEach((s, i) => {
    if (lengths[i] > longest.words) longest = { words: lengths[i], text: s };
  });

  const seen = new Map();
  for (const s of sentences) {
    if (countWords(s) < 8) continue;
    const key = normalise(s);
    seen.set(key, { text: s, count: (seen.get(key)?.count ?? 0) + 1 });
  }
  const repeated = [...seen.values()].filter((v) => v.count > 1);

  return {
    sentenceCount,
    avgSentenceWords:
      sentenceCount > 0 ? Math.round((totalWords / sentenceCount) * 10) / 10 : 0,
    longSentenceShare:
      sentenceCount > 0 ? Math.round((longCount / sentenceCount) * 100) / 100 : 0,
    longest,
    fillerPer1k: per1k(fillerCount, wordCount),
    repeated,
  };
}
