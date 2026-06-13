/**
 * Shared email-gate access logic — a verbatim port of the ideas/gate.js
 * state machine, used by both the idea-page gate (components/ideas/
 * EmailGate.tsx) and the /startup-ideas gate (app/startup-ideas/
 * StartupIdeasGate.tsx).
 *
 * Browser-only: every function here touches window/localStorage and must be
 * called from client-component effects/handlers, never during render.
 *
 * Access resolution order (gate.js `resolveAccess`, + explicit localhost
 * bypass):
 *   1. localStorage 'ideas_email' present            → unlocked
 *   2. ?e=<email> → POST /api/ideas-verify, ok       → store + unlock
 *      (the ?e param is stripped via history.replaceState either way)
 *   3. ?utm_source=beehiiv                           → store '__newsletter__' + unlock
 *   4. hostname localhost / 127.0.0.1                → unlocked (dev bypass)
 *   5. otherwise                                     → locked (overlay + form)
 */

export const STORAGE_KEY = "ideas_email";
export const NEWSLETTER_PLACEHOLDER = "__newsletter__";

export function isValidEmail(email: unknown): email is string {
  return typeof email === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function isLocalhost(): boolean {
  return (
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1"
  );
}

/** Remove a query param without reloading (gate.js stripParam). */
export function stripParam(paramName: string) {
  try {
    const url = new URL(window.location.href);
    if (!url.searchParams.has(paramName)) return;
    url.searchParams.delete(paramName);
    const newSearch = url.searchParams.toString();
    const newUrl =
      url.pathname + (newSearch ? "?" + newSearch : "") + url.hash;
    window.history.replaceState({}, "", newUrl);
  } catch {
    /* ignore */
  }
}

/** gate.js verifyEmailWithBeehiiv: localhost is trusted, else /api/ideas-verify. */
export async function verifyEmailWithBeehiiv(email: string): Promise<boolean> {
  if (isLocalhost()) return true;
  try {
    const res = await fetch("/api/ideas-verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    if (!res.ok) return false;
    const data = (await res.json()) as { ok?: boolean };
    return data?.ok === true;
  } catch {
    return false;
  }
}

export async function resolveAccess(): Promise<boolean> {
  // 1. Already unlocked on this device.
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) return true;

  const params = new URLSearchParams(window.location.search);
  const emailParam = params.get("e");
  const isBeehiivClick = params.get("utm_source") === "beehiiv";

  // 2. Newsletter deep link with ?e=<email> — verify against Beehiiv.
  if (emailParam && isValidEmail(emailParam)) {
    const ok = await verifyEmailWithBeehiiv(emailParam);
    stripParam("e");
    if (ok) {
      localStorage.setItem(STORAGE_KEY, emailParam);
      return true;
    }
  }

  // 3. Trusted Beehiiv click without the email param.
  if (isBeehiivClick) {
    localStorage.setItem(STORAGE_KEY, NEWSLETTER_PLACEHOLDER);
    return true;
  }

  // 4. Local development bypass.
  if (isLocalhost()) return true;

  // 5. Locked.
  return false;
}

/**
 * gate.js handleFormSubmit network step: POST /api/ideas-subscribe (skipped
 * on localhost) then persist the email. Throws on failure.
 */
export async function subscribeToIdeas(
  email: string,
  firstName: string,
): Promise<void> {
  if (!isLocalhost()) {
    const response = await fetch("/api/ideas-subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, first_name: firstName }),
    });
    const data = (await response.json().catch(() => ({}))) as {
      success?: boolean;
      error?: string;
    };
    if (!response.ok && !data.success) {
      throw new Error(data.error || "Failed to subscribe");
    }
  }
  localStorage.setItem(STORAGE_KEY, email);
}
