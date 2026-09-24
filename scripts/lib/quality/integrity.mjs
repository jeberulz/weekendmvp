/**
 * Integrity checks: leftover placeholders and leaked model chatter.
 *
 * Runs on prose with code removed, so the build prompts (fenced code) can
 * still say "TODO" or "[your product]" where the reader fills them in.
 */

import { excerpt } from "./parse.mjs";

export const PLACEHOLDER_PATTERNS = [
  /\bTODO\b/,
  /\bTBD\b/,
  /\bFIXME\b/,
  /\blorem ipsum\b/i,
  /\[(?:insert|your|add|placeholder)\b[^\]]*\]/i,
  /\bX{2,}\s?%/,
  /\$X{2,}\b/,
  /\bIDEA_TITLE\b/,
];

export const LEAK_PATTERNS = [
  /\bas an AI(?: language)? model\b/i,
  /\bI(?:'m| am) sorry, but\b/i,
  /\bI cannot (?:help|assist|provide|fulfill|comply)\b/i,
  /\bknowledge cutoff\b/i,
  /\bCertainly! Here\b/i,
  /\bI hope this helps\b/i,
  /\bRegenerate response\b/i,
  /\bHere(?:'s| is) (?:the|a|an) (?:revised|updated|rewritten|improved) (?:version|draft)\b/i,
];

function findAll(prose, patterns) {
  const hits = [];
  for (const re of patterns) {
    const m = prose.match(re);
    if (m) hits.push({ match: m[0], text: excerpt(prose, m.index) });
  }
  return hits;
}

export function checkIntegrity(prose) {
  return {
    placeholders: findAll(prose, PLACEHOLDER_PATTERNS),
    leaks: findAll(prose, LEAK_PATTERNS),
  };
}
