const ALPHABET = "abcdefghijklmnopqrstuvwxyz234567";

/**
 * Opaque editorial record key, e.g. `idea_k3f…`. 100 random bits, so keys
 * minted by concurrent transactions never collide and reveal no ordering or
 * count. Matches the Editorial DTO identifier pattern.
 */
export function randomKey(prefix: string, length = 20): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let suffix = "";
  for (const byte of bytes) suffix += ALPHABET[byte & 31];
  return `${prefix}_${suffix}`;
}
