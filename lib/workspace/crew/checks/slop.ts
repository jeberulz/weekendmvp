/**
 * WP75-S4a: the copy-slop lexicon (07 §2B, "Copy" row of the slop table).
 *
 * Banned phrases, triads, "not just X but Y" and em-dash stacks, found in any
 * copy string. Brand voice's "don't say" example is not walked (it is bad copy
 * on purpose), nor are enum-like fields.
 *
 * Hard: phrases no founder would say out loud ("unlock the power of",
 * "revolutionize", "game-changer"). Soft: weaker words that are sometimes
 * right ("seamless", "robust"), a three-word triad used as a whole line, an
 * "it's not X, it's Y" frame, and two or more em dashes in one string.
 *
 * No false positive on ordinary product copy: matching is whole-word and
 * the triad rule only fires on a short line made of three single words.
 */
import { issue, snippet, type CheckIssue } from "./types";
import { isCopyPath, stringLeaves } from "./walk";

type Phrase = { readonly code: string; readonly severity: "hard" | "soft"; readonly re: RegExp };

const HARD_PHRASES: readonly RegExp[] = [
  /\bunlock(?:s|ing)?\s+(?:the\s+power|your\s+(?:full\s+)?potential|a\s+new\s+level)\b/iu,
  /\bunleash(?:es|ed|ing)?\b/iu,
  /\brevolutioni[sz](?:e|es|ed|ing)\b/iu,
  /\bgame[\s-]?chang(?:er|ers|ing)\b/iu,
  /\btake\s+(?:your\s+)?[\p{L}\s]{1,30}?\s+to\s+the\s+next\s+level\b/iu,
  /\bnext[\s-]level\b/iu,
  /\bsupercharg(?:e|es|ed|ing)\b/iu,
  /\bharness(?:es|ed|ing)?\s+the\s+power\b/iu,
  /\bin\s+today['’]s\s+(?:fast[\s-]paced|digital|modern)\s+(?:world|age|landscape)\b/iu,
  /\bever[\s-]evolving\b/iu,
  /\bdigital\s+landscape\b/iu,
  /\b(?:delve|delves|delving)\b/iu,
  /\btapestry\b/iu,
  /\bsay\s+goodbye\s+to\b/iu,
  /\blook\s+no\s+further\b/iu,
  /\bone[\s-]stop[\s-]shop\b/iu,
  /\bcutting[\s-]edge\b/iu,
  /\bstate[\s-]of[\s-]the[\s-]art\b/iu,
  /\bbest[\s-]in[\s-]class\b/iu,
  /\bwelcome\s+to\s+the\s+future\b/iu,
  /\bwhether\s+you['’]re\s+an?\s+[\p{L}\s-]{1,30}?\s+or\s+an?\s+[\p{L}\s-]{1,30}?[,.]/iu,
];

const SOFT_PHRASES: readonly RegExp[] = [
  /\bseamless(?:ly)?\b/iu,
  /\brobust\b/iu,
  /\bleverag(?:e|es|ed|ing)\b/iu,
  /\bempower(?:s|ed|ing)?\b/iu,
  /\bstreamlin(?:e|es|ed|ing)\s+your\b/iu,
  /\belevat(?:e|es|ed|ing)\s+your\b/iu,
  /\bworld[\s-]class\b/iu,
  /\bholistic\b/iu,
  /\bsynerg(?:y|ies)\b/iu,
  /\btransformative\b/iu,
  /\bre[\s-]?imagin(?:e|es|ed|ing)\b/iu,
  /\beffortless(?:ly)?\b/iu,
  /\bturn[\s-]?key\b/iu,
  /\bparadigm\b/iu,
  /\bgroundbreaking\b/iu,
  /\bmore\s+than\s+just\b/iu,
  /\bnot\s+(?:just|only|merely)\b[^.!?\n]{1,60}\bbut\b/iu,
  /\bit['’]?s\s+not\s+(?:just\s+)?(?:a|an|about)\b[^.!?\n]{1,50}[,;—–-]\s*it['’]?s\b/iu,
];

const PHRASES: readonly Phrase[] = [
  ...HARD_PHRASES.map((re): Phrase => ({ code: "slop_phrase", severity: "hard", re })),
  ...SOFT_PHRASES.map((re): Phrase => ({ code: "slop_weak_phrase", severity: "soft", re })),
];

const WORD = String.raw`[\p{L}][\p{L}'-]*`;
/** "Fast, simple and secure." or "Fast. Simple. Secure." as a whole short line. */
const TRIADS: readonly RegExp[] = [
  new RegExp(String.raw`^\W*(${WORD}),\s+(${WORD}),?\s+(?:and|&)\s+(${WORD})\W*$`, "u"),
  new RegExp(String.raw`^\W*(${WORD})\.\s+(${WORD})\.\s+(${WORD})\.?\W*$`, "u"),
  new RegExp(String.raw`^\W*(${WORD}),\s+(${WORD}),\s+(${WORD})\W*$`, "u"),
];

const EM_DASH = /—|(?<=\s)--(?=\s)/gu;

/** True when the whole line is a three-word triad. */
export function isTriad(text: string): boolean {
  const line = text.trim();
  if (line.split(/\s+/u).length > 6) return false;
  return TRIADS.some((re) => re.test(line));
}

/** Slop findings for every copy string in an artifact. */
export function checkSlop(artifact: unknown): CheckIssue[] {
  const issues: CheckIssue[] = [];
  for (const { value, path } of stringLeaves(artifact, (p) => !isCopyPath(p))) {
    for (const phrase of PHRASES) {
      const match = phrase.re.exec(value);
      if (match === null) continue;
      issues.push(
        issue(
          phrase.severity,
          phrase.code,
          path,
          phrase.severity === "hard"
            ? `Stock marketing phrase ("${snippet(match[0])}"). Say what the product does in plain words.`
            : `Weak or vague word ("${snippet(match[0])}"). Prefer a concrete, plain one.`,
        ),
      );
    }
    if (isTriad(value)) {
      issues.push(issue("soft", "slop_triad", path, `A three-word triad ("${snippet(value)}") reads as filler. Say one specific thing.`));
    }
    if ((value.match(EM_DASH) ?? []).length >= 2) {
      issues.push(issue("soft", "slop_em_dash_stack", path, "Two or more em dashes in one string. Use full stops or commas."));
    }
  }
  return issues;
}
