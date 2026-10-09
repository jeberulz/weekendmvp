#!/usr/bin/env node

/**
 * WP63-S7. Imports a founding offer cohort (ship·able and DARE buyers, or
 * newsletter subscribers) from a private file. Dry run first, always:
 *
 *   npm run membership:import-cohorts -- --cohort=buyers --file=/private/buyers.csv
 *
 * The dry run prints counts and a batch id, never an address. Addresses are
 * hashed here, on the operator's machine, so Convex never receives one. The
 * file must sit outside the repository or under its ignored tmp/ directory.
 *
 * Applying needs the exact batch id from the dry run, a backend backup and
 * the exact target deployment, the same rules as `editorial-submit-engine.mjs`:
 *
 *   MEMBERSHIP_COHORT_CONVEX_URL=https://<name>.convex.cloud \
 *   MEMBERSHIP_COHORT_ADMIN_KEY=... \
 *   npm run membership:import-cohorts -- --cohort=buyers --file=... --apply \
 *     --confirm=<batch id> --backup=<path> --target=<name>
 *
 * Undo one import with `npx convex run platform/membership/cohorts:removeBatch`.
 */
import { ConvexHttpClient } from "convex/browser";
import { existsSync } from "node:fs";
import { readFile, realpath } from "node:fs/promises";
import path from "node:path";

import { internal } from "../convex/_generated/api.js";
import { COHORTS, MAX_ADDRESSES, batchIdFor, chunk, hashAddresses, parseAddresses } from "./lib/cohort-import.mjs";

const root = path.resolve(import.meta.dirname, "..");
const args = process.argv.slice(2);
const value = (prefix) => args.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);

function inside(parent, candidate) {
  const relative = path.relative(parent, candidate);
  return relative === "" || (relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative));
}

const cohort = value("--cohort=");
if (!COHORTS.includes(cohort)) throw new Error("Give --cohort=buyers or --cohort=newsletter.");
const file = value("--file=");
if (!file) throw new Error("Give the private list with --file=PATH.");

const realRoot = await realpath(root);
const resolved = await realpath(path.resolve(file));
if (inside(realRoot, resolved) && !inside(path.join(realRoot, "tmp"), resolved)) {
  throw new Error("The list must be outside the repository or under its ignored tmp/ directory.");
}

const parsed = parseAddresses(await readFile(resolved, "utf8"));
if (parsed.valid.length > MAX_ADDRESSES) throw new Error(`More than ${MAX_ADDRESSES} addresses. Split the file on purpose.`);
const hashes = hashAddresses(parsed.valid);
const batchId = hashes.length > 0 ? batchIdFor(cohort, hashes) : null;
const apply = args.includes("--apply");

console.log(
  JSON.stringify(
    {
      cohort,
      rows: parsed.rows,
      unique: hashes.length,
      duplicates: parsed.duplicates,
      invalid: parsed.invalid,
      batches: chunk(hashes).length,
      batchId,
      action: apply ? "apply requested" : "dry run only",
    },
    null,
    2,
  ),
);
if (!apply) process.exit(0);

if (batchId === null) throw new Error("Import refused: the list has no valid address.");
if (value("--confirm=") !== batchId) {
  throw new Error("Import refused: --confirm must match this dry run's exact batch id.");
}
const backupPath = value("--backup=");
if (!backupPath || !existsSync(backupPath)) {
  throw new Error("Import refused: provide a verified backend backup with --backup=PATH.");
}
const deploymentUrl = process.env.MEMBERSHIP_COHORT_CONVEX_URL;
const adminKey = process.env.MEMBERSHIP_COHORT_ADMIN_KEY;
const target = value("--target=");
if (
  !deploymentUrl ||
  !/^https:\/\/[a-z0-9-]+(?:\.[a-z0-9-]+)*\.convex\.cloud$/.test(deploymentUrl) ||
  !adminKey ||
  !target ||
  new URL(deploymentUrl).hostname.split(".")[0] !== target
) {
  throw new Error(
    "Import refused: set the exact MEMBERSHIP_COHORT_CONVEX_URL, MEMBERSHIP_COHORT_ADMIN_KEY and --target deployment name.",
  );
}

const client = new ConvexHttpClient(deploymentUrl);
client.setAdminAuth(adminKey);
let inserted = 0;
let existing = 0;
for (const emailHashes of chunk(hashes)) {
  const result = await client.mutation(internal.platform.membership.cohorts.importBatch, { cohort, batchId, emailHashes });
  inserted += result.inserted;
  existing += result.existing;
}
console.log(JSON.stringify({ deployment: target, cohort, batchId, inserted, existing }));
