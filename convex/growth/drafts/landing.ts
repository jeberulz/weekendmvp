import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "../../_generated/dataModel";
import { mutation, query, type MutationCtx, type QueryCtx } from "../../_generated/server";
import { assertFeatureEnabled } from "../../ops/settings";
import { PLATFORM_AUTH_ERROR, requireBusinessAccess } from "../../platform/authz";
import { assertApproved } from "../../workspace/approvals";
import { isPrivateTestAddress } from "../../../lib/workspace/privateLanding";
import {
  LANDING_ICONS, SECTION_LAYOUTS, blueprintSchema, brandKitSchema, checkLandingAgainstBrandKit, landingSpecSchema,
} from "../../../lib/workspace/contracts/artifacts";
import { newestReviewCard, parseDraftBody, reviewCardValidator } from "./documentDraft";
import { brandKitViewValidator } from "./brandKit";

type ReadCtx = Pick<QueryCtx, "db">;
type Project = Doc<"projects">;
type Version = Doc<"site_versions">;
type PrivateVersion = Version & { privateLanding: NonNullable<Version["privateLanding"]>; documentId: Id<"documents"> };

function refuse(code: string): never {
  throw new ConvexError({ code });
}

function sameProject(row: { projectId: Id<"projects">; ownerId: Id<"users"> }, project: Project) {
  return row.projectId === project._id && row.ownerId === project.ownerId;
}

/** Never resurrect an archived/taken-down site, or choose between conflicting parent records. */
async function projectSite(ctx: ReadCtx, project: Project) {
  const sites = await ctx.db.query("site_configs").withIndex("by_ownerId_and_projectId", (q) =>
    q.eq("ownerId", project.ownerId).eq("projectId", project._id)).take(2);
  if (sites.length > 1 || sites[0]?.archivedAt !== undefined || sites[0]?.takedownAt !== undefined) {
    refuse(PLATFORM_AUTH_ERROR.notFound);
  }
  return sites[0] ?? null;
}

async function approvedInput(ctx: ReadCtx, project: Project, id: Id<"documents">, kind: "brand_kit" | "blueprint") {
  const document = await ctx.db.get("documents", id);
  if (!document || !sameProject(document, project) || document.kind !== kind || document.archivedAt !== undefined) {
    return refuse("LANDING_INPUT_UNAVAILABLE");
  }
  const card = await newestReviewCard(ctx, { projectId: project._id, ownerId: project.ownerId }, id);
  if (!card) return refuse("LANDING_INPUT_UNAPPROVED");
  await assertApproved(ctx, card.approvalId, {
    kind: "artifact_review", subjectTable: "documents", subjectId: id, projectId: project._id, ownerId: project.ownerId,
  });
  return document;
}

/** In the worker's finish transaction, after inserting the canonical landing document. */
export async function writePrivateLandingVersion(ctx: MutationCtx, documentId: Id<"documents">): Promise<Id<"site_versions">> {
  const document = await ctx.db.get("documents", documentId);
  if (!document || document.kind !== "landing_spec" || document.archivedAt !== undefined ||
      !document.briefDocumentId || !document.brandKitDocumentId) return refuse("LANDING_INPUT_UNAVAILABLE");
  const project = await ctx.db.get("projects", document.projectId);
  if (!project || !sameProject(document, project) || project.archivedAt !== undefined) return refuse(PLATFORM_AUTH_ERROR.notFound);
  const site = await projectSite(ctx, project);
  const prior = await ctx.db.query("site_versions").withIndex("by_documentId", (q) => q.eq("documentId", documentId))
    .filter((q) => q.neq(q.field("privateLanding"), undefined)).first();
  if (prior) {
    if (prior.status !== "draft" || !sameProject(prior, project) || prior.siteConfigId !== site?._id) return refuse("LANDING_VERSION_CONFLICT");
    return prior._id;
  }
  const [blueprint, brand] = await Promise.all([
    approvedInput(ctx, project, document.briefDocumentId, "blueprint"), approvedInput(ctx, project, document.brandKitDocumentId, "brand_kit"),
  ]);
  const spec = parseDraftBody(document.body, landingSpecSchema);
  const kit = parseDraftBody(brand.body, brandKitSchema);
  if (!spec || !kit || !parseDraftBody(blueprint.body, blueprintSchema) || checkLandingAgainstBrandKit(spec, kit).length) {
    return refuse("LANDING_INPUT_INVALID");
  }
  const now = Date.now();
  const siteConfigId = site?._id ?? await ctx.db.insert("site_configs", {
    ownerId: project.ownerId, projectId: project._id, status: "draft", createdAt: now, updatedAt: now,
  });
  const last = await ctx.db.query("site_versions").withIndex("by_siteConfigId_and_version", (q) =>
    q.eq("siteConfigId", siteConfigId)).order("desc").first();
  return await ctx.db.insert("site_versions", {
    siteConfigId, projectId: project._id, ownerId: project.ownerId, version: (last?.version ?? 0n) + 1n,
    status: "draft", createdAt: now, documentId, landingSpec: JSON.stringify(spec),
    privateLanding: { blueprintId: blueprint._id, brandKitId: brand._id, brandKitSnapshot: JSON.stringify(kit) },
  });
}

