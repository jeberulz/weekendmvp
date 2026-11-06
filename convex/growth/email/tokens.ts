/** One-use opt-in and durable unsubscribe capabilities. Only hashes are stored. */
export type LeadTokenPurpose = "opt_in" | "unsubscribe";

const TOKEN_BYTES = 32;
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

/** Uses Web Crypto, available in Convex V8 and the Next runtime. */
export function newLeadToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(TOKEN_BYTES));
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

export function isLeadToken(value: unknown): value is string {
  return typeof value === "string" && TOKEN_PATTERN.test(value);
}

/** Purpose separation prevents a confirmation URL from acting as unsubscribe. */
export async function hashLeadToken(purpose: LeadTokenPurpose, token: string): Promise<string> {
  if (!isLeadToken(token)) throw new Error("INVALID_LEAD_TOKEN");
  const bytes = new TextEncoder().encode(`wp79:${purpose}:${token}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
