/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, expect, test, vi } from "vitest";

import { buildFixtureRecord } from "../../lib/engine/__fixtures__/recordV2";
import { compileResearchRecord } from "../../lib/engine/compile";
import { validateEngineSubmission } from "../../lib/editorial/engine/validated-artifact";
import { api, internal } from "../_generated/api";
import schema from "../schema";

const modules = import.meta.glob("/convex/**/*.ts");
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

test.each(["canonical", "staging"] as const)("an exact private revision is activated once and emergency unpublish revokes every public lookup (%s)", async (target) => {
  vi.stubEnv("SUPER_ADMIN_BOOTSTRAP_EMAIL", "release-editor@example.test");
  vi.stubEnv("EDITORIAL_RELEASE_ENABLED", "true");
  const stagingBackend = "https://wonderful-armadillo-159.eu-west-1.convex.cloud";
  vi.stubEnv("EDITORIAL_PUBLIC_SITE_URL", target === "staging"
    ? "https://weekendmvp-ab123456-john-iseghohis-projects.vercel.app/"
    : "http://127.0.0.1:3000/");
  if (target === "staging") {
    vi.stubEnv("CONVEX_CLOUD_URL", stagingBackend);
    vi.stubEnv("EDITORIAL_STAGING_BACKEND_URL", stagingBackend);
    vi.stubEnv("EDITORIAL_STAGING_BYPASS_SECRET", "staging-test-token");
  }
  vi.stubEnv("EDITORIAL_READER_COMMIT", "local-e6-reader");
  const health = () => Response.json({ protocol: 1, commit: "local-e6-reader", backend: stagingBackend });
  const t = convexTest(schema, modules);
  const owner = await t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", {
      email: "release-editor@example.test", emailVerificationTime: Date.now(), name: "Editor",
    });
    await ctx.db.insert("authAccounts", { userId, provider: "email", providerAccountId: "release-editor@example.test" });
    const sessionId = await ctx.db.insert("authSessions", { userId, expirationTime: Date.now() + 86_400_000 });
    return { userId, sessionId };
  });
  expect((await t.mutation(internal.admin.superAdmin.bootstrapOwner, {})).outcome).toBe("bound");
  const editor = t.withIdentity({ subject: `${owner.userId}|${owner.sessionId}`, issuer: "https://convex.test" });

  const record = buildFixtureRecord((draft) => {
    draft.mode = "live";
    draft.brief.slug = "release-gated-idea";
  });
  const compiled = compileResearchRecord({
    record, slug: record.brief.slug, category: "ai-tools", tools: ["cursor", "claude"],
    audiences: ["developers", "weekend-builders"], buildTime: "10", revenueGoal: "1k-month", publishedAt: "2026-10-01",
  });
  const source = { recordJson: JSON.stringify(record), mdx: compiled.mdx, manifestJson: JSON.stringify(compiled.manifestEntry) };
  const checked = await validateEngineSubmission(source);
  const imported = await t.mutation(internal.editorial.service.importValidatedEngine, {
    envelope: JSON.stringify(checked.envelope), recordJson: checked.recordJson,
    recordHash: checked.recordHash, manifestJson: source.manifestJson,
  });
  if (!imported.ok) throw new Error(imported.error.message);
  const { ideaId, revisionId } = imported.value;
  expect(await t.query(api.editorial.public.bySlug, { slug: record.brief.slug })).toEqual({ state: "removed" });
  expect((await editor.action(api.editorial.checks.run, {
    revisionId, expectedArtifactHash: checked.envelope.artifactHash,
  })).ok).toBe(true);
  expect((await editor.mutation(api.editorial.commands.setCandidateDecision, {
    ideaId, expectedVersion: 1, input: { decision: "accepted", rationale: "Approved for release test" },
  })).ok).toBe(true);
  const read = () => editor.query(api.editorial.reads.getRevision, { ideaId, revisionId, nowMs: Date.now() });
  let revision = await read();
  if (!revision.ok) throw new Error(revision.error.message);
  for (const item of revision.value.reviewItems) {
    if (item.status === "reviewed") continue;
    const result = await editor.mutation(api.editorial.commands.markReviewed, {
      revisionId, reviewItemId: item.id, dependencyHash: item.dependencyHash, note: null,
    });
    expect(result.ok).toBe(true);
  }
  revision = await read();
  if (!revision.ok) throw new Error(revision.error.message);
  for (const issue of revision.value.issues) {
    if (issue.severity !== "warning" || !issue.resolvable || issue.resolution) continue;
    const result = await editor.mutation(api.editorial.commands.resolveIssue, {
      revisionId, issueId: issue.id, dependencyHash: issue.dependencyHash,
      note: "Human source review completed for release test.",
    });
    expect(result.ok).toBe(true);
  }
  revision = await read();
  if (!revision.ok) throw new Error(revision.error.message);
  expect(revision.value.eligibility.canApprove).toBe(true);
  const approval = await editor.mutation(api.editorial.commands.approveRevision, {
    revisionId, artifactHash: revision.value.hashes.artifact,
    input: { attest: true, note: "Source review complete." },
  });
  if (!approval.ok) throw new Error(approval.error.message);
  const prepared = await editor.mutation(api.editorial.commands.prepareRelease, {
    revisionId, expectedLiveReleaseId: null, idempotencyKey: "prepare-release-gated-idea",
  });
  if (!prepared.ok) throw new Error(prepared.error.message);
  const releaseId = prepared.value.releaseId;
  expect(await t.query(api.editorial.public.bySlug, { slug: record.brief.slug })).toEqual({ state: "removed" });
  expect(await t.query(api.editorial.reads.stagedPreview, { releaseId })).toBeNull();
  const preview = await editor.query(api.editorial.reads.stagedPreview, { releaseId });
  expect(preview?.markdown).toBe(checked.envelope.markdown);
  expect(preview?.artifactHash).toBe(revision.value.hashes.artifact);

  const step = (state: "preparing" | "publish_requested" | "deploying" | "verifying" | "activating" | "verifying_public") =>
    t.mutation(internal.editorial.service.workerAdvance, { releaseId, expectedState: state, report: { kind: "completed" } });
  await t.action(internal.editorial.worker.run, { releaseId });
  const published = await editor.mutation(api.editorial.commands.publishRelease, {
    releaseId, expectedState: "preview_ready", approvalId: approval.value.approvalId,
    idempotencyKey: "publish-release-gated-idea",
  });
  expect(published.ok).toBe(true);
  vi.stubGlobal("fetch", vi.fn(async (url: URL, init?: RequestInit) => {
    if (target === "staging") expect(init?.headers).toEqual({ "x-vercel-protection-bypass": "staging-test-token" });
    const pathname = new URL(url).pathname;
    if (pathname === "/api/editorial/reader-health") return health();
    if (pathname === `/ideas/${record.brief.slug}`) return new Response("stale cached page", { status: 200 });
    return new Response("Unexpected probe", { status: 500 });
  }));
  await t.action(internal.editorial.worker.run, { releaseId });
  const pending = await t.run(async (ctx) => ctx.db.query("editorial_releases")
    .withIndex("by_key", (q) => q.eq("key", releaseId)).unique());
  expect(pending?.state).toBe("verifying_public");
  expect(pending?.error?.code).toBe("RELEASE_WORKER_FAILED");
  expect((await t.query(api.editorial.public.bySlug, { slug: record.brief.slug })).state).toBe("released");
  vi.stubGlobal("fetch", vi.fn(async (url: URL, init?: RequestInit) => {
    if (target === "staging") expect(init?.headers).toEqual({ "x-vercel-protection-bypass": "staging-test-token" });
    const pathname = new URL(url).pathname;
    if (pathname === "/api/editorial/reader-health") {
      return health();
    }
    if (pathname === `/ideas/${record.brief.slug}`) {
      const publication = await t.query(api.editorial.public.bySlug, { slug: record.brief.slug });
      return publication.state === "released"
        ? new Response(`<main data-editorial-artifact-hash="${publication.artifactHash}"></main>`, { status: 200 })
        : new Response("Not Found", { status: 404 });
    }
    if (pathname === "/sitemap.xml") return new Response("<urlset></urlset>", { status: 200 });
    return new Response("Unexpected probe", { status: 500 });
  }));
  // A restored database can retain a worker-state release while its pending
  // scheduler invocation is absent. Model that loss with a canceled job, then
  // let the recovery action find the persisted release independently.
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  try {
    const lostJobId = await t.run((ctx) => ctx.scheduler.runAfter(60_000, internal.editorial.worker.run, { releaseId }));
    const scheduled = await t.run((ctx) => ctx.db.system.get(lostJobId));
    expect(scheduled?.state.kind).toBe("pending");
    await t.run((ctx) => ctx.scheduler.cancel(lostJobId));
    const canceled = await t.run((ctx) => ctx.db.system.get(lostJobId));
    expect(canceled?.state.kind).toBe("canceled");
  } finally {
    vi.useRealTimers();
  }
  const queuedForRecovery = await t.query(internal.editorial.service.workerQueue, {});
  expect(queuedForRecovery.some((row) => row.releaseId === releaseId && row.state === "verifying_public")).toBe(true);
  await t.action(internal.editorial.worker.recover, {});
  const verified = await t.run(async (ctx) => ctx.db.query("editorial_releases")
    .withIndex("by_key", (q) => q.eq("key", releaseId)).unique());
  expect(verified?.state).toBe("succeeded");
  // WP56: activation and removal ask Next.js to refresh cached idea lists.
  const revalidations = async () => (await t.run((ctx) => ctx.db.system.query("_scheduled_functions").collect()))
    .filter((job) => job.name.startsWith("revalidate") &&
      JSON.stringify(job.args).includes(`"idea:${record.brief.slug}"`)).length;
  const afterActivation = await revalidations();
  expect(afterActivation).toBeGreaterThan(0);
  const live = await t.query(api.editorial.public.bySlug, { slug: record.brief.slug });
  expect(live.state).toBe("released");
  if (live.state !== "released") throw new Error("No public release");
  const pointerAfterRecovery = await t.run(async (ctx) => ctx.db.query("editorial_public_pointers")
    .withIndex("by_slug", (q) => q.eq("slug", record.brief.slug)).unique());
  await t.action(internal.editorial.worker.recover, {});
  const pointerAfterRepeat = await t.run(async (ctx) => ctx.db.query("editorial_public_pointers")
    .withIndex("by_slug", (q) => q.eq("slug", record.brief.slug)).unique());
  expect(pointerAfterRepeat).toEqual(pointerAfterRecovery);
  expect("markdown" in live).toBe(false);
  expect("body" in (await t.query(api.ideas.bySlug, { slug: record.brief.slug }))!).toBe(false);
  expect((await step("activating")).moved).toBe(false);

  // A damaged/missing pointer cannot resurrect an older checked-in page.
  await t.run(async (ctx) => {
    const pointer = await ctx.db.query("editorial_public_pointers")
      .withIndex("by_slug", (q) => q.eq("slug", record.brief.slug)).unique();
    if (pointer) await ctx.db.delete(pointer._id);
  });
  expect(await t.query(api.editorial.public.visibility, { slug: record.brief.slug })).toBe("removed");
  expect(await t.query(api.editorial.public.bySlug, { slug: record.brief.slug })).toEqual({ state: "removed" });

  vi.stubGlobal("fetch", vi.fn(async (url: URL, init?: RequestInit) => {
    if (target === "staging") expect(init?.headers).toEqual({ "x-vercel-protection-bypass": "staging-test-token" });
    const pathname = new URL(url).pathname;
    if (pathname === "/api/editorial/reader-health") return health();
    if (pathname === `/ideas/${record.brief.slug}`) return new Response("stale page", { status: 200 });
    return new Response("Unexpected probe", { status: 500 });
  }));
  const removed = await editor.mutation(api.editorial.commands.unpublishIdea, {
    ideaId, expectedLiveReleaseId: releaseId, reason: "Emergency takedown test",
    idempotencyKey: "remove-release-gated-idea",
  });
  expect(removed.ok).toBe(true);
  if (!removed.ok) throw new Error(removed.error.message);
  await t.action(internal.editorial.worker.run, { releaseId: removed.value.releaseId });
  const failedRemoval = await t.run(async (ctx) => ctx.db.query("editorial_releases")
    .withIndex("by_key", (q) => q.eq("key", removed.value.releaseId)).unique());
  expect(failedRemoval?.state).toBe("failed");
  const retried = await editor.mutation(api.editorial.commands.retryRelease, {
    releaseId: removed.value.releaseId, expectedState: "failed", idempotencyKey: "retry-removal-probe",
  });
  expect(retried.ok).toBe(true);
  vi.stubGlobal("fetch", vi.fn(async (url: URL, init?: RequestInit) => {
    if (target === "staging") expect(init?.headers).toEqual({ "x-vercel-protection-bypass": "staging-test-token" });
    const pathname = new URL(url).pathname;
    if (pathname === "/api/editorial/reader-health") return health();
    if (pathname === `/ideas/${record.brief.slug}`) return new Response("Not Found", { status: 404 });
    if (pathname === "/sitemap.xml") return new Response("<urlset></urlset>", { status: 200 });
    return new Response("Unexpected probe", { status: 500 });
  }));
  await t.action(internal.editorial.worker.run, { releaseId: removed.value.releaseId });
  const verifiedRemoval = await t.run(async (ctx) => ctx.db.query("editorial_releases")
    .withIndex("by_key", (q) => q.eq("key", removed.value.releaseId)).unique());
  expect(verifiedRemoval?.state).toBe("succeeded");
  expect(await t.query(api.editorial.public.bySlug, { slug: record.brief.slug })).toEqual({ state: "removed" });
  expect(await t.query(api.ideas.bySlug, { slug: record.brief.slug })).toBeNull();
  const listing = await t.query(api.editorial.public.listing, {});
  expect(listing.find((row) => row.slug === record.brief.slug)?.state).toBe("removed");
  expect((await t.query(api.ideas.list, { limit: 20 })).page.some((row) => row.slug === record.brief.slug)).toBe(false);
  expect(await revalidations()).toBeGreaterThan(afterActivation);
  expect((await step("activating")).moved).toBe(false);
});
