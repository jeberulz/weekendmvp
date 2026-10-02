// @vitest-environment node
/**
 * Homepage tiles for engine-compiled ideas (WP54 ruling R15; final re-review
 * P2-E / probe p15) and plain text from compiled MDX (re-review N5).
 *
 * An engine row's problem, market, competitor and tier tiles come only from
 * the highlights the compiler generated from accepted evidence. Parsing the
 * page instead dropped billing terms ("$12" for "$12/user/month, billed
 * annually"), lost "(via host)" labels and read a Year-One line as a pricing
 * tier. A tile the highlights do not provide is hidden. Handwritten rows keep
 * the MDX fallback (curated highlights still win), and the parser no longer
 * reads Year-One lines as tiers for anyone.
 */
import { describe, expect, test } from "vitest";

import { buildFixtureRecord, withEditorial } from "../../lib/engine/__fixtures__/recordV2";
import { compileResearchRecord, type ManifestEntry } from "../../lib/engine/compile";
import { escapeMdxText } from "../../lib/engine/evidence/quote";
import { extractIdea } from "../../lib/home/extract";
import { applyHighlights, ideaHomeExtract, readHighlights } from "../../lib/home/highlights";
import { isEngineIdea, isFeatureReady } from "../../lib/home/library";
import { plainText } from "../../lib/home/text";
import type { ManifestIdea } from "../../lib/home/types";

/** A live engine page (two tiers, like the reviewer's p15 page) and its manifest row. */
function compiledEngineIdea(): { body: string; row: ManifestIdea & ManifestEntry } {
  const record = buildFixtureRecord((r) => {
    r.mode = "live";
    withEditorial({
      pricingTiers: [
        { name: "Solo", price: "$12/month", includes: "One private repository for an individual developer." },
        { name: "Crew", price: "$20/developer/month", includes: "Unlimited private repositories and shared team rules." },
      ],
    })(r);
  });
  const { mdx, manifestEntry } = compileResearchRecord({ record, slug: "signalpass", publishedAt: "2026-10-02" });
  return { body: mdx.replace(/^---[\s\S]*?\n---\n/, ""), row: manifestEntry };
}

describe("engine rows use generated highlights only (R15, P2-E)", () => {
  test("the page's parsed prices, tiers and Year-One lines never reach the homepage", () => {
    const { body, row } = compiledEngineIdea();
    expect(isEngineIdea(row)).toBe(true);
    // What the MDX fallback would show: prices without their billing terms and a Year-One line as a tier.
    const parsed = extractIdea(body);
    expect(parsed.competitors.some((c) => c.price === "$12")).toBe(true);

    const highlights = readHighlights(row.highlights);
    expect(highlights).not.toBeNull();
    const shown = ideaHomeExtract(row, body);
    expect(shown.problem).toBe(highlights?.problemQuote);
    expect(shown.market).toEqual(applyHighlights(parsed, highlights).market);
    expect(shown.competitors).toEqual(highlights?.competitors ?? []);
    expect(shown.tiers).toEqual([]);
    const tiles = { problem: shown.problem, market: shown.market, competitors: shown.competitors, tiers: shown.tiers };
    expect(JSON.stringify(tiles)).not.toMatch(/"\$12"|× \$100|ARR/);
    // Structure still comes from the page: step titles, stack, prompts.
    expect(shown.how).toEqual(parsed.how);
    expect(shown.prompts.length).toBeGreaterThanOrEqual(3);
  });

  test("an engine row shows exactly the competitors its highlights carry, and nothing without highlights", () => {
    const { body, row } = compiledEngineIdea();
    const competitors = [
      { name: "Graphite", price: "$40/user/month" },
      { name: "Linear", price: "$8/user/month" },
      { name: "Height", price: "$9/user/month" },
    ];
    const withCompetitors = { ...row, highlights: { ...readHighlights(row.highlights), competitors } };
    expect(ideaHomeExtract(withCompetitors, body).competitors).toEqual(competitors);

    const bare = ideaHomeExtract({ ...row, highlights: undefined }, body);
    expect(bare.problem).toBe("");
    expect(bare.market).toEqual([]);
    expect(bare.competitors).toEqual([]);
    expect(bare.tiers).toEqual([]);
    expect(isFeatureReady(row, bare, true)).toBe(false);
  });

  test("an engine row can be featured without competitor and tier tiles, a handwritten row cannot", () => {
    const { body, row } = compiledEngineIdea();
    const shown = ideaHomeExtract({ ...row, provenance: { ...row.provenance, citations: 9 } }, body);
    const ready = { ...shown, stack: ["a", "b", "c"], how: ["a", "b", "c"] };
    expect(isFeatureReady({ ...row, provenance: { citations: 9 } }, ready, true)).toBe(true);
    const handwritten: ManifestIdea = { slug: "handwritten", title: "Handwritten", source: "mode-b:backfill", provenance: { citations: 9 } };
    expect(isFeatureReady(handwritten, ready, true)).toBe(false);
  });

  test("a handwritten row keeps the MDX fallback, and curated highlights still win", () => {
    const { body } = compiledEngineIdea();
    const handwritten: ManifestIdea = { slug: "handwritten", title: "Handwritten", source: "mode-b:backfill" };
    expect(isEngineIdea(handwritten)).toBe(false);
    expect(ideaHomeExtract(handwritten, body)).toEqual(extractIdea(body));
    const curated = { problemQuote: "A curated quote.", stats: [{ value: "20M", label: "people" }] };
    expect(ideaHomeExtract({ ...handwritten, highlights: curated }, body)).toEqual(applyHighlights(extractIdea(body), readHighlights(curated)));
  });
});

