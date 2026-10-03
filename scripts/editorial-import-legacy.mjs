#!/usr/bin/env node

/** Inventory and, after an explicitly approved operator step, import legacy live ideas. */
import { build } from "esbuild";
import { ConvexHttpClient } from "convex/browser";
import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { internal } from "../convex/_generated/api.js";

const root = path.resolve(import.meta.dirname, "..");
const outputDir = path.join(root, "tmp", "editorial-import");
await mkdir(outputDir, { recursive: true });
const outputPath = path.join(outputDir, "legacy-core.mjs");
await build({
  entryPoints: [path.join(root, "scripts/editorial-import-legacy-core.ts")],
  outfile: outputPath,
  bundle: true,
  packages: "external",
  platform: "node",
  format: "esm",
  logLevel: "silent",
});
const { inventoryLegacyIdeas } = await import(pathToFileURL(outputPath).href);
const inventory = await inventoryLegacyIdeas(root);
const args = process.argv.slice(2);
const apply = args.includes("--apply");
const confirm = args.find((arg) => arg.startsWith("--confirm-inventory="))?.split("=", 2)[1];
const backupPath = args.find((arg) => arg.startsWith("--backup="))?.slice("--backup=".length);

console.log(JSON.stringify({
  source: inventory.source,
  digest: inventory.digest,
  manifestIdeas: inventory.total,
  importable: inventory.entries.length,
  skipped: inventory.skipped,
}, null, 2));

if (!apply) process.exit(0);
if (inventory.skipped.length > 0 || inventory.entries.length !== inventory.total) {
  throw new Error("Import refused: the entire checked-in manifest must validate first.");
}
if (confirm !== inventory.digest) {
  throw new Error("Import refused: --confirm-inventory must match this exact dry-run digest.");
}
if (!backupPath || !existsSync(backupPath)) {
  throw new Error("Import refused: provide a fresh, verified Convex backup with --backup=PATH.");
}
const deploymentUrl = process.env.EDITORIAL_IMPORT_CONVEX_URL;
const adminKey = process.env.EDITORIAL_IMPORT_ADMIN_KEY;
if (!deploymentUrl || !/^https:\/\/[a-z0-9-]+(?:\.[a-z0-9-]+)*\.convex\.cloud$/.test(deploymentUrl) || !adminKey) {
  throw new Error("Import refused: set the verified EDITORIAL_IMPORT_CONVEX_URL and EDITORIAL_IMPORT_ADMIN_KEY.");
}
const target = args.find((arg) => arg.startsWith("--target="))?.slice("--target=".length);
if (!target || new URL(deploymentUrl).hostname.split(".")[0] !== target) {
  throw new Error("Import refused: --target must name the exact deployment in EDITORIAL_IMPORT_CONVEX_URL.");
}

const client = new ConvexHttpClient(deploymentUrl);
client.setAdminAuth(adminKey);
let imported = 0;
let duplicate = 0;
for (const { slug, envelope } of inventory.entries) {
  const result = await client.mutation(internal.editorial.service.importSubmission, {
    envelope: JSON.stringify(envelope),
    producer: "legacy-import",
    authority: "none",
  });
  if (!result.ok || result.value.slugConflict) {
    throw new Error(`Import stopped at ${slug}: ${result.ok ? "slug conflict" : result.error.code}. Previous imports remain; the stable submission IDs allow a checked retry.`);
  }
  if (result.value.duplicate) duplicate += 1;
  else imported += 1;
  console.log(`${slug}: ${result.value.duplicate ? "already imported" : "imported"}${result.value.quarantined ? " (unsafe MDX quarantined)" : ""}`);
}
console.log(JSON.stringify({ deployment: target, imported, duplicate, total: inventory.entries.length }));
