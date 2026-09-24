/**
 * Idea MDX quality gates shared by audit:idea (Mode A2 writing bar).
 *
 * Deep bar reference: content/ideas/course-translation-resale-network.mdx
 * (~2,300–2,600 words, named product, zero stock filler).
 *
 * Round 3: sentence-level + cross-idea 8+ word dedupe; ≥2200 words hard;
 * no compiler padding templates; proper audience casing.
 */

/** Soft target for engine-draft-* (IB deep pages are ~2,300–2,600). */
export const MIN_DEEP_BODY_WORDS = 2200;
/** Hard floor — Round 3: same as soft (no soft gap). */
export const MIN_DEEP_BODY_WORDS_HARD = 2200;

/** Minimum word count for a sentence to enter the duplicate check. */
export const MIN_SENTENCE_WORDS = 8;

/** Slugs that opt into the deep writing bar (not the whole corpus). */
export function isDeepDraftSlug(slug) {
  return typeof slug === "string" && slug.startsWith("engine-draft-");
}

/**
 * Stock filler / boilerplate the old padParagraphs compiler emitted,
 * plus Round 3 hardcoded padding templates.
 * Presence of any phrase FAILS audit (case-insensitive).
 */
export const FILLER_DENYLIST = [
  "before you build, confirm the pain",
  "talk to five people who match the audience",
  "the quotes above are a starting point, not proof",
  "write down the one moment where the current approach breaks",
  "ship the smallest version that completes the workflow above",
  "watch the first users go through each step",
  "track usage and costs from day one",
  "treat third-party market-size figures as directional",
  "keyword volume shows how many people search for the problem today",
  "read each competitor's pricing page and reviews before you set your own price",
  "start with one channel from the list above and one price",
  "add ai apis, queues, or search only when a step",
  "one database and one deploy target keep a weekend build manageable",
  "keep acquisition cost under a few months of revenue",
  "grow revenue per account through usage or seats once the core workflow sticks",
  "this idea is for ",
  "build a focused product for ",
  "recommended weekend stack for this idea",
  // Round 3 — hardcoded cross-idea padding
  "success looks like a user finishing this step without opening a side doc",
  "passport stamp",
  "agency-scale saas year",
  "weekly questionnaire load",
  // Operator / meta prose must never ship in draft MDX
  "re-check before publish",
  "never model-invented",
  "model-invented",
  "operator note",
  "before you publish, confirm",
  "tagging left for operator",
];

/** Generic mega-TAM claims that are not niche sizing. */
export const MEGA_TAM_DENYLIST = [
  /global saas market/i,
  /worldwide saas (revenue|market)/i,
  /saas market .{0,40}\$\s?\d{2,4}(\.\d+)?\s*b/i,
  /global ai (software|tools|market).{0,40}\$\s?\d/i,
  /e-learning .{0,60}\$\s?\d{2,4}b.{0,40}203[0-9]/i,
];

/**
 * Competitor URLs that look like roundups / comparison blogs, not first-party
 * pricing pages.
 */
export const COMPETITOR_ROUNDUP_URL_RE =
  /(?:^|\/)(?:best-|top-\d|alternatives?)(?:\/|-)|(?:vs-|versus-)|comparison|roundup|\/blog-posts\/best/i;

export const COMPETITOR_ROUNDUP_HOST_PATH_RE =
  /\/(best|top)-[\w-]*(rfp|ai|software|tools|page|builder)/i;

/**
 * Normalize quote text for fidelity checks (whitespace + curly quotes).
 */
