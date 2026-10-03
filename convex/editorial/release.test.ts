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

test("an exact private revision is activated once and emergency unpublish revokes every public lookup", async () => {
  vi.stubEnv("SUPER_ADMIN_BOOTSTRAP_EMAIL", "release-editor@example.test");
  vi.stubEnv("EDITORIAL_RELEASE_ENABLED", "true");
  vi.stubEnv("EDITORIAL_PUBLIC_SITE_URL", "http://127.0.0.1:3000/");
  vi.stubEnv("EDITORIAL_READER_COMMIT", "local-e6-reader");
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
  vi.stubGlobal("fetch", vi.fn(async (url: URL) => {
    const pathname = new URL(url).pathname;
    if (pathname === "/api/editorial/reader-health") return Response.json({ protocol: 1, commit: "local-e6-reader" });
    if (pathname === `/ideas/${record.brief.slug}`) return new Response("stale cached page", { status: 200 });
    return new Response("Unexpected probe", { status: 500 });
  }));
  await t.action(internal.editorial.worker.run, { releaseId });
  const pending = await t.run(async (ctx) => ctx.db.query("editorial_releases")
    .withIndex("by_key", (q) => q.eq("key", releaseId)).unique());
  expect(pending?.state).toBe("verifying_public");
  expect(pending?.error?.code).toBe("RELEASE_WORKER_FAILED");
  expect((await t.query(api.editorial.public.bySlug, { slug: record.brief.slug })).state).toBe("released");
  vi.stubGlobal("fetch", vi.fn(async (url: URL) => {
    const pathname = new URL(url).pathname;
    if (pathname === "/api/editorial/reader-health") {
      return Response.json({ protocol: 1, commit: "local-e6-reader" });
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
  await t.action(internal.editorial.worker.run, { releaseId });
  const verified = await t.run(async (ctx) => ctx.db.query("editorial_releases")
    .withIndex("by_key", (q) => q.eq("key", releaseId)).unique());
  expect(verified?.state).toBe("succeeded");
  const live = await t.query(api.editorial.public.bySlug, { slug: record.brief.slug });
  expect(live.state).toBe("released");
  if (live.state !== "released") throw new Error("No public release");
  expect(live.markdown).toBe(checked.envelope.markdown);
  expect((await t.query(api.ideas.bySlug, { slug: record.brief.slug }))?.body).toBe(checked.envelope.markdown);
  expect((await step("activating")).moved).toBe(false);

  // A damaged/missing pointer cannot resurrect an older checked-in page.
  await t.run(async (ctx) => {
    const pointer = await ctx.db.query("editorial_public_pointers")
      .withIndex("by_slug", (q) => q.eq("slug", record.brief.slug)).unique();
    if (pointer) await ctx.db.delete(pointer._id);
  });
  expect(await t.query(api.editorial.public.visibility, { slug: record.brief.slug })).toBe("removed");
  expect(await t.query(api.editorial.public.bySlug, { slug: record.brief.slug })).toEqual({ state: "removed" });

  const removed = await editor.mutation(api.editorial.commands.unpublishIdea, {
    ideaId, expectedLiveReleaseId: releaseId, reason: "Emergency takedown test",
    idempotencyKey: "remove-release-gated-idea",
  });
  expect(removed.ok).toBe(true);
  if (removed.ok) await t.action(internal.editorial.worker.run, { releaseId: removed.value.releaseId });
  expect(await t.query(api.editorial.public.bySlug, { slug: record.brief.slug })).toEqual({ state: "removed" });
  expect(await t.query(api.ideas.bySlug, { slug: record.brief.slug })).toBeNull();
  const listing = await t.query(api.editorial.public.listing, {});
  expect(listing.find((row) => row.slug === record.brief.slug)?.state).toBe("removed");
  expect((await t.query(api.ideas.list, { limit: 20 })).page.some((row) => row.slug === record.brief.slug)).toBe(false);
  expect((await step("activating")).moved).toBe(false);
});
