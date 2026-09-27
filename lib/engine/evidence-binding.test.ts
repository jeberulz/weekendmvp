import { describe, expect, it } from "vitest";
import { figureSupported, filterFiguresByPage, supportingPassage } from "./evidence.ts";

const figure = "US dentists spent in 2025 $20 billion";
describe("conservative statement binding", () => {
  it.each([
    "It is not true that, US dentists spent $20 billion in 2025.",
    "US dentists say vets spent $20 billion in 2025.",
    "US dentists are expected to have spent $20 billion in 2025.",
    "US dentists spent $2 billion in 2025; US vets spent $20 billion.",
    "US dentists spent $2 billion in 2025. US vets spent $20 billion.",
    "US dentists spent $2 billion in 2025 and US vets spent $20 billion.",
    "US dentists spent $2 billion in 2025, US vets spent $20 billion.",
    "US dentists did not spend $20 billion in 2025.",
    "US dentists may have spent $20 billion in 2025.",
    "It is false that US dentists spent $20 billion in 2025.",
    "US dentists spent $20 billion in 2024 and $2 billion in 2025.",
  ])("does not verify an unsupported association: %s", (page) => {
    expect(figureSupported(figure, page)).toBe(false);
    expect(supportingPassage(figure, page)).toBeNull();
  });
  it.each(["This product is not free.", "This product may be free.", "Free trial for 14 days.", "A carefree product.", "Free for nonprofits."])("rejects unsafe qualitative match: %s", (page) => {
    expect(figureSupported("Free", page)).toBe(false);
  });
  it("accepts a direct assertion and saves the supporting statement", async () => {
    const support = "US dentists spent $20 billion in 2025.";
    const page = "US vets spent $20 billion in 2025. " + "Navigation. ".repeat(100) + support;
    expect(figureSupported(figure, page)).toBe(true);
    expect(supportingPassage(figure, page)).toBe(support);
    const result = await filterFiguresByPage({stats: [{claim: "US dentists spent in 2025", value: "$20 billion", citation: {title: "Report", url: "https://example.com/report"}}], competitors: [], fetchText: async () => page, retrievedAt: "2026-09-27T00:00:00Z"});
    expect(result.claims[0]?.excerpt).toBe(support);
  });
  it("keeps ambiguous paraphrases unresolved", () => {
    expect(figureSupported(figure, "US dental practices invested $20 billion during 2025.")).toBe(false);
  });
});
