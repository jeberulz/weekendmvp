import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import { mutation, type MutationCtx, type QueryCtx } from "../_generated/server";
import { assertFeatureEnabled } from "../ops/settings";
import { requireOwnedWizardSession } from "../platform/authz";
import { resolvePlan } from "../platform/planResolver";
import { WORKSPACE_PLAN_LIMITS } from "../platform/plans";
import { tenantHostForSlug, isValidTenantSlug } from "../../lib/tenant-host";
import { emailAddressDomain, isDisposableEmailDomain } from "../../lib/workspace/disposable-domains";
import { partnerNameFromWizard, wizardAnswersSchema, type WizardAnswers } from "../../lib/workspace/contracts/wizard";
import { pickTenantSlug } from "../../lib/workspace/wizard/tenant-slug";

/**
 * WP74-S4: "Create my business" at the end of the wizard. A business is a
 * `projects` row (D19) owned by the founder (`ownerId`, D12).
 *
 * `createBusiness` runs in one transaction:
 * 1. the signed-in owner's session (C-OPS `workspace` gate, then C-AUTHZ
 *    `requireOwnedWizardSession` with `allowLinked`); a session that already
 *    made its business returns that business while it is live and links back
 *    to the session (an archived one is `RESOURCE_NOT_FOUND`);
 * 2. the session must be complete: every step answered, blueprint `looks_good`
 *    (`wizardAnswersSchema`);
 * 3. a verified email whose domain parses (`EMAIL_INVALID` otherwise) and is
 *    not on the disposable list (D3);
 * 4. the plan's business allowance from the entitlements
 *    (`WORKSPACE_PLAN_LIMITS[resolvePlan()].limits.businesses`: Free 1).
 *    Archived businesses still count;
 * 5. the tenant slug from the chosen name (`pickTenantSlug` +
 *    `isTenantSlugTaken`). A reserved name is refused (`NAME_RESERVED`) and
 *    the founder picks another one;
 * 6. insert the project, link `wizard_sessions.projectId` and `completedAt`,
 *    and write one `audit_events` row.
 *
 * Idempotent: a double click, a reload or a retried request returns the same
 * business. The session link answers a replay; `idempotencyKey`
 * (`wizard:{sessionId}`) catches a project whose link is missing. Convex
 * serialises concurrent calls on the same session or allowance.
 *
 * The `business_members` owner row (D12) is Codex's to write (Needs from Codex
 * item h). `requireBusinessAccess` checks `projects.ownerId`, so the owner has
 * access without it.
 */

type Refusal =
  | "SESSION_INCOMPLETE"
  | "EMAIL_NOT_VERIFIED"
  | "EMAIL_INVALID"
  | "DISPOSABLE_EMAIL"
  | "BUSINESS_LIMIT_REACHED"
  | "SLUG_UNAVAILABLE"
  | "NAME_RESERVED"
  | "RESOURCE_NOT_FOUND";

function refuse(code: Refusal, detail: Record<string, string | number> = {}): never {
  throw new ConvexError({ ...detail, code });
}

export function businessIdempotencyKey(sessionId: Id<"wizard_sessions">): string {
  return `wizard:${sessionId}`;
}

/**
 * True when a tenant slug cannot be used: reserved or malformed
 * (`isValidTenantSlug`, the owner-frozen `RESERVED_SUBDOMAINS`), held by one of
 * this owner's businesses, or the hostname of any site (`site_configs`, live or
 * not).
 *
 * Cross-owner collisions with another owner's unpublished business cannot be
 * detected here: `projects` only has the per-owner
 * `by_ownerId_and_workspaceSlug` index. When Codex adds
 * `projects.by_workspaceSlug` (Needs from Codex item g), the owner lookup below
 * becomes a global lookup on that index. Publishing re-checks the hostname
 * either way (`platform/sites/publish`).
 */
export async function isTenantSlugTaken(
  ctx: Pick<QueryCtx, "db">,
  slug: string,
  ownerId: Id<"users">,
): Promise<boolean> {
  if (!isValidTenantSlug(slug)) return true;
  const hostname = tenantHostForSlug(slug);
  if (hostname === null) return true;
  const own = await ctx.db
    .query("projects")
    .withIndex("by_ownerId_and_workspaceSlug", (q) => q.eq("ownerId", ownerId).eq("workspace.slug", slug))
    .first();
  if (own !== null) return true;
  const site = await ctx.db
    .query("site_configs")
    .withIndex("by_hostname", (q) => q.eq("hostname", hostname))
    .first();
  return site !== null;
}

/**
 * How many wizard businesses the owner has (archived ones included; at least
 * `cap` means the allowance is used), and the
 * first live one, which the limit refusal links to. Owner-scoped by the index,
 * so it can never name another owner's business.
 */
const LINK_LOOKAHEAD = 5;

async function businessesOf(
  ctx: Pick<QueryCtx, "db">,
  ownerId: Id<"users">,
  cap: number,
): Promise<{ count: number; live: Id<"projects"> | null }> {
  const rows = await ctx.db
    .query("projects")
    .withIndex("by_ownerId_and_workspaceSlug", (q) => q.eq("ownerId", ownerId).gt("workspace.slug", ""))
    // A few rows past the allowance, so an archived first row does not hide a live one.
    .take(cap + LINK_LOOKAHEAD);
  const live = rows.find((row) => row.archivedAt === undefined);
  return { count: rows.length, live: live?._id ?? null };
}

