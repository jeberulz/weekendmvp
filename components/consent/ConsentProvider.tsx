"use client";

import * as React from "react";

/**
 * Cookie-consent state, ported from the legacy `scripts.js` lines 1-33.
 *
 * Continuity (R9): uses the SAME localStorage key and JSON shape the legacy
 * site wrote — `analytics_consent` = `{"value": boolean, "timestamp": ms}` —
 * with a 365-day expiry, so returning visitors who already decided on the
 * old site are not re-prompted. Consent is also mirrored to an
 * `analytics_consent` cookie for server-side access, exactly like the legacy
 * `setConsent()`.
 */

const CONSENT_KEY = "analytics_consent";
const CONSENT_EXPIRY_DAYS = 365;
const CONSENT_EXPIRY_MS = CONSENT_EXPIRY_DAYS * 24 * 60 * 60 * 1000;
const CONSENT_COOKIE_MAX_AGE_SECONDS = CONSENT_EXPIRY_DAYS * 24 * 60 * 60;

/** Read + validate stored consent. Expired or malformed entries → null. */
function readStoredConsent(): boolean | null {
  try {
    const stored = window.localStorage.getItem(CONSENT_KEY);
    if (stored) {
      const parsed: unknown = JSON.parse(stored);
      if (
        typeof parsed === "object" &&
        parsed !== null &&
        typeof (parsed as { timestamp?: unknown }).timestamp === "number" &&
        Date.now() - (parsed as { timestamp: number }).timestamp <
          CONSENT_EXPIRY_MS
      ) {
        return (parsed as { value?: unknown }).value === true;
      }
    }
  } catch (e) {
    console.error("Error reading consent:", e);
  }
  return null;
}

/** Persist consent in the exact legacy format (localStorage + cookie). */
function writeStoredConsent(value: boolean): void {
  try {
    window.localStorage.setItem(
      CONSENT_KEY,
      JSON.stringify({ value, timestamp: Date.now() }),
    );
    document.cookie = `${CONSENT_KEY}=${value}; max-age=${CONSENT_COOKIE_MAX_AGE_SECONDS}; path=/; SameSite=Lax`;
  } catch (e) {
    console.error("Error saving consent:", e);
  }
}

type ConsentContextValue = {
  /** `null` = not yet decided (or not yet read after mount). */
  consent: boolean | null;
  setConsent: (value: boolean) => void;
};

const ConsentContext = React.createContext<ConsentContextValue>({
  consent: null,
  setConsent: () => {},
});

export function useConsent(): ConsentContextValue {
  return React.useContext(ConsentContext);
}

export function ConsentProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  // Always `null` during SSR/prerender; localStorage is read after mount.
  const [consent, setConsentState] = React.useState<boolean | null>(null);

  React.useEffect(() => {
    setConsentState(readStoredConsent());

    // Cross-tab sync: another tab changing (or clearing) consent updates us.
    const onStorage = (event: StorageEvent) => {
      if (event.key === CONSENT_KEY || event.key === null) {
        setConsentState(readStoredConsent());
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const setConsent = React.useCallback((value: boolean) => {
    setConsentState(value);
    writeStoredConsent(value);
  }, []);

  const contextValue = React.useMemo(
    () => ({ consent, setConsent }),
    [consent, setConsent],
  );

  return (
    <ConsentContext.Provider value={contextValue}>
      {children}
    </ConsentContext.Provider>
  );
}
