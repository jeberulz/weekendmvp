import { v } from "convex/values";
import { internalMutation, type MutationCtx } from "./_generated/server";
import schema from "./schema";

/**
 * U9 seed pipeline — batched internal mutations called by
 * scripts/seed-convex.mjs via `npx convex run seed:<fn> '<json>'`.
 *
 * Each mutation upserts by slug, so re-running the seed script is a no-op
 * (idempotent). Batches are capped at MAX_BATCH items to stay well under
 * Convex argument size limits.
 *
 * These deliberately do NOT schedule Next.js cache revalidation (unlike
 * ideas.upsertBySlug / articles.upsertBySlug): the seed runs before cutover
 * and revalidating hundreds of tags per run is pointless churn. After the
 * site is live, content writes should go through the per-table upsertBySlug
 * mutations instead.
 */

export const MAX_BATCH = 25;

const ideaFields = schema.tables.ideas.validator.fields;
const articleFields = schema.tables.articles.validator.fields;
const issueFields = schema.tables.newsletter_issues.validator.fields;
const categoryFields = schema.tables.categories.validator.fields;
const revenueGoalFields = schema.tables.revenue_goals.validator.fields;
const audienceFields = schema.tables.audiences.validator.fields;
const buildTimeFields = schema.tables.build_times.validator.fields;
const toolFields = schema.tables.tools.validator.fields;
const problemFields = schema.tables.problems.validator.fields;

type SluggedTable =
  | "ideas"
  | "articles"
  | "newsletter_issues"
  | "categories"
  | "revenue_goals"
  | "audiences"
  | "build_times"
  | "tools"
  | "problems";

const counts = v.object({ inserted: v.number(), updated: v.number() });

async function upsertBySlug(
  ctx: MutationCtx,
  table: SluggedTable,
  items: Array<{ slug: string }>,
) {
  if (items.length > MAX_BATCH) {
    throw new Error(
      `seed batch too large: ${items.length} > ${MAX_BATCH} — split the batch`,
    );
  }
  let inserted = 0;
  let updated = 0;
  for (const item of items) {
    const existing = await ctx.db
      .query(table)
      .withIndex("by_slug", (q) => q.eq("slug", item.slug))
      .unique();
    if (existing) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await ctx.db.patch(existing._id, item as any);
      updated += 1;
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await ctx.db.insert(table, item as any);
      inserted += 1;
    }
  }
  return { inserted, updated };
}

export const seedIdeas = internalMutation({
  args: { items: v.array(v.object(ideaFields)) },
  returns: counts,
  handler: (ctx, { items }) => upsertBySlug(ctx, "ideas", items),
});

export const seedArticles = internalMutation({
  args: { items: v.array(v.object(articleFields)) },
  returns: counts,
  handler: (ctx, { items }) => upsertBySlug(ctx, "articles", items),
});

export const seedNewsletters = internalMutation({
  args: { items: v.array(v.object(issueFields)) },
  returns: counts,
  handler: (ctx, { items }) => upsertBySlug(ctx, "newsletter_issues", items),
});

export const seedReferenceTables = internalMutation({
  args: {
    categories: v.optional(v.array(v.object(categoryFields))),
    revenueGoals: v.optional(v.array(v.object(revenueGoalFields))),
    audiences: v.optional(v.array(v.object(audienceFields))),
    buildTimes: v.optional(v.array(v.object(buildTimeFields))),
    tools: v.optional(v.array(v.object(toolFields))),
    problems: v.optional(v.array(v.object(problemFields))),
  },
  returns: v.record(v.string(), counts),
  handler: async (ctx, args) => {
    const result: Record<string, { inserted: number; updated: number }> = {};
    const tables: Array<[keyof typeof args, SluggedTable]> = [
      ["categories", "categories"],
      ["revenueGoals", "revenue_goals"],
      ["audiences", "audiences"],
      ["buildTimes", "build_times"],
      ["tools", "tools"],
      ["problems", "problems"],
    ];
    for (const [argKey, table] of tables) {
      const items = args[argKey];
      if (items && items.length) {
        result[table] = await upsertBySlug(ctx, table, items);
      }
    }
    return result;
  },
});
