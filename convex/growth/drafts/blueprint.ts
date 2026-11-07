import { v } from "convex/values";

import { query } from "../../_generated/server";
import { assertFeatureEnabled } from "../../ops/settings";
import { requireBusinessAccess } from "../../platform/authz";
import { blueprintIsValidated, blueprintSchema, type Blueprint } from "../../../lib/workspace/contracts/artifacts";
import { BUYERS, DELIVERY_FORMATS, IDEA_KINDS } from "../../../lib/workspace/contracts/roster";
import { newestDraftDocument, newestReviewCard, parseDraftBody, reviewCardValidator, type Business } from "./documentDraft";

/**
 * L1-C6 — the owner-only read of the business's blueprint for its read-only
 * review view: the newest non-archived `blueprint` document's fields, parsed
 * with the C-ART schema, and that document's newest `artifact_review` card.
 * An own idea's light blueprint carries no market block and reads
 * `validated: false` ("Not yet validated", D15). A body that does not parse
 * reads `unavailable`. Nothing here writes. No ids beyond the card's.
 */

const literalsOf = <T extends string>(values: readonly T[]) => v.union(...values.map((value) => v.literal(value)));

export const blueprintViewValidator = v.object({
  source: v.union(v.literal("library"), v.literal("own_idea")),
  /** Library ideas are researched; own ideas show "Not yet validated" (D15). */
  validated: v.boolean(),
  pitch: v.string(),
  oneUser: v.string(),
  oneLoop: v.string(),
  features: v.array(v.string()),
  scopeCuts: v.array(v.string()),
  profile: v.object({
    ideaKind: literalsOf(IDEA_KINDS),
    buyer: literalsOf(BUYERS),
    deliveryFormat: literalsOf(DELIVERY_FORMATS),
    audiencePlural: v.string(),
  }),
  /** Library ideas only, and optional there. Qualitative: no numbers or prices. */
  market: v.optional(v.object({
    summary: v.string(),
    competitors: v.array(v.object({ name: v.string(), note: v.string() })),
  })),
});

const blueprintDraftView = v.union(
  v.object({ state: v.literal("none") }),
  /** The newest document does not parse as a blueprint: shown as unavailable. */
  v.object({ state: v.literal("unavailable") }),
  v.object({ state: v.literal("ready"), blueprint: blueprintViewValidator, card: reviewCardValidator }),
);

/** Copies the parsed blueprint field by field (no `ideaSlug`, no `schemaVersion`). */
function blueprintView(blueprint: Blueprint) {
  const market = blueprint.source === "library" ? blueprint.market : undefined;
  return {
    source: blueprint.source,
    validated: blueprintIsValidated(blueprint),
    pitch: blueprint.pitch,
    oneUser: blueprint.oneUser,
    oneLoop: blueprint.oneLoop,
    features: [...blueprint.features],
    scopeCuts: [...blueprint.scopeCuts],
    profile: {
      ideaKind: blueprint.profile.ideaKind,
      buyer: blueprint.profile.buyer,
      deliveryFormat: blueprint.profile.deliveryFormat,
      audiencePlural: blueprint.profile.audiencePlural,
    },
    ...(market === undefined
      ? {}
      : {
        market: {
          summary: market.summary,
          competitors: market.competitors.map((entry) => ({ name: entry.name, note: entry.note })),
        },
      }),
  };
}

/**
 * The business's blueprint and its card. Owner only; the workspace and AI
 * must be on (a refusal throws, as `emailSequenceDraft` does).
 */
export const blueprintDraft = query({
  args: { projectId: v.id("projects") },
  returns: blueprintDraftView,
  handler: async (ctx, args) => {
    await assertFeatureEnabled(ctx, "workspace");
    await assertFeatureEnabled(ctx, "ai");
    const project = await requireBusinessAccess(ctx, args.projectId, "owner");
    const business: Business = { ownerId: project.ownerId, projectId: project._id };
    const document = await newestDraftDocument(ctx, business, "blueprint");
    if (document === null) return { state: "none" as const };
    const blueprint = parseDraftBody(document.body, blueprintSchema);
    if (blueprint === null) return { state: "unavailable" as const };
    return { state: "ready" as const, blueprint: blueprintView(blueprint), card: await newestReviewCard(ctx, business, document._id) };
  },
});
