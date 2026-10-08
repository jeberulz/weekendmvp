import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";

import {
  IDEA_META_MAX,
  IDEA_TITLE_MAX,
  SUMMARY_WORD_MIN,
  buildPublicIdeaPreview,
  ideaDocumentTitle,
  ideaMetaDescription,
  sectionTeasers,
} from "../../lib/ideas/public-preview";

function mdxBody(slug: string): string {
  const raw = readFileSync(`content/ideas/${slug}.mdx`, "utf8");
  return raw.replace(/^---[\s\S]*?---\n/, "");
}

describe("idea public preview", () => {
  test("document titles stay within the SERP budget and prefer description for short stubs", () => {
    const short = ideaDocumentTitle(
      "QuickBooks Escape Ramp",
      "A flat-fee service that migrates small businesses off sunsetting QuickBooks Desktop to Xero, Zoho, or FreshBooks with penny-accurate, guaranteed data fidelity.",
    );
    expect(short.length).toBeLessThanOrEqual(IDEA_TITLE_MAX);
    expect(short.endsWith(" | Weekend MVP")).toBe(true);
    expect(short.startsWith("QuickBooks Escape Ramp")).toBe(false);
    expect(short).toContain("flat-fee");

    const long = ideaDocumentTitle(
      "Plain-English DMARC Monitoring for Agencies and Small Businesses",
      "Find out why client email lands in spam and get the exact DNS fix in plain English.",
    );
    expect(long.length).toBeLessThanOrEqual(IDEA_TITLE_MAX);
    expect(long).toContain("DMARC");
  });

  test("meta descriptions clamp to 160 characters from existing copy", () => {
    const meta = ideaMetaDescription("x".repeat(200));
    expect(meta.length).toBeLessThanOrEqual(IDEA_META_MAX);
  });

  test("quickbooks public preview has summary, research teasers, prompts and no invented filler keys", () => {
    const description =
      "A flat-fee service that migrates small businesses off sunsetting QuickBooks Desktop to Xero, Zoho, or FreshBooks with penny-accurate, guaranteed data fidelity.";
    const preview = buildPublicIdeaPreview({
      title: "QuickBooks Escape Ramp",
      description,
      markdown: mdxBody("quickbooks-escape-ramp"),
      audiences: ["small-business-owners", "accountants"],
      buildTime: "48",
    });

    expect(preview.summaryWordCount).toBeGreaterThanOrEqual(SUMMARY_WORD_MIN);
    expect(preview.thinSummary).toBe(false);
    expect(preview.teasers.map((t) => t.heading)).toEqual([
      "The Problem",
      "The Solution",
      "Market Research",
      "Competitive Landscape",
      "Business Model",
      "Recommended Tech Stack",
    ]);
    for (const teaser of preview.teasers) {
      expect(teaser.teaser.length).toBeGreaterThan(20);
    }
    expect(preview.prompts.length).toBeGreaterThanOrEqual(3);
    expect(preview.prompts[0]?.title).toMatch(/Project Setup/i);
    expect(preview.documentTitle.length).toBeLessThanOrEqual(IDEA_TITLE_MAX);
    expect(preview.metaDescription.length).toBeLessThanOrEqual(IDEA_META_MAX);
    // Summary must reuse source text, not invent a market claim.
    expect(preview.summaryParagraphs.join(" ")).toMatch(/QuickBooks/i);
  });

  test("section teasers degrade to empty when markdown is missing", () => {
    expect(sectionTeasers("")).toEqual([]);
    const preview = buildPublicIdeaPreview({
      title: "Thin Idea",
      description: "Only a short description exists for this idea.",
      markdown: "",
    });
    expect(preview.teasers).toEqual([]);
    expect(preview.prompts).toEqual([]);
    expect(preview.thinSummary).toBe(true);
  });
});
