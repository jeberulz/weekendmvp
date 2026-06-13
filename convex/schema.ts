import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

// Initial schema (U1) — expanded with queries/indexes in U2.
// `users` and `saved_ideas` are reserved for the future auth layer (Clerk +
// ConvexProviderWithClerk); nothing reads or writes them in this migration.
export default defineSchema({
  ideas: defineTable({
    slug: v.string(),
    title: v.string(),
    description: v.string(),
    summary: v.optional(v.string()),
    publishedAt: v.number(),
    category: v.string(),
    buildTime: v.string(),
    revenueGoal: v.string(),
    applicationCategory: v.string(),
    tools: v.array(v.string()),
    audiences: v.array(v.string()),
    source: v.optional(v.string()),
    scores: v.optional(
      v.object({
        opportunity: v.number(),
        pain: v.number(),
        timing: v.number(),
        builder_confidence: v.number(),
      }),
    ),
    og: v.optional(
      v.object({
        subject: v.optional(v.string()),
        accent: v.optional(v.string()),
        status: v.optional(v.string()),
      }),
    ),
    provenance: v.optional(v.any()),
    researchLevel: v.optional(v.string()),
    bodyMode: v.union(v.literal("mdx"), v.literal("convex")),
    body: v.optional(v.string()),
  })
    .index("by_slug", ["slug"])
    .index("by_publishedAt", ["publishedAt"])
    .index("by_category_publishedAt", ["category", "publishedAt"])
    .index("by_revenueGoal_publishedAt", ["revenueGoal", "publishedAt"]),

  articles: defineTable({
    slug: v.string(),
    title: v.string(),
    description: v.string(),
    publishedAt: v.optional(v.number()),
    wordCount: v.optional(v.number()),
    readMinutes: v.optional(v.number()),
    og: v.optional(v.any()),
  })
    .index("by_slug", ["slug"])
    .index("by_publishedAt", ["publishedAt"]),

  newsletter_issues: defineTable({
    slug: v.string(),
    title: v.string(),
    publishedAt: v.number(),
    edition: v.union(v.literal("am"), v.literal("pm")),
    description: v.optional(v.string()),
    og: v.optional(v.any()),
  })
    .index("by_slug", ["slug"])
    .index("by_publishedAt", ["publishedAt"]),

  categories: defineTable({
    slug: v.string(),
    name: v.optional(v.string()),
    displayName: v.optional(v.string()),
    description: v.optional(v.string()),
    icon: v.optional(v.string()),
    color: v.optional(v.string()),
    filters: v.optional(v.any()),
    keywords: v.optional(v.any()),
    traits: v.optional(v.array(v.any())),
    resources: v.optional(v.array(v.any())),
    faqs: v.optional(
      v.array(v.object({ question: v.string(), answer: v.string() })),
    ),
  }).index("by_slug", ["slug"]),

  revenue_goals: defineTable({
    slug: v.string(),
    name: v.optional(v.string()),
    displayName: v.optional(v.string()),
    description: v.optional(v.string()),
    icon: v.optional(v.string()),
    amount: v.optional(v.number()),
    methodology: v.optional(v.string()),
    unitEconomics: v.optional(v.any()),
    filters: v.optional(v.any()),
    keywords: v.optional(v.any()),
    traits: v.optional(v.array(v.any())),
    resources: v.optional(v.array(v.any())),
  }).index("by_slug", ["slug"]),

  audiences: defineTable({
    slug: v.string(),
    name: v.optional(v.string()),
    displayName: v.optional(v.string()),
    description: v.optional(v.string()),
    icon: v.optional(v.string()),
    filters: v.optional(v.any()),
    keywords: v.optional(v.any()),
    traits: v.optional(v.array(v.any())),
    resources: v.optional(v.array(v.any())),
  }).index("by_slug", ["slug"]),

  build_times: defineTable({
    slug: v.string(),
    name: v.optional(v.string()),
    displayName: v.optional(v.string()),
    description: v.optional(v.string()),
    icon: v.optional(v.string()),
    hours: v.optional(v.number()),
    filters: v.optional(v.any()),
    keywords: v.optional(v.any()),
    traits: v.optional(v.array(v.any())),
    resources: v.optional(v.array(v.any())),
  }).index("by_slug", ["slug"]),

  tools: defineTable({
    slug: v.string(),
    name: v.optional(v.string()),
    displayName: v.optional(v.string()),
    description: v.optional(v.string()),
    icon: v.optional(v.string()),
    tagline: v.optional(v.string()),
    logo: v.optional(v.string()),
    url: v.optional(v.string()),
    strengths: v.optional(v.array(v.string())),
    bestFor: v.optional(v.array(v.string())),
    gettingStarted: v.optional(v.array(v.string())),
    keywords: v.optional(v.any()),
    resources: v.optional(v.array(v.any())),
  }).index("by_slug", ["slug"]),

  problems: defineTable({
    slug: v.string(),
    displayName: v.optional(v.string()),
    description: v.optional(v.string()),
    keywords: v.optional(v.any()),
  }).index("by_slug", ["slug"]),

  subscriptions: defineTable({
    email: v.string(),
    source: v.string(),
    automationIds: v.array(v.string()),
    utm: v.optional(
      v.object({
        campaign: v.optional(v.string()),
        source: v.optional(v.string()),
        medium: v.optional(v.string()),
      }),
    ),
    beehiivStatus: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_email", ["email"])
    .index("by_createdAt", ["createdAt"]),

  stripe_events: defineTable({
    stripeEventId: v.string(),
    type: v.string(),
    email: v.optional(v.string()),
    customerId: v.optional(v.string()),
    amount: v.optional(v.number()),
    currency: v.optional(v.string()),
    paymentLinkId: v.optional(v.string()),
    rawPayload: v.optional(v.string()),
    createdAt: v.number(),
  }).index("by_stripeEventId", ["stripeEventId"]),

  // ===== Reserved for future auth layer — intentionally unused today =====
  users: defineTable({
    tokenIdentifier: v.string(),
    email: v.string(),
    displayName: v.optional(v.string()),
    stripeCustomerId: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_token", ["tokenIdentifier"])
    .index("by_email", ["email"]),

  saved_ideas: defineTable({
    userId: v.id("users"),
    ideaId: v.id("ideas"),
    savedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_idea", ["userId", "ideaId"]),
});
