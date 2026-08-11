/**
 * Access logic for the playbook pack — the only email-gated part of a
 * playbook page.
 *
 * Deliberately NOT the `components/ideas/gate-access.ts` flow. That gate
 * hides a whole page body behind a blur overlay; here the framework itself
 * is free and server-rendered (it is the SEO/AEO and screenshot asset) and
 * only the extended pack is gated. So this module never blocks content, it
 * just answers "has this visitor already given us their email?".
 *
 * It reads BOTH existing subscriber markers so someone who unlocked an idea
 * page or grabbed the Starter Kit is never asked twice:
 *   - `weekendmvp_subscribed` — set by `components/forms/BeehiivSubscribeForm`
 *   - `ideas_email`           — set by `components/ideas/gate-access.ts`
 *
 * Browser-only: every function touches window/localStorage and must be called
 * from a client effect or handler, never during render.
 */

import {
  NEWSLETTER_PLACEHOLDER,
  STORAGE_KEY as IDEAS_STORAGE_KEY,
} from "@/components/ideas/gate-access";

/** Set by the Starter Kit / marketing subscribe form. */
export const SUBSCRIBED_FLAG_KEY = "weekendmvp_subscribed";

export const PLAYBOOK_UTM_CAMPAIGN = "playbook";

export function isValidEmail(email: unknown): email is string {
  return typeof email === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * Same-tab notification that access was just granted.
 *
 * The hero capture and the pack are sibling components with no shared React
 * state, and the `storage` event does not fire in the tab that wrote the
 * value. Without this, subscribing in the hero left the pack still asking
 * for an email until a reload.
 */
type AccessListener = () => void;
const listeners = new Set<AccessListener>();

/** Subscribe to grants. Returns an unsubscribe function for effect cleanup. */
export function onAccessGranted(listener: AccessListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Write both markers.
 *
 * Stores a sentinel rather than the address: `gate-access.ts` only checks
 * that the key is non-empty and never reads the value back, so keeping a
 * real email in localStorage would be storing PII for no purpose.
 */
function persistAccess(): void {
  try {
    localStorage.setItem(SUBSCRIBED_FLAG_KEY, "true");
    localStorage.setItem(IDEAS_STORAGE_KEY, NEWSLETTER_PLACEHOLDER);
  } catch {
    // Private-mode / blocked storage — the unlock still holds for this view.
  }
}

/** Persist the unlock and tell any mounted gated section about it. */
export function grantPackAccess(): void {
  persistAccess();
  listeners.forEach((listener) => listener());
}

/**
 * Has this visitor already subscribed?
 *
 * A `?utm_source=beehiiv` arrival is persisted on the spot, mirroring
 * `gate-access.ts`. Otherwise access would last only as long as the query
 * parameter stayed in the URL, and a later direct visit would ask a known
 * subscriber for their email again.
 *
 * Unlike the idea gate there is no localhost bypass and no `?e=` round trip:
 * nothing here is worth a network call, and a dev bypass would hide the
 * locked state we most need to look at while building.
 */
export function hasPackAccess(): boolean {
  try {
    if (localStorage.getItem(SUBSCRIBED_FLAG_KEY) === "true") return true;
    if (localStorage.getItem(IDEAS_STORAGE_KEY)) return true;
  } catch {
    // Storage unreadable — fall through to the query check.
  }

  try {
    const fromBeehiiv =
      new URLSearchParams(window.location.search).get("utm_source") ===
      "beehiiv";
    if (fromBeehiiv) persistAccess();
    return fromBeehiiv;
  } catch {
    return false;
  }
}
