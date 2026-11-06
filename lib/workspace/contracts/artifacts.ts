/**
 * C-ART — crew artifact contracts (WP69-S1).
 *
 * A crew employee produces each artifact as structured output; the AI gateway
 * validates it against these schemas before anything is stored, rendered,
 * emailed or posted. Types and pure helpers only: no Convex imports, no I/O and
 * no side effects at import time.
 *
 * Contract rules shared by every artifact:
 * - `schemaVersion: 1` on every artifact object; a breaking change bumps it.
 * - Fixed shapes are structural (palette roles, the four emails, the seven
 *   social days, the four build phases, the landing slots), because structured
 *   outputs cannot enforce item counts: JSON Schema `minItems` is honoured only
 *   for 0 and 1, and `maxItems`, `minLength`, `maxLength` and numeric bounds are
 *   not honoured at all. Those limits live here as the post-parse check and in
 *   each field's `.meta({ description })` so the model sees them; on a failed
 *   parse the gateway re-asks once.
 * - Every string and array is bounded (see `LIMITS`). Titles, labels, subjects
 *   and names are single-line; body fields allow `\n` and `\t` but no other
 *   control character. Stricter per-platform limits and contrast are graders.
 * - Objects are strict: unknown keys fail.
 * - "Never fake it": proof exists only as LandingSpec `proofSlots`, every one a
 *   bracketed placeholder with `placeholder: true`. Code adds them
 *   (`parseModelOutput`); the model drafts `landingSpecDraftSchema`.
 * - No model output carries keyword volume, CPC, competition or other market
 *   numbers; library market data stays in the idea pipeline.
 *
 * Markdown safety: `seoPack.article.bodyMarkdown` and `buildPack.productMd` are
 * rendered as CommonMark with raw HTML off and only https or relative link and
 * image destinations allowed — never through MDX or `lib/mdx.tsx`. The schema
 * also rejects raw HTML-looking input (`<` followed by a letter, `/`, `!` or
 * `?`) and any other destination (see `isSafeMarkdown`). Build prompt bodies are
 * plain text: shown and copied verbatim, never rendered as markdown.
 *
 * Document kinds (C-DATA): C-DATA's `documents.kind` must include every
 * `ARTIFACT_KINDS` literal, `roster_plan` among them. The first SEO article is
 * embedded in `seoPack.article`; it is not a separate document kind. C-DATA's
 * `documents.kind` also lists `seo_article`: that literal is reserved for later
 * stand-alone articles, WP69 never writes one, and C-ART defines no schema for
 * it (it is deliberately absent from `ARTIFACT_KINDS`).
 */
import { z } from "zod";

import { roleKeySchema, rosterPlanSchema, rosterProfileSchema, singleLineText } from "./roster.ts";
import type { RosterPlan } from "./roster.ts";

export { rosterPlanSchema };
export type { RosterPlan };

// ---------------------------------------------------------------------------
// Limits — shared with graders and UI counters.
// ---------------------------------------------------------------------------

export const LIMITS = {
  common: {
    alt: 200,
    imageDescription: 400,
    ctaLabel: 32,
    url: 2048,
    path: 120,
    slug: 80,
    key: 40,
  },
  blueprint: {
    pitch: 160,
    oneUser: 200,
    oneLoop: 240,
    feature: 140,
    featuresMin: 3,
    featuresMax: 7,
    marketSummary: 600,
    competitorName: 60,
    competitorNote: 200,
    competitorsMax: 5,
    scopeCut: 160,
    scopeCutsMax: 8,
  },
  brandKit: {
    name: 40,
    nameAlternativesMax: 3,
    tagline: 80,
    colourName: 24,
    colourUse: 160,
    fontNotes: 160,
    typeScale: 120,
    themeReason: 120,
    voiceTrait: 24,
    voiceTraitsMin: 3,
    voiceTraitsMax: 5,
    voiceLine: 200,
    markDescription: 400,
    pattern: 300,
    productMomentTitle: 60,
    productMomentBody: 160,
  },
  landingSpec: {
    brandName: 40,
    navLinksMax: 4,
    addedReason: 80,
    headline: 80,
    subhead: 220,
    reassurance: 140,
    heading: 80,
    itemTitle: 60,
    itemBody: 240,
    sectionBody: 400,
    emailLabel: 40,
    successMessage: 200,
    momentCaption: 60,
    closingLine: 80,
    copyrightName: 60,
    proofSlotsMax: 6,
    proofQuote: 280,
    proofAttribution: 80,
    proofValue: 24,
    proofLabel: 80,
    proofName: 60,
  },
  emailSequence: {
    name: 80,
    senderName: 60,
    subject: 120,
    preview: 150,
    body: 4000,
    goal: 40,
    maxDelayHours: 720,
  },
  socialPack: {
    hook: 280,
    caption: 2200,
    shortCaption: 280,
    imageText: 24,
    pollOptionsMin: 2,
    pollOptionsMax: 4,
    pollOption: 25,
    hashtagsMax: 10,
    hashtag: 50,
  },
  seoPack: {
    pagesMax: 10,
    title: 60,
    metaDescription: 160,
    keywordsMin: 1,
    keywordsMax: 20,
    keyword: 80,
    articleTitle: 80,
    outlineMin: 3,
    outlineMax: 12,
    outlineItem: 120,
    bodyMarkdown: 12000,
  },
  launchPlan: {
    itemsMin: 4,
    itemsMax: 16,
    maxOrder: 99,
    title: 80,
    detail: 280,
  },
  adsDrafts: {
    campaignName: 80,
    audienceDescription: 400,
    locationNote: 160,
    ageMin: 18,
    ageMax: 65,
    dailyBudgetCentsMin: 100,
    dailyBudgetCentsMax: 10000,
    learningWindowDaysMin: 7,
    learningWindowDaysMax: 30,
    creativesMin: 1,
    creativesMax: 3,
    headline: 80,
    primaryText: 600,
    decisionLogMin: 1,
    decisionLogMax: 10,
    decision: 160,
    why: 400,
  },
  buildPack: {
    lightPromptsMin: 1,
    lightPromptsMax: 3,
    phaseBlurb: 200,
    promptTitle: 80,
    timeMinutesMin: 5,
    timeMinutesMax: 480,
    promptBody: 4000,
    doNotBuild: 400,
    doneWhen: 400,
    stackMin: 1,
    stackMax: 10,
    stackLabel: 40,
    stackValue: 120,
    outsideServicesMax: 3,
    productMd: 6000,
  },
} as const;

// ---------------------------------------------------------------------------
// Shared building blocks.
// ---------------------------------------------------------------------------

const describe = (limit: string, about?: string): { description: string } => ({
  description: about ? `${about} (${limit})` : limit,
});

/** A single-line, trimmed, bounded string (titles, labels, subjects, names). */
const line = (max: number, about?: string) =>
  singleLineText(max).meta(describe(`single line, ≤ ${max} characters`, about));

/** Control characters other than `\n` and `\t`. */
const BODY_CONTROL_CHARS = /[\u0000-\u0008\u000B-\u001F\u007F-\u009F]/;

/** A multi-line, trimmed, bounded body: `\n` and `\t` allowed, no other control character. */
const body = (max: number, about?: string) =>
  z
    .string()
    .trim()
    .min(1)
    .max(max)
    .refine((value) => !BODY_CONTROL_CHARS.test(value), {
      message: "Only \\n and \\t are allowed as control characters",
    })
    .meta(describe(`≤ ${max} characters`, about));

const integer = (min: number, max: number, about?: string) =>
  z.number().int().min(min).max(max).meta(describe(`integer ${min}–${max}`, about));

const countLabel = (min: number, max: number): string =>
  min === max ? `exactly ${min} items` : `${min}–${max} items`;

/** A bounded array with its count in the description. */
const list = <T extends z.ZodType>(item: T, min: number, max: number, about?: string) =>
  z.array(item).min(min).max(max).meta(describe(countLabel(min, max), about));

const slugSchema = z
  .string()
  .max(LIMITS.common.slug)
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Use a lowercase-hyphenated slug")
  .meta(describe(`lowercase-hyphenated, ≤ ${LIMITS.common.slug} characters`));

const keySchema = z
  .string()
  .max(LIMITS.common.key)
  .regex(/^[a-z0-9]+([_-][a-z0-9]+)*$/, "Use a lowercase key")
  .meta(describe(`lowercase key, ≤ ${LIMITS.common.key} characters`));

