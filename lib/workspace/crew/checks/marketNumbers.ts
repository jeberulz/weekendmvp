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
 *   "30% cheaper than rivals", "Camelbak sells it for $120; ours is $79");
 * - any number the WP74 detector (`hasMarketClaim`) sees in a sentence that
 *   is about an industry, a survey or an average, unless the sentence is
 *   about the business itself ("On average our loaves cost £4", "Our average
 *   order is $25"). "Study guide", "reported issues" and "at the market"
 *   are not market context.
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
/** The business set against the named one: "...; ours is $79", "we charge $79". */
const OWN_SIDE = /\b(?:ours|our|we|us|theirs)\b/iu;
/** Capitalised words that start a sentence or name a plan, not a rival business. */
const NOT_A_RIVAL = String.raw`(?:It|This|That|These|Those|Ours|Each|Every|One|Our|Your|The|A|An|Shipping|Delivery|Postage|Entry|Admission|Access|Membership|Everything|Pricing|Plans?|Tickets?|Classes?|Lessons?|Pro|Plus|Basic|Premium|Team|Starter|Standard|Family|Annual|Monthly)`;

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
    // "Camelbak sells it for $120; ours is $79": a named business's price set against ours.
    // Only with "ours/our/we" in the text, and never the business's own name, so "Pro costs $9" stays clean.
    re: new RegExp(
      String.raw`(?<![\p{L}\p{N}])(?<!\b(?:our|the|this|my|your)\s)(?!${NOT_A_RIVAL}\b)([\p{Lu}][\p{L}\p{N}&'’-]+(?:[^\S\n]+[\p{Lu}][\p{L}\p{N}&'’-]+){0,2})\s+(?:sells|charges|costs|prices|retails|asks)\b[^.!?\n;]{0,30}?${MONEY}`,
      "u",
    ),
    accept: (match, text, options) =>
      OWN_SIDE.test(text) && (options.brandName === undefined || nameKey(match[1] ?? "") !== nameKey(options.brandName)),
  },
];

/** Words that make any number in the sentence about the market rather than the business. */
const MARKET_CONTEXT =
  /\b(?:industry|industries|sector|markets?|nationwide|worldwide|globally|(?:the\s+)?average|on\s+average|surveys?|stud(?:y|ies)|reports?(?=\s+(?:shows?|says?|found|finds|suggests?|puts?|estimates?))|(?:a|the|one|recent|new|latest|annual|industry)\s+report|(?:is|are|was|were|as|has|have|been)\s+reported|reportedly|statistics?|according\s+to|census)\b/iu;
/** "Market" that is a place or a launch step, and "study" that is a product ("study guide"): not market context. */
const NOT_A_MARKET =
  /\b(?:farmers['’]?\s+markets?|markets?\s+(?:stall|stalls|day|days|square|hall|town)|(?:christmas|flea|street|night|food|craft|local|weekend|saturday|sunday)\s+markets?|at\s+the\s+markets?|the\s+markets?\s+(?:on|this|every|next)\b|go[\s-]to[\s-]market|to\s+market|on\s+the\s+market|marketplace|stud(?:y|ies)\s+(?:guides?|groups?|plans?|sessions?|notes|rooms?|buddy|buddies|kits?|cards|packs?|halls?|spaces?|tools?|skills|time|breaks?|materials?|schedules?|timetables?|aids?))\b/giu;
/** A sentence about the business or its customer ("On average our loaves cost £4"): its own facts, not the market's. */
const ABOUT_US = /\b(?:we|our|ours|us|your|yours)\b/iu;

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
    if (ABOUT_US.test(sentence)) continue;
    const context = MARKET_CONTEXT.exec(sentence.replace(NOT_A_MARKET, " "));
    if (context !== null && hasMarketClaim(sentence)) return { what: "an industry statistic", match: sentence };
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
