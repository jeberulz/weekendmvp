/**
 * WP90-S2 — the seed source: what `crew-idea-seed@1` reads about one library
 * idea. Built from the idea's published page only (`content/ideas/{slug}.mdx`)
 * and its `ideas/manifest.json` row; nothing the founder wrote, nothing from
 * another idea.
 *
 * - The MDX is split on its `##` headings into the canonical sections of
 *   `ideas/SECTIONS.md`. Frontmatter, imports, exports and JSX lines are
 *   dropped; prose, lists and the build prompts' text are kept.
 * - Every section and prompt is bounded, so one source always fits the
 *   `deep_batch` input lane with room for the system block and schema.
 * - The prompt quotes the whole source as data (`dataBlock`).
 * - `sourceText` is the text the audit checks quotes and competitor names
 *   against: exactly what the model was shown.
 *
 * Pure: no fs, no Convex imports, relative imports only (the Convex bundler
 * loads this file).
 */

export const SEED_SOURCE_LIMITS = {
  title: 200,
  description: 600,
  summary: 1_200,
  section: 6_000,
  prompt: 3_500,
  promptsMax: 4,
  audiences: 8,
  audience: 60,
  /** The whole quoted source, in characters (well under the lane's token ceiling). */
  total: 60_000,
} as const;

/** The section keys a source may carry, in page order. */
export const SEED_SOURCE_SECTIONS = [
  "problem",
  "solution",
  "marketResearch",
  "competitiveLandscape",
  "businessModel",
  "techStack",
] as const;
export type SeedSourceSection = (typeof SEED_SOURCE_SECTIONS)[number];

const HEADING_KEYS: Readonly<Record<string, SeedSourceSection | "prompts" | "sources">> = Object.freeze({
  "the problem": "problem",
  "the solution": "solution",
  "market research": "marketResearch",
  "competitive landscape": "competitiveLandscape",
  "business model": "businessModel",
  "recommended tech stack": "techStack",
  "ai prompts to build this": "prompts",
  sources: "sources",
});

export type SeedSourceManifestRow = {
  readonly slug: string;
  readonly title: string;
  readonly description: string;
  readonly summary?: string;
  readonly category?: string;
  readonly audiences?: readonly string[];
  readonly researchLevel?: string;
  readonly provenance?: { readonly auditPassed?: unknown } | null;
};

export type SeedSourcePrompt = { readonly title: string; readonly text: string };

export type SeedSource = {
  readonly slug: string;
  readonly title: string;
  readonly description: string;
  readonly summary?: string;
  readonly category?: string;
  readonly audiences: readonly string[];
  readonly researchLevel: string | null;
  readonly auditPassed: boolean | null;
  readonly sections: Readonly<Partial<Record<SeedSourceSection, string>>>;
  readonly howItWorks: readonly string[];
  readonly prompts: readonly SeedSourcePrompt[];
};

export class SeedSourceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SeedSourceError";
  }
}

function bounded(text: string, max: number): string {
  const clean = text.replace(/\r\n?/gu, "\n").trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max);
  const lastBreak = Math.max(cut.lastIndexOf("\n"), cut.lastIndexOf(". "));
  return (lastBreak > max * 0.6 ? cut.slice(0, lastBreak + 1) : cut).trim();
}

function withoutFrontmatter(mdx: string): string {
  const text = mdx.replace(/\r\n?/gu, "\n");
  if (!text.startsWith("---\n")) return text;
  const end = text.indexOf("\n---", 4);
  return end === -1 ? text : text.slice(end + 4);
}

