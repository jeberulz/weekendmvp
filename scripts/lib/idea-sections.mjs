/**
 * Shared idea-page section contract.
 *
 * One definition of the seven canonical `##` sections, imported by both the
 * MDX auditor (scripts/audit-idea-mdx.mjs) and the legacy HTML extractor
 * (scripts/extract-idea-bodies.mjs) so the two can never drift.
 *
 * The `{ key, match }` shape is load-bearing for the extractor, which also
 * relies on object identity via `OPTIONAL_SECTIONS.includes(spec)` — keep the
 * exported arrays as the single instances everyone imports.
 */

/** The seven required sections, in the order they must appear. */
export const REQUIRED_SECTIONS = [
  { key: 'problem',     title: 'The Problem',              match: /\bproblem\b/i },
  { key: 'solution',    title: 'The Solution',             match: /\bsolution\b/i },
  { key: 'market',      title: 'Market Research',          match: /market\s*(research|insight|size|opportunity)/i },
  { key: 'competitive', title: 'Competitive Landscape',    match: /competit(or|ive|ors)/i },
  { key: 'business',    title: 'Business Model',           match: /(business\s*model|monetization|pricing|revenue)/i },
  { key: 'stack',       title: 'Recommended Tech Stack',   match: /(tech\s*stack|recommended\s*stack|technology\s*stack)/i },
  { key: 'prompts',     title: 'AI Prompts to Build This', match: /(ai\s*prompts|prompts\s*to\s*build)/i },
];

/**
 * Sections that are not part of the ordered seven. `sources` is required on
 * MDX pages (the auditor counts eight headings) but stays here because the
 * ordering check only governs REQUIRED_SECTIONS.
 */
export const OPTIONAL_SECTIONS = [{ key: 'sources', match: /^\s*sources\s*$/i }];

export const SOURCES_KEY = 'sources';

/** Split `---\n…\n---` frontmatter off the top of an MDX file. */
export function splitFrontmatter(raw) {
  const m = /^---\n([\s\S]*?)\n---\n?/.exec(raw);
  if (!m) return { frontmatter: '', body: raw };
  return { frontmatter: m[1], body: raw.slice(m[0].length) };
}

/**
 * Blank out fenced and inline code without moving any other character, so
 * reported line numbers still line up with the source file.
 */
export function stripCode(text) {
  const blank = (m) => m.replace(/[^\n]/g, ' ');
  return text
    .replace(/^( {4,}|\t)[^\n]*$/gm, blank) // indented code blocks
    .replace(/```[\s\S]*?(?:```|$)/g, blank) // fenced code
    .replace(/`[^`\n]*`/g, blank); // inline code
}

/**
 * Parse `## ` headings into ordered slices of the body.
 * Headings inside code fences are ignored.
 */
export function parseSections(body) {
  const scan = stripCode(body);
  const heads = [];
  const re = /^## +(.+?) *$/gm;
  let m;
  while ((m = re.exec(scan)) !== null) {
    heads.push({ title: body.slice(m.index + 3, m.index + m[0].length).trim(), index: m.index });
  }
  return heads.map((h, i) => ({
    title: h.title,
    index: h.index,
    body: body.slice(h.index, i + 1 < heads.length ? heads[i + 1].index : body.length),
  }));
}

/** The first parsed section whose title matches a spec, or null. */
export function findSection(sections, spec) {
  return sections.find((s) => spec.match.test(s.title)) ?? null;
}

/** Prose word count: code blocks and headings excluded. */
export function countWords(body) {
  return stripCode(body)
    .replace(/^#{1,6} .*$/gm, ' ')
    .split(/\s+/)
    .filter(Boolean).length;
}
