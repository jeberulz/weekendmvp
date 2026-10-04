import { z } from "zod";

import { EDITORIAL_LIMITS as L } from "./limits";
import { singleLineText } from "./primitives";
import {
  AUDIENCE_SLUGS,
  BUILD_TIME_VALUES,
  CATEGORY_SLUGS,
  HIGHLIGHT_LIMITS as H,
  MIN_AUDIENCES,
  MIN_TOOLS,
  REVENUE_GOAL_SLUGS,
  TOOL_SLUGS,
} from "./taxonomy";

function uniqueArray<T extends z.ZodType<string>>(item: T, min: number, max: number, label: string) {
  return z
    .array(item)
    .min(min, `Choose at least ${min} ${label}`)
    .max(max, `Choose at most ${max} ${label}`)
    .refine((values) => new Set(values).size === values.length, `Each ${label.replace(/s$/, "")} may appear once`);
}

export const highlightStatSchema = z.strictObject({
  value: singleLineText(H.statValue),
  label: singleLineText(H.statLabel),
  source: singleLineText(H.statSource).nullable(),
});

export const highlightCompetitorSchema = z.strictObject({
  name: singleLineText(H.competitorName),
  price: singleLineText(H.competitorPrice),
});

/** The homepage `highlights` block, limits identical to the tag validator. */
export const highlightsSchema = z.strictObject({
  problemQuote: singleLineText(H.problemQuote),
  stats: z.array(highlightStatSchema).min(1, "Add at least one stat").max(H.maxStats),
  competitors: z
    .array(highlightCompetitorSchema)
    .min(H.minCompetitors, `Add ${H.minCompetitors}–${H.maxCompetitors} competitors or none`)
    .max(H.maxCompetitors)
    .nullable(),
  tiers: z.array(z.strictObject({
    name: singleLineText(H.tierName),
    price: singleLineText(H.tierPrice),
  })).min(1).max(H.maxTiers).optional(),
});

/** Social card inputs. Generating the image belongs to the release pipeline. */
export const ogInputSchema = z.strictObject({
  subject: singleLineText(L.ogSubjectChars),
  accent: z.string().regex(/^[a-z][a-z-]{0,23}$/, "Accent must be a short lowercase name"),
});

/**
 * Explicit, closed metadata for one revision. There is deliberately no
 * free-form bag: every field maps to an existing manifest/tag contract.
 */
export const editorialMetadataSchema = z.strictObject({
  description: singleLineText(L.descriptionChars),
  category: z.enum(CATEGORY_SLUGS),
  buildTime: z.enum(BUILD_TIME_VALUES),
  revenueGoal: z.enum(REVENUE_GOAL_SLUGS),
  tools: uniqueArray(z.enum(TOOL_SLUGS), MIN_TOOLS, TOOL_SLUGS.length, "tools"),
  audiences: uniqueArray(z.enum(AUDIENCE_SLUGS), MIN_AUDIENCES, AUDIENCE_SLUGS.length, "audiences"),
  highlights: highlightsSchema.nullable(),
  og: ogInputSchema.nullable(),
});

export type EditorialMetadata = z.infer<typeof editorialMetadataSchema>;
export type EditorialHighlights = z.infer<typeof highlightsSchema>;
