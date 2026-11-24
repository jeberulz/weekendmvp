"use client";

import { useEffect, useState } from "react";
import { useConsent } from "@/components/consent/ConsentProvider";
import { analyticsReady } from "@/lib/track";

const POLL_MS = 1_000;
const POLL_MAX = 15;

/**
 * True once analytics has loaded. The scripts load after the page is
 * interactive and only with consent, so this polls for a few seconds and then
 * stops. A change of consent (a tester accepting late) starts the polling again;
 * with no consent it simply stays false.
 */
export function useAnalyticsReady(): boolean {
  // Nothing is drawn from this value, so a server/client difference cannot cause a mismatch.
  const { consent } = useConsent();
  const [ready, setReady] = useState(analyticsReady);
  useEffect(() => {
    if (ready) return;
    let tries = 0;
    const timer = setInterval(() => {
      tries += 1;
      if (analyticsReady()) {
        setReady(true);
        clearInterval(timer);
      } else if (tries >= POLL_MAX) {
        clearInterval(timer);
      }
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [ready, consent]);
  return ready;
}
