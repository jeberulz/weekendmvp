import { promises as fs } from "node:fs";
import path from "node:path";
import matter from "gray-matter";

/**
 * Sitemap lastmod helpers.
 *
 * Google ignores (or stops trusting) lastmod when it is inaccurate. Idea MDX
 * files only carry slug/title — publish dates live in `ideas/manifest.json`.
 * Prefer a real date or omit lastmod entirely; never invent "now".
 */

export type MdxSitemapRow = {
  slug: string;
  publishedAt?: number;
};

export function parsePublishedAt(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

export async function listMdxFrontmatter(
  dir: string,
): Promise<MdxSitemapRow[]> {
  // Must be rooted at process.cwd() — a bare relative path resolves against
  // the serverless function's cwd in production, silently yielding zero
  // entries and dropping every MDX page from the sitemap.
  const root = path.join(process.cwd(), dir);
  try {
    const files = await fs.readdir(root);
    const mdx = files.filter(
      (f) => f.endsWith(".mdx") && !f.startsWith("_"),
    );
    const rows = await Promise.all(
      mdx.map(async (filename) => {
        const slug = filename.replace(/\.mdx$/, "");
        try {
          const raw = await fs.readFile(path.join(root, filename), "utf8");
          const { data } = matter(raw);
          return {
            slug,
            publishedAt: parsePublishedAt(data?.publishedAt),
          };
        } catch {
          return { slug };
        }
      }),
    );
    return rows;
  } catch (error) {
    // Don't fail the whole sitemap over one unreadable dir, but do surface it —
    // swallowing this silently is what let the cwd bug above go unnoticed.
    console.error("sitemap: could not list MDX dir", {
      dir: root,
      error: String(error),
    });
    return [];
  }
}

/** slug → epoch ms from ideas/manifest.json (authoritative idea publish dates). */
export async function loadIdeaPublishedAtMap(
  manifestPath = path.join(process.cwd(), "ideas", "manifest.json"),
): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  try {
    const raw = await fs.readFile(manifestPath, "utf8");
    const data = JSON.parse(raw) as {
      ideas?: Array<{ slug?: string; publishedAt?: unknown }>;
    };
    for (const idea of data.ideas ?? []) {
      if (!idea?.slug) continue;
      const publishedAt = parsePublishedAt(idea.publishedAt);
      if (publishedAt !== undefined) map.set(idea.slug, publishedAt);
    }
  } catch (error) {
    console.error("sitemap: could not read ideas manifest for lastmod", {
      manifestPath,
      error: String(error),
    });
  }
  return map;
}
