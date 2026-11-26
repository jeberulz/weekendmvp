import { z } from "zod";

/**
 * GuideSpec schema (WP103-S2). The TypeScript type is inferred from it, so the type and the
 * audit cannot drift. Plain Node can load this file (type stripping, no `@/` alias).
 */

const text = z.string().trim().min(1);

const sectionId = z.string().regex(/^s\d{2}$/, "section ids look like s01, s02, ...");

const summary = z.union([
  text,
  z.custom<(count: number) => string>((value) => typeof value === "function", "summary must be text or a function"),
]);

export const guideGateSchema = z.object({
  mode: z.enum(["none", "after-section-1"]),
  stubEyebrow: text,
  stubNote: text,
  heading: text,
  body: text,
  unlocks: z.array(text).min(1),
  nextHref: z.string().regex(/^#s\d{2}$/, "nextHref must point at a section, like #s02"),
  nextLabel: text,
  /** Deck slot that holds the fine print under the form. */
  finePrintSlot: text,
});

export const guideSpecSchema = z.object({
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "slug is lowercase words joined by hyphens"),
  path: z.string().regex(/^\/guides\/[a-z0-9-]+$/, "path looks like /guides/{slug}"),
  title: text,
  headline: text.refine((value) => value.includes(". "), "headline needs a first sentence and an emphasis tail, split at '. '"),
  description: text.max(300),
  /** Full `<title>` text. */
  metaTitle: text,
  ogImagePath: z.string().startsWith("/"),
  lang: z.string().regex(/^[a-z]{2}(?:-[A-Z]{2})?$/),
  authorName: text,
  utmCampaign: text,
  checklistKey: text,
  promptFileName: text,
  sections: z
    .array(z.object({ id: sectionId, title: text, summary }))
    .min(2),
  hero: z.object({
    eyebrow: text,
    lede: text,
    meta: z.array(z.tuple([text, z.string()])).min(1),
    metaLabel: text,
    ctaLabel: text,
    lockedNote: text,
    subscribedNote: text,
    image: z.object({
      src: z.string().startsWith("/"),
      alt: text,
      width: z.number().int().positive(),
      height: z.number().int().positive(),
      sizes: text,
      /** Only an approved asset can ship. A draft or stand-in image fails the audit. */
      assetStatus: z.enum(["approved", "draft"]),
    }),
  }),
  contents: z.object({ heading: text }),
  /** "none" means no gate and no paywall markup. The layout does not render "none" yet, so the audit reports it. */
  gate: guideGateSchema,
  steps: z.array(text).min(1),
  /** Pull quote shown after a step, keyed by step name. */
  stepPullQuotes: z.record(z.string(), text),
  skills: z.array(text).min(1),
  roles: z.object({ names: z.array(text).min(1), labels: z.array(text).min(1) }),
  weeks: z.array(z.tuple([z.number().int().positive(), text])).min(1),
  faq: z.array(text).min(1),
  founderName: text,
});

export type GuideSpec = z.infer<typeof guideSpecSchema>;
