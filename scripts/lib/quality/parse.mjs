/**
 * Shared parsing for the Layer 0 quality checks.
 *
 * Reuses the MDX helpers in scripts/audit-idea-mdx.mjs so the quality gate
 * and the structural auditor read a page the same way.
 */

import {
  countWords,
  splitFrontmatter,
  splitSections,
  stripCode,
} from "../../audit-idea-mdx.mjs";

export { countWords };

/**
 * Turn markdown into plain prose: drop code, headings, link URLs and
 * emphasis markers, and normalise curly apostrophes so lexicon matching
 * sees one form.
 */
export function toProse(markdown) {
  return stripCode(markdown)
    .replace(/^#{1,6}[ \t].*$/gm, " ")
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\*\*|__/g, "")
    .replace(/[‘’]/g, "'");
}

/**
 * Parse one idea page.
 *
 * `prose` covers every section except `excludeSections` (the build prompts
 * and the Sources list), because those are code or citations, not writing.
 */
export function parseIdea(raw, slug, { excludeSections = [] } = {}) {
  const { body } = splitFrontmatter(raw);
  const sections = splitSections(body);
  const writing = sections
    .filter((s) => !excludeSections.includes(s.title))
    .map((s) => s.content)
    .join("\n\n");
  const prose = toProse(writing);
  return {
    slug,
    raw,
    body,
    sections,
    prose,
    wordCount: countWords(prose),
  };
}

/** Short one-line excerpt around `index` for actionable messages. */
export function excerpt(text, index, radius = 50) {
  const start = Math.max(0, index - radius);
  const end = Math.min(text.length, index + radius);
  const clip = text.slice(start, end).replace(/\s+/g, " ").trim();
  return `${start > 0 ? "…" : ""}${clip}${end < text.length ? "…" : ""}`;
}

export function per1k(count, words) {
  return words > 0 ? Math.round((count * 1000 * 100) / words) / 100 : 0;
}
