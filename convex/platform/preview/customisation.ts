import { ConvexError, v, type Infer } from "convex/values";
import type { Doc } from "../../_generated/dataModel";
import {
  SITE_INPUT_CONTRACT_VERSION,
  type SiteInputPayload,
} from "../engine/contracts";

/**
 * WP27-S2. The short, idea-prefilled customisation step behind
 * `/build/{slug}`.
 *
 * Field bounds mirror WP25's `briefPayload.ts` rather than inventing a
 * second validation style: normalize, enforce a per-field min/max, and
 * throw a coded `ConvexError` naming the offending field. This is an
 * anonymous write path, so every bound is enforced server-side; the client
 * form's `maxLength` is a convenience, never the control.
 */

export const previewCustomisationValidator = v.object({
  headline: v.string(),
  subheadline: v.string(),
  problemStatement: v.string(),
  keyBenefits: v.array(v.string()),
  callToAction: v.string(),
});

export type PreviewCustomisation = Infer<typeof previewCustomisationValidator>;

const LIMITS = {
  headline: [8, 120],
  subheadline: [8, 200],
  problemStatement: [20, 600],
  callToAction: [2, 40],
} as const;

/** Bounds the array itself, not just its members: an unbounded list of
 *  bounded strings is still an unbounded document. */
export const MAX_KEY_BENEFITS = 6;
const KEY_BENEFIT_LIMITS = [3, 160] as const;

function normalizeField(
  field: keyof typeof LIMITS,
  value: unknown,
): string {
  if (typeof value !== "string") {
    throw new ConvexError({ code: "INVALID_PREVIEW_FIELD", field });
  }
  const normalized = value.trim().replace(/\r\n/g, "\n");
  const [min, max] = LIMITS[field];
  if (normalized.length < min || normalized.length > max) {
    throw new ConvexError({ code: "INVALID_PREVIEW_FIELD", field, min, max });
  }
  return normalized;
}

function normalizeKeyBenefits(value: unknown): string[] {
  if (!Array.isArray(value)) {
    throw new ConvexError({
      code: "INVALID_PREVIEW_FIELD",
      field: "keyBenefits",
    });
  }
  const [min, max] = KEY_BENEFIT_LIMITS;
  const benefits = value.map((entry) => {
    if (typeof entry !== "string") {
      throw new ConvexError({
        code: "INVALID_PREVIEW_FIELD",
        field: "keyBenefits",
      });
    }
    const normalized = entry.trim().replace(/\r\n/g, "\n");
    if (normalized.length < min || normalized.length > max) {
      throw new ConvexError({
        code: "INVALID_PREVIEW_FIELD",
        field: "keyBenefits",
        min,
        max,
      });
    }
    return normalized;
  });
  // WP26-S1's site-input parser rejects an empty `keyBenefits`, so catching
  // it here yields a field-specific error instead of a generic contract
  // failure the form cannot attribute to an input.
  if (benefits.length === 0 || benefits.length > MAX_KEY_BENEFITS) {
    throw new ConvexError({
      code: "INVALID_PREVIEW_FIELD",
      field: "keyBenefits",
      max: MAX_KEY_BENEFITS,
    });
  }
  return benefits;
}

export function normalizePreviewCustomisation(
  input: unknown,
): PreviewCustomisation {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    throw new ConvexError({ code: "INVALID_PREVIEW_CUSTOMISATION" });
  }
  const record = input as Record<string, unknown>;
  return {
    headline: normalizeField("headline", record.headline),
    subheadline: normalizeField("subheadline", record.subheadline),
    problemStatement: normalizeField("problemStatement", record.problemStatement),
    keyBenefits: normalizeKeyBenefits(record.keyBenefits),
    callToAction: normalizeField("callToAction", record.callToAction),
  };
}

/**
 * Seeds the form from the canonical idea record. Deliberately derives only
 * from fields the public idea page already shows: a preview is a rendering
 * of public research plus the visitor's own words, never a leak of anything
 * the idea page does not already publish.
 */
/**
 * Fits a canonical idea field to a customisation bound.
 *
 * WP27-S6. `prefillFromIdea` seeds a *form*; it must always produce something
 * the visitor can edit, never an exception. The two contracts are independent:
 * `ideas` puts no length bounds on `title` or `description`, so any idea
 * outside WP27's window would otherwise throw straight out of the `/build`
 * render and 500 the primary call to action on that idea's page — silently,
 * until somebody clicked it.
 *
 * Not theoretical headroom: the shortest title across the 160 entries in
 * `ideas/manifest.json` is exactly 8 characters, which is the minimum. The
 * next idea published one character shorter would have broken the route.
 */
function fitToBound(value: string, [min, max]: readonly [number, number], pad: string): string {
  const trimmed = value.trim().replace(/\r\n/g, "\n");
  if (trimmed.length > max) {
    // Cut on a word boundary where one is close, so a truncated headline
    // still reads as a sentence rather than a severed word.
    const cut = trimmed.slice(0, max);
    const space = cut.lastIndexOf(" ");
    return (space > max - 20 ? cut.slice(0, space) : cut).trim();
  }
  if (trimmed.length < min) {
    return `${trimmed}${pad}`.slice(0, max).trim();
  }
  return trimmed;
}

export function prefillFromIdea(idea: Doc<"ideas">): PreviewCustomisation {
  const audience =
    idea.audiences.length > 0 ? idea.audiences.join(", ") : "early adopters";
  const benefits = [
    `Built for ${audience}`,
    `Ship a first version in about ${idea.buildTime} hours`,
  ];
  return normalizePreviewCustomisation({
    headline: fitToBound(idea.title, LIMITS.headline, " — a weekend MVP"),
    subheadline: idea.summary?.trim()
      ? idea.summary
      : `A focused first version for ${audience}.`,
    problemStatement: fitToBound(
      idea.description,
      LIMITS.problemStatement,
      " This is the recurring problem the first version solves.",
    ),
    keyBenefits: benefits,
    callToAction: "Get early access",
  });
}

/**
 * Maps the customisation onto WP26-S1's frozen `SiteInputPayload`.
 *
 * `socialProof` is deliberately empty on this path: an anonymous preview has
 * no Validation Report behind it, and the S1 contract requires every
 * social-proof entry to carry citations. Emitting an uncited claim to make
 * the page look fuller would be inventing evidence, which is exactly what
 * the citation rules exist to prevent.
 */
export function toSiteInput(
  customisation: PreviewCustomisation,
): SiteInputPayload {
  return {
    contractVersion: SITE_INPUT_CONTRACT_VERSION,
    headline: customisation.headline,
    subheadline: customisation.subheadline,
    problemStatement: customisation.problemStatement,
    keyBenefits: [...customisation.keyBenefits],
    socialProof: [],
    callToAction: { label: customisation.callToAction },
  };
}
