/// <reference types="vite/client" />

import { register as registerRateLimiter } from "@convex-dev/rate-limiter/test";
import { convexTest, type TestConvex } from "convex-test";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { defaultIdeaFilter } from "../../lib/editorial/contracts/commands";
import type { CommandResult } from "../../lib/editorial/contracts/errors";
import { receiptSplitter } from "../../lib/editorial/fixtures/articles/catalog";
import { buildFixtureEnvelope } from "../../lib/editorial/fixtures/envelopes";
import { api, internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import schema from "../schema";

const modules = import.meta.glob("/convex/**/*.ts");

/*
 * The public editorial functions with real identities (WP46-E4c): who may
 * call them, what a refusal writes, and what the live environment refuses.
 * Functions run in convex-test, one transaction at a time.
 */

const OWNER_EMAIL = "owner@example.test";
const START = Date.parse("2026-10-01T09:00:00Z");
const MINUTE = 60 * 1000;

type Member = { userId: Id<"users">; sessionId: Id<"authSessions"> };

function code(result: CommandResult<unknown>): string {
  return result.ok ? "OK" : result.error.code;
}

function value<T>(result: CommandResult<T>): T {
  if (!result.ok) throw new Error(`${result.error.code}: ${result.error.message}`);
  return result.value;
}

/**
 * An account as Convex Auth leaves it. Email-link sign-in and a Google
 * sign-in whose address Google verified both record a verified email; an
 * account without one can never be bound.
 */
async function member(t: TestConvex<typeof schema>, email: string, provider = "email", verified = true): Promise<Member> {
  return await t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", {
      email,
      ...(verified ? { emailVerificationTime: 1 } : {}),
      name: "Owner Name",
    });
    await ctx.db.insert("authAccounts", { userId, provider, providerAccountId: `${provider}-${email}` });
    const sessionId = await ctx.db.insert("authSessions", { userId, expirationTime: START + 30 * 24 * 60 * MINUTE });
    return { userId, sessionId };
  });
}

/** A fresh sign-in: Convex Auth creates a new session for it. */
async function signInAgain(t: TestConvex<typeof schema>, who: Member): Promise<Member> {
  const sessionId = await t.run(async (ctx) =>
    ctx.db.insert("authSessions", { userId: who.userId, expirationTime: Date.now() + 30 * 24 * 60 * MINUTE }),
  );
  return { ...who, sessionId };
}

function as(t: TestConvex<typeof schema>, who: Member | null) {
  return who ? t.withIdentity({ subject: `${who.userId}|${who.sessionId}`, issuer: "https://convex.test" }) : t;
}

async function world() {
  vi.stubEnv("SUPER_ADMIN_BOOTSTRAP_EMAIL", OWNER_EMAIL);
  const t = convexTest(schema, modules);
  registerRateLimiter(t);
  const owner = await member(t, OWNER_EMAIL);
  const customer = await member(t, "customer@example.test", "email");
  expect((await t.mutation(internal.admin.superAdmin.bootstrapOwner, {})).outcome).toBe("bound");
  const envelope = await buildFixtureEnvelope(receiptSplitter, {
    submissionId: "functions-sub-1",
    nowMs: START,
    policyVersion: "wp45-policy-test",
    producer: "engine",
    mode: "live",
  });
  const imported = value(
    await t.mutation(internal.editorial.service.importSubmission, {
      envelope: JSON.stringify(envelope),
      producer: "engine",
      authority: "none",
    }),
  );
  return { t, owner, customer, ...imported };
}

