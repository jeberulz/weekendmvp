import { ChevronLeft } from "lucide-react";
import { FOCUS } from "@/components/workspace/kit/styles";
import { WIZARD_STEPS } from "@/lib/workspace/contracts/wizard";
import { STEP_SHORT_LABELS } from "@/lib/workspace/wizard/copy";
import { STEP_TITLES } from "@/lib/workspace/wizard/labels";
import { cn } from "@/lib/utils";

export type WizardProgressProps = {
  /** Index of the current step, 0–7; `WIZARD_STEPS.length` once finished. */
  readonly currentIndex: number;
  /** Goes back one step. Absent on the first step and once the business exists. */
  readonly onBack?: (() => void) | null;
  /** A save is in flight: the back chevron stays focusable but does nothing. */
  readonly pending?: boolean;
  /** Replaces "Step k of 8" once every step is done (the screens after step 8). */
  readonly finishedCaption?: string;
};

/** The live announcement for a step change: "Step N of 8: Platform". */
export function progressLabel(currentIndex: number): string {
  const total = WIZARD_STEPS.length;
  if (currentIndex >= total) return `All ${total} steps done`;
  return `Step ${currentIndex + 1} of ${total}: ${STEP_TITLES[WIZARD_STEPS[currentIndex]]}`;
}

/** The mono caption under the bar: "Step 3 of 8 · Platform". */
export function progressCaption(currentIndex: number): string {
  const total = WIZARD_STEPS.length;
  if (currentIndex >= total) return `All ${total} steps done`;
  return `Step ${currentIndex + 1} of ${total} · ${STEP_TITLES[WIZARD_STEPS[currentIndex]]}`;
}

/**
 * Eight segments, one per step, each with its label; the current one carries
 * `aria-current="step"`. State is words (screen readers) and shape (the bar
 * fills), never colour alone. D10: there is no ninth, SMS step.
 */
export function WizardProgress({ currentIndex, onBack = null, pending = false, finishedCaption }: WizardProgressProps) {
  return (
    <div className="mx-auto flex w-full max-w-[672px] flex-col gap-1">
      <ol aria-label="Onboarding steps" className="grid grid-cols-8 gap-1.5">
        {WIZARD_STEPS.map((step, index) => {
          const state = index < currentIndex ? "done" : index === currentIndex ? "current" : "upcoming";
          return (
            <li key={step} aria-current={state === "current" ? "step" : undefined} className="flex min-w-0 flex-col gap-[5px]">
              <span
                aria-hidden="true"
                className={cn(
                  "h-[3px] rounded-sm",
                  state === "done" ? "bg-home-ink" : state === "current" ? "bg-home-orange-ink" : "bg-home-rule",
                )}
              />
              <span className={cn("text-[10px] leading-tight", state === "current" ? "font-semibold text-home-ink" : "text-home-ink-3")}>
                <span aria-hidden="true" className="sm:hidden">
                  {index + 1}
                </span>
                <span className="sr-only sm:not-sr-only">
                  <span aria-hidden="true" className="hidden sm:inline">
                    {index + 1}{" "}
                  </span>
                  {STEP_SHORT_LABELS[step]}
                </span>
                <span className="sr-only">{state === "done" ? " (done)" : state === "current" ? " (current step)" : ""}</span>
              </span>
            </li>
          );
        })}
      </ol>
      <div className="relative flex min-h-11 items-center justify-center">
        {onBack ? (
          <button
            type="button"
            aria-label="Back to previous step"
            aria-disabled={pending || undefined}
            onClick={() => {
              if (!pending) onBack();
            }}
            className={cn(
              "absolute left-0 flex size-11 items-center justify-center rounded-full text-home-ink-2 hover:bg-home-sunk sm:-left-3",
              FOCUS,
            )}
          >
            <ChevronLeft aria-hidden="true" className="size-[18px]" />
          </button>
        ) : null}
        <p className="font-mono text-xs uppercase text-home-ink-3">{finishedCaption ?? progressCaption(currentIndex)}</p>
      </div>
    </div>
  );
}
