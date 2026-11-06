import { Check } from "lucide-react";
import { WIZARD_STEPS } from "@/lib/workspace/contracts/wizard";
import { STEP_TITLES } from "@/lib/workspace/wizard/labels";
import { cn } from "@/lib/utils";

export type WizardProgressProps = {
  /** Index of the current step, 0–7; `WIZARD_STEPS.length` once finished. */
  readonly currentIndex: number;
};

/** "Step N of 8" plus the ordered list of steps; text labels carry the state, not colour. */
export function progressLabel(currentIndex: number): string {
  const total = WIZARD_STEPS.length;
  if (currentIndex >= total) return `All ${total} steps done`;
  return `Step ${currentIndex + 1} of ${total}: ${STEP_TITLES[WIZARD_STEPS[currentIndex]]}`;
}

export function WizardProgress({ currentIndex }: WizardProgressProps) {
  const total = WIZARD_STEPS.length;
  const done = Math.min(currentIndex, total);
  return (
    <nav aria-label="Wizard progress" className="flex flex-col gap-3">
      <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-home-ink-2">{progressLabel(currentIndex)}</p>
      <div aria-hidden="true" className="h-1.5 w-full overflow-hidden rounded-full bg-home-sunk">
        <div
          className={cn(
            "h-full rounded-full bg-home-orange-ink transition-[width] motion-reduce:transition-none",
            WIDTHS[done],
          )}
        />
      </div>
      <ol className="flex flex-wrap gap-x-4 gap-y-1 text-[12px]">
        {WIZARD_STEPS.map((step, index) => {
          const state = index < currentIndex ? "done" : index === currentIndex ? "current" : "upcoming";
          return (
            <li
              key={step}
              aria-current={state === "current" ? "step" : undefined}
              className={cn(
                "inline-flex items-center gap-1",
                state === "current" ? "font-medium text-home-ink" : "text-home-ink-2",
              )}
            >
              {state === "done" ? <Check aria-hidden="true" className="size-3 text-home-sage-ink" /> : null}
              <span>{STEP_TITLES[step]}</span>
              <span className="sr-only">{state === "done" ? " (done)" : state === "current" ? " (current step)" : ""}</span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/** Static width classes (no inline styles): 0/8 … 8/8. */
const WIDTHS = ["w-0", "w-1/8", "w-2/8", "w-3/8", "w-4/8", "w-5/8", "w-6/8", "w-7/8", "w-full"] as const;
