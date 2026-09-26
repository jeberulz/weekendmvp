import { describe, expect, test } from "vitest";
import { listMdxSlugs, readMdxFile } from "../../lib/mdx";
import { listMdxFrontmatter } from "../../lib/sitemap-data";
import { contentDirectory } from "../../lib/content-directory";

describe("published content filesystem roots", () => {
  test("the real idea corpus remains readable for page regeneration and sitemaps", async () => {
    const slugs = await listMdxSlugs("content/ideas");
    expect(slugs).toContain("adspark");
    expect((await readMdxFile("content/ideas", "adspark"))?.content).toContain("## AI Prompts to Build This");
    expect((await listMdxFrontmatter("content/ideas")).map((row) => row.slug)).toContain("adspark");
  });
  test("only the three known content roots are permitted", () => {
    for (const dir of [".", "public", "docs", "content/../docs", "/tmp"]) {
      expect(() => contentDirectory(dir)).toThrow("Unsupported content directory");
    }
  });
  test("unsafe slugs cannot escape a content root", async () => {
    expect(await readMdxFile("content/ideas", "../../package.json")).toBeNull();
  });
});
