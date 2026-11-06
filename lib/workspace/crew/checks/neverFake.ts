/**
 * WP75-S4a: "never fake it" (06-decisions, 07 §4).
 *
 * A founder's page and posts carry no testimonial, rating, user count, logo
 * wall, press mention or statistic the business did not earn. Proof exists
 * only as bracketed placeholders in `proofSlots` (workspace-only, never
 * published in v1). These patterns find invented proof in any string of any
 * artifact. Bracketed placeholders are removed first, and the workspace
 * proof slots, the brand voice's "don't say" example and a build prompt's
 * `Do not build:` line are not walked.
 *
 * Every pattern is hard: the page would claim something untrue. The only
 * soft ones are vague appeals to evidence ("studies show"), which are
 * unverifiable but not a fabricated number.
 *
 * Known trade-offs: "5-star" and "Join 50 hikers" are always flagged, even
 * where a founder might mean them. A founder who has real proof adds it
 * after review; the crew never writes it.
 */
import { issue, snippet, type CheckIssue } from "./types";
import { isCopyPath, stringLeaves, stripPlaceholders } from "./walk";

type Pattern = {
  readonly code: string;
  readonly severity: "hard" | "soft";
  readonly what: string;
  readonly re: RegExp;
};

const NUM = String.raw`\d[\d,.]*\s?(?:k|m|thousand|million)?\+?`;
const BIG = String.raw`(?:\d{1,3}(?:,\d{3})+|\d{3,}|\d+(?:\.\d+)?\s?(?:k|thousand|million))\+?`;
/** Counted people, accounts and activity: what a made-up traction line counts. */
const PEOPLE = String.raw`(?:users?|customers?|clients?|members?|subscribers?|people|persons?|hikers?|runners?|cyclists?|campers|founders?|builders?|makers?|creators?|sellers?|teams?|companies|businesses|brands|agencies|professionals|developers?|designers?|students?|teachers?|parents|families|athletes|travell?ers|others|downloads|installs|sign-?ups|reviews|ratings)`;
const WORDS = String.raw`(?:[\p{L}-]+\s+){0,2}?`;
const PRESS = String.raw`(?:TechCrunch|Forbes|Wired|The Verge|Product Hunt|Hacker News|New York Times|NYT|BBC|CNN|Bloomberg|Wall Street Journal|WSJ|Fast Company|Business Insider|Entrepreneur|Mashable|Vogue|Reuters|The Guardian|Washington Post|Lifehacker|Outside Magazine|Men's Health|GQ)`;
const GROWTH_VERBS = String.raw`(?:by|up to|save|saves|saving|cut|cuts|boost|boosts|improve|improves|improved|reduce|reduces|reduced|increase|increases|increased|grow|grew|lift|lifts|raise|raises|raised)`;

