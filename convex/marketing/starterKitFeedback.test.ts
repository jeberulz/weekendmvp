/// <reference types="vite/client" />

import { register as registerRateLimiter } from "@convex-dev/rate-limiter/test";
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { api, internal } from "../_generated/api";
import schema from "../schema";

const modules = import.meta.glob("/convex/**/*.ts");
const SECRET = "a-secure-test-only-feedback-bridge-secret-123456";

function testConvex() {
  const t = convexTest(schema, modules);
  registerRateLimiter(t);
  return t;
}

async function sign(payload: object, secret = SECRET) {
  const serialized = JSON.stringify(payload);
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(serialized),
  );
  const signature = btoa(String.fromCharCode(...new Uint8Array(mac)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  return { payload: serialized, signature };
}

function feedback(overrides: Record<string, unknown> = {}) {
  return {
    respondentKey: "a".repeat(64),
    clientKey: "ip:203.0.113.7",
    progress: "building",
    helpfulness: 4,
    mostUseful: "plan",
    blocker: "time",
    comments: "The hour-by-hour plan got me moving.",
    followUpEmail: null,
    followUpConsent: false,
    ...overrides,
  };
}

describe("Starter Kit feedback", () => {
  beforeEach(() => {
    process.env.STARTER_KIT_FEEDBACK_BRIDGE_SECRET = SECRET;
  });

  afterEach(() => {
    delete process.env.STARTER_KIT_FEEDBACK_BRIDGE_SECRET;
  });

  test("a signed submission creates an anonymous-by-default response", async () => {
    const t = testConvex();
    await expect(
      t.mutation(
        api.marketing.starterKitFeedback.consumeSubmissionQuota,
        await sign(feedback()),
      ),
    ).resolves.toEqual({ ok: true });
    await expect(
      t.mutation(
        api.marketing.starterKitFeedback.submitFromBridge,
        await sign(feedback()),
      ),
    ).resolves.toEqual({ created: true });

    const rows = await t.run(
      async (ctx) => await ctx.db.query("starter_kit_feedback").collect(),
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      respondentKey: "a".repeat(64),
      progress: "building",
      helpfulness: 4,
      followUpConsent: false,
      submissionCount: 1n,
    });
    expect(rows[0]).not.toHaveProperty("clientKey");
    expect(rows[0]).not.toHaveProperty("followUpEmail");
  });

  test("the same browser updates one row as its outcome changes", async () => {
    const t = testConvex();
    await t.mutation(
      api.marketing.starterKitFeedback.submitFromBridge,
      await sign(feedback()),
    );
    await expect(
      t.mutation(
        api.marketing.starterKitFeedback.submitFromBridge,
        await sign(
          feedback({
            progress: "shipped",
            helpfulness: 5,
            blocker: null,
            comments: "Shipped on Sunday.",
          }),
        ),
      ),
    ).resolves.toEqual({ created: false });

    const rows = await t.run(
      async (ctx) => await ctx.db.query("starter_kit_feedback").collect(),
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      progress: "shipped",
      helpfulness: 5,
      comments: "Shipped on Sunday.",
      submissionCount: 2n,
    });
    expect(rows[0]).not.toHaveProperty("blocker");
  });

  test("forged, weak, and absent bridge secrets fail closed", async () => {
    const t = testConvex();
    await expect(
      t.mutation(
        api.marketing.starterKitFeedback.submitFromBridge,
        await sign(feedback(), `${SECRET}-wrong`),
      ),
    ).rejects.toThrow(/INVALID_FEEDBACK_BRIDGE_SIGNATURE/);

    process.env.STARTER_KIT_FEEDBACK_BRIDGE_SECRET = "short";
    await expect(
      t.mutation(
        api.marketing.starterKitFeedback.submitFromBridge,
        await sign(feedback()),
      ),
    ).rejects.toThrow(/FEEDBACK_BRIDGE_NOT_CONFIGURED/);
    delete process.env.STARTER_KIT_FEEDBACK_BRIDGE_SECRET;
    await expect(
      t.mutation(
        api.marketing.starterKitFeedback.submitFromBridge,
        await sign(feedback()),
      ),
    ).rejects.toThrow(/FEEDBACK_BRIDGE_NOT_CONFIGURED/);
  });

  test("validation rejects unknown fields, invalid scores, and unconsented email", async () => {
    const t = testConvex();
    for (const bad of [
      feedback({ rogue: "field" }),
      feedback({ helpfulness: 0 }),
      feedback({ helpfulness: 3.5 }),
      feedback({ progress: "finished" }),
      feedback({ followUpEmail: "founder@example.com", followUpConsent: false }),
      feedback({ followUpEmail: null, followUpConsent: true }),
      feedback({ comments: "x".repeat(1_001) }),
    ]) {
      await expect(
        t.mutation(
          api.marketing.starterKitFeedback.submitFromBridge,
          await sign(bad),
        ),
      ).rejects.toThrow(/INVALID_FEEDBACK_PAYLOAD/);
    }
  });

  test("quota is committed independently and keyed per client", async () => {
    const t = testConvex();
    const noisy = await sign(feedback());
    for (let attempt = 0; attempt < 3; attempt += 1) {
      await t.mutation(
        api.marketing.starterKitFeedback.consumeSubmissionQuota,
        noisy,
      );
    }
    await expect(
      t.mutation(
        api.marketing.starterKitFeedback.consumeSubmissionQuota,
        noisy,
      ),
    ).rejects.toMatchObject({ data: { kind: "RateLimited" } });

    await expect(
      t.mutation(
        api.marketing.starterKitFeedback.consumeSubmissionQuota,
        await sign(feedback({ clientKey: "ip:198.51.100.9" })),
      ),
    ).resolves.toEqual({ ok: true });
  });

  test("the internal report summarizes a bounded sample without respondent keys", async () => {
    const t = testConvex();
    await t.mutation(
      api.marketing.starterKitFeedback.submitFromBridge,
      await sign(feedback()),
    );
    await t.mutation(
      api.marketing.starterKitFeedback.submitFromBridge,
      await sign(
        feedback({
          respondentKey: "b".repeat(64),
          progress: "shipped",
          helpfulness: 5,
          mostUseful: "prompts",
          blocker: null,
          comments: "The prompts saved hours.",
          followUpEmail: "founder@example.com",
          followUpConsent: true,
        }),
      ),
    );

    const summary = await t.query(
      internal.marketing.starterKitFeedback.summarizeRecent,
      { since: 0, limit: 200 },
    );
    expect(summary).toMatchObject({
      sampleSize: 2,
      isTruncated: false,
      averageHelpfulness: 4.5,
      followUpOptIns: 1,
      progress: { building: 1, shipped: 1 },
      mostUseful: { plan: 1, prompts: 1 },
      blockers: { time: 1 },
    });
    expect(
      JSON.stringify(summary, (_key, value) =>
        typeof value === "bigint" ? value.toString() : value,
      ),
    ).not.toContain("a".repeat(64));
    expect(summary.recentResponses).toHaveLength(2);

    await expect(
      t.query(internal.marketing.starterKitFeedback.summarizeRecent, {
        since: Number.NaN,
        limit: 20,
      }),
    ).rejects.toThrow(/INVALID_FEEDBACK_SUMMARY_RANGE/);
  });
});
