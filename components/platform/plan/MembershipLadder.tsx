"use client";

import { useQuery } from "convex/react";
import { useState } from "react";
import type { MembershipTerm } from "@/app/api/platform/membership/_contract";
import { api } from "@/convex/_generated/api";
import { PLANS, upgradeLabel } from "@/convex/platform/plans";
import { trackDashboardEvent } from "@/lib/track";
import { cn } from "@/lib/utils";
import { PurchaseFinePrint, TermPicker, lifetimeState } from "./TermPicker";
import { useMembershipCheckout } from "./useMembershipCheckout";

const BUTTON =
  "inline-flex min-h-11 items-center justify-center rounded-[9px] bg-home-ink px-5 text-center text-sm font-medium text-home-card transition-colors hover:bg-home-panel focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-home-orange-ink aria-disabled:cursor-wait aria-disabled:bg-home-panel";

/**
 * WP64-S6, PRD 6.6 surface 4. The ladder on Plan and billing: monthly and
 * annual side by side, Founding Lifetime below with the true seats left.
 * Free members only, after the first day (the caller checks). The button
 * starts Stripe-hosted Checkout. Only a verified webhook grants the plan.
 */
export function MembershipLadder() {
  const seats = useQuery(api.platform.membership.queries.ladder, {});
  const [term, setTerm] = useState<MembershipTerm>("monthly");
  // Browser-only (behind a Convex gate). Display only: checkout checks the window with the server clock.
  const [now] = useState(() => Date.now());
  const { state, start } = useMembershipCheckout("billing");
  const pending = state.kind === "pending";
  const lifetime = lifetimeState(seats, now);
  const hub = PLANS.builders_hub;

  return (
    <section
      id="builders-hub"
      aria-labelledby="builders-hub-title"
      className="flex scroll-mt-24 flex-col gap-5 rounded-[14px] border border-home-rule bg-home-sunk p-5 sm:p-6"
    >
      <div className="flex flex-col gap-1.5">
        <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-home-ink-3">{hub.priceLabel}</p>
        <h2 id="builders-hub-title" className="font-editorial text-[26px] font-normal leading-[1.15] text-home-ink">
          {hub.name}
        </h2>
        <p className="text-[15px] text-home-ink-2">{hub.adds.join(". ")}.</p>
      </div>

      <TermPicker name="ladder-term" value={term} onChange={setTerm} seats={seats} now={now} />

      <div className="flex flex-col gap-3 md:flex-row md:items-start md:gap-6">
        <button
          type="button"
          aria-disabled={pending || undefined}
          aria-describedby="ladder-fine-print"
          onClick={() => {
            if (pending) return;
            trackDashboardEvent({ name: "upgrade_clicked", props: { surface: "billing", feature: "weekend_plan", term } });
            void start(term);
          }}
          className={cn(BUTTON, "md:shrink-0")}
        >
          {pending ? "Opening secure checkout…" : upgradeLabel(term, lifetime.amount)}
        </button>
        <PurchaseFinePrint id="ladder-fine-print" />
      </div>

      {state.kind === "error" ? (
        <p role="alert" className="text-sm text-home-clay-ink">
          {state.message}
        </p>
      ) : null}
    </section>
  );
}
