"use client";

import { PLANS, PRICING, TERM_COPY, formatUsd } from "@/convex/platform/plans";
import type { Entitlements } from "@/components/platform/plan/checkout";
import { useBillingPortal } from "@/components/platform/plan/useMembershipCheckout";

const EYEBROW = "font-mono text-[11px] uppercase tracking-[0.08em] text-home-ink-3";
const HUB = PLANS.builders_hub.name;

function formatDay(ms: number): string {
  return new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric" }).format(ms);
}

export type PlanDescription = {
  title: string;
  detail: string | null;
  /** A payment problem only this member needs to act on. */
  notice: string | null;
  /** A Stripe subscription exists, so the Billing Portal (S5) can manage it. */
  manage: boolean;
};

const PRICE: Record<"monthly" | "annual", string> = {
  monthly: `${formatUsd(PRICING.monthly.amountMinor)} a month`,
  annual: `${formatUsd(PRICING.annual.amountMinor)} a year`,
};

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
    };
  }

  if (plan === "free") {
    if (subscription && billing.status === "canceled") {
      return {
        title: PLANS.free.name,
        detail: billing.endsAt === null ? `Your ${termName} plan has ended.` : `Your ${termName} plan ended on ${formatDay(billing.endsAt)}.`,
        notice: null,
        manage: false,
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
      };
    }
    return { title: PLANS.free.name, detail: "Nothing to pay on the Free plan.", notice: null, manage: false };
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
    };
  }
  if (term === "comp") {
    return { title: `${HUB}, complimentary`, detail: "Nothing to pay.", notice: null, manage: false };
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
    };
  }
  return { title: HUB, detail: null, notice: null, manage: false };
}

function ManageBilling() {
  const { state, open } = useBillingPortal();
  const pending = state.kind === "pending";
  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        aria-disabled={pending || undefined}
        onClick={() => {
          if (!pending) void open();
        }}
        className="inline-flex min-h-11 items-center justify-center self-start rounded-[9px] border border-home-ink bg-home-card px-4 text-sm font-medium text-home-ink transition-colors hover:bg-home-sunk focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-home-orange-ink aria-disabled:cursor-wait"
      >
        {pending ? "Opening billing…" : "Manage billing"}
      </button>
      {state.kind === "error" ? (
        <p role="alert" className="text-sm text-home-clay-ink">
          {state.message}
        </p>
      ) : null}
    </div>
  );
}

/** WP63-S6. The member's plan, its dates, any payment problem, and Manage billing for subscribers. */
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
        {description.manage ? <ManageBilling /> : null}
      </div>
    </section>
  );
}
