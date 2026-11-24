/// <reference types="vite/client" />
/**
 * WP100-S3. The Step 1 improve action in convex-test, fixture mode only.
 *
 * `improveWith` runs as the signed-in founder with the gateway call bound to
 * the REAL gateway body (`runPromptWithMeter`), the real C-METER mutations and
 * a scripted fixture Claude adapter, so the meter keys, the `ai_usage` rows
 * and the charge are the production paths. No network, no model, no spend.
 */
import { convexTest, type TestConvex } from "convex-test";
import { register as registerRateLimiter } from "@convex-dev/rate-limiter/test";
import shardedCounterTest from "@convex-dev/sharded-counter/test";
import { describe, expect, test } from "vitest";

import { api } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import type { ActionCtx } from "../_generated/server";
import schema from "../schema";
import { runPromptWithMeter, type GatewayRunResult, type RunPromptArgs } from "../ai/gatewayActions";
import { createAnthropicAdapter } from "../ai/providers/anthropic";
import type { AnthropicFixtureReply, AnthropicFixtureResponder } from "../ai/providers/fixtures";
import { ideaImproveFixtureReply } from "../ai/providers/ideaImproveFixtureReply";
import { IDEA_IMPROVE_DAILY_CAP } from "../../lib/workspace/wizard/idea-improve";
import { improveWith } from "./ideaImprove";

type AnthropicFixtureResponderParams = Parameters<AnthropicFixtureResponder>[0];

const modules = import.meta.glob("/convex/**/*.ts");
type T = TestConvex<typeof schema>;
type Founder = ReturnType<T["withIdentity"]>;

const ROUGH = "basically an app for people who go camping on weekends so they dont forget stuff";
const SHARP = "An app for people who go camping on weekends so they don't forget.";

async function seed(options: { workspaceEnabled?: boolean; aiKillSwitch?: boolean } = {}) {
  const t = convexTest(schema, modules);
  registerRateLimiter(t);
  shardedCounterTest.register(t);
  const ids = await t.run(async (ctx) => {
    const adminId = await ctx.db.insert("users", { email: "admin@example.test" });
    const ownerId = await ctx.db.insert("users", { email: "owner@example.test" });
    const otherId = await ctx.db.insert("users", { email: "other@example.test" });
    const ownerSessionId = await ctx.db.insert("authSessions", { userId: ownerId, expirationTime: 9_999_999_999_999 });
    const otherSessionId = await ctx.db.insert("authSessions", { userId: otherId, expirationTime: 9_999_999_999_999 });
    await ctx.db.insert("ops_settings", {
      ownerId: adminId,
      singletonKey: "workspace",
      workspaceEnabled: options.workspaceEnabled ?? true,
      cohortMode: "open",
      freeSignupsOpen: false,
      globalDailyBudgetMicroUsd: 50_000_000n,
      paidGlobalDailyBudgetMicroUsd: 50_000_000n,
      killSwitches: {
        ai: options.aiKillSwitch ?? false, studioVideo: true, publish: true, email: true, social: true, ads: true,
      },
      updatedAt: 1,
    });
    return { ownerId, otherId, ownerSessionId, otherSessionId };
  });
  const owner = t.withIdentity({ subject: `${ids.ownerId}|${ids.ownerSessionId}`, issuer: "https://local.test" });
  const other = t.withIdentity({ subject: `${ids.otherId}|${ids.otherSessionId}`, issuer: "https://local.test" });
  return { t, owner, other, ids };
}

/** An action-context stand-in that runs mutations as `founder` (actions pass their caller's auth on). */
function actionCtx(founder: Founder): Pick<ActionCtx, "runMutation"> {
  const runMutation = async (ref: Parameters<Founder["mutation"]>[0], args: Record<string, unknown>) =>
    (await founder.mutation(ref, args)) as unknown;
  return { runMutation: runMutation as ActionCtx["runMutation"] };
}

/** The real Claude adapter in fixture mode; `reply` overrides the registered fixture. */
function adapterWith(reply?: (params: AnthropicFixtureResponderParams) => AnthropicFixtureReply) {
  const requests: AnthropicFixtureResponderParams[] = [];
  const adapter = createAnthropicAdapter({
    env: {},
    fixtureResponder: (params) => {
      requests.push(params);
      return reply === undefined ? { json: ideaImproveFixtureReply(params) } : reply(params);
    },
  });
  return { adapter, requests };
}

/** Runs one improve through the real gateway body and meter. */
async function improve(
  founder: Founder,
  args: Parameters<typeof improveWith>[1],
  reply?: (params: AnthropicFixtureResponderParams) => AnthropicFixtureReply,
) {
  const prompts: RunPromptArgs[] = [];
  const { adapter, requests } = adapterWith(reply);
  const ctx = actionCtx(founder);
  const result = await improveWith(ctx, args, async (prompt) => {
    prompts.push(prompt);
    return await runPromptWithMeter(ctx, prompt, { adapter });
  });
  return { result, prompts, requests };
}

