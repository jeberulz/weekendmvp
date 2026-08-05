import { getAuthSessionId, getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";

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

async function nestedParentsMatch<TableName extends ProjectChildTable>(
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
    default:
      return true;
  }
}

export async function requireCurrentPlatformUser(
  ctx: PlatformReadCtx,
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
    session.userId !== userId
  ) {
    return denyUnauthenticated();
  }

  return user;
}

export async function requireOwnedProject(
  ctx: PlatformReadCtx,
  projectId: Id<"projects">,
): Promise<Doc<"projects">> {
  const user = await requireCurrentPlatformUser(ctx);
  const project = await ctx.db.get("projects", projectId);
  if (
    project === null ||
    project.ownerId !== user._id ||
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
