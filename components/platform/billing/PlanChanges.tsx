"use client";

import { useQuery } from "convex/react";
import { useState } from "react";
import type { MembershipSwitchTerm } from "@/app/api/platform/membership/_contract";
import { api } from "@/convex/_generated/api";
import { ANNUAL_SAVING_LINE, PRICING, TERM_COPY, formatUsd } from "@/convex/platform/plans";
import { formatOpening, type Entitlements } from "@/components/platform/plan/checkout";
import { PurchaseFinePrint, lifetimeState, seatLine, type Seats } from "@/components/platform/plan/TermPicker";
import { useBillingPortal, useMembershipCheckout } from "@/components/platform/plan/useMembershipCheckout";
import { trackDashboardEvent } from "@/lib/track";
import { formatDay } from "./CurrentPlan";

const EYEBROW = "font-mono text-[11px] uppercase tracking-[0.08em] text-home-ink-3";
const PRIMARY =
  "inline-flex min-h-11 items-center justify-center self-start rounded-[9px] bg-home-ink px-4 text-center text-sm font-medium text-home-card transition-colors hover:bg-home-panel focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-home-orange-ink aria-disabled:cursor-wait aria-disabled:bg-home-panel";
const SECONDARY =
  "inline-flex min-h-11 items-center justify-center self-start rounded-[9px] border border-home-ink bg-home-card px-4 text-center text-sm font-medium text-home-ink transition-colors hover:bg-home-sunk focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-home-orange-ink aria-disabled:cursor-wait";

type SubscriptionTerm = "monthly" | "annual";

const PRICE: Record<SubscriptionTerm, string> = {
  monthly: `${formatUsd(PRICING.monthly.amountMinor)} a month`,
  annual: `${formatUsd(PRICING.annual.amountMinor)} a year`,
};

const PERIOD: Record<SubscriptionTerm, string> = { monthly: "month", annual: "year" };

export type SwitchOption = {
  to: MembershipSwitchTerm;
  name: string;
  price: string;
  saving: string | null;
  lines: string[];
  label: string;
};

export type LifetimeOption = {
  name: string;
  price: string;
  lines: string[];
  /** Why lifetime can't be bought right now, or null when it can. */
  unavailable: string | null;
  label: string;
  amount: number | undefined;
};

export type PlanChangeOptions = { switchTo: SwitchOption | null; lifetime: LifetimeOption | null };

/**
 * Pure: what an active monthly or annual member can change to, from the
 * server's summary and the seat counts only. Stripe still decides: the switch
 * opens Stripe's own confirmation with the amount, and lifetime goes through
 * Checkout. Null for everyone else (Free, comp, Founding Lifetime, a payment
 * problem or a dispute), who either has nothing to change or must fix billing first.
 */
export function describePlanChanges(
  entitlements: Pick<Entitlements, "plan" | "billing">,
  seats: Seats | undefined,
  now: number,
): PlanChangeOptions | null {
  const { plan, billing } = entitlements;
  const term = billing.term;
  if (plan !== "builders_hub" || billing.status !== "active" || (term !== "monthly" && term !== "annual")) return null;
  const current = TERM_COPY[term].name.toLowerCase();
  const renews = billing.renewsAt === null ? null : formatDay(billing.renewsAt);

  // A plan set to end has nothing to switch. Manage billing renews it first.
  let switchTo: SwitchOption | null = null;
  if (billing.endsAt === null) {
    switchTo =
      term === "monthly"
        ? {
            to: "annual",
            name: TERM_COPY.annual.name,
            price: PRICE.annual,
            saving: `${ANNUAL_SAVING_LINE}.`,
            lines: [
              "Switches now. You get credit for the unused part of this month.",
              "Stripe shows what you pay today before you confirm.",
            ],
            label: "Switch to annual",
          }
        : {
            to: "monthly",
            name: TERM_COPY.monthly.name,
            price: PRICE.monthly,
            saving: null,
            lines: [
              renews === null
                ? "Starts when your annual plan renews. You keep annual until then."
                : `Starts when your annual plan renews on ${renews}. You keep annual until then.`,
              "Stripe shows the change before you confirm.",
            ],
            label: "Switch to monthly",
          };
  }

  let lifetime: LifetimeOption | null = null;
  const seatState = lifetimeState(seats, now);
  if (seatState.shown && seats) {
    // O5: say before checkout what happens to the plan they already pay for.
    const stops =
      billing.endsAt !== null
        ? `Your ${current} plan already ends on ${formatDay(billing.endsAt)}.`
        : renews === null
          ? `Your ${current} plan then stops renewing, so you are not charged for it again.`
          : `Your ${current} plan then stops renewing, so you are not charged on ${renews}.`;
    lifetime = {
      name: TERM_COPY.lifetime.name,
      price: TERM_COPY.lifetime.short(seatState.amount),
      lines: [
        TERM_COPY.lifetime.terms(seatState.amount),
        seatLine(seats),
        stops,
        `The ${PERIOD[term]} you already paid for is not refunded automatically.`,
      ],
      unavailable: seatState.soldOut
        ? "Sold out"
        : seatState.opensAt !== null
          ? `Opens for you on ${formatOpening(seatState.opensAt)}`
          : null,
      // Already on Builder’s Hub, so the label says what changes, not "Upgrade".
      label: `Buy ${TERM_COPY.lifetime.name} · ${TERM_COPY.lifetime.short(seatState.amount)}`,
      amount: seatState.amount,
    };
  }

  if (!switchTo && !lifetime) return null;
  return { switchTo, lifetime };
}

