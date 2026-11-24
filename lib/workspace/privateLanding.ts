/** The private preview accepts reserved test mailboxes only. */
export function isPrivateTestAddress(email: string): boolean {
  return /^[a-z0-9][a-z0-9.+_-]{0,63}@example\.test$/i.test(email);
}
