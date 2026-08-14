import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "../../_generated/dataModel";
import { mutation, type MutationCtx } from "../../_generated/server";
import { PLATFORM_AUTH_ERROR, requireCurrentPlatformUser } from "../authz";
import { assertSiteTransition, assertSiteVersionTransition } from "../transitions";
import type { SiteStatus } from "../validators";
import { isValidTenantSlug, tenantHostForSlug } from "../../../lib/tenant-host";

/**
 * WP28-S4. Publishing, versioning, and rollback.
 *
 * This is where a private draft becomes a page on the public internet under a
 * hostname a stranger can reach, so the invariants are strict:
 *
 * 1. **Identity is derived server-side.** `requireCurrentPlatformUser` is the
 *    only source of `ownerId`; no argument names an owner. Frozen WP22
 *    invariant.
 * 2. **Atomic.** Convex mutations are serializable transactions, so the
 *    version insert, the retirement of the outgoing version, the
 *    `currentVersionId` swap, and the hostname claim all commit together or
 *    not at all. There is no window in which a site is half-published.
 * 3. **Forward-only.** `siteTransitions.published` and
 *    `siteVersionTransitions.retired` are both terminal in the frozen state
 *    machine. Rollback therefore *promotes a new version* carrying the old
 *    content; it never un-retires or un-publishes anything.
 * 4. **No schema change.** Hostname uniqueness is enforced by reading
 *    `by_hostname` and writing inside the same transaction, not by a database
 *    constraint — WP28 leaves `convex/schema.ts` untouched.
 */

const PUBLISH_ERROR = {
  slugUnavailable: "SITE_SLUG_UNAVAILABLE",
  notPublishable: "SITE_NOT_PUBLISHABLE",
} as const;

const publishResultValidator = v.object({
  hostname: v.string(),
  version: v.int64(),
  created: v.boolean(),
});

export type PublishResult = {
  hostname: string;
  version: bigint;
  created: boolean;
};

function denyNotFound(): never {
  // The same generic denial `platform/authz.ts` uses everywhere, so "someone
  // else owns this project" is indistinguishable from "no such project".
  throw new ConvexError({ code: PLATFORM_AUTH_ERROR.notFound });
}

/**
 * A taken slug and a reserved slug raise the *same* error deliberately.
 * Splitting them would turn this mutation into an oracle for which
 * subdomains are already occupied by other customers.
 */
function denySlug(): never {
  throw new ConvexError({ code: PUBLISH_ERROR.slugUnavailable });
}

async function ownedSite(
  ctx: MutationCtx,
  ownerId: Id<"users">,
  projectId: Id<"projects">,
): Promise<Doc<"site_configs">> {
  const project = await ctx.db.get(projectId);
  if (project === null || project.ownerId !== ownerId || project.archivedAt !== undefined) {
    denyNotFound();
  }
  const sites = await ctx.db
    .query("site_configs")
    .withIndex("by_ownerId_and_projectId", (q) =>
      q.eq("ownerId", ownerId).eq("projectId", projectId),
    )
    .take(2);
  const site = sites.length === 1 ? sites[0] : null;
  if (site === null || site.archivedAt !== undefined) {
    denyNotFound();
  }
  return site;
}

/** The highest existing version row for a site, or null when there are none. */
async function latestVersion(
  ctx: MutationCtx,
  siteConfigId: Id<"site_configs">,
): Promise<Doc<"site_versions"> | null> {
  return await ctx.db
    .query("site_versions")
    .withIndex("by_siteConfigId_and_version", (q) => q.eq("siteConfigId", siteConfigId))
    .order("desc")
    .first();
}

/**
 * Claims a hostname, or refuses.
 *
 * The read and the write happen in one serializable transaction, so two
 * concurrent claims for the same hostname cannot both succeed — the loser
 * hits an OCC conflict, retries, sees the winner's row, and is refused. This
 * is what replaces a uniqueness constraint the frozen schema does not have.
 */
