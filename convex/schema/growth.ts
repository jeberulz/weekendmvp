import { defineTable } from "convex/server";
import { v } from "convex/values";

export const growthTables = {
  business_email_settings: defineTable({
    ownerId: v.id("users"),
    projectId: v.id("projects"),
    fromName: v.string(),
    replyTo: v.string(),
    postalAddress: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_ownerId_and_projectId", ["ownerId", "projectId"])
    .index("by_projectId", ["projectId"]),

  lead_email_tokens: defineTable({
    ownerId: v.id("users"),
    projectId: v.id("projects"),
    leadId: v.id("leads"),
    purpose: v.union(v.literal("opt_in"), v.literal("unsubscribe")),
    tokenHash: v.string(),
    // Opt-in confirmation queued in the same transaction as this digest.
    componentEmailId: v.optional(v.string()),
    // Opt-in tokens expire; unsubscribe tokens remain usable until lead purge.
    expiresAt: v.optional(v.number()),
    usedAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_ownerId_and_projectId", ["ownerId", "projectId"])
    .index("by_leadId_and_purpose", ["leadId", "purpose"])
    .index("by_tokenHash", ["tokenHash"]),

  lead_retention_jobs: defineTable({
    ownerId: v.id("users"),
    projectId: v.id("projects"),
    // Set when the project is archived; retry backoff never changes this deadline.
    archivedAt: v.number(),
    deleteDueAt: v.number(),
    nextAttemptAt: v.number(),
    state: v.union(v.literal("scheduled"), v.literal("complete"), v.literal("cancelled")),
    attempts: v.number(),
    processedCount: v.number(),
    lastErrorCode: v.optional(v.string()),
    lastAttemptAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
    cancelledAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_projectId", ["projectId"])
    .index("by_ownerId_and_projectId", ["ownerId", "projectId"])
    .index("by_state_and_nextAttemptAt", ["state", "nextAttemptAt"]),

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
    .index("by_leadId", ["leadId"])
    .index("by_leadId_and_state", ["leadId", "state"])
    .index("by_state_and_nextStepAt", ["state", "nextStepAt"]),

  email_sends: defineTable({
    ownerId: v.id("users"),
    projectId: v.id("projects"),
    enrollmentId: v.id("enrollments"),
    stepId: v.id("sequence_steps"),
    idempotencyKey: v.string(),
    resendId: v.optional(v.string()),
    componentEmailId: v.optional(v.string()),
    lastAttemptAt: v.optional(v.number()),
    deliveredAt: v.optional(v.number()),
    failureCode: v.optional(v.string()),
    status: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_ownerId_and_projectId", ["ownerId", "projectId"])
    .index("by_idempotencyKey", ["idempotencyKey"])
    .index("by_enrollmentId", ["enrollmentId"])
    .index("by_componentEmailId", ["componentEmailId"])
    .index("by_ownerId_and_createdAt", ["ownerId", "createdAt"])
    .index("by_projectId_and_createdAt", ["projectId", "createdAt"]),

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
