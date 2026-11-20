import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { readCache, writeCache } from "../../lib/pain-engine/cache";
import { createFetcher } from "../../lib/pain-engine/fetch";
import { ideaRequestsToFindings } from "../../lib/pain-engine/listeners";
import {
  decideReview,
  listReviewRecords,
  saveReviewRecord,
} from "../../lib/pain-engine/review";
import { runPainEngine } from "../../lib/pain-engine/run";
import { clusterFindings } from "../../lib/pain-engine/cluster";
import { writeDraft } from "../../lib/pain-engine/writer";
import type { PainFinding, ReviewRecord } from "../../lib/pain-engine/types";

function tmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "pain-engine-"));
}

describe("cache", () => {
  it("returns a fresh entry and expires a stale one", () => {
    const dir = tmpDir();
    writeCache(dir, "abc", "https://example.com", 3600, "hello");
    expect(readCache(dir, "abc")?.body).toBe("hello");
    writeCache(dir, "old", "https://example.com/old", -1, "stale");
    expect(readCache(dir, "old")).toBeNull();
  });

  it("serves a cached response without calling fetch again", async () => {
    const dir = tmpDir();
    let calls = 0;
    const { fetchText } = createFetcher({
      cacheDir: dir,
      fetchImpl: (async () => {
        calls += 1;
        return new Response("cached-body");
      }) as typeof fetch,
    });
    expect(await fetchText("https://example.com/x")).toBe("cached-body");
    expect(await fetchText("https://example.com/x")).toBe("cached-body");
    expect(calls).toBe(1);
  });
});

describe("idea-requests feed (read-only)", () => {
  it("maps voted requests to findings with votes as agreement", () => {
    const findings = ideaRequestsToFindings([
      {
        requestId: "abc",
        title: "Automatic invoicing from emails",
        normalizedTitle: "automatic invoicing from emails",
        problem: "I waste hours copying invoice details from emails.",
        category: "fintech",
        voteCount: 31,
        createdAt: 1794000000000,
      },
    ]);
    expect(findings).toHaveLength(1);
    expect(findings[0].source).toBe("idea-requests");
    expect(findings[0].agreementCount).toBe(31);
    expect(findings[0].url).toBe("https://www.weekendmvp.app/ideas/requests");
  });
});

describe("listener isolation", () => {
  it("one failing listener cannot kill the batch", async () => {
    const root = tmpDir();
    const report = await runPainEngine({
      rootDir: root,
      cacheDir: path.join(root, "cache"),
      topN: 1,
      extraListeners: [
        {
          source: "boom",
          listen: async () => {
            throw new Error("HTTP 403 for https://example.com/boom");
          },
        },
        {
          source: "ok-source",
          listen: async (): Promise<PainFinding[]> => [
            {
              source: "ok-source",
              url: "https://example.com/ok",
              title: "Invoicing by hand takes hours",
              text: "I spend hours doing invoices by hand and I hate it.",
              context: "fixture",
              date: "2026-11-01",
              agreementCount: 5,
              quote: "I spend hours doing invoices by hand.",
            },
          ],
        },
      ],
      fetchImpl: (async () => new Response("{}")) as typeof fetch,
    });
    expect(report.sourceReports.find((r) => r.source === "boom")?.status).toBe("failed");
    expect(report.sourceReports.find((r) => r.source === "boom")?.reason).toContain("403");
    expect(report.drafts.length).toBeGreaterThanOrEqual(0);
    expect(report.costUsd).toBe(0);
  });
});

describe("review queue — single approval", () => {
  function record(): ReviewRecord {
    const clusters = clusterFindings([
      {
        source: "reddit",
        url: "https://example.com/1",
        title: "Invoicing by hand takes hours",
        text: "I spend hours doing invoices by hand and I hate it.",
        context: "r/smallbusiness",
        date: "2026-11-01",
        agreementCount: 10,
        quote: "I spend hours doing invoices by hand.",
      },
    ]);
    const draft = writeDraft(clusters[0]);
    return {
      slug: draft.slug,
      status: "pending",
      createdAt: new Date().toISOString(),
      cluster: clusters[0],
      draft,
      runCostUsd: 0,
    };
  }

  it("saves, lists, approves once, and refuses a second decision", () => {
    const root = tmpDir();
    const rec = record();
    saveReviewRecord(root, rec);
    expect(listReviewRecords(root)).toHaveLength(1);
    const approved = decideReview(root, rec.slug, "approved", "Good evidence, ship it.");
    expect(approved.status).toBe("approved");
    expect(approved.decidedAt).toBeDefined();
    expect(() => decideReview(root, rec.slug, "rejected")).toThrow(/already approved/);
  });

  it("rejects with a reason", () => {
    const root = tmpDir();
    const rec = record();
    saveReviewRecord(root, rec);
    const rejected = decideReview(root, rec.slug, "rejected", "Too thin.");
    expect(rejected.status).toBe("rejected");
    expect(rejected.decisionReason).toBe("Too thin.");
  });
});