async function currentVersion(ctx: ReadCtx, project: Project) {
  const site = await projectSite(ctx, project);
  if (!site) return null;
  const version = await ctx.db.query("site_versions").withIndex("by_projectId_and_status_and_createdAt", (q) =>
    q.eq("projectId", project._id).eq("status", "draft")).order("desc")
    .filter((q) => q.and(q.eq(q.field("siteConfigId"), site._id), q.neq(q.field("privateLanding"), undefined))).first();
  if (!version?.privateLanding || !version.documentId || version.status !== "draft" || !sameProject(version, project)) return null;
  return { site, version: { ...version, privateLanding: version.privateLanding, documentId: version.documentId } };
}

async function renderInputs(ctx: ReadCtx, project: Project, version: PrivateVersion) {
  const document = await ctx.db.get("documents", version.documentId);
  if (!document || !sameProject(document, project) || document.archivedAt !== undefined || document.kind !== "landing_spec" ||
      document.briefDocumentId !== version.privateLanding.blueprintId || document.brandKitDocumentId !== version.privateLanding.brandKitId) return null;
  // A document altered in place can no longer be reviewed as this immutable version.
  const spec = parseDraftBody(version.landingSpec, landingSpecSchema);
  if (!spec || JSON.stringify(parseDraftBody(document.body, landingSpecSchema)) !== JSON.stringify(spec)) return null;
  const kit = parseDraftBody(version.privateLanding.brandKitSnapshot, brandKitSchema);
  return kit ? { spec, kit } : null;
}

const literals = <T extends string>(values: readonly T[]) => v.union(...values.map((value) => v.literal(value)));
const cta = v.object({ target: v.string(), label: v.string() });
const image = brandKitViewValidator.fields.heroArt;
const titledItem = v.object({ title: v.string(), body: v.string() });
const added = { addedByWeekendMvp: v.boolean(), addedReason: v.optional(v.string()) };
const proof = { placeholder: v.literal(true) };
const specView = v.object({
  schemaVersion: v.literal(1),
  nav: v.object({ brandName: v.string(), links: v.array(cta), cta }),
  hero: v.object({ layout: literals(SECTION_LAYOUTS.hero), headline: brandKitViewValidator.fields.tagline, subhead: v.string(),
    primaryCta: cta, secondaryCta: v.optional(cta), reassurance: v.optional(v.string()), image,
    productMoment: v.optional(titledItem.extend({ caption: v.string() })) }),
  promises: v.optional(v.object({ layout: literals(SECTION_LAYOUTS.promises),
    items: v.array(titledItem.extend({ icon: v.optional(literals(LANDING_ICONS)) })) })),
  how_it_works: v.optional(v.object({ layout: literals(SECTION_LAYOUTS.how_it_works), heading: v.string(), steps: v.array(titledItem) })),
  app_preview: v.optional(v.object({ ...added, layout: literals(SECTION_LAYOUTS.app_preview), heading: v.string(), body: v.string(), cta, screen: image })),
  waitlist: v.object({ ...added, layout: literals(SECTION_LAYOUTS.waitlist), heading: v.string(), body: v.string(),
    emailLabel: v.string(), buttonLabel: v.string(), successMessage: v.string() }),
  footer: v.object({ layout: literals(SECTION_LAYOUTS.footer), closingLine: v.string(), cta, copyrightName: v.string() }),
  proofSlots: v.optional(v.array(v.union(
    v.object({ ...proof, kind: v.literal("testimonial"), quote: v.string(), attribution: v.string() }),
    v.object({ ...proof, kind: v.literal("stat"), value: v.string(), label: v.string() }),
    v.object({ ...proof, kind: v.literal("rating"), value: v.string(), label: v.string() }),
    v.object({ ...proof, kind: v.literal("logo"), name: v.string(), alt: v.string() }),
    v.object({ ...proof, kind: v.literal("press"), outlet: v.string(), quote: v.optional(v.string()) }),
  ))),
});

