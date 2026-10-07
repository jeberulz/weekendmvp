import { describe, expect, test } from "vitest";
import { validateHighlights } from "../../scripts/validate-idea-tags.mjs";
import { applyHighlights, readHighlights } from "../../lib/home/highlights";
import { HERO_MIN_LINES, categoryCounts, hasOgArt, isFeatureReady, isHeroReady, liveIdeas, newestRows, toolCounts } from "../../lib/home/library";
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

  test("engine drafts never reach a list, pick or count, even from the manifest", () => {
    const withDraft = [...ideas, idea("engine-draft-ai-code-reviewer", "2026-09-24", { tools: ["replit"] })];
    const live = liveIdeas(withDraft);
    expect(live.map((i) => i.slug)).toEqual(["a", "b", "d"]);
    expect(toolCounts(live)).not.toHaveProperty("replit");
    expect(newestRows(live, () => true, 8).map((r) => r.slug)).toEqual(["d", "b", "a"]);
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

describe("hero-ready", () => {
  const lines = (n: number) => Array.from({ length: n }, (_, i) => `line ${i + 1}`);
  const prompts = (n: number, titles = ["Project Setup", "Core Feature", "Landing Page"]) =>
    titles.map((title, i) => ({ title, lines: lines(i === 0 ? n : 4) }));
  const ready: IdeaExtract = { ...full, prompts: prompts(HERO_MIN_LINES) };
  const i = idea("a", "2026-01-01");

  test("needs a first prompt long enough to paste in line by line", () => {
    expect(isHeroReady(i, ready)).toBe(true);
    expect(isHeroReady(i, { ...ready, prompts: prompts(HERO_MIN_LINES - 1) })).toBe(false);
    expect(isHeroReady(i, { ...ready, prompts: prompts(1) })).toBe(false);
  });

  test("needs three prompts with real titles", () => {
    expect(isHeroReady(i, { ...ready, prompts: ready.prompts.slice(0, 2) })).toBe(false);
    expect(isHeroReady(i, { ...ready, prompts: prompts(HERO_MIN_LINES, ["Prompt 1", "Prompt 2", "Prompt 3"]) })).toBe(false);
    expect(isHeroReady(i, { ...ready, prompts: prompts(HERO_MIN_LINES, ["Project Setup", "Prompt 2", "Landing Page"]) })).toBe(false);
  });

  test("needs the citations behind the Researched stamp and a build time", () => {
    expect(isHeroReady({ ...i, provenance: { citations: 2 } }, ready)).toBe(false);
    expect(isHeroReady({ ...i, provenance: undefined }, ready)).toBe(false);
    expect(isHeroReady({ ...i, buildTime: "0" }, ready)).toBe(false);
  });

  test("ignores art, market, pricing and stack: the window shows none of them", () => {
    // The WP58 regression: a failed OG card kept the pinned hero out of the window.
    const failedArt = idea("b", "2026-01-01", { og: { status: "failed" } });
    const thin: IdeaExtract = { ...ready, problem: "", how: [], market: [], competitors: [], tiers: [], stack: [] };
    expect(hasOgArt(failedArt)).toBe(false);
    expect(isFeatureReady(failedArt, ready, hasOgArt(failedArt))).toBe(false);
    expect(isHeroReady(failedArt, thin)).toBe(true);
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
