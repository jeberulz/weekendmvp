import { defineTable } from "convex/server";
import { v } from "convex/values";

export const aiTables = {
  ai_usage: defineTable({
    ownerId: v.optional(v.id("users")),
    projectId: v.optional(v.id("projects")),
    taskId: v.optional(v.id("tasks")),
    attemptKey: v.string(),
    promptRef: v.string(),
    provider: v.string(),
    model: v.string(),
    tier: v.union(v.literal("fast"), v.literal("draft"), v.literal("deep"), v.literal("image"), v.literal("video")),
    feature: v.union(v.literal("ai"), v.literal("studioVideo")),
    plan: v.optional(v.union(v.literal("free"), v.literal("builders_hub"), v.literal("growth"))),
    globalPool: v.union(v.literal("free"), v.literal("paid")),
    creditFunded: v.boolean(),
    creditDebitId: v.optional(v.id("credit_ledger")),
    batch: v.optional(v.literal(true)),
    escalation: v.optional(v.literal(true)),
    reask: v.optional(v.literal(true)),
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
    dayKey: v.string(),
    expiresAt: v.number(),
    sentAt: v.optional(v.number()),
    finalizedAt: v.optional(v.number()),
    sweptAt: v.optional(v.number()),
    billed: v.optional(v.union(v.literal("none"), v.literal("possible"), v.literal("actual"))),
    errorClass: v.optional(v.union(v.literal("retryable"), v.literal("indeterminate"), v.literal("permanent"), v.literal("refusal"), v.literal("schema_invalid"), v.literal("timeout"))),
    lateCostMicroUsd: v.optional(v.int64()),
    settledAt: v.optional(v.number()),
  })
    .index("by_ownerId_and_createdAt", ["ownerId", "createdAt"])
    .index("by_status_and_createdAt", ["status", "createdAt"])
    .index("by_status_and_expiresAt", ["status", "expiresAt"])
    .index("by_attemptKey", ["attemptKey"])
    .index("by_projectId_and_createdAt", ["projectId", "createdAt"]),

  ai_budgets: defineTable({
    ownerId: v.id("users"),
    freeLifetimeSpentMicroUsd: v.int64(),
    reservedMicroUsd: v.int64(),
    freeReservedMicroUsd: v.int64(),
    dayKey: v.string(),
    daySpentMicroUsd: v.int64(),
    dayEscalations: v.int64(),
    updatedAt: v.number(),
  }).index("by_ownerId", ["ownerId"]),

  ops_settings: defineTable({
    ownerId: v.id("users"),
    singletonKey: v.literal("workspace"),
    workspaceEnabled: v.boolean(),
    cohortMode: v.union(v.literal("allowlist"), v.literal("open")),
    freeSignupsOpen: v.boolean(),
    globalDailyBudgetMicroUsd: v.int64(),
    paidGlobalDailyBudgetMicroUsd: v.int64(),
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
