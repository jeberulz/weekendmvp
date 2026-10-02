/**
 * Shared page formats (WP46-S4): what the compiler renders, the artifact
 * audit reads back exactly, and the plain-JS copies the auditor script keeps
 * agree with the TypeScript ones.
 */

import path from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";

import { REPO_ROOT } from "./__fixtures__/auditHarness.ts";
import { GENERIC_SETUP_TABLE_NAMES } from "./compile.ts";
import {
  arrEquation,
  HIGHLIGHT_LIMITS,
  linkUrl,
  mdLink,
  parseDisplayedCount,
  parseDisplayedUsd,
  parseYearOneLine,
  SECTION_TITLES,
  splitViaLabel,
  yearOneBaseLine,
  yearOneDownsideLine,
  yearOneFunnelLine,
} from "./page-format.ts";

async function importScript(relative: string): Promise<Record<string, unknown>> {
  const mod: unknown = await import(pathToFileURL(path.join(REPO_ROOT, relative)).href);
  if (typeof mod !== "object" || mod === null) throw new Error(`${relative} did not load`);
  return Object.fromEntries(Object.entries(mod));
}

/** Visible text of a rendered list line: no "- " marker, no bold markers. */
function visibleLine(mdx: string): string {
  return mdx.replace(/^- /, "").replace(/\*\*/g, "");
}

describe("page formats shared by the compiler and the auditor", () => {
  it("keeps the section titles in sync with scripts/lib/idea-sections.mjs", async () => {
    const sections = await importScript("scripts/lib/idea-sections.mjs");
    expect(sections.CANONICAL_SECTION_TITLES).toEqual([...SECTION_TITLES]);
  });

  it("keeps the highlight limits in sync with scripts/validate-idea-tags.mjs", async () => {
    const tags = await importScript("scripts/validate-idea-tags.mjs");
    const theirs = tags.HIGHLIGHT_LIMITS;
    if (typeof theirs !== "object" || theirs === null) throw new Error("HIGHLIGHT_LIMITS export missing");
    const { minCompetitors, ...shared } = HIGHLIGHT_LIMITS;
    expect(theirs).toEqual(shared);
    // validateHighlights wants 3–maxCompetitors competitors when the block has any.
    expect(typeof tags.validateHighlights === "function" ? tags.validateHighlights({
      problemQuote: "A quote.",
      stats: [{ value: "1", label: "x" }],
      competitors: Array.from({ length: minCompetitors - 1 }, (_, i) => ({ name: `C${i}`, price: "$1/month" })),
    }) : null).toContain(`highlights.competitors needs ${minCompetitors}–${HIGHLIGHT_LIMITS.maxCompetitors} entries when present`);
  });

  it("keeps the generic setup tables in sync with scripts/lib/idea-quality.mjs", async () => {
    const quality = await importScript("scripts/lib/idea-quality.mjs");
    const generic = quality.GENERIC_SETUP_TABLES;
    expect(generic instanceof Set ? [...generic].sort() : null).toEqual([...GENERIC_SETUP_TABLE_NAMES].sort());
  });

  it("reads back exactly what it renders for base, downside and funnel lines", () => {
    const equation = { accounts: 1200, perAccountCents: 2499, period: "month" as const, arrCents: 35_985_600 };
    const base = yearOneBaseLine(equation, "Team_Plus", { count: 3, priceText: "$8.33/user/month" });
    expect(base).toBe(
      "- **1,200 × $24.99/mo = $359,856 ARR** — Team\\_Plus accounts paying by month 12 (3 seats × $8.33/user/month)",
    );
    expect(parseYearOneLine(visibleLine(base).replace("\\_", "_"))).toEqual({
      kind: "base",
      ...equation,
      tier: "Team_Plus",
      seats: { count: 3, priceText: "$8.33/user/month" },
    });
    const downside = yearOneDownsideLine({ ...equation, accounts: 600, arrCents: 17_992_800 }, 1200);
    expect(downside).toBe("- **600 × $24.99/mo = $179,928 ARR** — downside if the close rate halves (half of 1,200 accounts)");
    expect(parseYearOneLine(visibleLine(downside))).toEqual({
      kind: "downside",
      ...equation,
      accounts: 600,
      arrCents: 17_992_800,
      halfOf: 1200,
    });
    expect(parseYearOneLine(visibleLine(yearOneFunnelLine(12_000, "Visitors")))).toEqual({
      kind: "funnel",
      count: 12_000,
      stage: "Visitors",
    });
    expect(arrEquation(45, 1_200_00, "year", 54_000_00)).toBe("45 × $1,200/yr = $54,000 ARR");
  });

  it("parses displayed money and counts exactly, refusing malformed grouping or sub-cent digits", () => {
    expect(parseDisplayedUsd("$54,000")).toBe(5_400_000);
    expect(parseDisplayedUsd("$2,998.80")).toBe(299_880);
    expect(parseDisplayedUsd("$54000.00")).toBe(5_400_000);
    for (const bad of ["$5,4000", "$54,000.5", "$54,000.555", "54,000", "$", "$1,00"]) {
      expect(parseDisplayedUsd(bad), bad).toBeNull();
    }
    expect(parseDisplayedCount("1,200")).toBe(1200);
    expect(parseDisplayedCount("12,00")).toBeNull();
  });

  it("does not read lines that only resemble Year-One Math", () => {
    for (const line of [
      "45 × $100/mo = $54,000 ARR — Crew accounts paying by month twelve",
      "45 × $100 = $54,000 ARR — Crew accounts paying by month 12",
      "$26,400 ARR — downside if the close rate halves (22 accounts)",
      "45 × $100/mo = $54,000 MRR — Crew accounts paying by month 12",
    ]) {
      expect(parseYearOneLine(line), line).toBeNull();
    }
  });

  it("encodes only ( ) whitespace < > { } in link URLs and escapes link text once", () => {
    expect(linkUrl("https://x.example/report_(v2)?q={x}&a=1 2")).toBe("https://x.example/report_%28v2%29?q=%7Bx%7D&a=1%202");
    expect(linkUrl("https://news.ycombinator.com/item?id=27515468")).toBe("https://news.ycombinator.com/item?id=27515468");
    expect(mdLink("Report <2026> [draft]", "https://x.example/a")).toBe("[Report \\<2026\\> \\[draft\\]](https://x.example/a)");
  });

  it("splits a trailing (via host) label", () => {
    expect(splitViaLabel("$12/user/month (Pro) (via reviews.example.com)")).toEqual({
      text: "$12/user/month (Pro)",
      via: "reviews.example.com",
    });
    expect(splitViaLabel("$24/user/month, billed annually (Pro)")).toEqual({
      text: "$24/user/month, billed annually (Pro)",
      via: null,
    });
  });
});
