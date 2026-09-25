#!/usr/bin/env node
/**
 * Compile CLI: ResearchRecord JSON → content/ideas/{slug}.mdx (+ manifest stub)
 *
 * Usage:
 *   npm run engine:compile -- --record /tmp/record.json
 *   npm run engine:compile -- --record path.json --slug _engine-fixture-draft --force
 *   npm run engine:compile -- --record path.json --ideas-dir /tmp/ideas --no-manifest
 *
 * Slugs starting with engine-draft- are spot-check drafts: they default to
 * engine/drafts/{slug}.mdx + engine/drafts/manifest.json and are refused in
 * content/ideas/, so a draft can never reach the live site.
 *
 * Refuses to overwrite existing MDX unless --force.
 * Does not seed Convex, generate OG, or push git.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ENGINE_DRAFT_PREFIX = "engine-draft-";

function usage(exit = 1) {
  console.error(`Usage:
  node --experimental-strip-types scripts/engine-compile.mjs --record path.json [options]

Flags:
  --record path       ResearchRecord JSON from engine:research
  --slug name         Override output slug (throwaway compiles)
  --ideas-dir path    MDX output directory (default: content/ideas;
                      engine/drafts for engine-draft-* slugs)
  --manifest path     Manifest JSON (default: ideas/manifest.json;
                      engine/drafts/manifest.json for engine-draft-* slugs)
  --no-manifest       Do not write/update the manifest
  --force             Overwrite existing MDX / manifest row
`);
  process.exit(exit);
}

function parseArgs(argv) {
  const out = {
    recordPath: null,
    slug: null,
    ideasDir: null,
    manifestPath: null,
    noManifest: false,
    force: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--help" || a === "-h") usage(0);
    else if (a === "--record") out.recordPath = argv[++i];
    else if (a === "--slug") out.slug = argv[++i];
    else if (a === "--ideas-dir") out.ideasDir = path.resolve(argv[++i]);
    else if (a === "--manifest") out.manifestPath = path.resolve(argv[++i]);
    else if (a === "--no-manifest") out.noManifest = true;
    else if (a === "--force") out.force = true;
    else {
      console.error(`unknown arg: ${a}`);
      usage(1);
    }
  }
  return out;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.recordPath) usage(1);
  if (!fs.existsSync(args.recordPath)) {
    console.error(`record not found: ${args.recordPath}`);
    process.exit(1);
  }

  const [
    { parseResearchRecord },
    { writeCompiledIdea },
  ] = await Promise.all([
    import(
      pathToFileURL(path.join(root, "lib/engine/research-record.ts")).href
    ),
    import(
      pathToFileURL(path.join(root, "lib/engine/compile-write.ts")).href
    ),
  ]);

  const raw = JSON.parse(fs.readFileSync(args.recordPath, "utf8"));
  const record = parseResearchRecord(raw);

  const slug = (args.slug ?? record.brief.slug).trim().toLowerCase();
  const isDraft = slug.startsWith(ENGINE_DRAFT_PREFIX);
  const publicIdeasDir = path.join(root, "content", "ideas");
  const draftsDir = path.join(root, "engine", "drafts");
  const ideasDir = args.ideasDir ?? (isDraft ? draftsDir : publicIdeasDir);
  const manifestPath =
    args.manifestPath ??
    (isDraft
      ? path.join(draftsDir, "manifest.json")
      : path.join(root, "ideas", "manifest.json"));
  const publicManifest = path.join(root, "ideas", "manifest.json");
  if (
    isDraft &&
    (path.resolve(ideasDir) === publicIdeasDir ||
      (!args.noManifest && path.resolve(manifestPath) === publicManifest))
  ) {
    console.error(
      `refusing to write draft ${slug} into content/ideas/ or ideas/manifest.json (drafts live in engine/drafts/)`,
    );
    process.exit(1);
  }

  const result = writeCompiledIdea({
    record,
    slug: args.slug ?? undefined,
    ideasDir,
    manifestPath: args.noManifest ? undefined : manifestPath,
    writeManifest: !args.noManifest,
    force: args.force,
  });

  if (!result.manifestEntry.source.startsWith("engine:")) {
    console.error(`refusing non-engine source: ${result.manifestEntry.source}`);
    process.exit(1);
  }

  console.log(
    `wrote ${result.mdxPath} (source=${result.manifestEntry.source} words≈${result.manifestEntry.provenance.wordCount} manifest=${result.manifestWritten})`,
  );
}

main().catch((err) => {
  console.error(err instanceof Error ? err.stack || err.message : err);
  process.exit(1);
});
