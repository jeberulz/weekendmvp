import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "../../_generated/dataModel";
import { mutation, type MutationCtx } from "../../_generated/server";
import { PLATFORM_AUTH_ERROR, requireCurrentPlatformUser } from "../authz";
import { resolveCapability } from "./capabilities";
import { serializeSiteRenderSpec, type SiteRenderSpec } from "./renderSpec";

/**
 * WP27-S5. Converts an anonymous preview into an owned project graph.
 *
 * This is the seam where a capability — authorized purely by possession of a
 * token — becomes a record owned by an authenticated user, so three rules
 * hold without exception.
 *
 * 1. **Identity is derived server-side.** `requireCurrentPlatformUser` is the
 *    only source of `ownerId`. No argument here names an owner, which is the
 *    WP22 invariant the whole authorization model rests on.
 * 2. **Exactly once.** A capability yields one project graph no matter how
 *    many times, or how concurrently, the claim is called.
 * 3. **One generic denial.** An expired capability, an unknown token, a
 *    malformed token, and a capability belonging to somebody else all raise
 *    the same `RESOURCE_NOT_FOUND` that `platform/authz.ts` uses everywhere
 *    else. A caller must not be able to tell "someone else owns this" from
 *    "this never existed".
 *
 * Reading is deliberately *not* restricted after a claim. S1 ruled that a
 * claimed capability still resolves while unexpired so the visitor can reload
 * their own preview, and `/preview/{token}` is an anonymous route with no
 * identity to check — possession of the link is the read authorization, by
 * design. Exclusivity applies to the claim, which is the action that creates
 * owned records.
 */

/**
 * Namespaced like WP25's `wp25:own:` / `wp25:repository:` keys so preview
 * claims cannot collide with intake projects in the shared
 * `by_ownerId_and_idempotencyKey` index.
 */
const CLAIM_KEY_PREFIX = "wp27:preview:";

/** `projects.title` is a bare `v.string()`; keep it bounded at the writer. */
const MAX_PROJECT_TITLE = 120;

function denyNotFound(): never {
  throw new ConvexError({ code: PLATFORM_AUTH_ERROR.notFound });
}

export type ClaimedGraph = {
  projectId: Id<"projects">;
  siteConfigId: Id<"site_configs">;
  siteVersionId: Id<"site_versions">;
  /** False when this call replayed an existing claim rather than creating one. */
  created: boolean;
};

const claimedGraphValidator = v.object({
  projectId: v.id("projects"),
  siteConfigId: v.id("site_configs"),
  siteVersionId: v.id("site_versions"),
  created: v.boolean(),
});

function projectTitle(spec: SiteRenderSpec): string {
  const headline = spec.siteInput.headline.trim();
  return headline.length > MAX_PROJECT_TITLE
    ? headline.slice(0, MAX_PROJECT_TITLE)
    : headline;
}

/**
 * Re-reads the site graph for an already-claimed project.
 *
 * Every lookup is re-checked against `ownerId` rather than trusting the
 * project pointer, matching the `matchesProject` discipline in
 * `platform/authz.ts`. A half-written graph raises `INCOMPLETE_PROJECT_GRAPH`
 * — the same code WP25 uses — instead of silently creating a second one,
 * because "repair by duplication" would break the exactly-once guarantee this
 * function exists to uphold.
 */
async function existingGraph(
  ctx: MutationCtx,
  project: Doc<"projects">,
): Promise<ClaimedGraph> {
  const siteConfig = await ctx.db
    .query("site_configs")
    .withIndex("by_ownerId_and_projectId", (q) =>
      q.eq("ownerId", project.ownerId).eq("projectId", project._id),
    )
    .unique();
  if (!siteConfig || siteConfig.archivedAt !== undefined) {
    throw new ConvexError({ code: "INCOMPLETE_PROJECT_GRAPH" });
  }
  const siteVersion = await ctx.db
    .query("site_versions")
    .withIndex("by_siteConfigId_and_version", (q) =>
      q.eq("siteConfigId", siteConfig._id).eq("version", 1n),
    )
    .unique();
  if (!siteVersion || siteVersion.ownerId !== project.ownerId) {
    throw new ConvexError({ code: "INCOMPLETE_PROJECT_GRAPH" });
  }
  return {
    projectId: project._id,
    siteConfigId: siteConfig._id,
    siteVersionId: siteVersion._id,
    created: false,
  };
}

