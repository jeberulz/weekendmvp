import { ConvexError, v } from "convex/values";
import { RateLimiter, MINUTE, HOUR } from "@convex-dev/rate-limiter";
import { paginationOptsValidator, paginationResultValidator } from "convex/server";
import { components, internal } from "../../_generated/api";
import type { Doc, Id } from "../../_generated/dataModel";
import { env, mutation, query, type MutationCtx } from "../../_generated/server";
import { PLATFORM_AUTH_ERROR, requireCurrentPlatformUser, requireCurrentPlatformUserForMutation } from "../authz";

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

const MAX_BRIDGE_PAYLOAD_LENGTH = 512;
const BRIDGE_MAX_AGE_MS = 2 * MINUTE;
const BRIDGE_FUTURE_SKEW_MS = 30_000;

async function verifiedLeadBridge(payload: string, signature: string) {
  const secret = env.TENANT_LEAD_BRIDGE_SECRET;
  if (!secret || secret.length < 32) {
    throw new ConvexError({ code: "TENANT_LEAD_BRIDGE_NOT_CONFIGURED" });
  }
  if (payload.length > MAX_BRIDGE_PAYLOAD_LENGTH ||
      !/^[A-Za-z0-9_-]{43}$/.test(signature)) {
    throw new ConvexError({ code: "INVALID_TENANT_LEAD_BRIDGE_SIGNATURE" });
  }
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["verify"],
  );
  let supplied: ArrayBuffer;
  try {
    const binary = atob(signature.replace(/-/g, "+").replace(/_/g, "/").padEnd(44, "="));
    supplied = Uint8Array.from(binary, (char) => char.charCodeAt(0)).buffer;
  } catch {
    throw new ConvexError({ code: "INVALID_TENANT_LEAD_BRIDGE_SIGNATURE" });
  }
  if (!await crypto.subtle.verify("HMAC", key, supplied, new TextEncoder().encode(payload))) {
    throw new ConvexError({ code: "INVALID_TENANT_LEAD_BRIDGE_SIGNATURE" });
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(payload);
  } catch {
    throw new ConvexError({ code: "INVALID_TENANT_LEAD_BRIDGE_PAYLOAD" });
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new ConvexError({ code: "INVALID_TENANT_LEAD_BRIDGE_PAYLOAD" });
  }
  const row = parsed as Record<string, unknown>;
  if (Object.keys(row).sort().join(",") !== "hostname,issuedAt,rateLimitKey" ||
      typeof row.hostname !== "string" || row.hostname.length > 253 ||
      !/^[a-z0-9.-]+$/.test(row.hostname) ||
      typeof row.rateLimitKey !== "string" ||
      !/^client:[A-Za-z0-9_-]{43}$/.test(row.rateLimitKey) ||
      typeof row.issuedAt !== "number" || !Number.isSafeInteger(row.issuedAt)) {
    throw new ConvexError({ code: "INVALID_TENANT_LEAD_BRIDGE_PAYLOAD" });
  }
  const now = Date.now();
  if (row.issuedAt < now - BRIDGE_MAX_AGE_MS ||
      row.issuedAt > now + BRIDGE_FUTURE_SKEW_MS) {
    throw new ConvexError({ code: "TENANT_LEAD_BRIDGE_EXPIRED" });
  }
  return { hostname: row.hostname, rateLimitKey: row.rateLimitKey };
}

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
  if (site.archivedAt !== undefined || site.takedownAt !== undefined) return null;
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
 * The Next tenant route signs the hostname, pseudonymous client limiter key,
 * and issue time. Direct callers cannot mint fresh limiter buckets.
 */
export const recordSynthetic = mutation({
  args: { payload: v.string(), signature: v.string() },
  returns: v.object({ recorded: v.boolean() }),
  handler: async (ctx, args): Promise<{ recorded: boolean }> => {
    const { hostname, rateLimitKey } = await verifiedLeadBridge(args.payload, args.signature);
    // Signed requests consume the existing per-client burst and sustained
    // budgets before any lead row can be inserted.
    await rateLimiter.limit(ctx, "tenantLeadBurst", {
      key: rateLimitKey,
      throws: true,
    });
    await rateLimiter.limit(ctx, "tenantLeadSustained", {
      key: rateLimitKey,
      throws: true,
    });

    const site = await publishedSiteForHostname(ctx, hostname);
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

/**
 * Owner-scoped, paginated real-lead export. The Next route streams pages into
 * CSV, so no fixed cap silently truncates the founder's data. Deleted and
 * synthetic rows never leave this query.
 */
const exportLeadValidator = v.object({
  id: v.id("leads"),
  email: v.string(),
  createdAt: v.number(),
  consentText: v.optional(v.string()),
  consentVersion: v.optional(v.string()),
  doubleOptInAt: v.optional(v.number()),
  source: v.optional(v.string()),
});

export const exportPage = query({
  args: { projectId: v.id("projects"), paginationOpts: paginationOptsValidator },
  returns: paginationResultValidator(exportLeadValidator),
  handler: async (ctx, args) => {
    const user = await requireCurrentPlatformUser(ctx);
    const project = await ctx.db.get(args.projectId);
    if (project === null || project.ownerId !== user._id) {
      throw new ConvexError({ code: PLATFORM_AUTH_ERROR.notFound });
    }
    const page = await ctx.db.query("leads")
      .withIndex("by_projectId_and_createdAt", (q) => q.eq("projectId", args.projectId))
      .order("asc")
      .paginate(args.paginationOpts);
    return {
      ...page,
      page: page.page
        .filter((lead) => lead.ownerId === user._id && !lead.synthetic &&
          lead.deletedAt === undefined && lead.archivedAt === undefined &&
          typeof lead.email === "string")
        .map((lead) => ({
          id: lead._id,
          email: lead.email!,
          createdAt: lead.createdAt,
          consentText: lead.consentText,
          consentVersion: lead.consentVersion,
          doubleOptInAt: lead.doubleOptInAt,
          source: lead.source,
        })),
    };
  },
});

/** Erase contact PII immediately; the tombstone blocks WP79 sender retries. */
export const deleteContact = mutation({
  args: { leadId: v.id("leads") },
  returns: v.object({ deleted: v.boolean() }),
  handler: async (ctx, args) => {
    const user = await requireCurrentPlatformUserForMutation(ctx);
    const lead = await ctx.db.get(args.leadId);
    if (lead === null || lead.ownerId !== user._id) {
      throw new ConvexError({ code: PLATFORM_AUTH_ERROR.notFound });
    }
    const project = await ctx.db.get(lead.projectId);
    if (project === null || project.ownerId !== user._id) {
      throw new ConvexError({ code: PLATFORM_AUTH_ERROR.notFound });
    }
    if (lead.deletedAt !== undefined) return { deleted: false };
    // The WP79 mutation cancels queued component mail and invalidates contact
    // tokens within this transaction. Let any error abort before PII erasure.
    await ctx.runMutation(internal.growth.email.contacts.revokeLeadContact, {
      leadId: lead._id,
    });
    const now = Date.now();
    await ctx.db.patch(lead._id, {
      email: undefined,
      payload: undefined,
      source: undefined,
      consentText: undefined,
      deletedAt: now,
      unsubscribedAt: now,
    });
    return { deleted: true };
  },
});
