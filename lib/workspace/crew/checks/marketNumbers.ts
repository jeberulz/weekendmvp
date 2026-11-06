/**
 * WP75-S4a: market numbers in own ideas (D15).
 *
 * D15: an own idea has no validated market, so its artifacts carry no market
 * numbers, competitor prices or keyword data. Ruling (WP75-S4a review,
 * recorded in `docs/wp/wp75-progress.md`): D15 does not ban the founder's own
 * price or product facts. So this check does not flag the business's own
 * price ("$79 pre-order", "$29/month"), product facts ("100% recycled
 * nylon"), promotions ("20% off the launch price", "free shipping over $50")
 * or waitlist caps ("join the first 100 hikers"). It flags:
 *
 * - market sizing and keyword data in any form (TAM/SAM/SOM, CAGR, CPC,
 *   market size or share, search volume, monthly searches);
 * - market-size magnitudes ("$4B", "40M campers", "billions", "millions of");
 * - revenue metrics (MRR, ARR, GMV with a number);
 * - growth rates ("growing 12% a year", "20% YoY");
 * - shares and ratios of a population ("30% of hikers", "1 in 5 hikers");
 * - counts of people who need it ("10k dentists need this");
 * - spending data ("hikers spend $49 a year");
 * - competitor prices ("competitors charge $50", "vs $150 for a Camelbak",
 *   "30% cheaper than rivals"; a named business's price only with an explicit
 *   contrast with ours: "Camelbak sells it for $120; ours is $79");
 * - any number the WP74 detector (`hasMarketClaim`) sees in a sentence that
 *   is about an industry, a survey, research or "the average hiker" (always,
 *   even "According to our survey"), or about rivals, the market or an
 *   average when the money is not the business's own ("On average our loaves
 *   cost £4" and "Our average order is $25" stay). "Study guide", "reported
 *   issues" and "at the market" are not market context.
 *
 * Fake proof (user counts, ratings, outcome statistics) is "never fake it"'s
 * job, not this check's; both run on own ideas.
 */
import { hasMarketClaim } from "../../wizard/light-blueprint";
import { issue, snippet, type CheckIssue } from "./types";
import { isCopyPath, matchableText, stringLeaves } from "./walk";

/** Artifact kinds an own idea may not put a market number into (the build pack is instructions, the roster has no copy). */
export const MARKET_CHECKED_KINDS = [
  "blueprint",
  "brand_kit",
  "landing_spec",
  "email_sequence",
  "social_pack",
  "seo_pack",
  "launch_plan",
  "ads_drafts",
] as const;

/** A number start that is not inside a word or another number. */
const D = String.raw`(?<![\p{L}\p{N}.,])`;
const N = String.raw`${D}\d[\d,.]*`;
const NOT_YEAR = String.raw`(?!(?:19|20)\d{2}(?![\d,.]))`;
const MONEY = String.raw`(?:[$€£¥₹]\s?\d[\d,.]*|${N}\s?(?:[$€£¥₹]|usd|eur|gbp|dollars?|euros?|pounds?)(?![\p{L}]))`;
const PCT = String.raw`${N}\s?(?:%|percent\b|per\s?cent\b)`;
const NUMBER_WORD = String.raw`(?:\d+|one|two|three|four|five|six|seven|eight|nine|ten)`;
const TIME_UNITS = String.raw`(?:seconds?|minutes?|mins?|hours?|days?|weeks?|months?|years?|steps?|stages?|levels?|tries)`;
const RIVALS = String.raw`(?:competitors?|competition|rivals?|incumbents?|alternatives?|other\s+(?:brands|apps|tools|packs|products|services|companies|courses|bakeries|shops|options|plans|platforms))`;

export type MarketOptions = {
  /** The business's own name: "{brandName} costs $79" is its own price, not a competitor's. */
  readonly brandName?: string;
};

type Rule = {
  readonly what: string;
  readonly re: RegExp;
  /** Keeps a match only when this holds (the whole text and the options are given). */
  readonly accept?: (match: RegExpMatchArray, text: string, options: MarketOptions) => boolean;
};