/** `#RRGGBB`. */
export const hexColourSchema = z
  .string()
  .max(7)
  .regex(/^#[0-9A-Fa-f]{6}$/, "Use a #RRGGBB hex colour")
  .meta(describe("#RRGGBB"));

/** Control characters and bidirectional formatting characters. */
const UNSAFE_URL_CHARS = /[\u0000-\u001F\u007F-\u009F؜‎‏‪-‮⁦-⁩\s\\]/;

/**
 * True for an absolute https URL with a dotted DNS host: no userinfo, no IP
 * literal, no control, bidi, whitespace or backslash characters.
 */
export function isSafeHttpsUrl(value: string): boolean {
  if (UNSAFE_URL_CHARS.test(value) || !value.startsWith("https://")) return false;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (url.protocol !== "https:" || url.username !== "" || url.password !== "") return false;
  const host = url.hostname;
  if (host.startsWith("[") || /^\d+(\.\d+){3}$/.test(host) || !host.includes(".")) return false;
  return true;
}

/** LandingSpec sections in render order (the renderer owns the order). */
export const LANDING_SECTION_ORDER = [
  "hero",
  "promises",
  "how_it_works",
  "app_preview",
  "waitlist",
  "footer",
] as const;
export type LandingSectionKey = (typeof LANDING_SECTION_ORDER)[number];

/** The in-page anchor each section renders with; anchor CTAs must hit a present one. */
export const SECTION_ANCHORS = {
  hero: "#top",
  promises: "#why",
  how_it_works: "#how",
  app_preview: "#app",
  waitlist: "#waitlist",
  footer: "#footer",
} as const satisfies Record<LandingSectionKey, `#${string}`>;

const SECTION_ANCHOR_LIST = Object.values(SECTION_ANCHORS).join(", ");

const ANCHOR = /^#[a-z][a-z0-9-]*$/;

/** An in-page anchor (`#waitlist`) or a safe https URL. */
export const ctaTargetSchema = z
  .string()
  .max(LIMITS.common.url)
  .refine((value) => ANCHOR.test(value) || isSafeHttpsUrl(value), {
    message: "Use an in-page anchor such as #waitlist or an https URL",
  })
  .meta(
    describe(
      `an in-page anchor of a section you include (${SECTION_ANCHOR_LIST}), or an https URL; ≤ ${LIMITS.common.url} characters`,
    ),
  );

export const ctaSchema = z
  .object({
    label: line(LIMITS.common.ctaLabel),
    target: ctaTargetSchema,
  })
  .strict();
export type Cta = z.infer<typeof ctaSchema>;

/** A site-relative path such as `/` or `/blog/how-much-water`. */
const sitePathSchema = z
  .string()
  .max(LIMITS.common.path)
  .regex(/^\/([a-z0-9-]+(\/[a-z0-9-]+)*)?$/, "Use a site path such as /blog/my-post")
  .meta(describe(`site path such as /blog/my-post, ≤ ${LIMITS.common.path} characters`));

/** An image the platform resolves later; the model supplies intent and alt text. */
export const imageSchema = z
  .object({
    description: line(LIMITS.common.imageDescription, "What the image shows"),
    alt: line(LIMITS.common.alt, "Alt text"),
  })
  .strict();
export type ImageSpec = z.infer<typeof imageSchema>;

/** Text whose optional `emphasis` is its closing words (rendered in italic or accent). */
const emphasisTextSchema = (max: number) =>
  z
    .object({
      text: line(max),
      emphasis: line(max, "The closing words of text to emphasise").optional(),
    })
    .strict()
    .refine((value) => value.emphasis === undefined || value.text.endsWith(value.emphasis), {
      message: "emphasis must be the closing words of text",
      path: ["emphasis"],
    });

/** Adds an issue for each value that appears more than once; `null` entries are skipped. */
function flagDuplicates(
  values: readonly (string | null)[],
  ctx: z.RefinementCtx,
  path: (index: number) => (string | number)[],
  label: string,
): void {
  const seen = new Set<string>();
  values.forEach((value, index) => {
    if (value === null) return;
    if (seen.has(value)) {
      ctx.addIssue({ code: "custom", message: `Duplicate ${label} "${value}"`, path: path(index) });
    }
    seen.add(value);
  });
}

// Guarded reads for refinements that run with `when` on a possibly invalid value.

type IssuePath = (string | number)[];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** The value at `path` inside an unparsed or partly parsed value, or undefined. */
function valueAt(value: unknown, path: readonly (string | number)[]): unknown {
  let current = value;
  for (const key of path) {
    if (typeof key === "number" && Array.isArray(current)) current = current[key];
    else if (typeof key === "string" && isRecord(current)) current = current[key];
    else return undefined;
  }
  return current;
}

/** Every string inside `value` with its path. */
function stringLeaves(value: unknown, path: IssuePath, found: { value: string; path: IssuePath }[]): void {
  if (typeof value === "string") found.push({ value, path });
  else if (Array.isArray(value)) value.forEach((child, index) => stringLeaves(child, [...path, index], found));
  else if (isRecord(value)) for (const [key, child] of Object.entries(value)) stringLeaves(child, [...path, key], found);
}

/** True when every `{…}` in `value` is one of `allowed` and no stray braces remain. */
export function onlyMergeTags(value: string, allowed: readonly string[]): boolean {
  let rest = value;
  for (const tag of allowed) rest = rest.split(tag).join("");
  return !rest.includes("{") && !rest.includes("}");
}

// ---------------------------------------------------------------------------
// Markdown safety (SeoPack article body, BuildPack productMd).
// ---------------------------------------------------------------------------

/** Characters a relative destination may use. Excludes `:`, `&` and `\` (scheme, entity and escape tricks). */
const RELATIVE_DESTINATION = /^[A-Za-z0-9\-._~/#?=%+]+$/;

function isSafeDestination(destination: string): boolean {
  if (destination.startsWith("https://")) return isSafeHttpsUrl(destination);
  return RELATIVE_DESTINATION.test(destination) && !destination.startsWith("//");
}

/**
 * True when `markdown` is safe to render as CommonMark with raw HTML off: no
 * HTML-looking `<` and every link or image destination is https or relative.
 */
export function isSafeMarkdown(markdown: string): boolean {
  if (/<[A-Za-z/!?]/.test(markdown)) return false;
  const inline = [...markdown.matchAll(/\]\(\s*(<[^>]*>|[^\s)]*)/g)].map((match) => match[1] ?? "");
  // Reference definitions count wherever they appear: CommonMark accepts them inside block quotes
  // and list items too, and their labels apply document-wide. An empty destination (one on the next
  // line) fails `isSafeDestination`, so it is rejected.
  const references = [...markdown.matchAll(/\[[^\]\n]+\]:[ \t]*(<[^>\n]*>|\S*)/g)].map(
    (match) => match[1] ?? "",
  );
  return [...inline, ...references].every((raw) => {
    const destination = raw.startsWith("<") && raw.endsWith(">") ? raw.slice(1, -1) : raw;
    return isSafeDestination(destination);
  });
}

const markdownBody = (max: number, about?: string) =>
  body(max, about ? `${about}; CommonMark, no HTML, https or relative links only` : undefined).refine(
    isSafeMarkdown,
    "Markdown may not contain HTML, and links must be https or relative",
  );

// ---------------------------------------------------------------------------
// Artifact kinds.
// ---------------------------------------------------------------------------

/** Exact strings; they become `documents.kind` literals in the Convex schema. */
export const ARTIFACT_KINDS = [
  "blueprint",
  "roster_plan",
  "brand_kit",
  "landing_spec",
  "email_sequence",
  "social_pack",
  "seo_pack",
  "launch_plan",
  "ads_drafts",
  "build_pack",
] as const;
export type ArtifactKind = (typeof ARTIFACT_KINDS)[number];
export const artifactKindSchema = z.enum(ARTIFACT_KINDS);

// ---------------------------------------------------------------------------
// Blueprint — read by the wizard review step, the roster rules (via
// `profile`) and every later employee as the brief. An own idea is a light
// blueprint labelled "Not yet validated" (D15): it has no `market` block and no
// `ideaSlug`, so it cannot carry market numbers, competitor prices or keyword
// data. The label derives from `source`.
// ---------------------------------------------------------------------------

export const BLUEPRINT_SOURCES = ["library", "own_idea"] as const;

/** Qualitative only: no keyword volume, CPC or competitor prices. */
export const blueprintMarketSchema = z
  .object({
    summary: body(LIMITS.blueprint.marketSummary, "Qualitative market summary; no numbers or prices"),
    competitors: list(
      z
        .object({
          name: line(LIMITS.blueprint.competitorName),
          note: line(LIMITS.blueprint.competitorNote, "Qualitative; no prices"),
        })
        .strict(),
      0,
      LIMITS.blueprint.competitorsMax,
    ),
  })
  .strict();

const blueprintFields = {
  schemaVersion: z.literal(1),
  pitch: line(LIMITS.blueprint.pitch, "One-line pitch"),
  oneUser: line(LIMITS.blueprint.oneUser, "The one user"),
  oneLoop: line(LIMITS.blueprint.oneLoop, "The one loop"),
  features: list(
    line(LIMITS.blueprint.feature),
    LIMITS.blueprint.featuresMin,
    LIMITS.blueprint.featuresMax,
    "Core features",
  ),
  profile: rosterProfileSchema,
  scopeCuts: list(line(LIMITS.blueprint.scopeCut), 0, LIMITS.blueprint.scopeCutsMax, "Left out of the weekend"),
};

const libraryBlueprintSchema = z
  .object({
    ...blueprintFields,
    source: z.literal("library"),
    ideaSlug: slugSchema,
    market: blueprintMarketSchema.optional(),
  })
  .strict();

const ownIdeaBlueprintSchema = z
  .object({
    ...blueprintFields,
    source: z.literal("own_idea"),
  })
  .strict();

/** One schema per source, for a gateway that asks for a known variant. */
export const blueprintVariantSchemas = {
  library: libraryBlueprintSchema,
  own_idea: ownIdeaBlueprintSchema,
} as const;

export const blueprintSchema = z.discriminatedUnion("source", [libraryBlueprintSchema, ownIdeaBlueprintSchema]);
export type Blueprint = z.infer<typeof blueprintSchema>;

/** Own ideas show "Not yet validated". */
export function blueprintIsValidated(blueprint: Blueprint): boolean {
  return blueprint.source === "library";
}

// ---------------------------------------------------------------------------
// Visual system — closed lists the renderer is built for (WP69-S6,
// `docs/plans/launch-workspace/07-landing-design.md` §4–§5). Iris picks an art
// direction, a curated type pair and shape, density and theme tokens; Leo picks
// a layout per section from what that direction allows. Nothing here is free
// text the renderer would have to interpret: every value is an enum, so a new
// value is a widening that needs no migration.
// ---------------------------------------------------------------------------

