/**
 * Deterministic hashing for revision artifacts, review dependencies and
 * approvals. Uses Web Crypto so the same code runs in Node, the edge test
 * runtime and (if ever needed) the browser. Hashes establish identity, not
 * truth: a matching hash proves the bytes are the ones reviewed.
 */

type Canonicalizable =
  | string
  | number
  | boolean
  | null
  | undefined
  | readonly Canonicalizable[]
  | { readonly [key: string]: Canonicalizable };

/** JSON with sorted object keys; `undefined` object members are omitted. */
export function canonicalJson(value: Canonicalizable): string {
  if (value === null) return "null";
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("Cannot hash a non-finite number");
    return JSON.stringify(value);
  }
  if (value === undefined) throw new Error("Cannot hash undefined outside an object member");
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalJson(item === undefined ? null : item)).join(",")}]`;
  }
  const record = value as { readonly [key: string]: Canonicalizable };
  const keys = Object.keys(record)
    .filter((key) => record[key] !== undefined)
    .sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`).join(",")}}`;
}

export async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function hashCanonical(value: Canonicalizable): Promise<string> {
  return sha256Hex(canonicalJson(value));
}

export type { Canonicalizable };
