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
 * - `founder_quote`: a quote attributed to the founder;
 * - `possible_social_count`: "Join 50 hikers" (a count under 100 after
 *   "join" may be true, or a goal);
 * - `unverified_comparison`: "30% more water than a 1 L bottle" (a measured
 *   product comparison the founder can check).
 *
 * Known trade-offs: "5-star" (outside a hygiene, safety or energy rating) and
 * "trusted by hikers" always fail. A founder who has real proof adds it after
 * review; the crew never writes it. Scarcity ("Only 3 left") is not proof and
 * is left to the S4b quality prompt.
 */
import { issue, snippet, type CheckIssue, type IssuePath, type IssueSeverity } from "./types";
import { isCopyPath, matchableText, stringLeaves } from "./walk";

type Hit = { readonly code: string; readonly severity: IssueSeverity; readonly what: string };
type Refine = (text: string, match: RegExpExecArray) => Hit | "skip" | undefined;

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

const FOUNDER_ROLE = /^,?\s*(?:the\s+|our\s+|its\s+)?(?:co-?)?(?:founder|owner|maker|creator|head\s+baker)\b/iu;
const SENTENCE_REST = /^[^.!?\n]*/u;

/** A quote attributed to the founder is softer: it may be the founder's own words. */
const softIfFounder: Refine = (text, match) =>
  FOUNDER_ROLE.test(text.slice(match.index + match[0].length, match.index + match[0].length + 40))
    ? { code: "founder_quote", severity: "soft", what: "a quote attributed to the founder" }
    : undefined;

/** A comparison with a stated baseline ("than a 1 L bottle") is a product fact the founder can check. */
const softIfCompared: Refine = (text, match) =>
  /\bthan\b/iu.test(SENTENCE_REST.exec(text.slice(match.index + match[0].length))?.[0] ?? "")
    ? { code: "unverified_comparison", severity: "soft", what: "a measured comparison" }
    : undefined;

/** "Join 50 hikers" may be a true count or a goal; "Join 2,000 hikers" or "Join 50 hikers already" is a claim. */
const softIfSmallJoin: Refine = (text, match) => {
  const found = match[0];
  const big = new RegExp(BIG, "iu").test(found) || /\+|\b(?:over|more\s+than|nearly|almost|others)\b/iu.test(found);
  const already = /^\s+(?:who\s+)?already\b/iu.test(text.slice(match.index + found.length));
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
    refine: (text, match) => (FOUNDER_ROLE.test(text.slice(match.index + match[0].lastIndexOf(","))) ? "skip" : undefined),
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
    // "Tip #1:", "Trail No. 1 starts here" and "Step #1" are numbering, not a ranking.
    re: /\brated\s+(?:#|No\.\s?)1\b|(?<![\p{L}\p{N}#])(?<!\b(?:tip|tips|step|reason|rule|day|week|part|module|lesson|chapter|episode|issue|item|mistake|question|trail|route|track|room|size|model|gate|bus|stop|lot|batch|table|plot|unit|hole|level|no|number|pick|priority)\s)(?:#|No\.\s?)1(?![\d.,:)])\s+\p{L}|\bnumber[\s-]one\s+(?:rated|app|tool|choice|platform|brand)\b|\bbest[\s-]selling\b|\b(?:top|highest)[\s-]rated\b/iu,
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
    refine: softIfCompared,
  },
  {
    code: "fake_stat",
    severity: "hard",
    what: "a percentage change",
    re: new RegExp(String.raw`\b${GROWTH_VERBS}\s+(?:(?:up\s+to|over|more\s+than|nearly|almost|about|around)\s+)?${D}\d+(?:\.\d+)?\s?%${NOT_PROMO}`, "iu"),
    refine: softIfCompared,
  },
  {
    code: "fake_stat",
    severity: "hard",
    what: "a multiplier outcome",
    re: new RegExp(String.raw`${D}\b\d+(?:\.\d+)?(?:x|×|\s+times)\s+(?:faster|more|fewer|less|better|quicker|higher|lower|cheaper|as|the)\b`, "iu"),
    refine: softIfCompared,
  },
  {
    code: "fake_stat",
    severity: "hard",
    what: "a ratio of people",
    re: new RegExp(String.raw`\b${NUMBER_WORD}\s+(?:out\s+of|in)\s+(?:${NUMBER_WORD}|a\s+hundred)\s+${WORDS}${PEOPLE}\b`, "iu"),
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
export function neverFakeMatches(raw: string): NeverFakeHit[] {
  const text = matchableText(raw);
  const found: NeverFakeHit[] = [];
  for (const pattern of PATTERNS) {
    const match = pattern.re.exec(text);
    if (match === null) continue;
    const refined = pattern.refine?.(text, match);
    if (refined === "skip") continue;
    const hit: Hit = refined ?? pattern;
    found.push({ code: hit.code, severity: hit.severity, what: hit.what, match: match[0] });
  }
  return found;
}

export type NeverFakeOptions = {
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
    for (const hit of neverFakeMatches(value)) issues.push(issue(hit.severity, hit.code, path, message(hit)));
  }
  return issues;
}
