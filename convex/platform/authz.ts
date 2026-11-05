import { getAuthSessionId, getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

type PlatformReadCtx = Pick<QueryCtx, "auth" | "db">;

export const PLATFORM_AUTH_ERROR = {
  unauthenticated: "UNAUTHENTICATED",
  notFound: "RESOURCE_NOT_FOUND",
} as const;

export const PROJECT_CHILD_TABLE_NAMES = [
  "briefs",
  "submissions",
  "tasks",
  "task_steps",
  "documents",
  "document_citations",
  "site_configs",
  "site_versions",
  "leads",
  "audit_events",
  "credit_ledger",
  "purchases",
  "workflow_runs",
] as const;

export type ProjectChildTable = (typeof PROJECT_CHILD_TABLE_NAMES)[number];

export const WORKSPACE_PROJECT_CHILD_TABLE_NAMES = [
  "roster_plans",
  "crew_members",
  "workstreams",
  "launch_plan_items",
  "approvals",
  "chat_messages",
  "wren_memory",
  "business_files",
  "provider_jobs",
  "business_members",
  "sequences",
  "sequence_steps",
  "enrollments",
  "email_sends",
  "social_accounts",
  "social_posts",
  "ad_campaigns",
  "outbound_lists",
  "outbound_messages",
] as const;

export type WorkspaceProjectChildTable = (typeof WORKSPACE_PROJECT_CHILD_TABLE_NAMES)[number];
export type BusinessChildTable = ProjectChildTable | WorkspaceProjectChildTable;

export const OWNER_RECORD_TABLE_NAMES = [
  "projects",
  "idea_intents",
  "credit_accounts",
] as const;

export type OwnerRecordTable = (typeof OWNER_RECORD_TABLE_NAMES)[number];

export const ACCOUNT_RECORD_TABLE_NAMES = [
  "audit_events",
  "credit_ledger",
] as const;

export type AccountRecordTable = (typeof ACCOUNT_RECORD_TABLE_NAMES)[number];

function denyUnauthenticated(): never {
  throw new ConvexError({ code: PLATFORM_AUTH_ERROR.unauthenticated });
}

function denyNotFound(): never {
  // Missing and unauthorized resources deliberately share one response so a
  // caller cannot probe another owner's record IDs.
  throw new ConvexError({ code: PLATFORM_AUTH_ERROR.notFound });
}

function isArchived(record: object): boolean {
  return "archivedAt" in record && record.archivedAt !== undefined;
}

function matchesProject(
  record: { ownerId: Id<"users">; projectId: Id<"projects"> },
  project: Doc<"projects">,
): boolean {
  return (
    record.ownerId === project.ownerId &&
    record.projectId === project._id &&
    !isArchived(record)
  );
}

async function taskMatchesProject(
  ctx: PlatformReadCtx,
  taskId: Id<"tasks">,
  project: Doc<"projects">,
): Promise<boolean> {
  const task = await ctx.db.get("tasks", taskId);
  return task !== null && matchesProject(task, project);
}

async function documentMatchesProject(
  ctx: PlatformReadCtx,
  documentId: Id<"documents">,
  project: Doc<"projects">,
): Promise<boolean> {
  const document = await ctx.db.get("documents", documentId);
  if (document === null || !matchesProject(document, project)) return false;
  return (
    document.taskId === undefined ||
    (await taskMatchesProject(ctx, document.taskId, project))
  );
}

async function childMatchesProject<TableName extends BusinessChildTable>(
  ctx: PlatformReadCtx,
  tableName: TableName,
  recordId: Id<TableName>,
  project: Doc<"projects">,
): Promise<boolean> {
  const record = await ctx.db.get(tableName, recordId);
  return record !== null && matchesProject(record as unknown as { ownerId: Id<"users">; projectId: Id<"projects"> }, project) &&
    await nestedParentsMatch(ctx, tableName, record as Doc<TableName>, project);
}

async function siteConfigMatchesProject(
  ctx: PlatformReadCtx,
  siteConfigId: Id<"site_configs">,
  project: Doc<"projects">,
  validateCurrentVersion: boolean,
): Promise<boolean> {
  const siteConfig = await ctx.db.get("site_configs", siteConfigId);
  if (siteConfig === null || !matchesProject(siteConfig, project)) return false;
  if (!validateCurrentVersion || siteConfig.currentVersionId === undefined) {
    return true;
  }
  const currentVersion = await ctx.db.get(
    "site_versions",
    siteConfig.currentVersionId,
  );
  return (
    currentVersion !== null &&
    matchesProject(currentVersion, project) &&
    currentVersion.siteConfigId === siteConfig._id
  );
}

async function ledgerParentsMatch(
  ctx: PlatformReadCtx,
  ledger: Doc<"credit_ledger">,
  ownerId: Id<"users">,
  project: Doc<"projects"> | null,
): Promise<boolean> {
  const account = await ctx.db.get("credit_accounts", ledger.accountId);
  if (account === null || account.ownerId !== ownerId) return false;

  const purchase = ledger.purchaseId
    ? await ctx.db.get("purchases", ledger.purchaseId)
    : null;
  if (ledger.purchaseId !== undefined && purchase === null) return false;
  if (purchase !== null && purchase.ownerId !== ownerId) return false;

  const task = ledger.taskId
    ? await ctx.db.get("tasks", ledger.taskId)
    : null;
  if (ledger.taskId !== undefined && task === null) return false;
  if (task !== null && (task.ownerId !== ownerId || isArchived(task))) return false;

  const relatedProjectIds = [
    ledger.projectId,
    purchase?.projectId,
    task?.projectId,
  ].filter((projectId): projectId is Id<"projects"> => projectId !== undefined);
  if (
    relatedProjectIds.some(
      (projectId) => projectId !== relatedProjectIds[0],
    )
  ) {
    return false;
  }

  const relatedProjectId = relatedProjectIds[0];
  if (relatedProjectId !== undefined) {
    const relatedProject =
      project?._id === relatedProjectId
        ? project
        : await ctx.db.get("projects", relatedProjectId);
    if (
      relatedProject === null ||
      relatedProject.ownerId !== ownerId ||
      isArchived(relatedProject)
    ) {
      return false;
    }
  }

  if (project === null) {
    if (ledger.projectId !== undefined) return false;
  } else if (
    ledger.projectId !== project._id ||
    ledger.ownerId !== project.ownerId
  ) {
    return false;
  }

  return true;
}

async function nestedParentsMatch<TableName extends BusinessChildTable>(
  ctx: PlatformReadCtx,
  tableName: TableName,
  record: Doc<TableName>,
  project: Doc<"projects">,
): Promise<boolean> {
  switch (tableName) {
    case "briefs": {
      const brief = record as unknown as Doc<"briefs">;
      return (
        brief.documentId === undefined ||
        (await documentMatchesProject(ctx, brief.documentId, project))
      );
    }
    case "task_steps": {
      const step = record as unknown as Doc<"task_steps">;
      return await taskMatchesProject(ctx, step.taskId, project);
    }
    case "documents": {
      const document = record as unknown as Doc<"documents">;
      return (
        document.taskId === undefined ||
        (await taskMatchesProject(ctx, document.taskId, project))
      );
    }
    case "document_citations": {
      const citation = record as unknown as Doc<"document_citations">;
      return await documentMatchesProject(ctx, citation.documentId, project);
    }
    case "site_configs": {
      const config = record as unknown as Doc<"site_configs">;
      return (
        config.currentVersionId === undefined ||
        (await siteConfigMatchesProject(ctx, config._id, project, true))
      );
    }
    case "site_versions": {
      const version = record as unknown as Doc<"site_versions">;
      return (
        (await siteConfigMatchesProject(
          ctx,
          version.siteConfigId,
          project,
          false,
        )) &&
        (version.documentId === undefined ||
          (await documentMatchesProject(ctx, version.documentId, project)))
      );
    }
    case "leads": {
      const lead = record as unknown as Doc<"leads">;
      return await siteConfigMatchesProject(
        ctx,
        lead.siteConfigId,
        project,
        true,
      );
    }
    case "credit_ledger":
      return await ledgerParentsMatch(
        ctx,
        record as unknown as Doc<"credit_ledger">,
        project.ownerId,
        project,
      );
    case "workflow_runs": {
      const run = record as unknown as Doc<"workflow_runs">;
      return (
        run.taskId === undefined ||
        (await taskMatchesProject(ctx, run.taskId, project))
      );
    }
    case "workstreams": {
      const stream = record as unknown as Doc<"workstreams">;
      return await childMatchesProject(ctx, "crew_members", stream.employeeId, project) &&
        (stream.askApprovalId === undefined ||
          await childMatchesProject(ctx, "approvals", stream.askApprovalId, project)) &&
        (await Promise.all(stream.documentIds.map((id) => documentMatchesProject(ctx, id, project)))).every(Boolean) &&
        (await Promise.all(stream.fileIds.map((id) => childMatchesProject(ctx, "business_files", id, project)))).every(Boolean);
    }
    case "launch_plan_items": {
      const item = record as unknown as Doc<"launch_plan_items">;
      return await childMatchesProject(ctx, "crew_members", item.ownerEmployeeId, project) &&
        (item.approvalId === undefined || await childMatchesProject(ctx, "approvals", item.approvalId, project));
    }
    case "chat_messages": {
      const message = record as unknown as Doc<"chat_messages">;
      const approvalsMatch = (await Promise.all(message.cardApprovalIds.map((id) =>
        childMatchesProject(ctx, "approvals", id, project)))).every(Boolean);
      if (!approvalsMatch || message.usageId === undefined) return approvalsMatch;
      const usage = await ctx.db.get("ai_usage", message.usageId);
      return usage !== null && usage.ownerId === project.ownerId && usage.projectId === project._id;
    }
    case "business_files": {
      const file = record as unknown as Doc<"business_files">;
      return file.sourceTaskId === undefined || await taskMatchesProject(ctx, file.sourceTaskId, project);
    }
    case "provider_jobs": {
      const job = record as unknown as Doc<"provider_jobs">;
      return await taskMatchesProject(ctx, job.taskId, project);
    }
    case "sequence_steps": {
      const step = record as unknown as Doc<"sequence_steps">;
      return await childMatchesProject(ctx, "sequences", step.sequenceId, project) &&
        await documentMatchesProject(ctx, step.documentId, project) &&
        (step.approvalId === undefined || await childMatchesProject(ctx, "approvals", step.approvalId, project));
    }
    case "enrollments": {
      const enrollment = record as unknown as Doc<"enrollments">;
      const lead = await ctx.db.get("leads", enrollment.leadId);
      return lead !== null && matchesProject(lead, project) &&
        await nestedParentsMatch(ctx, "leads", lead, project) &&
        await childMatchesProject(ctx, "sequences", enrollment.sequenceId, project);
    }
    case "email_sends": {
      const send = record as unknown as Doc<"email_sends">;
      const enrollment = await ctx.db.get("enrollments", send.enrollmentId);
      const step = await ctx.db.get("sequence_steps", send.stepId);
      return enrollment !== null && step !== null &&
        matchesProject(enrollment, project) && matchesProject(step, project) &&
        step.sequenceId === enrollment.sequenceId &&
        await nestedParentsMatch(ctx, "enrollments", enrollment, project) &&
        await nestedParentsMatch(ctx, "sequence_steps", step, project);
    }
    case "social_posts": {
      const post = record as unknown as Doc<"social_posts">;
      return (post.socialAccountId === undefined ||
        await childMatchesProject(ctx, "social_accounts", post.socialAccountId, project)) &&
        (post.documentId === undefined || await documentMatchesProject(ctx, post.documentId, project)) &&
        (post.approvalId === undefined || await childMatchesProject(ctx, "approvals", post.approvalId, project));
    }
    case "ad_campaigns": {
      const campaign = record as unknown as Doc<"ad_campaigns">;
      return campaign.approvalId === undefined || await childMatchesProject(ctx, "approvals", campaign.approvalId, project);
    }
    case "outbound_messages": {
      const message = record as unknown as Doc<"outbound_messages">;
      return await childMatchesProject(ctx, "outbound_lists", message.listId, project) &&
        (message.documentId === undefined || await documentMatchesProject(ctx, message.documentId, project)) &&
        (message.approvalId === undefined || await childMatchesProject(ctx, "approvals", message.approvalId, project));
    }
    default:
      return true;
  }
}

async function requirePlatformUser(
  ctx: PlatformReadCtx,
  now?: number,
): Promise<Doc<"users">> {
  const [rawUserId, rawSessionId] = await Promise.all([
    getAuthUserId(ctx),
    getAuthSessionId(ctx),
  ]);
  const userId = rawUserId
    ? ctx.db.normalizeId("users", rawUserId)
    : null;
  const sessionId = rawSessionId
    ? ctx.db.normalizeId("authSessions", rawSessionId)
    : null;
  if (userId === null || sessionId === null) {
    return denyUnauthenticated();
  }

  const [user, session] = await Promise.all([
    ctx.db.get("users", userId),
    ctx.db.get("authSessions", sessionId),
  ]);
  if (
    user === null ||
    user.isAnonymous === true ||
    session === null ||
    session.userId !== userId ||
    (now !== undefined && session.expirationTime <= now)
  ) {
    return denyUnauthenticated();
  }

  return user;
}

/** Reactive reads check session existence/ownership so revocation invalidates them.
 * Token expiry is enforced by Convex Auth; queries must not read the clock. */
export async function requireCurrentPlatformUser(ctx: PlatformReadCtx): Promise<Doc<"users">> {
  return await requirePlatformUser(ctx);
}

/** Writes and HTTP membership probes additionally enforce stored session expiry. */
export async function requireCurrentPlatformUserForMutation(ctx: MutationCtx): Promise<Doc<"users">> {
  return await requirePlatformUser(ctx, Date.now());
}

export async function requireOwnedProjectForMutation(
  ctx: MutationCtx,
  projectId: Id<"projects">,
): Promise<Doc<"projects">> {
  const user = await requireCurrentPlatformUserForMutation(ctx);
  return await ownedProjectForUser(ctx, user._id, projectId);
}

export async function requireOwnedProject(
  ctx: PlatformReadCtx,
  projectId: Id<"projects">,
): Promise<Doc<"projects">> {
  const user = await requireCurrentPlatformUser(ctx);
  return await ownedProjectForUser(ctx, user._id, projectId);
}

/** C-AUTHZ: owner-only business access until WP85 enables scoped editors.
 * Mutations use the expiry-aware path; reactive queries keep clock-free reads. */
export async function requireBusinessAccess(
  ctx: PlatformReadCtx | MutationCtx,
  projectId: Id<"projects">,
  minRole: "owner",
): Promise<Doc<"projects">> {
  if (minRole !== "owner") return denyNotFound();
  return "scheduler" in ctx
    ? await requireOwnedProjectForMutation(ctx, projectId)
    : await requireOwnedProject(ctx, projectId);
}

/** Internal jobs use a trusted owner ID and still verify the project chain. */
export async function requireBusinessForOwner(
  ctx: Pick<QueryCtx, "db">,
  projectId: Id<"projects">,
  ownerId: Id<"users">,
): Promise<Doc<"projects">> {
  return await ownedProjectForUser(ctx, ownerId, projectId);
}

/** Public workspace reads and writes verify both business access and child links. */
export async function requireBusinessChild<TableName extends BusinessChildTable>(
  ctx: PlatformReadCtx | MutationCtx,
  tableName: TableName,
  recordId: Id<TableName>,
  projectId: Id<"projects">,
): Promise<Doc<TableName>> {
  const project = await requireBusinessAccess(ctx, projectId, "owner");
  const record = await ctx.db.get(tableName, recordId);
  if (record === null || !matchesProject(record as unknown as { ownerId: Id<"users">; projectId: Id<"projects"> }, project) ||
    !(await nestedParentsMatch(ctx, tableName, record as Doc<TableName>, project))) return denyNotFound();
  return record;
}

async function ownedProjectForUser(
  ctx: Pick<QueryCtx, "db">,
  ownerId: Id<"users">,
  projectId: Id<"projects">,
): Promise<Doc<"projects">> {
  const project = await ctx.db.get("projects", projectId);
  if (
    project === null ||
    project.ownerId !== ownerId ||
    isArchived(project)
  ) {
    return denyNotFound();
  }
  return project;
}

export async function requireOwnedRecord<TableName extends OwnerRecordTable>(
  ctx: PlatformReadCtx,
  tableName: TableName,
  recordId: Id<TableName>,
): Promise<Doc<TableName>> {
  const user = await requireCurrentPlatformUser(ctx);
  const record = await ctx.db.get(tableName, recordId);
  if (
    record === null ||
    record.ownerId !== user._id ||
    isArchived(record)
  ) {
    return denyNotFound();
  }
  return record;
}

/**
 * Loads append-only account-level rows. A project link remains optional, but
 * when present it must resolve through the same active owner project chain.
 */
export async function requireOwnedAccountRecord<
  TableName extends AccountRecordTable,
>(
  ctx: PlatformReadCtx,
  tableName: TableName,
  recordId: Id<TableName>,
): Promise<Doc<TableName>> {
  const user = await requireCurrentPlatformUser(ctx);
  const record = await ctx.db.get(tableName, recordId);
  if (record === null || record.ownerId !== user._id) {
    return denyNotFound();
  }

  const project = record.projectId
    ? await ctx.db.get("projects", record.projectId)
    : null;
  if (
    record.projectId !== undefined &&
    (project === null || project.ownerId !== user._id || isArchived(project))
  ) {
    return denyNotFound();
  }
  if (
    tableName === "credit_ledger" &&
    !(await ledgerParentsMatch(
      ctx,
      record as unknown as Doc<"credit_ledger">,
      user._id,
      project,
    ))
  ) {
    return denyNotFound();
  }
  return record;
}

export async function requireOwnedProjectChild<
  TableName extends ProjectChildTable,
>(
  ctx: PlatformReadCtx,
  tableName: TableName,
  recordId: Id<TableName>,
  projectId: Id<"projects">,
): Promise<Doc<TableName>> {
  const project = await requireOwnedProject(ctx, projectId);
  const record = await ctx.db.get(tableName, recordId);
  if (
    record === null ||
    record.ownerId !== project.ownerId ||
    record.projectId !== project._id ||
    isArchived(record) ||
    !(await nestedParentsMatch(ctx, tableName, record, project))
  ) {
    return denyNotFound();
  }
  return record;
}
