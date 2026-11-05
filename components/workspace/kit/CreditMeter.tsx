import { cn } from "@/lib/utils";
import type { WorkspacePlanId } from "@/lib/workspace/contracts/jobs";

export type CreditMeterState = "normal" | "low" | "zero";

export const LOW_CREDIT_FRACTION = 0.2;

export function creditMeterState(balance: number, max: number): CreditMeterState {
  if (balance <= 0) return "zero";
  if (max > 0 && balance <= max * LOW_CREDIT_FRACTION) return "low";
  return "normal";
}

/** Plan label shown on the meter. The canvas draft called the paid plan "Starter"; the product name is Builder's Hub. */
export const PLAN_LABELS: Record<WorkspacePlanId, string> = {
  free: "Free",
  builders_hub: "Builder's Hub",
  growth: "Growth",
};

const FILL_WIDTHS = [
  "w-0", "w-[5%]", "w-[10%]", "w-[15%]", "w-[20%]", "w-[25%]", "w-[30%]", "w-[35%]",
  "w-[40%]", "w-[45%]", "w-[50%]", "w-[55%]", "w-[60%]", "w-[65%]", "w-[70%]", "w-[75%]",
  "w-[80%]", "w-[85%]", "w-[90%]", "w-[95%]", "w-full",
] as const;

function fillWidth(balance: number, max: number): string {
  if (balance <= 0 || max <= 0) return FILL_WIDTHS[0];
  const steps = Math.min(20, Math.max(1, Math.round((balance / max) * 20)));
  return FILL_WIDTHS[steps];
}

const STATE_CLASSES: Record<CreditMeterState, { text: string; bar: string }> = {
  normal: { text: "text-home-sage-ink", bar: "bg-home-sage-ink" },
  low: { text: "text-home-ochre-ink", bar: "bg-[#c9962e]" },
  zero: { text: "text-home-orange-ink", bar: "bg-home-orange-ink" },
};

export function creditMeterNote(plan: WorkspacePlanId, max: number, state: CreditMeterState): string {
  if (state === "zero") return "Studio extras paused · see plans";
  return plan === "free"
    ? `Free · ${max} starter credits, one-time`
    : `${max} refresh on the 5th`;
}

export type CreditMeterProps = {
  balance: number;
  max: number;
  plan: WorkspacePlanId;
  className?: string;
};

export function CreditMeter({ balance, max, plan, className }: CreditMeterProps) {
  const state = creditMeterState(balance, max);
  const colours = STATE_CLASSES[state];
  const shown = Math.max(0, Math.min(balance, max));
  const right = state === "low" ? `${shown} left · low` : `${shown} left`;
  return (
    <div data-state={state} className={cn("flex flex-col gap-1.5", className)}>
      <div className="flex items-center gap-2 text-[13px]">
        <span className="font-medium text-home-ink">Credits</span>
        <span className="rounded-full bg-home-sunk px-2 py-0.5 text-xs font-medium text-home-ink-2">
          {PLAN_LABELS[plan]}
        </span>
        <span className={cn("ml-auto font-mono text-xs", colours.text)}>{right}</span>
      </div>
      <div
        role="meter"
        aria-label="Credits"
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={shown}
        aria-valuetext={`${shown} of ${max} credits left`}
        className="h-1.5 overflow-hidden rounded-[3px] bg-home-sunk"
      >
        <div className={cn("h-full", fillWidth(shown, max), colours.bar)} />
      </div>
      <p className="text-[11px] text-home-ink-3">{creditMeterNote(plan, max, state)}</p>
    </div>
  );
}
