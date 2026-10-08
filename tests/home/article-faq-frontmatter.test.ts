import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import matter from "gray-matter";

/**
 * Articles that declare a frontmatter `faq` array must keep every question
 * string somewhere in the MDX body so FAQPage JSON-LD can't drift from the
 * visible text.
 */
const ARTICLES_DIR = path.join(process.cwd(), "content/articles");

function listArticleFiles(): string[] {
  return fs
    .readdirSync(ARTICLES_DIR)
    .filter((f) => f.endsWith(".mdx") && !f.startsWith("_"))
    .map((f) => path.join(ARTICLES_DIR, f));
}

describe("article faq frontmatter", () => {
  it("every frontmatter faq question appears in the MDX body", () => {
    const checked: string[] = [];

    for (const file of listArticleFiles()) {
      const raw = fs.readFileSync(file, "utf8");
      const { data, content } = matter(raw);
      const faq = data.faq;
      if (!Array.isArray(faq) || faq.length === 0) continue;

      checked.push(path.basename(file));
      for (const item of faq) {
        expect(typeof item?.question).toBe("string");
        expect(typeof item?.answer).toBe("string");
        expect(content).toContain(item.question as string);
      }
    }

    // Guard: at least the two brief-touched articles ship faq frontmatter.
    expect(checked).toEqual(
      expect.arrayContaining([
        "programs-solo-founders-idea-to-mvp.mdx",
        "cursor-vs-claude-code-vs-lovable-2026.mdx",
      ]),
    );
  });
});
