import * as React from "react";
import { ArrowRight } from "lucide-react";
import { StickyCountdownLabel } from "@/components/marketing/Countdown";

export type WorkshopStickyBarProps = {
  deadline: string;
  ctaHref: string;
  ctaLabel: React.ReactNode;
  /** CTA bg color class (e.g. "bg-[#e9a06a]" or "bg-[#A7C0F2]"). */
  ctaBgClass: string;
  /** CTA hover color class. */
  ctaHoverClass: string;
  /** Wrap label visibility — shipable shows always, dare hides on sm. */
  labelHiddenSm?: boolean;
};

/**
 * Fixed bottom sticky CTA bar with countdown label + accent button.
 */
export function WorkshopStickyBar({
  deadline,
  ctaHref,
  ctaLabel,
  ctaBgClass,
  ctaHoverClass,
  labelHiddenSm = false,
}: WorkshopStickyBarProps) {
  const labelWrapClass = labelHiddenSm
    ? "hidden sm:flex items-center gap-2 min-w-0"
    : "flex items-center gap-2 min-w-0";
  return (
    <div className="fixed bottom-4 left-0 right-0 z-40 flex justify-center px-4 pointer-events-none">
      <div className="pointer-events-auto flex items-center justify-between gap-4 w-full max-w-2xl rounded-2xl bg-[#1a1a1a] text-white pl-5 pr-2 py-2 shadow-2xl border border-white/10">
        <div className={labelWrapClass}>
          <StickyCountdownLabel
            deadline={deadline}
            className={
              labelHiddenSm
                ? "font-mono-eyebrow text-[11px] uppercase text-neutral-300 truncate"
                : "font-mono-eyebrow text-[10px] sm:text-[11px] uppercase text-neutral-300 truncate"
            }
          />
        </div>
        <a
          href={ctaHref}
          className={`inline-flex items-center gap-2 rounded-xl ${ctaBgClass} px-4 sm:px-5 py-3 text-xs sm:text-sm font-semibold ${ctaHoverClass} transition-all focus:outline-none focus:ring-2 focus:ring-white/40 active:scale-95 shrink-0 whitespace-nowrap`}
        >
          {ctaLabel}
          <ArrowRight size={16} aria-hidden="true" />
        </a>
      </div>
    </div>
  );
}
