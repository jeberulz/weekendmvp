import { describe, expect, test } from "vitest";
import { validateHighlights } from "../../scripts/validate-idea-tags.mjs";
import { applyHighlights, readHighlights } from "../../lib/home/highlights";
import { categoryCounts, isFeatureReady, liveIdeas, newestRows, toolCounts } from "../../lib/home/library";
import type { IdeaExtract, ManifestIdea } from "../../lib/home/types";

const idea = (slug: string, publishedAt: string, extra: Partial<ManifestIdea> = {}): ManifestIdea => ({
  slug,
  title: slug.toUpperCase(),
  category: "saas",
  buildTime: "10",
  revenueGoal: "5k-month",
  tools: ["cursor", "claude"],
  publishedAt,
  provenance: { citations: 8 },
  ...extra,
});

const full: IdeaExtract = {
  problem: "A problem.",
  how: ["a", "b", "c"],
  market: [{ value: "20M", text: "20M people" }],
  competitors: [
    { name: "A", price: "$1" },
    { name: "B", price: "$2" },
    { name: "C", price: "" },
  ],
  tiers: [{ name: "Solo", price: "$19/mo" }],
  stack: ["x", "y", "z"],
  prompts: [
    { title: "1", lines: ["a"] },
    { title: "2", lines: ["b"] },
    { title: "3", lines: ["c"] },
  ],
};

describe("library stats", () => {
  const ideas = [
    idea("a", "2026-01-01"),
    idea("b", "2026-02-01", { category: "fintech", tools: ["cursor", "v0"] }),
    idea("c", "2026-03-01", { _retiredAt: "2026-04-01" }),
    idea("d", "2026-03-01"),
  ];

  test("retired ideas drop out of every count", () => {
    const live = liveIdeas(ideas);
    expect(live.map((i) => i.slug)).toEqual(["a", "b", "d"]);
    expect(categoryCounts(live)).toEqual([
      { slug: "saas", name: "SaaS", count: 2 },
      { slug: "fintech", name: "Fintech", count: 1 },
    ]);
    expect(toolCounts(live)).toEqual({ cursor: 3, claude: 2, v0: 1 });
  });

  test("newest first, numbered by publish order", () => {
    const rows = newestRows(liveIdeas(ideas), (slug) => slug === "d", 2);
    expect(rows.map((r) => [r.slug, r.libraryNo, r.art])).toEqual([
      ["d", 3, "/image/og/idea/d.png"],
      ["b", 2, null],
    ]);
  });

  test("feature-ready needs every tile's data", () => {
    const i = idea("a", "2026-01-01");
    expect(isFeatureReady(i, full, true)).toBe(true);
    expect(isFeatureReady(i, full, false)).toBe(false);
    expect(isFeatureReady(i, { ...full, prompts: full.prompts.slice(0, 2) }, true)).toBe(false);
    expect(isFeatureReady({ ...i, provenance: { citations: 2 } }, full, true)).toBe(false);
  });
});

describe("highlights", () => {
  const good = {
    problemQuote: "They lose money because the work quietly changed.",
    stats: [{ value: "20M", label: "skilled US freelancers", source: "Upwork 2025" }],
    competitors: [
      { name: "Bonsai", price: "$15–$59/mo" },
      { name: "Harvest", price: "from $0" },
      { name: "Dubsado", price: "$335/yr" },
    ],
  };

  test("curated highlights replace parsed values", () => {
    const x = applyHighlights(full, readHighlights(good));
    expect(x.problem).toBe(good.problemQuote);
    expect(x.market).toEqual([{ value: "20M", text: "skilled US freelancers, per Upwork 2025" }]);
    expect(x.competitors[0]).toEqual({ name: "Bonsai", price: "$15–$59/mo" });
    expect(x.how).toBe(full.how);
  });

  test("the reader drops malformed parts instead of failing", () => {
    expect(readHighlights(null)).toBeNull();
    expect(readHighlights({ stats: [{ value: "" }] })).toBeNull();
    expect(readHighlights({ problemQuote: "Q", stats: "nope" })).toEqual({ problemQuote: "Q" });
  });

  test("the publish validator enforces shape and length", () => {
    expect(validateHighlights(undefined)).toEqual([]);
    expect(validateHighlights(good)).toEqual([]);
    expect(validateHighlights({ ...good, problemQuote: "x".repeat(200) })).toEqual([
      "highlights.problemQuote is 200 chars (max 190)",
    ]);
    expect(validateHighlights({ ...good, stats: [] })).toEqual(["highlights.stats needs 1–3 entries"]);
    expect(validateHighlights({ ...good, competitors: good.competitors.slice(0, 2) })).toEqual([
      "highlights.competitors needs 3–5 entries when present",
    ]);
  });
});