/** Freezes `value` and everything inside it; returns it unchanged in type. */
function deepFreeze<T>(value: T): T {
  if (typeof value === "object" && value !== null) {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}

/** The renderer's art directions: each a complete world of type, spacing, shape, surface and one motion moment. */
export const ART_DIRECTIONS = Object.freeze([
  "editorial",
  "warm_utility",
  "bold_geometric",
  "quiet_technical",
  "handmade",
  "dense_product",
] as const);
export type ArtDirection = (typeof ART_DIRECTIONS)[number];

export const ART_DIRECTION_INFO: Readonly<Record<ArtDirection, { readonly label: string; readonly summary: string }>> =
  deepFreeze({
    editorial: { label: "Editorial", summary: "Serif display, a long reading measure, paper ground and restrained colour." },
    warm_utility: { label: "Warm utility", summary: "Friendly humanist sans, warm neutrals and plain-spoken layouts." },
    bold_geometric: { label: "Bold geometric", summary: "Geometric or expanded display, big type and confident blocks of colour." },
    quiet_technical: { label: "Quiet technical", summary: "Precise grotesk on a tight grid, data set in mono, minimal colour." },
    handmade: { label: "Handmade", summary: "Expressive display, organic shapes and texture, warm throughout." },
    dense_product: { label: "Dense product", summary: "Compact and screenshot-led, built for B2B scanning." },
  });

/** Corner radius family. */
export const VISUAL_SHAPES = Object.freeze(["sharp", "soft", "round"] as const);
/** Spacing rhythm. */
export const VISUAL_DENSITIES = Object.freeze(["airy", "balanced", "compact"] as const);
/** Set by the use scene, not the category (07 §4). */
export const THEME_MODES = Object.freeze(["light", "dark"] as const);

type FontFace = { readonly family: string; readonly weights: readonly number[] };
export type TypePair = {
  /** `defaultWeight` is the display weight the renderer sets headings in; it is one of `weights`. */
  readonly heading: FontFace & { readonly defaultWeight: number };
  readonly body: FontFace;
  readonly mono?: FontFace;
  /** The art directions this pair suits; a kit's pair must list its direction. */
  readonly directions: readonly ArtDirection[];
};

/** Curated pair ids; the model picks one, never a font family. */
export const TYPE_PAIR_IDS = Object.freeze([
  "fraunces_newsreader",
  "instrument_serif_instrument_sans",
  "dm_serif_display_dm_sans",
  "bricolage_grotesque_figtree",
  "syne_manrope",
  "archivo_archivo",
  "ibm_plex",
  "schibsted_grotesk_literata",
  "young_serif_public_sans",
  "caprasimo_karla",
  "gloock_work_sans",
  "red_hat_display_red_hat_text",
  "hanken_grotesk_spectral",
  "familjen_grotesk_onest",
] as const);
export type TypePairId = (typeof TYPE_PAIR_IDS)[number];

/**
 * The type pairs the renderer self-hosts. Every family is OFL on Google Fonts;
 * `weights` are the static weights the renderer loads.
 */
export const TYPE_PAIRS: Readonly<Record<TypePairId, TypePair>> = deepFreeze({
  fraunces_newsreader: {
    heading: { family: "Fraunces", weights: [300, 400, 500, 600, 700, 800, 900], defaultWeight: 600 },
    body: { family: "Newsreader", weights: [400, 500, 600] },
    directions: ["editorial", "handmade"],
  },
  instrument_serif_instrument_sans: {
    heading: { family: "Instrument Serif", weights: [400], defaultWeight: 400 },
    body: { family: "Instrument Sans", weights: [400, 500, 600] },
    directions: ["editorial", "quiet_technical"],
  },
  dm_serif_display_dm_sans: {
    heading: { family: "DM Serif Display", weights: [400], defaultWeight: 400 },
    body: { family: "DM Sans", weights: [400, 500, 600] },
    directions: ["editorial", "warm_utility"],
  },
  bricolage_grotesque_figtree: {
    heading: { family: "Bricolage Grotesque", weights: [500, 600, 700, 800], defaultWeight: 700 },
    body: { family: "Figtree", weights: [400, 500, 600] },
    directions: ["warm_utility", "handmade", "bold_geometric"],
  },
  syne_manrope: {
    heading: { family: "Syne", weights: [600, 700, 800], defaultWeight: 700 },
    body: { family: "Manrope", weights: [400, 500, 600] },
    directions: ["bold_geometric"],
  },
  archivo_archivo: {
    heading: { family: "Archivo", weights: [600, 700, 800, 900], defaultWeight: 800 },
    body: { family: "Archivo", weights: [400, 500] },
    directions: ["bold_geometric", "dense_product"],
  },
  ibm_plex: {
    heading: { family: "IBM Plex Sans", weights: [500, 600, 700], defaultWeight: 600 },
    body: { family: "IBM Plex Sans", weights: [400, 500] },
    mono: { family: "IBM Plex Mono", weights: [400, 500] },
    directions: ["quiet_technical", "dense_product"],
  },
  schibsted_grotesk_literata: {
    heading: { family: "Schibsted Grotesk", weights: [600, 700, 800], defaultWeight: 700 },
    body: { family: "Literata", weights: [400, 500] },
    directions: ["editorial", "quiet_technical"],
  },
  young_serif_public_sans: {
    heading: { family: "Young Serif", weights: [400], defaultWeight: 400 },
    body: { family: "Public Sans", weights: [400, 500, 600] },
    directions: ["warm_utility", "handmade"],
  },
  caprasimo_karla: {
    heading: { family: "Caprasimo", weights: [400], defaultWeight: 400 },
    body: { family: "Karla", weights: [400, 500, 600] },
    directions: ["handmade"],
  },
  gloock_work_sans: {
    heading: { family: "Gloock", weights: [400], defaultWeight: 400 },
    body: { family: "Work Sans", weights: [400, 500] },
    directions: ["editorial", "bold_geometric"],
  },
  red_hat_display_red_hat_text: {
    heading: { family: "Red Hat Display", weights: [600, 700, 800, 900], defaultWeight: 800 },
    body: { family: "Red Hat Text", weights: [400, 500] },
    directions: ["dense_product", "warm_utility"],
  },
  hanken_grotesk_spectral: {
    heading: { family: "Hanken Grotesk", weights: [600, 700, 800], defaultWeight: 700 },
    body: { family: "Spectral", weights: [400, 500] },
    directions: ["quiet_technical", "editorial"],
  },
  familjen_grotesk_onest: {
    heading: { family: "Familjen Grotesk", weights: [500, 600, 700], defaultWeight: 600 },
    body: { family: "Onest", weights: [400, 500] },
    directions: ["dense_product", "quiet_technical"],
  },
});

/**
 * A compact text block for brand-kit prompts (WP75): one line per art
 * direction listing the type pair ids it allows, each with its heading and body
 * families, e.g. `editorial: fraunces_newsreader (Fraunces / Newsreader); …`.
 * The grammar carries only the ids, so the prompt is where the model sees which
 * pairs fit. Pure and deterministic.
 */
export function typePairBrief(): string {
  return ART_DIRECTIONS.map((direction) => {
    const pairs = TYPE_PAIR_IDS.filter((id) => TYPE_PAIRS[id].directions.includes(direction)).map(
      (id) => `${id} (${TYPE_PAIRS[id].heading.family} / ${TYPE_PAIRS[id].body.family})`,
    );
    return `${direction}: ${pairs.join("; ")}`;
  }).join("\n");
}

/** Overused or system faces that are never a founder page's display face (07 §4). */
export const BANNED_DISPLAY_FAMILIES = Object.freeze([
  "Inter",
  "Roboto",
  "Open Sans",
  "Arial",
  "Helvetica",
  "Poppins",
  "Montserrat",
  "Space Grotesk",
  "Plus Jakarta Sans",
] as const);

/**
 * Layout variants per landing section; the renderer draws each. Promises has
 * no card grid: same-size icon + heading + text cards are refused as a page
 * structure (07 §4). The nav has one fixed layout.
 */
export const SECTION_LAYOUTS = deepFreeze({
  hero: ["split_media", "type_led", "product_frame", "full_bleed_media"],
  promises: ["list", "split", "feature_rows"],
  how_it_works: ["numbered_steps", "timeline"],
  app_preview: ["device_frame", "annotated", "plain_frame"],
  waitlist: ["inline_band", "panel", "split"],
  footer: ["minimal", "statement"],
} as const satisfies Record<LandingSectionKey, readonly [string, ...string[]]>);
export type SectionLayout<S extends LandingSectionKey> = (typeof SECTION_LAYOUTS)[S][number];
export type DirectionLayouts = { readonly [S in LandingSectionKey]: readonly SectionLayout<S>[] };

/** The layouts each art direction allows, per section. */
export const DIRECTION_LAYOUTS: Readonly<Record<ArtDirection, DirectionLayouts>> = deepFreeze({
  editorial: {
    hero: ["type_led", "split_media", "full_bleed_media"],
    promises: ["list", "split"],
    how_it_works: ["numbered_steps", "timeline"],
    app_preview: ["plain_frame", "annotated"],
    waitlist: ["inline_band", "split"],
    footer: ["statement", "minimal"],
  },
  warm_utility: {
    hero: ["split_media", "full_bleed_media", "product_frame"],
    promises: ["list", "feature_rows", "split"],
    how_it_works: ["numbered_steps", "timeline"],
    app_preview: ["device_frame", "annotated"],
    waitlist: ["panel", "inline_band"],
    footer: ["minimal", "statement"],
  },
  bold_geometric: {
    hero: ["type_led", "full_bleed_media", "split_media"],
    promises: ["split", "feature_rows"],
    how_it_works: ["numbered_steps"],
    app_preview: ["device_frame", "plain_frame"],
    waitlist: ["inline_band", "split"],
    footer: ["statement"],
  },
  quiet_technical: {
    hero: ["product_frame", "type_led", "split_media"],
    promises: ["list", "feature_rows"],
    how_it_works: ["numbered_steps", "timeline"],
    app_preview: ["annotated", "plain_frame"],
    waitlist: ["inline_band", "panel"],
    footer: ["minimal"],
  },
  handmade: {
    hero: ["full_bleed_media", "split_media"],
    promises: ["split", "list"],
    how_it_works: ["timeline", "numbered_steps"],
    app_preview: ["device_frame", "plain_frame"],
    waitlist: ["panel", "split"],
    footer: ["statement", "minimal"],
  },
  dense_product: {
    hero: ["product_frame", "split_media"],
    promises: ["feature_rows", "list"],
    how_it_works: ["numbered_steps"],
    app_preview: ["annotated", "device_frame", "plain_frame"],
    waitlist: ["inline_band", "panel"],
    footer: ["minimal"],
  },
});

// Phosphor core 2.1.1 icon names (MIT), each checked against ~/.claude/skills/ui-ux-pro-max/data/phosphor-icons-upstream.json.
export const LANDING_ICONS = Object.freeze([
  "clock",
  "timer",
  "hourglass",
  "calendar-check",
  "currency-dollar",
  "coins",
  "wallet",
  "piggy-bank",
  "receipt",
  "tag",
  "map-pin",
  "map-trifold",
  "compass",
  "globe-hemisphere-west",
  "user",
  "users",
  "users-three",
  "handshake",
  "heart",
  "chat-circle",
  "chats-circle",
  "envelope-simple",
  "bell",
  "megaphone",
  "chart-line-up",
  "chart-bar",
  "trend-up",
  "target",
  "shield-check",
  "lock-key",
  "check-circle",
  "lightning",
  "rocket-launch",
  "leaf",
  "plant",
  "drop",
  "sun",
  "mountains",
  "book-open",
  "graduation-cap",
  "pencil-simple",
  "lightbulb",
  "storefront",
  "shopping-bag",
  "package",
  "truck",
  "gift",
  "coffee",
  "fork-knife",
  "house",
  "buildings",
  "briefcase",
  "camera",
  "image",
  "microphone",
  "music-notes",
  "paint-brush",
  "code",
  "cloud",
  "device-mobile",
  "laptop",
  "magnifying-glass",
  "list-checks",
  "clipboard-text",
  "file-text",
  "arrows-clockwise",
  "gear",
  "puzzle-piece",
  "barbell",
  "bicycle",
  "paw-print",
  "first-aid",
  "baby",
] as const);
export type LandingIcon = (typeof LANDING_ICONS)[number];

// ---------------------------------------------------------------------------
// BrandKit — read by the tenant site renderer (visual system, tokens, type
// pair), Studio and every copywriting employee (voice). Contrast is graded
// with `failingTextPairs`; the type pair must suit the direction (below).
// ---------------------------------------------------------------------------

export const PALETTE_ROLES = ["primary", "secondary", "accent", "ground", "ink"] as const;
export type PaletteRole = (typeof PALETTE_ROLES)[number];

export const paletteColourSchema = z
  .object({
    name: line(LIMITS.brandKit.colourName),
    hex: hexColourSchema,
    use: line(LIMITS.brandKit.colourUse, "Where the colour is used"),
  })
  .strict();

export const visualSystemSchema = z
  .object({
    direction: z.enum(ART_DIRECTIONS),
    shape: z.enum(VISUAL_SHAPES),
    density: z.enum(VISUAL_DENSITIES),
    theme: z
      .object({
        mode: z.enum(THEME_MODES),
        reason: line(LIMITS.brandKit.themeReason, "Why the use scene calls for it"),
      })
      .strict(),
  })
  .strict();
export type VisualSystem = z.infer<typeof visualSystemSchema>;

export const brandKitSchema = z
  .object({
    schemaVersion: z.literal(1),
    name: line(LIMITS.brandKit.name),
    nameAlternatives: list(line(LIMITS.brandKit.name), 0, LIMITS.brandKit.nameAlternativesMax),
    tagline: emphasisTextSchema(LIMITS.brandKit.tagline),
    palette: z
      .object({
        primary: paletteColourSchema,
        secondary: paletteColourSchema,
        accent: paletteColourSchema.meta(describe("never used for text")),
        ground: paletteColourSchema,
        ink: paletteColourSchema,
      })
      .strict(),
    visualSystem: visualSystemSchema,
    type: z
      .object({
        pair: z.enum(TYPE_PAIR_IDS).meta(describe("must suit visualSystem.direction")),
        scale: line(LIMITS.brandKit.typeScale, "e.g. H1 56/0.98 · H2 32/1.05 · Body 16/1.5"),
        notes: line(LIMITS.brandKit.fontNotes),
      })
      .strict(),
    voice: z
      .object({
        traits: list(
          line(LIMITS.brandKit.voiceTrait),
          LIMITS.brandKit.voiceTraitsMin,
          LIMITS.brandKit.voiceTraitsMax,
        ),
        say: line(LIMITS.brandKit.voiceLine),
        dontSay: line(LIMITS.brandKit.voiceLine),
        dontSayWhy: line(LIMITS.brandKit.voiceLine),
      })
      .strict(),
    logo: z
      .object({
        markDescription: line(LIMITS.brandKit.markDescription),
        alt: line(LIMITS.common.alt, "Alt text"),
      })
      .strict(),
    heroArt: imageSchema,
    pattern: line(LIMITS.brandKit.pattern, "Pattern or motif").optional(),
    productMoment: z
      .object({
        title: line(LIMITS.brandKit.productMomentTitle),
        body: line(LIMITS.brandKit.productMomentBody),
      })
      .strict()
      .optional(),
  })
  .strict()
  .superRefine(checkBrandKit, { when: (payload) => isRecord(payload.value) });
export type BrandKit = z.infer<typeof brandKitSchema>;

const isOneOf = <T extends string>(values: readonly T[], value: unknown): value is T =>
  typeof value === "string" && (values as readonly string[]).includes(value);

const HEX_COLOUR = /^#[0-9A-Fa-f]{6}$/;

/**
 * Cross-field brand kit rules. Runs with `when` so its issues report alongside
 * other field errors (the single repair re-ask then sees them all); the value
 * may be partly invalid, so every read is guarded.
 */
function checkBrandKit(kit: unknown, ctx: z.RefinementCtx): void {
  const traits = valueAt(kit, ["voice", "traits"]);
  if (Array.isArray(traits)) {
    flagDuplicates(
      traits.map((trait) => (typeof trait === "string" ? trait.trim().toLowerCase() : null)),
      ctx,
      (index) => ["voice", "traits", index],
      "voice trait",
    );
  }

  const pairId = valueAt(kit, ["type", "pair"]);
  const direction = valueAt(kit, ["visualSystem", "direction"]);
  if (isOneOf(TYPE_PAIR_IDS, pairId) && isOneOf(ART_DIRECTIONS, direction)) {
    if (!TYPE_PAIRS[pairId].directions.includes(direction)) {
      ctx.addIssue({
        code: "custom",
        message: `Type pair ${pairId} does not suit the ${direction} direction`,
        path: ["type", "pair"],
      });
    }
  }

  const mode = valueAt(kit, ["visualSystem", "theme", "mode"]);
  const ground = valueAt(kit, ["palette", "ground", "hex"]);
  const ink = valueAt(kit, ["palette", "ink", "hex"]);
  if (isOneOf(THEME_MODES, mode) && typeof ground === "string" && typeof ink === "string" && HEX_COLOUR.test(ground) && HEX_COLOUR.test(ink)) {
    const groundIsLighter = relativeLuminance(ground) > relativeLuminance(ink);
    if (groundIsLighter !== (mode === "light")) {
      ctx.addIssue({
        code: "custom",
        message:
          mode === "light"
            ? "A light theme needs a ground lighter than its ink"
            : "A dark theme needs a ground darker than its ink",
        path: ["visualSystem", "theme", "mode"],
      });
    }
  }
}

/** WCAG 2.x relative luminance of a `#RRGGBB` colour. */
export function relativeLuminance(hex: string): number {
  if (!/^#[0-9A-Fa-f]{6}$/.test(hex)) {
    throw new RangeError(`Expected a #RRGGBB colour, got "${hex}"`);
  }
  const channel = (offset: number): number => {
    const value = Number.parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
}

/** WCAG contrast ratio between two `#RRGGBB` colours (1–21). Order does not matter. */
export function contrastRatio(hexA: string, hexB: string): number {
  const a = relativeLuminance(hexA);
  const b = relativeLuminance(hexB);
  const [lighter, darker] = a >= b ? [a, b] : [b, a];
  return (lighter + 0.05) / (darker + 0.05);
}

/** The text-on-background pairs a kit is used in. Accent is never text (canvas). */
export const BRAND_TEXT_PAIRS = [
  { text: "ink", background: "ground" },
  { text: "primary", background: "ground" },
  { text: "ground", background: "primary" },
  { text: "ground", background: "ink" },
] as const satisfies readonly { text: PaletteRole; background: PaletteRole }[];

export const MIN_TEXT_CONTRAST = 4.5;

/** The pairs in `BRAND_TEXT_PAIRS` below `minRatio` (WCAG AA body text by default). */
export function failingTextPairs(
  kit: Pick<BrandKit, "palette">,
  minRatio: number = MIN_TEXT_CONTRAST,
): { text: PaletteRole; background: PaletteRole; ratio: number }[] {
  return BRAND_TEXT_PAIRS.map(({ text, background }) => ({
    text,
    background,
    ratio: contrastRatio(kit.palette[text].hex, kit.palette[background].hex),
  })).filter((pair) => pair.ratio < minRatio);
}

// ---------------------------------------------------------------------------
// LandingSpec — read by the tenant site renderer on {slug}.weekendmvp.app.
// Fixed slots; the renderer owns the order (`LANDING_SECTION_ORDER`). The
// platform renders the waitlist privacy line and link (D5 controller/processor
// text), the double opt-in, the footer year, business email and "Made with
// Weekend MVP" badge — none of that is model-written.
//
// The waitlist is required for every idea kind: the published site has no
// checkout in v1, so email capture is the conversion.
//
// Founder pages carry no eyebrow or kicker above any heading (07 §4). Every
// section but the nav names a `layout` from `SECTION_LAYOUTS`; whether the
// brand kit's direction allows it is a cross-artifact rule
// (`checkLandingAgainstBrandKit`), because this schema has no kit. Promise
// icons come from the curated `LANDING_ICONS` Phosphor set.
// ---------------------------------------------------------------------------

/** Sections Weekend MVP may gap-fill carry this flag and, when added, a reason. */
const addedFields = {
  addedByWeekendMvp: z.boolean().meta(describe("true when Weekend MVP added the section")),
  addedReason: line(LIMITS.landingSpec.addedReason, 'Shown on added sections, e.g. "waitlist capture → your first goal"').optional(),
};

/**
 * Emoji shown as pictures (and the emoji variation selector). Not
 * `Extended_Pictographic`, so © and ™ stay allowed. Validation only: `\p{…}`
 * is not a structured-output pattern.
 */
const EMOJI = /[\p{Emoji_Presentation}\uFE0F]/u;

/** A heading that leads with a section number: "01 Plan", "02. Plan", "3 / Plan", "1) Plan". */
const LEADING_SECTION_NUMBER = /^(0\d|\d{1,2}\s*[./:)|·–—-])(\s|$)/u;

/**
 * Spec-level landing rules. They run from the spec's refinement, not per
 * section (a refined object's fields each become a `$defs` entry in the
 * structured-output schema, which costs grammar bytes), and with `when` so
 * they report alongside other sections' issues: the single repair re-ask then
 * sees everything at once. The value may be partly invalid, so every read is
 * guarded.
 */
function checkLanding(spec: unknown, ctx: z.RefinementCtx): void {
  if (!isRecord(spec)) return;
  for (const section of ["app_preview", "waitlist"] as const) {
    const value = spec[section];
    if (!isRecord(value) || typeof value.addedByWeekendMvp !== "boolean") continue;
    if (value.addedByWeekendMvp && value.addedReason === undefined) {
      ctx.addIssue({
        code: "custom",
        message: "A section added by Weekend MVP needs an addedReason",
        path: [section, "addedReason"],
      });
    }
    if (!value.addedByWeekendMvp && value.addedReason !== undefined) {
      ctx.addIssue({
        code: "custom",
        message: "addedReason is only valid on sections added by Weekend MVP",
        path: [section, "addedReason"],
      });
    }
  }

  const anchors = new Set<string>(landingSections(spec).map((key) => SECTION_ANCHORS[key]));
  for (const { target, path } of collectCtas(spec)) {
    if (target.startsWith("#") && !anchors.has(target)) {
      ctx.addIssue({ code: "custom", message: `Anchor ${target} matches no section`, path });
    }
  }

  const leaves: { value: string; path: IssuePath }[] = [];
  stringLeaves(spec, [], leaves);
  for (const { value, path } of leaves) {
    if (EMOJI.test(value)) ctx.addIssue({ code: "custom", message: "No emoji in landing copy", path });
  }

  const items = valueAt(spec, ["promises", "items"]);
  const headingPaths: IssuePath[] = [
    ["hero", "headline", "text"],
    ["how_it_works", "heading"],
    ["app_preview", "heading"],
    ["waitlist", "heading"],
    ...(Array.isArray(items) ? items.map((_, index): IssuePath => ["promises", "items", index, "title"]) : []),
  ];
  for (const path of headingPaths) {
    const heading = valueAt(spec, path);
    if (typeof heading === "string" && LEADING_SECTION_NUMBER.test(heading)) {
      ctx.addIssue({ code: "custom", message: "Headings never lead with a section number", path });
    }
  }
}

/** Run `checkLanding` whenever the value is an object, even after other issues. */
const LANDING_RULES_WHEN = { when: (payload: { value: unknown }) => isRecord(payload.value) };

/** CTA targets found in an unparsed or partly parsed spec, in a fixed order. */
function collectCtas(spec: unknown): { target: string; path: IssuePath }[] {
  const links = valueAt(spec, ["nav", "links"]);
  const paths: IssuePath[] = [
    ["nav", "cta", "target"],
    ...(Array.isArray(links) ? links.map((_, index): IssuePath => ["nav", "links", index, "target"]) : []),
    ["hero", "primaryCta", "target"],
    ["footer", "cta", "target"],
    ["hero", "secondaryCta", "target"],
    ["app_preview", "cta", "target"],
  ];
  return paths.flatMap((path) => {
    const target = valueAt(spec, path);
    return typeof target === "string" ? [{ target, path }] : [];
  });
}

/** A section's layout variant; `checkLandingAgainstBrandKit` checks it against the kit's direction. */
const layoutSchema = <S extends LandingSectionKey>(section: S) => z.enum(SECTION_LAYOUTS[section]);

const titledItemSchema = z
  .object({
    title: line(LIMITS.landingSpec.itemTitle),
    body: body(LIMITS.landingSpec.itemBody),
  })
  .strict();

const heroSchema = z
  .object({
    layout: layoutSchema("hero"),
    headline: emphasisTextSchema(LIMITS.landingSpec.headline),
    subhead: line(LIMITS.landingSpec.subhead),
    primaryCta: ctaSchema,
    secondaryCta: ctaSchema.optional(),
    reassurance: line(LIMITS.landingSpec.reassurance).optional(),
    image: imageSchema,
    productMoment: z
      .object({
        title: line(LIMITS.brandKit.productMomentTitle),
        body: line(LIMITS.brandKit.productMomentBody),
        caption: line(LIMITS.landingSpec.momentCaption),
      })
      .strict()
      .optional(),
  })
  .strict();

/** Drawn as a list, a split or feature rows; never as a grid of same-size icon cards. */
const promisesSchema = z
  .object({
    layout: layoutSchema("promises"),
    items: list(
      titledItemSchema
        .extend({
          icon: z.enum(LANDING_ICONS).optional(),
        })
        .strict(),
      3,
      3,
    ),
  })
  .strict();

const howItWorksSchema = z
  .object({
    layout: layoutSchema("how_it_works"),
    heading: line(LIMITS.landingSpec.heading),
    steps: list(titledItemSchema, 3, 3),
  })
  .strict();

const appPreviewSchema = z
  .object({
    ...addedFields,
    layout: layoutSchema("app_preview"),
    heading: line(LIMITS.landingSpec.heading),
    body: body(LIMITS.landingSpec.sectionBody),
    cta: ctaSchema,
    /** The phone-screen mock; `alt` is its accessible label. */
    screen: imageSchema,
  })
  .strict();

/** Must mention confirming: the platform runs double opt-in before anyone is on the list. */
const successMessageSchema = line(
  LIMITS.landingSpec.successMessage,
  "Shown after sign-up; must ask the visitor to confirm their email; may use {email}",
)
  .refine((value) => onlyMergeTags(value, ["{email}"]), "successMessage may only use the {email} merge tag")
  .refine((value) => /confirm/i.test(value), "successMessage must ask the visitor to confirm their email");

const waitlistSchema = z
  .object({
    ...addedFields,
    layout: layoutSchema("waitlist"),
    heading: line(LIMITS.landingSpec.heading),
    body: body(LIMITS.landingSpec.sectionBody),
    emailLabel: line(LIMITS.landingSpec.emailLabel),
    buttonLabel: line(LIMITS.common.ctaLabel),
    successMessage: successMessageSchema,
  })
  .strict();

const footerSchema = z
  .object({
    layout: layoutSchema("footer"),
    closingLine: line(LIMITS.landingSpec.closingLine),
    cta: ctaSchema,
    copyrightName: line(LIMITS.landingSpec.copyrightName, 'The name after "©"'),
  })
  .strict();

const bracketed = (max: number, about: string) =>
  line(max, `${about}; a bracketed placeholder such as [Name, trail]`).regex(
    /^\[.+\]$/,
    "Proof text must be a bracketed placeholder such as [Quote from a beta user]",
  );

/**
 * "Replace with real proof" slots. Never rendered on a published site in v1:
 * they live only in the workspace, every one a bracketed placeholder.
 */
export const proofSlotSchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("testimonial"),
      placeholder: z.literal(true),
      quote: bracketed(LIMITS.landingSpec.proofQuote, "Quote"),
      attribution: bracketed(LIMITS.landingSpec.proofAttribution, "Attribution"),
    })
    .strict(),
  z
    .object({
      kind: z.literal("stat"),
      placeholder: z.literal(true),
      value: bracketed(LIMITS.landingSpec.proofValue, "Value"),
      label: line(LIMITS.landingSpec.proofLabel),
    })
    .strict(),
  z
    .object({
      kind: z.literal("rating"),
      placeholder: z.literal(true),
      value: bracketed(LIMITS.landingSpec.proofValue, "Rating"),
      label: line(LIMITS.landingSpec.proofLabel),
    })
    .strict(),
  z
    .object({
      kind: z.literal("logo"),
      placeholder: z.literal(true),
      name: bracketed(LIMITS.landingSpec.proofName, "Company"),
      alt: line(LIMITS.common.alt, "Alt text"),
    })
    .strict(),
  z
    .object({
      kind: z.literal("press"),
      placeholder: z.literal(true),
      outlet: bracketed(LIMITS.landingSpec.proofName, "Outlet"),
      quote: bracketed(LIMITS.landingSpec.proofQuote, "Quote").optional(),
    })
    .strict(),
]);
export type ProofSlot = z.infer<typeof proofSlotSchema>;