async function rowOf(t: T, id: Id<"wizard_idea_improvements">) {
  return await t.run(async (ctx) => await ctx.db.get("wizard_idea_improvements", id));
}

describe("improve", () => {
  test("a rough idea comes back sharper, metered on the fast tier under the idea_improve key", async () => {
    const { t, owner, ids } = await seed();
    const { result, prompts, requests } = await improve(owner, { text: ROUGH });

    expect(result).toMatchObject({ status: "suggested", mode: "whole", text: SHARP });
    if (result.status !== "suggested") throw new Error("expected a suggestion");
    expect(result.changeNote.length).toBeGreaterThan(0);

    expect(prompts).toHaveLength(1);
    expect(prompts[0]).toMatchObject({
      promptRef: "wizard-idea-improve@1",
      ownerId: ids.ownerId,
      attemptKey: { kind: "idea_improve", improvementId: result.improvementId },
    });
    expect(prompts[0]?.projectId).toBeUndefined();
    expect(requests).toHaveLength(1);
    expect(requests[0]?.model).toMatch(/haiku/u);

    const row = await rowOf(t, result.improvementId);
    expect(row).toMatchObject({
      ownerId: ids.ownerId,
      mode: "whole",
      inputText: ROUGH,
      originalText: ROUGH,
      status: "suggested",
      suggestion: SHARP,
      hints: { audience: "people", coreAction: null, offer: null },
    });
    expect(row?.usageIds).toHaveLength(1);

    const usage = await t.run(async (ctx) => await ctx.db.query("ai_usage").collect());
    expect(usage).toHaveLength(1);
    expect(usage[0]).toMatchObject({ ownerId: ids.ownerId, attemptKey: `idea-improve:${result.improvementId}:1` });
    expect(row?.chargedMicroUsd).toBe(Number(usage[0]?.costMicroUsd ?? -1n));
    expect(row?.chargedMicroUsd).toBeGreaterThan(0);
  });

  test("selection mode sends the selected words and returns the whole spliced sentence", async () => {
    const { owner } = await seed();
    const { result, requests } = await improve(owner, { text: ROUGH, selection: { start: 0, end: "basically an app".length } });
    expect(result).toMatchObject({ status: "suggested", mode: "selection" });
    if (result.status === "suggested") expect(result.text).toBe(`an app for people who go camping on weekends so they dont forget stuff`);
    const user = JSON.stringify(requests[0]?.messages);
    expect(user).toContain("Mode: selection");
    expect(user).toContain("<selected>");
  });

  test("a clear sentence is already_clear and nothing is suggested", async () => {
    const { t, owner } = await seed();
    const { result } = await improve(owner, { text: "A packing checklist for weekend campers." });
    expect(result.status).toBe("already_clear");
    if (result.status === "already_clear") expect((await rowOf(t, result.improvementId))?.suggestion).toBeUndefined();
  });

  test("too short or invalid input never reaches the model or the meter", async () => {
    const { t, owner } = await seed();
    expect((await improve(owner, { text: "camping app" })).result).toEqual({ status: "too_short" });
    expect((await improve(owner, { text: ROUGH, selection: { start: 4, end: 2 } })).result).toEqual({ status: "invalid" });
    const rows = await t.run(async (ctx) => ({
      improvements: await ctx.db.query("wizard_idea_improvements").collect(),
      usage: await ctx.db.query("ai_usage").collect(),
    }));
    expect(rows).toEqual({ improvements: [], usage: [] });
  });

  test("a reply that invents a fact is rejected, stored with its reason, never returned", async () => {
    const { t, owner } = await seed();
    const { result } = await improve(owner, { text: ROUGH }, () => ({
      json: {
        status: "improved",
        text: "The #1 packing app for 2 million weekend campers.",
        changeNote: "Made it bolder.",
        hints: { audience: null, coreAction: null, offer: null },
      },
    }));
    expect(result.status).toBe("rejected");
    expect(result).not.toHaveProperty("text");
    if (result.status === "rejected") {
      expect(await rowOf(t, result.improvementId)).toMatchObject({ status: "rejected", reason: "new_market_claim" });
    }
  });

  test("junk output fails calmly after the gateway's one re-ask", async () => {
    const { t, owner } = await seed();
    const { result, requests } = await improve(owner, { text: ROUGH }, () => ({ text: "Sure! Here is a better idea" }));
    expect(result.status).toBe("failed");
    expect(requests).toHaveLength(2);
    if (result.status === "failed") {
      const row = await rowOf(t, result.improvementId);
      expect(row).toMatchObject({ status: "failed", reason: "schema_invalid" });
      expect(row?.usageIds).toHaveLength(2);
    }
  });

  test("a gateway that throws ends failed, not as an error to the client", async () => {
    const { t, owner } = await seed();
    const ctx = actionCtx(owner);
    const result = await improveWith(ctx, { text: ROUGH }, async () => {
      throw new Error("network down");
    });
    expect(result.status).toBe("failed");
    if (result.status === "failed") expect(await rowOf(t, result.improvementId)).toMatchObject({ reason: "gateway_threw" });
  });

  test("a meter refusal is unavailable", async () => {
    const { owner } = await seed();
    const refused: GatewayRunResult = {
      ok: false,
      promptRef: "wizard-idea-improve@1",
      failure: { kind: "meter_refused", error: { code: "BUDGET_EXHAUSTED" } },
      attempts: [],
      nextAttempt: 1,
    };
    const result = await improveWith(actionCtx(owner), { text: ROUGH }, async () => refused);
    expect(result).toEqual({ status: "unavailable" });
  });

  test("AI switched off or workspace closed is unavailable and writes nothing", async () => {
    for (const options of [{ aiKillSwitch: true }, { workspaceEnabled: false }]) {
      const { t, owner } = await seed(options);
      const { result, prompts } = await improve(owner, { text: ROUGH });
      expect(result).toEqual({ status: "unavailable" });
      expect(prompts).toHaveLength(0);
      expect(await t.run(async (ctx) => await ctx.db.query("wizard_idea_improvements").collect())).toEqual([]);
    }
  });

  test("signed out is unavailable", async () => {
    const { t } = await seed();
    const anonymous = t as unknown as Founder;
    expect((await improve(anonymous, { text: ROUGH })).result).toEqual({ status: "unavailable" });
  });

  test(`the daily cap is ${IDEA_IMPROVE_DAILY_CAP} per founder`, async () => {
    const { owner, other } = await seed();
    const cheap = async () => ({ ok: false, promptRef: "wizard-idea-improve@1", failure: { kind: "config", message: "x" }, attempts: [], nextAttempt: 1 }) as GatewayRunResult;
    for (let i = 0; i < IDEA_IMPROVE_DAILY_CAP; i += 1) {
      expect((await improveWith(actionCtx(owner), { text: ROUGH }, cheap)).status).toBe("failed");
    }
    expect(await improveWith(actionCtx(owner), { text: ROUGH }, cheap)).toEqual({ status: "rate_limited" });
    // Another founder has their own allowance.
    expect((await improveWith(actionCtx(other), { text: ROUGH }, cheap)).status).toBe("failed");
  });

  test("a follow-up round keeps the founder's original words; another founder's parent is ignored", async () => {
    const { t, owner, other } = await seed();
    const first = (await improve(owner, { text: ROUGH })).result;
    if (first.status !== "suggested") throw new Error("expected a suggestion");
    const second = (await improve(owner, { text: SHARP, parentId: first.improvementId })).result;
    if (!("improvementId" in second)) throw new Error(`unexpected ${second.status}`);
    expect(await rowOf(t, second.improvementId)).toMatchObject({ parentId: first.improvementId, originalText: ROUGH });

    const stolen = (await improve(other, { text: "a list app for my running club", parentId: first.improvementId })).result;
    if ("improvementId" in stolen) {
      const row = await rowOf(t, stolen.improvementId);
      expect(row?.parentId).toBeUndefined();
      expect(row?.originalText).toBe("a list app for my running club");
    }
  });
});

