import { describe, expect, test } from "vitest";
import schema from "./schema";
import {
  DOCUMENT_KIND_VALUES,
  LEDGER_REASON_VALUES,
  STEP_TYPE_VALUES,
  TASK_TYPE_VALUES,
  WORKFLOW_TYPE_VALUES,
} from "./platform/validators";

const newTables = [
  "wizard_sessions", "founder_signals", "roster_plans", "crew_members",
  "workstreams", "launch_plan_items", "approvals", "chat_messages",
  "wren_memory", "business_files", "provider_jobs", "idea_crew_seeds",
  "business_members", "ai_usage", "ai_budgets", "ops_settings",
  "workspace_cohort", "sequences", "sequence_steps", "enrollments",
  "email_sends", "social_accounts", "social_posts", "ad_campaigns",
  "outbound_lists", "outbound_messages",
] as const;

const requiredIndexes = {
  wizard_sessions: "by_ownerId_and_updatedAt",
  founder_signals: "by_step_and_action",
  roster_plans: "by_projectId",
  crew_members: "by_projectId_and_roleKey",
  workstreams: "by_projectId_and_employeeId",
  launch_plan_items: "by_projectId_and_order",
  approvals: "by_projectId_and_status",
  chat_messages: "by_projectId_and_createdAt",
  wren_memory: "by_projectId",
  business_files: "by_projectId_and_kind",
  provider_jobs: "by_status_and_pollAfter",
  idea_crew_seeds: "by_ideaSlug_and_seedVersion",
  business_members: "by_userId",
  ai_usage: "by_status_and_createdAt",
  ai_budgets: "by_ownerId",
  ops_settings: "by_singletonKey",
  workspace_cohort: "by_ownerId",
  sequences: "by_projectId",
  sequence_steps: "by_sequenceId_and_order",
  enrollments: "by_state_and_nextStepAt",
  email_sends: "by_idempotencyKey",
  social_accounts: "by_projectId_and_status",
  social_posts: "by_status_and_scheduledFor",
  ad_campaigns: "by_projectId_and_status",
  outbound_lists: "by_projectId",
  outbound_messages: "by_projectId",
} satisfies Record<(typeof newTables)[number], string>;

describe("WP68 C-DATA schema", () => {
  test.each(newTables)("%s is flat, owner-indexed and has its contract index", (name) => {
    const table = schema.tables[name];
    const validator = table.validator as unknown as { fields?: Record<string, unknown> };
    expect(validator.fields, `${name} must be a flat table validator`).toBeDefined();
    expect(validator.fields?.ownerId, `${name} must carry ownerId`).toBeDefined();

    const indexes = (table as unknown as {
      " indexes": () => { indexDescriptor: string; fields: string[] }[];
    })[" indexes"]();
    expect(indexes.some((index) => index.fields[0] === "ownerId"), name).toBe(true);
    expect(indexes.map((index) => index.indexDescriptor), name).toContain(requiredIndexes[name]);
  });

  test("WP22 literals remain while the crew, document, and ledger values are additive", () => {
    for (const value of ["research", "validation_report", "landing_page", "publish", "crew_blueprint", "studio_video"]) {
      expect(TASK_TYPE_VALUES).toContain(value);
      expect(WORKFLOW_TYPE_VALUES).toContain(value);
    }
    for (const value of ["research", "generate", "review", "render", "publish", "crew_blueprint", "studio_video"]) {
      expect(STEP_TYPE_VALUES).toContain(value);
    }
    for (const value of ["research", "validation_report", "brief", "landing_page", "site_copy", "blueprint", "brand_kit", "landing_spec", "email_sequence", "social_pack", "seo_pack", "seo_article", "launch_plan", "ads_drafts", "build_pack"]) {
      expect(DOCUMENT_KIND_VALUES).toContain(value);
    }
    for (const value of ["purchase_grant", "task_debit", "task_refund", "purchase_refund", "dispute", "plan_grant", "starter_grant", "allowance_expiry"]) {
      expect(LEDGER_REASON_VALUES).toContain(value);
    }
  });

  test.each([
    ["projects", ["workspace"]],
    ["tasks", ["employeeKey", "creditCost", "changeRound", "revisionOfTaskId", "approvalId", "jobKey"]],
    ["documents", ["supersedesDocumentId", "schemaVersion", "promptRef"]],
    ["site_configs", ["takedownAt", "takedownReason"]],
    ["site_versions", ["landingSpec"]],
    ["leads", ["consentText", "consentVersion", "doubleOptInAt", "unsubscribedAt", "deletedAt", "source"]],
    ["credit_accounts", ["allowanceRemaining", "allowancePeriodEnd"]],
    ["credit_ledger", ["bucket", "bucketSplit"]],
  ] as const)("%s adds only optional fields", (name, fieldNames) => {
    const table = schema.tables[name];
    const fields = table.validator.fields as Record<string, { isOptional: string }>;
    for (const fieldName of fieldNames) {
      expect(fields[fieldName]?.isOptional, `${name}.${fieldName}`).toBe("optional");
    }
  });
});
