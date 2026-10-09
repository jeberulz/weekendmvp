"use client";

import { CircleCheck, LoaderCircle } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { PLAN_CANCELLED, PLAN_RETURN_PARAM } from "@/app/api/platform/membership/_contract";
import { PLANS } from "@/convex/platform/plans";
import { CONFIRM_SLOW_AFTER_MS, type Entitlements } from "@/components/platform/plan/checkout";
import { formatDay } from "./CurrentPlan";

export type CancelReturnStatus = "confirming" | "slow" | "confirmed";

/**
 * Pure. Stripe sends the member back with `?plan=cancelled` only after they
 * confirm, but our page waits for the webhook to show the end date. Null when
 * there is no subscription left to describe.
 */
export function cancelReturnStatus(entitlements: Pick<Entitlements, "plan" | "billing">, slow: boolean): CancelReturnStatus | null {
  const term = entitlements.billing.term;
  if (entitlements.plan !== "builders_hub" || (term !== "monthly" && term !== "annual")) return null;
  if (entitlements.billing.endsAt !== null) return "confirmed";
  return slow ? "slow" : "confirming";
}

export function cancelReturnMessage(status: CancelReturnStatus, endsAt: number | null): string {
  if (status === "confirmed" && endsAt !== null) {
    return `Your plan is cancelled. You keep ${PLANS.builders_hub.name} until ${formatDay(endsAt)}. It won’t renew.`;
  }
  if (status === "slow") return "Stripe has your cancellation. This page updates as soon as it’s confirmed.";
  return "Confirming your cancellation with Stripe. This usually takes a few seconds.";
}

/** What the member sees back from Stripe's cancel page, above their plan. */
export function CancelReturn({ entitlements }: { entitlements: Entitlements }) {
  const back = useSearchParams().get(PLAN_RETURN_PARAM) === PLAN_CANCELLED;
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    if (!back) return;
    const timer = window.setTimeout(() => setSlow(true), CONFIRM_SLOW_AFTER_MS);
    return () => window.clearTimeout(timer);
  }, [back]);

  const status = back ? cancelReturnStatus(entitlements, slow) : null;
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
          className={
            status === "confirming"
              ? "mt-0.5 size-4 shrink-0 animate-spin motion-reduce:animate-none"
              : "mt-0.5 size-4 shrink-0 text-home-sage-ink"
          }
        />
      ) : null}
      <p>{cancelReturnMessage(status, entitlements.billing.endsAt)}</p>
    </div>
  );
}
