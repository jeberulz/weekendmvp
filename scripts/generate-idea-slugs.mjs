#!/usr/bin/env node
/**
 * Emit or verify lib/idea-slugs.generated.ts from ideas/manifest.json.
 * Used by Edge middleware to hard-404 unknown idea/build paths.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
if (args.length > 1 || (args.length === 1 && args[0] !== "--check")) {
  console.error("Usage: node scripts/generate-idea-slugs.mjs [--check]");
  process.exit(2);
}
const checkOnly = args[0] === "--check";
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

const generatedPath = join(root, "lib/idea-slugs.generated.ts");
if (checkOnly) {
  let saved = "";
  try {
    saved = readFileSync(generatedPath, "utf8");
  } catch {
    // A missing generated set is stale too; the build must fail closed.
  }
  if (saved !== body) {
    console.error("Idea slug set is stale. Run npm run generate:idea-slugs and commit the generated file.");
    process.exit(1);
  }
  console.log(`Verified ${slugs.length} idea slugs in lib/idea-slugs.generated.ts`);
} else {
  writeFileSync(generatedPath, body);
  console.log(`Wrote ${slugs.length} idea slugs → lib/idea-slugs.generated.ts`);
}