/**
 * What the crew drafts: the landing spec without `proofSlots`. The five-way
 * proof-slot union does not compile as a structured-output grammar ("The
 * compiled grammar is too large", WP69-S4 live probe, 2026-11-05), and the
 * slots are fixed workspace placeholders, so code adds them
 * (`withDefaultProofSlots`) instead of the model.
 */
const landingDraftObject = z
  .object({
    schemaVersion: z.literal(1),
    nav: z
      .object({
        brandName: line(LIMITS.landingSpec.brandName),
        links: list(ctaSchema, 0, LIMITS.landingSpec.navLinksMax),
        cta: ctaSchema,
      })
      .strict(),
    hero: heroSchema,
    promises: promisesSchema.optional(),
    how_it_works: howItWorksSchema.optional(),
    app_preview: appPreviewSchema.optional(),
    waitlist: waitlistSchema,
    footer: footerSchema,
  })
  .strict();

/** The model-facing landing spec (structured output); a valid draft is also a valid `LandingSpec`. */
export const landingSpecDraftSchema = landingDraftObject.superRefine(checkLanding, LANDING_RULES_WHEN);
export type LandingSpecDraft = z.infer<typeof landingSpecDraftSchema>;

/** The stored landing spec: the draft plus the workspace-only proof slots. */
export const landingSpecSchema = landingDraftObject
  .extend({
    proofSlots: list(proofSlotSchema, 0, LIMITS.landingSpec.proofSlotsMax, "Workspace-only placeholders").optional(),
  })
  .strict()
  .superRefine(checkLanding, LANDING_RULES_WHEN);
