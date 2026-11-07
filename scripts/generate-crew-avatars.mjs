#!/usr/bin/env node
/**
 * WP67-S7 (issue #220). Render the fixed crew avatar set with Recraft V4.1 Flash.
 *
 *   node scripts/generate-crew-avatars.mjs                    # dry run: plan, prompts and price, no call
 *   node scripts/generate-crew-avatars.mjs --fixture          # fixture PNGs through the real adapter, no network
 *   node --env-file=.env.local scripts/generate-crew-avatars.mjs --live --confirm-spend-usd=0.091
 *
 * Options: --only=lead,brand  limit to some roles · --out=DIR  output folder
 * (default tmp/crew-avatars/<style version>). Output: one PNG per role,
 * manifest.json and contact-sheet.html for review. Nothing is written to
 * public/ — approved files are copied there and listed in CREW_AVATAR_SRC.
 *
 * A live run needs RECRAFT_API_KEY and --confirm-spend-usd equal to the
 * planned list price, so a typo or a bigger plan cannot spend by accident.
 * Recraft Flash only; there is no OpenAI image fallback.
 */
import { build } from "esbuild";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const option = (name) => args.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const known = new Set(["live", "fixture", "only", "out", "confirm-spend-usd"]);
for (const arg of args) {
  const name = arg.replace(/^--/, "").split("=", 1)[0];
  if (!arg.startsWith("--") || !known.has(name)) {
    console.error(`unknown argument: ${arg}`);
    process.exit(2);
  }
}
if (flag("live") && flag("fixture")) {
  console.error("choose one of --live and --fixture");
  process.exit(2);
}

const bundleDir = path.join(root, "tmp", "crew-avatars-build");
await mkdir(bundleDir, { recursive: true });
await build({
  entryPoints: { core: path.join(root, "scripts/generate-crew-avatars-core.ts"), recraft: path.join(root, "convex/ai/providers/recraft.ts") },
  outdir: bundleDir,
  outExtension: { ".js": ".mjs" },
  bundle: true,
  packages: "external",
  platform: "node",
  format: "esm",
  logLevel: "silent",
});
// Literal specifiers: the AI-imports security scan only follows literal paths.
// Relative to this file they are the two bundles written to `bundleDir` above.
const core = await import("../tmp/crew-avatars-build/core.mjs");
const { createRecraftAdapter } = await import("../tmp/crew-avatars-build/recraft.mjs");

const only = option("only")?.split(",").map((s) => s.trim()).filter(Boolean);
const plan = core.planCrewAvatars(only);
const usd = (micro) => (micro / 1_000_000).toFixed(3);

console.log(`${plan.items.length} avatars · ${plan.model} ${plan.size} · ${plan.styleVersion}`);
for (const item of plan.items) console.log(`  ${item.file.padEnd(24)} ${item.employeeName}`);
console.log(`List price: $${usd(plan.totalMicroUsd)}`);

if (!flag("live") && !flag("fixture")) {
  console.log("\nDry run. Prompts:");
  for (const item of plan.items) console.log(`\n[${item.employeeName}] ${item.prompt}`);
  console.log("\nNo call made. Use --fixture to test the pipeline or --live --confirm-spend-usd=<price> to render.");
  process.exit(0);
}

let env;
if (flag("live")) {
  const key = process.env.RECRAFT_API_KEY?.trim();
  if (!key) {
    console.error("RECRAFT_API_KEY is not set. Nothing was sent.");
    process.exit(1);
  }
  if (option("confirm-spend-usd") !== usd(plan.totalMicroUsd)) {
    console.error(`--confirm-spend-usd must be exactly ${usd(plan.totalMicroUsd)} for this plan. Nothing was sent.`);
    process.exit(1);
  }
  env = { AI_PROVIDER_MODE: "live", RECRAFT_API_KEY: key };
} else {
  env = {};
}

const outDir = path.resolve(root, option("out") ?? path.join("tmp", "crew-avatars", plan.styleVersion));
await mkdir(outDir, { recursive: true });
const adapter = createRecraftAdapter({ env });
const manifest = await core.generateCrewAvatars({
  plan,
  adapter,
  write: (file, bytes) => writeFile(path.join(outDir, file), bytes),
  onProgress: (entry) => console.log(`  wrote ${entry.file} (${entry.billedAs}, $${usd(entry.microUsd)})`),
});
await writeFile(path.join(outDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
await writeFile(path.join(outDir, "contact-sheet.html"), core.contactSheetHtml(manifest));
console.log(`\nDone: ${manifest.entries.length} files, $${usd(manifest.totalMicroUsd)} list price. Review ${path.relative(root, path.join(outDir, "contact-sheet.html"))}`);