describe("the MDX parser skips Year-One lines when it reads tiers (R15, all pages)", () => {
  test("base and downside lines are not pricing tiers", () => {
    const body = [
      "## Business Model",
      "",
      "- **Solo** ($12/month) — One private repository.",
      "- **Crew** ($20/developer/month) — Shared team rules.",
      "",
      "**Year-One Math**",
      "",
      "- **45 × $100/mo = $54,000 ARR** — Crew accounts paying by month 12 (5 seats × $20/developer/month)",
      "- **22 × $100/mo = $26,400 ARR** — downside if the close rate halves (half of 45 accounts, rounded down)",
      "- **3 × $199** — Sponsors",
      "",
    ].join("\n");
    expect(extractIdea(body).tiers.map((t) => t.name)).toEqual(["Solo", "Crew"]);
    const { body: page } = compiledEngineIdea();
    expect(extractIdea(page).tiers.some((t) => /×|ARR/.test(t.name))).toBe(false);
  });
});

describe("plain text from compiled MDX (N5)", () => {
  test("undoes the compiler's escaping and drops the invisible autolink break", () => {
    for (const text of [
      "Ping founders@example.invalid or see https://example.invalid/x and www.example.invalid for the *real* story.",
      "Teams paste <details> blocks, {curly} templates, #tags, [drafts] and snake_case names; C# code & more.",
      "1. not a list: just a sentence",
      "import this is prose",
    ]) {
      const escaped = escapeMdxText(text);
      expect(escaped).not.toBe(text);
      expect(plainText(escaped), text).toBe(text);
    }
    expect(plainText("**Bold** and *emphasis* with [a link](https://x.example/a)")).toBe("Bold and emphasis with a link");
    expect(plainText("see https⁠://example.invalid")).toBe("see https://example.invalid");
  });

  test("homepage and prompt-pack text from a compiled page carries no escape or autolink break", () => {
    const record = buildFixtureRecord((r) => {
      if (r.editorial) {
        r.editorial.problemNarrative = `Ping founders@example.invalid or see https://example.invalid/x for the *real* story. ${r.editorial.problemNarrative}`;
      }
    });
    const body = compileResearchRecord({ record, slug: "engine-draft-signalpass" }).mdx.replace(/^---[\s\S]*?\n---\n/, "");
    const parsed = extractIdea(body);
    expect(parsed.problem.startsWith("Ping founders@example.invalid or see https://example.invalid/x for the *real* story.")).toBe(true);
    for (const text of [parsed.problem, ...parsed.how, ...parsed.stack, ...parsed.market.map((m) => m.text)]) {
      expect(text).not.toMatch(/&#x2060;|⁠|\\[\\`*_{}[\]<>#+\-.!|&@:]/);
    }
  });
});