/** Drops MDX-only lines (imports, exports, JSX tags) and HTML comments; keeps prose and fenced text. */
function proseOnly(text: string): string {
  const out: string[] = [];
  let inFence = false;
  for (const raw of text.split("\n")) {
    const line = raw.replace(/\s+$/u, "");
    if (/^\s*(```|~~~)/u.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (!inFence) {
      if (/^\s*(import|export)\s/u.test(line)) continue;
      if (/^\s*<\/?[A-Za-z][^>]*>\s*$/u.test(line)) continue;
    }
    out.push(line);
  }
  return out
    .join("\n")
    .replace(/<!--[\s\S]*?-->/gu, "")
    .replace(/\n{3,}/gu, "\n\n")
    .trim();
}

function splitSections(body: string): Map<string, string> {
  const sections = new Map<string, string>();
  const parts = body.split(/^## +/mu);
  for (const part of parts.slice(1)) {
    const newline = part.indexOf("\n");
    const heading = (newline === -1 ? part : part.slice(0, newline)).trim().toLowerCase();
    const key = HEADING_KEYS[heading];
    if (key === undefined || sections.has(key)) continue;
    sections.set(key, newline === -1 ? "" : part.slice(newline + 1));
  }
  return sections;
}

/** The numbered list under `**How it works:**`, as plain lines ("Install GitHub App — One-click install"). */
function howItWorksSteps(solution: string): string[] {
  const at = solution.search(/\*\*How it works:?\*\*/iu);
  if (at === -1) return [];
  const steps: string[] = [];
  for (const line of solution.slice(at).split("\n").slice(1)) {
    const match = /^\s*\d+\.\s+(.*)$/u.exec(line);
    if (match) {
      steps.push(bounded(match[1]!.replace(/\*\*/gu, ""), 240));
      continue;
    }
    if (steps.length > 0 && line.trim().length === 0) continue;
    if (steps.length > 0) break;
  }
  return steps.slice(0, 8);
}

/** The four build prompts: each `**N. Title**` line and the fenced text under it. */
function buildPrompts(section: string): SeedSourcePrompt[] {
  const prompts: SeedSourcePrompt[] = [];
  const pattern = /^\*\*\d+\.\s+([^*]+)\*\*\s*\n+(?:```|~~~)[^\n]*\n([\s\S]*?)\n(?:```|~~~)/gmu;
  for (const match of section.matchAll(pattern)) {
    prompts.push({ title: bounded(match[1]!, 80), text: bounded(match[2]!, SEED_SOURCE_LIMITS.prompt) });
    if (prompts.length >= SEED_SOURCE_LIMITS.promptsMax) break;
  }
  return prompts;
}

/**
 * The seed source for one idea. Throws `SeedSourceError` when the page has no
 * Problem or Solution section (nothing to seed from) or the slugs disagree.
 */
export function seedSourceFromPage(input: {
  readonly mdx: string;
  readonly manifest: SeedSourceManifestRow;
}): SeedSource {
  const { manifest } = input;
  const front = /^---\n[\s\S]*?\bslug:\s*"?([a-z0-9-]+)"?/u.exec(input.mdx.replace(/\r\n?/gu, "\n"));
  if (front && front[1] !== manifest.slug) {
    throw new SeedSourceError(`MDX slug "${front[1]}" does not match the manifest slug "${manifest.slug}"`);
  }
  const raw = splitSections(withoutFrontmatter(input.mdx));
  const sections: Partial<Record<SeedSourceSection, string>> = {};
  for (const key of SEED_SOURCE_SECTIONS) {
    const text = raw.get(key);
    if (text === undefined) continue;
    const prose = proseOnly(text);
    if (prose.length > 0) sections[key] = bounded(prose, SEED_SOURCE_LIMITS.section);
  }
  if (sections.problem === undefined || sections.solution === undefined) {
    throw new SeedSourceError(`${manifest.slug}: the page needs The Problem and The Solution sections`);
  }
  const audit = manifest.provenance?.auditPassed;
  return {
    slug: manifest.slug,
    title: bounded(manifest.title, SEED_SOURCE_LIMITS.title),
    description: bounded(manifest.description, SEED_SOURCE_LIMITS.description),
    ...(manifest.summary ? { summary: bounded(manifest.summary, SEED_SOURCE_LIMITS.summary) } : {}),
    ...(manifest.category ? { category: bounded(manifest.category, 60) } : {}),
    audiences: (manifest.audiences ?? [])
      .slice(0, SEED_SOURCE_LIMITS.audiences)
      .map((audience) => bounded(audience, SEED_SOURCE_LIMITS.audience)),
    researchLevel: manifest.researchLevel ?? null,
    auditPassed: typeof audit === "boolean" ? audit : null,
    sections,
    howItWorks: howItWorksSteps(raw.get("solution") ?? ""),
    prompts: buildPrompts(raw.get("prompts") ?? ""),
  };
}

/** What the prompt quotes: the source without the validation facts the server decides. */
export function seedSourceForPrompt(source: SeedSource): Record<string, unknown> {
  return {
    slug: source.slug,
    title: source.title,
    description: source.description,
    ...(source.summary === undefined ? {} : { summary: source.summary }),
    ...(source.category === undefined ? {} : { category: source.category }),
    audiences: [...source.audiences],
    sections: { ...source.sections },
    howItWorks: [...source.howItWorks],
    buildPrompts: source.prompts.map((prompt) => ({ ...prompt })),
  };
}

/** The source as the prompt's JSON input. Throws when it is over the total bound. */
export function seedSourceJson(source: SeedSource): string {
  const json = JSON.stringify(seedSourceForPrompt(source));
  if (json.length > SEED_SOURCE_LIMITS.total) {
    throw new SeedSourceError(`${source.slug}: the seed source is ${json.length} characters, over ${SEED_SOURCE_LIMITS.total}`);
  }
  return json;
}

/** Every text the model was shown, joined: what quotes and competitor names are checked against. */
export function sourceText(source: SeedSource): string {
  return [
    source.title,
    source.description,
    source.summary ?? "",
    ...SEED_SOURCE_SECTIONS.map((key) => source.sections[key] ?? ""),
    ...source.howItWorks,
    ...source.prompts.flatMap((prompt) => [prompt.title, prompt.text]),
  ].join("\n");
}
