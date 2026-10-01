/// <reference types="vite/client" />

import { register as registerRateLimiter } from "@convex-dev/rate-limiter/test";
import { convexTest, type TestConvex } from "convex-test";
import { ConvexError } from "convex/values";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { internal } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import schema from "@/convex/schema";

/*
 * The live workspace (WP46-E4d) end to end in-process: the workspace gate,
 * the live repository and the server actions call the real editorial Convex
 * functions in convex-test. `convex/nextjs` is routed to convex-test by the
 * caller's token, and the signed-in session's token comes from a stub; the
 * cookies and the network are not exercised here.
 */

const routing = vi.hoisted(() => ({
  backend: null as null | ((token: string | undefined) => {
    query(ref: unknown, args: unknown): Promise<unknown>;
    mutation(ref: unknown, args: unknown): Promise<unknown>;
  }),
  token: undefined as string | undefined,
  failNext: null as Error | null,
}));

vi.mock("next/server", () => ({ connection: async () => undefined }));
vi.mock("@convex-dev/auth/nextjs/server", () => ({ convexAuthNextjsToken: async () => routing.token }));
vi.mock("convex/nextjs", () => {
  const call = async (kind: "query" | "mutation", ref: unknown, args: unknown, options?: { token?: string }) => {
    if (routing.failNext) {
      const error = routing.failNext;
      routing.failNext = null;
      throw error;
    }
    if (!routing.backend) throw new Error("no test backend");
    return routing.backend(options?.token)[kind](ref, args);
  };
  return {
    fetchQuery: (ref: unknown, args: unknown, options?: { token?: string }) => call("query", ref, args, options),
    fetchMutation: (ref: unknown, args: unknown, options?: { token?: string }) => call("mutation", ref, args, options),
  };
});

import * as demoActions from "@/app/admin/editorial/_actions/demo";
import { getRevisionAction, saveDraftAction } from "@/app/admin/editorial/_actions/draft";
import { decideCandidateAction, markReviewedAction } from "@/app/admin/editorial/_actions/review";
import { trashIdeaAction } from "@/app/admin/editorial/_actions/release";
import { defaultIdeaFilter } from "@/lib/editorial/contracts/commands";
import type { CommandResult } from "@/lib/editorial/contracts/errors";
import { receiptSplitter } from "@/lib/editorial/fixtures/articles/catalog";
import { buildFixtureEnvelope } from "@/lib/editorial/fixtures/envelopes";
import { getEditorialWorkspace } from "@/lib/editorial/runtime/workspace";

const modules = import.meta.glob("/convex/**/*.ts");
const OWNER_EMAIL = "owner@example.test";
const CONVEX_URL = "https://editorial-test.convex.cloud";

type Member = { userId: Id<"users">; sessionId: Id<"authSessions"> };

function code(result: CommandResult<unknown>): string {
  return result.ok ? "OK" : result.error.code;
}

function value<T>(result: CommandResult<T>): T {
  if (!result.ok) throw new Error(`${result.error.code}: ${result.error.message}`);
  return result.value;
}

async function member(t: TestConvex<typeof schema>, email: string): Promise<Member> {
  return await t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", { email, emailVerificationTime: 1, name: "Owner Name" });
    await ctx.db.insert("authAccounts", { userId, provider: "email", providerAccountId: email });
    const sessionId = await ctx.db.insert("authSessions", { userId, expirationTime: Date.now() + 86_400_000 });
    return { userId, sessionId };
  });
}