const nameKey = (name: string): string => name.normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
/** An explicit contrast with the business's own side: "ours is $79", "We charge $79", "our price", "vs", "cheaper than". */
const OWN_CONTRAST =
  /\bours\b|\bwe\s+(?:charge|sell|ask|price)\b|\bour\s+(?:price|prices|pricing|version)\b|\bvs\.?(?![\p{L}])|\bversus\b|\b(?:cheaper|less|lower|pricier)\s+than\b|\bfor\s+less\b|\bhalf\s+the\s+price\b/iu;
/** Words that start a sentence or name a plan or fee, not a rival business (either case). */
const NOT_A_RIVAL_WORDS = [
  "It", "This", "That", "These", "Those", "Ours", "Each", "Every", "One", "Our", "Your", "The", "A", "An", "So", "And", "But",
  "Shipping", "Delivery", "Postage", "Entry", "Admission", "Access", "Membership", "Everything", "Pricing", "Plan", "Plans",
  "Ticket", "Tickets", "Class", "Classes", "Lesson", "Lessons", "Pro", "Plus", "Basic", "Premium", "Team", "Starter",
  "Standard", "Family", "Annual", "Monthly", "London",
];
const NOT_A_RIVAL = `(?:${NOT_A_RIVAL_WORDS.flatMap((word) => [word, word.toLowerCase()]).join("|")})`;
/** The sentence a match sits in, and the next one ("Osprey charges $150. We charge $79."). */
function sentenceAndNext(text: string, index: number): string {
  const before = /[^.!?\n]*$/u.exec(text.slice(0, index))?.[0] ?? "";
  const after = /^[^.!?\n]*[.!?\n]*[^.!?\n]*/u.exec(text.slice(index))?.[0] ?? "";
  return before + after;
}

