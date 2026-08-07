/**
 * WP28-S5. Request validation for the tenant lead endpoint.
 *
 * Pure functions, no I/O, so the refusal rules are directly testable.
 *
 * The central rule comes from the owner ruling of 2026-08-07: WP28 stores no
 * real tenant lead. A request carrying personal data is **rejected with an
 * error**, never accepted-and-stripped. Silently discarding a visitor's email
 * would be worse than refusing it — the customer would believe capture was
 * working, and we would have accepted PII into a request log on the way to
 * throwing it away.
 */

/**
 * Field names that carry, or plausibly carry, personal data. Matching is on
 * the *key*, not the value: a key named `email` is refused even when empty,
 * because its presence means the caller believes this endpoint accepts one.
 */
const PERSONAL_DATA_KEYS = [
  "email",
  "e_mail",
  "emailaddress",
  "name",
  "firstname",
  "lastname",
  "fullname",
  "phone",
  "tel",
  "telephone",
  "mobile",
  "company",
  "message",
  "comment",
  "comments",
  "notes",
  "address",
  "postcode",
  "zip",
  "city",
  "country",
  "ip",
  "userid",
  "user_id",
] as const;

/** Anything that looks like an email address, in any value, anywhere. */
const EMAIL_SHAPE = /[^\s@]+@[^\s@]+\.[^\s@]+/;

/** Longer than this is free text, whatever the key is called. */
const MAX_VALUE_LENGTH = 40;

export type LeadRequestVerdict =
  | { ok: true }
  | { ok: false; status: number; code: string };

function normalizeKey(key: string): string {
  return key.toLowerCase().replace(/[\s_-]/g, "");
}

/**
 * Accepts only a body that carries no personal data at all.
 *
 * An empty object is the expected shape. Anything else is inspected rather
 * than trusted, because the frozen `leads` schema has optional `email` and
 * `payload` columns that a future change could start populating.
 */
export function validateLeadBody(body: unknown): LeadRequestVerdict {
  if (body === null || body === undefined) return { ok: true };
  if (typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, status: 400, code: "TENANT_LEAD_MALFORMED" };
  }

  const entries = Object.entries(body as Record<string, unknown>);
  if (entries.length > 8) {
    return { ok: false, status: 400, code: "TENANT_LEAD_MALFORMED" };
  }

  for (const [key, value] of entries) {
    if (PERSONAL_DATA_KEYS.includes(normalizeKey(key) as never)) {
      return {
        ok: false,
        status: 422,
        code: "TENANT_LEAD_PERSONAL_DATA_REFUSED",
      };
    }
    if (typeof value === "string") {
      if (EMAIL_SHAPE.test(value) || value.length > MAX_VALUE_LENGTH) {
        return {
          ok: false,
          status: 422,
          code: "TENANT_LEAD_PERSONAL_DATA_REFUSED",
        };
      }
    }
    // Nested objects are refused outright rather than walked: a recursive
    // scan is exactly where a bypass hides.
    if (typeof value === "object" && value !== null) {
      return { ok: false, status: 400, code: "TENANT_LEAD_MALFORMED" };
    }
  }

  return { ok: true };
}