describe("decide", () => {
  test("records the founder's choice on their own suggestion only", async () => {
    const { t, owner, other } = await seed();
    const { result } = await improve(owner, { text: ROUGH });
    if (result.status !== "suggested") throw new Error("expected a suggestion");
    await owner.mutation(api.workspace.ideaImprove.decide, { improvementId: result.improvementId, outcome: "accepted" });
    expect(await rowOf(t, result.improvementId)).toMatchObject({ outcome: "accepted" });
    await owner.mutation(api.workspace.ideaImprove.decide, { improvementId: result.improvementId, outcome: "undone" });
    expect(await rowOf(t, result.improvementId)).toMatchObject({ outcome: "undone" });
    await expect(
      other.mutation(api.workspace.ideaImprove.decide, { improvementId: result.improvementId, outcome: "accepted" }),
    ).rejects.toThrow();
    expect(await rowOf(t, result.improvementId)).toMatchObject({ outcome: "undone" });
  });
});

describe("availability", () => {
  test("follows the workspace and AI switches", async () => {
    expect(await (await seed()).owner.query(api.workspace.ideaImprove.availability, {})).toEqual({ enabled: true });
    expect(await (await seed({ aiKillSwitch: true })).owner.query(api.workspace.ideaImprove.availability, {})).toEqual({ enabled: false });
    const signedOut = await seed();
    expect(await signedOut.t.query(api.workspace.ideaImprove.availability, {})).toEqual({ enabled: false });
  });
});