async function liveWorld() {
  vi.stubEnv("SUPER_ADMIN_BOOTSTRAP_EMAIL", OWNER_EMAIL);
  vi.stubEnv("NEXT_PUBLIC_CONVEX_URL", CONVEX_URL);
  vi.stubEnv("EDITORIAL_FIXTURE_MODE", "");
  const t = convexTest(schema, modules);
  registerRateLimiter(t);
  const owner = await member(t, OWNER_EMAIL);
  const customer = await member(t, "customer@example.test");
  await t.mutation(internal.admin.superAdmin.bootstrapOwner, {});
  const identities = new Map<string, Member>([
    ["owner-token", owner],
    ["customer-token", customer],
  ]);
  routing.backend = (token) => {
    const who = token ? identities.get(token) : undefined;
    return who ? t.withIdentity({ subject: `${who.userId}|${who.sessionId}`, issuer: "https://convex.test" }) : t;
  };
  const envelope = await buildFixtureEnvelope(receiptSplitter, {
    submissionId: "live-workspace-1",
    nowMs: Date.now(),
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
  return { t, ...imported };
}

beforeEach(() => {
  routing.token = undefined;
  routing.backend = null;
  routing.failNext = null;
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("live workspace gate", () => {
  test("unavailable without a configured backend, a session, or the capability", async () => {
    vi.stubEnv("NEXT_PUBLIC_CONVEX_URL", "");
    vi.stubEnv("EDITORIAL_FIXTURE_MODE", "");
    expect(await getEditorialWorkspace()).toEqual({ status: "unavailable", reason: "not_configured" });

    await liveWorld();
    expect(await getEditorialWorkspace()).toEqual({ status: "unavailable", reason: "not_signed_in" });
    routing.token = "customer-token";
    expect(await getEditorialWorkspace()).toEqual({ status: "unavailable", reason: "no_capability" });
    routing.token = "forged-token";
    expect(await getEditorialWorkspace()).toEqual({ status: "unavailable", reason: "not_signed_in" });
  });

  test("fails closed when the backend cannot answer", async () => {
    await liveWorld();
    routing.token = "owner-token";
    routing.failNext = new Error("network down");
    expect(await getEditorialWorkspace()).toEqual({ status: "unavailable", reason: "backend_unavailable" });
  });

  test("the super-admin gets the live workspace, with display counts measured on the Next.js side", async () => {
    const { ideaId, revisionId } = await liveWorld();
    routing.token = "owner-token";
    const workspace = await getEditorialWorkspace();
    expect(workspace.status).toBe("live");
    if (workspace.status !== "live") return;
    expect(workspace.editor).toMatchObject({ displayName: "Owner Name", signInMethod: "email", email: OWNER_EMAIL });
    const queue = value(await workspace.repository.listIdeas(defaultIdeaFilter("queue"), null, 10));
    expect(queue.items.map((item) => item.id)).toEqual([ideaId]);
    const revision = value(await workspace.repository.getRevision(ideaId, revisionId));
    expect(revision.counts.proseWords).toBeGreaterThan(100);
    expect(revision.sections.find((section) => section.key === "problem")?.words).toBeGreaterThan(10);
    const settings = value(await workspace.repository.getSettings());
    expect(settings.mode).toBe("live");
  });

  test("backend failures become truthful command results, never a fake success", async () => {
    const { ideaId } = await liveWorld();
    routing.token = "owner-token";
    const workspace = await getEditorialWorkspace();
    if (workspace.status !== "live") throw new Error("expected the live workspace");
    routing.failNext = new ConvexError({ code: "TOO_LARGE", message: "This revision is too large to store." });
    const tooLarge = await workspace.repository.getIdea(ideaId);
    expect(tooLarge).toEqual({ ok: false, error: { code: "INVALID_INPUT", message: "This revision is too large to store." } });
    routing.failNext = new Error("socket hang up");
    expect(code(await workspace.repository.getIdea(ideaId))).toBe("WORKSPACE_UNAVAILABLE");
  });
});

describe("server actions on the live workspace", () => {
  test("commands run against the private store; refusals come back as results", async () => {
    const { t, ideaId, revisionId } = await liveWorld();
    routing.token = "owner-token";
    expect(code(await decideCandidateAction({ ideaId, revisionId, expectedVersion: 1, input: { decision: "accepted", rationale: "Worth editing" } }))).toBe("OK");
    const stored = await t.run(async (ctx) =>
      ctx.db
        .query("editorial_ideas")
        .withIndex("by_key", (q) => q.eq("key", ideaId))
        .unique(),
    );
    expect(stored?.candidate.state).toBe("accepted");

    const view = value(await getRevisionAction({ ideaId, revisionId }));
    const item = view.reviewItems[0];
    expect(code(await markReviewedAction({ ideaId, revisionId, itemId: item.id, dependencyHash: item.dependencyHash, note: null }))).toBe(
      "OK",
    );
    // The imported snapshot is read-only: saving it is refused, not silently forked.
    const save = await saveDraftAction({
      ideaId,
      revisionId,
      baseVersion: view.version,
      patch: { title: "Edited" },
      idempotencyKey: "live-action-save-1",
    });
    expect(code(save)).toBe("REVISION_READ_ONLY");
    // Trash needs a recent sign-in; this session is fresh, so it goes through.
    const detailVersion = 2;
    expect(code(await trashIdeaAction({ ideaId, expectedVersion: detailVersion, reason: "Parked" }))).toBe("OK");
  });

  test("a signed-in customer and an anonymous caller are refused; demo controls do not exist in live mode", async () => {
    const { ideaId, revisionId } = await liveWorld();
    for (const token of ["customer-token", undefined]) {
      routing.token = token;
      const attempt = await decideCandidateAction({
        ideaId,
        revisionId,
        expectedVersion: 1,
        input: { decision: "accepted", rationale: "Forged" },
      });
      expect(code(attempt)).toBe("WORKSPACE_UNAVAILABLE");
    }
    routing.token = "owner-token";
    for (const action of Object.values(demoActions)) {
      expect(code(await (action as (input: unknown) => Promise<CommandResult<unknown>>)({}))).toBe("WORKSPACE_UNAVAILABLE");
    }
  });
});
