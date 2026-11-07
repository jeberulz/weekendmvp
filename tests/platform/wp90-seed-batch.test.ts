/// <reference types="vite/client" />
/**
 * WP90-S3. The per-idea seed precompute end to end in convex-test: the real
 * C-METER mutations, the real seed mutations, and the batch adapter in
 * fixture mode (or a scripted adapter). No test reaches the network.
 */
import { convexTest, type TestConvex } from "convex-test";
import shardedCounterTest from "@convex-dev/sharded-counter/test";
import type { FunctionReference } from "convex/server";
import { describe, expect, test } from "vitest";

import { internal } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import schema from "@/convex/schema";
import { createAnthropicBatchAdapter, type AnthropicBatchAdapter } from "@/convex/ai/providers/anthropic";
import { ProviderError } from "@/convex/ai/providers/types";
import { SEED_PROMPT_REF, precomputeAttemptKey, seedRequestFor } from "@/convex/crew/seedRequest";
import { pollSeedRun, submitSeedRun, type SeedBatchCtx } from "@/convex/crew/seedsBatch";
import { hydrotrailSeedDraft } from "@/lib/workspace/contracts/fixtures/seeds";
import {
  bakeryManifestRow,
  bakeryPageMdx,
  hydrotrailManifestRow,
  hydrotrailPageMdx,
} from "@/lib/workspace/contracts/fixtures/seedSources";
import { seedFromColumns } from "@/lib/workspace/contracts/seeds";
import { seedSourceFromPage, seedSourceToJson } from "@/lib/workspace/crew/seedSource";

const modules = import.meta.glob("/convex/**/*.ts");
const VERSION = "2026-11-07.1";

const hydrotrail = seedSourceFromPage({ mdx: hydrotrailPageMdx, manifest: hydrotrailManifestRow });
const bakery = seedSourceFromPage({ mdx: bakeryPageMdx, manifest: bakeryManifestRow });
const items = [
  { ideaSlug: hydrotrail.slug, sourceJson: seedSourceToJson(hydrotrail) },
  { ideaSlug: bakery.slug, sourceJson: seedSourceToJson(bakery) },
];

type T = TestConvex<typeof schema>;

async function setup(options: { globalBudgetMicroUsd?: bigint; superAdmins?: number } = {}): Promise<T> {
  const t = convexTest(schema, modules);
  shardedCounterTest.register(t);
  await t.run(async (ctx) => {
    const adminId = await ctx.db.insert("users", { email: "admin@example.test" });
    for (let i = 0; i < (options.superAdmins ?? 1); i += 1) {
      const userId = i === 0 ? adminId : await ctx.db.insert("users", { email: `admin${i}@example.test` });
      await ctx.db.insert("super_admins", { userId, role: "super_admin", boundAt: 1, boundVia: "deployment_bootstrap" });
    }
    await ctx.db.insert("ops_settings", {
      ownerId: adminId,
      singletonKey: "workspace",
      workspaceEnabled: true,
      cohortMode: "open",
      freeSignupsOpen: false,
      globalDailyBudgetMicroUsd: options.globalBudgetMicroUsd ?? 50_000_000n,
      paidGlobalDailyBudgetMicroUsd: 50_000_000n,
      killSwitches: { ai: false, studioVideo: true, publish: true, email: true, social: true, ads: true },
      updatedAt: 1,
    });
  });
  return t;
}

/** An action context over convex-test: real queries and mutations, scheduled calls recorded, not run. */
function actionCtx(t: T) {
  const scheduled: string[] = [];
  const ctx = {
    runQuery: (async (ref: FunctionReference<"query", "internal">, args: Record<string, unknown>) =>
      await t.query(ref, args)) as SeedBatchCtx["runQuery"],
    runMutation: (async (ref: FunctionReference<"mutation", "internal">, args: Record<string, unknown>) =>
      await t.mutation(ref, args)) as SeedBatchCtx["runMutation"],
    scheduler: {
      runAfter: async (_delay: number, _ref: unknown, args: unknown) => {
        scheduled.push(JSON.stringify(args));
        return "scheduled" as never;
      },
    } as unknown as SeedBatchCtx["scheduler"],
  };
  return { ctx, scheduled };
}

const fixtureEnv = { AI_PROVIDER_MODE: "fixture" };

async function preparedRun(t: T, list = items): Promise<Id<"idea_seed_runs">> {
  const runId = await t.mutation(internal.crew.seeds.createRun, { seedVersion: VERSION });
  await t.mutation(internal.crew.seeds.addItems, { runId, items: list });
  return runId;
}