export type LandingSpec = z.infer<typeof landingSpecSchema>;

/** The workspace's "replace with real proof" slots, added by code (never drafted, never published in v1). */
export const DEFAULT_PROOF_SLOTS: readonly ProofSlot[] = [
  { kind: "testimonial", placeholder: true, quote: "[Quote from an early user]", attribution: "[Name, role]" },
  { kind: "stat", placeholder: true, value: "[N]", label: "people on the waitlist" },
  { kind: "logo", placeholder: true, name: "[Partner or community name]", alt: "[Partner or community] logo" },
];

const copySlots = (slots: readonly ProofSlot[]): ProofSlot[] => slots.map((slot) => ({ ...slot }));

/**
 * A drafted landing spec as stored: the draft (parsed, never trusted) plus a
 * fresh copy of the default proof slots. Throws a ZodError on an invalid draft.
 */
export function withDefaultProofSlots(draft: unknown): LandingSpec {
  return landingSpecSchema.parse({ ...landingSpecDraftSchema.parse(draft), proofSlots: copySlots(DEFAULT_PROOF_SLOTS) });
}

/** The sections present in a spec, in render order. */
export function landingSections(spec: Partial<Record<LandingSectionKey, unknown>>): LandingSectionKey[] {
  return LANDING_SECTION_ORDER.filter((key) => spec[key] !== undefined);
}

/** True when the spec (parsed or not) has a waitlist. Every parsed spec does. */
export function landingHasWaitlist(spec: { waitlist?: unknown }): boolean {
  return spec.waitlist !== undefined;
}

/** Every CTA target in a spec with its path, for anchor checks and link graders. */
export function landingCtas(spec: LandingSpecDraft): { target: string; path: (string | number)[] }[] {
  return collectCtas(spec);
}

export type CrossArtifactIssue = { path: (string | number)[]; message: string };

/**
 * Cross-artifact check: one issue per present section whose `layout` the brand
 * kit's art direction does not allow (`DIRECTION_LAYOUTS`). Pure. It cannot
 * live in the landing schema, which has no kit: WP75 S4 runs it after each
 * LandingSpec generation, and any issue triggers the single repair call.
 */
export function checkLandingAgainstBrandKit(
  spec: LandingSpec | LandingSpecDraft,
  kit: BrandKit,
): readonly CrossArtifactIssue[] {
  const { direction } = kit.visualSystem;
  const allowedFor = DIRECTION_LAYOUTS[direction];
  const layouts: Record<LandingSectionKey, string | undefined> = {
    hero: spec.hero.layout,
    promises: spec.promises?.layout,
    how_it_works: spec.how_it_works?.layout,
    app_preview: spec.app_preview?.layout,
    waitlist: spec.waitlist.layout,
    footer: spec.footer.layout,
  };
  const issues: CrossArtifactIssue[] = [];
  for (const section of LANDING_SECTION_ORDER) {
    const layout = layouts[section];
    if (layout === undefined) continue;
    const allowed: readonly string[] = allowedFor[section];
    if (!allowed.includes(layout)) {
      issues.push({
        path: [section, "layout"],
        message: `The ${direction} direction does not allow the ${layout} ${section} layout (${allowed.join(", ")})`,
      });
    }
  }
  return issues;
}

