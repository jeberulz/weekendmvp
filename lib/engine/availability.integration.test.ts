import { describe, expect, it } from "vitest";

import { buildFixtureRecord } from "./__fixtures__/recordV2.ts";
import { auditPage, compiledPage } from "./__fixtures__/auditHarness.ts";
import { acceptEvidence, sha256Hex } from "./evidence/accept.ts";
import { parseResearchRecord, ResearchRecordParseError } from "./research-record.ts";

function withUnpricedCompetitors() {
  const record = buildFixtureRecord();
  const pages = [
    { vendor: "Loopio", url: "https://loopio.com/pricing", text: "Loopio pricing is available by custom quote." },
    { vendor: "Responsive", url: "https://responsive.io/pricing", text: "Contact sales for Responsive pricing." },
  ];
  const retrievedAt = "2026-10-03T00:00:00.000Z";
  const accepted = acceptEvidence({
    candidates: {
      quotes: [], marketStats: [], competitorPrices: [],
      competitorAvailability: pages.map((p) => ({ vendor: p.vendor, sourceUrl: p.url, supportingText: p.text, availability: "contact_sales" as const })),
    },
    citations: pages.map((p) => ({ url: p.url, title: `${p.vendor} pricing` })),
    sources: new Map(pages.map((p) => [p.url, { status: "read" as const, text: p.text, retrievedAt, roles: ["competitors" as const] }])),
  });
  expect(accepted.rejected).toEqual([]);
  expect(accepted.accepted).toHaveLength(2);
  record.evidence.contractVersion = 2;
  record.evidence.accepted.push(...accepted.accepted);
  record.evidence.sources.push(...pages.map((p) => ({ url: p.url, roles: ["competitors" as const], status: "read" as const, retrievedAt, textSha256: sha256Hex(p.text) })));
  record.competitors[1] = { name: "Loopio", priceIds: [], availabilityId: accepted.accepted[0]!.id };
  record.competitors[2] = { name: "Responsive", priceIds: [], availabilityId: accepted.accepted[1]!.id };
  return record;
}

describe("unpriced competitor contract", () => {
  it("compiles and audits a page with one numeric competitor and two cited contact-sales statements", async () => {
    const record = parseResearchRecord(withUnpricedCompetitors());
    const page = compiledPage(record);
    expect(page).toContain("Contact sales for pricing (Loopio)");
    expect(page).toContain("Contact sales for pricing (Responsive)");
    expect((await auditPage(page, record)).errors).toEqual([]);
  });

  it("rejects a forged availability status and a cross-vendor reference", () => {
    const forged = withUnpricedCompetitors();
    const item = forged.evidence.accepted.find((e) => e.kind === "competitor_availability");
    if (!item || item.kind !== "competitor_availability") throw new Error("missing availability evidence");
    item.availability = "usage_based";
    expect(() => parseResearchRecord(forged)).toThrow(ResearchRecordParseError);

    const swapped = withUnpricedCompetitors();
    swapped.competitors[1]!.availabilityId = swapped.competitors[2]!.availabilityId;
    expect(() => parseResearchRecord(swapped)).toThrow(ResearchRecordParseError);
  });
});
