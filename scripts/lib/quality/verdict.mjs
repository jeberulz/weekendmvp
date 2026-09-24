/**
 * Layer 0 verdict for one idea page.
 *
 * Runs every deterministic check and turns the metrics into findings:
 *   fail - blocks a new or edited page in CI
 *   warn - flags the page for review in the backlog report
 * Thresholds come from evals/config.json.
 */

import { auditIdeaSource } from "../../audit-idea-mdx.mjs";
import { SOURCES_TITLE } from "../idea-sections.mjs";
import { checkDuplication } from "./dupes.mjs";
import { checkIntegrity } from "./integrity.mjs";
import { checkSlop, countFiller } from "./lexicon.mjs";
import { checkNumbers } from "./numbers.mjs";
import { parseIdea, toProse } from "./parse.mjs";
import { checkSources } from "./sources.mjs";
import { checkVerbosity } from "./verbosity.mjs";

const pct = (share) => `${Math.round(share * 100)}%`;
const quote = (text) => `"${text}"`;

/**
 * Evaluate one page.
 *
 * @param {object} args
 * @param {string} args.slug
 * @param {string} args.raw          MDX source
 * @param {object} args.config       evals/config.json
 * @param {object} args.lexicon      evals/slop-lexicon.json
 * @param {object} [args.dupIndex]   from buildShingleIndex over the corpus
 * @param {object} [args.page]       pre-parsed page (skips re-parsing)
 */
