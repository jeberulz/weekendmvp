import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { clusterFindings } from "../../lib/pain-engine/cluster";
import { listReviewRecords, saveReviewRecord } from "../../lib/pain-engine/review";
import { writeDraft } from "../../lib/pain-engine/writer";
import type { PainFinding } from "../../lib/pain-engine/types";

/**
 * End-to-end in fixture mode, with no network and no spend:
 * fixture findings -> cluster -> score -> draft -> review queue.
 * Mirrors what `npm run pain-engine:fixture` does in the CLI.
 */
describe("fixture end-to-end", () => {
  it("produces pending review drafts from the fixture findings", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "pain-engine-e2e-"));
    const fixture = JSON.parse(
      fs.readFileSync(
        path.join(process.cwd(), "engine", "pain", "fixtures", "findings.json"),
        "utf8",
      ),
    ) as { findings: PainFinding[] };

    const clusters = clusterFindings(fixture.findings);
    expect(clusters.length).toBeGreaterThanOrEqual(2);
    // The invoicing cluster outscores the meeting-notes one. It holds 4 of
    // the 5 invoicing findings: the short App Store review shares too little
    // vocabulary (invoice / email / wish) to join at the 0.3 threshold, so
    // lexical clustering correctly leaves it as its own cluster.
    expect(clusters[0].findings.length).toBe(4);
    expect(clusters[0].sources).toContain("reddit");
    expect(clusters[0].sources).toContain("idea-requests");

    const winners = clusters.slice(0, 2);
    for (const cluster of winners) {
      const draft = writeDraft(cluster);
      expect(draft.costUsd).toBe(0);
      saveReviewRecord(root, {
        slug: draft.slug,
        status: "pending",
        createdAt: new Date().toISOString(),
        cluster,
        draft,
        runCostUsd: 0,
      });
    }

    const records = listReviewRecords(root);
    expect(records).toHaveLength(2);
    expect(records.every((r) => r.status === "pending")).toBe(true);
    expect(records[0].draft.mdx).toContain("## Sources");
    expect(records[0].draft.evidence.length).toBeGreaterThan(0);
  });
});
