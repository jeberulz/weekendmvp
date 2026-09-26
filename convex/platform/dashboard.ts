import { normalizeEmail } from "../authEmail";
import { paginationOptsValidator, paginationResultValidator } from "convex/server";
import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import { mutation, query, type QueryCtx } from "../_generated/server";
import { PLATFORM_AUTH_ERROR, requireCurrentPlatformUser, requireCurrentPlatformUserForMutation } from "./authz";
import { ideaCardValidator, meanScore, readSavedIntents, toIdeaCard } from "./ideaCards";
import { readPreferences } from "./preferences";
import { getEntitlements } from "./entitlements";
import { notesFor } from "./notes";
import { OFFER_IDS, chooseOffer, isKitClaim } from "../../lib/dashboard/offers";
import { activePlanForIdea, activePlanOf, activePlansOf, latestDonePlanOf, planSummaryValidator, summarize } from "./weekendPlans";

/**
 * WP44 dashboard data. Owner-scoped: identity always comes from the session,
 * never from an argument. Editorial data (idea of the week, newest ideas) is
 * not here. It comes from the same cached loader as the homepage.
 */

/** Nav badges read "99+" past this, so there is no reason to read further. */
export const SAVED_COUNT_CAP = 99;
const LATEST_SAVED_READ = 8;
const LATEST_SAVED_RESULT = 5;
/** The Saved page reads at most this many saves. The library is smaller. */
export const SAVED_LIST_CAP = 500;
/** The Saved page can page through every save it reads. */
const MAX_SAVED_LIST_LIMIT = SAVED_LIST_CAP;

const savedIdeaValidator = v.object({
  ideaId: v.id("ideas"),
  slug: v.string(),
  title: v.string(),
  category: v.string(),
  buildTime: v.string(),
  revenueGoal: v.string(),
  tools: v.array(v.string()),
  /** Mean of the four research scores, one decimal. Null when unscored. */
  score: v.union(v.number(), v.null()),
  updatedAt: v.number(),
});

const homeValidator = v.object({
  firstName: v.union(v.string(), v.null()),
  saved: v.object({
    /** Exact up to SAVED_COUNT_CAP. */
    count: v.number(),
    /** True when there are more than SAVED_COUNT_CAP saved ideas. */
    capped: v.boolean(),
    latest: v.array(savedIdeaValidator),
  }),
  /** The setup questions were answered (WP44-S8). */
  setupDone: v.boolean(),
  /** The member chose "Skip for now" (ruling R7). */
  setupSkipped: v.boolean(),
  /** The active weekend plan (WP44-S9), or null. */
  activePlan: v.union(planSummaryValidator, v.null()),
  /** The most recently finished plan. Home shows "You shipped" for a week. */
  lastFinished: v.union(planSummaryValidator, v.null()),
  /** From entitlements (WP44-S10). Free for everyone until the subscription WP. */
  plan: v.union(v.literal("free"), v.literal("builders_hub")),
});

function firstNameOf(user: Doc<"users">): string | null {
  const full = (user.displayName ?? user.name ?? "").trim();
  if (full === "") return null;
  return full.split(/\s+/)[0] ?? null;
}

export const home = query({
  args: {},
  returns: homeValidator,
  handler: async (ctx) => {
    const user = await requireCurrentPlatformUser(ctx);

    // Ruling R3: Saved shows ideas marked saved or interested.
    const [{ rows: newestFirst, capped }, prefs, active, lastDone, { plan }] = await Promise.all([
      readSavedIntents(ctx, user._id, SAVED_COUNT_CAP),
      readPreferences(ctx, user._id),
      activePlanOf(ctx, user._id),
      latestDonePlanOf(ctx, user._id),
      getEntitlements(ctx, user._id),
    ]);

    const latest = (
      await Promise.all(
        newestFirst.slice(0, LATEST_SAVED_READ).map(async (intent) => {
          const idea = await ctx.db.get("ideas", intent.ideaId);
          if (idea === null) return null;
          return {
            ideaId: idea._id,
            slug: idea.slug,
            title: idea.title,
            category: idea.category,
            buildTime: idea.buildTime,
            revenueGoal: idea.revenueGoal,
            tools: idea.tools.slice(0, 4),
            score: meanScore(idea),
            updatedAt: intent.updatedAt,
          };
        }),
      )
    )
      .filter((row) => row !== null)
      .slice(0, LATEST_SAVED_RESULT);

    return {
      firstName: firstNameOf(user),
      saved: {
        count: newestFirst.length,
        capped,
        latest,
      },
      setupDone: prefs?.onboardedAt !== undefined,
      setupSkipped: prefs?.skippedAt !== undefined,
      activePlan: active ? await summarize(ctx, active) : null,
      lastFinished: lastDone ? await summarize(ctx, lastDone) : null,
      plan,
    };
  },
});

