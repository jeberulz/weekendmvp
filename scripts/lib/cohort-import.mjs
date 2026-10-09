/**
 * WP64-S7. Pure helpers for `scripts/membership-import-cohorts.mjs`. They
 * turn a private list of addresses into hashes and counts. Nothing here
 * prints, logs or returns an address.
 *
 * `normalizeCohortEmail` and `cohortEmailHash` repeat
 * `convex/platform/membership/cohortHash.ts`, and a test checks that both
 * give the same hash for the same address.
 */
import { createHash } from "node:crypto";

export const COHORTS = ["buyers", "newsletter"];
export const COHORT_HASH_PREFIX = "weekendmvp:offer-cohort:v1:";
/** Same as `MAX_COHORT_BATCH` in `convex/platform/membership/cohorts.ts`. */
export const BATCH_SIZE = 200;
/** A bigger file is almost certainly the wrong export. Split it on purpose. */
export const MAX_ADDRESSES = 50_000;

export function normalizeCohortEmail(value) {
  return value.normalize("NFKC").trim().toLowerCase();
}

export function cohortEmailHash(email) {
  return createHash("sha256").update(COHORT_HASH_PREFIX + normalizeCohortEmail(email)).digest("hex");
}

/** A plain shape check. Stripe and Beehiiv already validated these addresses. */
const EMAIL = /^[^\s@]{1,64}@[^\s@]+\.[^\s@]{2,}$/;

/**
 * One address per line, or a CSV whose first header cell or a header named
 * "email" holds them. Blank lines and a header row are skipped.
 */
export function parseAddresses(text) {
  const lines = text.split(/\r?\n/);
  const first = (lines[0] ?? "").split(",").map((cell) => cell.trim().replace(/^"|"$/g, "").toLowerCase());
  const hasHeader = first.length > 0 && !first.some((cell) => cell.includes("@"));
  const column = hasHeader ? Math.max(0, first.indexOf("email")) : 0;
  const rows = hasHeader ? lines.slice(1) : lines;
  const valid = new Set();
  let blank = 0;
  let invalid = 0;
  let duplicates = 0;
  for (const line of rows) {
    if (line.trim() === "") {
      blank += 1;
      continue;
    }
    const cell = (line.split(",")[column] ?? "").trim().replace(/^"|"$/g, "");
    const email = normalizeCohortEmail(cell);
    if (!EMAIL.test(email) || email.length > 320) {
      invalid += 1;
      continue;
    }
    if (valid.has(email)) duplicates += 1;
    else valid.add(email);
  }
  return { rows: rows.length - blank, valid: [...valid], invalid, duplicates };
}

/** Sorted unique hashes, so the same list always gives the same batch. */
export function hashAddresses(addresses) {
  return [...new Set(addresses.map(cohortEmailHash))].sort();
}

/** `{cohort}-{16 hex}`: a fingerprint of the whole hashed list. The operator confirms it. */
export function batchIdFor(cohort, hashes) {
  if (!COHORTS.includes(cohort)) throw new Error("Unknown cohort.");
  return `${cohort}-${createHash("sha256").update(hashes.join("\n")).digest("hex").slice(0, 16)}`;
}

export function chunk(items, size = BATCH_SIZE) {
  const out = [];
  for (let index = 0; index < items.length; index += size) out.push(items.slice(index, index + size));
  return out;
}
