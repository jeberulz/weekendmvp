import { defineTable } from "convex/server";
import { v } from "convex/values";

export const aiTables = {
  ai_usage: defineTable({
    ownerId: v.optional(v.id("users")),
    projectId: v.optional(v.id("projects")),
    taskId: v.optional(v.id("tasks")),
    promptRef: v.string(),
    provider: v.string(),
    model: v.string(),
    tier: v.union(v.literal("fast"), v.literal("draft"), v.literal("deep")),
    status: v.union(v.literal("reserved"), v.literal("settled"), v.literal("failed")),
    reservedMicroUsd: v.int64(),
    costMicroUsd: v.int64(),
    inputTokens: v.int64(),
    cacheReadTokens: v.int64(),
    cacheWriteTokens: v.int64(),
    outputTokens: v.int64(),
    images: v.optional(v.int64()),
    videoSeconds: v.optional(v.number()),
    estimated: v.boolean(),
    latencyMs: v.number(),
    stopReason: v.optional(v.string()),
    createdAt: v.number(),
    settledAt: v.optional(v.number()),
  })
    .index("by_ownerId_and_createdAt", ["ownerId", "createdAt"])
    .index("by_status_and_createdAt", ["status", "createdAt"])
    .index("by_projectId_and_createdAt", ["projectId", "createdAt"]),

  ai_budgets: defineTable({
    ownerId: v.id("users"),
    freeLifetimeSpentMicroUsd: v.int64(),
    reservedMicroUsd: v.int64(),
    dayKey: v.string(),
    daySpentMicroUsd: v.int64(),
    updatedAt: v.number(),
  }).index("by_ownerId", ["ownerId"]),

  ops_settings: defineTable({
    ownerId: v.id("users"),
    singletonKey: v.literal("workspace"),
    workspaceEnabled: v.boolean(),
    cohortMode: v.union(v.literal("allowlist"), v.literal("open")),
    freeSignupsOpen: v.boolean(),
    globalDailyBudgetMicroUsd: v.int64(),
    killSwitches: v.object({
      ai: v.boolean(),
      studioVideo: v.boolean(),
      publish: v.boolean(),
      email: v.boolean(),
      social: v.boolean(),
      ads: v.boolean(),
    }),
    updatedAt: v.number(),
  })
    .index("by_ownerId", ["ownerId"])
    .index("by_singletonKey", ["singletonKey"]),

  workspace_cohort: defineTable({
    ownerId: v.id("users"),
    addedBy: v.id("users"),
    addedAt: v.number(),
  }).index("by_ownerId", ["ownerId"]),
};