export function normalizeQuote(text) {
  return String(text)
    .replace(/[\u2018\u2019\u201A\u201B]/g, "'")
    .replace(/[\u201C\u201D\u201E\u201F]/g, '"')
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/**
 * Split prose into paragraphs (blank-line separated), ignoring fenced code.
 */
export function proseParagraphs(body) {
  const withoutCode = body
    .replace(/```[\s\S]*?```/g, "\n\n")
    .replace(/`[^`]*`/g, " ");
  return withoutCode
    .split(/\n\s*\n/)
    .map((p) => p.replace(/^#+\s.+$/gm, "").replace(/^>\s?/gm, "").trim())
    .filter((p) => p.length >= 80);
}

/**
 * Near-duplicate detector: Jaccard on word sets for paragraph pairs.
 * Returns offending pairs (indices + similarity).
 */
export function findNearDuplicateParagraphs(paragraphs, threshold = 0.82) {
  const offenders = [];
  const sets = paragraphs.map(
    (p) =>
      new Set(
        (p.toLowerCase().match(/[a-za-z0-9][a-za-z0-9'-]*/g) || []).filter(
          (w) => w.length > 3,
        ),
      ),
  );
  for (let i = 0; i < sets.length; i++) {
    for (let j = i + 1; j < sets.length; j++) {
      const a = sets[i];
      const b = sets[j];
      if (a.size < 12 || b.size < 12) continue;
      let inter = 0;
      for (const w of a) if (b.has(w)) inter += 1;
      const union = a.size + b.size - inter;
      const sim = union === 0 ? 0 : inter / union;
      if (sim >= threshold) {
        offenders.push({ i, j, similarity: Number(sim.toFixed(3)) });
      }
    }
  }
  return offenders;
}

/**
 * Strip code fences/inline code and headings for sentence extraction.
 */
export function proseForSentences(body) {
  return String(body)
    .replace(/```[\s\S]*?```/g, "\n")
    .replace(/`[^`]*`/g, " ")
    .replace(/^#+\s.+$/gm, " ")
    .replace(/^>\s?/gm, "")
    .replace(/!\[[^\]]*\]\([^)]+\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/^\s*[-*]\s+/gm, "")
    .replace(/^\s*\d+\.\s+/gm, "")
    .replace(/\*\*/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Extract normalized sentences with ≥ minWords words.
 * Returns { raw, key, wordCount }[].
 */
export function extractLongSentences(body, minWords = MIN_SENTENCE_WORDS) {
  const prose = proseForSentences(body);
  if (!prose) return [];
  const chunks = prose
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  const out = [];
  for (const raw of chunks) {
    const words = raw.match(/[A-Za-z0-9][A-Za-z0-9'-]*/g) || [];
    if (words.length < minWords) continue;
    const key = words.join(" ").toLowerCase();
    out.push({ raw, key, wordCount: words.length });
  }
  return out;
}

/**
 * In-page duplicate: same 8+ word sentence appears twice.
 */
export function findDuplicateSentencesInPage(body, minWords = MIN_SENTENCE_WORDS) {
  const sentences = extractLongSentences(body, minWords);
  const seen = new Map();
  const dups = [];
  for (const s of sentences) {
    if (seen.has(s.key)) {
      dups.push({ sentence: s.raw, key: s.key, wordCount: s.wordCount });
    } else {
      seen.set(s.key, s);
    }
  }
  return dups;
}

/**
 * Cross-idea: sentences shared with other bodies (map of slug → body).
 * Returns { otherSlug, sentence, key }[].
 */
export function findCrossIdeaSentenceDupes(
  slug,
  body,
  otherBodies,
  minWords = MIN_SENTENCE_WORDS,
) {
  const mine = new Set(extractLongSentences(body, minWords).map((s) => s.key));
  const hits = [];
  const reported = new Set();
  for (const [otherSlug, otherBody] of Object.entries(otherBodies)) {
    if (otherSlug === slug) continue;
    for (const s of extractLongSentences(otherBody, minWords)) {
      if (!mine.has(s.key)) continue;
      const reportKey = `${otherSlug}::${s.key}`;
      if (reported.has(reportKey)) continue;
      reported.add(reportKey);
      hits.push({
        otherSlug,
        sentence: s.raw,
        key: s.key,
        wordCount: s.wordCount,
      });
    }
  }
  return hits;
}

export function findFillerHits(proseLower) {
  const hits = [];
  for (const phrase of FILLER_DENYLIST) {
    if (proseLower.includes(phrase.toLowerCase())) hits.push(phrase);
  }
  return hits;
}

export function findMegaTamHits(prose) {
  const hits = [];
  for (const re of MEGA_TAM_DENYLIST) {
    const m = prose.match(re);
    if (m) hits.push(m[0]);
  }
  return hits;
}

/**
 * Hygiene: double periods; all-lowercase audience dumps (Round 3 wants
 * proper casing — "smb saas" fails, "SMB SaaS" passes).
 */
export function findHygieneIssues(prose) {
  const issues = [];
  if (/\.\./.test(prose.replace(/\.\.\./g, ""))) {
    issues.push("double periods ('..') in prose");
  }
  // All-lowercase multi-token audience / segment labels
  const lowerAudience = [
    /\bsmb saas\b/i,
    /\bb2b saas\b/i,
    /\bmid market\b/i,
    /\benterprise saas\b/i,
  ];
  for (const re of lowerAudience) {
    const m = prose.match(re);
    if (m && m[0] === m[0].toLowerCase()) {
      issues.push(
        `lowercased audience segment "${m[0]}" — use proper casing (e.g. SMB SaaS)`,
      );
    }
  }
  return issues;
}

/**
 * How-it-works steps must be named products of the workflow, not "Step 1".
 * Expect: `1. **Title** — description`
 */
export function auditHowItWorksNaming(solutionContent) {
  const errors = [];
  const steps = [
    ...solutionContent.matchAll(/^\s*(\d+)\.\s+\*\*([^*]+)\*\*\s+[—-]\s+(.+)$/gm),
  ];
  if (steps.length === 0) {
    // Fallback: numbered lines without bold titles
    const numbered = solutionContent.match(/^\s*\d+\.\s+\S/gm) || [];
    if (numbered.length > 0) {
      errors.push(
        "How-it-works steps must use named titles: `1. **Title** — description` (not bare numbered lines)",
      );
    }
    return errors;
  }
  for (const m of steps) {
    const title = m[2].trim();
    if (/^step\s*\d+$/i.test(title)) {
      errors.push(`How-it-works step titled '${title}' — use a named action, not Step N`);
    }
  }
  return errors;
}

/**
 * Setup prompt plan check + Business Model tier names must agree
 * (Starter/Team/Scale vs starter/pro/team).
 */
export function findTierMismatches(businessContent, promptsContent) {
  const errors = [];
  const tierNames = [
    ...businessContent.matchAll(/^\s*[-*]\s+\*\*([^*]+)\*\*/gm),
  ].map((m) => m[1].trim());
  if (tierNames.length < 2) return errors;

  const setupBlock = promptsContent.match(
    /\*\*1\.\s*Project Setup\*\*[\s\S]*?```text\n([\s\S]*?)```/,
  );
  if (!setupBlock) return errors;
  const setup = setupBlock[1];

  for (const name of tierNames) {
    const key = name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_|_$/g, "");
    if (!setup.toLowerCase().includes(name.toLowerCase()) &&
        !setup.includes(`'${key}'`) &&
        !setup.includes(`"${key}"`)) {
      errors.push(
        `Business Model tier "${name}" missing from Project Setup prompt (tiers must match)`,
      );
    }
  }

  // Flag classic contradiction: Business Model uses Starter/Team/Scale but
  // setup still mentions starter/pro/team as a different set.
  const bmHasCanonical = tierNames.some((t) =>
    /^(starter|team|scale)$/i.test(t.trim()),
  );
  if (bmHasCanonical && /\bpro\b/i.test(setup) && !tierNames.some((t) => /^pro$/i.test(t.trim()))) {
    errors.push(
      "Project Setup mentions 'pro' but Business Model tiers do not — one canonical tier set",
    );
  }
  return errors;
}

export function isCompetitorRoundupUrl(url) {
  try {
    const u = new URL(url);
    const hay = `${u.hostname}${u.pathname}${u.search}`;
    if (COMPETITOR_ROUNDUP_URL_RE.test(hay)) return true;
    if (COMPETITOR_ROUNDUP_HOST_PATH_RE.test(u.pathname)) return true;
    // Common listicle paths
    if (/\/(blog|blogs|articles?|pulse)\//i.test(u.pathname) &&
        /(best|vs|compar|alternativ|top-?\d)/i.test(u.pathname + u.search)) {
      return true;
    }
    return false;
  } catch {
    return true;
  }
}

/**
 * Extract competitor markdown bullets' links from Competitive Landscape.
 */
export function extractCompetitorLinks(competitiveContent) {
  const links = [];
  const lines = competitiveContent.split("\n");
  for (const line of lines) {
    if (!/^\s*[-*]\s+\*\*/.test(line)) continue;
    for (const m of line.matchAll(/\[[^\]]*\]\((https?:\/\/[^)\s]+)\)/g)) {
      links.push(m[1]);
    }
  }
  return links;
}

/**
 * Extract blockquote bodies from MDX.
 */
export function extractBlockquotes(body) {
  const quotes = [];
  for (const m of body.matchAll(/^>\s*"?([^"\n]+)"?/gm)) {
    const q = m[1].replace(/\s*—\s*.*$/, "").trim();
    if (q.length >= 12) quotes.push(q);
  }
  return quotes;
}
