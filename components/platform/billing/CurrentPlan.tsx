"use client";

import { PLANS, PRICING, TERM_COPY, formatUsd } from "@/convex/platform/plans";
import type { MembershipPortalIntent } from "@/app/api/platform/membership/_contract";
import type { Entitlements } from "@/components/platform/plan/checkout";
import { useBillingPortal } from "@/components/platform/plan/useMembershipCheckout";

const EYEBROW = "font-mono text-[11px] uppercase tracking-[0.08em] text-home-ink-3";
const HUB = PLANS.builders_hub.name;

export function formatDay(ms: number): string {
  return new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric" }).format(ms);
}

export type PlanDescription = {
  title: string;
  detail: string | null;
  /** A payment problem only this member needs to act on. */
  notice: string | null;
  /** A Stripe subscription exists, so the Billing Portal (S5) can manage it. */
  manage: boolean;
  /** What cancelling does, for a plan that still renews. Null when there is nothing to cancel. */
  cancel: string | null;
  /** How to keep a plan that is set to end. Null otherwise. */
  renew: string | null;
};

const PRICE: Record<"monthly" | "annual", string> = {
  monthly: `${formatUsd(PRICING.monthly.amountMinor)} a month`,
  annual: `${formatUsd(PRICING.annual.amountMinor)} a year`,
};

const running = (status: Entitlements["billing"]["status"]) => status === "active" || status === "past_due";

/**
 * Cancelling ends the plan at the end of the paid period (the portal
 * configuration). An active plan has nothing left to pay, so it is never
 * charged again. A past-due plan still has an open invoice, so it only
 * promises the renewal stops.
 */
function cancelLine(billing: Entitlements["billing"]): string | null {
  if (billing.endsAt !== null || !running(billing.status)) return null;
  if (billing.status === "past_due") return "Cancelling stops your plan renewing. Stripe shows the end date before you confirm.";
  const until = billing.renewsAt === null ? "the end of the period you paid for" : formatDay(billing.renewsAt);
  return `Cancel any time. You keep ${HUB} until ${until}. It won’t renew, so you won’t be charged again.`;
}

/** Pure: what Plan and billing says about the member's plan, from the server's summary only. */
export function describePlan(entitlements: Pick<Entitlements, "plan" | "billing">): PlanDescription {
  const { plan, billing } = entitlements;
  const term = billing.term;
  const subscription = term === "monthly" || term === "annual" ? term : null;
  const termName = subscription ? TERM_COPY[subscription].name.toLowerCase() : "";

  if (billing.status === "suspended") {
    return {
      title: `${HUB} is paused`,
      detail: "Access is paused while a payment dispute is open. It comes back if the dispute closes in your favor.",
      notice: null,
      manage: false,
      cancel: null,
      renew: null,
    };
  }

  if (plan === "free") {
    if (subscription && billing.status === "canceled") {
      return {
        title: PLANS.free.name,
        detail: billing.endsAt === null ? `Your ${termName} plan has ended.` : `Your ${termName} plan ended on ${formatDay(billing.endsAt)}.`,
        notice: null,
        manage: false,
        cancel: null,
        renew: null,
      };
    }
    if (subscription && (billing.status === "unpaid" || billing.status === "paused")) {
      return {
        title: PLANS.free.name,
        detail: null,
        notice:
          billing.status === "unpaid"
            ? `Your ${termName} plan is on hold because a payment didn’t go through. Update your payment method to restart it.`
            : `Your ${termName} plan is paused.`,
        manage: true,
        cancel: null,
        renew: null,
      };
    }
    return { title: PLANS.free.name, detail: "Nothing to pay on the Free plan.", notice: null, manage: false, cancel: null, renew: null };
  }

  if (term === "lifetime") {
    const seat = billing.foundingSeat;
    return {
      title: `${HUB}, ${TERM_COPY.lifetime.name}`,
      detail:
        seat === null
          ? "Nothing more to pay."
          : `Founding member, seat ${seat} of ${PRICING.lifetime.seats}. Nothing more to pay.`,
      notice: null,
      manage: false,
      cancel: null,
      renew: null,
    };
  }
  if (term === "comp") {
    return { title: `${HUB}, complimentary`, detail: "Nothing to pay.", notice: null, manage: false, cancel: null, renew: null };
  }
  if (subscription) {
    const when =
      billing.endsAt !== null
        ? `Set to end on ${formatDay(billing.endsAt)}. You keep access until then.`
        : billing.renewsAt !== null
          ? `Renews on ${formatDay(billing.renewsAt)}.`
          : "Renews until you cancel.";
    return {
      title: `${HUB}, ${termName}`,
      detail: `${PRICE[subscription]}. ${when}`,
      notice:
        billing.status === "past_due"
          ? `Your last payment didn’t go through. Update your payment method to keep ${HUB}.`
          : null,
      manage: true,
      cancel: cancelLine(billing),
      renew:
        billing.endsAt !== null && running(billing.status)
          ? `Changed your mind? Renew before ${formatDay(billing.endsAt)} and your plan carries on as before.`
          : null,
    };
  }
  return { title: HUB, detail: null, notice: null, manage: false, cancel: null, renew: null };
}

