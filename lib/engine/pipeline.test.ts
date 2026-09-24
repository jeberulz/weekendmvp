/**
 * Pipeline tests (Mode A2 phase 5). Fixture providers only.
 */

import { describe, expect, it } from "vitest";

import { CostCapExceededError } from "./cost";
import { createProviders } from "./providers";
import { createKeywordDataProvider } from "./providers/keywordData";
import { fixtureKeywordFetch } from "./providers/fixtures";
import {
  PipelineError,
  runResearch,
  type BriefInput,
} from "./pipeline";
import {
  MIN_COMPETITORS,
  MIN_MARKET_STATS,
  parseResearchRecord,
} from "./research-record";

const RFP_BRIEF: BriefInput = {
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

describe("runResearch (fixture)", () => {
  it("happy path produces a parseable ResearchRecord", async () => {
    const providers = createProviders({ mode: "fixture" });
    const record = await runResearch({
      brief: RFP_BRIEF,
      providers,
      ranAt: "2026-09-24T00:00:00.000Z",
    });
    // Round-trip through the fail-closed parser.
    const again = parseResearchRecord(record);
    expect(again.brief.slug).toBe("ai-rfp-response-assistant");
    expect(again.market.stats.length).toBeGreaterThanOrEqual(MIN_MARKET_STATS);
    expect(again.competitors.length).toBeGreaterThanOrEqual(MIN_COMPETITORS);
    expect(again.keywords.every((k) => k.source === "provider")).toBe(true);
    expect(again.provenance.costUsd).toBeGreaterThan(0);
    expect(again.provenance.providerCalls.length).toBeGreaterThan(0);
  });

  it("requires min stats and priced competitors", async () => {
    const providers = createProviders({ mode: "fixture" });
    const record = await runResearch({ brief: RFP_BRIEF, providers });
    expect(record.market.stats.length).toBeGreaterThanOrEqual(MIN_MARKET_STATS);
    for (const c of record.competitors) {
      expect(c.pricing.trim().length).toBeGreaterThan(0);
      expect(c.url).toMatch(/^https?:\/\//);
    }
    expect(record.competitors.length).toBeGreaterThanOrEqual(MIN_COMPETITORS);
  });

  it("keyword failure does not emit guessed CPC", async () => {
    const providers = createProviders({ mode: "fixture" });
    // Replace keyword adapter with one that always fails closed.
    providers.keywordData = createKeywordDataProvider({
      fetchImpl: fixtureKeywordFetch({
        payload: {
          status_code: 20000,
          tasks: [{ status_code: 20000, result: [] }],
        },
      }),
      login: "fixture-mode",
      password: "fixture-mode",
    });

    await expect(
      runResearch({ brief: RFP_BRIEF, providers }),
    ).rejects.toThrow(PipelineError);

    try {
      await runResearch({ brief: RFP_BRIEF, providers });
    } catch (error) {
      expect(error).toBeInstanceOf(PipelineError);
      expect((error as PipelineError).stepId).toBe("keywords_demand");
      // Ensure we never produced a record with invented metrics.
      expect(String(error)).not.toMatch(/guess|invent|estimate/i);
    }
  });

  it("cost cap aborts before another provider call", async () => {
    const providers = createProviders({ mode: "fixture" });
    await expect(
      runResearch({
        brief: RFP_BRIEF,
        providers,
        assertCap: () => {
          throw new CostCapExceededError(3_900_000, 200_000);
        },
      }),
    ).rejects.toThrow(CostCapExceededError);
  });
});
