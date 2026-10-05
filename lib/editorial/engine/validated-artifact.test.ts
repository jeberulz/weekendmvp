import { describe, expect, it } from "vitest";

import { buildFixtureRecord } from "../../engine/__fixtures__/recordV2";
import { compileResearchRecord } from "../../engine/compile";
import { usedEvidenceIds } from "../../engine/page-format";
import { validateEngineSubmission } from "./validated-artifact";

/** Synthetic pages exercise the live-shaped contract without provider calls. */
function compiledInput() {
  const record = buildFixtureRecord((draft) => {
    draft.mode = "live";
    draft.brief.slug = "signalpass-idea";
  });
  const compiled = compileResearchRecord({
    record,
    slug: record.brief.slug,
    category: "ai-tools",
    tools: ["cursor", "claude"],
    audiences: ["developers", "weekend-builders"],
    buildTime: "10",
    revenueGoal: "1k-month",
    publishedAt: "2026-10-01",
  });
  return {
    record,
    recordJson: JSON.stringify(record),
    mdx: compiled.mdx,
    manifestJson: JSON.stringify(compiled.manifestEntry),
  };
}

describe("validateEngineSubmission", () => {
  it("maps a deep-audited live record to a bounded editorial envelope with exact evidence anchors", async () => {
    const input = compiledInput();
    const result = await validateEngineSubmission(input);
    expect(result.envelope.mode).toBe("live");
    expect(result.envelope.producer).toBe("engine");
    expect(result.envelope.checks).toEqual([]);
    expect(result.envelope.recommendation).toBe("unknown");
    expect(result.envelope.sources).toHaveLength(usedEvidenceIds(input.record).size);
    expect(result.envelope.claims).toHaveLength(result.envelope.sources.length);
    expect(result.envelope.sources.every((source) => source.verification.status === "verified")).toBe(true);
    expect(result.envelope.claims.every((claim) => input.mdx.includes(claim.anchorText))).toBe(true);
    expect((await validateEngineSubmission(input)).envelope.submissionId).toBe(result.envelope.submissionId);
  });

  it("refuses fixture records even when their MDX passes the deep audit", async () => {
    const input = compiledInput();
    const fixture = { ...input.record, mode: "fixture" as const };
    await expect(validateEngineSubmission({ ...input, recordJson: JSON.stringify(fixture) })).rejects.toThrow(/Fixture research/);
  });

  it("refuses a live record whose selected market figures share one source host", async () => {
    const input = compiledInput();
    input.record.market.statIds = input.record.evidence.accepted
      .filter((item) => item.kind === "market_stat" && item.sourceUrl === "https://research.example.com/ai-code-review-market")
      .map((item) => item.id);
    await expect(validateEngineSubmission({ ...input, recordJson: JSON.stringify(input.record) })).rejects.toThrow(
      /Publication evidence needs review: Selected market figures need at least two distinct source hosts/,
    );
  });

  it("refuses changed market figures and swapped evidence links", async () => {
    const input = compiledInput();
    await expect(validateEngineSubmission({ ...input, mdx: input.mdx.replace("$1.4 billion", "$9.4 billion") })).rejects.toThrow(/Deep artifact audit/);
    await expect(validateEngineSubmission({ ...input, mdx: input.mdx.replace("https://www.coderabbit.ai/pricing", "https://graphite.dev/pricing") })).rejects.toThrow(/Deep artifact audit/);
  });

  it("refuses manifest identity mismatches and untagged metadata", async () => {
    const input = compiledInput();
    const manifest = JSON.parse(input.manifestJson) as Record<string, unknown>;
    await expect(validateEngineSubmission({ ...input, manifestJson: JSON.stringify({ ...manifest, source: "manual" }) })).rejects.toThrow(/Manifest identity/);
    await expect(validateEngineSubmission({ ...input, manifestJson: JSON.stringify({ ...manifest, tools: [] }) })).rejects.toThrow(/metadata is not editorial-ready/);
  });

  it("preserves bounded pricing tiers from a live engine artifact", async () => {
    const input = compiledInput();
    const manifest = JSON.parse(input.manifestJson) as Record<string, unknown>;
    const highlights = manifest.highlights as Record<string, unknown>;
    const result = await validateEngineSubmission(input);
    expect(result.envelope.metadata.highlights?.tiers).toEqual(highlights.tiers);
  });
});
