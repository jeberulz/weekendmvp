#!/usr/bin/env node
/**
 * Compile CLI: ResearchRecord JSON → engine/drafts/{slug}.mdx (+ draft manifest)
 *
 * Usage:
 *   npm run engine:compile -- --record /tmp/record.json
 *   npm run engine:compile -- --record path.json --slug fresh-public-slug --force
 *   npm run engine:compile -- --record path.json --ideas-dir /tmp/ideas --no-manifest
 *
 * Every compile lands in engine/drafts/, whatever the slug is. content/ideas/
 * and ideas/manifest.json are refused. Promotion is a separate command.
 *
 * Refuses to overwrite existing MDX unless --force.
 * Does not seed Convex, generate OG, or push git.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function usage(exit = 1) {
  console.error(`Usage:
  node --experimental-strip-types scripts/engine-compile.mjs --record path.json [options]

Flags:
  --record path       ResearchRecord JSON from engine:research
  --slug name         Override output slug (throwaway compiles)
  --root path         Repository root used to place engine/drafts (tests)
  --ideas-dir path    MDX output directory (default: <root>/engine/drafts)
  --manifest path     Manifest JSON (default: <root>/engine/drafts/manifest.json)
  --no-manifest       Do not write/update the manifest
  --force             Overwrite existing MDX / manifest row
`);
  process.exit(exit);
}

function parseArgs(argv) {
  const out = {
    recordPath: null,
    slug: null,
    rootDir: null,
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
    else if (a === "--root") out.rootDir = path.resolve(argv[++i]);
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
    { resolveCompilePaths },
  ] = await Promise.all([
    import(
      pathToFileURL(path.join(root, "lib/engine/research-record.ts")).href
    ),
    import(
      pathToFileURL(path.join(root, "lib/engine/compile-write.ts")).href
    ),
    import(
      pathToFileURL(path.join(root, "lib/engine/compile-destination.ts")).href
    ),
  ]);

  const raw = JSON.parse(fs.readFileSync(args.recordPath, "utf8"));
  const record = parseResearchRecord(raw);

  const base = args.rootDir ?? root;
  let paths;
  try {
    paths = resolveCompilePaths({
      root: base,
      ideasDir: args.ideasDir,
      manifestPath: args.manifestPath,
    });
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
  const ideasDir = paths.ideasDir;
  const manifestPath = args.noManifest ? undefined : paths.manifestPath;

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