async function ideaBySlug(ctx: QueryCtx, slug: string) {
  return await ctx.db
    .query("ideas")
    .withIndex("by_slug", (q) => q.eq("slug", slug))
    .unique();
}

async function ownerIntentFor(
  ctx: QueryCtx,
  ownerId: Id<"users">,
  ideaId: Id<"ideas">,
) {
  return await ctx.db
    .query("idea_intents")
    .withIndex("by_ownerId_and_ideaId", (q) =>
      q.eq("ownerId", ownerId).eq("ideaId", ideaId),
    )
    .unique();
}

/**
 * Whether the signed-in member has this idea in Saved. Keyed by slug because
 * editorial cards come from the manifest, not Convex. Null when the idea is
 * not in Convex yet (published but not seeded), so the button can hide.
 */
export const savedState = query({
  args: { slug: v.string() },
  returns: v.union(v.object({ saved: v.boolean(), version: v.number() }), v.null()),
  handler: async (ctx, args) => {
    const user = await requireCurrentPlatformUser(ctx);
    const idea = await ideaBySlug(ctx, args.slug);
    if (idea === null) return null;
    const intent = await ownerIntentFor(ctx, user._id, idea._id);
    // Ruling R3: Interested reads as Saved on screen.
    return {
      saved: (intent?.saved ?? false) || (intent?.interested ?? false),
      version: intent?.saveVersion ?? 0,
    };
  },
});

/**
 * The one Save toggle on screen. Saving sets `saved`. Removing clears both
 * flags (ruling R3), so an idea never lingers in Saved as Interested.
 */
export const setSaved = mutation({
  args: { slug: v.string(), saved: v.boolean(), expectedVersion: v.optional(v.number()) },
  returns: v.object({ saved: v.boolean(), version: v.number() }),
  handler: async (ctx, args) => {
    const user = await requireCurrentPlatformUserForMutation(ctx);
    const idea = await ideaBySlug(ctx, args.slug);
    if (idea === null) {
      throw new ConvexError({ code: PLATFORM_AUTH_ERROR.notFound });
    }
    const existing = await ownerIntentFor(ctx, user._id, idea._id);
    const version = existing?.saveVersion ?? 0;
    if (args.expectedVersion !== undefined) {
      if (!Number.isSafeInteger(args.expectedVersion) || args.expectedVersion < 0)
        throw new ConvexError({ code: "INVALID_VERSION" });
      if (args.expectedVersion !== version) {
        throw new ConvexError({
          code: "SAVE_CONFLICT",
          saved: Boolean(existing?.saved || existing?.interested),
          version,
        });
      }
    }
    const nextVersion = version + 1;
    const updatedAt = Date.now();
    const next = args.saved
      ? { saved: true, interested: existing?.interested ?? false }
      : { saved: false, interested: false };

    if (existing === null) {
      // Even an unsave of an absent row writes a version fence: a delayed
      // earlier Save carrying the old version must not resurrect it.
      await ctx.db.insert("idea_intents", {
        ownerId: user._id,
        ideaId: idea._id,
        ...next,
        saveVersion: nextVersion,
        updatedAt,
      });
    } else {
      await ctx.db.patch("idea_intents", existing._id, {
        ...next,
        saveVersion: nextVersion,
        updatedAt,
      });
    }
    return { saved: args.saved, version: nextVersion };
  },
});

/**
 * The Saved page (WP44-S5): ideas marked saved or interested (R3), newest
 * save first. `total` is exact up to SAVED_LIST_CAP.
 */
