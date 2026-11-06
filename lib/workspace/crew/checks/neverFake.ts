/**
 * WP75-S4a: "never fake it" (06-decisions, 07 §4).
 *
 * A founder's page and posts carry no testimonial, rating, user count, logo
 * wall, press mention or statistic the business did not earn. Proof exists
 * only as bracketed placeholders in `proofSlots` (workspace-only, never
 * published in v1). These patterns find invented proof in any copy string.
 * Text is normalised first (`normalizeText`: NFKC, invisible characters,
 * lookalike letters) and bracketed placeholders are removed; the workspace
 * proof slots, the brand voice's "don't say" example and a build prompt's
 * `Do not build:` line are not walked.
 *
 * A hard issue costs one paid repair call and rewrites copy, so hard patterns
 * aim at precision: each one reads as proof in almost every sentence it
 * matches. Patterns that are often honest are soft (shown, never repaired on
 * their own):
 *
 * - `unsupported_evidence`: "studies show" with no source;
 * - `possible_testimonial`: a signed line with no quote marks, "Sarah from
 *   Denver: ..." or a sentence signed "— @handle";
 * - `founder_quote`: a quote attributed to this business's founder ("Ana,
 *   the founder"; with `brandName`, "founder of {brandName}"). A founder or
 *   owner of another named business is a customer testimonial and stays hard;
 * - `possible_social_count`: "Join 50 hikers" (a count under 100 after
 *   "join" may be true, or a goal);
 * - `unverified_comparison`: "30% more water than a 1 L bottle", "2x more
 *   seats than on the Starter plan" (a product, plan or price baseline the
 *   founder can check). A baseline of people or a past self ("than before",
 *   "than they did", "than other hikers", "than the average freelancer")
 *   stays hard;
 * - `possible_ranking`: a bare "#1 {noun}" ("The #1 app for hikers"), often
 *   editorial ("The #1 tool you need is a map"). "Rated #1", "#1-selling",
 *   "#1 rated", "#1 on Product Hunt" and "the UK's #1" stay hard;
 * - `unverified_outcome`: an outcome claimed for customers ("Students double
 *   their income"). Only an explicit money or time saving on average with no
 *   plan, price or course tie ("Our customers save an average of 6 hours") is
 *   hard.
 *
 * Precision first (S4a final review): a hard flag costs a paid repair, so a
 * heuristic that cannot be made precise is soft, and semantic fakes are the
 * S4b quality prompt's job.
 *
 * Known trade-offs: "5-star" (outside a hygiene, safety or energy rating) and
 * "trusted by hikers" always fail. A founder who has real proof adds it after
 * review; the crew never writes it. Scarcity ("Only 3 left") is not proof and
 * is left to the S4b quality prompt.
 */
import { issue, snippet, type CheckIssue, type IssuePath, type IssueSeverity } from "./types";
import { isCopyPath, matchableText, stringLeaves } from "./walk";

type Hit = { readonly code: string; readonly severity: IssueSeverity; readonly what: string };
/** What a pattern may know about the business beyond the text. */
type MatchContext = {
  /** The business's own name: a quote from its founder may be the founder's words; one from another business is a testimonial. */
  readonly brandName?: string;
};
type Refine = (text: string, match: RegExpExecArray, context: MatchContext) => Hit | "skip" | undefined;

type Pattern = Hit & {
  readonly re: RegExp;
  /** Re-grades a match from its surroundings: a different hit, `"skip"`, or undefined to keep it. */
  readonly refine?: Refine;
};

