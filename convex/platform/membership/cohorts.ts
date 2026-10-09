import { ConvexError, v } from "convex/values";
import { internalMutation, internalQuery } from "../../_generated/server";
import { COHORT_HASH_PATTERN } from "./cohortHash";
import { windowsInOrder } from "./offer";
import { countSeats } from "./state";
import { foundingCohortValidator } from "./validators";
import { FOUNDING_WINDOWS } from "./windows";

/**
 * WP63-S7. Operator-only writes for the founding offer cohorts. Internal, so
 * only a deploy key reaches them, through `scripts/membership-import-cohorts.mjs`
 * (dry run first, exact target, backup, confirmation). They take email
 * hashes, never addresses, and return counts, never rows.
 */

/** Hashes per call. The import script sends batches of this size. */
export const MAX_COHORT_BATCH = 200;

/** `{cohort}-{16 hex}`, the script's fingerprint of the whole file. */
const BATCH_ID_PATTERN = /^(buyers|newsletter)-[0-9a-f]{16}$/;

export const importBatch = internalMutation({
  args: { cohort: foundingCohortValidator, batchId: v.string(), emailHashes: v.array(v.string()) },
  returns: v.object({ inserted: v.number(), existing: v.number() }),
  handler: async (ctx, args) => {
    if (!BATCH_ID_PATTERN.test(args.batchId) || !args.batchId.startsWith(`${args.cohort}-`)) {
      throw new ConvexError({ code: "INVALID_BATCH_ID" });
    }
    if (args.emailHashes.length === 0 || args.emailHashes.length > MAX_COHORT_BATCH) {
      throw new ConvexError({ code: "INVALID_BATCH_SIZE" });
    }
    const unique = new Set(args.emailHashes);
    if (unique.size !== args.emailHashes.length || ![...unique].every((hash) => COHORT_HASH_PATTERN.test(hash))) {
      throw new ConvexError({ code: "INVALID_EMAIL_HASH" });
    }
    const now = Date.now();
    let inserted = 0;
    let existing = 0;
    for (const emailHash of unique) {
      const found = await ctx.db
        .query("offer_cohorts")
        .withIndex("by_cohort_and_emailHash", (q) => q.eq("cohort", args.cohort).eq("emailHash", emailHash))
        .first();
      if (found) {
        existing += 1;
        continue;
      }
      await ctx.db.insert("offer_cohorts", { cohort: args.cohort, emailHash, importedAt: now, batchId: args.batchId });
      inserted += 1;
    }
    return { inserted, existing };
  },
});

/** Undoes one import, a page at a time. Run it until `more` is false. */
export const removeBatch = internalMutation({
  args: { batchId: v.string() },
  returns: v.object({ removed: v.number(), more: v.boolean() }),
  handler: async (ctx, args) => {
    if (!BATCH_ID_PATTERN.test(args.batchId)) throw new ConvexError({ code: "INVALID_BATCH_ID" });
    const rows = await ctx.db
      .query("offer_cohorts")
      .withIndex("by_batchId", (q) => q.eq("batchId", args.batchId))
      .take(MAX_COHORT_BATCH + 1);
    const page = rows.slice(0, MAX_COHORT_BATCH);
    for (const row of page) await ctx.db.delete("offer_cohorts", row._id);
    return { removed: page.length, more: rows.length > MAX_COHORT_BATCH };
  },
});

/**
 * For the S12 launch checklist: the seat counter must read 50 free with
 * nothing held or taken once the smoke purchases are refunded, and the
 * windows must be dated in order.
 */
export const launchCheck = internalQuery({
  args: {},
  returns: v.object({
    seats: v.object({ free: v.number(), reserved: v.number(), taken: v.number(), overflow: v.boolean() }),
    windows: v.object({
      buyers: v.union(v.number(), v.null()),
      newsletter: v.union(v.number(), v.null()),
      everyone: v.union(v.number(), v.null()),
    }),
    windowsInOrder: v.boolean(),
  }),
  handler: async (ctx) => ({
    seats: await countSeats(ctx),
    windows: { ...FOUNDING_WINDOWS },
    windowsInOrder: windowsInOrder(),
  }),
});
