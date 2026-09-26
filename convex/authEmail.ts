/** Canonical email identity shared by auth, subscriptions and HTTP enrollment. */
export function normalizeEmail(value: string): string {
  return value.normalize("NFKC").trim().toLowerCase();
}