function OptionCard({
  id,
  name,
  price,
  children,
}: {
  id: string;
  name: string;
  price: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-[12px] border border-home-rule bg-home-card p-4">
      <h3 id={`${id}-title`} className="text-[15px] font-medium text-home-ink">
        {name}
        <span className="font-normal text-home-ink-2"> · {price}</span>
      </h3>
      {children}
    </div>
  );
}

function Lines({ id, lines, saving }: { id: string; lines: string[]; saving?: string | null }) {
  return (
    <div id={id} className="flex flex-col gap-0.5 text-[13px] leading-[1.45] text-home-ink-2">
      {saving ? <p className="text-home-sage-ink">{saving}</p> : null}
      {lines.map((line) => (
        <p key={line}>{line}</p>
      ))}
    </div>
  );
}

function SwitchCard({ option }: { option: SwitchOption }) {
  const { state, open } = useBillingPortal();
  const pending = state.kind === "pending";
  const id = `switch-${option.to}`;
  return (
    <OptionCard id={id} name={option.name} price={option.price}>
      <Lines id={`${id}-terms`} lines={option.lines} saving={option.saving} />
      <button
        type="button"
        aria-disabled={pending || undefined}
        aria-describedby={`${id}-terms`}
        onClick={() => {
          if (pending) return;
          if (option.to === "annual") {
            trackDashboardEvent({ name: "upgrade_clicked", props: { surface: "billing", feature: "weekend_plan", term: "annual" } });
          }
          void open({ switchTo: option.to });
        }}
        className={SECONDARY}
      >
        {pending ? "Opening Stripe…" : option.label}
      </button>
      {state.kind === "error" ? (
        <p role="alert" className="text-sm text-home-clay-ink">
          {state.message}
        </p>
      ) : null}
    </OptionCard>
  );
}

function LifetimeCard({ option }: { option: LifetimeOption }) {
  const { state, start } = useMembershipCheckout("billing");
  const pending = state.kind === "pending";
  return (
    <OptionCard id="change-lifetime" name={option.name} price={option.price}>
      <Lines id="change-lifetime-terms" lines={option.lines} />
      {option.unavailable ? (
        <p className="text-sm font-medium text-home-ink">{option.unavailable}</p>
      ) : (
        <>
          <button
            type="button"
            aria-disabled={pending || undefined}
            aria-describedby="change-lifetime-terms change-lifetime-fine-print"
            onClick={() => {
              if (pending) return;
              trackDashboardEvent({ name: "upgrade_clicked", props: { surface: "billing", feature: "weekend_plan", term: "lifetime" } });
              void start("lifetime");
            }}
            className={PRIMARY}
          >
            {pending ? "Opening secure checkout…" : option.label}
          </button>
          <PurchaseFinePrint id="change-lifetime-fine-print" />
        </>
      )}
      {state.kind === "error" ? (
        <p role="alert" className="text-sm text-home-clay-ink">
          {state.message}
        </p>
      ) : null}
    </OptionCard>
  );
}

/**
 * The switch and lifetime options for an active monthly or annual member,
 * shown under their plan on Plan and billing. Plan management, not a sales
 * prompt, so the first-day quiet period does not apply. Renders nothing for
 * anyone else.
 */
export function PlanChanges({ entitlements }: { entitlements: Entitlements }) {
  const seats = useQuery(api.platform.membership.queries.ladder, {});
  // Browser-only (behind a Convex gate). Display only: checkout checks the window with the server clock.
  const [now] = useState(() => Date.now());
  const options = describePlanChanges(entitlements, seats, now);
  if (!options) return null;
  return (
    <section aria-labelledby="plan-changes-heading" className="flex flex-col gap-3">
      <h2 id="plan-changes-heading" className={EYEBROW}>
        Change your plan
      </h2>
      <div className="grid gap-3 border-t border-home-ink pt-3 md:grid-cols-2">
        {options.switchTo ? <SwitchCard option={options.switchTo} /> : null}
        {options.lifetime ? <LifetimeCard option={options.lifetime} /> : null}
      </div>
    </section>
  );
}
