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

export type PendingSave = { slug: string; title: string; at: number; attempts?: number };

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

/** Read without consuming: a reload can retry a failed save. */
export function readPendingSave(storage: Storage, now: number): PendingSave | null {
  let raw: string | null;
  try { raw = storage.getItem(PENDING_SAVE_KEY); } catch { return null; }
  return parsePendingSave(raw, now);
}

function parsePendingSave(raw: string | null, now: number): PendingSave | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<PendingSave>;
    if (!isIdeaSlug(value.slug) || typeof value.title !== "string" || typeof value.at !== "number" ||
      !Number.isFinite(value.at) || now - value.at > PENDING_SAVE_TTL_MS || value.at > now + 60_000) return null;
    return { slug: value.slug, title: value.title.slice(0, 200), at: value.at,
      attempts: typeof value.attempts === "number" && Number.isInteger(value.attempts) && value.attempts >= 0 ? value.attempts : 0 };
  } catch { return null; }
}

/** Only the first attempt is automatic. After failure, confirm the destination account. */
export const PENDING_SAVE_MAX_ATTEMPTS = 1;

/** Never consume an idea saved in another tab while this request was pending. */
export function acknowledgePendingSave(storage: Storage, save: PendingSave, now: number) {
  const current = readPendingSave(storage, now);
  if (current?.slug !== save.slug || current.at !== save.at) return;
  try { storage.removeItem(PENDING_SAVE_KEY); } catch { /* Storage can be blocked. */ }
}

export function recordPendingSaveAttempt(storage: Storage, save: PendingSave, now: number): PendingSave | null {
  // Storage errors are failures, not evidence that another tab replaced it.
  const current = parsePendingSave(storage.getItem(PENDING_SAVE_KEY), now);
  if (current?.slug !== save.slug || current.at !== save.at) return null;
  const next = { ...current, attempts: (current.attempts ?? 0) + 1 };
  storage.setItem(PENDING_SAVE_KEY, JSON.stringify(next));
  return next;
}

/** Persist only the still-current intent; failure deliberately retains it. */
export async function persistPendingSave(storage: Storage, save: PendingSave, now: number, write: (slug: string) => Promise<unknown>): Promise<"saved" | "replaced"> {
  if (!recordPendingSaveAttempt(storage, save, now)) return "replaced";
  await write(save.slug);
  acknowledgePendingSave(storage, save, now);
  return "saved";
}