const RULES: readonly Rule[] = [
  { what: "a market-sizing term", re: /\b(?:TAM|SAM|SOM|CAGR|CPC|CPM)\b/u },
  {
    what: "market or keyword data",
    re: /\b(?:market\s+(?:size|share|cap|value|worth)|total\s+addressable|addressable\s+market|search\s+volumes?|keyword\s+(?:volume|difficulty|data)|monthly\s+searches|searches\s+(?:a|per)\s+month|cost\s+per\s+(?:click|acquisition))\b/iu,
  },
  {
    what: "a market-size magnitude",
    re: new RegExp(
      String.raw`(?<![\p{L}])(?:[Bb]illions?|[Tt]rillions?)(?![\p{L}])|(?<![\p{L}])[Mm]illions\s+of\s+\p{L}|${N}\s?(?:B|[Bb]n|[Tt]n|M|[Mm]n)(?![\p{L}\p{N}])|[$€£¥₹]\s?\d[\d,.]*\s?(?:m|mm|M|B|[Bb]n|[Tt]n)(?![\p{L}\p{N}])`,
      "u",
    ),
  },
  {
    what: "a revenue metric",
    re: new RegExp(String.raw`${N}\s?(?:k|m|b|bn)?\s+(?:MRR|ARR|GMV)\b|\b(?:MRR|ARR|GMV)\s+(?:of\s+|at\s+|is\s+|hit\s+)?[$€£]?\s?\d`, "u"),
  },
  {
    what: "a growth rate",
    re: new RegExp(
      String.raw`${PCT}\s+(?:annual\s+|yearly\s+)?(?:growth|CAGR|YoY|year[\s-]over[\s-]year)\b|\b(?:grow(?:s|ing)?|grew|expand(?:s|ing|ed)?|ris(?:es|ing)|rose)\s+(?:by\s+|at\s+)?(?:over\s+|about\s+|around\s+|nearly\s+|almost\s+)?${PCT}`,
      "iu",
    ),
  },
  {
    what: "a share of a population",
    // "100% of profits go to charity" and "10% of every order" are pledges.
    re: new RegExp(
      String.raw`${PCT}\s+of\s+(?!(?:all\s+|the\s+|our\s+|your\s+|its\s+|their\s+|every\s+|each\s+)?(?:profits?|proceeds|revenue|takings|sales|fees?|donations?|tips|orders?|purchases?|price|cost|money|it|them|this|that)\b)(?:the\s+)?\p{L}`,
      "iu",
    ),
  },
  {
    what: "a ratio of people",
    re: new RegExp(String.raw`\b${NUMBER_WORD}\s+(?:in|out\s+of)\s+(?:${NUMBER_WORD}|a\s+hundred)\s+(?!${TIME_UNITS}\b)\p{L}`, "iu"),
  },
  {
    what: "a count of people who need it",
    re: new RegExp(
      String.raw`${D}${NOT_YEAR}(?:\d{1,3}(?:,\d{3})+|\d{4,}|\d+(?:\.\d+)?\s?(?:k|thousand|million))\+?\s+(?:[\p{L}-]+\s+){0,2}?(?:need|needs|want|wants|struggle|struggles|suffer|suffers|face|faces|lack|lacks|search|searches|look|looks)\b`,
      "iu",
    ),
  },
  {
    what: "spending data",
    re: new RegExp(
      String.raw`\b(?:spend|spends|spent|lose|loses|lost|waste|wastes|wasted)\s+(?:(?:an?\s+)?average\s+of\s+|on\s+average\s+|over\s+|about\s+|around\s+|up\s+to\s+|nearly\s+|almost\s+|roughly\s+)?(?:${MONEY}|${PCT})`,
      "iu",
    ),
  },
  {
    what: "a competitor price",
    re: new RegExp(
      String.raw`\b${RIVALS}\s+(?:[\p{L}'-]+\s+){0,4}?(?:charge|charges|cost|costs|price|priced|sell|sells|start|starts|run|runs|ask|asks)\b[^.!?\n]{0,25}?${MONEY}|\b(?:vs\.?|versus|compared\s+(?:to|with)|cheaper\s+than|pricier\s+than|more\s+expensive\s+than|half\s+the\s+price\s+of)\s+[^.!?\n]{0,40}?${MONEY}|${PCT}\s+(?:cheaper|less|lower|more\s+affordable)\s+than\s+${RIVALS}`,
      "iu",
    ),
  },
  {
    what: "a competitor price",
    // "30% less than Camelbak": a named rival (case-sensitive capital).
    re: new RegExp(String.raw`${PCT}\s+(?:cheaper|less|lower|more\s+affordable)\s+than\s+[A-Z]`, "u"),
  },
  {
    what: "a competitor price",
    // "Camelbak sells it for $120; ours is $79", "Osprey charges $150. We charge $79.": a named business's
    // price, hard only with an explicit contrast with our side in the same or the next sentence, and never
    // the business's own name. "Trail Pack costs $79 and we ship it free" (a product name) stays clean.
    re: new RegExp(
      String.raw`(?<![\p{L}\p{N}])(?<!\b(?:our|Our|this|This|my|My|your|Your)\s)(?!${NOT_A_RIVAL}\b)([\p{L}][\p{L}\p{N}&'’-]+(?:[^\S\n]+[\p{Lu}][\p{L}\p{N}&'’-]+){0,2})\s+(?:sells|charges|costs|prices|retails|asks)\b[^.!?\n;]{0,30}?${MONEY}`,
      "u",
    ),
    accept: (match, text, options) => {
      const index = match.index ?? 0;
      const brand = options.brandName === undefined ? "" : nameKey(options.brandName);
      if (brand !== "" && nameKey(match[1] ?? "").endsWith(brand)) return false;
      return OWN_CONTRAST.test(sentenceAndNext(text, index).slice(0, 400));
    },
  },
];

