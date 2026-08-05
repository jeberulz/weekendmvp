import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";
import {
  auditActorValidator,
  briefStatusValidator,
  documentFormatValidator,
  documentKindValidator,
  ledgerReasonValidator,
  projectSourceValidator,
  projectStatusValidator,
  purchaseProviderValidator,
  purchaseStatusValidator,
  siteStatusValidator,
  siteVersionStatusValidator,
  stepStatusValidator,
  stepTypeValidator,
  submissionStatusValidator,
  taskStatusValidator,
  taskTypeValidator,
  workflowRunStatusValidator,
  workflowTypeValidator,
} from "./platform/validators";

// Initial schema (U1) — expanded with queries/indexes in U2 and Convex Auth in
// WP21. The custom users table below intentionally keeps the legacy fields
// optional so existing document IDs and saved_ideas references remain valid.
export default defineSchema({
  ...authTables,
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

  // Convex Auth's users table, customized in place for legacy compatibility.
  users: defineTable({
    name: v.optional(v.string()),
    image: v.optional(v.string()),
    email: v.optional(v.string()),
    emailVerificationTime: v.optional(v.number()),
    phone: v.optional(v.string()),
    phoneVerificationTime: v.optional(v.number()),
    isAnonymous: v.optional(v.boolean()),
    tokenIdentifier: v.optional(v.string()),
    displayName: v.optional(v.string()),
    stripeCustomerId: v.optional(v.string()),
    createdAt: v.optional(v.number()),
  })
    // `email` and `phone` are required exact names for Convex Auth internals.
    .index("email", ["email"])
    .index("phone", ["phone"])
    .index("by_token", ["tokenIdentifier"]),

  saved_ideas: defineTable({
    userId: v.id("users"),
    ideaId: v.id("ideas"),
    savedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_idea", ["userId", "ideaId"]),

  projects: defineTable({
    ownerId: v.id("users"),
    source: projectSourceValidator,
    sourceIdeaId: v.optional(v.id("ideas")),
    title: v.string(),
    status: projectStatusValidator,
    idempotencyKey: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
    archivedAt: v.optional(v.number()),
  })
    .index("by_ownerId_and_updatedAt", ["ownerId", "updatedAt"])
    .index("by_ownerId_and_status_and_updatedAt", [
      "ownerId",
      "status",
      "updatedAt",
    ])
    .index("by_ownerId_and_idempotencyKey", ["ownerId", "idempotencyKey"])
    .index("by_ownerId_and_sourceIdeaId", ["ownerId", "sourceIdeaId"])
    .index("by_ownerId_and_sourceIdeaId_and_archivedAt", [
      "ownerId",
      "sourceIdeaId",
      "archivedAt",
    ]),

  briefs: defineTable({
    ownerId: v.id("users"),
    projectId: v.id("projects"),
    status: briefStatusValidator,
    revision: v.int64(),
    documentId: v.optional(v.id("documents")),
    createdAt: v.number(),
    updatedAt: v.number(),
    archivedAt: v.optional(v.number()),
  })
    .index("by_projectId_and_status_and_updatedAt", [
      "projectId",
      "status",
      "updatedAt",
    ])
    .index("by_ownerId_and_projectId_and_revision", [
      "ownerId",
      "projectId",
      "revision",
    ]),

  submissions: defineTable({
    ownerId: v.id("users"),
    projectId: v.id("projects"),
    status: submissionStatusValidator,
    idempotencyKey: v.string(),
    payload: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
    archivedAt: v.optional(v.number()),
  })
    .index("by_ownerId_and_idempotencyKey", ["ownerId", "idempotencyKey"])
    .index("by_projectId_and_status_and_createdAt", [
      "projectId",
      "status",
      "createdAt",
    ]),

  idea_intents: defineTable({
    ownerId: v.id("users"),
    ideaId: v.id("ideas"),
    saved: v.boolean(),
    interested: v.boolean(),
    updatedAt: v.number(),
  })
    .index("by_ownerId_and_ideaId", ["ownerId", "ideaId"])
    .index("by_ownerId_and_updatedAt", ["ownerId", "updatedAt"])
    .index("by_ownerId_and_saved_and_updatedAt", [
      "ownerId",
      "saved",
      "updatedAt",
    ])
    .index("by_ownerId_and_interested_and_updatedAt", [
      "ownerId",
      "interested",
      "updatedAt",
    ]),

  tasks: defineTable({
    ownerId: v.id("users"),
    projectId: v.id("projects"),
    type: taskTypeValidator,
    status: taskStatusValidator,
    title: v.string(),
    idempotencyKey: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
    archivedAt: v.optional(v.number()),
  })
    .index("by_ownerId_and_idempotencyKey", ["ownerId", "idempotencyKey"])
    .index("by_projectId_and_createdAt", ["projectId", "createdAt"])
    .index("by_projectId_and_status_and_createdAt", [
      "projectId",
      "status",
      "createdAt",
    ]),

  task_steps: defineTable({
    ownerId: v.id("users"),
    projectId: v.id("projects"),
    taskId: v.id("tasks"),
    type: stepTypeValidator,
    status: stepStatusValidator,
    position: v.int64(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_taskId_and_position", ["taskId", "position"])
    .index("by_projectId_and_status_and_createdAt", [
      "projectId",
      "status",
      "createdAt",
    ]),

  documents: defineTable({
    ownerId: v.id("users"),
    projectId: v.id("projects"),
    taskId: v.optional(v.id("tasks")),
    kind: documentKindValidator,
    format: documentFormatValidator,
    title: v.string(),
    body: v.optional(v.string()),
    storageId: v.optional(v.id("_storage")),
    contentSha256: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
    archivedAt: v.optional(v.number()),
  })
    .index("by_projectId_and_updatedAt", ["projectId", "updatedAt"])
    .index("by_projectId_and_kind_and_updatedAt", [
      "projectId",
      "kind",
      "updatedAt",
    ])
    .index("by_taskId_and_createdAt", ["taskId", "createdAt"]),

  document_citations: defineTable({
    ownerId: v.id("users"),
    projectId: v.id("projects"),
    documentId: v.id("documents"),
    position: v.int64(),
    url: v.string(),
    title: v.string(),
    publisher: v.optional(v.string()),
    publishedAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_documentId_and_position", ["documentId", "position"])
    .index("by_projectId_and_createdAt", ["projectId", "createdAt"]),

  site_configs: defineTable({
    ownerId: v.id("users"),
    projectId: v.id("projects"),
    status: siteStatusValidator,
    hostname: v.optional(v.string()),
    currentVersionId: v.optional(v.id("site_versions")),
    createdAt: v.number(),
    updatedAt: v.number(),
    archivedAt: v.optional(v.number()),
  })
    .index("by_ownerId_and_projectId", ["ownerId", "projectId"])
    .index("by_hostname", ["hostname"])
    .index("by_ownerId_and_status_and_updatedAt", [
      "ownerId",
      "status",
      "updatedAt",
    ]),

  site_versions: defineTable({
    ownerId: v.id("users"),
    projectId: v.id("projects"),
    siteConfigId: v.id("site_configs"),
    status: siteVersionStatusValidator,
    version: v.int64(),
    documentId: v.optional(v.id("documents")),
    storageId: v.optional(v.id("_storage")),
    createdAt: v.number(),
    publishedAt: v.optional(v.number()),
    retiredAt: v.optional(v.number()),
  })
    .index("by_siteConfigId_and_version", ["siteConfigId", "version"])
    .index("by_projectId_and_status_and_createdAt", [
      "projectId",
      "status",
      "createdAt",
    ]),

  leads: defineTable({
    ownerId: v.id("users"),
    projectId: v.id("projects"),
    siteConfigId: v.id("site_configs"),
    email: v.optional(v.string()),
    payload: v.optional(v.string()),
    synthetic: v.boolean(),
    createdAt: v.number(),
    archivedAt: v.optional(v.number()),
  })
    .index("by_projectId_and_createdAt", ["projectId", "createdAt"])
    .index("by_siteConfigId_and_createdAt", ["siteConfigId", "createdAt"])
    .index("by_ownerId_and_createdAt", ["ownerId", "createdAt"]),

  audit_events: defineTable({
    ownerId: v.id("users"),
    projectId: v.optional(v.id("projects")),
    actorType: auditActorValidator,
    actorUserId: v.optional(v.id("users")),
    action: v.string(),
    subjectType: v.string(),
    subjectId: v.string(),
    metadata: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_ownerId_and_createdAt", ["ownerId", "createdAt"])
    .index("by_projectId_and_createdAt", ["projectId", "createdAt"]),

  credit_accounts: defineTable({
    ownerId: v.id("users"),
    balance: v.int64(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_ownerId", ["ownerId"]),

  credit_ledger: defineTable({
    ownerId: v.id("users"),
    accountId: v.id("credit_accounts"),
    projectId: v.optional(v.id("projects")),
    purchaseId: v.optional(v.id("purchases")),
    taskId: v.optional(v.id("tasks")),
    reason: ledgerReasonValidator,
    delta: v.int64(),
    balanceAfter: v.int64(),
    idempotencyKey: v.string(),
    provider: v.optional(v.string()),
    providerEventId: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_accountId_and_createdAt", ["accountId", "createdAt"])
    .index("by_ownerId_and_idempotencyKey", ["ownerId", "idempotencyKey"])
    .index("by_provider_and_providerEventId", ["provider", "providerEventId"]),

  purchases: defineTable({
    ownerId: v.id("users"),
    projectId: v.id("projects"),
    provider: purchaseProviderValidator,
    status: purchaseStatusValidator,
    amountMinor: v.int64(),
    currency: v.string(),
    credits: v.int64(),
    idempotencyKey: v.string(),
    providerCheckoutSessionId: v.optional(v.string()),
    providerPaymentIntentId: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_ownerId_and_idempotencyKey", ["ownerId", "idempotencyKey"])
    .index("by_ownerId_and_status_and_createdAt", [
      "ownerId",
      "status",
      "createdAt",
    ])
    .index("by_provider_and_providerCheckoutSessionId", [
      "provider",
      "providerCheckoutSessionId",
    ])
    .index("by_provider_and_providerPaymentIntentId", [
      "provider",
      "providerPaymentIntentId",
    ]),

  workflow_runs: defineTable({
    ownerId: v.id("users"),
    projectId: v.id("projects"),
    taskId: v.optional(v.id("tasks")),
    type: workflowTypeValidator,
    status: workflowRunStatusValidator,
    idempotencyKey: v.string(),
    attempt: v.int64(),
    errorCode: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
    startedAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
  })
    .index("by_ownerId_and_idempotencyKey", ["ownerId", "idempotencyKey"])
    .index("by_projectId_and_status_and_createdAt", [
      "projectId",
      "status",
      "createdAt",
    ])
    .index("by_taskId_and_createdAt", ["taskId", "createdAt"])
    .index("by_status_and_createdAt", ["status", "createdAt"]),
});
