import { Check } from "lucide-react";
import { PLANS } from "@/convex/platform/plans";

const EYEBROW = "font-mono text-[11px] uppercase tracking-[0.08em] text-home-ink-3";
const CARD = "flex flex-col gap-4 rounded-[14px] border p-5 sm:p-6";

function Features({ items, id }: { items: readonly string[]; id: string }) {
  return (
    <ul aria-labelledby={id} className="flex flex-col gap-2 text-[15px] text-home-ink-2">
      {items.map((item) => (
        <li key={item} className="flex gap-2.5">
          <Check aria-hidden className="mt-0.5 size-4 shrink-0 text-home-sage-ink" strokeWidth={2} />
          {item}
        </li>
      ))}
    </ul>
  );
}

/**
 * Plan and billing (WP44-S7, PRD 6.3 and 6.6). The Free plan for everyone
 * until entitlements land (S10). Builder's Hub shows only when its flag is
 * on, and has no upgrade button until the subscription work ships. Credit
 * packs stay hidden (R9): `BillingWorkspace` is kept, unrendered, for then.
 */
export function PlanAndBilling({ showBuildersHub }: { showBuildersHub: boolean }) {
  const free = PLANS.free;
  const hub = PLANS.builders_hub;
  return (
    <div className="mx-auto w-full max-w-[1200px] px-5 py-8 sm:px-8 lg:px-10 lg:py-10">
      <header className="mb-8 flex flex-col gap-1.5">
        <h1 className="font-editorial text-[34px] font-normal leading-[1.05] tracking-[-0.025em] text-home-ink sm:text-[42px]">
          Plan and billing
        </h1>
        <p className="text-[15px] text-home-ink-2">Your plan and what it includes.</p>
      </header>

      <div className="grid max-w-4xl gap-4 md:grid-cols-2">
        <section aria-labelledby="plan-free" className={`${CARD} border-home-ink bg-home-card`}>
          <div className="flex items-baseline justify-between gap-3">
            <p className={EYEBROW}>Current plan</p>
            <p className={EYEBROW}>{free.priceLabel}</p>
          </div>
          <h2 id="plan-free" className="font-editorial text-[26px] font-normal leading-[1.15] text-home-ink">
            {free.name}
          </h2>
          <Features items={free.includes} id="plan-free" />
        </section>

        {showBuildersHub && (
          <section aria-labelledby="plan-hub" className={`${CARD} border-home-rule bg-home-sunk`}>
            <div className="flex items-baseline justify-between gap-3">
              <p className={EYEBROW}>Paid plan</p>
              <p className={EYEBROW}>{hub.priceLabel}</p>
            </div>
            <h2 id="plan-hub" className="font-editorial text-[26px] font-normal leading-[1.15] text-home-ink">
              {hub.name}
            </h2>
            <p className="text-sm text-home-ink-2">Everything in Free, plus:</p>
            <Features items={hub.adds} id="plan-hub" />
            <p className="mt-auto border-t border-home-rule pt-3 text-sm text-home-ink-2">
              Not open yet. You will be able to upgrade here.
            </p>
          </section>
        )}
      </div>

      <section aria-labelledby="billing-heading" className="mt-10 max-w-4xl">
        <h2 id="billing-heading" className={EYEBROW}>
          Billing
        </h2>
        <p className="mt-2 border-t border-home-ink pt-3 text-[15px] text-home-ink-2">
          Nothing to pay on the Free plan.
        </p>
      </section>
    </div>
  );
}
