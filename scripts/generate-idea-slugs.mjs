#!/usr/bin/env node
/**
 * Emit lib/idea-slugs.generated.ts from ideas/manifest.json.
 * Used by Edge middleware to hard-404 unknown /build/{slug} paths.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const manifest = JSON.parse(
  readFileSync(join(root, "ideas/manifest.json"), "utf8"),
);
const slugs = manifest.ideas.map((i) => i.slug).sort();

const body = `/**
 * Auto-generated from ideas/manifest.json — do not edit by hand.
 * Regenerate: node scripts/generate-idea-slugs.mjs
 *
 * Slim slug set for Edge middleware. Under cacheComponents, route-level
 * notFound() is a soft 404 (HTTP 200); middleware uses this set to issue a
 * genuine 404 for unknown /build/{slug} before the PPR shell commits.
 */
export const IDEA_SLUGS: readonly string[] = ${JSON.stringify(slugs, null, 2)};

export const IDEA_SLUG_SET: ReadonlySet<string> = new Set(IDEA_SLUGS);

export function isKnownIdeaSlug(slug: string): boolean {
  return IDEA_SLUG_SET.has(slug);
}
`;

writeFileSync(join(root, "lib/idea-slugs.generated.ts"), body);
console.log(`Wrote ${slugs.length} idea slugs → lib/idea-slugs.generated.ts`);