export function evaluateIdea({ slug, raw, config, lexicon, dupIndex, page }) {
  const fails = [];
  const warns = [];
  const fail = (check, message) => fails.push({ check, message });
  const warn = (check, message) => warns.push({ check, message });

  const parsed =
    page ?? parseIdea(raw, slug, { excludeSections: config.excludeFromProseSections });

  // Structure: the existing eight-heading contract.
  const structure = auditIdeaSource(raw, slug);
  for (const error of structure.errors) fail("structure", error);

  // Slop.
  const slop = checkSlop(parsed.prose, parsed.wordCount, lexicon);
  for (const hit of slop.banned) {
    fail(
      "slop.banned",
      `banned phrase "${hit.phrase}" x${hit.count}: ${quote(hit.example)}`,
    );
  }
  const topWatch = slop.watch
    .slice()
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)
    .map((h) => `${h.phrase} x${h.count}`)
    .join(", ");
  if (slop.watchPer1k > config.slop.watchPer1kFail) {
    fail(
      "slop.density",
      `${slop.watchPer1k} stock AI words per 1k words (fail > ${config.slop.watchPer1kFail}): ${topWatch}`,
    );
  } else if (slop.watchPer1k > config.slop.watchPer1kWarn) {
    warn(
      "slop.density",
      `${slop.watchPer1k} stock AI words per 1k words (warn > ${config.slop.watchPer1kWarn}): ${topWatch}`,
    );
  }

  // Verbosity.
  const v = config.verbosity;
  const verbosity = checkVerbosity(
    parsed.prose,
    parsed.wordCount,
    countFiller(parsed.prose, lexicon),
    v,
  );
  if (verbosity.avgSentenceWords > v.avgSentenceWordsFail) {
    fail(
      "verbosity.sentenceLength",
      `average sentence is ${verbosity.avgSentenceWords} words (fail > ${v.avgSentenceWordsFail})`,
    );
  } else if (verbosity.avgSentenceWords > v.avgSentenceWordsWarn) {
    warn(
      "verbosity.sentenceLength",
      `average sentence is ${verbosity.avgSentenceWords} words (warn > ${v.avgSentenceWordsWarn})`,
    );
  }
  const longMsg = `${pct(verbosity.longSentenceShare)} of sentences run over ${v.longSentenceWords} words; longest is ${verbosity.longest.words}: ${quote(verbosity.longest.text.slice(0, 120))}`;
  if (verbosity.longSentenceShare > v.longSentenceShareFail) {
    fail("verbosity.longSentences", `${longMsg} (fail > ${pct(v.longSentenceShareFail)})`);
  } else if (verbosity.longSentenceShare > v.longSentenceShareWarn) {
    warn("verbosity.longSentences", `${longMsg} (warn > ${pct(v.longSentenceShareWarn)})`);
  }
  if (verbosity.fillerPer1k > v.fillerPer1kWarn) {
    warn(
      "verbosity.filler",
      `${verbosity.fillerPer1k} filler words per 1k words (warn > ${v.fillerPer1kWarn})`,
    );
  }
  if (verbosity.repeated.length >= v.repeatedSentencesWarn) {
    warn(
      "verbosity.repeated",
      `${verbosity.repeated.length} sentences appear more than once, e.g. ${quote(verbosity.repeated[0].text.slice(0, 120))}`,
    );
  }
  if (parsed.wordCount > v.wordCountWarn) {
    warn(
      "verbosity.wordCount",
      `${parsed.wordCount} words of prose (warn > ${v.wordCountWarn}); cut before adding`,
    );
  }

  // Numbers.
  const n = config.numbers;
  const numbers = checkNumbers(parsed.sections, {
    factualSections: config.factualSections,
    sourcesTitle: SOURCES_TITLE,
  });
  if (
    numbers.unsourced >= n.unsourcedWarn ||
    (numbers.claims > 0 && numbers.unsourcedShare > n.unsourcedShareWarn)
  ) {
    const example = numbers.unsourcedExamples[0];
    warn(
      "numbers.unsourced",
      `${numbers.unsourced} of ${numbers.claims} numbers in ${config.factualSections.join("/")} have no inline link or named source` +
        (example ? `, e.g. (${example.section}) ${quote(example.text)}` : ""),
    );
  }
  if (numbers.hedged.length >= n.hedgedWarn) {
    const h = numbers.hedged[0];
    warn(
      "numbers.hedged",
      `${numbers.hedged.length} numeric passages are marked as guesses ("${h.marker}"): ${quote(h.text)}. Source them or cut them`,
    );
  }

  // Sources.
  const sourcesSection = parsed.sections.find((s) => s.title === SOURCES_TITLE);
  let sources = null;
  if (sourcesSection) {
    const sc = config.sources;
    sources = checkSources(sourcesSection.content, sc);
    if (sources.linkCount > 0 && sources.distinctDomains < sc.minDistinctDomains) {
      fail(
        "sources.domains",
        `sources come from ${sources.distinctDomains} domain(s) (need ≥ ${sc.minDistinctDomains})`,
      );
    }
    for (const href of sources.placeholder) {
      fail("sources.placeholder", `placeholder source URL: ${href}`);
    }
    for (const href of sources.invalid) {
      fail("sources.invalid", `source link is not a valid http(s) URL: ${href}`);
    }
    if (sources.duplicates.length > 0) {
      warn("sources.duplicates", `duplicate source URLs: ${sources.duplicates.join(", ")}`);
    }
    if (sources.homepageOnlyShare > sc.homepageOnlyShareWarn) {
      warn(
        "sources.homepageOnly",
        `${pct(sources.homepageOnlyShare)} of sources are bare homepages, which cannot back a specific number`,
      );
    }
    if (sources.ideabrowserShare > sc.ideabrowserShareWarn) {
      warn(
        "sources.ideabrowser",
        `${pct(sources.ideabrowserShare)} of sources point at Ideabrowser, not the primary source`,
      );
    }
  }

  // Integrity: whole body, code removed.
  const integrity = checkIntegrity(toProse(parsed.body));
  for (const hit of integrity.placeholders) {
    fail("integrity.placeholder", `leftover placeholder "${hit.match}": ${quote(hit.text)}`);
  }
  for (const hit of integrity.leaks) {
    fail("integrity.leak", `model chatter left in the page "${hit.match}": ${quote(hit.text)}`);
  }

  // Cross-page duplication.
  let duplication = null;
  if (dupIndex) {
    const d = config.duplication;
    duplication = checkDuplication(slug, dupIndex);
    const msg = `${pct(duplication.maxPairShare)} of this page's ${d.shingleWords}-word phrases also appear in ${duplication.maxPairSlug}`;
    if (duplication.maxPairShare > d.pairShareFail) {
      fail("duplication", `${msg} (fail > ${pct(d.pairShareFail)})`);
    } else if (duplication.maxPairShare > d.pairShareWarn) {
      warn("duplication", `${msg} (warn > ${pct(d.pairShareWarn)})`);
    }
  }

  const status = fails.length > 0 ? "fail" : warns.length > 0 ? "warn" : "pass";
  return {
    slug,
    status,
    fails,
    warns,
    metrics: {
      wordCount: parsed.wordCount,
      structure: structure.metrics,
      slop: { banned: slop.banned.length, watchPer1k: slop.watchPer1k },
      verbosity: {
        avgSentenceWords: verbosity.avgSentenceWords,
        longSentenceShare: verbosity.longSentenceShare,
        fillerPer1k: verbosity.fillerPer1k,
        repeated: verbosity.repeated.length,
      },
      numbers: {
        claims: numbers.claims,
        linked: numbers.linked,
        named: numbers.named,
        listed: numbers.listed,
        unsourced: numbers.unsourced,
        unsourcedShare: numbers.unsourcedShare,
        hedged: numbers.hedged.length,
      },
      sources: sources && {
        links: sources.linkCount,
        distinctDomains: sources.distinctDomains,
        homepageOnlyShare: sources.homepageOnlyShare,
        ideabrowserShare: sources.ideabrowserShare,
      },
      duplication,
    },
  };
}
