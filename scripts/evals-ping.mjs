#!/usr/bin/env node
/**
 * Check the content-eval LLM wiring (WP41-S2).
 *
 * Usage:
 *   npm run evals:ping -- --fixture                  # no key, no network
 *   npm run evals:ping -- --live [--models a/b,c/d]  # tiny paid call per model
 *   npm run evals:ping -- --live --list [filter]     # priced models, no key
 *
 * --live pings the judge models pinned in evals/config.json (llm.judges)
 * unless --models is given. Each ping costs a fraction of a cent and runs
 * under the same hard cap as a real sweep (EVALS_MAX_USD, max $10).
 *
 * Reads OPENROUTER_API_KEY and EVALS_MAX_USD from the shell, then
 * .env.local, then .env (shell values win).
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function usage(exit) {
  console.error(`Usage:
  npm run evals:ping -- --fixture [--models a,b]
  npm run evals:ping -- --live [--models a,b]
  npm run evals:ping -- --live --list [filter]`);
  process.exit(exit);
}

function parseArgs(argv) {
  const args = { mode: null, models: null, list: false, filter: "" };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--fixture" || a === "--live") {
      if (args.mode) usage(2);
      args.mode = a.slice(2);
    } else if (a === "--models") {
      args.models = (argv[++i] ?? "").split(",").map((m) => m.trim()).filter(Boolean);
    } else if (a === "--list") {
      args.list = true;
      if (argv[i + 1] && !argv[i + 1].startsWith("--")) args.filter = argv[++i];
    } else if (a === "--help" || a === "-h") usage(0);
    else {
      console.error(`unknown arg: ${a}`);
      usage(2);
    }
  }
  if (!args.mode) {
    console.error("pass --fixture or --live (there is no implicit mode)");
    usage(2);
  }
  if (args.list && args.mode !== "live") {
    console.error("--list reads OpenRouter's live model list: use --live --list");
    usage(2);
  }
  return args;
}

/** Standalone Node does not read env files. Shell, then .env.local, then .env. */
function loadLocalEnv() {
  for (const name of [".env.local", ".env"]) {
    const envPath = path.join(root, name);
    if (fs.existsSync(envPath)) process.loadEnvFile(envPath);
  }
}

const perMillion = (usdPerToken) => `$${(usdPerToken * 1_000_000).toFixed(3)}`;
const dollars = (usd) => `$${usd.toFixed(6)}`;

async function listModels(filter, openrouter) {
  const catalog = await openrouter.fetchModelCatalog();
  const needle = filter.toLowerCase();
  const rows = [...catalog.values()]
    .filter((m) => !needle || m.id.toLowerCase().includes(needle) || m.name.toLowerCase().includes(needle))
    .sort((a, b) => a.completionUsd - b.completionUsd || a.id.localeCompare(b.id));
  const shown = rows.slice(0, 60);
  console.log("model id | $/1M in | $/1M out | context");
  for (const m of shown) {
    console.log(`${m.id} | ${perMillion(m.promptUsd)} | ${perMillion(m.completionUsd)} | ${m.contextLength ?? "?"}`);
  }
  console.log(
    `\n${rows.length} priced model(s)${needle ? ` matching '${filter}'` : ""}` +
      (rows.length > shown.length ? `, cheapest ${shown.length} shown. Narrow with a filter.` : "."),
  );
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const load = (rel) => import(pathToFileURL(path.join(root, rel)).href);
  const [{ createEvalLlm }, openrouter, { FIXTURE_MODELS }] = await Promise.all([
    load("lib/evals/llm.ts"),
    load("lib/evals/providers/openrouter.ts"),
    load("lib/evals/providers/fixtures.ts"),
  ]);

  if (args.mode === "live") loadLocalEnv();

  if (args.list) {
    await listModels(args.filter, openrouter);
    return;
  }

  const config = JSON.parse(fs.readFileSync(path.join(root, "evals", "config.json"), "utf8"));
  let models = args.models ?? config.llm.judges;
  if (models.length === 0) {
    if (args.mode === "live") {
      console.error(
        "no judge models pinned in evals/config.json (llm.judges). Pass --models, or pick some with --live --list <filter>.",
      );
      process.exit(2);
    }
    models = FIXTURE_MODELS;
  }

  const llm = createEvalLlm({
    mode: args.mode,
    timeoutMs: config.llm.requestTimeoutMs,
    fixture: { models },
  });

  console.log(`evals-ping: ${args.mode} mode, cap ${dollars(llm.capUsd())}`);
  const results = await Promise.allSettled(
    models.map((model) =>
      llm.call({
        label: `ping ${model}`,
        model,
        system: "You are a connectivity check. Reply with a JSON object only.",
        user: 'Return exactly {"ok": true}.',
        maxOutputTokens: 200,
        json: true,
      }),
    ),
  );

  let failed = 0;
  results.forEach((r, i) => {
    if (r.status === "fulfilled") {
      const v = r.value;
      console.log(
        `OK    ${models[i]} -> served by ${v.servedModel}, ${v.inputTokens} in / ${v.outputTokens} out, ${dollars(v.costUsd)} (${v.costSource})`,
      );
    } else {
      failed += 1;
      console.log(`FAIL  ${models[i]}: ${r.reason?.message ?? r.reason}`);
    }
  });

  console.log(
    `\nspent ${dollars(llm.spentUsd())} of ${dollars(llm.capUsd())} cap, ${failed} failed`,
  );
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error(`evals-ping: ${error.message}`);
  process.exit(1);
});