/** A number start that is not the middle of another number ("1,1,1" has one start, not thousands). */
const D = String.raw`(?<![\p{N}.,])`;
/** Not a year: 1900-2099 standing alone. */
const NOT_YEAR = String.raw`(?!(?:19|20)\d{2}(?![\d,.]))`;
const NUM = String.raw`${D}\d[\d,.]*\s?(?:k|m|thousand|million)?\+?`;
const BIG = String.raw`${D}${NOT_YEAR}(?:\d{1,3}(?:,\d{3})+|\d{3,}|\d+(?:\.\d+)?\s?(?:k|thousand|million))\+?`;
/** Counted people, businesses and activity: what a made-up traction line counts. */
const PEOPLE = String.raw`(?:users?|customers?|clients?|members?|subscribers?|people|persons?|hikers?|runners?|cyclists?|campers|climbers|swimmers|walkers|founders?|builders?|makers?|creators?|sellers?|buyers?|shoppers?|teams?|companies|businesses|brands|agencies|startups|organi[sz]ations|bakeries|cafes|restaurants|shops|stores|studios|schools|gyms|clinics|salons|households|professionals|developers?|designers?|engineers|marketers|freelancers|writers|artists|photographers|students?|learners|teachers?|coaches|trainers|parents|families|athletes|travell?ers|bakers|chefs|cooks|dentists|doctors|nurses|owners|readers|listeners|fans|followers|neighbou?rs|others|downloads|installs|sign[\s-]?ups|pre-?orders|reviews|ratings)`;
const WORDS = String.raw`(?:[\p{L}-]+\s+){0,2}?`;
const PRESS = String.raw`(?:TechCrunch|Forbes|Wired|The Verge|Product Hunt|Hacker News|New York Times|NYT|BBC|CNN|Bloomberg|Wall Street Journal|WSJ|Fast Company|Business Insider|Entrepreneur|Mashable|Vogue|Reuters|The Guardian|Washington Post|Lifehacker|Outside Magazine|Men's Health|GQ|Good Morning America)`;
const REVIEW_SITES = String.raw`(?:Trustpilot|Yelp|G2|Capterra|Tripadvisor|Google(?:\s+Reviews)?|the\s+App\s+Store|App\s+Store|Google\s+Play|Amazon|Etsy)`;
const GROWTH_VERBS = String.raw`(?:by|up to|save|saves|saving|cut|cuts|boost|boosts|improve|improves|improved|reduce|reduces|reduced|increase|increases|increased|grow|grows|growing|grew|lift|lifts|raise|raises|raised|double|doubles|doubled|triple|tripled)`;
/** "can be used by", "built to be trusted by": a capability, not an endorsement. */
const NOT_AFTER_BE = String.raw`(?<!\bbe\s{1,3})`;
const NUMBER_WORD = String.raw`(?:\d+|one|two|three|four|five|six|seven|eight|nine|ten)`;
/** After a percentage: a discount or promotion, not an outcome. */
const NOT_PROMO = String.raw`(?!\s*(?:off\b|discount|(?:with|using)\s+(?:the\s+|our\s+)?(?:code|coupon|voucher)|on\s+(?:your|the|all|every|orders?|everything|pre-?orders?)\b|at\s+checkout|when\s+you|if\s+you|by\s+pre-?ordering|for\s+(?:the\s+first|early|students|members|life|founding)))`;
/** "100% of profits go to charity" is a pledge, not a statistic. */
const NOT_PLEDGE = String.raw`(?!(?:all\s+|the\s+|our\s+|its\s+|their\s+|every\s+|each\s+)?(?:profits?|proceeds|revenue|takings|sales|fees?|donations?|tips|price)\b)`;

/** What a bare "#1" may rank ("the #1 hydration pack"): soft, since "the #1 tool you need is a map" is editorial. */
const RANK_NOUNS = String.raw`(?:apps?|tools?|choice|packs?|brands?|planners?|products?|sellers?|best[\s-]?sellers?|platforms?|solutions?|software|services?|courses?|bottles?|bakery|bakeries|cafes?|shops?|stores?)`;
/** Where a "#1" is ranked: "#1 on Product Hunt", "#1 in its category". */
const RANK_CHARTS = String.raw`(?:Product\s+Hunt|(?:the\s+)?App\s+Store|Google\s+Play|Amazon|Etsy|Hacker\s+News|(?:its|the|our)\s+category)`;
const RANK_MARK = String.raw`(?:#|No\.\s?)1`;
/** Places a "#1" claims to lead: "the UK's #1 sourdough bakery". */
const RANK_PLACES = String.raw`(?:UK|U\.K\.|US|U\.S\.|USA|America|Britain|England|Scotland|Wales|Ireland|Europe|Australia|Canada|world|country|nation|city|town|internet|web)`;

const FOUNDER_ROLE = /^,?\s*(?:the\s+|our\s+|its\s+)?(?:co-?)?(?:founder|owner|maker|creator|head\s+baker)\b/iu;
/** The business named after a role: "owner of Bloom Florist", "founder at TrailCo", "founder, TrailCo". */
const ROLE_BUSINESS =
  /^\s*(?:(?:of|at)\s+(?:the\s+)?|,\s*)([\p{Lu}\p{N}][\p{L}\p{N}&'’.-]*(?:[^\S\n]+(?:&[^\S\n]+)?[\p{Lu}\p{N}][\p{L}\p{N}&'’.-]*){0,4})/u;
