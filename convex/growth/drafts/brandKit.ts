import { v } from "convex/values";

import { query } from "../../_generated/server";
import { assertFeatureEnabled } from "../../ops/settings";
import { requireBusinessAccess } from "../../platform/authz";
import {
  ART_DIRECTIONS,
  THEME_MODES,
  TYPE_PAIR_IDS,
  VISUAL_DENSITIES,
  VISUAL_SHAPES,
  brandKitSchema,
  type BrandKit,
} from "../../../lib/workspace/contracts/artifacts";
import { newestDraftDocument, newestReviewCard, parseDraftBody, reviewCardValidator, type Business } from "./documentDraft";

/**
 * L1-C1 — the owner-only read of the business's brand kit for the Brand kit
 * page: the newest non-archived `brand_kit` document's fields, parsed with the
 * C-ART schema exactly as the crew writes it, and that document's newest
 * `artifact_review` card. A body that does not parse reads `unavailable`,
 * never as other text. Nothing here writes. No ids beyond the card's.
 */

const literalsOf = <T extends string>(values: readonly T[]) => v.union(...values.map((value) => v.literal(value)));

const colourValidator = v.object({ name: v.string(), hex: v.string(), use: v.string() });

export const brandKitViewValidator = v.object({
  name: v.string(),
  nameAlternatives: v.array(v.string()),
  tagline: v.object({ text: v.string(), emphasis: v.optional(v.string()) }),
  palette: v.object({
    primary: colourValidator,
    secondary: colourValidator,
    accent: colourValidator,
    ground: colourValidator,
    ink: colourValidator,
  }),
  visualSystem: v.object({
    direction: literalsOf(ART_DIRECTIONS),
    shape: literalsOf(VISUAL_SHAPES),
    density: literalsOf(VISUAL_DENSITIES),
    theme: v.object({ mode: literalsOf(THEME_MODES), reason: v.string() }),
  }),
  type: v.object({ pair: literalsOf(TYPE_PAIR_IDS), scale: v.string(), notes: v.string() }),
  voice: v.object({ traits: v.array(v.string()), say: v.string(), dontSay: v.string(), dontSayWhy: v.string() }),
  logo: v.object({ markDescription: v.string(), alt: v.string() }),
  heroArt: v.object({ description: v.string(), alt: v.string() }),
  pattern: v.optional(v.string()),
  productMoment: v.optional(v.object({ title: v.string(), body: v.string() })),
});

const brandKitDraftView = v.union(
  v.object({ state: v.literal("none") }),
  /** The newest document does not parse as a brand kit: shown as unavailable. */
  v.object({ state: v.literal("unavailable") }),
  v.object({ state: v.literal("ready"), kit: brandKitViewValidator, card: reviewCardValidator }),
);

const colour = (entry: BrandKit["palette"]["primary"]) => ({ name: entry.name, hex: entry.hex, use: entry.use });

/** Copies the parsed kit field by field, so the view never carries a field the validator does not name. */
function brandKitView(kit: BrandKit) {
  return {
    name: kit.name,
    nameAlternatives: [...kit.nameAlternatives],
    tagline: { text: kit.tagline.text, ...(kit.tagline.emphasis === undefined ? {} : { emphasis: kit.tagline.emphasis }) },
    palette: {
      primary: colour(kit.palette.primary),
      secondary: colour(kit.palette.secondary),
      accent: colour(kit.palette.accent),
      ground: colour(kit.palette.ground),
      ink: colour(kit.palette.ink),
    },
    visualSystem: {
      direction: kit.visualSystem.direction,
      shape: kit.visualSystem.shape,
      density: kit.visualSystem.density,
      theme: { mode: kit.visualSystem.theme.mode, reason: kit.visualSystem.theme.reason },
    },
    type: { pair: kit.type.pair, scale: kit.type.scale, notes: kit.type.notes },
    voice: {
      traits: [...kit.voice.traits],
      say: kit.voice.say,
      dontSay: kit.voice.dontSay,
      dontSayWhy: kit.voice.dontSayWhy,
    },
    logo: { markDescription: kit.logo.markDescription, alt: kit.logo.alt },
    heroArt: { description: kit.heroArt.description, alt: kit.heroArt.alt },
    ...(kit.pattern === undefined ? {} : { pattern: kit.pattern }),
    ...(kit.productMoment === undefined ? {} : { productMoment: { title: kit.productMoment.title, body: kit.productMoment.body } }),
  };
}

/**
 * The business's brand kit and its card. Owner only; the workspace and AI
 * must be on (a refusal throws, as `emailSequenceDraft` does).
 */
export const brandKitDraft = query({
  args: { projectId: v.id("projects") },
  returns: brandKitDraftView,
  handler: async (ctx, args) => {
    await assertFeatureEnabled(ctx, "workspace");
    await assertFeatureEnabled(ctx, "ai");
    const project = await requireBusinessAccess(ctx, args.projectId, "owner");
    const business: Business = { ownerId: project.ownerId, projectId: project._id };
    const document = await newestDraftDocument(ctx, business, "brand_kit");
    if (document === null) return { state: "none" as const };
    const kit = parseDraftBody(document.body, brandKitSchema);
    if (kit === null) return { state: "unavailable" as const };
    return { state: "ready" as const, kit: brandKitView(kit), card: await newestReviewCard(ctx, business, document._id) };
  },
});