// ---------------------------------------------------------------------------
// EmailSequence — read by the email sender and the approval UI. The platform
// owns the sender address, reply forwarding and the double opt-in
// confirmation email; `delayHours` counts from the confirmation (the welcome
// email goes out as soon as someone confirms). CTA targets are resolved by the
// platform, so bodies carry no URLs.
// ---------------------------------------------------------------------------

export const EMAIL_KINDS = ["welcome", "value", "offer", "follow_up"] as const;
export type EmailKind = (typeof EMAIL_KINDS)[number];

/** The only merge tag crew emails may use. */
export const EMAIL_MERGE_TAGS = ["{first name}"] as const;

/** What `{first name}` renders as when the subscriber gave no first name ("Hi there,"). */
export const FIRST_NAME_FALLBACK = "there";

/** Where an email CTA goes; the platform resolves each to a URL. */
export const EMAIL_CTA_TARGETS = ["site", "waitlist", "reply"] as const;

const URL_LIKE = /(https?:\/\/|www\.|mailto:|\b[a-z0-9-]+\.(com|net|org|io|app|co|dev|ai|xyz|me|so|ly|link)\b)/i;

const mergeTagsOnly = (value: string) => onlyMergeTags(value, EMAIL_MERGE_TAGS);
const MERGE_TAG_MESSAGE = "Only the {first name} merge tag is allowed";

const emailFields = {
  subject: line(LIMITS.emailSequence.subject, "May use {first name}").refine(mergeTagsOnly, MERGE_TAG_MESSAGE),
  preview: line(LIMITS.emailSequence.preview, "May use {first name}").refine(mergeTagsOnly, MERGE_TAG_MESSAGE),
  body: body(LIMITS.emailSequence.body, "Plain text; may use {first name}; no URLs")
    .refine(mergeTagsOnly, MERGE_TAG_MESSAGE)
    .refine((value) => !URL_LIKE.test(value), "Email bodies carry no URLs; use cta instead"),
  cta: z
    .object({
      label: line(LIMITS.common.ctaLabel),
      target: z.enum(EMAIL_CTA_TARGETS),
    })
    .strict()
    .optional(),
  /** The metric label shown beside the email, e.g. "Reply rate". */
  goal: line(LIMITS.emailSequence.goal, 'Metric label, e.g. "Reply rate"'),
};

const delayedEmailSchema = z
  .object({
    ...emailFields,
    delayHours: integer(1, LIMITS.emailSequence.maxDelayHours, "Hours after the previous email"),
  })
  .strict();

export const emailSequenceSchema = z
  .object({
    schemaVersion: z.literal(1),
    name: line(LIMITS.emailSequence.name),
    trigger: z.literal("waitlist_join"),
    senderName: line(LIMITS.emailSequence.senderName, 'e.g. "John at HydroTrail"'),
    emails: z
      .object({
        welcome: z
          .object({
            ...emailFields,
            delayHours: z.literal(0).meta(describe("sent as soon as the subscriber confirms")),
          })
          .strict(),
        value: delayedEmailSchema,
        offer: delayedEmailSchema,
        follow_up: delayedEmailSchema,
      })
      .strict(),
  })
  .strict();
export type EmailSequence = z.infer<typeof emailSequenceSchema>;
export type Email = EmailSequence["emails"][EmailKind];

/** The four emails in send order. */
export function emailsInOrder(sequence: EmailSequence): { kind: EmailKind; email: Email }[] {
  return EMAIL_KINDS.map((kind) => ({ kind, email: sequence.emails[kind] }));
}

// ---------------------------------------------------------------------------
// SocialPack — read by the social queue (`social_posts` holds state) and the
// image-card generator. One post per day, Friday (launch) to Thursday.
// ---------------------------------------------------------------------------

export const SOCIAL_DAYS = ["fri", "sat", "sun", "mon", "tue", "wed", "thu"] as const;
export type SocialDay = (typeof SOCIAL_DAYS)[number];
export const SOCIAL_POST_KINDS = ["launch", "value", "offer", "product", "story", "community"] as const;
export const SOCIAL_POST_FORMATS = ["image", "carousel", "reel_script", "poll"] as const;
export type SocialPostFormat = (typeof SOCIAL_POST_FORMATS)[number];

/** Formats that render a card image and so need alt text. */
export const SOCIAL_IMAGE_FORMATS: readonly SocialPostFormat[] = ["image", "carousel"];

export const SOCIAL_PLATFORMS = [
  "instagram",
  "facebook",
  "tiktok",
  "x",
  "youtube",
  "linkedin",
  "threads",
  "pinterest",
] as const;
export type SocialPlatform = (typeof SOCIAL_PLATFORMS)[number];

/**
 * Caption limits in characters for the 8 canvas platforms. Approximate and
 * unverified against each platform today; the eval grader holds the exact
 * rules (X weights URLs and emoji). Every limit is ≥ `shortCaption`'s 280.
 */
export const PLATFORM_CAPTION_LIMITS = {
  instagram: 2200,
  facebook: 63206,
  tiktok: 2200,
  x: 280,
  youtube: 5000,
  linkedin: 3000,
  threads: 500,
  pinterest: 500,
} as const satisfies Record<SocialPlatform, number>;

/** Unicode letters, numbers and underscore; enforced after parse (`\p{…}` is not a structured-output pattern). */
const HASHTAG = /^[\p{L}\p{N}_]+$/u;

export const socialPostSchema = z
  .object({
    kind: z.enum(SOCIAL_POST_KINDS),
    format: z.enum(SOCIAL_POST_FORMATS),
    hook: line(LIMITS.socialPack.hook),
    caption: body(LIMITS.socialPack.caption, "Full caption"),
    shortCaption: body(LIMITS.socialPack.shortCaption, "Used where the full caption is too long"),
    imageText: line(LIMITS.socialPack.imageText, 'The 2–3 word card text, e.g. "500 ml / hr"'),
    imageAlt: line(LIMITS.common.alt, "Required for image and carousel posts; leave the field out for other formats, never empty").optional(),
    pollOptions: list(
      line(LIMITS.socialPack.pollOption),
      LIMITS.socialPack.pollOptionsMin,
      LIMITS.socialPack.pollOptionsMax,
      "Required iff format is poll",
    ).optional(),
    hashtags: list(
      z
        .string()
        .min(1)
        .max(LIMITS.socialPack.hashtag)
        .refine((value) => HASHTAG.test(value), "Hashtags are letters, numbers and _ only, stored without #")
        .meta(describe(`letters, numbers and _ only, no #, ≤ ${LIMITS.socialPack.hashtag} characters`)),
      0,
      LIMITS.socialPack.hashtagsMax,
    ),
  })
  .strict()
  .superRefine((post, ctx) => {
    if (post.format === "poll" && post.pollOptions === undefined) {
      ctx.addIssue({ code: "custom", message: "A poll needs pollOptions", path: ["pollOptions"] });
    }
    if (post.format !== "poll" && post.pollOptions !== undefined) {
      ctx.addIssue({ code: "custom", message: "pollOptions are only valid on polls", path: ["pollOptions"] });
    }
    if (SOCIAL_IMAGE_FORMATS.includes(post.format) && post.imageAlt === undefined) {
      ctx.addIssue({ code: "custom", message: "An image post needs imageAlt", path: ["imageAlt"] });
    }
    flagDuplicates(
      post.hashtags.map((tag) => tag.toLowerCase()),
      ctx,
      (index) => ["hashtags", index],
      "hashtag",
    );
  });
export type SocialPost = z.infer<typeof socialPostSchema>;

export const socialPackSchema = z
  .object({
    schemaVersion: z.literal(1),
    posts: z
      .object({
        fri: socialPostSchema.meta(describe("launch day")),
        sat: socialPostSchema,
        sun: socialPostSchema,
        mon: socialPostSchema,
        tue: socialPostSchema,
        wed: socialPostSchema,
        thu: socialPostSchema,
      })
      .strict(),
  })
  .strict();
export type SocialPack = z.infer<typeof socialPackSchema>;

/** The caption for a platform: the full one when it fits, else the short one. Counts code points. */
export function captionFor(post: Pick<SocialPost, "caption" | "shortCaption">, platform: SocialPlatform): string {
  return [...post.caption].length <= PLATFORM_CAPTION_LIMITS[platform] ? post.caption : post.shortCaption;
}

/** The seven posts, Friday to Thursday. */
export function socialPostsInOrder(pack: SocialPack): { day: SocialDay; post: SocialPost }[] {
  return SOCIAL_DAYS.map((day) => ({ day, post: pack.posts[day] }));
}

// ---------------------------------------------------------------------------
// SeoPack — read by the tenant site renderer (head tags) and the article page.
// Keywords are strings only: no model produces volume, CPC or competition.
// ---------------------------------------------------------------------------

export const seoPageSchema = z
  .object({
    path: sitePathSchema,
    title: line(LIMITS.seoPack.title),
    metaDescription: line(LIMITS.seoPack.metaDescription),
  })
  .strict();

export const seoPackSchema = z
  .object({
    schemaVersion: z.literal(1),
    pages: list(seoPageSchema, 1, LIMITS.seoPack.pagesMax),
    keywordsTargeted: list(
      line(LIMITS.seoPack.keyword),
      LIMITS.seoPack.keywordsMin,
      LIMITS.seoPack.keywordsMax,
      "Phrases only; no volume, CPC or competition",
    ),
    article: z
      .object({
        title: line(LIMITS.seoPack.articleTitle),
        slug: slugSchema,
        outline: list(line(LIMITS.seoPack.outlineItem), LIMITS.seoPack.outlineMin, LIMITS.seoPack.outlineMax),
        bodyMarkdown: markdownBody(LIMITS.seoPack.bodyMarkdown, "Article body"),
      })
      .strict(),
  })
  .strict()
  .superRefine((pack, ctx) => {
    flagDuplicates(
      pack.pages.map((page) => page.path),
      ctx,
      (index) => ["pages", index, "path"],
      "page path",
    );
    flagDuplicates(
      pack.keywordsTargeted.map((keyword) => keyword.toLowerCase()),
      ctx,
      (index) => ["keywordsTargeted", index],
      "keyword",
    );
  });
export type SeoPack = z.infer<typeof seoPackSchema>;

// ---------------------------------------------------------------------------
// LaunchPlan — read by the launch board. Item status lives in
// `launch_plan_items`, not here. That an employee owner's `roleKey` was hired
// is checked by the gateway, which has the roster plan.
// ---------------------------------------------------------------------------