const SENTENCE_REST = /^[^.!?\n]*/u;
const SENTENCE_START = /[^.!?\n]*$/u;
/** How far a refinement looks around a match: refinements run at every match, so each look stays bounded. */
const SENTENCE_WINDOW = 240;
/** The rest of the match's sentence (at most `SENTENCE_WINDOW` characters). */
const sentenceAfter = (text: string, match: RegExpExecArray): string => {
  const end = match.index + match[0].length;
  return SENTENCE_REST.exec(text.slice(end, end + SENTENCE_WINDOW))?.[0] ?? "";
};
/** The start of the match's sentence (at most `SENTENCE_WINDOW` characters). */
const sentenceBefore = (text: string, match: RegExpExecArray): string =>
  SENTENCE_START.exec(text.slice(Math.max(0, match.index - SENTENCE_WINDOW), match.index))?.[0] ?? "";

const nameKey = (name: string): string => name.normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");

/**
 * The attribution after a quote is the founder of this business: a founder
 * role that names no business ("Ana, the founder") or names this brand. A
 * founder or owner of another named business ("Jane, owner of Bloom Florist")
 * is a customer testimonial, and with no brand name known it stays one.
 */
function founderOfThisBusiness(after: string, context: MatchContext): boolean {
  const role = FOUNDER_ROLE.exec(after);
  if (role === null) return false;
  const business = ROLE_BUSINESS.exec(after.slice(role[0].length));
  if (business === null) return true;
  const brand = context.brandName === undefined ? "" : nameKey(context.brandName);
  return brand !== "" && nameKey(business[1] ?? "") === brand;
}

const ATTRIBUTION_WINDOW = 90;

/** A quote attributed to this business's founder is softer: it may be the founder's own words. */
const softIfFounder: Refine = (text, match, context) =>
  founderOfThisBusiness(text.slice(match.index + match[0].length, match.index + match[0].length + ATTRIBUTION_WINDOW), context)
    ? { code: "founder_quote", severity: "soft", what: "a quote attributed to the founder" }
    : undefined;

/** People a baseline can name: "than other hikers", "than most runners", "than the average freelancer". */
const BASELINE_PEOPLE = String.raw`(?:users?|customers?|clients?|members?|people|persons?|hikers?|runners?|cyclists?|campers?|climbers?|swimmers?|walkers?|founders?|builders?|makers?|creators?|sellers?|buyers?|shoppers?|teams?|companies|businesses|bakeries|shops|students?|learners?|teachers?|parents?|families|athletes?|travell?ers?|bakers?|freelancers?|developers?|designers?|owners?|readers?|professionals?|beginners?|subscribers?|marketers?|writers?)`;
/** A baseline that is a past self or other people ("than before", "than they did", "than other hikers"). */
const PEOPLE_BASELINE = new RegExp(
  String.raw`^\s*(?:before|without|they\s+(?:did|used\s+to|were|do)|you\s+(?:did|used\s+to|do)|we\s+did|(?:other|most|the\s+average|an?\s+average|average|typical|the\s+typical)\s+(?:[\p{L}-]+\s+)?${BASELINE_PEOPLE}\b|others\b|everyone|everybody|anyone\s+else|usual\b|last\s+(?:year|season|month|week))`,
  "iu",
);

/**
 * A comparison is hard only when its baseline is people or a past self
 * ("than before", "than they did", "than other hikers", "than the average
 * freelancer"): an invented outcome. A product, plan or price baseline ("than
 * a 1 L bottle", "than on the Starter plan", "than the in-store price", "than
 * most bottles") is a fact the founder can check: soft.
 */
const softIfCompared: Refine = (text, match) => {
  const rest = sentenceAfter(text, match);
  const than = /\bthan\b/iu.exec(rest);
  if (than === null) return undefined;
  if (PEOPLE_BASELINE.test(rest.slice(than.index + than[0].length))) return undefined;
  return { code: "unverified_comparison", severity: "soft", what: "a measured comparison" };
};

/**
 * A plan, price or course tie ("with the annual plan", "on yearly billing", "per seat on Team", "in the course"):
 * the number is a product or pricing fact, not an outcome. Shared by the customer-outcome and percentage rules.
 */