export const savedList = query({
  args: { limit: v.number() },
  returns: v.object({
    items: v.array(
      v.object({
        card: ideaCardValidator,
        savedAt: v.number(),
        /** The member's private note (WP44-S11), or null. */
        note: v.union(v.string(), v.null()),
      }),
    ),
    total: v.number(),
    capped: v.boolean(),
    /**
     * More saves past this page. From the saves, not the rows returned, so a
     * save whose idea is gone never leaves "Show more" doing nothing.
     */
    hasMore: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const user = await requireCurrentPlatformUser(ctx);
    const limit = Math.max(1, Math.min(Math.floor(args.limit) || 1, MAX_SAVED_LIST_LIMIT));
    const [{ rows, capped }, active] = await Promise.all([
      readSavedIntents(ctx, user._id, SAVED_LIST_CAP),
      activePlansOf(ctx, user._id),
    ]);
    const building = new Set(active.map((plan) => plan.ideaId));
    const page = rows.slice(0, limit);
    const notes = await notesFor(
      ctx,
      user._id,
      page.map((row) => row.ideaId),
    );
    const items = (
      await Promise.all(
        page.map(async (row) => {
          const idea = await ctx.db.get("ideas", row.ideaId);
          if (idea === null) return null;
          const card = toIdeaCard(idea, true, null, building.has(idea._id));
          return { card, savedAt: row.updatedAt, note: notes.get(idea._id) ?? null };
        }),
      )
    ).filter((item) => item !== null);
    return { items, total: rows.length, capped, hasMore: rows.length > limit };
  },
});

const offerValidator = v.object({
  id: v.string(),
  kind: v.union(v.literal("starter_kit"), v.literal("promo")),
  eyebrow: v.string(),
  title: v.string(),
  body: v.string(),
  items: v.array(v.string()),
  cta: v.object({ label: v.string(), href: v.string() }),
});

/** Bounded: a member's email appears in only a few subscription events. */
const KIT_CLAIM_READ = 20;
const LEGACY_CLAIM_READ = 500;

/**
 * WP44-S12 offer card (PRD 6.2, R6 and R8): at most one, or none. Chosen on
 * the server, where the member's email is checked against the subscription
 * log. Only the offer leaves the server, never the email. The client passes
 * `now` (queries must not read the clock); it only picks among public offers.
 */
export const offer = query({
  args: { now: v.number() },
  returns: v.union(offerValidator, v.null()),
  handler: async (ctx, args) => {
    const user = await requireCurrentPlatformUser(ctx);
    const email = user.email ? normalizeEmail(user.email) : undefined;
    const [prefs, { plan }] = await Promise.all([
      readPreferences(ctx, user._id),
      getEntitlements(ctx, user._id),
    ]);
    let kitClaimed = false;
    if (email) {
      // Preserve the cheap canonical lookup for old rows written before the
      // derived key existed; use the new key for normalized legacy variants.
      const canonical = await ctx.db
        .query("subscriptions")
        .withIndex("by_email", (q) => q.eq("email", email))
        .take(KIT_CLAIM_READ + 1);
      kitClaimed = canonical.some(isKitClaim);
      if (!kitClaimed) {
        const normalized = await ctx.db
          .query("subscriptions")
          .withIndex("by_normalizedEmail", (q) => q.eq("normalizedEmail", email))
          .take(KIT_CLAIM_READ + 1);
        kitClaimed = normalized.some(isKitClaim);
        if (!kitClaimed) {
          const legacy = await ctx.db
            .query("subscriptions")
            .withIndex("by_normalizedEmail", (q) => q.eq("normalizedEmail", undefined))
            .take(LEGACY_CLAIM_READ + 1);
          // Until the operator backfill completes, an incomplete scan only
          // suppresses the kit. Public promos remain eligible for selection.
          kitClaimed =
            legacy.some((row) => normalizeEmail(row.email) === email && isKitClaim(row)) ||
            canonical.length > KIT_CLAIM_READ ||
            normalized.length > KIT_CLAIM_READ ||
            legacy.length > LEGACY_CLAIM_READ;
        }
      }
    }
    return chooseOffer({
      now: args.now,
      joinedAt: user._creationTime,
      plan,
      kitClaimed,
      dismissed: (prefs?.dismissed ?? []).filter((id) => OFFER_IDS.has(id)),
    });
  },
});

/** All saves, including legacy Interested, with stable native continuation. */
export const savedPage = query({
  args: { paginationOpts: paginationOptsValidator },
  returns: paginationResultValidator(
    v.object({ card: ideaCardValidator, savedAt: v.number(), note: v.union(v.string(), v.null()) }),
  ),
  handler: async (ctx, args) => {
    const user = await requireCurrentPlatformUser(ctx);
    const result = await ctx.db
      .query("idea_intents")
      .withIndex("by_ownerId_and_updatedAt", (q) => q.eq("ownerId", user._id))
      .order("desc")
      .filter((q) => q.or(q.eq(q.field("saved"), true), q.eq(q.field("interested"), true)))
      // Bound the scan before the sparse Saved filter while preserving native
      // cursor/endCursor options used by reactive page splitting.
      .paginate({
        ...args.paginationOpts,
        maximumRowsRead: Math.min(args.paginationOpts.maximumRowsRead ?? 200, 200),
      });
    const notes = await notesFor(
      ctx,
      user._id,
      result.page.map((row) => row.ideaId),
    );
    const page = (
      await Promise.all(
        result.page.map(async (row) => {
          const idea = await ctx.db.get("ideas", row.ideaId);
          if (!idea) return null;
          const building = Boolean(await activePlanForIdea(ctx, user._id, idea._id));
          return {
            card: toIdeaCard(idea, true, null, building),
            savedAt: row.updatedAt,
            note: notes.get(idea._id) ?? null,
          };
        }),
      )
    ).filter((item) => item !== null);
    return { ...result, page };
  },
});

/** Fresh, server-verified membership for Next routes. A mutation avoids a
 * cached time-dependent session-expiry decision; it does not write data. */
export const requireMember = mutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    await requireCurrentPlatformUserForMutation(ctx);
    return null;
  },
});
