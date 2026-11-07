import { describe, expect, test } from "vitest";
import schema from "./schema";

function indexNames(table: { " indexes": () => { indexDescriptor: string }[] }): string[] {
  return table[" indexes"]().map((index) => index.indexDescriptor);
}

describe("WP79 additive C-DATA amendment", () => {
  test("tenant sender and lead tokens are owned, project-scoped rows", () => {
    for (const name of ["business_email_settings", "lead_email_tokens"] as const) {
      const table = schema.tables[name];
      expect(table.validator.fields.ownerId.isOptional).toBe("required");
      expect(table.validator.fields.projectId.isOptional).toBe("required");
      expect(indexNames(table)).toContain("by_ownerId_and_projectId");
    }
    const fields = schema.tables.lead_email_tokens.validator.fields;
    expect(fields.tokenHash.isOptional).toBe("required");
    expect(fields.componentEmailId.isOptional).toBe("optional");
    expect("token" in fields).toBe(false);
    expect(indexNames(schema.tables.lead_email_tokens)).toContain("by_tokenHash");
  });

  test("due-send and provider lookup indexes support bounded recovery", () => {
    expect(indexNames(schema.tables.enrollments)).toContain("by_state_and_nextStepAt");
    expect(indexNames(schema.tables.enrollments)).toContain("by_leadId");
    expect(indexNames(schema.tables.enrollments)).toContain("by_leadId_and_state");
    expect(schema.tables.enrollments.validator.fields.contactRevokedAt.isOptional).toBe("optional");
    expect(indexNames(schema.tables.enrollments)).toContain("by_leadId_and_contactRevokedAt");
    expect(indexNames(schema.tables.email_sends)).toEqual(expect.arrayContaining([
      "by_idempotencyKey",
      "by_enrollmentId",
      "by_componentEmailId",
      "by_ownerId_and_createdAt",
    ]));
    expect(schema.tables.approvals.validator.fields.subjectVersion.isOptional).toBe("optional");
    expect(indexNames(schema.tables.approvals)).toContain("by_status_and_createdAt");
  });

  test("retention jobs keep the deletion deadline distinct from bounded retry scheduling", () => {
    const table = schema.tables.lead_retention_jobs;
    const fields = table.validator.fields;
    for (const name of ["ownerId", "projectId", "deleteDueAt", "nextAttemptAt", "state"] as const) {
      expect(fields[name].isOptional).toBe("required");
    }
    expect(fields.archivedAt.isOptional).toBe("optional");
    expect(fields.deletionRequestedAt.isOptional).toBe("optional");
    expect(schema.tables.projects.validator.fields.deletionRequestedAt.isOptional).toBe("optional");
    expect(indexNames(table)).toEqual(expect.arrayContaining([
      "by_projectId", "by_ownerId_and_projectId", "by_state_and_nextAttemptAt",
    ]));
  });
});