const PLAN_TIE =
  /\b(?:plans?|price|prices|pricing|billing|billed|courses?|subscription|subscribe|subscribes|membership|annual|annually|yearly|seats?|code|coupon|discount|bundle|launch)\b/iu;
/** What follows a percentage in a promotion: "20% with the annual plan", "15% on yearly billing", "20% per seat on Team". */
const PROMO_CONNECTOR = /^\s*(?:off\s+)?(?:with|on|for|when|if|per|by|at)\b/iu;

/** "Save 20% with the annual plan" is a promotion; anything else goes on to the comparison rule. */
const promoOrCompared: Refine = (text, match, context) => {
  const rest = sentenceAfter(text, match);
  if (PROMO_CONNECTOR.test(rest) && PLAN_TIE.test(rest.slice(0, 80))) return "skip";
  return softIfCompared(text, match, context);
};
/** An explicit money or time saving on average: "save an average of 6 hours", "save on average $40". */
const AVERAGE_SAVING =
  /\b(?:save|saves|saved)\s+(?:an\s+average\s+of|on\s+average)\s+(?:[$€£¥₹]\s?\d|\d[\d,.]*\s*(?:%|[$€£¥₹]|hours?|hrs?|minutes?|mins?|days?|weeks?|months?)(?![\p{L}]))/iu;

/**
 * "Our customers save an average of 6 hours" (no plan or price tie) is an
 * invented outcome: hard. Other customer outcomes ("Students double their
 * income", "earn an average of ...") are soft, and one tied to a plan, price
 * or course is skipped. The rest is S4b's quality prompt.
 */
const gradeOutcome: Refine = (text, match) => {
  const sentence = sentenceBefore(text, match) + match[0] + sentenceAfter(text, match);
  const averaged = /\baverage\b/iu.test(match[0]);
  if (averaged && PLAN_TIE.test(sentence)) return "skip";
  if (averaged && AVERAGE_SAVING.test(sentence)) return undefined;
  return { code: "unverified_outcome", severity: "soft", what: "an outcome claimed for customers" };
};

/** "Join 50 hikers" may be a true count or a goal; "Join 2,000 hikers" or "Join 50 hikers already" is a claim. */
const softIfSmallJoin: Refine = (text, match) => {
  const found = match[0];
  const big = new RegExp(BIG, "iu").test(found) || /\+|\b(?:over|more\s+than|nearly|almost|others)\b/iu.test(found);
  const already = /^\s+(?:who\s+)?already\b/iu.test(text.slice(match.index + found.length, match.index + found.length + 40));
  return big || already ? undefined : { code: "possible_social_count", severity: "soft", what: "a small count of people who joined" };
};