export const LAUNCH_DAYS = ["thu", "fri", "sat", "sun", "mon"] as const;
export const WORKSPACE_PAGES = ["studio", "library", "files", "settings"] as const;

export const launchOwnerSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("employee"), roleKey: roleKeySchema }).strict(),
  z
    .object({
      kind: z.literal("founder"),
      /** The employee who drafted what the founder sends or does. */
      draftedBy: roleKeySchema.optional(),
    })
    .strict(),
]);

export const launchLinkSchema = z.union([
  z.object({ artifactKind: artifactKindSchema }).strict(),
  /** A page on the founder's published site. */
  z.object({ sitePath: sitePathSchema }).strict(),
  /** A page in the workspace. */
  z.object({ workspace: z.enum(WORKSPACE_PAGES) }).strict(),
]);

export const launchPlanItemSchema = z
  .object({
    key: keySchema,
    day: z.enum(LAUNCH_DAYS),
    order: integer(0, LIMITS.launchPlan.maxOrder, "Position within the day"),
    title: line(LIMITS.launchPlan.title),
    detail: line(LIMITS.launchPlan.detail),
    owner: launchOwnerSchema,
    link: launchLinkSchema.optional(),
  })
  .strict();
export type LaunchPlanItem = z.infer<typeof launchPlanItemSchema>;

export const launchPlanSchema = z
  .object({
    schemaVersion: z.literal(1),
    items: list(launchPlanItemSchema, LIMITS.launchPlan.itemsMin, LIMITS.launchPlan.itemsMax),
  })
  .strict()
  .superRefine((plan, ctx) => {
    flagDuplicates(
      plan.items.map((item) => item.key),
      ctx,
      (index) => ["items", index, "key"],
      "item key",
    );
    flagDuplicates(
      plan.items.map((item) => `${item.day}:${item.order}`),
      ctx,
      (index) => ["items", index, "order"],
      "day and order",
    );
  });
export type LaunchPlan = z.infer<typeof launchPlanSchema>;

// ---------------------------------------------------------------------------
// AdsDrafts — read by the ads review screen and the Meta connector. The
// founder's own ad account pays (D8); nothing here moves money. Readiness
// checks are computed by code, not stored.
//
// `dailyBudgetCents` and `lifetimeCapCents` are platform-set (from
// `paidPush.dailyBudgetUsd` × the learning window): the gateway overwrites
// whatever the model returns. The destination URL and image asset are
// platform-supplied too. Unverified: Meta's minimum spend cap may reject a
// $98 cap; the ads connector work package checks it.
// ---------------------------------------------------------------------------

export const AD_PLATFORMS = ["facebook", "instagram"] as const;
export const AD_OBJECTIVES = ["waitlist_signups", "traffic", "sales"] as const;

export const adsDraftsSchema = z
  .object({
    schemaVersion: z.literal(1),
    campaign: z
      .object({
        name: line(LIMITS.adsDrafts.campaignName),
        platforms: list(z.enum(AD_PLATFORMS), 1, AD_PLATFORMS.length),
        objective: z.enum(AD_OBJECTIVES),
        audience: z
          .object({
            description: body(LIMITS.adsDrafts.audienceDescription, "Interests and who to reach"),
            ageMin: integer(LIMITS.adsDrafts.ageMin, LIMITS.adsDrafts.ageMax),
            ageMax: integer(LIMITS.adsDrafts.ageMin, LIMITS.adsDrafts.ageMax, "65 means 65+"),
            locationNote: line(LIMITS.adsDrafts.locationNote),
          })
          .strict(),
        currency: z.literal("USD"),
        dailyBudgetCents: integer(
          LIMITS.adsDrafts.dailyBudgetCentsMin,
          LIMITS.adsDrafts.dailyBudgetCentsMax,
          "Platform-set; overwritten by the gateway",
        ),
        learningWindowDays: integer(LIMITS.adsDrafts.learningWindowDaysMin, LIMITS.adsDrafts.learningWindowDaysMax),
        lifetimeCapCents: z
          .number()
          .int()
          .min(LIMITS.adsDrafts.dailyBudgetCentsMin)
          .meta(describe("integer; platform-set; ≤ dailyBudgetCents × learningWindowDays")),
      })
      .strict(),
    creatives: list(
      z
        .object({
          headline: line(LIMITS.adsDrafts.headline),
          primaryText: body(LIMITS.adsDrafts.primaryText),
          ctaLabel: line(LIMITS.common.ctaLabel),
          imageAlt: line(LIMITS.common.alt, "Alt text for the platform-supplied image"),
        })
        .strict(),
      LIMITS.adsDrafts.creativesMin,
      LIMITS.adsDrafts.creativesMax,
    ),
    decisionLog: list(
      z
        .object({
          decision: line(LIMITS.adsDrafts.decision),
          why: body(LIMITS.adsDrafts.why),
        })
        .strict(),
      LIMITS.adsDrafts.decisionLogMin,
      LIMITS.adsDrafts.decisionLogMax,
    ),
  })
  .strict()
  .superRefine((drafts, ctx) => {
    const { campaign } = drafts;
    flagDuplicates(campaign.platforms, ctx, (index) => ["campaign", "platforms", index], "platform");
    if (campaign.audience.ageMin > campaign.audience.ageMax) {
      ctx.addIssue({ code: "custom", message: "ageMin must not exceed ageMax", path: ["campaign", "audience", "ageMin"] });
    }
    if (campaign.lifetimeCapCents > campaign.dailyBudgetCents * campaign.learningWindowDays) {
      ctx.addIssue({
        code: "custom",
        message: "lifetimeCapCents must not exceed dailyBudgetCents × learningWindowDays",
        path: ["campaign", "lifetimeCapCents"],
      });
    }
    if (campaign.lifetimeCapCents < campaign.dailyBudgetCents) {
      ctx.addIssue({
        code: "custom",
        message: "lifetimeCapCents must cover at least one day",
        path: ["campaign", "lifetimeCapCents"],
      });
    }
  });
export type AdsDrafts = z.infer<typeof adsDraftsSchema>;

// ---------------------------------------------------------------------------
// BuildPack — read by the Engineering workspace, PRODUCT_PROMPTS.md and the
// prompt copier. Prompt bodies are plain text, copied verbatim.
//
// Build-pack variant of weekend prompt standard v1 (`ideas/SECTIONS.md`),
// graded after parse (`scripts/lib/prompt-standard.mjs` rules):
// - Every one of the 8 prompts: a `Do not build:` line, a `Done when:` line,
//   no billing, one login, no pinned Next.js major, no code fence.
// - `scaffold.first` is the Project Setup prompt: 8+ lines, a `Stack:` line
//   (framework, database, one login, hosting), 3+ `- name(columns)` tables, a
//   `Screens:` line (three at most) and an `Env vars (names only):` line.
// - At most three outside services across the pack, counted by
//   `stack[].outsideService`: hosting does not count, Supabase counts as one
//   (database and its login together), and an email provider used for magic
//   links counts.
// - The light pack (course ideas) is checkout and course-hosting setup, so it
//   is exempt from "no billing" and graded on its own rules (Do not build,
//   Done when, ≤ 3 outside services).
// ---------------------------------------------------------------------------

export const BUILD_PHASES = [
  { key: "discovery", n: 1, when: "fri_night" },
  { key: "scaffold", n: 2, when: "sat_morning" },
  { key: "core_loops", n: 3, when: "sat_afternoon" },
  { key: "ship", n: 4, when: "sunday" },
] as const;
export type BuildPhaseKey = (typeof BUILD_PHASES)[number]["key"];
export type BuildPhaseWhen = (typeof BUILD_PHASES)[number]["when"];
const PROMPT_SLOTS = ["first", "second"] as const;

export const buildPromptSchema = z
  .object({
    title: line(LIMITS.buildPack.promptTitle),
    timeMinutes: integer(LIMITS.buildPack.timeMinutesMin, LIMITS.buildPack.timeMinutesMax),
    body: body(LIMITS.buildPack.promptBody, "Plain text, copied verbatim; not markdown"),
    doNotBuild: line(LIMITS.buildPack.doNotBuild, "The Do not build: line, without the label"),
    doneWhen: line(LIMITS.buildPack.doneWhen, "The Done when: line, without the label"),
  })
  .strict();
export type BuildPrompt = z.infer<typeof buildPromptSchema>;

export const buildPhaseSchema = z
  .object({
    blurb: line(LIMITS.buildPack.phaseBlurb),
    prompts: z.object({ first: buildPromptSchema, second: buildPromptSchema }).strict(),
  })
  .strict();
export type BuildPhase = z.infer<typeof buildPhaseSchema>;

export const stackItemSchema = z
  .object({
    label: line(LIMITS.buildPack.stackLabel),
    value: line(LIMITS.buildPack.stackValue),
    outsideService: z
      .boolean()
      .meta(describe("true for a third-party service; hosting is false, Supabase is one, a magic-link email provider counts")),
  })
  .strict();

const stackSchema = list(stackItemSchema, LIMITS.buildPack.stackMin, LIMITS.buildPack.stackMax).refine(
  (stack) => stack.filter((item) => item.outsideService).length <= LIMITS.buildPack.outsideServicesMax,
  `At most ${LIMITS.buildPack.outsideServicesMax} outside services`,
);

const fullBuildPackSchema = z
  .object({
    schemaVersion: z.literal(1),
    weight: z.literal("full"),
    phases: z
      .object({
        discovery: buildPhaseSchema.meta(describe("Friday night")),
        scaffold: buildPhaseSchema.meta(describe("Saturday morning; prompts.first is the Project Setup prompt")),
        core_loops: buildPhaseSchema.meta(describe("Saturday afternoon")),
        ship: buildPhaseSchema.meta(describe("Sunday")),
      })
      .strict(),
    stack: stackSchema,
    productMd: markdownBody(LIMITS.buildPack.productMd, "The PRODUCT.md slice"),
  })
  .strict();

/** Light packs (course ideas): checkout and hosting setup only, no product build. */
const lightBuildPackSchema = z
  .object({
    schemaVersion: z.literal(1),
    weight: z.literal("light"),
    setupPrompts: list(buildPromptSchema, LIMITS.buildPack.lightPromptsMin, LIMITS.buildPack.lightPromptsMax),
    stack: stackSchema,
    productMd: markdownBody(LIMITS.buildPack.productMd, "The PRODUCT.md slice").optional(),
  })
  .strict();

/** One schema per weight, for a gateway that asks for a known variant. */
export const buildPackVariantSchemas = {
  full: fullBuildPackSchema,
  light: lightBuildPackSchema,
} as const;

