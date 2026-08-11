/**
 * Access logic for the playbook pack — the only email-gated part of a
 * playbook page.
 *
 * Deliberately NOT the `components/ideas/gate-access.ts` flow. That gate
 * hides a whole page body behind a blur overlay; here the framework itself
 * is free and server-rendered (it is the SEO/AEO and screenshot asset) and
 * only the extended pack is gated. So this module never blocks content, it
 * just answers "has this visitor already given us their email anywhere on
 * the site?".
 *
 * It reads BOTH existing subscriber markers so someone who unlocked an idea
 * page or grabbed the Starter Kit is never asked twice:
 *   - `weekendmvp_subscribed` — set by `components/forms/BeehiivSubscribeForm`
 *   - `ideas_email`           — set by `components/ideas/gate-access.ts`
 *
 * Browser-only: every function touches window/localStorage and must be called
 * from a client effect or handler, never during render.
 */

import { STORAGE_KEY as IDEAS_STORAGE_KEY } from "@/components/ideas/gate-access";

/** Set by the Starter Kit / marketing subscribe form. */
export const SUBSCRIBED_FLAG_KEY = "weekendmvp_subscribed";

export const PLAYBOOK_UTM_CAMPAIGN = "playbook";

export function isValidEmail(email: unknown): email is string {
  return typeof email === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * Has this visitor already subscribed?
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
    // Private-mode / blocked storage: fall through to the query check.
  }

  try {
    // A click straight out of a Beehiiv email is already a subscriber.
    return new URLSearchParams(window.location.search).get("utm_source") ===
      "beehiiv";
  } catch {
    return false;
  }
}

/** Persist both markers so the unlock carries across every gated surface. */
export function grantPackAccess(email: string): void {
  try {
    localStorage.setItem(SUBSCRIBED_FLAG_KEY, "true");
    localStorage.setItem(IDEAS_STORAGE_KEY, email);
  } catch {
    // Storage unavailable — the unlock still holds for this page view.
  }
}