export const PATTERNS: Pattern[] = [
  // Testimonials.
  {
    code: "fake_testimonial",
    severity: "hard",
    what: "a quote with an attribution",
    re: /["“][^"“”\n]{12,200}["”][.!?,]?\s*(?:[-–—]\s*|,?\s+(?:says|said)\s+)(?:@[A-Za-z0-9_]{2,}|[A-Z][\p{L}.'-]+(?:\s+[A-Z][\p{L}.'-]*)?)/u,
    refine: softIfFounder,
  },
  {
    code: "fake_testimonial",
    severity: "hard",
    what: "a single-quoted line with a name and place",
    re: /(?<![\p{L}\p{N}])['‘][^\n]{12,200}?[.!?]['’]\s*(?:[-–—]\s*)?[A-Z][\p{L}.'-]+,\s+[A-Z]/u,
    refine: softIfFounder,
  },
  {
    code: "possible_testimonial",
    severity: "soft",
    what: "a signed line",
    re: /(?:^|\n)[^\S\n]*[—–][^\S\n]*[A-Z][\p{L}.'-]+(?:\s+[A-Z][\p{L}.'-]*)?,\s+\p{L}/u,
    // An email signed by the founder ("— Ana, founder of HydroTrail") is a sign-off.
    // Another business's owner signing ("— Jane, owner of Bloom Florist") stays a possible testimonial.
    refine: (text, match, context) =>
      founderOfThisBusiness(text.slice(match.index + match[0].lastIndexOf(","), match.index + match[0].length + ATTRIBUTION_WINDOW), context)
        ? "skip"
        : undefined,
  },
  { code: "possible_testimonial", severity: "soft", what: "a line signed with a handle", re: /[.!?]\s*[—–-]\s*@[A-Za-z0-9_]{2,}\s*$/u },
  { code: "possible_testimonial", severity: "soft", what: "a named customer speaking", re: /^\s*[A-Z][\p{Ll}]+(?:\s+[A-Z]\.?)?\s+from\s+[A-Z][\p{L}]+:\s/u },
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
    re: /\b(?:customers|users|clients|members|people|everyone|hikers|runners)\s+(?:absolutely\s+)?(?:love|rave\s+about|swear\s+by)\s+(?:it|us|our|this)\b(?!\s+(?:when|if|because)\b)/iu,
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
    // Not a date: "Reviews open on 3/5" or "from 3/5/2027".
    re: /(?:\b(?:rated?|rating|stars?|reviews?|score)\b\W+(?:\w+\W+){0,3}?(?<!\b(?:on|from|until|till|by|before|after|since)\s)[1-5]\s?\/\s?5\b(?!\s?\/)|\b[1-5]\s?\/\s?5\s+(?:stars?|rating|reviews?)\b)/iu,
  },
  {
    code: "fake_rating",
    severity: "hard",
    what: "a star rating",
    re: /\b(?:five|5)[\s-]stars?\b(?!\s+(?:food\s+)?(?:hygiene|safety|energy|crash|hotel|resort))|\b[1-5]\.\d\s?stars?\b/iu,
  },
  {
    code: "fake_rating",
    severity: "hard",
    what: "a rating on a review site",
    re: new RegExp(String.raw`\brated\s+(?:[\p{L}-]+\s+){0,3}?on\s+${REVIEW_SITES}\b`, "iu"),
  },
  {
    code: "fake_review",
    severity: "hard",
    what: "a review count",
    re: new RegExp(String.raw`${D}\b\d[\d,.]{1,}\+?\s+(?:[\p{L}-]+\s+)?(?:reviews|ratings|testimonials)\b`, "iu"),
  },
  { code: "fake_review", severity: "hard", what: "reviews nobody wrote", re: /\b(?:rave|glowing|stellar)\s+reviews\b/iu },
  // User and customer counts.
  {
    code: "fake_social_count",
    severity: "hard",
    what: "a count of people who joined",
    re: new RegExp(
      String.raw`\bjoin(?:ed|ing)?\s+(?:(?:over|more\s+than|nearly|almost|around|about)\s+)?(?:the\s+)?${NUM}\s+${WORDS}${PEOPLE}\b`,
      "iu",
    ),
    refine: softIfSmallJoin,
  },
  {
    code: "fake_social_count",
    severity: "hard",
    what: "a count of people who use it",
    re: new RegExp(
      String.raw`${NOT_AFTER_BE}\b(?:helped|served|serving|trusted\s+by|used\s+by|loved\s+by|chosen\s+by|adopted\s+by|relied\s+on\s+by)\s+(?:(?:over|more\s+than|nearly|almost|around|about)\s+)?(?:the\s+)?${NUM}\s+${WORDS}${PEOPLE}\b`,
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
      // "the first 100 hikers on the list" is a cap, not a count.
      String.raw`(?<![\p{L}\p{N}.,])(?<!\b(?:first|next|only)\s{1,3})${BIG}\s+${WORDS}${PEOPLE}\s+(?:already\s+)?(?:use|trust|love|rely|joined|signed|choose|chose|are|were|have|can['’]?t|cannot|agree|swear|recommend|prefer|rate|rated|say|said|waiting|on\s+the\s+(?:wait)?list)\b`,
      "iu",
    ),
  },
  {
    code: "fake_social_count",
    severity: "hard",
    what: "a community of thousands",
    re: new RegExp(
      String.raw`\b(?:community|family|tribe|network|club|crew|army|list|waitlist)\s+of\s+(?:(?:over|more\s+than|nearly|almost)\s+)?${BIG}\s+${WORDS}${PEOPLE}\b`,
      "iu",
    ),
  },
  {
    code: "fake_social_count",
    severity: "hard",
    what: "thousands or millions of people",
    re: new RegExp(String.raw`\b(?:thousands|hundreds|millions|tens\s+of\s+thousands|dozens)\s+of\s+${WORDS}${PEOPLE}\b`, "iu"),
  },
  {
    code: "fake_social_count",
    severity: "hard",
    what: "a sales count",
    re: new RegExp(
      String.raw`(?:\b(?:over|more\s+than|nearly|almost|already)\s+(?:a\s+|one\s+)?(?:million|thousand|hundred\s+thousand|${BIG})|${D}\d+(?:\.\d+)?\s?(?:k|thousand|million)\b)\s+(?:[\p{L}-]+\s+){0,2}?(?:sold|shipped|delivered|downloaded|served|booked)\b`,
      "iu",
    ),
  },
  {
    code: "fake_social_count",
    severity: "hard",
    what: "a sign-up count",
    // A goal is not a claim: "Reach 500 sign-ups", "our first 100 pre-orders".
    re: new RegExp(
      String.raw`(?<!\b(?:reach|reaching|hit|get|aim\s{1,3}for|goal(?:\s{1,3}of)?:?|target(?:\s{1,3}of)?:?|toward|towards|first|to)\s{1,3})${BIG}\s+(?:[\p{L}-]+\s+){0,2}?(?:sign[\s-]?ups|pre-?orders|downloads|installs)\b`,
      "iu",
    ),
  },
  // "Trusted by" and logo walls.
  {
    code: "fake_trusted_by",
    severity: "hard",
    what: "\"trusted by\"",
    re: new RegExp(String.raw`${NOT_AFTER_BE}\btrusted\s+by\b(?!\s+(?:you|your|yours|yourself|nobody|no\s+one|none|no)\b)`, "iu"),
  },
  {
    code: "fake_trusted_by",
    severity: "hard",
    what: "endorsement by a crowd or by elite users",
    re: new RegExp(
      String.raw`${NOT_AFTER_BE}\b(?:loved|relied\s+on|chosen|adopted|used|backed|preferred)\s+by\s+(?:(?:over|more\s+than|nearly)\s+)?(?:thousands|hundreds|millions|leading|top|the\s+world['’]s|the\s+best|elite|olympic|olympians|pro|professional|world[\s-]class|award[\s-]winning)\b`,
      "iu",
    ),
  },
  {
    code: "fake_trusted_by",
    severity: "hard",
    what: "endorsement by experts",
    re: new RegExp(
      String.raw`${NOT_AFTER_BE}\b(?:recommended|endorsed|approved|backed|vetted)\s+by\s+(?:(?:leading|top|real)\s+)?(?:doctors|dietitians|nutritionists|physio(?:therapist)?s|experts|scientists|dentists|vets|coaches|trainers|pros|professionals)\b`,
      "iu",
    ),
  },
  {
    code: "fake_logo_wall",
    severity: "hard",
    what: "people at named companies endorsing it",
    re: /(?:\bby\s+(?:[Tt]eams|[Ee]ngineers|[Dd]evelopers|[Dd]esigners|[Mm]arketers|[Ee]mployees|[Ss]taff|[Pp]eople|[Ff]olks)\s+(?:at|from)\s+[A-Z]|\b(?:[Tt]eams|[Ee]ngineers|[Dd]evelopers|[Dd]esigners|[Mm]arketers|[Ee]mployees|[Ss]taff|[Pp]eople|[Ff]olks)\s+(?:at|from)\s+[A-Z][\p{L}0-9&.]*(?:(?:,\s+|\s+(?:and|&)\s+)[A-Z][\p{L}0-9&.]*)*\s+(?:already\s+)?(?:use|uses|used|rely|relies|love|loves|trust|trusts|swear|choose|chose|depend)\b|\b(?:[Tt]eams|[Ee]ngineers|[Dd]evelopers|[Dd]esigners|[Mm]arketers|[Ee]mployees|[Ss]taff)\s+(?:at|from)\s+[A-Z][\p{L}0-9&.]*,\s+[A-Z][\p{L}0-9&.]*,?\s+(?:and|&)\s+[A-Z])/u,
  },
  {
    code: "fake_logo_wall",
    severity: "hard",
    what: "named companies as endorsement",
    re: /\b(?:[Cc]ompanies|[Tt]eams|[Ss]tartups|[Oo]rgani[sz]ations|[Bb]rands)\s+(?:like|such\s+as)\s+[A-Z][\p{L}0-9&.]+/u,
  },
  {
    code: "fake_logo_wall",
    severity: "hard",
    what: "a partner or customer logo wall",
    // A heading line on its own ("Our partners"), or a list of named ones.
    re: /^[^\S\n]*(?:[Oo]ur|[Kk]ey|OUR|KEY)[^\S\n]+(?:partners|customers|clients|sponsors|backers|PARTNERS|CUSTOMERS|CLIENTS)[^\S\n]*:?[^\S\n]*$|\b(?:[Pp]artners|[Cc]ustomers|[Cc]lients)\s+include\s+[A-Z]/mu,
  },
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
  {
    code: "fake_credential",
    severity: "hard",
    what: "a ranking",
    // "rated #1", "ranked No. 1", "#1-selling", "#1 rated", "#1 on Product Hunt", "the UK's #1 bakery".
    re: new RegExp(
      String.raw`\b(?:rated|ranked|voted|named)\s+(?:the\s+)?(?:${RANK_MARK}|number\s+one)\b|(?<![\p{L}\p{N}#])${RANK_MARK}[\s-](?:selling|rated|ranked|best[\s-]?sell(?:er|ing))\b|(?<![\p{L}\p{N}#])${RANK_MARK}\s+(?:on|in)\s+${RANK_CHARTS}\b|\b${RANK_PLACES}['’]s\s+${RANK_MARK}\s+\p{L}|\bnumber[\s-]one\s+(?:rated|selling)\b|\bbest[\s-]selling\b|\b(?:top|highest)[\s-]rated\b`,
      "iu",
    ),
  },
  {
    code: "possible_ranking",
    severity: "soft",
    what: "a \"#1\" ranking",
    // A bare "#1 {noun}" is often editorial ("The #1 tool you need is a good map"); "Tip #1:", "our #1 priority" are numbering.
    re: new RegExp(
      String.raw`(?<![\p{L}\p{N}#])(?<!\b(?:tip|tips|step|reason|rule|day|week|part|module|lesson|chapter|episode|issue|item|mistake|question|trail|route|track|room|size|model|gate|bus|stop|lot|batch|table|plot|unit|hole|level|no|number|priority|shop|bakery|store)\s)${RANK_MARK}(?![\d.,:)-])\s+(?:(?!(?:rated|ranked|selling)\b)[\p{L}-]+\s+)?${RANK_NOUNS}\b(?!\s+(?:mistake|tip|rule|question|step|lesson|error)s?\b)|\bnumber[\s-]one\s+(?:app|tool|choice|platform|brand)\b`,
      "iu",
    ),
  },
  { code: "fake_credential", severity: "hard", what: "a proof claim", re: /\b(?:clinically|scientifically|medically)\s+proven\b|\bdoctor[\s-]recommended\b/iu },
  // Invented statistics.
  {
    code: "fake_stat",
    severity: "hard",
    what: "a percentage outcome",
    re: new RegExp(
      String.raw`${D}\b\d+(?:\.\d+)?\s?%${NOT_PROMO}\s+(?:of\s+${NOT_PLEDGE}\p{L}+|more|less|fewer|faster|slower|better|higher|lower|cheaper|quicker|increase|decrease|reduction|improvement|growth|drop|boost|savings?)\b`,
      "iu",
    ),
    refine: promoOrCompared,
  },
  {
    code: "fake_stat",
    severity: "hard",
    what: "a percentage change",
    re: new RegExp(String.raw`\b${GROWTH_VERBS}\s+(?:(?:up\s+to|over|more\s+than|nearly|almost|about|around)\s+)?${D}\d+(?:\.\d+)?\s?%${NOT_PROMO}`, "iu"),
    refine: promoOrCompared,
  },
  {
    code: "fake_stat",
    severity: "hard",
    what: "a multiplier outcome",
    re: new RegExp(String.raw`${D}\b\d+(?:\.\d+)?(?:x|×|\s+times)\s+(?:faster|more|fewer|less|better|quicker|higher|lower|cheaper|as|the)\b`, "iu"),
    refine: promoOrCompared,
  },
  {
    code: "fake_stat",
    severity: "hard",
    what: "a ratio of people",
    re: new RegExp(String.raw`\b${NUMBER_WORD}\s+(?:out\s+of|in)\s+(?:${NUMBER_WORD}|a\s+hundred)\s+${WORDS}${PEOPLE}\b`, "iu"),
  },
  {
    code: "fake_stat",
    severity: "hard",
    what: "an outcome claimed for customers",
    // Hard only for "Our customers save an average of 6 hours" (gradeOutcome); "Students double their income" is soft.
    re: /\b(?:customers|users|clients|members|students|learners|hikers|runners|teams|subscribers|readers|owners|families|parents|graduates|alumni|founders)\s+(?:who\s+[^.!?\n]{1,40}?\s+)?(?:(?:double|doubles|doubled|triple|triples|tripled|halve|halves|halved)\s+their\b|(?:save|saves|saved|earn|earns|earned|cut|cuts|gain|gains|gained|make|makes|made)\s+(?:an\s+average\s+of|on\s+average)\b)/iu,
    refine: gradeOutcome,
  },
  {
    code: "unsupported_evidence",
    severity: "soft",
    what: "an appeal to studies with no source",
    re: /\b(?:studies|research|surveys?|scientists|experts)\s+(?:shows?|found|prove|proves|confirm|confirms|suggests?|say)\b|\baccording\s+to\s+(?:(?:a|one|the)\s+)?(?:recent\s+|new\s+|\d{4}\s+)?(?:study|survey|research|report)\b/iu,
  },
];