export const buildPackSchema = z.discriminatedUnion("weight", [fullBuildPackSchema, lightBuildPackSchema]);
export type BuildPack = z.infer<typeof buildPackSchema>;

export type NumberedBuildPrompt = BuildPrompt & {
  /** 1–8 for full packs, 1–3 for light packs. */
  n: number;
  phase: { key: BuildPhaseKey; n: number; when: BuildPhaseWhen } | null;
};

/** Every prompt in a pack, numbered in order (full packs flatten to 8). */
export function buildPackPrompts(pack: BuildPack): NumberedBuildPrompt[] {
  if (pack.weight === "light") {
    return pack.setupPrompts.map((prompt, index) => ({ ...prompt, n: index + 1, phase: null }));
  }
  return BUILD_PHASES.flatMap((phase, phaseIndex) =>
    PROMPT_SLOTS.map((slot, slotIndex) => ({
      ...pack.phases[phase.key].prompts[slot],
      n: phaseIndex * PROMPT_SLOTS.length + slotIndex + 1,
      phase: { key: phase.key, n: phase.n, when: phase.when },
    })),
  );
}

/** The copied prompt text (the UI prefixes its tool line). */
export function promptCopyText(prompt: BuildPrompt): string {
  return `${prompt.body}\n\nDo not build: ${prompt.doNotBuild}\nDone when: ${prompt.doneWhen}`;
}

// ---------------------------------------------------------------------------
// Registry.
// ---------------------------------------------------------------------------

export type ArtifactByKind = {
  blueprint: Blueprint;
  roster_plan: RosterPlan;
  brand_kit: BrandKit;
  landing_spec: LandingSpec;
  email_sequence: EmailSequence;
  social_pack: SocialPack;
  seo_pack: SeoPack;
  launch_plan: LaunchPlan;
  ads_drafts: AdsDrafts;
  build_pack: BuildPack;
};
export type Artifact = ArtifactByKind[ArtifactKind];

export const artifactSchemas: { readonly [K in ArtifactKind]: z.ZodType<ArtifactByKind[K]> } = {
  blueprint: blueprintSchema,
  roster_plan: rosterPlanSchema,
  brand_kit: brandKitSchema,
  landing_spec: landingSpecSchema,
  email_sequence: emailSequenceSchema,
  social_pack: socialPackSchema,
  seo_pack: seoPackSchema,
  launch_plan: launchPlanSchema,
  ads_drafts: adsDraftsSchema,
  build_pack: buildPackSchema,
};

/** Validates `value` as the artifact `kind`; returns zod's safeParse result. */
export function parseArtifact<K extends ArtifactKind>(
  kind: K,
  value: unknown,
): z.ZodSafeParseResult<ArtifactByKind[K]> {
  const schema: z.ZodType<ArtifactByKind[K]> = artifactSchemas[kind];
  return schema.safeParse(value);
}

// ---------------------------------------------------------------------------
// JSON Schema for structured outputs.
// ---------------------------------------------------------------------------

export type JsonSchema = { [key: string]: JsonValue };
type JsonValue = string | number | boolean | null | JsonValue[] | JsonSchema;

/**
 * Keywords structured outputs do not honour; a request using them is rejected.
 * The zod schema still enforces them after parse, and descriptions carry them.
 */
export const STRUCTURED_OUTPUT_DROPPED_KEYWORDS = [
  "$schema",
  "minLength",
  "maxLength",
  "minimum",
  "maximum",
  "exclusiveMinimum",
  "exclusiveMaximum",
  "multipleOf",
  "maxItems",
] as const;

const DROPPED = new Set<string>(STRUCTURED_OUTPUT_DROPPED_KEYWORDS);

function isJsonSchema(value: JsonValue): value is JsonSchema {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function rewriteForStructuredOutput(value: JsonValue): JsonValue {
  if (Array.isArray(value)) return value.map(rewriteForStructuredOutput);
  if (!isJsonSchema(value)) return value;
  const out: JsonSchema = {};
  for (const [key, child] of Object.entries(value)) {
    if (DROPPED.has(key)) continue;
    if (key === "minItems" && typeof child === "number") {
      out.minItems = Math.min(child, 1);
      continue;
    }
    out[key === "oneOf" ? "anyOf" : key] = rewriteForStructuredOutput(child);
  }
  return out;
}

/**
 * A zod schema as a structured-output JSON Schema: `oneOf` becomes `anyOf`,
 * `minItems` is clamped to 0 or 1, and unhonoured keywords are dropped. Pure.
 *
 * A subschema used more than once becomes one `$defs` entry referenced by
 * `$ref` (supported by structured outputs). Inlined, the seven SocialPack
 * posts compile to a grammar the API rejects as too large; referenced, they
 * compile (WP69-S4 live probe, 2026-11-05).
 */
export function toStructuredOutputSchema(schema: z.ZodType): JsonSchema {
  const converted: JsonValue = JSON.parse(JSON.stringify(z.toJSONSchema(schema, { reused: "ref" })));
  // A root union is never sent: the API rejects `$defs` beside a root `anyOf`, and
  // the combined BuildPack is too large inlined. Ask for one variant instead.
  if (!isJsonSchema(converted) || converted.type !== "object") {
    throw new TypeError("Structured output needs a single object schema; pass one variant of a union");
  }
  const rewritten = rewriteForStructuredOutput(converted);
  if (!isJsonSchema(rewritten)) throw new TypeError("Expected an object JSON Schema");
  return rewritten;
}

/**
 * What the model is asked to produce per kind. The same as `artifactSchemas`
 * except LandingSpec, whose model-facing shape omits the code-added proof slots.
 * Every valid draft also passes `parseArtifact`.
 */
export const artifactOutputSchemas: { readonly [K in ArtifactKind]: z.ZodType<ArtifactByKind[K]> } = {
  ...artifactSchemas,
  landing_spec: landingSpecDraftSchema,
};

/**
 * The single entry point for model output: parses `raw` with the model-facing
 * schema, adds what code owns (LandingSpec proof slots: the stored ones from
 * `existing` when set, so a revision never overwrites them, else the defaults),
 * then validates the stored shape with `parseArtifact`.
 */
export function parseModelOutput<K extends ArtifactKind>(
  kind: K,
  raw: unknown,
  existing?: ArtifactByKind[K] | null,
): z.ZodSafeParseResult<ArtifactByKind[K]> {
  const schema: z.ZodType<ArtifactByKind[K]> = artifactOutputSchemas[kind];
  const drafted = schema.safeParse(raw);
  if (!drafted.success || kind !== "landing_spec") return drafted.success ? parseArtifact(kind, drafted.data) : drafted;
  const stored = landingSpecSchema.safeParse(existing ?? undefined);
  const slots = stored.success && stored.data.proofSlots !== undefined ? stored.data.proofSlots : DEFAULT_PROOF_SLOTS;
  return parseArtifact(kind, { ...drafted.data, proofSlots: copySlots(slots) });
}

/** Kinds whose stored schema is a union; the model is always asked for one variant. */
export const UNION_ARTIFACT_KINDS = ["blueprint", "build_pack"] as const;
export type UnionArtifactKind = (typeof UNION_ARTIFACT_KINDS)[number];
export type ObjectArtifactKind = Exclude<ArtifactKind, UnionArtifactKind>;
export const OBJECT_ARTIFACT_KINDS: readonly ObjectArtifactKind[] = ARTIFACT_KINDS.filter(
  (kind): kind is ObjectArtifactKind => !(UNION_ARTIFACT_KINDS as readonly string[]).includes(kind),
);

/** The single-variant schemas of the union kinds. */
export const artifactVariantSchemas = {
  blueprint: blueprintVariantSchemas,
  build_pack: buildPackVariantSchemas,
} as const;
export type ArtifactVariant<K extends UnionArtifactKind> = keyof (typeof artifactVariantSchemas)[K];

/**
 * The structured-output JSON Schema for a kind with one object schema. Union
 * kinds have no combined schema (the combined BuildPack is rejected live as
 * too large): use `artifactVariantJsonSchema`.
 */
export function artifactJsonSchema(kind: ObjectArtifactKind): JsonSchema {
  if ((UNION_ARTIFACT_KINDS as readonly string[]).includes(kind)) {
    throw new TypeError(`${kind} is a union kind; use artifactVariantJsonSchema`);
  }
  return toStructuredOutputSchema(artifactOutputSchemas[kind]);
}

/** The structured-output JSON Schema for one variant of a union kind. */
export function artifactVariantJsonSchema<K extends UnionArtifactKind>(kind: K, variant: ArtifactVariant<K>): JsonSchema {
  const variants: Readonly<Record<PropertyKey, z.ZodType>> = artifactVariantSchemas[kind];
  const schema = variants[variant];
  if (schema === undefined) throw new TypeError(`Unknown ${kind} variant ${String(variant)}`);
  return toStructuredOutputSchema(schema);
}

/**
 * Counts against the structured-output complexity limits (24 optional
 * parameters and 16 union parameters across a request's strict schemas).
 * Conservative: a `$defs` entry counts once per `$ref` that uses it.
 */
export function structuredOutputComplexity(schema: JsonSchema): { optionalParams: number; unionParams: number } {
  let optionalParams = 0;
  let unionParams = 0;
  const defs = isJsonSchema(schema.$defs ?? null) ? (schema.$defs as JsonSchema) : {};
  const walk = (value: JsonValue, refPath: readonly string[]): void => {
    if (Array.isArray(value)) {
      value.forEach((item) => walk(item, refPath));
      return;
    }
    if (!isJsonSchema(value)) return;
    if (typeof value.$ref === "string") {
      const name = value.$ref.startsWith("#/$defs/") ? value.$ref.slice("#/$defs/".length) : null;
      const target = name === null ? undefined : defs[name];
      if (name === null || target === undefined) throw new TypeError(`Unresolvable $ref ${value.$ref}`);
      if (refPath.includes(name)) throw new RangeError(`Recursive $ref ${[...refPath, name].join(" → ")}`);
      walk(target, [...refPath, name]);
    }
    if (Array.isArray(value.anyOf) || Array.isArray(value.type)) unionParams += 1;
    const { properties, required } = value;
    if (properties !== undefined && isJsonSchema(properties)) {
      const requiredKeys = new Set(Array.isArray(required) ? required.filter((key) => typeof key === "string") : []);
      optionalParams += Object.keys(properties).filter((key) => !requiredKeys.has(key)).length;
    }
    for (const [key, child] of Object.entries(value)) if (key !== "$defs") walk(child, refPath);
  };
  walk(schema, []);
  return { optionalParams, unionParams };
}