async function auditCount(t: TestConvex<typeof schema>) {
  return await t.run(async (ctx) => (await ctx.db.query("editorial_audit").take(500)).length);
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(START);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe("who may use the workspace", () => {
  test("the session check reveals the capability only to its holder", async () => {
    const { t, owner, customer } = await world();
    const nowMs = Date.now();
    expect(await t.query(api.editorial.reads.session, { nowMs })).toEqual({ signedIn: false, editor: null });
    expect(await as(t, customer).query(api.editorial.reads.session, { nowMs })).toEqual({ signedIn: true, editor: null });
    const mine = await as(t, owner).query(api.editorial.reads.session, { nowMs });
    expect(mine.editor).toMatchObject({
      displayName: "Owner Name",
      signInMethod: "email",
      email: OWNER_EMAIL,
      strongAuthFresh: true,
    });
  });

  test("every read refuses anonymous and customer callers without data", async () => {
    const { t, owner, customer, ideaId, revisionId } = await world();
    const nowMs = Date.now();
    const page = { cursor: null, pageSize: 10, nowMs };
    for (const [who, expected] of [
      [null, "UNAUTHENTICATED"],
      [customer, "FORBIDDEN"],
    ] as const) {
      const reader = as(t, who);
      const reads: CommandResult<unknown>[] = [
        await reader.query(api.editorial.reads.queueSummary, { nowMs }),
        await reader.query(api.editorial.reads.listIdeas, { filter: defaultIdeaFilter("library"), ...page }),
        await reader.query(api.editorial.reads.getIdea, { ideaId, nowMs }),
        await reader.query(api.editorial.reads.getRevision, { ideaId, revisionId, nowMs }),
        await reader.query(api.editorial.reads.listReleases, { filter: { group: "all", ideaId: null }, ...page }),
        await reader.query(api.editorial.reads.listTrash, page),
        await reader.query(api.editorial.reads.listActivity, { filter: { ideaId: null, outcome: null }, ...page }),
        await reader.query(api.editorial.reads.settings, { nowMs }),
      ];
      for (const result of reads) {
        expect(code(result)).toBe(expected);
        expect(JSON.stringify(result)).not.toContain(receiptSplitter.title);
      }
    }
    expect(code(await as(t, owner).query(api.editorial.reads.getIdea, { ideaId, nowMs }))).toBe("OK");
  });

  test("commands refuse outsiders; anonymous calls write nothing; customer refusals are recorded up to a limit", async () => {
    const { t, customer, ideaId, revisionId } = await world();
    const attempt = (who: Member | null) =>
      as(t, who).mutation(api.editorial.commands.setCandidateDecision, {
        ideaId,
        expectedVersion: 1,
        input: { decision: "accepted", rationale: "Forged" },
      });
    const before = await auditCount(t);
    for (let index = 0; index < 5; index += 1) expect(code(await attempt(null))).toBe("UNAUTHENTICATED");
    expect(await auditCount(t)).toBe(before);

    const others = [
      () => as(t, customer).mutation(api.editorial.commands.saveDraft, {
        ideaId,
        revisionId,
        baseVersion: 1,
        patch: { title: "Forged" },
        idempotencyKey: "forged-key-0001",
      }),
      () => as(t, customer).mutation(api.editorial.commands.trashIdea, { ideaId, expectedVersion: 1, reason: "Forged" }),
      () => as(t, customer).mutation(api.editorial.commands.prepareRelease, {
        revisionId,
        expectedLiveReleaseId: null,
        idempotencyKey: "forged-key-0002",
      }),
    ];
    for (const other of others) expect(code(await other())).toBe("FORBIDDEN");
    for (let index = 0; index < 25; index += 1) expect(code(await attempt(customer))).toBe("FORBIDDEN");
    const denied = await t.run(async (ctx) =>
      (await ctx.db.query("editorial_audit").withIndex("by_outcome", (q) => q.eq("outcome", "denied")).take(100)).length,
    );
    expect(denied).toBe(20);
    const idea = await t.run(async (ctx) =>
      ctx.db
        .query("editorial_ideas")
        .withIndex("by_key", (q) => q.eq("key", ideaId))
        .unique(),
    );
    expect(idea?.candidate.state).toBe("new");
    expect(idea?.title).toBe(receiptSplitter.title);
  });

  test("a refusal keeps a caller's ids only when they are well-formed", async () => {
    const { t, customer, ideaId } = await world();
    const oversized = "r".repeat(100_000);
    const refused = await as(t, customer).mutation(api.editorial.commands.markReviewed, {
      revisionId: oversized,
      reviewItemId: "section:problem",
      dependencyHash: "0".repeat(64),
      note: null,
    });
    expect(code(refused)).toBe("FORBIDDEN");
    expect(code(await as(t, customer).mutation(api.editorial.commands.trashIdea, { ideaId, expectedVersion: 1, reason: "Forged" }))).toBe(
      "FORBIDDEN",
    );
    const denied = await t.run(async (ctx) =>
      ctx.db
        .query("editorial_audit")
        .withIndex("by_outcome", (q) => q.eq("outcome", "denied"))
        .take(10),
    );
    expect(denied).toHaveLength(2);
    expect(denied[0].revisionId).toBeNull();
    expect(JSON.stringify(denied)).not.toContain("r".repeat(100));
    expect(denied[1].ideaId).toBe(ideaId);
  });

  test("a Google account binds once Google's verified email is recorded, and not before", async () => {
    vi.stubEnv("SUPER_ADMIN_BOOTSTRAP_EMAIL", "google-owner@example.test");
    const t = convexTest(schema, modules);
    registerRateLimiter(t);
    // Signed in before the Google mapping kept the verified-email claim.
    const owner = await member(t, "google-owner@example.test", "google", false);
    expect(await t.mutation(internal.admin.superAdmin.bootstrapOwner, {})).toEqual({
      outcome: "refused",
      reason: "no_verified_account",
    });
    // The next Google sign-in records it; bootstrap then binds that account.
    await t.run(async (ctx) => ctx.db.patch("users", owner.userId, { emailVerificationTime: 2 }));
    expect((await t.mutation(internal.admin.superAdmin.bootstrapOwner, {})).outcome).toBe("bound");
    const mine = await as(t, owner).query(api.editorial.reads.session, { nowMs: Date.now() });
    expect(mine.editor).toMatchObject({ signInMethod: "google" });

    // An email link later signed in to the same account: Google stays the
    // method used to confirm it's you.
    await t.run(async (ctx) =>
      ctx.db.insert("authAccounts", {
        userId: owner.userId,
        provider: "email",
        providerAccountId: "google-owner@example.test",
      }),
    );
    const linked = await as(t, owner).query(api.editorial.reads.session, { nowMs: Date.now() });
    expect(linked.editor).toMatchObject({ signInMethod: "google" });
  });

  test("forged identities are anonymous, and revocation ends access at the next request", async () => {
    const { t, owner, customer, ideaId } = await world();
    const nowMs = Date.now();
    const forged = t.withIdentity({ subject: `${owner.userId}|${customer.sessionId}`, issuer: "https://convex.test" });
    expect(code(await forged.query(api.editorial.reads.getIdea, { ideaId, nowMs }))).toBe("UNAUTHENTICATED");
    await t.mutation(internal.admin.superAdmin.revokeSuperAdmin, { reason: "Rotating the owner account" });
    expect(code(await as(t, owner).query(api.editorial.reads.getIdea, { ideaId, nowMs }))).toBe("FORBIDDEN");
    expect(await as(t, owner).query(api.editorial.reads.session, { nowMs })).toEqual({ signedIn: true, editor: null });
  });

  test("arguments are validated before any work", async () => {
    const { t, owner, ideaId, revisionId } = await world();
    await expect(
      as(t, owner).mutation(api.editorial.commands.saveDraft, {
        ideaId,
        revisionId,
        baseVersion: 1,
        // @ts-expect-error -- unknown patch field
        patch: { title: "x", approvedBy: "owner" },
        idempotencyKey: "invalid-key-0001",
      }),
    ).rejects.toThrow();
    await expect(
      as(t, owner).mutation(api.editorial.commands.approveRevision, {
        revisionId,
        artifactHash: "x",
        // @ts-expect-error -- the attestation must be literally true
        input: { attest: false, note: null },
      }),
    ).rejects.toThrow();
  });
});

describe("strong authentication is a recent sign-in", () => {
  test("a session older than ten minutes must sign in again before trash", async () => {
    const { t, owner, ideaId } = await world();
    vi.setSystemTime(START + 11 * MINUTE);
    const nowMs = Date.now();
    const stale = await as(t, owner).query(api.editorial.reads.session, { nowMs });
    expect(stale.editor?.strongAuthFresh).toBe(false);
    const version = value(await as(t, owner).query(api.editorial.reads.getIdea, { ideaId, nowMs })).idea.version;
    const refused = await as(t, owner).mutation(api.editorial.commands.trashIdea, { ideaId, expectedVersion: version, reason: "Parked" });
    expect(code(refused)).toBe("REAUTH_REQUIRED");

    const fresh = await signInAgain(t, owner);
    expect((await as(t, fresh).query(api.editorial.reads.session, { nowMs })).editor?.strongAuthFresh).toBe(true);
    const trashed = await as(t, fresh).mutation(api.editorial.commands.trashIdea, { ideaId, expectedVersion: version, reason: "Parked" });
    expect(code(trashed)).toBe("OK");
  });
});

describe("the live environment", () => {
  test("the owner can review imported work, while checks and publishing say they are not connected", async () => {
    const { t, owner, ideaId, revisionId } = await world();
    const nowMs = Date.now();
    const editor = as(t, owner);
    const queue = value(await editor.query(api.editorial.reads.listIdeas, { filter: defaultIdeaFilter("queue"), cursor: null, pageSize: 10, nowMs }));
    expect(queue.items.map((item) => item.id)).toEqual([ideaId]);
    expect(value(await editor.mutation(api.editorial.commands.setCandidateDecision, {
      ideaId,
      expectedVersion: 1,
      input: { decision: "accepted", rationale: "Worth editing" },
    })).version).toBe(2);
    const draftId = value(await editor.mutation(api.editorial.commands.createRevision, {
      ideaId,
      fromRevisionId: revisionId,
      idempotencyKey: "fork-key-0001",
    })).revisionId;
    let draft = value(await editor.query(api.editorial.reads.getRevision, { ideaId, revisionId: draftId, nowMs }));
    // Without a trusted receipt, the engine's verification was not trusted.
    expect(draft.sources.every((source) => source.verification.status === "unverified")).toBe(true);
    const saved = value(await editor.mutation(api.editorial.commands.saveDraft, {
      ideaId,
      revisionId: draftId,
      baseVersion: draft.version,
      patch: { title: "Receipt splitter, edited" },
      idempotencyKey: "save-key-0001",
    }));
    expect(saved.version).toBe(draft.version + 1);
    const conflict = await editor.mutation(api.editorial.commands.saveDraft, {
      ideaId,
      revisionId: draftId,
      baseVersion: draft.version,
      patch: { title: "Stale tab" },
      idempotencyKey: "save-key-0002",
    });
    expect(code(conflict)).toBe("VERSION_CONFLICT");
    draft = value(await editor.query(api.editorial.reads.getRevision, { ideaId, revisionId: draftId, nowMs }));
    const item = draft.reviewItems[0];
    expect(code(await editor.mutation(api.editorial.commands.markReviewed, {
      revisionId: draftId,
      reviewItemId: item.id,
      dependencyHash: item.dependencyHash,
      note: null,
    }))).toBe("OK");

    const checks = await editor.mutation(api.editorial.commands.runChecks, { revisionId: draftId, expectedArtifactHash: draft.hashes.artifact });
    expect(code(checks)).toBe("PRECONDITION_FAILED");
    expect(checks.ok ? "" : checks.error.message).toMatch(/authenticated engine audit/);
    const approval = await editor.mutation(api.editorial.commands.approveRevision, {
      revisionId: draftId,
      artifactHash: draft.hashes.artifact,
      input: { attest: true, note: null },
    });
    expect(code(approval)).toBe("APPROVAL_BLOCKED");
    const prepare = await editor.mutation(api.editorial.commands.prepareRelease, {
      revisionId: draftId,
      expectedLiveReleaseId: null,
      idempotencyKey: "prepare-key-0001",
    });
    expect(code(prepare)).toBe("PRECONDITION_FAILED");
    expect(prepare.ok ? "" : prepare.error.message).toMatch(/Publishing remains disabled/);

    const activity = value(await editor.query(api.editorial.reads.listActivity, {
      filter: { ideaId, outcome: null },
      cursor: null,
      pageSize: 3,
      nowMs,
    }));
    expect(activity.total).toBeNull();
    expect(activity.items).toHaveLength(3);
    expect(activity.items[0].ideaTitle).toBe("Receipt splitter, edited");
    const next = value(await editor.query(api.editorial.reads.listActivity, {
      filter: { ideaId, outcome: null },
      cursor: activity.nextCursor,
      pageSize: 50,
      nowMs,
    }));
    const seen = new Set([...activity.items, ...next.items].map((entry) => entry.id));
    expect(seen.size).toBe(activity.items.length + next.items.length);

    const settings = value(await editor.query(api.editorial.reads.settings, { nowMs }));
    expect(settings.mode).toBe("live");
    expect(settings.publishing.readiness).toBe("unavailable");
    expect(settings.capability.verified).toBe(true);
  });

  test("the receiver refuses fixture envelopes and malformed JSON", async () => {
    const { t } = await world();
    const fixture = await buildFixtureEnvelope(receiptSplitter, {
      submissionId: "functions-fixture",
      nowMs: START,
      policyVersion: "wp45-policy-test",
      producer: "engine",
    });
    const refusedMode = await t.mutation(internal.editorial.service.importSubmission, {
      envelope: JSON.stringify(fixture),
      producer: "engine",
      authority: "none",
    });
    expect(code(refusedMode)).toBe("MODE_REJECTED");
    const malformed = await t.mutation(internal.editorial.service.importSubmission, {
      envelope: "{not json",
      producer: "engine",
      authority: "none",
    });
    expect(code(malformed)).toBe("INVALID_SUBMISSION");
  });

  test("operator controls are recorded and the worker seam ignores unknown releases", async () => {
    const { t, owner } = await world();
    const nowMs = Date.now();
    expect(await t.mutation(internal.editorial.service.setKillSwitch, { engaged: true, reason: "Incident drill" })).toEqual({
      engaged: true,
    });
    const settings = value(await as(t, owner).query(api.editorial.reads.settings, { nowMs }));
    expect(settings.publishing.killSwitchEngaged).toBe(true);
    expect(await t.mutation(internal.editorial.service.workerAdvance, {
      releaseId: "rel_unknown",
      report: { kind: "completed" },
    })).toEqual({ moved: false });
  });
});
