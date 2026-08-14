import { ConvexError, v } from "convex/values";
import { RateLimiter, MINUTE, HOUR } from "@convex-dev/rate-limiter";
import { components } from "../../_generated/api";
import type { Doc, Id } from "../../_generated/dataModel";
import { mutation, query, type MutationCtx } from "../../_generated/server";
import { PLATFORM_AUTH_ERROR, requireCurrentPlatformUser } from "../authz";

/**
 * WP28-S5. Lead capture on a published tenant site.
 *
 * **This endpoint stores no real lead.** Owner ruling 2026-08-07
 * (`docs/wp/RULINGS.md`, "WP28 / tenant lead retention"): WP28 records
 * synthetic rows only, and a request carrying a real email or free-text
 * payload is **rejected**, never silently stripped. Real capture is a WP31
 * activation item, gated on privacy and retention text existing first. Until
 * then this system holds no PII belonging to a customer's visitors, which is
 * the only defensible position without a privacy policy that covers them.
 *
 * The templates' call to action therefore stays the inert
 * `<button type="button">` WP27 built. Rendering a live form that rejected
 * every genuine submission would be worse than rendering none.
 *
 * Ownership rules, which do not depend on the ruling and will still hold when
 * WP31 turns real capture on:
 *
 * 1. `ownerId`, `projectId`, and `siteConfigId` are **all derived from the
 *    resolved hostname**. No caller supplies any of them, so a forged body
 *    cannot attach a lead to another owner's project.
 * 2. Only a **published** site accepts a lead at all.
 * 3. Leads are readable only through an owner-scoped query.
 */

const rateLimiter = new RateLimiter(components.rateLimiter, {
  // Deliberately tighter than preview generation: a lead POST writes a row on
  // someone else's site and needs no customisation payload to be useful as
  // spam.
  tenantLeadBurst: { kind: "token bucket", rate: 5, period: MINUTE },
  tenantLeadSustained: { kind: "token bucket", rate: 30, period: HOUR },
});

export const LEAD_ERROR = {
  notPublished: "TENANT_SITE_NOT_PUBLISHED",
  personalDataRefused: "TENANT_LEAD_PERSONAL_DATA_REFUSED",
} as const;

/**
 * Resolves a published site from a hostname, returning the full row so the
 * caller can derive ownership. Mirrors `read.ts`: `take(2)` rather than
 * `unique()`, so a duplicate-hostname data bug refuses rather than throwing.
 */
async function publishedSiteForHostname(
  ctx: MutationCtx,
  hostname: string,
): Promise<Doc<"site_configs"> | null> {
  const matches = await ctx.db
    .query("site_configs")
    .withIndex("by_hostname", (q) => q.eq("hostname", hostname))
    .take(2);
  if (matches.length !== 1) return null;
  const site = matches[0];
  if (site.archivedAt !== undefined) return null;
  if (site.status !== "published" || site.currentVersionId === undefined) {
    return null;
  }
  const version = await ctx.db.get(site.currentVersionId);
  if (
    version === null ||
    version.siteConfigId !== site._id ||
    version.status !== "published"
  ) {
    return null;
  }
  return site;
}

/**
 * Records a synthetic lead against the site resolved from `hostname`.
 *
 * Takes no owner, project, or site identifier. The only inputs are the
 * hostname and a rate-limit key the Next layer signed, so there is nothing
 * here for a caller to forge into another tenant's account.
 */
export const recordSynthetic = mutation({
  args: { hostname: v.string(), rateLimitKey: v.string() },
  returns: v.object({ recorded: v.boolean() }),
  handler: async (ctx, args): Promise<{ recorded: boolean }> => {
    // Limited before the write and in its own committed step for the same
    // reason WP27 split `consumeGenerationQuota`: a limit consumed inside a
    // mutation that later throws is rolled back, which makes every failing
    // request free.
    await rateLimiter.limit(ctx, "tenantLeadBurst", {
      key: args.rateLimitKey,
      throws: true,
    });
    await rateLimiter.limit(ctx, "tenantLeadSustained", {
      key: args.rateLimitKey,
      throws: true,
    });

    const site = await publishedSiteForHostname(ctx, args.hostname);
    if (site === null) {
      // Same generic refusal an unpublished host already gets from the public
      // resolver, so this endpoint is not an oracle for which sites are live.
      throw new ConvexError({ code: LEAD_ERROR.notPublished });
    }

    await ctx.db.insert("leads", {
      ownerId: site.ownerId,
      projectId: site.projectId,
      siteConfigId: site._id,
      // No `email`, no `payload`. Both are optional in the frozen schema and
      // are left genuinely absent rather than blanked, so a row cannot be
      // mistaken for a real lead whose contents were lost.
      synthetic: true,
      createdAt: Date.now(),
    });

    return { recorded: true };
  },
});

/**
 * The owning user's view of their leads. There is no cross-tenant read: the
 * query is scoped by `by_projectId_and_createdAt` *after* ownership of the
 * project is proven server-side.
 */
export const listForProject = query({
  args: { projectId: v.id("projects") },
  returns: v.array(
    v.object({
      _id: v.id("leads"),
      createdAt: v.number(),
      synthetic: v.boolean(),
    }),
  ),
  handler: async (ctx, args) => {
    const user = await requireCurrentPlatformUser(ctx);
    const project = await ctx.db.get(args.projectId);
    if (
      project === null ||
      project.ownerId !== user._id ||
      project.archivedAt !== undefined
    ) {
      throw new ConvexError({ code: PLATFORM_AUTH_ERROR.notFound });
    }

    const leads = await ctx.db
      .query("leads")
      .withIndex("by_projectId_and_createdAt", (q) =>
        q.eq("projectId", args.projectId),
      )
      .order("desc")
      .take(200);

    // Ownership re-checked per row rather than trusted from the index alone.
    return leads
      .filter((lead) => lead.ownerId === user._id && lead.archivedAt === undefined)
      .map((lead) => ({
        _id: lead._id as Id<"leads">,
        createdAt: lead.createdAt,
        synthetic: lead.synthetic,
      }));
  },
});
