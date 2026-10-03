/// <reference types="vite/client" />

import { register as registerRateLimiter } from "@convex-dev/rate-limiter/test";
import { convexTest, type TestConvex } from "convex-test";
import { getFunctionName } from "convex/server";
import { afterEach, describe, expect, test, vi } from "vitest";

import { defaultIdeaFilter } from "../../lib/editorial/contracts/commands";
import type { CommandResult } from "../../lib/editorial/contracts/errors";
import { receiptSplitter } from "../../lib/editorial/fixtures/articles/catalog";
import { buildFixtureEnvelope } from "../../lib/editorial/fixtures/envelopes";
import { api, internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import schema from "../schema";
import * as commandsModule from "./commands";
import * as readsModule from "./reads";

const modules = import.meta.glob("/convex/**/*.ts");

/*
 * WP46-E4f denial matrix: every public editorial function, every kind of
 * caller that is not the bound super-admin. Each must be refused with the
 * right code, return no editorial data and change nothing (a signed-in
 * account's refusal is recorded, within its rate limit; nothing else is).
 */

const OWNER_EMAIL = "owner@example.test";

type Member = { userId: Id<"users">; sessionId: Id<"authSessions"> };
type Caller = { label: string; expected: string; client(t: TestConvex<typeof schema>): ReturnType<TestConvex<typeof schema>["withIdentity"]> | TestConvex<typeof schema>; recorded: boolean };

async function member(t: TestConvex<typeof schema>, email: string, expired = false): Promise<Member> {
  return await t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", { email, emailVerificationTime: 1 });
    await ctx.db.insert("authAccounts", { userId, provider: "email", providerAccountId: email });
    const sessionId = await ctx.db.insert("authSessions", { userId, expirationTime: expired ? 1 : Date.now() + 86_400_000 });
    return { userId, sessionId };
  });
}

const identity = (who: Member) => ({ subject: `${who.userId}|${who.sessionId}`, issuer: "https://convex.test" });

async function world() {
  vi.stubEnv("SUPER_ADMIN_BOOTSTRAP_EMAIL", OWNER_EMAIL);
  const t = convexTest(schema, modules);
  registerRateLimiter(t);
  const owner = await member(t, OWNER_EMAIL);
  const customer = await member(t, "customer@example.test");
  await t.mutation(internal.admin.superAdmin.bootstrapOwner, {});
  const envelope = await buildFixtureEnvelope(receiptSplitter, {
    submissionId: "denials-1",
    nowMs: Date.now(),
    policyVersion: "wp45-policy-test",
    producer: "engine",
    mode: "live",
  });
  const imported = await t.mutation(internal.editorial.service.importSubmission, {
    envelope: JSON.stringify(envelope),
    producer: "engine",
    authority: "none",
  });
  if (!imported.ok) throw new Error(imported.error.code);
  return { t, owner, customer, ...imported.value };
}

/** Every editorial table except the activity log, as row counts. */
async function contentFingerprint(t: TestConvex<typeof schema>) {
  return await t.run(async (ctx) => {
    const tables = [
      "editorial_settings",
      "editorial_ideas",
      "editorial_revisions",
      "editorial_attestations",
      "editorial_flags",
      "editorial_resolutions",
      "editorial_notes",
      "editorial_approvals",
      "editorial_releases",
      "editorial_idempotency",
      "editorial_submissions",
      "editorial_slugs",
      "editorial_idea_summaries",
      "super_admins",
    ] as const;
    const counts: Record<string, string> = {};
    for (const table of tables) {
      const rows = await ctx.db.query(table).take(1000);
      counts[table] = JSON.stringify(rows.map((row) => ({ ...row, _creationTime: 0 })));
    }
    return counts;
  });
}

async function auditCount(t: TestConvex<typeof schema>) {
  return await t.run(async (ctx) => (await ctx.db.query("editorial_audit").take(1000)).length);
}