async function usageRows(t: T) {
  return await t.run(async (ctx) => await ctx.db.query("ai_usage").take(50));
}

describe("WP90-S3 seed precompute", () => {
  test("a fixture run writes an audited seed per idea and settles each reservation at the batch rate", async () => {
    const t = await setup();
    const estimate = await t.query(internal.crew.seeds.estimateItems, { seedVersion: VERSION, items });
    expect(estimate.map((row) => row.status)).toEqual(["new", "new"]);
    expect(estimate).toContainEqual(expect.objectContaining({ ideaSlug: bakery.slug, validated: false }));

    const runId = await preparedRun(t);
    const { ctx, scheduled } = actionCtx(t);
    const adapter = createAnthropicBatchAdapter({ env: fixtureEnv });
    const submitted = await submitSeedRun(ctx, { runId }, { adapter });
    expect(submitted).toMatchObject({ status: "submitted", submitted: 2, notReserved: 0 });
    expect(scheduled).toHaveLength(1);

    const polled = await pollSeedRun(ctx, { runId }, { adapter });
    expect(polled).toEqual({ status: "collected", written: 2, auditFailed: 0, failed: 0 });

    const rows = await t.run(async (db) => await db.db.query("idea_crew_seeds").take(10));
    expect(rows).toHaveLength(2);
    for (const row of rows) {
      expect(row.projectId).toBeUndefined();
      expect(row.seedVersion).toBe(VERSION);
      expect(row.promptRefs).toEqual([SEED_PROMPT_REF]);
      const seed = seedFromColumns(row.ideaSlug, row);
      expect(seed).not.toBeNull();
      expect(seed?.validated).toBe(row.ideaSlug === hydrotrail.slug);
      if (row.ideaSlug === bakery.slug) expect(seed?.blueprint.market).toBeUndefined();
    }

    const usage = await usageRows(t);
    expect(usage).toHaveLength(2);
    for (const row of usage) {
      expect(row.status).toBe("settled");
      expect(row.batch).toBe(true);
      expect(row.ownerId).toBeUndefined();
      expect(row.attemptKey.startsWith("precompute:")).toBe(true);
    }
    expect(usage.map((row) => row.attemptKey).sort()).toEqual(
      [precomputeAttemptKey(bakery.slug, VERSION, 1), precomputeAttemptKey(hydrotrail.slug, VERSION, 1)].sort(),
    );

    const summary = await t.query(internal.crew.seeds.runSummary, { runId });
    expect(summary).toMatchObject({ status: "collected", mode: "fixture", counts: { written: 2, sent: 0 } });
  });

  test("an unchanged page is skipped on the next run and nothing is sent", async () => {
    const t = await setup();
    const adapter = createAnthropicBatchAdapter({ env: fixtureEnv });
    const first = await preparedRun(t);
    const { ctx } = actionCtx(t);
    await submitSeedRun(ctx, { runId: first }, { adapter });
    await pollSeedRun(ctx, { runId: first }, { adapter });

    expect((await t.query(internal.crew.seeds.estimateItems, { seedVersion: VERSION, items })).map((r) => r.status)).toEqual([
      "unchanged",
      "unchanged",
    ]);
    const second = await preparedRun(t);
    expect(await submitSeedRun(ctx, { runId: second }, { adapter })).toMatchObject({ status: "nothing_to_send" });
    expect(await usageRows(t)).toHaveLength(2);
  });

  test("a budget refusal stops reserving; the rest wait for a later run", async () => {
    const one = seedRequestFor(hydrotrail).reservedMicroUsd;
    const t = await setup({ globalBudgetMicroUsd: BigInt(one + Math.floor(one / 2)) });
    const runId = await preparedRun(t);
    const { ctx } = actionCtx(t);
    const result = await submitSeedRun(ctx, { runId }, { adapter: createAnthropicBatchAdapter({ env: fixtureEnv }) });
    expect(result).toMatchObject({ status: "submitted", submitted: 1, notReserved: 1 });
    const summary = await t.query(internal.crew.seeds.runSummary, { runId });
    expect(summary.counts.not_reserved).toBe(1);
    expect(summary.failures[0]).toMatchObject({ status: "not_reserved", errorKind: "BUDGET_EXHAUSTED" });
    expect(await usageRows(t)).toHaveLength(1);
  });

  test("a reply that fails the audit is charged but never stored", async () => {
    const t = await setup();
    const runId = await preparedRun(t, [items[0]!]);
    const invented = structuredClone(hydrotrailSeedDraft);
    invented.landingSeeds.buyerWords = [{ quote: "Best hiking app ever.", attribution: "A hiker" }];
    const adapter = createAnthropicBatchAdapter({ env: fixtureEnv, fixtureResponder: () => ({ json: invented }) });
    const { ctx } = actionCtx(t);
    await submitSeedRun(ctx, { runId }, { adapter });
    expect(await pollSeedRun(ctx, { runId }, { adapter })).toMatchObject({ written: 0, auditFailed: 1 });
    expect(await t.run(async (db) => await db.db.query("idea_crew_seeds").take(5))).toHaveLength(0);
    const [usage] = await usageRows(t);
    expect(usage?.status).toBe("settled");
    const summary = await t.query(internal.crew.seeds.runSummary, { runId });
    expect(summary.auditFindings).toEqual([
      { ideaSlug: hydrotrail.slug, code: "quote_not_in_source", path: "landingSeeds.buyerWords.0.quote" },
    ]);
    expect(JSON.stringify(summary)).not.toContain("Best hiking app ever");
  });

  test("errored results fail unbilled; a failed batch create releases every reservation", async () => {
    const t = await setup();
    const runId = await preparedRun(t);
    const { ctx } = actionCtx(t);
    const errored = createAnthropicBatchAdapter({ env: fixtureEnv, fixtureResultType: () => "errored" });
    await submitSeedRun(ctx, { runId }, { adapter: errored });
    expect(await pollSeedRun(ctx, { runId }, { adapter: errored })).toMatchObject({ failed: 2 });
    for (const row of await usageRows(t)) {
      expect(row).toMatchObject({ status: "failed", billed: "none" });
    }

    const t2 = await setup();
    const run2 = await preparedRun(t2);
    const fixture = createAnthropicBatchAdapter({ env: fixtureEnv });
    const failing: AnthropicBatchAdapter = {
      ...fixture,
      submit: async () => {
        throw new ProviderError("anthropic", "bad_request", "Anthropic returned 400", { status: 400 });
      },
    };
    const result = await submitSeedRun(actionCtx(t2).ctx, { runId: run2 }, { adapter: failing });
    expect(result).toMatchObject({ status: "failed", submitted: 0 });
    for (const row of await usageRows(t2)) {
      expect(row).toMatchObject({ status: "failed", billed: "none" });
    }
    expect((await t2.query(internal.crew.seeds.runSummary, { runId: run2 })).status).toBe("failed");
  });

  test("a run needs exactly one active super admin to own the rows", async () => {
    const none = await setup({ superAdmins: 0 });
    await expect(none.mutation(internal.crew.seeds.createRun, { seedVersion: VERSION })).rejects.toThrow(/exactly one/u);
    const two = await setup({ superAdmins: 2 });
    await expect(two.mutation(internal.crew.seeds.createRun, { seedVersion: VERSION })).rejects.toThrow(/exactly one/u);
  });

  test("a stored source is re-checked: a mismatched or oversized source is refused", async () => {
    const t = await setup();
    const runId = await t.mutation(internal.crew.seeds.createRun, { seedVersion: VERSION });
    await expect(
      t.mutation(internal.crew.seeds.addItems, { runId, items: [{ ideaSlug: "other-idea", sourceJson: items[0]!.sourceJson }] }),
    ).rejects.toThrow(/not other-idea/u);
    const huge = { ...hydrotrail, sections: { ...hydrotrail.sections, problem: "x".repeat(7_000) } };
    await expect(
      t.mutation(internal.crew.seeds.addItems, { runId, items: [{ ideaSlug: hydrotrail.slug, sourceJson: JSON.stringify(huge) }] }),
    ).rejects.toThrow(/invalid/u);
  });
});

