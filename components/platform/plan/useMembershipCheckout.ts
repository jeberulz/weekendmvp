"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { isStripeRedirect, type MembershipSwitchTerm, type MembershipTerm } from "@/app/api/platform/membership/_contract";
import { trackDashboardEvent } from "@/lib/track";
import {
  checkoutMessage,
  newIdempotencyKey,
  portalMessage,
  rememberPendingCheckout,
  requestCheckout,
  requestPortal,
} from "./checkout";

export type RedirectState =
  | { kind: "idle" }
  | { kind: "pending"; term?: MembershipTerm }
  | { kind: "error"; message: string };

/** Back from Stripe through the browser cache, the page was frozen mid-redirect. Unfreeze it. */
function useResetOnRestore(reset: () => void) {
  useEffect(() => {
    const onShow = (event: PageTransitionEvent) => {
      if (event.persisted) reset();
    };
    window.addEventListener("pageshow", onShow);
    return () => window.removeEventListener("pageshow", onShow);
  }, [reset]);
}

/**
 * WP64-S6. Starts Stripe-hosted Checkout for a term. One request at a time,
 * one idempotency key per term for the life of the page, and a redirect only
 * to a Stripe URL. Nothing here grants anything.
 */
export function useMembershipCheckout(surface: "sheet" | "billing") {
  const [state, setState] = useState<RedirectState>({ kind: "idle" });
  const busy = useRef(false);
  const keys = useRef(new Map<MembershipTerm, string>());
  const reset = useCallback(() => {
    busy.current = false;
    setState({ kind: "idle" });
  }, []);
  useResetOnRestore(reset);

  const start = useCallback(
    async (term: MembershipTerm) => {
      if (busy.current) return;
      busy.current = true;
      setState({ kind: "pending", term });
      let key = keys.current.get(term);
      if (!key) {
        key = newIdempotencyKey();
        keys.current.set(term, key);
      }
      const result = await requestCheckout(term, key);
      if (!result.ok || !isStripeRedirect(result.url)) {
        busy.current = false;
        // WP64-S3: the server refuses a key it can no longer continue (a lapsed
        // seat hold, a day-old order), so the next click starts a fresh attempt.
        if (!result.ok && result.code === "INVALID_REQUEST") keys.current.delete(term);
        setState({ kind: "error", message: checkoutMessage(result.ok ? "UNKNOWN" : result.code, result.ok ? undefined : result.opensAt) });
        return;
      }
      rememberPendingCheckout(term, Date.now());
      trackDashboardEvent({ name: "checkout_started", props: { surface, term } });
      window.location.assign(result.url);
    },
    [surface],
  );

  return { state, start };
}

/**
 * WP64-S6, for S5's route. Opens the Stripe Billing Portal for the member's
 * own customer, or with `switchTo`, Stripe's confirmation for that plan switch.
 */
export function useBillingPortal() {
  const [state, setState] = useState<RedirectState>({ kind: "idle" });
  const busy = useRef(false);
  const reset = useCallback(() => {
    busy.current = false;
    setState({ kind: "idle" });
  }, []);
  useResetOnRestore(reset);

  const open = useCallback(async (switchTo?: MembershipSwitchTerm) => {
    if (busy.current) return;
    busy.current = true;
    setState({ kind: "pending" });
    const result = await requestPortal(fetch, switchTo);
    if (!result.ok || !isStripeRedirect(result.url)) {
      busy.current = false;
      setState({ kind: "error", message: portalMessage(result.ok ? "UNKNOWN" : result.code) });
      return;
    }
    window.location.assign(result.url);
  }, []);

  return { state, open };
}