async function createGraph(
  ctx: MutationCtx,
  ownerId: Id<"users">,
  capability: {
    capabilityId: Id<"preview_capabilities">;
    sourceIdeaId: Id<"ideas">;
    renderSpec: SiteRenderSpec;
  },
  idempotencyKey: string,
  now: number,
): Promise<ClaimedGraph> {
  const title = projectTitle(capability.renderSpec);
  const projectId = await ctx.db.insert("projects", {
    ownerId,
    // A preview always derives from a canonical idea record, which is what
    // `/build/{slug}` resolved before the capability was issued.
    source: "repository_idea",
    sourceIdeaId: capability.sourceIdeaId,
    title,
    status: "draft",
    idempotencyKey,
    createdAt: now,
    updatedAt: now,
  });
  const documentId = await ctx.db.insert("documents", {
    ownerId,
    projectId,
    kind: "site_copy",
    format: "json",
    title: `${title} site copy`,
    // Serialized, never `JSON.stringify`d: the serializer round-trips through
    // the parser, so `templateId` and `siteInput` carry forward only if they
    // still satisfy the S1 and WP26-S1 contracts. It also re-applies the
    // WP22 generated-document byte ceiling.
    body: serializeSiteRenderSpec(capability.renderSpec),
    createdAt: now,
    updatedAt: now,
  });
  const siteConfigId = await ctx.db.insert("site_configs", {
    ownerId,
    projectId,
    status: "draft",
    // `hostname` is deliberately absent. Host routing is WP28's exclusively
    // and a claimed preview must not reserve or imply one.
    createdAt: now,
    updatedAt: now,
  });
  const siteVersionId = await ctx.db.insert("site_versions", {
    ownerId,
    projectId,
    siteConfigId,
    status: "draft",
    version: 1n,
    documentId,
    createdAt: now,
  });
  await ctx.db.patch("site_configs", siteConfigId, {
    currentVersionId: siteVersionId,
    updatedAt: now,
  });
  await ctx.db.patch("preview_capabilities", capability.capabilityId, {
    claimedByUserId: ownerId,
    claimedProjectId: projectId,
    claimedAt: now,
  });
  return { projectId, siteConfigId, siteVersionId, created: true };
}

export const claim = mutation({
  args: { token: v.string() },
  returns: claimedGraphValidator,
  handler: async (ctx, args): Promise<ClaimedGraph> => {
    const user = await requireCurrentPlatformUser(ctx);
    // Server clock. `Date.now()` is fine in a mutation, and a client-supplied
    // timestamp would let a caller claim a capability that has expired.
    const now = Date.now();

    const capability = await resolveCapability(ctx, args.token, now);
    // Covers unknown, malformed, expired, and unparseable-spec identically.
    if (capability === null) return denyNotFound();

    if (
      capability.claimedByUserId !== undefined &&
      capability.claimedByUserId !== user._id
    ) {
      // Someone else's. Same denial as "never existed" — telling B that A
      // holds this capability is itself a disclosure.
      return denyNotFound();
    }

    const idempotencyKey = `${CLAIM_KEY_PREFIX}${capability.capabilityId}`;

    // Keyed on the capability, so a replay resolves to the same row.
    //
    // This is the load-bearing half of exactly-once, not the `claimedByUserId`
    // check above. Convex mutations are serializable, so two concurrent
    // claims conflict on this read set and the loser retries against the
    // committed state — where it finds this project and returns it instead of
    // inserting a second graph. Relying on the capability flag alone would
    // still be correct under OCC, but this also covers a capability row that
    // was written without its pointers.
    const existing = await ctx.db
      .query("projects")
      .withIndex("by_ownerId_and_idempotencyKey", (q) =>
        q.eq("ownerId", user._id).eq("idempotencyKey", idempotencyKey),
      )
      .unique();

    if (existing) {
      if (existing.archivedAt !== undefined) {
        // Claimed once and then archived. Re-creating would hand back a
        // project the owner deliberately put away.
        return denyNotFound();
      }
      const graph = await existingGraph(ctx, existing);
      if (capability.claimedByUserId === undefined) {
        // Self-heals a capability whose graph exists but whose pointers were
        // never written. Idempotent: patching to the values already implied.
        await ctx.db.patch("preview_capabilities", capability.capabilityId, {
          claimedByUserId: user._id,
          claimedProjectId: existing._id,
          claimedAt: now,
        });
      }
      return graph;
    }

    return await createGraph(ctx, user._id, capability, idempotencyKey, now);
  },
});