const receipt = v.object({ leadId: v.id("leads"), createdAt: v.number() });

async function verifiedReceipt(
  ctx: ReadCtx, project: Project, version: PrivateVersion, saved: NonNullable<Doc<"site_configs">["privateLandingTest"]>["lastReceipt"] | undefined,
) {
  if (!saved) return null;
  const lead = await ctx.db.get("leads", saved.leadId);
  return lead && lead.synthetic && lead.deletedAt === undefined && lead.archivedAt === undefined && sameProject(lead, project) && lead.siteConfigId === version.siteConfigId &&
    lead.privateLandingVersionId === version._id && lead.createdAt === saved.createdAt ? saved : null;
}

export const privateLandingPreview = query({
  args: { projectId: v.id("projects") },
  returns: v.union(v.object({ state: v.literal("none") }), v.object({ state: v.literal("unavailable") }), v.object({
    state: v.literal("ready"), versionId: v.id("site_versions"), version: v.int64(), documentId: v.id("documents"),
    spec: specView, kit: brandKitViewValidator.extend({ schemaVersion: v.literal(1) }), card: reviewCardValidator,
    testLeadCount: v.number(), lastReceipt: v.union(receipt, v.null()),
  })),
  handler: async (ctx, { projectId }) => {
    await assertFeatureEnabled(ctx, "workspace");
    const project = await requireBusinessAccess(ctx, projectId, "owner");
    const current = await currentVersion(ctx, project);
    if (!current) return { state: "none" as const };
    const { site, version } = current;
    const inputs = await renderInputs(ctx, project, version);
    if (!inputs) return { state: "unavailable" as const };
    const test = site.privateLandingTest?.versionId === version._id ? site.privateLandingTest : undefined;
    const [card, lastReceipt] = await Promise.all([
      newestReviewCard(ctx, { projectId, ownerId: project.ownerId }, version.documentId), verifiedReceipt(ctx, project, version, test?.lastReceipt),
    ]);
    return { state: "ready" as const, versionId: version._id, version: version.version, documentId: version.documentId, ...inputs,
      card, testLeadCount: test?.count ?? 0, lastReceipt };
  },
});

const requestUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const recordTestLead = mutation({
  args: { projectId: v.id("projects"), versionId: v.id("site_versions"), email: v.string(), requestId: v.string() },
  returns: receipt.extend({ duplicate: v.boolean(), testLeadCount: v.number() }),
  handler: async (ctx, { projectId, versionId, email, requestId }) => {
    await assertFeatureEnabled(ctx, "workspace");
    const project = await requireBusinessAccess(ctx, projectId, "owner");
    if (!isPrivateTestAddress(email)) return refuse("LANDING_TEST_EMAIL_REQUIRED");
    if (!requestUuid.test(requestId)) return refuse("LANDING_TEST_REQUEST_INVALID");
    const current = await currentVersion(ctx, project);
    if (!current || current.version._id !== versionId || !await renderInputs(ctx, project, current.version)) return refuse("LANDING_PREVIEW_UNAVAILABLE");
    const { site, version } = current;
    const count = site.privateLandingTest?.versionId === versionId ? site.privateLandingTest.count : 0;
    const key = requestId.toLowerCase();
    const previous = await ctx.db.query("leads").withIndex("by_privateLandingVersionId_and_privateRequestId",
      (q) => q.eq("privateLandingVersionId", versionId).eq("privateRequestId", key)).unique();
    if (previous) {
      if (!previous.synthetic || !sameProject(previous, project) || previous.siteConfigId !== version.siteConfigId) return refuse(PLATFORM_AUTH_ERROR.notFound);
      return { leadId: previous._id, createdAt: previous.createdAt, duplicate: true, testLeadCount: count };
    }
    const now = Date.now();
    const leadId = await ctx.db.insert("leads", {
      ownerId: project.ownerId, projectId, siteConfigId: version.siteConfigId, synthetic: true, createdAt: now,
      privateLandingVersionId: versionId, privateRequestId: key,
    });
    const lastReceipt = { leadId, createdAt: now };
    const testLeadCount = count + 1;
    await ctx.db.patch("site_configs", site._id, { privateLandingTest: { versionId, count: testLeadCount, lastReceipt } });
    return { ...lastReceipt, duplicate: false, testLeadCount };
  },
});
