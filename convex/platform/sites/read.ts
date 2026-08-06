import { v } from "convex/values";
import { query } from "../../_generated/server";
import type { Doc } from "../../_generated/dataModel";
import type { QueryCtx } from "../../_generated/server";

/**
 * WP28-S3. Host -> published site resolution for the public tenant route.
 *
 * This is the only public, unauthenticated read of owner-scoped platform
 * tables, so the rules are narrow and absolute:
 *
 * 1. **Nothing but a render spec leaves this module.** No owner id, project
 *    id, status, timestamp, version number, or document id is returned. A
 *    published landing page needs its own content and nothing else, and every
 *    additional field would be a fact about a customer's account exposed to
 *    the open internet.
 * 2. **Every rejection is the same `null`.** "No such host", "not published",
 *    "retired version", and "archived project" are indistinguishable, so a
 *    stranger cannot enumerate which subdomains exist or infer a customer's
 *    publishing state. Same discipline as WP27's capability resolution.
 * 3. **The hostname is the only input**, and the caller cannot widen it.
 *    There is no project or owner argument to forge.
 */

const publishedSiteValidator = v.object({ renderSpec: v.string() });

export type PublishedSite = { renderSpec: string };

/**
 * Resolves the site row for a hostname, or `null`.
 *
 * Uses `collect()` rather than `unique()` deliberately. `unique()` throws when
 * two rows share a hostname, which would turn a data-integrity bug into a 500
 * on a public page — and, worse, into a signal that the hostname exists.
 * WP28-S4 makes hostname claims collision-free inside a transaction; if that
 * ever fails, serving nothing is the correct fail-closed outcome, and picking
 * one of the two rows would non-deterministically serve one customer's site
 * under a host another customer may hold.
 */
async function siteForHostname(
  ctx: QueryCtx,
  hostname: string,
): Promise<Doc<"site_configs"> | null> {
  const matches = await ctx.db
    .query("site_configs")
    .withIndex("by_hostname", (q) => q.eq("hostname", hostname))
    .take(2);
  if (matches.length !== 1) return null;
  return matches[0];
}

export const resolvePublishedSite = query({
  args: { hostname: v.string() },
  returns: v.union(v.null(), publishedSiteValidator),
  handler: async (ctx, args): Promise<PublishedSite | null> => {
    const site = await siteForHostname(ctx, args.hostname);
    if (site === null) return null;
    if (site.archivedAt !== undefined) return null;
    if (site.status !== "published") return null;

    // A published site with no current version is the shape a takedown or a
    // rollback-in-progress leaves behind. `siteTransitions.published` is
    // terminal in the frozen WP22 state machine, so the pointer — not the
    // status — is what makes a site reachable, and clearing it is the only
    // way to take one down.
    if (site.currentVersionId === undefined) return null;

    const version = await ctx.db.get(site.currentVersionId);
    if (version === null) return null;
    // The pointer must agree with the version's own parent. A dangling or
    // cross-site pointer serves another site's content under this hostname.
    if (version.siteConfigId !== site._id) return null;
    if (version.status !== "published") return null;

    const project = await ctx.db.get(site.projectId);
    if (project === null || project.archivedAt !== undefined) return null;
    // Ownership must be internally consistent across the graph before any of
    // it is served publicly.
    if (project.ownerId !== site.ownerId || version.ownerId !== site.ownerId) {
      return null;
    }

    if (version.documentId === undefined) return null;
    const document = await ctx.db.get(version.documentId);
    if (document === null || document.archivedAt !== undefined) return null;
    if (document.ownerId !== site.ownerId) return null;
    if (document.body === undefined) return null;

    // Returned as the stored string. The route re-parses it through
    // `parseSiteRenderSpec` at the render boundary rather than trusting a
    // shape because it came from our own backend.
    return { renderSpec: document.body };
  },
});
