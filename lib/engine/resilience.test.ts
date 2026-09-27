import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  BATCH_CAP_MICRO_USD,
  BatchCapExceededError,
  assertBatchWithinCap,
  reservedCostForBudget,
} from "./cost.ts";
import { ProviderCallError } from "./providers/types.ts";
import {
  buildFailureReport,
  capabilityFromHttp,
  isRetryableHttpStatus,
  preflightLiveConfig,
  redactSecrets,
  sourceCapabilities,
  writeFailureReport,
  addBatchSpentMicroUsd,
  readBatchSpentMicroUsd,
} from "./resilience.ts";

describe("HTTP retry classes", () => {
  it.each([
    [401, false],
    [402, false],
    [403, false],
    [400, false],
    [429, true],
    [500, true],
    [503, true],
  ])("HTTP %s retryable=%s", (status, retryable) => {
    expect(isRetryableHttpStatus(status)).toBe(retryable);
  });
});

describe("preflight and capabilities", () => {
  it("lists configured key names and never the secret values", () => {
    const report = preflightLiveConfig({
      OPENAI_API_KEY: "sk-live-secret-value",
      PERPLEXITY_API_KEY: "pplx-live-secret",
      DATAFORSEO_LOGIN: "",
      DATAFORSEO_PASSWORD: "hunter2",
    });
    expect(report.present).toEqual([
      "OPENAI_API_KEY",
      "PERPLEXITY_API_KEY",
      "DATAFORSEO_PASSWORD",
    ]);
    expect(report.missing).toEqual(["DATAFORSEO_LOGIN"]);
    const dumped = JSON.stringify(report);
    expect(dumped).not.toContain("sk-live-secret-value");
    expect(dumped).not.toContain("pplx-live-secret");
    expect(dumped).not.toContain("hunter2");
  });

  it("marks reddit unconfigured without oauth and ready with it", () => {
    expect(sourceCapabilities({}).reddit).toEqual({
      state: "unconfigured",
      reason: "REDDIT_CLIENT_ID / REDDIT_CLIENT_SECRET missing",
    });
    expect(
      sourceCapabilities({
        REDDIT_CLIENT_ID: "id",
        REDDIT_CLIENT_SECRET: "secret",
      }).reddit.state,
    ).toBe("ready");
    expect(sourceCapabilities({}).hackernews.state).toBe("ready");
    expect(sourceCapabilities({}).web.state).toBe("ready");
  });

  it("maps provider HTTP status onto capability states", () => {
    expect(capabilityFromHttp(429)).toEqual({
      state: "rate_limited",
      reason: "HTTP 429",
    });
    expect(capabilityFromHttp(403)).toEqual({
      state: "approval_required",
      reason: "HTTP 403",
    });
    expect(capabilityFromHttp(503)).toEqual({
      state: "unavailable",
      reason: "HTTP 503",
    });
  });
});

describe("failure report", () => {
  it("redacts bearer tokens and key prefixes before persist", () => {
    const report = buildFailureReport({
      slug: "code-reviewer",
      error: new ProviderCallError(
        "synthesis",
        "provider returned 401 Authorization: Bearer sk-abc123 pplx-xyz",
        { retryable: false, status: 401 },
      ),
      spentMicroUsd: 12_000,
      reservedUnknownMicroUsd: 12_000,
      providerCalls: [
        { provider: "openai", operation: "synthesis:gpt-5.6-sol:failed", costUsd: 0.012 },
      ],
    });
    expect(report.message).not.toContain("sk-abc123");
    expect(report.message).not.toContain("pplx-xyz");
    expect(report.message).toContain("Bearer [redacted]");
    expect(report.capabilities.synthesis.state).toBe("unavailable");
    expect(report.spentMicroUsd).toBe(12_000);
    expect(report.reservedUnknownMicroUsd).toBe(12_000);

    const filePath = path.join(os.tmpdir(), `wmvp-s3-${Date.now()}.failure.json`);
    writeFailureReport(filePath, report);
    const saved = JSON.parse(fs.readFileSync(filePath, "utf8")) as typeof report;
    expect(saved.message).toBe(report.message);
    expect(JSON.stringify(saved)).not.toContain("sk-abc123");
    fs.unlinkSync(filePath);
  });

  it("redacts basic auth blobs in free text", () => {
    expect(redactSecrets("Authorization: Basic dXNlcjpwYXNz")).toBe(
      "Authorization: Basic [redacted]",
    );
  });
});

describe("caps and reserved cost", () => {
  it("refuses a batch reservation past $32", () => {
    expect(() =>
      assertBatchWithinCap({
        batchSpentMicroUsd: BATCH_CAP_MICRO_USD,
        nextReservationMicroUsd: 1,
      }),
    ).toThrow(BatchCapExceededError);
    expect(() =>
      assertBatchWithinCap({
        batchSpentMicroUsd: 0,
        nextReservationMicroUsd: BATCH_CAP_MICRO_USD,
      }),
    ).not.toThrow();
  });

  it("persists batch spend and refuses the next $4 reservation at the ceiling", () => {
    const filePath = path.join(os.tmpdir(), `wmvp-batch-${Date.now()}.json`);
    expect(readBatchSpentMicroUsd(filePath)).toBe(0);
    addBatchSpentMicroUsd(filePath, 31_000_000);
    expect(readBatchSpentMicroUsd(filePath)).toBe(31_000_000);
    expect(() =>
      assertBatchWithinCap({
        batchSpentMicroUsd: readBatchSpentMicroUsd(filePath),
        nextReservationMicroUsd: 4_000_000,
      }),
    ).toThrow(BatchCapExceededError);
    addBatchSpentMicroUsd(filePath, 0);
    expect(readBatchSpentMicroUsd(filePath)).toBe(31_000_000);
    fs.unlinkSync(filePath);
  });

  it("holds worst-case dollars when usage never arrives", () => {
    const reserved = reservedCostForBudget(
      {
        role: "synthesis",
        maxInputTokens: 60_000,
        maxOutputTokens: 10_000,
      },
      "openai",
    );
    expect(reserved).toEqual({
      role: "synthesis",
      provider: "openai",
      billedAs: "gpt-5.6-sol",
      usd: 0.6,
      estimated: true,
      units: { reserved: 1 },
    });
  });
});
