import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";

import {
  SUMMARY_WORD_MIN,
  buildPublicIdeaPreview,
} from "../../lib/ideas/public-preview";
import manifest from "../../ideas/manifest.json";

/** Ideas that failed the 120-word public-summary floor before the extractor fix. */
const PREVIOUSLY_THIN = [
  "conversational-analytics-digest",
  "creator-manufacturer-partnership-marketplace",
  "markdown-client-proposals",
] as const;

const PRIORITY = [
  "freelance-scope-creep-detector",
  "ai-agent-error-translator",
  ...PREVIOUSLY_THIN,
] as const;

describe("public summary word floor", () => {
  test("every manifest idea clears the 120-word public summary floor", () => {
    const ideas = (manifest as { ideas: Array<Record<string, unknown>> }).ideas;
    const thin: Array<{ slug: string; words: number }> = [];
    for (const idea of ideas) {
      const slug = String(idea.slug);
      let markdown = "";
      try {
        markdown = readFileSync(`content/ideas/${slug}.mdx`, "utf8").replace(
          /^---[\s\S]*?---\n/,
          "",
        );
      } catch {
        /* missing MDX */
      }
      const preview = buildPublicIdeaPreview({
        title: String(idea.title ?? slug),
        description: String(idea.description ?? ""),
        markdown,
        audiences: (idea.audiences as string[]) ?? [],
        buildTime: idea.buildTime ? String(idea.buildTime) : undefined,
        tools: (idea.tools as string[]) ?? [],
      });
      if (preview.summaryWordCount < SUMMARY_WORD_MIN) {
        thin.push({ slug, words: preview.summaryWordCount });
      }
    }
    expect(thin).toEqual([]);
  });

  test.each(PRIORITY)("%s stays at or above 120 summary words", (slug) => {
    const ideas = (manifest as { ideas: Array<Record<string, unknown>> }).ideas;
    const idea = ideas.find((row) => row.slug === slug);
    expect(idea).toBeTruthy();
    const markdown = readFileSync(`content/ideas/${slug}.mdx`, "utf8").replace(
      /^---[\s\S]*?---\n/,
      "",
    );
    const preview = buildPublicIdeaPreview({
      title: String(idea!.title ?? slug),
      description: String(idea!.description ?? ""),
      markdown,
      audiences: (idea!.audiences as string[]) ?? [],
      buildTime: idea!.buildTime ? String(idea!.buildTime) : undefined,
      tools: (idea!.tools as string[]) ?? [],
    });
    expect(preview.summaryWordCount).toBeGreaterThanOrEqual(SUMMARY_WORD_MIN);
    expect(preview.summaryWordCount).toBeLessThanOrEqual(250);
  });

  test("freelance-scope-creep-detector meta is query-first and ≤160 chars", () => {
    const ideas = (manifest as { ideas: Array<Record<string, unknown>> }).ideas;
    const idea = ideas.find((row) => row.slug === "freelance-scope-creep-detector")!;
    const markdown = readFileSync(
      "content/ideas/freelance-scope-creep-detector.mdx",
      "utf8",
    ).replace(/^---[\s\S]*?---\n/, "");
    const preview = buildPublicIdeaPreview({
      title: String(idea.title),
      description: String(idea.description ?? ""),
      markdown,
      audiences: (idea.audiences as string[]) ?? [],
      buildTime: idea.buildTime ? String(idea.buildTime) : undefined,
      tools: (idea.tools as string[]) ?? [],
    });
    expect(preview.metaDescription.length).toBeLessThanOrEqual(160);
    expect(preview.metaDescription.toLowerCase()).toMatch(/scope creep/);
    expect(preview.metaDescription.toLowerCase()).toMatch(/slack|email/);
    expect(preview.metaDescription.toLowerCase()).toMatch(/change order/);
  });
});