async function assertHostnameAvailable(
  ctx: MutationCtx,
  hostname: string,
  siteConfigId: Id<"site_configs">,
): Promise<void> {
  const holders = await ctx.db
    .query("site_configs")
    .withIndex("by_hostname", (q) => q.eq("hostname", hostname))
    .take(2);
  for (const holder of holders) {
    if (holder._id !== siteConfigId) denySlug();
  }
  // Two rows already sharing this hostname is a data-integrity failure. Refuse
  // rather than add a third.
  if (holders.length > 1) denySlug();
}

/** Walks the frozen `draft -> ready -> published` path one legal step at a time. */
function siteStatusPathToPublished(current: SiteStatus): SiteStatus[] {
  if (current === "published") return [];
  if (current === "ready") return ["published"];
  return ["ready", "published"];
}

async function advanceSiteToPublished(
  ctx: MutationCtx,
  site: Doc<"site_configs">,
): Promise<void> {
  let status: SiteStatus = site.status;
  for (const next of siteStatusPathToPublished(site.status)) {
    // Asserted step by step rather than jumped, so an illegal transition can
    // never be laundered through a multi-step move.
    assertSiteTransition(status, next);
    status = next;
  }
  if (status !== site.status) {
    await ctx.db.patch(site._id, { status, updatedAt: Date.now() });
  }
}

async function retireCurrent(
  ctx: MutationCtx,
  site: Doc<"site_configs">,
  now: number,
): Promise<void> {
  if (site.currentVersionId === undefined) return;
  const current = await ctx.db.get(site.currentVersionId);
  if (current === null || current.status !== "published") return;
  assertSiteVersionTransition(current.status, "retired");
  await ctx.db.patch(current._id, { status: "retired", retiredAt: now });
}

async function audit(
  ctx: MutationCtx,
  site: Doc<"site_configs">,
  action: string,
  subjectId: string,
  metadata: Record<string, string>,
): Promise<void> {
  await ctx.db.insert("audit_events", {
    ownerId: site.ownerId,
    projectId: site.projectId,
    actorType: "user",
    actorUserId: site.ownerId,
    action,
    subjectType: "site_version",
    subjectId,
    metadata: JSON.stringify(metadata),
    createdAt: Date.now(),
  });
}

/**
 * Publishes a site at `{slug}.weekendmvp.app`.
 *
 * Idempotency is **structural**, not key-based: republishing content that is
 * already live at the same hostname is a no-op that returns the live version.
 * There is no `idempotencyKey` column on `site_versions` and WP28 deliberately
 * does not touch `convex/schema.ts`, so deriving the answer from state is both
 * the smaller change and the harder one to get wrong — a replayed request
 * cannot create a second version because the content is unchanged, no matter
 * what key it carries.
 */
export const publish = mutation({
  args: { projectId: v.id("projects"), slug: v.string() },
  returns: publishResultValidator,
  handler: async (ctx, args): Promise<PublishResult> => {
    const user = await requireCurrentPlatformUser(ctx);
    const now = Date.now();

    // Re-checked server-side. The client-side list is a UX affordance; this is
    // the boundary.
    if (!isValidTenantSlug(args.slug)) denySlug();
    const hostname = tenantHostForSlug(args.slug);
    if (hostname === null) denySlug();

    const site = await ownedSite(ctx, user._id, args.projectId);
    await assertHostnameAvailable(ctx, hostname, site._id);

    const latest = await latestVersion(ctx, site._id);
    if (latest === null || latest.documentId === undefined) {
      // Nothing to publish: no version row, or a version with no content.
      throw new ConvexError({ code: PUBLISH_ERROR.notPublishable });
    }

    // Structural idempotency: already live, same content, same hostname.
    if (
      site.status === "published" &&
      site.currentVersionId !== undefined &&
      site.hostname === hostname
    ) {
      const current = await ctx.db.get(site.currentVersionId);
      if (
        current !== null &&
        current.status === "published" &&
        current.documentId === latest.documentId
      ) {
        return { hostname, version: current.version, created: false };
      }
    }

    const version = latest.version + 1n;
    await retireCurrent(ctx, site, now);
    const versionId = await ctx.db.insert("site_versions", {
      ownerId: site.ownerId,
      projectId: site.projectId,
      siteConfigId: site._id,
      status: "published",
      version,
      documentId: latest.documentId,
      createdAt: now,
      publishedAt: now,
    });

    await ctx.db.patch(site._id, {
      hostname,
      currentVersionId: versionId,
      updatedAt: now,
    });
    await advanceSiteToPublished(ctx, site);
    await audit(ctx, site, "site.published", versionId, {
      hostname,
      version: version.toString(),
    });

    return { hostname, version, created: true };
  },
});

