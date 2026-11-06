/**
 * Buyer-first optional market stats (evidencePolicy buyer-first-v1).
 *
 * Fixture-only: no provider calls. Covers the contract John approved —
 * zero verified market stats must not block an otherwise qualifying idea;
 * verified stats still publish and face Source Critic; unbound TAM/revenue
 * still fails the deep MDX audit; failed diagnostics stay unpublished.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { auditEngineArtifact } from "./artifact-audit.ts";
import { writeCompiledIdea } from "./compile-write.ts";
import { compileResearchRecord } from "./compile.ts";
import { checkEvidenceMinimums } from "./evidence/accept.ts";
import type { ResearchRecordV2 } from "./evidence/contract.ts";
import { buildFixtureRecord, EV, FIXTURE_PAGE_SLUG } from "./__fixtures__/recordV2.ts";
import { parseResearchRecord } from "./research-record.ts";
import {
  assertSourceReviewPass,
  buildPassingSourceReview,
  requiredClaimReviewIds,
} from "./source-review.ts";

function zeroMarketRecord(): ResearchRecordV2 {
  return buildFixtureRecord((r) => {
    r.market = { summary: "", statIds: [] };
    r.whyNow =
      "Enterprise buyers send security questionnaires earlier in the sales cycle, and legal teams reject answers that cannot be traced to an approved source.";
  });
}

describe("buyer-first: zero market + buyer evidence", () => {
  it("parses and compiles a valid research record without ## Market Research", () => {
    const record = zeroMarketRecord();
    expect(record.market.statIds).toEqual([]);
    const { mdx } = compileResearchRecord({ record, allowFixture: true });
    expect(mdx).not.toContain("## Market Research");
    expect(mdx).toContain("## The Problem");
    expect(mdx).toContain("## Competitive Landscape");
    expect(mdx).toMatch(/Why now:/);
    expect(mdx).not.toMatch(/\bTAM\b|\$\d[\d,.]*\s+billion/i);
  });

  it("still publishes a single verified market stat under ## Market Research", () => {
    const record = buildFixtureRecord((r) => {
      r.market = {
        summary: `One independent report sizes the category at [[ev:${EV.statMeasured.id}]].`,
        statIds: [EV.statMeasured.id],
      };
    });
    expect(record.market.statIds).toEqual([EV.statMeasured.id]);
    const { mdx } = compileResearchRecord({ record, allowFixture: true });
    expect(mdx).toContain("## Market Research");
    expect(mdx).toContain("**Market signals**");
    expect(mdx).toContain("$1.4");
  });
});

describe("buyer-first: Source Critic and failed diagnostics", () => {
  it("sealed Source Critic PASS remains required for live compile-write", () => {
    const record = buildFixtureRecord((r) => {
      r.mode = "live";
      r.market = { summary: "", statIds: [] };
      r.whyNow =
        "Enterprise buyers send security questionnaires earlier in the sales cycle, and legal teams reject answers that cannot be traced to an approved source.";
    });
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "buyer-first-critic-"));
    expect(() =>
      writeCompiledIdea({
        record,
        ideasDir: dir,
        slug: "buyer-first-live-slug",
      }),
    ).toThrow(/Source Critic PASS/);
    const pass = buildPassingSourceReview(record);
    expect(assertSourceReviewPass(record, pass).verdict).toBe("PASS");
    // Unused accepted market_stat rows are not required claim coverage.
    const byId = new Map(record.evidence.accepted.map((item) => [item.id, item]));
    expect(requiredClaimReviewIds(record).filter((id) => byId.get(id)?.kind === "market_stat")).toEqual([]);
  });

  it("refuses a failed report payload as a research record", () => {
    const failedReport = {
      ok: false,
      mode: "live",
      contractVersion: 2,
      pipelineVersion: 2,
      failedStep: "evidence_acceptance",
      error: "community quotes: 0 distinct accepted, need 2",
      costUsd: 0.34,
    };
    expect(() => parseResearchRecord(failedReport)).toThrow();
    expect(failedReport.ok).toBe(false);
  });

  it("still fails closed without quotes or competitors", () => {
    const quotesOnly = zeroMarketRecord().evidence.accepted.filter(
      (item) => item.kind === "community_quote",
    );
    expect(checkEvidenceMinimums(quotesOnly).shortfalls).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/^priced competitors:/),
        expect.stringMatching(/^competitors:/),
      ]),
    );
    const pricesOnly = zeroMarketRecord().evidence.accepted.filter(
      (item) => item.kind === "competitor_price" || item.kind === "competitor_availability",
    );
    expect(checkEvidenceMinimums(pricesOnly).shortfalls.some((s) => s.startsWith("community quotes:"))).toBe(true);
  });
});

describe("buyer-first: MDX deep bar unbound revenue/TAM", () => {
  it("rejects unbound market revenue / TAM figures on an engine page", () => {
    const record = zeroMarketRecord();
    const { mdx } = compileResearchRecord({ record, slug: FIXTURE_PAGE_SLUG, allowFixture: true });
    const poisoned = mdx.replace(
      "## The Problem\n\n",
      "## The Problem\n\nThe TAM is $12 billion and growing at 18% CAGR without a cited market_stat.\n\n",
    );
    const result = auditEngineArtifact(poisoned, record, { slug: FIXTURE_PAGE_SLUG });
    expect(result.errors.join("\n")).toMatch(/unbound figure/i);
    expect(result.errors.join("\n")).toMatch(/\$12 billion|12 billion|18%/i);
  });
});
