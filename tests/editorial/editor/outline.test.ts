import { describe, expect, test } from "vitest";

import type { ClaimView, SectionView } from "@/lib/editorial/contracts/views";
import {
  adjacentHeadingOffset,
  buildOutline,
  claimMarkers,
  lineAtOffset,
  offsetOfLine,
  truncateText,
} from "@/lib/editorial/editor/outline";

const ARTICLE = [
  "---",
  "title: Demo",
  "---",
  "Intro line.",
  "",
  "## The Problem",
  "Pain.",
  "",
  "## AI Prompts to Build This",
  "```md",
  "## Not a section",
  "```",
  "",
  "## Sources",
  "- a source",
].join("\n");

function section(key: SectionView["key"], status: SectionView["review"]["status"], issueCount = 0): SectionView {
  return {
    key,
    title: key,
    order: 0,
    present: true,
    hash: null,
    words: 0,
    startLine: null,
    review: { status, attestedAt: null, note: null },
    issueCount,
  };
}

describe("section outline", () => {
  test("lists all eight sections, locating headings in the editor text and review status from the saved copy", () => {
    const outline = buildOutline(ARTICLE, [section("problem", "reviewed"), section("sources", "stale", 2)]);
    expect(outline.map((entry) => entry.key)).toEqual([
      "problem",
      "solution",
      "market",
      "competition",
      "business-model",
      "tech-stack",
      "prompts",
      "sources",
    ]);
    expect(outline[0]).toMatchObject({ title: "The Problem", line: 6, status: "reviewed" });
    expect(outline[1]).toMatchObject({ key: "solution", line: null, status: "unreviewed" });
    expect(outline[6]).toMatchObject({ key: "prompts", line: 9 });
    expect(outline[7]).toMatchObject({ key: "sources", line: 14, status: "stale", issueCount: 2 });
  });

  test("line and offset arithmetic round-trips", () => {
    const offset = offsetOfLine(ARTICLE, 6);
    expect(ARTICLE.slice(offset).startsWith("## The Problem")).toBe(true);
    expect(lineAtOffset(ARTICLE, offset)).toBe(6);
    expect(offsetOfLine(ARTICLE, 0)).toBe(0);
    expect(offsetOfLine(ARTICLE, 10_000)).toBe(ARTICLE.lastIndexOf("\n") + 1);
  });

  test("section navigation skips headings inside code fences and stops at the ends", () => {
    const start = 0;
    const first = adjacentHeadingOffset(ARTICLE, start, 1);
    expect(first).not.toBeNull();
    expect(ARTICLE.slice(first ?? 0).startsWith("## The Problem")).toBe(true);
    const second = adjacentHeadingOffset(ARTICLE, first ?? 0, 1);
    expect(ARTICLE.slice(second ?? 0).startsWith("## AI Prompts")).toBe(true);
    const third = adjacentHeadingOffset(ARTICLE, second ?? 0, 1);
    expect(ARTICLE.slice(third ?? 0).startsWith("## Sources")).toBe(true);
    expect(adjacentHeadingOffset(ARTICLE, third ?? 0, 1)).toBeNull();
    const back = adjacentHeadingOffset(ARTICLE, third ?? 0, -1);
    expect(ARTICLE.slice(back ?? 0).startsWith("## AI Prompts")).toBe(true);
    expect(adjacentHeadingOffset(ARTICLE, 0, -1)).toBeNull();
  });
});

describe("claim markers", () => {
  test("carry the exact anchor wording and a short readable label", () => {
    const claim = {
      id: "clm_1",
      text: "Freelancers spend about six hours every week chasing late invoices according to a survey of two hundred people",
      anchorText: "about six hours every week",
    } as ClaimView;
    const empty = { id: "clm_2", text: "No anchor", anchorText: "  " } as ClaimView;
    const markers = claimMarkers([claim, empty]);
    expect(markers).toHaveLength(1);
    expect(markers[0].anchorText).toBe("about six hours every week");
    expect(Array.from(markers[0].label).length).toBeLessThanOrEqual(90);
    expect(markers[0].label.endsWith("…")).toBe(true);
    expect(truncateText("short", 90)).toBe("short");
  });
});