/**
 * Rolls back to the content of an earlier version.
 *
 * Promotes that content as a **new** version rather than reviving the old row.
 * `siteVersionTransitions.retired` is terminal, so an un-retire is not
 * expressible — and even if it were, mutating a historical row in place would
 * destroy the audit trail of what was live when.
 */
export const rollback = mutation({
  args: { projectId: v.id("projects"), toVersion: v.int64() },
  returns: publishResultValidator,
  handler: async (ctx, args): Promise<PublishResult> => {
    const user = await requireCurrentPlatformUser(ctx);
    const now = Date.now();

    const site = await ownedSite(ctx, user._id, args.projectId);
    if (site.hostname === undefined || site.status !== "published") {
      throw new ConvexError({ code: PUBLISH_ERROR.notPublishable });
    }

    const target = await ctx.db
      .query("site_versions")
      .withIndex("by_siteConfigId_and_version", (q) =>
        q.eq("siteConfigId", site._id).eq("version", args.toVersion),
      )
      .unique();
    if (target === null || target.documentId === undefined) denyNotFound();
    // A version row that somehow points at another site must never be
    // promotable here.
    if (target.siteConfigId !== site._id || target.ownerId !== site.ownerId) {
      denyNotFound();
    }
    if (site.currentVersionId === target._id) {
      return { hostname: site.hostname, version: target.version, created: false };
    }

    const latest = await latestVersion(ctx, site._id);
    const version = (latest?.version ?? target.version) + 1n;

    await retireCurrent(ctx, site, now);
    const versionId = await ctx.db.insert("site_versions", {
      ownerId: site.ownerId,
      projectId: site.projectId,
      siteConfigId: site._id,
      status: "published",
      version,
      documentId: target.documentId,
      createdAt: now,
      publishedAt: now,
    });
    await ctx.db.patch(site._id, { currentVersionId: versionId, updatedAt: now });
    await audit(ctx, site, "site.rolled_back", versionId, {
      hostname: site.hostname,
      version: version.toString(),
      restoredFrom: target.version.toString(),
    });

    return { hostname: site.hostname, version, created: true };
  },
});

/**
 * Takes a published site off the internet.
 *
 * Clearing `currentVersionId` is the *only* takedown mechanism available:
 * `siteTransitions.published` is terminal, so `site_configs.status` can never
 * leave `published`. The public resolver refuses a site with no current
 * version, so the page 404s while the row honestly records that it was once
 * published. WP30's kill switch depends on this being the mechanism.
 */
export const unpublish = mutation({
  args: { projectId: v.id("projects") },
  returns: v.object({ changed: v.boolean() }),
  handler: async (ctx, args): Promise<{ changed: boolean }> => {
    const user = await requireCurrentPlatformUser(ctx);
    const now = Date.now();
    const site = await ownedSite(ctx, user._id, args.projectId);
    if (site.currentVersionId === undefined) {
      return { changed: false };
    }

    await retireCurrent(ctx, site, now);
    await ctx.db.patch(site._id, { currentVersionId: undefined, updatedAt: now });
    await audit(ctx, site, "site.unpublished", site.currentVersionId, {
      hostname: site.hostname ?? "",
    });
    return { changed: true };
  },
});
