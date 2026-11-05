import { defineTable } from "convex/server";
import { v } from "convex/values";

export const workspaceTables = {
  wizard_sessions: defineTable({
    ownerId: v.id("users"),
    ideaSlug: v.optional(v.string()),
    ownIdeaText: v.optional(v.string()),
    step: v.string(),
    answers: v.record(v.string(), v.any()),
    startedAt: v.number(),
    updatedAt: v.number(),
    completedAt: v.optional(v.number()),
    abandonedAt: v.optional(v.number()),
    projectId: v.optional(v.id("projects")),
  })
    .index("by_ownerId_and_updatedAt", ["ownerId", "updatedAt"])
    .index("by_ownerId_and_projectId", ["ownerId", "projectId"]),

  founder_signals: defineTable({
    ownerId: v.id("users"),
    wizardSessionId: v.id("wizard_sessions"),
    projectId: v.optional(v.id("projects")),
    step: v.string(),
    action: v.union(v.literal("kept"), v.literal("changed"), v.literal("skipped"), v.literal("rewrote")),
    before: v.optional(v.string()),
    after: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_ownerId_and_createdAt", ["ownerId", "createdAt"])
    .index("by_step_and_action", ["step", "action"]),

  roster_plans: defineTable({
    ownerId: v.id("users"),
    projectId: v.id("projects"),
    rulesVersion: v.string(),
    hired: v.array(v.string()),
    skipped: v.array(v.object({ roleKey: v.string(), reason: v.string() })),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_ownerId_and_projectId", ["ownerId", "projectId"])
    .index("by_projectId", ["projectId"]),

  crew_members: defineTable({
    ownerId: v.id("users"),
    projectId: v.id("projects"),
    roleKey: v.string(),
    displayName: v.string(),
    status: v.union(v.literal("queued"), v.literal("working"), v.literal("needs_you"), v.literal("done"), v.literal("skipped")),
    hiredBy: v.union(v.literal("rule"), v.literal("founder")),
    autopilot: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_ownerId_and_projectId", ["ownerId", "projectId"])
    .index("by_projectId_and_roleKey", ["projectId", "roleKey"]),

  workstreams: defineTable({
    ownerId: v.id("users"),
    projectId: v.id("projects"),
    employeeId: v.id("crew_members"),
    title: v.string(),
    status: v.string(),
    blocker: v.optional(v.string()),
    askApprovalId: v.optional(v.id("approvals")),
    documentIds: v.array(v.id("documents")),
    fileIds: v.array(v.id("business_files")),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_ownerId_and_projectId", ["ownerId", "projectId"])
    .index("by_projectId_and_employeeId", ["projectId", "employeeId"]),

  launch_plan_items: defineTable({
    ownerId: v.id("users"),
    projectId: v.id("projects"),
    ownerEmployeeId: v.id("crew_members"),
    title: v.string(),
    day: v.union(v.literal("thu"), v.literal("fri"), v.literal("sat"), v.literal("sun"), v.literal("mon")),
    order: v.int64(),
    status: v.string(),
    approvalId: v.optional(v.id("approvals")),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_ownerId_and_projectId", ["ownerId", "projectId"])
    .index("by_projectId_and_order", ["projectId", "order"]),

  approvals: defineTable({
    ownerId: v.id("users"),
    projectId: v.id("projects"),
    kind: v.union(v.literal("artifact_review"), v.literal("send"), v.literal("post"), v.literal("publish"), v.literal("spend"), v.literal("ad_launch"), v.literal("upgrade")),
    subjectTable: v.string(),
    subjectId: v.string(),
    status: v.union(v.literal("pending"), v.literal("approved"), v.literal("changes_requested"), v.literal("expired"), v.literal("cancelled")),
    changeRound: v.int64(),
    costCredits: v.optional(v.int64()),
    note: v.optional(v.string()),
    decidedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_ownerId_and_projectId", ["ownerId", "projectId"])
    .index("by_projectId_and_status", ["projectId", "status"])
    .index("by_subjectId", ["subjectId"]),

  chat_messages: defineTable({
    ownerId: v.id("users"),
    projectId: v.id("projects"),
    author: v.union(v.literal("wren"), v.literal("founder"), v.literal("system")),
    body: v.string(),
    status: v.union(v.literal("streaming"), v.literal("done"), v.literal("failed")),
    cardApprovalIds: v.array(v.id("approvals")),
    usageId: v.optional(v.id("ai_usage")),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_ownerId_and_projectId", ["ownerId", "projectId"])
    .index("by_projectId_and_createdAt", ["projectId", "createdAt"]),

  wren_memory: defineTable({
    ownerId: v.id("users"),
    projectId: v.id("projects"),
    facts: v.array(v.string()),
    summary: v.string(),
    updatedAt: v.number(),
  })
    .index("by_ownerId_and_projectId", ["ownerId", "projectId"])
    .index("by_projectId", ["projectId"]),

  business_files: defineTable({
    ownerId: v.id("users"),
    projectId: v.id("projects"),
    storageId: v.id("_storage"),
    kind: v.union(v.literal("logo"), v.literal("hero"), v.literal("offer_image"), v.literal("post_image"), v.literal("video"), v.literal("upload")),
    mime: v.string(),
    bytes: v.number(),
    alt: v.optional(v.string()),
    sourceTaskId: v.optional(v.id("tasks")),
    createdAt: v.number(),
  })
    .index("by_ownerId_and_projectId", ["ownerId", "projectId"])
    .index("by_projectId_and_kind", ["projectId", "kind"]),

  provider_jobs: defineTable({
    ownerId: v.id("users"),
    projectId: v.id("projects"),
    taskId: v.id("tasks"),
    provider: v.string(),
    externalId: v.string(),
    status: v.string(),
    pollAfter: v.number(),
    attempts: v.int64(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_ownerId_and_projectId", ["ownerId", "projectId"])
    .index("by_status_and_pollAfter", ["status", "pollAfter"]),

  idea_crew_seeds: defineTable({
    ownerId: v.id("users"),
    projectId: v.optional(v.id("projects")),
    ideaSlug: v.string(),
    seedVersion: v.string(),
    blueprint: v.any(),
    brandSeeds: v.any(),
    landingSeeds: v.any(),
    emailAngles: v.any(),
    socialAngles: v.any(),
    buildPackSeeds: v.any(),
    promptRefs: v.array(v.string()),
    createdAt: v.number(),
  })
    .index("by_ownerId", ["ownerId"])
    .index("by_ideaSlug_and_seedVersion", ["ideaSlug", "seedVersion"]),

  business_members: defineTable({
    ownerId: v.id("users"),
    projectId: v.id("projects"),
    userId: v.id("users"),
    role: v.union(v.literal("owner"), v.literal("editor")),
    invitedBy: v.id("users"),
    acceptedAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_ownerId_and_projectId", ["ownerId", "projectId"])
    .index("by_projectId", ["projectId"])
    .index("by_userId", ["userId"]),
};