/** People "the average" can describe: "the average hiker pays $120". */
const AVERAGE_PERSON = String.raw`(?:users?|customers?|clients?|people|persons?|hikers?|runners?|campers?|cyclists?|households?|families|famil(?:y|ies)|parents?|students?|shoppers?|buyers?|consumers?|bakers?|freelancers?|owners?|businesses|business|companies|company|teams?|founders?|travell?ers?|readers?|members?|subscribers?|americans?|brits?|adults?|workers?|employees?)`;
/** Words that make a number about the market's data, whoever says it ("According to our survey"): never skipped. */
const DATA_CONTEXT = new RegExp(
  String.raw`\b(?:industry|industries|sector|nationwide|worldwide|globally|surveys?|stud(?:y|ies)|research|reports?(?=\s+(?:shows?|says?|found|finds|suggests?|puts?|estimates?))|(?:a|the|one|recent|new|latest|annual|industry)\s+report|(?:is|are|was|were|as|has|have|been)\s+reported|reportedly|statistics?|according\s+to|census|(?:the|an?)\s+average\s+(?:[\p{L}-]+\s+)?${AVERAGE_PERSON})\b`,
  "iu",
);
/** Rivals and the market at large: skipped only when the money is the business's own price. */
const RIVAL_CONTEXT = /\b(?:competitors?['’]?|competition|rivals?['’]?|elsewhere|markets?|average|on\s+average)\b/iu;
/** "Market" that is a place or a launch step, and "study" that is a product ("study guide"): not market context. */
const NOT_A_MARKET =
  /\b(?:farmers['’]?\s+markets?|markets?\s+(?:stall|stalls|day|days|square|hall|town)|(?:christmas|flea|street|night|food|craft|local|weekend|saturday|sunday)\s+markets?|at\s+the\s+markets?|the\s+markets?\s+(?:on|this|every|next)\b|go[\s-]to[\s-]market|to\s+market|on\s+the\s+market|marketplace|stud(?:y|ies)\s+(?:guides?|groups?|plans?|sessions?|notes|rooms?|buddy|buddies|kits?|cards|packs?|halls?|spaces?|tools?|skills|time|breaks?|materials?|schedules?|timetables?|aids?))\b/giu;
/** The money belongs to an "our/your" noun ("On average our loaves cost £4", "Our average order is $25", "we charge $79"). */
const OWN_PRICE =
  /\b(?:our|your)\s+(?:[\p{L}-]+\s+){0,2}?(?:costs?|is|are|was|were|starts?|sells?|runs?|comes?|priced)\b|\bwe\s+(?:charge|sell|price|ask)\b|\bours\s+(?:is|costs?)\b/iu;

/** Product measures the WP74 detector reads as counted nouns or magnitudes ("250 ml", "600 m climb"). */
const MEASURES = new RegExp(
  [
    String.raw`(?<![\p{N}.,])\b\d[\d,.]*\s?(?:ml|cl|dl|l|litres?|liters?|oz|g|mg|cm|mph|bpm|hz|gb|mb|tb)\b`,
    String.raw`(?<![\p{N}.,])\b\d[\d,.]*\s(?:m)\s+(?:climb|gain|elevation|ascent|descent|altitude|high|deep|long|wide|away|sprint|dash|swim|run)\b`,
    String.raw`(?<![\p{N}.,])\b\d[\d,.]*\s?°\s?[CF]\b`,
  ].join("|"),
  "giu",
);

/** The text with placeholders and product measures taken out (normalised). */
export const withoutNonClaims = (text: string): string => matchableText(text).replace(MEASURES, " ");

const SENTENCES = /(?<=[.!?])\s+|\n+/u;

/** The first market claim in a text: what it reads as, and the matched words. */
export function marketClaim(raw: string, options: MarketOptions = {}): { what: string; match: string } | null {
  const text = withoutNonClaims(raw);
  for (const rule of RULES) {
    if (rule.accept === undefined) {
      const match = rule.re.exec(text);
      if (match !== null) return { what: rule.what, match: match[0] };
      continue;
    }
    for (const match of text.matchAll(new RegExp(rule.re.source, `${rule.re.flags}g`))) {
      if (rule.accept(match, text, options)) return { what: rule.what, match: match[0] };
    }
  }
  for (const sentence of text.split(SENTENCES)) {
    if (!hasMarketClaim(sentence)) continue;
    const context = sentence.replace(NOT_A_MARKET, " ");
    if (DATA_CONTEXT.test(context)) return { what: "an industry statistic", match: sentence };
    if (RIVAL_CONTEXT.test(context) && !OWN_PRICE.test(sentence)) return { what: "an industry statistic", match: sentence };
  }
  return null;
}

/** True when the text carries a market number (D15), once non-claims are removed. */
export const carriesMarketNumber = (text: string, options: MarketOptions = {}): boolean => marketClaim(text, options) !== null;

/** One hard issue per string in an own idea's artifact that carries a market number. */
export function checkMarketNumbers(artifact: unknown, options: MarketOptions = {}): CheckIssue[] {
  const issues: CheckIssue[] = [];
  for (const { value, path } of stringLeaves(artifact, (p) => !isCopyPath(p))) {
    const claim = marketClaim(value, options);
    if (claim === null) continue;
    issues.push(
      issue(
        "hard",
        "own_idea_market_number",
        path,
        `An own idea carries no market numbers, competitor prices or keyword data; this reads as ${claim.what} ("${snippet(claim.match)}"). Remove it; the business's own price may stay.`,
      ),
    );
  }
  return issues;
}
