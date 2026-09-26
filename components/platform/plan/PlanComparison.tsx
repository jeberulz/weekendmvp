"use client";

import { useEffect, useRef } from "react";
import { BILLING_COMPARISON, PLANS, type PlanId } from "@/convex/platform/plans";
import { ModuleSkeleton, PersonalModule } from "@/components/platform/home/module-states";
import { trackDashboardEvent } from "@/lib/track";
import { cn } from "@/lib/utils";
import { useUpsell } from "./useUpsell";

const EYEBROW = "font-mono text-[11px] uppercase tracking-[0.08em] text-home-ink-3";

function CurrentLabel() {
  return (
    <span className="mt-1 inline-flex h-5 items-center rounded-full bg-home-ink px-1.5 align-middle font-mono text-[10px] uppercase tracking-[0.08em] text-home-card sm:ml-2 sm:mt-0">
      <span className="sr-only">, </span>
      Current plan
    </span>
  );
}

function PlanHeader({ id, current }: { id: PlanId; current: PlanId }) {
  return (
    <th scope="col" className={cn("w-[34%] px-2.5 py-3 align-bottom font-normal sm:px-3", id === current && "bg-home-sunk")}>
      <span className="block font-editorial text-[18px] leading-tight text-home-ink sm:inline sm:text-[20px]">
        {PLANS[id].name}
      </span>
      {id === current && <CurrentLabel />}
    </th>
  );
}

function LiveComparison() {
  const { entitlements, sheetAllowed } = useUpsell();
  const viewed = useRef(false);

  useEffect(() => {
    if (!sheetAllowed || viewed.current) return;
    viewed.current = true;
    trackDashboardEvent({ name: "upgrade_prompt_viewed", props: { surface: "billing", feature: "weekend_plan" } });
  }, [sheetAllowed]);

  if (!entitlements) return <ModuleSkeleton label="Loading your plan" className="h-[420px]" />;
  const current = entitlements.plan;
  const hub = PLANS.builders_hub;

  return (
    <div className="flex flex-col gap-8">
      {/* Wraps instead of scrolling sideways, so phones need no scroll region. */}
      <div className="rounded-[14px] border border-home-rule bg-home-card">
        <table className="w-full table-fixed border-collapse text-left text-[13px] sm:text-sm">
          <caption className="sr-only">
            {PLANS.free.name} compared with {hub.name}. Your current plan is {PLANS[current].name}.
          </caption>
          <thead>
            <tr className="border-b border-home-ink">
              <th scope="col" className={cn("px-2.5 py-3 align-bottom font-normal sm:px-3", EYEBROW)}>
                What you get
              </th>
              <PlanHeader id="free" current={current} />
              <PlanHeader id="builders_hub" current={current} />
            </tr>
          </thead>
          <tbody>
            {BILLING_COMPARISON.map((row) => (
              <tr key={row.label} className="border-b border-home-rule last:border-b-0 align-top">
                <th scope="row" className="break-words px-2.5 py-3 font-medium text-home-ink sm:px-3">
                  {row.label}
                </th>
                <td className={cn("px-2.5 py-3 text-home-ink-2 sm:px-3", current === "free" && "bg-home-sunk")}>
                  {row.free}
                </td>
                <td className={cn("px-2.5 py-3 text-home-ink sm:px-3", current === "builders_hub" && "bg-home-sunk")}>
                  {row.hub}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {current === "free" ? (
        <section
          id="builders-hub"
          aria-labelledby="builders-hub-title"
          className="flex scroll-mt-24 flex-col gap-2 rounded-[14px] border border-home-rule bg-home-sunk p-5 sm:p-6"
        >
          <p className={EYEBROW}>{hub.priceLabel}</p>
          <h2 id="builders-hub-title" className="font-editorial text-[26px] font-normal leading-[1.15] text-home-ink">
            {hub.name}
          </h2>
          <p className="text-[15px] text-home-ink-2">Not open yet. You will be able to upgrade here.</p>
        </section>
      ) : null}

      <section aria-labelledby="billing-heading">
        <h2 id="billing-heading" className={EYEBROW}>
          Billing
        </h2>
        <p className="mt-2 border-t border-home-ink pt-3 text-[15px] text-home-ink-2">
          {current === "free" ? "Nothing to pay on the Free plan." : `${hub.name}, ${hub.priceLabel}.`}
        </p>
      </section>
    </div>
  );
}

/**
 * PRD 6.6 surface 4: Plan and billing with a Free against Builder's Hub
 * table and a "Current plan" label. The plan comes from entitlements. A
 * Builder's Hub member sees what they have and nothing to upgrade to.
 */
export function PlanComparison() {
  return (
    <PersonalModule skeleton={<ModuleSkeleton label="Loading your plan" className="h-[420px]" />}>
      <LiveComparison />
    </PersonalModule>
  );
}