const SECONDARY =
  "inline-flex min-h-11 items-center justify-center self-start rounded-[9px] border border-home-ink bg-home-card px-4 text-sm font-medium text-home-ink transition-colors hover:bg-home-sunk focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-home-orange-ink aria-disabled:cursor-wait";

/** One Billing Portal button with its own pending and error state. */
function PortalButton({
  label,
  pendingLabel,
  intent,
  describedBy,
}: {
  label: string;
  pendingLabel: string;
  intent?: MembershipPortalIntent;
  describedBy?: string;
}) {
  const { state, open } = useBillingPortal();
  const pending = state.kind === "pending";
  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        aria-disabled={pending || undefined}
        aria-describedby={describedBy}
        onClick={() => {
          if (!pending) void open(intent);
        }}
        className={SECONDARY}
      >
        {pending ? pendingLabel : label}
      </button>
      {state.kind === "error" ? (
        <p role="alert" className="text-sm text-home-clay-ink">
          {state.message}
        </p>
      ) : null}
    </div>
  );
}

/**
 * WP64-S6. The member's plan, its dates, any payment problem, and for
 * subscribers Manage billing, Cancel plan (Stripe's cancel page, one
 * confirmation) or Renew plan once it is set to end.
 */
export function CurrentPlan({ entitlements }: { entitlements: Entitlements }) {
  const description = describePlan(entitlements);
  return (
    <section aria-labelledby="current-plan-heading" className="flex flex-col gap-3">
      <h2 id="current-plan-heading" className={EYEBROW}>
        Your plan
      </h2>
      <div className="flex flex-col gap-3 border-t border-home-ink pt-3">
        <p className="font-editorial text-[22px] leading-[1.2] text-home-ink">{description.title}</p>
        {description.detail ? <p className="text-[15px] text-home-ink-2">{description.detail}</p> : null}
        {description.notice ? (
          <p className="rounded-[10px] bg-home-ochre px-3 py-2 text-[15px] text-home-ochre-ink">{description.notice}</p>
        ) : null}
        {description.manage ? (
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-start gap-3">
              <PortalButton label="Manage billing" pendingLabel="Opening billing…" />
              {description.cancel ? (
                <PortalButton
                  label="Cancel plan"
                  pendingLabel="Opening Stripe…"
                  intent={{ cancel: true }}
                  describedBy="cancel-plan-terms"
                />
              ) : null}
              {description.renew ? (
                <PortalButton label="Renew plan" pendingLabel="Opening Stripe…" describedBy="renew-plan-terms" />
              ) : null}
            </div>
            {description.cancel ? (
              <p id="cancel-plan-terms" className="text-[13px] leading-[1.45] text-home-ink-2">
                {description.cancel}
              </p>
            ) : null}
            {description.renew ? (
              <p id="renew-plan-terms" className="text-[13px] leading-[1.45] text-home-ink-2">
                {description.renew}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}