function isVerified(user: Doc<"users"> | null): user is Doc<"users"> & { email: string } {
  return user !== null && user.isAnonymous !== true && typeof user.email === "string" &&
    user.email.length > 0 && user.emailVerificationTime !== undefined;
}

const businessResultValidator = v.object({
  projectId: v.id("projects"),
  name: v.string(),
  slug: v.string(),
  created: v.boolean(),
});

async function existingResult(
  ctx: MutationCtx,
  project: Doc<"projects"> | null,
  session: Doc<"wizard_sessions">,
) {
  // By the link or the idempotency key, only a live business that links back to
  // this session is returned or relinked: the same chain `requireOwnedWizardSession`
  // checks, so this never writes a link that guard would later refuse.
  if (
    project === null ||
    project.ownerId !== session.ownerId ||
    project.archivedAt !== undefined ||
    project.workspace === undefined ||
    project.workspace.wizardSessionId !== session._id
  ) {
    return refuse("RESOURCE_NOT_FOUND");
  }
  if (session.projectId !== project._id) {
    const now = Date.now();
    await ctx.db.patch("wizard_sessions", session._id, {
      projectId: project._id,
      completedAt: session.completedAt ?? now,
      updatedAt: now,
    });
  }
  return { projectId: project._id, name: project.workspace.name, slug: project.workspace.slug, created: false };
}

function workspaceFields(answers: WizardAnswers, slug: string, sessionId: Id<"wizard_sessions">) {
  return {
    version: 1 as const,
    name: answers.name.chosen,
    slug,
    ...(answers.idea.source === "library" ? { ideaSlug: answers.idea.ideaSlug } : { ownIdeaText: answers.idea.text }),
    platform: answers.platform.kind,
    commercialModel: answers.commercialModel,
    goal: answers.goal.kind,
    partner: { personality: answers.partnerPersonality, name: partnerNameFromWizard(answers) },
    wizardSessionId: sessionId,
    createdVia: "wizard" as const,
  };
}

/** Creates the founder's business from a completed wizard session, or returns the one it already made. */
export const createBusiness = mutation({
  args: { sessionId: v.id("wizard_sessions") },
  returns: businessResultValidator,
  handler: async (ctx, args) => {
    await assertFeatureEnabled(ctx, "workspace");
    const session = await requireOwnedWizardSession(ctx, args.sessionId, { allowLinked: true });

    // Replays: the session already points at its business.
    if (session.projectId !== undefined) {
      return await existingResult(ctx, await ctx.db.get("projects", session.projectId), session);
    }
    const idempotencyKey = businessIdempotencyKey(session._id);
    const keyed = await ctx.db
      .query("projects")
      .withIndex("by_ownerId_and_idempotencyKey", (q) => q.eq("ownerId", session.ownerId).eq("idempotencyKey", idempotencyKey))
      .first();
    if (keyed !== null) return await existingResult(ctx, keyed, session);

    // Only a finished session, parsed through the strict C-WIZARD schema.
    if (session.completedAt === undefined) return refuse("SESSION_INCOMPLETE");
    const parsed = wizardAnswersSchema.safeParse(session.answers);
    if (!parsed.success) return refuse("SESSION_INCOMPLETE");
    const answers = parsed.data;

    const user = await ctx.db.get("users", session.ownerId);
    if (!isVerified(user)) return refuse("EMAIL_NOT_VERIFIED");
    const domain = emailAddressDomain(user.email);
    if (domain === null) return refuse("EMAIL_INVALID");
    if (isDisposableEmailDomain(domain)) return refuse("DISPOSABLE_EMAIL");

    const plan = await resolvePlan(ctx, user._id);
    const allowance = WORKSPACE_PLAN_LIMITS[plan].limits.businesses;
    const existing = await businessesOf(ctx, user._id, allowance);
    if (existing.count >= allowance) {
      return refuse("BUSINESS_LIMIT_REACHED", {
        plan,
        limit: allowance,
        ...(existing.live === null ? {} : { projectId: existing.live }),
      });
    }

    const pick = await pickTenantSlug(answers.name.chosen, (candidate) => isTenantSlugTaken(ctx, candidate, user._id));
    if (pick.kind === "reserved") return refuse("NAME_RESERVED");
    if (pick.kind === "exhausted") return refuse("SLUG_UNAVAILABLE");
    const slug = pick.slug;

    const now = Date.now();
    const projectId = await ctx.db.insert("projects", {
      ownerId: user._id,
      workspace: workspaceFields(answers, slug, session._id),
      source: answers.idea.source === "library" ? "repository_idea" : "own_idea",
      title: answers.name.chosen,
      status: "draft",
      idempotencyKey,
      createdAt: now,
      updatedAt: now,
    });
    await ctx.db.patch("wizard_sessions", session._id, { projectId, completedAt: session.completedAt, updatedAt: now });
    await ctx.db.insert("audit_events", {
      ownerId: user._id,
      projectId,
      actorType: "user",
      actorUserId: user._id,
      action: "business.created",
      subjectType: "project",
      subjectId: projectId,
      metadata: JSON.stringify({ wizardSessionId: session._id, slug, plan, source: answers.idea.source }),
      createdAt: now,
    });
    return { projectId, name: answers.name.chosen, slug, created: true };
  },
});
