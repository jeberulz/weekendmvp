/**
 * WP63-S7. How a founding-offer cohort stores an email: a SHA-256 of the
 * normalized address with a fixed prefix, never the address itself. The
 * operator import script hashes on the operator's machine, so no buyer or
 * newsletter address reaches Convex, a log or git.
 *
 * No imports on purpose: `scripts/membership-import-cohorts.mjs` repeats
 * these two functions, and a test checks both give the same hash.
 */

export const COHORT_HASH_PREFIX = "weekendmvp:offer-cohort:v1:";

/** Same rule as `normalizeEmail` in `convex/authEmail.ts`. */
export function normalizeCohortEmail(value: string): string {
  return value.normalize("NFKC").trim().toLowerCase();
}

/** Hex SHA-256 of the prefix and the normalized address. */
export async function cohortEmailHash(email: string): Promise<string> {
  const bytes = new TextEncoder().encode(COHORT_HASH_PREFIX + normalizeCohortEmail(email));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export const COHORT_HASH_PATTERN = /^[0-9a-f]{64}$/;