export type NeverFakeHit = Hit & { readonly match: string };

/** Run every pattern over one string. The text is normalised and its placeholders removed first. */
const GLOBAL_PATTERNS = new WeakMap<RegExp, RegExp>();

/** The pattern's regex with the global flag, compiled once. */
function globalOf(re: RegExp): RegExp {
  let global = GLOBAL_PATTERNS.get(re);
  if (global === undefined) {
    global = re.global ? re : new RegExp(re.source, `${re.flags}g`);
    GLOBAL_PATTERNS.set(re, global);
  }
  return global;
}

/**
 * Run every pattern over one string. The text is normalised and its
 * placeholders removed first. A pattern with a refinement is tried at every
 * match, keeping the most severe finding per code, so a first match that is
 * softened or skipped ("Join 50 hikers. Join 2,000 hikers.", a founder quote
 * before a customer's) never hides a later hard one. Refinements only soften
 * or skip, so the search stops at the first match that keeps the pattern's
 * own severity.
 */
export function neverFakeMatches(raw: string, context: MatchContext = {}): NeverFakeHit[] {
  const text = matchableText(raw);
  const found: NeverFakeHit[] = [];
  for (const pattern of PATTERNS) {
    if (pattern.refine === undefined) {
      const match = pattern.re.exec(text);
      if (match !== null) found.push({ code: pattern.code, severity: pattern.severity, what: pattern.what, match: match[0] });
      continue;
    }
    const best = new Map<string, NeverFakeHit>();
    for (const match of text.matchAll(globalOf(pattern.re))) {
      const refined = pattern.refine(text, match, context);
      if (refined === "skip") continue;
      const hit: Hit = refined ?? pattern;
      const prior = best.get(hit.code);
      if (prior === undefined || (prior.severity === "soft" && hit.severity === "hard")) {
        best.set(hit.code, { code: hit.code, severity: hit.severity, what: hit.what, match: match[0] });
      }
      if (hit.code === pattern.code && hit.severity === pattern.severity) break;
    }
    found.push(...best.values());
  }
  return found;
}