function code(result: CommandResult<unknown>): string {
  return result.ok ? "OK" : result.error.code;
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("denial matrix for every public editorial function", () => {
  test("the matrix covers every public query and mutation", () => {
    const registered = (module: Record<string, unknown>, flag: "isQuery" | "isMutation") =>
      Object.entries(module)
        .filter(([, fn]) => typeof fn === "function" && (fn as unknown as Record<string, unknown>)[flag] === true)
        .map(([name]) => name)
        .sort();
    expect(registered(readsModule, "isQuery")).toEqual(
      ["getIdea", "getRevision", "listActivity", "listIdeas", "listReleases", "listTrash", "queueSummary", "session", "settings", "stagedPreview"],
    );
    expect(registered(commandsModule, "isMutation")).toHaveLength(22);
    expect(getFunctionName(api.editorial.reads.session)).toBe("editorial/reads:session");
  });

  test("anonymous, forged, customer, revoked and expired callers are refused everywhere and change nothing", async () => {
    const { t, owner, customer, ideaId, revisionId } = await world();
    // An expired session of the owner's own account.
    const expired: Member = await t.run(async (ctx) => ({
      userId: owner.userId,
      sessionId: await ctx.db.insert("authSessions", { userId: owner.userId, expirationTime: 1 }),
    }));
    const nowMs = Date.now();
    const page = { cursor: null, pageSize: 10, nowMs };
    const reads: Array<[string, (client: ReturnType<Caller["client"]>) => Promise<CommandResult<unknown>>]> = [
      ["queueSummary", (c) => c.query(api.editorial.reads.queueSummary, { nowMs })],
      ["listIdeas", (c) => c.query(api.editorial.reads.listIdeas, { filter: defaultIdeaFilter("library"), ...page })],
      ["getIdea", (c) => c.query(api.editorial.reads.getIdea, { ideaId, nowMs })],
      ["getRevision", (c) => c.query(api.editorial.reads.getRevision, { ideaId, revisionId, nowMs })],
      ["listReleases", (c) => c.query(api.editorial.reads.listReleases, { filter: { group: "all", ideaId: null }, ...page })],
      ["listTrash", (c) => c.query(api.editorial.reads.listTrash, page)],
      ["listActivity", (c) => c.query(api.editorial.reads.listActivity, { filter: { ideaId: null, outcome: null }, ...page })],
      ["settings", (c) => c.query(api.editorial.reads.settings, { nowMs })],
    ];
    const key = (label: string) => `deny-${label}-0001`;
    const commands: Array<[string, (client: ReturnType<Caller["client"]>) => Promise<CommandResult<unknown>>]> = [
      ["createRevision", (c) => c.mutation(api.editorial.commands.createRevision, { ideaId, fromRevisionId: revisionId, idempotencyKey: key("fork") })],
      ["discardRevision", (c) => c.mutation(api.editorial.commands.discardRevision, { ideaId, revisionId, expectedVersion: 1, reason: "Forged" })],
      ["saveDraft", (c) => c.mutation(api.editorial.commands.saveDraft, { ideaId, revisionId, baseVersion: 1, patch: { title: "Forged" }, idempotencyKey: key("save") })],
      ["setCandidateDecision", (c) => c.mutation(api.editorial.commands.setCandidateDecision, { ideaId, expectedVersion: 1, input: { decision: "accepted", rationale: "Forged" } })],
      ["markReviewed", (c) => c.mutation(api.editorial.commands.markReviewed, { revisionId, reviewItemId: "section:problem", dependencyHash: "x", note: null })],
      ["retractReview", (c) => c.mutation(api.editorial.commands.retractReview, { revisionId, reviewItemId: "section:problem" })],
      ["flagReviewItem", (c) => c.mutation(api.editorial.commands.flagReviewItem, { revisionId, reviewItemId: "section:problem", dependencyHash: "x", input: { severity: "high", note: "Forged" } })],
      ["resolveIssue", (c) => c.mutation(api.editorial.commands.resolveIssue, { revisionId, issueId: "checks:stale", dependencyHash: "x", note: "Forged" })],
      ["addNote", (c) => c.mutation(api.editorial.commands.addNote, { revisionId, target: { kind: "section", id: "problem" }, note: "Forged" })],
      ["requestChanges", (c) => c.mutation(api.editorial.commands.requestChanges, { revisionId, note: "Forged" })],
      ["resumeReview", (c) => c.mutation(api.editorial.commands.resumeReview, { revisionId })],
      ["runChecks", (c) => c.mutation(api.editorial.commands.runChecks, { revisionId, expectedArtifactHash: "0".repeat(64) })],
      ["approveRevision", (c) => c.mutation(api.editorial.commands.approveRevision, { revisionId, artifactHash: "0".repeat(64), input: { attest: true, note: null } })],
      ["prepareRelease", (c) => c.mutation(api.editorial.commands.prepareRelease, { revisionId, expectedLiveReleaseId: null, idempotencyKey: key("prepare") })],
      ["publishRelease", (c) => c.mutation(api.editorial.commands.publishRelease, { releaseId: "rel_x", expectedState: "preview_ready", approvalId: "apr_x", idempotencyKey: key("publish") })],
      ["cancelRelease", (c) => c.mutation(api.editorial.commands.cancelRelease, { releaseId: "rel_x", expectedState: "preparing", reason: "Forged" })],
      ["retryRelease", (c) => c.mutation(api.editorial.commands.retryRelease, { releaseId: "rel_x", expectedState: "failed", idempotencyKey: key("retry") })],
      ["reconcileRelease", (c) => c.mutation(api.editorial.commands.reconcileRelease, { releaseId: "rel_x" })],
      ["requestRollback", (c) => c.mutation(api.editorial.commands.requestRollback, { ideaId, targetReleaseId: "rel_x", expectedLiveReleaseId: "rel_y", reason: "Forged", idempotencyKey: key("rollback") })],
      ["unpublishIdea", (c) => c.mutation(api.editorial.commands.unpublishIdea, { ideaId, expectedLiveReleaseId: "rel_x", reason: "Forged", idempotencyKey: key("unpublish") })],
      ["trashIdea", (c) => c.mutation(api.editorial.commands.trashIdea, { ideaId, expectedVersion: 1, reason: "Forged" })],
      ["restoreIdea", (c) => c.mutation(api.editorial.commands.restoreIdea, { ideaId, expectedVersion: 1, reason: "Forged" })],
    ];
    expect(reads.length + 1).toBe(9);
    expect(commands.length).toBe(22);

    const callers: Caller[] = [
      { label: "anonymous", expected: "UNAUTHENTICATED", recorded: false, client: (tc) => tc },
      {
        label: "forged identity",
        expected: "UNAUTHENTICATED",
        recorded: false,
        client: (tc) => tc.withIdentity({ subject: `${owner.userId}|${customer.sessionId}`, issuer: "https://convex.test" }),
      },
      { label: "customer", expected: "FORBIDDEN", recorded: true, client: (tc) => tc.withIdentity(identity(customer)) },
    ];

    const before = await contentFingerprint(t);
    for (const caller of callers) {
      const auditBefore = await auditCount(t);
      for (const [name, read] of reads) {
        const result = await read(caller.client(t));
        expect(code(result), `${caller.label} ${name}`).toBe(caller.expected);
        expect(JSON.stringify(result), `${caller.label} ${name}`).not.toContain(receiptSplitter.title);
      }
      const session = await caller.client(t).query(api.editorial.reads.session, { nowMs });
      expect(session.editor, `${caller.label} session`).toBeNull();
      expect(await caller.client(t).query(api.editorial.reads.stagedPreview, { releaseId: "rel_x" }), `${caller.label} staged preview`).toBeNull();
      for (const [name, command] of commands) {
        const result = await command(caller.client(t));
        expect(code(result), `${caller.label} ${name}`).toBe(caller.expected);
        expect(JSON.stringify(result), `${caller.label} ${name}`).not.toContain(receiptSplitter.title);
      }
      const written = (await auditCount(t)) - auditBefore;
      // A signed-in account's refusals are recorded up to its hourly limit (20).
      if (caller.recorded) expect(written, caller.label).toBe(Math.min(commands.length, 20));
      else expect(written, caller.label).toBe(0);
    }

    // The owner's own expired session: commands enforce the stored expiry.
    for (const [name, command] of commands) {
      const result = await command(t.withIdentity(identity(expired)));
      expect(code(result), `expired ${name}`).toBe("UNAUTHENTICATED");
    }

    // A revoked owner is an account without the capability from the next request on.
    await t.mutation(internal.admin.superAdmin.revokeSuperAdmin, { reason: "Matrix revocation" });
    const revoked = t.withIdentity(identity(owner));
    expect(await revoked.query(api.editorial.reads.stagedPreview, { releaseId: "rel_x" })).toBeNull();
    for (const [name, read] of reads) expect(code(await read(revoked)), `revoked ${name}`).toBe("FORBIDDEN");
    for (const [name, command] of commands) expect(code(await command(revoked)), `revoked ${name}`).toBe("FORBIDDEN");

    const after = await contentFingerprint(t);
    // Only the revocation changed anything outside the activity log.
    expect({ ...after, super_admins: "" }).toEqual({ ...before, super_admins: "" });
  });
});
