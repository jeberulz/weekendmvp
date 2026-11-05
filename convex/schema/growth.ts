import { defineTable } from "convex/server";
import { v } from "convex/values";

export const growthTables = {
  sequences: defineTable({
    ownerId: v.id("users"),
    projectId: v.id("projects"),
    status: v.union(v.literal("draft"), v.literal("approved"), v.literal("active"), v.literal("paused")),
    title: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_ownerId_and_projectId", ["ownerId", "projectId"])
    .index("by_projectId", ["projectId"]),

  sequence_steps: defineTable({
    ownerId: v.id("users"),
    projectId: v.id("projects"),
    sequenceId: v.id("sequences"),
    order: v.int64(),
    delayHours: v.number(),
    subject: v.string(),
    documentId: v.id("documents"),
    approvalId: v.optional(v.id("approvals")),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_ownerId_and_projectId", ["ownerId", "projectId"])
    .index("by_sequenceId_and_order", ["sequenceId", "order"]),

  enrollments: defineTable({
    ownerId: v.id("users"),
    projectId: v.id("projects"),
    leadId: v.id("leads"),
    sequenceId: v.id("sequences"),
    nextStepAt: v.number(),
    state: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_ownerId_and_projectId", ["ownerId", "projectId"])
    .index("by_state_and_nextStepAt", ["state", "nextStepAt"]),

  email_sends: defineTable({
    ownerId: v.id("users"),
    projectId: v.id("projects"),
    enrollmentId: v.id("enrollments"),
    stepId: v.id("sequence_steps"),
    idempotencyKey: v.string(),
    resendId: v.optional(v.string()),
    status: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_ownerId_and_projectId", ["ownerId", "projectId"])
    .index("by_idempotencyKey", ["idempotencyKey"]),

  social_accounts: defineTable({
    ownerId: v.id("users"),
    projectId: v.id("projects"),
    platform: v.string(),
    connector: v.union(v.literal("copy"), v.literal("meta")),
    encryptedTokenRef: v.optional(v.string()),
    status: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_ownerId_and_projectId", ["ownerId", "projectId"])
    .index("by_projectId_and_status", ["projectId", "status"]),

  social_posts: defineTable({
    ownerId: v.id("users"),
    projectId: v.id("projects"),
    socialAccountId: v.optional(v.id("social_accounts")),
    documentId: v.optional(v.id("documents")),
    status: v.union(v.literal("draft"), v.literal("copy_ready"), v.literal("approved"), v.literal("scheduled"), v.literal("posted"), v.literal("failed")),
    scheduledFor: v.optional(v.number()),
    approvalId: v.optional(v.id("approvals")),
    externalId: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_ownerId_and_projectId", ["ownerId", "projectId"])
    .index("by_projectId_and_status", ["projectId", "status"])
    .index("by_status_and_scheduledFor", ["status", "scheduledFor"]),

  ad_campaigns: defineTable({
    ownerId: v.id("users"),
    projectId: v.id("projects"),
    platform: v.string(),
    objective: v.string(),
    dailyBudgetCents: v.int64(),
    status: v.string(),
    readiness: v.array(v.string()),
    decisionLog: v.array(v.string()),
    approvalId: v.optional(v.id("approvals")),
    externalId: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_ownerId_and_projectId", ["ownerId", "projectId"])
    .index("by_projectId_and_status", ["projectId", "status"]),

  outbound_lists: defineTable({
    ownerId: v.id("users"),
    projectId: v.id("projects"),
    name: v.string(),
    attestedAt: v.optional(v.number()),
    attestationText: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_ownerId_and_projectId", ["ownerId", "projectId"])
    .index("by_projectId", ["projectId"]),

  outbound_messages: defineTable({
    ownerId: v.id("users"),
    projectId: v.id("projects"),
    listId: v.id("outbound_lists"),
    documentId: v.optional(v.id("documents")),
    status: v.string(),
    approvalId: v.optional(v.id("approvals")),
    idempotencyKey: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_ownerId_and_projectId", ["ownerId", "projectId"])
    .index("by_projectId", ["projectId"]),
};
