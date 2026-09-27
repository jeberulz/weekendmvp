// @vitest-environment node

import { describe, expect, test } from "vitest";

import { SECTION_DEFINITIONS } from "@/lib/editorial/contracts/sections";
import {
  AUDIENCE_SLUGS,
  BUILD_TIME_VALUES,
  CATEGORY_SLUGS,
  HIGHLIGHT_LIMITS,
  MIN_AUDIENCES,
  MIN_TOOLS,
  REVENUE_GOAL_SLUGS,
  TOOL_SLUGS,
} from "@/lib/editorial/contracts/taxonomy";

/**
 * The editorial contract copies the publishing gate's allowlists so it can
 * run in the browser. These tests fail the moment the copies drift from
 * `scripts/validate-idea-tags.mjs`, `scripts/lib/idea-sections.mjs` or the
 * manifest's category list.
 */
describe("editorial taxonomy matches the publishing gate", () => {
  test("allowlists equal validate-idea-tags", async () => {
    const gate = await import("../../../scripts/validate-idea-tags.mjs");
    expect([...CATEGORY_SLUGS].sort()).toEqual([...gate.ALLOWED_CATEGORIES].sort());
    expect([...TOOL_SLUGS].sort()).toEqual([...gate.ALLOWED_TOOLS].sort());
    expect([...AUDIENCE_SLUGS].sort()).toEqual([...gate.ALLOWED_AUDIENCES].sort());
    expect([...REVENUE_GOAL_SLUGS].sort()).toEqual([...gate.ALLOWED_REVENUE].sort());
    expect([...BUILD_TIME_VALUES].sort()).toEqual([...gate.ALLOWED_BUILDTIMES].sort());
    expect(HIGHLIGHT_LIMITS.problemQuote).toBe(gate.HIGHLIGHT_LIMITS.problemQuote);
    expect(HIGHLIGHT_LIMITS.statValue).toBe(gate.HIGHLIGHT_LIMITS.statValue);
    expect(HIGHLIGHT_LIMITS.statLabel).toBe(gate.HIGHLIGHT_LIMITS.statLabel);
    expect(HIGHLIGHT_LIMITS.statSource).toBe(gate.HIGHLIGHT_LIMITS.statSource);
    expect(HIGHLIGHT_LIMITS.maxStats).toBe(gate.HIGHLIGHT_LIMITS.maxStats);
    expect(HIGHLIGHT_LIMITS.competitorName).toBe(gate.HIGHLIGHT_LIMITS.competitorName);
    expect(HIGHLIGHT_LIMITS.competitorPrice).toBe(gate.HIGHLIGHT_LIMITS.competitorPrice);
    expect(HIGHLIGHT_LIMITS.maxCompetitors).toBe(gate.HIGHLIGHT_LIMITS.maxCompetitors);
  });

  test("minimum tool and audience counts match the gate", async () => {
    const source = (await import("node:fs")).readFileSync("scripts/validate-idea-tags.mjs", "utf8");
    expect(source).toContain(`const MIN_TOOLS = ${MIN_TOOLS};`);
    expect(source).toContain(`const MIN_AUDIENCES = ${MIN_AUDIENCES};`);
  });

  test("section titles and order equal the idea section contract", async () => {
    const sections = await import("../../../scripts/lib/idea-sections.mjs");
    expect(SECTION_DEFINITIONS.map((section) => section.title)).toEqual([
      ...sections.CANONICAL_SECTION_TITLES,
      sections.SOURCES_TITLE,
    ]);
  });
});
