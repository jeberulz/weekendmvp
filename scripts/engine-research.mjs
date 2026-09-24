#!/usr/bin/env node
/**
 * Research CLI: brief → ResearchRecord JSON (Mode A2 phase 5).
 *
 * Usage:
 *   npm run engine:research -- --fixture rfp-assistant --out /tmp/record.json
 *   npm run engine:research -- --brief engine/briefs/rfp-assistant.json --out path
 *
 * Default / --fixture mode needs no API keys. --live spends against providers.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function usage(exit = 1) {
  console.error(`Usage:
  node --experimental-strip-types scripts/engine-research.mjs --fixture <name> [--out path]
  node --experimental-strip-types scripts/engine-research.mjs --brief path.json [--fixture|--live] [--out path]

Flags:
  --fixture [name]  Fixture providers (no API keys). Name loads engine/briefs/{name}.json
                    when --brief is omitted (e.g. rfp-assistant).
  --brief path      Brief JSON: { title, audience, revenueModel, seedKeywords[] }
  --out path        Output ResearchRecord JSON (default: engine/records/{slug}.json)
  --live            Live providers (requires keys in .env)
`);
  process.exit(exit);
}

function parseArgs(argv) {
  const out = {
    fixture: false,
    fixtureName: null,
    briefPath: null,
    outPath: null,
    live: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--help" || a === "-h") usage(0);
    else if (a === "--fixture") {
      out.fixture = true;
      const next = argv[i + 1];
      if (next && !next.startsWith("--")) {
        out.fixtureName = next;
        i++;
      }
    } else if (a === "--brief") {
      out.briefPath = argv[++i];
    } else if (a === "--out") {
      out.outPath = argv[++i];
    } else if (a === "--live") {
      out.live = true;
    } else {
      console.error(`unknown arg: ${a}`);
      usage(1);
    }
  }
  return out;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.briefPath && !args.fixtureName) usage(1);

  let briefPath = args.briefPath;
  if (!briefPath && args.fixtureName) {
    briefPath = path.join(root, "engine", "briefs", `${args.fixtureName}.json`);
  }
  if (!briefPath || !fs.existsSync(briefPath)) {
    console.error(`brief not found: ${briefPath}`);
    process.exit(1);
  }

  const brief = JSON.parse(fs.readFileSync(briefPath, "utf8"));
  // Fixture is the default; --live only when not also --fixture.
  const mode = args.live && !args.fixture ? "live" : "fixture";
  // Bare --brief without --live still uses fixture (offline-safe default).
  const resolvedMode =
    args.live && !args.fixtureName && !args.fixture ? "live" : mode;

  const [{ runResearch }, { createProviders }, { parseResearchRecord }] =
    await Promise.all([
      import(pathToFileURL(path.join(root, "lib/engine/pipeline.ts")).href),
      import(pathToFileURL(path.join(root, "lib/engine/providers.ts")).href),
      import(
        pathToFileURL(path.join(root, "lib/engine/research-record.ts")).href
      ),
    ]);

  const providers = createProviders({ mode: resolvedMode });
  const result = await runResearch({ brief, providers });
  const validated = parseResearchRecord(result);

  const outPath =
    args.outPath ||
    path.join(root, "engine", "records", `${validated.brief.slug}.json`);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, `${JSON.stringify(validated, null, 2)}\n`);
  console.log(
    `wrote ${outPath} (slug=${validated.brief.slug} costUsd=${validated.provenance.costUsd.toFixed(4)} mode=${resolvedMode})`,
  );
}

main().catch((err) => {
  console.error(err instanceof Error ? err.stack || err.message : err);
  process.exit(1);
});