export type NeverFakeOptions = MatchContext & {
  /** Prunes a subtree that is not the business's own claims (a library blueprint's researched `market`). */
  readonly skip?: (path: IssuePath) => boolean;
};

function message(hit: NeverFakeHit): string {
  const quoted = `("${snippet(hit.match)}")`;
  if (hit.severity === "hard") return `Reads as ${hit.what} ${quoted}. Proof is never invented: remove it or say what the product does.`;
  if (hit.code === "unsupported_evidence") return `Appeals to evidence without a source ${quoted}. Say what the product does instead.`;
  return `May read as ${hit.what} ${quoted}. Keep it only if it is true and the founder can show it.`;
}

/**
 * Findings for every copy string in an artifact (the proof slots, the voice
 * counter-example, `Do not build:` lines and enum-like fields are left out).
 */
export function checkNeverFake(artifact: unknown, options: NeverFakeOptions = {}): CheckIssue[] {
  const issues: CheckIssue[] = [];
  const skip = (path: IssuePath): boolean => !isCopyPath(path) || options.skip?.(path) === true;
  for (const { value, path } of stringLeaves(artifact, skip)) {
    for (const hit of neverFakeMatches(value, { brandName: options.brandName })) issues.push(issue(hit.severity, hit.code, path, message(hit)));
  }
  return issues;
}