describe("WP90-S3 batch adapter, live path with a scripted client", () => {
  const liveEnv = { AI_PROVIDER_MODE: "live", ANTHROPIC_API_KEY: "test-key-not-real" };

  test("submits each request with its custom id and the realtime body, and reads every result kind", async () => {
    const request = seedRequestFor(hydrotrail).request;
    const created: unknown[] = [];
    const message = {
      id: "msg_1",
      type: "message",
      role: "assistant",
      model: request.model,
      content: [{ type: "text", text: JSON.stringify(hydrotrailSeedDraft) }],
      stop_reason: "end_turn",
      usage: { input_tokens: 1000, output_tokens: 2000, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 },
    };
    const lines = [
      { custom_id: "a", result: { type: "succeeded", message } },
      { custom_id: "b", result: { type: "errored", error: { type: "error", error: { type: "invalid_request_error", message: "x" } } } },
      { custom_id: "c", result: { type: "expired" } },
      { custom_id: "zzz", result: { type: "canceled" } },
    ];
    const batch = (status: string) => ({ id: "msgbatch_1", processing_status: status, request_counts: { processing: 0, succeeded: 1, errored: 1, canceled: 0, expired: 1 } });
    const adapter = createAnthropicBatchAdapter({
      env: liveEnv,
      clientFactory: () => ({
        messages: {
          batches: {
            create: async (params) => {
              created.push(params);
              return batch("in_progress") as never;
            },
            retrieve: async () => batch("ended") as never,
            results: async () =>
              (async function* () {
                for (const line of lines) yield line as never;
              })(),
          },
        },
      }),
    });
    const submitted = await adapter.submit(
      [
        { customId: "a", request },
        { customId: "b", request },
        { customId: "c", request },
      ],
      { timeoutMs: 5_000 },
    );
    expect(submitted).toMatchObject({ batchId: "msgbatch_1", processingStatus: "in_progress" });
    const sent = created[0] as { requests: { custom_id: string; params: { model: string; output_config: unknown } }[] };
    expect(sent.requests.map((r) => r.custom_id)).toEqual(["a", "b", "c"]);
    expect(sent.requests[0]?.params.model).toBe(request.model);

    expect((await adapter.status("msgbatch_1", { timeoutMs: 5_000 })).processingStatus).toBe("ended");
    const results = await adapter.results("msgbatch_1", new Map([["a", request], ["b", request], ["c", request]]), { timeoutMs: 5_000 });
    expect(results.unknownCustomIds).toEqual(["zzz"]);
    const [a, b, c] = results.outcomes;
    expect(a?.ok).toBe(true);
    if (a?.ok) {
      expect(a.result.cost.billedAs).toContain("(batch)");
      expect(a.result.json).toEqual(hydrotrailSeedDraft);
    }
    expect(b?.ok === false && b.error.billed).toBe("none");
    expect(b?.ok === false && b.error.kind).toBe("bad_request");
    expect(c?.ok === false && c.error.billed).toBe("none");
  });

  test("refuses bad custom ids before anything is sent", async () => {
    let calls = 0;
    const adapter = createAnthropicBatchAdapter({
      env: liveEnv,
      clientFactory: () => {
        calls += 1;
        throw new Error("must not build a client");
      },
    });
    const request = seedRequestFor(hydrotrail).request;
    await expect(adapter.submit([{ customId: "has space", request }], { timeoutMs: 5_000 })).rejects.toThrow(/custom id/u);
    await expect(
      adapter.submit([{ customId: "a", request }, { customId: "a", request }], { timeoutMs: 5_000 }),
    ).rejects.toThrow(/twice/u);
    expect(calls).toBe(0);
  });
});

