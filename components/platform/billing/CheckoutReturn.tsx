"use client";

import { CircleCheck, LoaderCircle } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { CHECKOUT_RETURN_PARAM, type CheckoutReturnState } from "@/app/api/platform/membership/_contract";
import { PLANS } from "@/convex/platform/plans";
import {
  CONFIRM_SLOW_AFTER_MS,
  checkoutReturnStatus,
  clearPendingCheckout,
  completionEvents,
  readPendingCheckout,
  type Entitlements,
  type ReturnStatus,
} from "@/components/platform/plan/checkout";
import { trackDashboardEvent } from "@/lib/track";

const MESSAGES: Record<ReturnStatus, string> = {
  confirming: "Confirming your payment. This usually takes a few seconds.",
  slow: "Your payment may still be processing. A receipt will be emailed to you, and your plan updates here as soon as the payment is confirmed.",
  confirmed: `Payment confirmed. Welcome to ${PLANS.builders_hub.name}.`,
  cancelled: "Checkout was cancelled. Nothing was charged.",
};

export function readReturnState(value: string | null): CheckoutReturnState | null {
  return value === "return" || value === "cancelled" ? value : null;
}

/**
 * WP63-S6. What the member sees back from Stripe. The URL only says they
 * came back. It never grants anything: the banner waits for
 * `entitlements.mine`, which updates live when the webhook lands.
 */
export function CheckoutReturn({ entitlements }: { entitlements: Entitlements }) {
  const state = readReturnState(useSearchParams().get(CHECKOUT_RETURN_PARAM));
  // Client only: this renders after the Convex query loads in the browser.
  const [pending] = useState(() => readPendingCheckout(Date.now()));
  const [slow, setSlow] = useState(false);
  const fired = useRef(false);

  useEffect(() => {
    if (state !== "return") return;
    const timer = window.setTimeout(() => setSlow(true), CONFIRM_SLOW_AFTER_MS);
    return () => window.clearTimeout(timer);
  }, [state]);

  useEffect(() => {
    if (state === "cancelled") clearPendingCheckout();
  }, [state]);

  const status = state ? checkoutReturnStatus({ state, entitlements, pending, slow }) : null;

  // Paid events fire once: the pending checkout is cleared before they go.
  useEffect(() => {
    if (status !== "confirmed" || fired.current) return;
    const events = completionEvents(pending, entitlements);
    if (events.length === 0) return;
    fired.current = true;
    clearPendingCheckout();
    for (const event of events) trackDashboardEvent(event);
  }, [status, pending, entitlements]);

  if (status === null) return null;
  const Icon = status === "confirmed" ? CircleCheck : status === "confirming" ? LoaderCircle : null;
  return (
    <div
      role="status"
      className="flex items-start gap-2.5 rounded-[12px] border border-home-rule bg-home-card px-4 py-3 text-[15px] text-home-ink"
    >
      {Icon ? (
        <Icon
          aria-hidden
          className={status === "confirming" ? "mt-0.5 size-4 shrink-0 animate-spin motion-reduce:animate-none" : "mt-0.5 size-4 shrink-0 text-home-sage-ink"}
        />
      ) : null}
      <p>{MESSAGES[status]}</p>
    </div>
  );
}
