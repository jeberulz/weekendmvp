/**
 * WP44-S6. An anonymous reader who clicks Save on `/ideas/{slug}` signs up
 * first. The idea waits here, in this browser only, until the dashboard
 * completes the save after sign-in. Nothing goes in the URL, so a crafted
 * link can never save an idea on someone's behalf.
 */

export const PENDING_SAVE_KEY = "wmvp:pending-save";
/** Long enough to confirm an emailed sign-in link. */
export const PENDING_SAVE_TTL_MS = 2 * 60 * 60 * 1000;
/** Where the sign-up flow returns. It is inside the existing auth allowlist. */
export const PENDING_SAVE_RETURN = "/dashboard/saved";

export type PendingSave = { slug: string; title: string; at: number };

const SLUG = /^[a-z0-9][a-z0-9-]{0,119}$/;

export function isIdeaSlug(value: unknown): value is string {
  return typeof value === "string" && SLUG.test(value);
}

export function signupForPendingSave() {
  return `/signup?returnTo=${encodeURIComponent(PENDING_SAVE_RETURN)}`;
}

type Storage = Pick<globalThis.Storage, "getItem" | "setItem" | "removeItem">;

export function stashPendingSave(storage: Storage, save: PendingSave) {
  if (!isIdeaSlug(save.slug)) return;
  try {
    storage.setItem(
      PENDING_SAVE_KEY,
      JSON.stringify({ slug: save.slug, title: save.title.slice(0, 200), at: save.at }),
    );
  } catch {
    // Blocked storage: sign-up still works, the member saves by hand after.
  }
}

/** Reads and clears the pending save. Stale or malformed entries return null. */
export function takePendingSave(storage: Storage, now: number): PendingSave | null {
  let raw: string | null = null;
  try {
    raw = storage.getItem(PENDING_SAVE_KEY);
    storage.removeItem(PENDING_SAVE_KEY);
  } catch {
    return null;
  }
  if (raw === null) return null;
  try {
    const value = JSON.parse(raw) as Partial<PendingSave>;
    if (
      !isIdeaSlug(value.slug) ||
      typeof value.title !== "string" ||
      typeof value.at !== "number" ||
      now - value.at > PENDING_SAVE_TTL_MS ||
      value.at > now + 60_000
    ) {
      return null;
    }
    return { slug: value.slug, title: value.title, at: value.at };
  } catch {
    return null;
  }
}
