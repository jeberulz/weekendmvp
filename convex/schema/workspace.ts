import { defineTable } from "convex/server";
import { v } from "convex/values";

// Mirrors WP69 C-WIZARD's in-progress answer shape. Writers must parse with
// wizardAnswersProgressSchema or wizardAnswersSchema before inserting a row.
const founderSignal = v.object({
  signal: v.union(v.literal("kept"), v.literal("edited")),
  note: v.optional(v.string()),
});

const wizardAnswers = v.object({
  idea: v.optional(v.union(
    v.object({ source: v.literal("library"), ideaSlug: v.string() }),
    v.object({ source: v.literal("own_idea"), text: v.string() }),
  )),
  blueprintDecision: v.optional(v.union(
    v.object({ decision: v.literal("looks_good") }),
    v.object({ decision: v.literal("rework"), notes: v.optional(v.string()) }),
  )),
  platform: v.optional(v.union(
    v.object({ kind: v.literal("native") }),
    v.object({ kind: v.literal("web") }),
    v.object({ kind: v.literal("custom"), description: v.string() }),
  )),
  commercialModel: v.optional(v.union(
    v.literal("free"), v.literal("freemium"), v.literal("subscription"), v.literal("one_time"),
  )),
  goal: v.optional(v.object({
    kind: v.union(v.literal("waitlist"), v.literal("first_sale"), v.literal("mrr_500"), v.literal("replace_income"), v.literal("just_testing")),
    timeframe: v.union(v.literal("weekend"), v.literal("2w"), v.literal("30d"), v.literal("none")),
    paidPush: v.optional(v.union(v.object({ dailyBudgetUsd: v.number() }), v.null())),
  })),
  name: v.optional(v.object({ chosen: v.string(), alternatives: v.array(v.string()) })),
  partnerPersonality: v.optional(v.union(
    v.literal("hustler"), v.literal("strategist"), v.literal("creative"), v.literal("operator"),
  )),
  partnerName: v.optional(v.union(
    v.object({ kind: v.literal("preset"), name: v.union(v.literal("Wren"), v.literal("Juno"), v.literal("Ridge")) }),
    v.object({ kind: v.literal("custom"), name: v.string() }),
  )),
  signals: v.optional(v.object({
    idea: v.optional(founderSignal),
    blueprint: v.optional(founderSignal),
    platform: v.optional(founderSignal),
    commercial_model: v.optional(founderSignal),
    goal: v.optional(founderSignal),
    name: v.optional(founderSignal),
    partner_personality: v.optional(founderSignal),
    partner_name: v.optional(founderSignal),
  })),
});

export const workspaceTables = {
  wizard_sessions: defineTable({
    ownerId: v.id("users"),
    ideaSlug: v.optional(v.string()),
    ownIdeaText: v.optional(v.string()),
    step: v.string(),
    answers: wizardAnswers,
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
    // WP77 C-APPROVAL: content fingerprint, stable across status-only changes.
    // Optional so existing approvals remain valid under their existing rules.
    subjectVersion: v.optional(v.string()),
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
    .index("by_subjectId", ["subjectId"])
    .index("by_status_and_createdAt", ["status", "createdAt"]),

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
    /** WP90-S3, additive: the wizard's suggested answers (C-SEED `wizardHintsSchema`). */
    wizardHints: v.optional(v.any()),
    /** WP90-S3, additive: outbound and SEO briefs (C-SEED `roleBriefsSchema`). */
    roleBriefs: v.optional(v.any()),
    /** WP90-S3, additive: from the idea's research level, never from the model. */
    validated: v.optional(v.boolean()),
    /** WP90-S3, additive: SHA-256 of the seed source the batch was sent, so an unchanged page is not re-run. */
    sourceHash: v.optional(v.string()),
    /** WP90-S3, additive: the precompute run that wrote the row. */
    runId: v.optional(v.id("idea_seed_runs")),
    promptRefs: v.array(v.string()),
    createdAt: v.number(),
  })
    .index("by_ownerId", ["ownerId"])
    .index("by_ideaSlug_and_seedVersion", ["ideaSlug", "seedVersion"]),

  /**
   * WP90-S3. One per-idea seed precompute run: one Message Batch of
   * `crew-idea-seed` requests, all at one `seedVersion`. Written only by
   * `convex/crew/seeds.ts`; operator-run (`scripts/crew-seeds.mjs`).
   */
  idea_seed_runs: defineTable({
    /** The super admin the seed rows are stored under (rows need an owner; seeds are platform data). */
    ownerId: v.id("users"),
    seedVersion: v.string(),
    promptRef: v.string(),
    /** Set at submit, from the provider mode the action ran in. */
    mode: v.optional(v.union(v.literal("fixture"), v.literal("live"))),
    status: v.union(
      v.literal("preparing"),
      v.literal("submitted"),
      v.literal("collected"),
      v.literal("failed"),
    ),
    batchId: v.optional(v.string()),
    /** Items added, and how many went into the batch. */
    itemCount: v.number(),
    submittedCount: v.number(),
    reservedMicroUsd: v.number(),
    /** Polls so far; the poll stops rescheduling at `SEED_POLL_MAX`. */
    polls: v.number(),
    /** A plain, value-free reason when the run failed or stopped short. */
    note: v.optional(v.string()),
    createdAt: v.number(),
    submittedAt: v.optional(v.number()),
    collectedAt: v.optional(v.number()),
  })
    .index("by_ownerId", ["ownerId"])
    .index("by_seedVersion", ["seedVersion"])
    .index("by_status", ["status"]),

  /** WP90-S3. One idea in a run: its source, its reservation and what came of it. */
  idea_seed_items: defineTable({
    /** The run's owner (D22: every workspace row has one). */
    ownerId: v.id("users"),
    runId: v.id("idea_seed_runs"),
    ideaSlug: v.string(),
    seedVersion: v.string(),
    /** The `seedSourceFromPage` result as JSON (bounded by `SEED_SOURCE_LIMITS.total` plus the validation facts). */
    sourceJson: v.string(),
    sourceHash: v.string(),
    attempt: v.number(),
    status: v.union(
      v.literal("pending"),
      v.literal("skipped"),
      v.literal("not_reserved"),
      v.literal("sent"),
      v.literal("written"),
      v.literal("audit_failed"),
      v.literal("failed"),
    ),
    usageId: v.optional(v.id("ai_usage")),
    reservedMicroUsd: v.optional(v.number()),
    costMicroUsd: v.optional(v.number()),
    /** Audit findings (code and field path only, never model text). */
    issues: v.optional(v.array(v.object({ code: v.string(), path: v.string() }))),
    /** The provider error kind for a failed request. */
    errorKind: v.optional(v.string()),
    seedId: v.optional(v.id("idea_crew_seeds")),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_ownerId", ["ownerId"])
    .index("by_runId_and_status", ["runId", "status"])
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
