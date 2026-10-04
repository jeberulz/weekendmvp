#!/usr/bin/env node

/** Dry-run-first bridge from audited engine files to private editorial. */
import { build } from "esbuild";
import { ConvexHttpClient } from "convex/browser";
import { existsSync } from "node:fs";
import { mkdir, readFile, realpath } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { internal } from "../convex/_generated/api.js";

const root = path.resolve(import.meta.dirname, "..");
const args = process.argv.slice(2);
const value = (prefix) => args.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
const slug = value("--slug=");
if (!slug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.startsWith("engine-draft-")) {
  throw new Error("Give a publishable idea slug with --slug=<slug>.");
}
const apply = args.includes("--apply");
const privatePaths = [value("--record="), value("--mdx="), value("--manifest=")];
const privateMode = privatePaths.some((source) => source !== undefined);
if (privateMode && privatePaths.some((source) => !source)) {
  throw new Error("Private submission requires --record=PATH, --mdx=PATH and --manifest=PATH together.");
}
const realRoot = await realpath(root);

function inside(parent, candidate) {
  const relative = path.relative(parent, candidate);
  return relative === "" || (relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative));
}

async function privateInput(source) {
  const resolved = await realpath(path.resolve(root, source));
  if (inside(realRoot, resolved) && !inside(path.join(realRoot, "tmp"), resolved)) {
    throw new Error("Private submission files must be outside the repository or under its ignored tmp/ directory.");
  }
  return readFile(resolved, "utf8");
}

const [recordJson, mdx, manifestText] = privateMode
  ? await Promise.all(privatePaths.map((source) => privateInput(source)))
  : await Promise.all([
      readFile(path.join(root, "engine/records", `${slug}.json`), "utf8"),
      readFile(path.join(root, "content/ideas", `${slug}.mdx`), "utf8"),
      readFile(path.join(root, "ideas/manifest.json"), "utf8"),
    ]);
let manifest;
try {
  manifest = JSON.parse(manifestText);
} catch {
  throw new Error("Manifest JSON is invalid.");
}
const candidates = Array.isArray(manifest?.ideas) ? manifest.ideas : [manifest];
const rows = candidates.filter((row) => row?.slug === slug);
if (rows.length !== 1) throw new Error("Exactly one matching manifest row is required.");
const manifestJson = JSON.stringify(rows[0]);

const outputDir = path.join(root, "tmp", "editorial-import");
await mkdir(outputDir, { recursive: true });
const outputPath = path.join(outputDir, "engine-validation.mjs");
await build({
  entryPoints: [path.join(root, "lib/editorial/engine/validated-artifact.ts")],
  outfile: outputPath,
  bundle: true,
  packages: "external",
  platform: "node",
  format: "esm",
  logLevel: "silent",
});
const { validateEngineSubmission } = await import(pathToFileURL(outputPath).href);
const validated = await validateEngineSubmission({ recordJson, mdx, manifestJson });
console.log(JSON.stringify({
  slug,
  source: privateMode ? "private-files" : "checked-in-baseline",
  submissionId: validated.envelope.submissionId,
  artifactHash: validated.envelope.artifactHash,
  recordHash: validated.recordHash,
  sourceCount: validated.envelope.sources.length,
  claimCount: validated.envelope.claims.length,
  action: apply ? "apply requested" : "dry run only",
}, null, 2));
if (!apply) process.exit(0);

if (value("--confirm-submission=") !== validated.envelope.artifactHash) {
  throw new Error("Import refused: --confirm-submission must match this dry run's exact artifact hash.");
}
const backupPath = value("--backup=");
if (!backupPath || !existsSync(backupPath)) {
  throw new Error("Import refused: provide a verified backend backup with --backup=PATH.");
}
const deploymentUrl = process.env.EDITORIAL_ENGINE_CONVEX_URL;
const adminKey = process.env.EDITORIAL_ENGINE_ADMIN_KEY;
const target = value("--target=");
if (
  !deploymentUrl ||
  !/^https:\/\/[a-z0-9-]+(?:\.[a-z0-9-]+)*\.convex\.cloud$/.test(deploymentUrl) ||
  !adminKey ||
  !target ||
  new URL(deploymentUrl).hostname.split(".")[0] !== target
) {
  throw new Error("Import refused: set the exact EDITORIAL_ENGINE_CONVEX_URL, EDITORIAL_ENGINE_ADMIN_KEY and --target deployment name.");
}

const client = new ConvexHttpClient(deploymentUrl);
client.setAdminAuth(adminKey);
const result = await client.action(internal.editorial.ingest.validateAndImport, { recordJson, mdx, manifestJson });
if (!result.ok || result.value.slugConflict) {
  throw new Error(`Import stopped: ${result.ok ? "slug conflict" : result.error.code}. No public page was changed.`);
}
console.log(JSON.stringify({
  deployment: target,
  slug,
  ideaId: result.value.ideaId,
  revisionId: result.value.revisionId,
  duplicate: result.value.duplicate,
  publicPageChanged: false,
}));
