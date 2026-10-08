"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { isStripeRedirect, type MembershipTerm } from "@/app/api/platform/membership/_contract";
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
 * WP63-S6. Starts Stripe-hosted Checkout for a term. One request at a time,
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

/** WP63-S6, for S5's route. Opens the Stripe Billing Portal for the member's own customer. */
export function useBillingPortal() {
  const [state, setState] = useState<RedirectState>({ kind: "idle" });
  const busy = useRef(false);
  const reset = useCallback(() => {
    busy.current = false;
    setState({ kind: "idle" });
  }, []);
  useResetOnRestore(reset);

  const open = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    setState({ kind: "pending" });
    const result = await requestPortal();
    if (!result.ok || !isStripeRedirect(result.url)) {
      busy.current = false;
      setState({ kind: "error", message: portalMessage(result.ok ? "UNKNOWN" : result.code) });
      return;
    }
    window.location.assign(result.url);
  }, []);

  return { state, open };
}
