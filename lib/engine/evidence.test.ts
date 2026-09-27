import { describe, expect, it } from "vitest";

import { evidenceIsStale, FRESHNESS_DAYS } from "./evidence.ts";
import { createProviders } from "./providers.ts";
import { runResearch, type BriefInput } from "./pipeline.ts";
import { RESEARCH_RECORD_V2 } from "./research-record.ts";

const BRIEF: BriefInput = {
  title: "AI RFP Response Assistant",
  audience: "SMB SaaS sales and solutions engineers",
  revenueModel: "Seat-based SaaS with usage caps",
  seedKeywords: [
    "rfp response software",
    "security questionnaire automation",
    "proposal management software",
  ],
  slug: "ai-rfp-response-assistant",
  oneLiner: "Grounded RFP drafts with citations for SMB sales teams.",
};

describe("evidence identity", () => {
  it("records fixture runs as v2 with page-backed claims", async () => {
    const record = await runResearch({
      brief: BRIEF,
      providers: createProviders({ mode: "fixture" }),
      ranAt: "2026-09-27T00:00:00.000Z",
    });
    expect(record.contractVersion).toBe(RESEARCH_RECORD_V2);
    expect(record.run?.mode).toBe("fixture");
    expect(record.sources?.some((source) => source.outcome === "read")).toBe(true);
    expect(record.claims?.some((claim) => claim.verdict === "verified")).toBe(true);
    expect(record.claims?.some((claim) => claim.reason.includes("search text"))).toBe(
      false,
    );
  });

  it("treats a price older than the price window as stale", () => {
    expect(FRESHNESS_DAYS.price).toBe(90);
    expect(
      evidenceIsStale("2026-01-01T00:00:00.000Z", "price", "2026-09-27T00:00:00.000Z"),
    ).toBe(true);
    expect(
      evidenceIsStale("2026-09-01T00:00:00.000Z", "price", "2026-09-27T00:00:00.000Z"),
    ).toBe(false);
  });
});
