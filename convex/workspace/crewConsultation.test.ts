/// <reference types="vite/client" />
import { register as registerRateLimiter } from "@convex-dev/rate-limiter/test";
import shardedCounterTest from "@convex-dev/sharded-counter/test";
import { convexTest } from "convex-test";
import type { FunctionReference } from "convex/server";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "../_generated/api";
import type { ActionCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import schema from "../schema";
import { createAnthropicAdapter } from "../ai/providers/anthropic";
import { runPromptWithMeter, type RunPromptArgs } from "../ai/gatewayActions";
import { crewConsultationIntent } from "../../lib/workspace/crew/consultation";
import { runCrewConsultationWith } from "./crewConsultationActions";
import type { runWrenTurnWith } from "./chatActions";

const modules = import.meta.glob("/convex/**/*.ts");
const duo = "Ask Iris to consult with Elle about whether the welcome email matches the brand voice.";
type Turn = Parameters<typeof runWrenTurnWith>[1];

async function setup() {
  const t = convexTest(schema, modules);
  registerRateLimiter(t);
  shardedCounterTest.register(t);
  const { ownerId, sessionId, projectId, otherProjectId } = await t.run(async (ctx) => {
    const ownerId = await ctx.db.insert("users", { email: "founder@example.test" });
    const otherId = await ctx.db.insert("users", { email: "other@example.test" });
    const sessionId = await ctx.db.insert("authSessions", { userId: ownerId, expirationTime: 9_999_999_999_999 });
    await ctx.db.insert("ops_settings", {
      ownerId, singletonKey: "workspace", workspaceEnabled: true, cohortMode: "open", freeSignupsOpen: false,
      globalDailyBudgetMicroUsd: 50_000_000n, paidGlobalDailyBudgetMicroUsd: 50_000_000n,
      killSwitches: { ai: false, studioVideo: true, publish: true, email: true, social: true, ads: true },
      updatedAt: 1,
    });
    const project = (user: Id<"users">, title: string) => ctx.db.insert("projects", {
      ownerId: user, source: "own_idea", title, status: "draft", idempotencyKey: title, createdAt: 1, updatedAt: 1,
    });
    const projectId = await project(ownerId, "Test travel journal");
    const otherProjectId = await project(otherId, "Other business");
    const hire = (ownerId: Id<"users">, projectId: Id<"projects">, roleKey: string, displayName: string) =>
      ctx.db.insert("crew_members", { ownerId, projectId, roleKey, displayName, status: "queued",
        hiredBy: "rule", autopilot: false, createdAt: 1, updatedAt: 1 });
    await hire(ownerId, projectId, "brand", "Iris");
    await hire(ownerId, projectId, "email", "Elle");
    await hire(otherId, otherProjectId, "seo", "Brian");
    return { ownerId, sessionId, projectId, otherProjectId };
  });
  const owner = t.withIdentity({ subject: `${ownerId}|${sessionId}`, issuer: "https://local.test" });
  async function send(body: string): Promise<Turn> {
    const sent = await owner.mutation(api.workspace.chat.sendWrenMessage, { projectId, body });
    if (sent.kind !== "sent") throw new Error(`expected sent, got ${sent.kind}`);
    return { ownerId, projectId, founderMessageId: sent.founderMessageId,
      wrenMessageId: sent.wrenMessageId, attempt: 1, route: sent.route };
  }
  const read = (turn: Turn) => t.run((ctx) => ctx.db.get("chat_messages", turn.wrenMessageId));
  return { t, owner, send, read, otherProjectId };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-24T12:00:00Z"));
  vi.stubEnv("AI_PROVIDER_MODE", "fixture");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

describe("Crew discussions", () => {
  test("accepts explicit relay and role aliases without treating status or a revision as a consultation", () => {
    expect(crewConsultationIntent("Please pass this message to Iris: what is one blocker? Bring me Iris’s own answer."))
      .toMatchObject({ recipient: "Iris", question: "what is one blocker? Bring me Iris’s own answer." });
    expect(crewConsultationIntent("Ask them about the timeline", "email")).toMatchObject({ recipient: "email" });
    expect(crewConsultationIntent(duo)).toMatchObject({ recipient: "Iris", colleague: "Elle" });
    expect(crewConsultationIntent("What is Iris working on?")).toBeNull();
    expect(crewConsultationIntent("Ask Iris to make the voice warmer")).toBeNull();
    expect(crewConsultationIntent("Can you communicate with the brand? Can you pass a message to?")).toBeNull();
  });

  test("runs through scheduled chat and records both attributed fixture answers without creating work or approval", async () => {
    const { t, owner, send, read } = await setup();
    const turn = await send(duo);
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(await read(turn)).toMatchObject({
      status: "done",
      crewConsultation: {
        state: "answered", recipient: { name: "Iris" }, colleague: { name: "Elle" },
        colleagueAnswer: expect.stringContaining("Test mode"), recipientAnswer: expect.stringContaining("Test mode"),
      },
    });
    const thread = await owner.query(api.workspace.chat.listWrenThread, { projectId: turn.projectId });
    expect(thread.at(-1)?.body).toMatch(/Elle \(email\)[\s\S]*Iris \(brand\)/u);
    const rows = await t.run(async (ctx) => ({
      usage: await ctx.db.query("ai_usage").collect(),
      approvals: await ctx.db.query("approvals").collect(),
      tasks: await ctx.db.query("tasks").collect(),
    }));
    expect(rows.approvals).toHaveLength(0);
    expect(rows.tasks).toHaveLength(0);
    expect(rows.usage.map((entry) => entry.promptRef)).toEqual(["crew-consultation@1", "crew-consultation@1"]);
  });

  test("refuses a name hired in another business and uses one call for an explicit single-role relay", async () => {
    const { t, send, read, otherProjectId } = await setup();
    const unknown = await send("Ask Brian: What do you recommend?");
    await expect(t.mutation(internal.workspace.crewConsultation.start, {
      ownerId: unknown.ownerId, projectId: otherProjectId, wrenMessageId: unknown.wrenMessageId,
      founderMessageId: unknown.founderMessageId, attempt: unknown.attempt,
    })).rejects.toThrow("RESOURCE_NOT_FOUND");
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(await read(unknown)).toMatchObject({ status: "done", body: expect.stringContaining("“Brian”") });
    expect((await read(unknown))?.crewConsultation).toBeUndefined();
    const direct = await send("Ask the brand specialist: What should we review first?");
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(await read(direct)).toMatchObject({ status: "done", crewConsultation: { recipient: { name: "Iris" } } });
    expect((await read(direct))?.crewConsultation?.colleague).toBeUndefined();
    expect(await t.run((ctx) => ctx.db.query("ai_usage").collect())).toHaveLength(1);
  });

  test("passes the saved colleague answer verbatim on retry and fences duplicate and old work", async () => {
    const { t, owner, send, read } = await setup();
    const turn = await send(duo);
    const runMutation = (ref: FunctionReference<"mutation", "internal">, args: Record<string, unknown>) =>
      t.mutation(ref, args);
    const ctx = { runMutation: runMutation as ActionCtx["runMutation"] };
    const calls: RunPromptArgs[] = [];
    const answer = "Elle found two long sentences in the welcome email.";
    const adapter = createAnthropicAdapter({
      env: { AI_PROVIDER_MODE: "fixture" },
      fixtureResponder: () => ({ json: { answer: calls.length === 1 ? answer : "Iris recommends shortening both." } }),
    });
    const gateway = async (prompt: RunPromptArgs) => {
      calls.push(prompt);
      if (calls.length === 2) throw new Error("temporary outage");
      return await runPromptWithMeter(ctx, prompt, { adapter });
    };
    await Promise.all([
      runCrewConsultationWith(ctx, turn, gateway),
      runCrewConsultationWith(ctx, turn, gateway),
    ]);
    expect(calls.map((call) => call.inputs.specialist)).toEqual(["Elle", "Iris"]);
    expect(calls[1].inputs.colleagueAnswer).toBe(answer);
    expect(await read(turn)).toMatchObject({ status: "failed", crewConsultation: { state: "failed", colleagueAnswer: answer } });

    const retry = await owner.mutation(api.workspace.chat.retryWrenReply, {
      projectId: turn.projectId, wrenMessageId: turn.wrenMessageId,
    });
    if (retry.kind !== "retrying") throw new Error(`expected retry, got ${retry.kind}`);
    await expect(t.mutation(internal.workspace.crewConsultation.record, {
      ownerId: turn.ownerId, projectId: turn.projectId, wrenMessageId: turn.wrenMessageId,
      attempt: turn.attempt, outcome: { kind: "recipient", answer: "A stale answer." },
    })).resolves.toBe(false);
    await runCrewConsultationWith(ctx, { ...turn, attempt: retry.attempt }, gateway);
    expect(calls.map((call) => call.inputs.specialist)).toEqual(["Elle", "Iris", "Iris"]);
    expect(calls[2].inputs.colleagueAnswer).toBe(answer);
    expect(await read(turn)).toMatchObject({
      status: "done", crewConsultation: { state: "answered", colleagueAnswer: answer, recipientAnswer: "Iris recommends shortening both." },
    });
  });
});
