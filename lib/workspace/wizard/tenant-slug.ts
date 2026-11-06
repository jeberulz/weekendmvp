/**
 * WP74-S4: the tenant slug a new business gets from its chosen name.
 *
 * - Normalised with C-WIZARD `nameSubdomainSlug` (diacritics stripped,
 *   lowercase, runs of other characters collapsed to one `-`).
 * - Length-bounded: the base is cut to `TENANT_SLUG_BASE_MAX` so a suffix still
 *   fits the 63-character DNS label.
 * - A base shorter than the 3-character minimum gets `-business` appended; a
 *   name with no Latin letters or digits becomes `business`.
 * - Collisions and reserved names are suffixed in order: `base`, `base-2`,
 *   `base-3` … up to `TENANT_SLUG_MAX_ATTEMPTS`. The same inputs always give
 *   the same slug.
 *
 * Pure apart from the injected `isTaken` check.
 */
import { TENANT_SLUG_MIN_LENGTH, isValidTenantSlug } from "../../tenant-host";
import { nameSubdomainSlug } from "../contracts/wizard";

export const TENANT_SLUG_BASE_MAX = 48;
export const TENANT_SLUG_MAX_ATTEMPTS = 50;
export const TENANT_SLUG_FALLBACK = "business";

/** The unsuffixed slug for a business name. Always a valid label shape (it may still be reserved). */
export function tenantSlugBase(name: string): string {
  const base = nameSubdomainSlug(name).slice(0, TENANT_SLUG_BASE_MAX).replace(/-+$/, "");
  if (base.length >= TENANT_SLUG_MIN_LENGTH) return base;
  return base.length > 0 ? `${base}-${TENANT_SLUG_FALLBACK}` : TENANT_SLUG_FALLBACK;
}

/** Attempt `n` (1-based): the base itself, then `base-2`, `base-3` … */
export function tenantSlugCandidate(base: string, attempt: number): string {
  return attempt <= 1 ? base : `${base}-${attempt}`;
}

/**
 * The first candidate that is a valid, unreserved label and not taken, or
 * null when every attempt is used up.
 */
export async function pickTenantSlug(
  name: string,
  isTaken: (slug: string) => Promise<boolean>,
): Promise<string | null> {
  const base = tenantSlugBase(name);
  for (let attempt = 1; attempt <= TENANT_SLUG_MAX_ATTEMPTS; attempt += 1) {
    const candidate = tenantSlugCandidate(base, attempt);
    if (!isValidTenantSlug(candidate)) continue;
    if (!(await isTaken(candidate))) return candidate;
  }
  return null;
}
