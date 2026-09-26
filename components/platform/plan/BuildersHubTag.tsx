import { PLANS } from "@/convex/platform/plans";
import { cn } from "@/lib/utils";

/**
 * PRD 6.6 surface 3: a small text label on the locked action itself, not a
 * padlock wall. Part of the action's name, so it reads as "Start my weekend
 * plan, Builder's Hub". Render it only when `showUpsell` is true.
 */
export function BuildersHubTag({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-5 items-center rounded-full border border-current/40 px-1.5 font-mono text-[10px] uppercase tracking-[0.08em]",
        className,
      )}
    >
      <span className="sr-only">, </span>
      {PLANS.builders_hub.name}
    </span>
  );
}