const PATTERNS: readonly Pattern[] = [
  // Testimonials.
  {
    code: "fake_testimonial",
    severity: "hard",
    what: "a quote with an attribution",
    re: /["“][^"“”\n]{12,}["”]\s*(?:[-–—]\s*|,?\s+(?:says|said)\s+)[A-Z][\p{L}.'-]+(?:\s+[A-Z][\p{L}.'-]*)?/u,
  },
  {
    code: "fake_testimonial",
    severity: "hard",
    what: "a signed quote line",
    re: /(?:^|\n)\s*[—–-]\s*[A-Z][\p{L}.'-]+(?:\s+[A-Z][\p{L}.'-]*)?,\s+[\p{L}]/u,
  },
  {
    code: "fake_testimonial",
    severity: "hard",
    what: "customers saying something",
    re: /\bwhat\s+(?:our|my)\s+(?:customers|users|hikers|members|clients|early\s+users|beta\s+users|testers)\s+(?:are\s+saying|say)\b/iu,
  },
  {
    code: "fake_testimonial",
    severity: "hard",
    what: "users quoted as a group",
    re: /\b(?:beta|early|first|real)\s+(?:users|testers|customers)\s+(?:say|said|report|reported|tell\s+us|told\s+us|love|loved)\b/iu,
  },
  {
    code: "fake_testimonial",
    severity: "hard",
    what: "people said to love it",
    re: /\b(?:customers|users|clients|members|people|everyone|hikers|runners)\s+(?:absolutely\s+)?(?:love|rave\s+about|swear\s+by)\s+(?:it|us|our|this)\b/iu,
  },
  {
    code: "fake_testimonial",
    severity: "hard",
    what: "customer stories or reviews",
    re: /\b(?:customer|user|client)\s+(?:stories|testimonials)\b/iu,
  },
  // Ratings and reviews.
  { code: "fake_rating", severity: "hard", what: "star glyphs", re: /[★⭐]/u },
  { code: "fake_rating", severity: "hard", what: "a decimal rating out of 5", re: /\b[1-5]\.\d\s?\/\s?5\b/u },
  { code: "fake_rating", severity: "hard", what: "a rating out of 5", re: /\b[1-5](?:\.\d)?\s*out\s+of\s*5\b/iu },
  {
    code: "fake_rating",
    severity: "hard",
    what: "a score out of 5",
    re: /(?:\b(?:rated?|rating|stars?|reviews?|score)\b\W+(?:\w+\W+){0,3}[1-5]\s?\/\s?5\b|\b[1-5]\s?\/\s?5\s+(?:stars?|rating|reviews?)\b)/iu,
  },
  { code: "fake_rating", severity: "hard", what: "a star rating", re: /\b(?:five|5)[\s-]stars?\b|\b[1-5]\.\d\s?stars?\b/iu },
  {
    code: "fake_review",
    severity: "hard",
    what: "a review count",
    re: /\b\d[\d,.]{1,}\+?\s+(?:[\p{L}-]+\s+)?(?:reviews|ratings|testimonials)\b/iu,
  },
  { code: "fake_review", severity: "hard", what: "reviews nobody wrote", re: /\b(?:rave|glowing|stellar)\s+reviews\b/iu },
  // User and customer counts.
  {
    code: "fake_social_count",
    severity: "hard",
    what: "a count of people who joined or use it",
    re: new RegExp(
      String.raw`\b(?:join(?:ed|ing)?|helped|served|serving|trusted\s+by|used\s+by|loved\s+by|chosen\s+by|adopted\s+by|relied\s+on\s+by)\s+(?:(?:over|more\s+than|nearly|almost|around|about)\s+)?(?:the\s+)?${NUM}\s+${WORDS}${PEOPLE}\b`,
      "iu",
    ),
  },
  {
    code: "fake_social_count",
    severity: "hard",
    what: "a large count of people",
    re: new RegExp(String.raw`\b(?:over|more\s+than|nearly|almost|around)\s+${BIG}\s+${WORDS}${PEOPLE}\b`, "iu"),
  },
  {
    code: "fake_social_count",
    severity: "hard",
    what: "a large count of people using it",
    re: new RegExp(
      String.raw`(?<![\p{L}\p{N}.,])${BIG}\s+${WORDS}${PEOPLE}\s+(?:already\s+)?(?:use|trust|love|rely|joined|signed|choose|chose|are|were|have)\b`,
      "iu",
    ),
  },
  {
    code: "fake_social_count",
    severity: "hard",
    what: "thousands or millions of people",
    re: new RegExp(String.raw`\b(?:thousands|hundreds|millions|tens\s+of\s+thousands|dozens)\s+of\s+${WORDS}${PEOPLE}\b`, "iu"),
  },
  // "Trusted by" and logo walls.
  { code: "fake_trusted_by", severity: "hard", what: "\"trusted by\"", re: /\btrusted\s+by\b/iu },
  {
    code: "fake_trusted_by",
    severity: "hard",
    what: "endorsement by a group",
    re: /\b(?:loved|relied\s+on|chosen|adopted|endorsed|recommended|used|backed)\s+by\s+(?:(?:over|more\s+than|nearly)\s+)?(?:\d|thousands|hundreds|millions|leading|top|the\s+world|teams|companies|brands|professionals|experts|doctors|dietitians|coaches|trainers|pros)\b/iu,
  },
  {
    code: "fake_logo_wall",
    severity: "hard",
    what: "people at named companies",
    re: /\b(?:[Tt]eams?|[Ee]ngineers|[Dd]evelopers|[Dd]esigners|[Mm]arketers|[Ee]mployees|[Ss]taff)\s+(?:at|from)\s+[A-Z][\p{L}0-9&.]+/u,
  },
  {
    code: "fake_logo_wall",
    severity: "hard",
    what: "named companies as endorsement",
    re: /\b(?:[Cc]ompanies|[Tt]eams|[Ss]tartups|[Oo]rgani[sz]ations)\s+(?:like|such\s+as)\s+[A-Z][\p{L}0-9&.]+/u,
  },
  { code: "fake_logo_wall", severity: "hard", what: "a partner or customer logo wall", re: /\b(?:our|key)\s+(?:partners|customers|clients)\b|\bpartners\s+include\b/iu },
  // Press.
  { code: "fake_press", severity: "hard", what: "\"as seen in\"", re: /\bas\s+(?:seen|featured)\s+(?:in|on)\b/iu },
  { code: "fake_press", severity: "hard", what: "\"featured in\" a publication", re: /\b[Ff]eatured\s+(?:in|on|by)\s+(?:the\s+)?[A-Z]/u },
  {
    code: "fake_press",
    severity: "hard",
    what: "coverage by a named outlet",
    re: new RegExp(String.raw`\b(?:seen|covered|mentioned|reviewed|praised|recommended|written\s+up|spotlighted|profiled)\s+(?:in|on|by)\s+(?:the\s+)?${PRESS}\b`, "iu"),
  },
  { code: "fake_press", severity: "hard", what: "a named outlet quoted", re: new RegExp(String.raw`\b${PRESS}\s+(?:says|said|calls|called|named|names|praised|rated|raves)\b`, "u") },
  // Invented credentials.
  { code: "fake_credential", severity: "hard", what: "an award", re: /\baward[\s-]winning\b/iu },
  { code: "fake_credential", severity: "hard", what: "a ranking", re: /\b(?:rated\s+(?:#|No\.\s?)1|(?:#|No\.\s?)1\s+(?:rated|app|tool|choice|platform|trusted)|best[\s-]selling|(?:top|highest)[\s-]rated)\b/iu },
  { code: "fake_credential", severity: "hard", what: "a proof claim", re: /\b(?:clinically|scientifically|medically)\s+proven\b|\bdoctor[\s-]recommended\b/iu },
  // Invented statistics.
  {
    code: "fake_stat",
    severity: "hard",
    what: "a percentage outcome",
    re: /\b\d+(?:\.\d+)?\s?%\s+(?:of\s+\w+|more|less|fewer|faster|slower|better|higher|lower|cheaper|quicker|increase|decrease|reduction|improvement|growth|drop|boost|savings?)\b/iu,
  },
  {
    code: "fake_stat",
    severity: "hard",
    what: "a percentage change",
    re: new RegExp(String.raw`\b${GROWTH_VERBS}\s+(?:(?:up\s+to|over|more\s+than|nearly|almost|about|around)\s+)?\d+(?:\.\d+)?\s?%`, "iu"),
  },
  { code: "fake_stat", severity: "hard", what: "a multiplier outcome", re: /\b\d+(?:\.\d+)?x\s+(?:faster|more|better|quicker|higher|cheaper|as|the)\b/iu },
  {
    code: "fake_stat",
    severity: "hard",
    what: "a ratio of people",
    re: new RegExp(String.raw`\b\d+\s+(?:out\s+of|in)\s+\d+\s+${WORDS}${PEOPLE}\b`, "iu"),
  },
  {
    code: "unsupported_evidence",
    severity: "soft",
    what: "an appeal to studies with no source",
    re: /\b(?:studies|research|surveys?|scientists|experts)\s+(?:shows?|found|prove|proves|confirm|confirms|suggests?|say)\b|\baccording\s+to\s+(?:a\s+|recent\s+|one\s+)?(?:study|survey|research|report)\b/iu,
  },
];

/** Run every pattern over one string (placeholders already removed). */
export function neverFakeMatches(text: string): { code: string; severity: "hard" | "soft"; what: string; match: string }[] {
  const found: { code: string; severity: "hard" | "soft"; what: string; match: string }[] = [];
  for (const pattern of PATTERNS) {
    const match = pattern.re.exec(text);
    if (match !== null) found.push({ code: pattern.code, severity: pattern.severity, what: pattern.what, match: match[0] });
  }
  return found;
}

/**
 * Findings for every copy string in an artifact (the proof slots, the voice
 * counter-example, `Do not build:` lines and enum-like fields are left out).
 */
export function checkNeverFake(artifact: unknown): CheckIssue[] {
  const issues: CheckIssue[] = [];
  for (const { value, path } of stringLeaves(artifact, (p) => !isCopyPath(p))) {
    for (const hit of neverFakeMatches(stripPlaceholders(value))) {
      issues.push(
        issue(
          hit.severity,
          hit.code,
          path,
          hit.severity === "hard"
            ? `Reads as ${hit.what} ("${snippet(hit.match)}"). Proof is never invented: remove it or say what the product does.`
            : `Appeals to evidence without a source ("${snippet(hit.match)}"). Say what the product does instead.`,
        ),
      );
    }
  }
  return issues;
}
