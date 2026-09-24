#!/usr/bin/env node
/**
 * Research CLI: brief → ResearchRecord JSON (Mode A2 phase 5).
 *
 * Usage:
 *   npm run engine:research -- --fixture rfp-assistant --out /tmp/record.json
 *   npm run engine:research -- --brief path/to/brief.json --live --out path
 *
 * --fixture needs no API keys and returns canned RFP-assistant data, so it
 * only runs named fixture briefs. Any other brief needs --live, which spends
 * against providers. There is no implicit mode.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function usage(exit = 1) {
  console.error(`Usage:
  node --experimental-strip-types scripts/engine-research.mjs --fixture <name> [--out path]
  node --experimental-strip-types scripts/engine-research.mjs --brief path.json --live [--out path]

Flags:
  --fixture name    Fixture providers (no API keys, canned RFP-assistant data).
                    Loads engine/briefs/{name}.json (e.g. rfp-assistant).
                    Cannot be combined with --brief or --live.
  --brief path      Brief JSON: { title, audience, revenueModel, seedKeywords[] }.
                    Requires --live.
  --out path        Output ResearchRecord JSON (default: engine/records/{slug}.json)
  --live            Live providers. Reads OPENAI_API_KEY, PERPLEXITY_API_KEY,
                    DATAFORSEO_LOGIN, DATAFORSEO_PASSWORD from the shell, then
                    .env.local, then .env (shell values win).
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

/**
 * Standalone Node does not read env files. Load .env.local then .env so live
 * keys work the same way they do for `next dev`. loadEnvFile never overrides
 * a variable already set, so the shell wins, then .env.local, then .env.
 */
function loadLocalEnv() {
  for (const name of [".env.local", ".env"]) {
    const envPath = path.join(root, name);
    if (fs.existsSync(envPath)) process.loadEnvFile(envPath);
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  // Fixture providers return canned RFP-assistant payloads for any brief.
  // Mode is always explicit, and fixture mode only runs named fixture briefs,
  // so canned data is never written under another idea's slug.
  if (args.live && args.fixture) {
    console.error("--live and --fixture are mutually exclusive");
    process.exit(1);
  }
  if (args.fixture && (args.briefPath || !args.fixtureName)) {
    console.error(
      "--fixture takes a fixture name (engine/briefs/{name}.json) and cannot be combined with --brief",
    );
    process.exit(1);
  }
  if (!args.fixture && !(args.briefPath && args.live)) {
    console.error("pass --fixture <name>, or --brief <path> --live");
    usage(1);
  }
  const resolvedMode = args.live ? "live" : "fixture";

  const briefPath =
    args.briefPath ??
    path.join(root, "engine", "briefs", `${args.fixtureName}.json`);
  if (!briefPath || !fs.existsSync(briefPath)) {
    console.error(`brief not found: ${briefPath}`);
    process.exit(1);
  }

  const brief = JSON.parse(fs.readFileSync(briefPath, "utf8"));

  if (resolvedMode === "live") loadLocalEnv();

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
