/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, describe, expect, test, vi } from "vitest";

import { buildFixtureRecord } from "../../lib/engine/__fixtures__/recordV2";
import { compileResearchRecord } from "../../lib/engine/compile";
import { validateEngineSubmission } from "../../lib/editorial/engine/validated-artifact";
import { submissionArtifactHash } from "../../lib/editorial/domain/artifact";
import { sha256Hex } from "../../lib/editorial/domain/hash";
import { api, internal } from "../_generated/api";
import schema from "../schema";

const modules = import.meta.glob("/convex/**/*.ts");

afterEach(() => vi.unstubAllEnvs());

function input() {
  const record = buildFixtureRecord((draft) => {
    draft.mode = "live";
    draft.brief.slug = "signalpass-idea";
  });
  const compiled = compileResearchRecord({
    record,
    slug: record.brief.slug,
    category: "ai-tools",
    tools: ["cursor", "claude"],
    audiences: ["developers", "weekend-builders"],
    buildTime: "10",
    revenueGoal: "1k-month",
    publishedAt: "2026-10-01",
  });
  return { recordJson: JSON.stringify(record), mdx: compiled.mdx, manifestJson: JSON.stringify(compiled.manifestEntry) };
}

describe("private engine ingestion", () => {
  test("the Node validator and one transaction bind the candidate to its normalized record", async () => {
    const t = convexTest(schema, modules);
    const source = input();
    const checked = await validateEngineSubmission(source);
    const args = {
      envelope: JSON.stringify(checked.envelope),
      recordJson: checked.recordJson,
      recordHash: checked.recordHash,
      manifestJson: source.manifestJson,
    };
    const first = await t.action(internal.editorial.ingest.validateAndImport, source);
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(first.value.duplicate).toBe(false);
    const second = await t.mutation(internal.editorial.service.importValidatedEngine, args);
    expect(second.ok && second.value.duplicate).toBe(true);
    const rows = await t.run(async (ctx) => ctx.db.query("editorial_engine_records").take(10));
    expect(rows).toHaveLength(1);
    expect(rows[0]?.ideaId).toBe(first.value.ideaId);
    expect(rows[0]?.recordHash).toBe(checked.recordHash);
    const revisions = await t.run(async (ctx) => ctx.db.query("editorial_revisions").take(10));
    expect(revisions).toHaveLength(1);
    expect(revisions[0]?.claims.every((claim) => claim.verificationAuthority === "engine_receipt")).toBe(true);
    expect(revisions[0]?.checks).toEqual([]);
  });

  test("a changed record hash or fixture mode is refused before a candidate is stored", async () => {
    const t = convexTest(schema, modules);
    const source = input();
    const checked = await validateEngineSubmission(source);
    const args = {
      envelope: JSON.stringify(checked.envelope),
      recordJson: checked.recordJson,
      recordHash: "0".repeat(64),
      manifestJson: source.manifestJson,
    };
    await expect(t.mutation(internal.editorial.service.importValidatedEngine, args)).rejects.toThrow(/Research record hash mismatch/);
    const fixture = JSON.parse(checked.recordJson) as Record<string, unknown>;
    fixture.mode = "fixture";
    const fixtureJson = JSON.stringify(fixture);
    await expect(t.mutation(internal.editorial.service.importValidatedEngine, {
      ...args,
      recordJson: fixtureJson,
      recordHash: await sha256Hex(fixtureJson),
    })).rejects.toThrow(/Engine record and editorial envelope disagree/);
    expect(await t.run(async (ctx) => ctx.db.query("editorial_engine_records").take(10))).toEqual([]);
    expect(await t.run(async (ctx) => ctx.db.query("editorial_ideas").take(10))).toEqual([]);
  });

  test("the older private import seam cannot grant an engine receipt", async () => {
    const t = convexTest(schema, modules);
    await expect(t.mutation(internal.editorial.service.importSubmission, {
      envelope: "{}",
      authority: "engine_receipt" as "none",
      producer: "engine",
    })).rejects.toThrow();
  });

  test("only the editorial owner can audit a saved engine revision, and edits require a new failing check", async () => {
    vi.stubEnv("SUPER_ADMIN_BOOTSTRAP_EMAIL", "editor@example.test");
    const t = convexTest(schema, modules);
    const owner = await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", {
        email: "editor@example.test", emailVerificationTime: Date.now(), name: "Editor",
      });
      await ctx.db.insert("authAccounts", { userId, provider: "email", providerAccountId: "editor@example.test" });
      const sessionId = await ctx.db.insert("authSessions", {
        userId, expirationTime: Date.now() + 24 * 60 * 60 * 1000,
      });
      return { userId, sessionId };
    });
    const customer = await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", { email: "reader@example.test", emailVerificationTime: Date.now() });
      await ctx.db.insert("authAccounts", { userId, provider: "email", providerAccountId: "reader@example.test" });
      const sessionId = await ctx.db.insert("authSessions", {
        userId, expirationTime: Date.now() + 24 * 60 * 60 * 1000,
      });
      return { userId, sessionId };
    });
    expect((await t.mutation(internal.admin.superAdmin.bootstrapOwner, {})).outcome).toBe("bound");
    const source = input();
    const checked = await validateEngineSubmission(source);
    const imported = await t.mutation(internal.editorial.service.importValidatedEngine, {
      envelope: JSON.stringify(checked.envelope),
      recordJson: checked.recordJson,
      recordHash: checked.recordHash,
      manifestJson: source.manifestJson,
    });
    expect(imported.ok).toBe(true);
    if (!imported.ok) return;
    const args = { revisionId: imported.value.revisionId, expectedArtifactHash: checked.envelope.artifactHash };
    expect((await t.action(api.editorial.checks.run, args)).ok).toBe(false);
    const asCustomer = t.withIdentity({ subject: `${customer.userId}|${customer.sessionId}`, issuer: "https://convex.test" });
    const denied = await asCustomer.action(api.editorial.checks.run, args);
    expect(denied.ok ? "OK" : denied.error.code).toBe("FORBIDDEN");
    const asOwner = t.withIdentity({ subject: `${owner.userId}|${owner.sessionId}`, issuer: "https://convex.test" });
    expect((await asOwner.action(api.editorial.checks.run, args)).ok).toBe(true);
    const saved = await t.run(async (ctx) => ctx.db.query("editorial_revisions")
      .withIndex("by_key", (q) => q.eq("key", imported.value.revisionId)).unique());
    expect(saved?.checks.find((check) => check.id === "engine-artifact-audit")?.outcome).toBe("pass");

    const accepted = await asOwner.mutation(api.editorial.commands.setCandidateDecision, {
      ideaId: imported.value.ideaId,
      expectedVersion: 1,
      input: { decision: "accepted", rationale: "Source review can proceed" },
    });
    expect(accepted.ok).toBe(true);
    const revisionRead = () => asOwner.query(api.editorial.reads.getRevision, {
      ideaId: imported.value.ideaId, revisionId: imported.value.revisionId, nowMs: Date.now(),
    });
    let view = await revisionRead();
    expect(view.ok).toBe(true);
    if (!view.ok) return;
    for (const item of view.value.reviewItems) {
      if (item.status !== "reviewed") {
        expect((await asOwner.mutation(api.editorial.commands.markReviewed, {
          revisionId: imported.value.revisionId,
          reviewItemId: item.id,
          dependencyHash: item.dependencyHash,
          note: null,
        })).ok).toBe(true);
      }
    }
    view = await revisionRead();
    if (!view.ok) throw new Error("Revision disappeared during review");
    for (const issue of view.value.issues) {
      if (issue.severity === "warning" && issue.resolvable && !issue.resolution) {
        expect((await asOwner.mutation(api.editorial.commands.resolveIssue, {
          revisionId: imported.value.revisionId,
          issueId: issue.id,
          dependencyHash: issue.dependencyHash,
          note: "Human source review completed for this test.",
        })).ok).toBe(true);
      }
    }
    view = await revisionRead();
    if (!view.ok) throw new Error("Revision disappeared before approval");
    expect(view.value.eligibility.canApprove).toBe(true);
    expect((await asOwner.mutation(api.editorial.commands.approveRevision, {
      revisionId: imported.value.revisionId,
      artifactHash: view.value.hashes.artifact,
      input: { attest: true, note: "Reviewed sources and evidence." },
    })).ok).toBe(true);

    const markdown = checked.envelope.markdown.replace("$1.4 billion", "$9.4 billion");
    expect(markdown).not.toBe(checked.envelope.markdown);
    await t.run(async (ctx) => {
      if (!saved) throw new Error("Missing revision");
      await ctx.db.patch(saved._id, { markdown });
    });
    const stale = await asOwner.action(api.editorial.checks.run, args);
    expect(stale.ok ? "OK" : stale.error.code).toBe("STALE_REVIEW_TARGET");
    const currentHash = await submissionArtifactHash({ ...checked.envelope, markdown });
    expect((await asOwner.action(api.editorial.checks.run, { ...args, expectedArtifactHash: currentHash })).ok).toBe(true);
    const edited = await t.run(async (ctx) => ctx.db.query("editorial_revisions")
      .withIndex("by_key", (q) => q.eq("key", imported.value.revisionId)).unique());
    expect(edited?.checks.find((check) => check.id === "engine-artifact-audit")?.outcome).toBe("fail");
    if (!edited) throw new Error("Missing checked revision");
    const checkCommit = {
      revisionId: imported.value.revisionId,
      expectedArtifactHash: currentHash,
      expectedRecordHash: checked.recordHash,
      expectedBindingHash: await sha256Hex(JSON.stringify([JSON.stringify(checked.envelope), source.manifestJson])),
      checks: edited.checks,
    };
    const wrongPolicy = await asOwner.mutation(internal.editorial.checkInputs.commit, {
      ...checkCommit,
      expectedPolicyVersion: "not-connected",
    });
    expect(wrongPolicy.ok ? "OK" : wrongPolicy.error.code).toBe("PRECONDITION_FAILED");
    await t.run(async (ctx) => {
      const pinned = await ctx.db.query("editorial_engine_records")
        .withIndex("by_ideaId", (q) => q.eq("ideaId", imported.value.ideaId)).unique();
      if (!pinned) throw new Error("Missing pinned record");
      await ctx.db.patch(pinned._id, { manifestJson: "{}" });
    });
    const changedBinding = await asOwner.mutation(internal.editorial.checkInputs.commit, {
      ...checkCommit,
      expectedPolicyVersion: edited.checks[0]?.policyVersion ?? "",
    });
    expect(changedBinding.ok ? "OK" : changedBinding.error.code).toBe("PRECONDITION_FAILED");
    await t.run(async (ctx) => {
      const pinned = await ctx.db.query("editorial_engine_records")
        .withIndex("by_ideaId", (q) => q.eq("ideaId", imported.value.ideaId)).unique();
      if (!pinned) throw new Error("Missing pinned record");
      await ctx.db.delete(pinned._id);
    });
    const noRecord = await asOwner.action(api.editorial.checks.run, { ...args, expectedArtifactHash: currentHash });
    expect(noRecord.ok ? "OK" : noRecord.error.code).toBe("PRECONDITION_FAILED");
  });
});
