import fs from "node:fs";
import path from "node:path";

/**
 * Does an internal URL path hit a page in the Next.js app directory? (WP103-S3)
 * Walks `app/`, skipping route groups like `(marketing)`, matching dynamic segments like `[slug]`.
 * It does not read redirects in `next.config`, so a path that only redirects counts as missing.
 * Plain Node can load this file.
 */

const PAGE_FILES = ["page.tsx", "page.ts", "page.jsx", "page.js", "page.mdx"];

function hasPage(dir: string): boolean {
  return PAGE_FILES.some((file) => fs.existsSync(path.join(dir, file)));
}

function subdirs(dir: string): string[] {
  try {
    return fs.readdirSync(dir, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => entry.name);
  } catch {
    return [];
  }
}

function walk(dir: string, segments: readonly string[]): boolean {
  const names = subdirs(dir);
  if (segments.length === 0) {
    if (hasPage(dir)) return true;
    return names.filter((name) => /^\(.+\)$/.test(name)).some((group) => walk(path.join(dir, group), segments));
  }
  const [segment, ...rest] = segments;
  for (const name of names) {
    if (/^\(.+\)$/.test(name)) {
      if (walk(path.join(dir, name), segments)) return true;
    } else if (name === segment) {
      if (walk(path.join(dir, name), rest)) return true;
    } else if (/^\[\.\.\..+\]$/.test(name) || /^\[\[\.\.\..+\]\]$/.test(name)) {
      // Catch-all segments take the rest of the path.
      if (hasPage(path.join(dir, name))) return true;
    } else if (/^\[.+\]$/.test(name)) {
      if (walk(path.join(dir, name), rest)) return true;
    }
  }
  return false;
}

/** `urlPath` looks like "/live/build-along". Query strings and fragments are ignored. */
export function appRouteExists(appDir: string, urlPath: string): boolean {
  const clean = urlPath.split(/[?#]/)[0];
  if (!clean.startsWith("/")) return false;
  return walk(appDir, clean.split("/").filter(Boolean));
}