describe("WP90-S3 seed fixture reply", () => {
  test("passes the audit for every published idea page", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const { createFixtureAnthropicClient } = await import("@/convex/ai/providers/fixtures");
    const { buildMessageParams } = await import("@/convex/ai/providers/anthropic");
    const { auditSeedDraft } = await import("@/lib/workspace/crew/seedAudit");
    const root = process.cwd();
    const manifest = JSON.parse(fs.readFileSync(path.join(root, "ideas/manifest.json"), "utf8")) as
      | Parameters<typeof seedSourceFromPage>[0]["manifest"][]
      | { ideas: Parameters<typeof seedSourceFromPage>[0]["manifest"][] };
    const rows = Array.isArray(manifest) ? manifest : manifest.ideas;
    const client = createFixtureAnthropicClient();
    let checked = 0;
    for (const row of rows) {
      const file = path.join(root, "content/ideas", `${row.slug}.mdx`);
      if (!fs.existsSync(file)) continue;
      const source = seedSourceFromPage({ mdx: fs.readFileSync(file, "utf8"), manifest: row });
      const message = await client.messages.create(buildMessageParams(seedRequestFor(source).request));
      const text = message.content.map((block) => (block.type === "text" ? block.text : "")).join("");
      const audit = auditSeedDraft(JSON.parse(text), source);
      expect(audit.ok, row.slug).toBe(true);
      checked += 1;
    }
    expect(checked).toBeGreaterThan(200);
  });
});
