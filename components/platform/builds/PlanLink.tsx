import { CalendarDays, Hammer } from "lucide-react";
import Link from "next/link";
import type { DashboardSource } from "@/lib/track";
import { cn } from "@/lib/utils";
import { BUILDS_PATH, startPlanHref } from "./plan-links";

const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-home-orange-ink";

type Variant = "button" | "icon" | "text";

const VARIANT: Record<Variant, string> = {
  button:
    "h-11 gap-2 rounded-[9px] border border-home-rule bg-home-card px-4 text-sm font-medium text-home-ink hover:border-home-ink-3",
  icon: "size-11 shrink-0 justify-center rounded-lg text-home-ink-2 hover:bg-home-sunk hover:text-home-ink",
  text: "min-h-11 gap-1.5 text-sm font-medium text-home-orange-ink underline-offset-4 hover:text-home-ink hover:underline",
};

/**
 * "Plan my weekend" (PRD 6.2 Choosing, 6.3 Saved). Links to the start page,
 * which handles the one-plan limit, so no card runs a mutation. An idea that
 * is already being built links to Builds instead.
 */
export function PlanLink({
  slug,
  title,
  source,
  building = false,
  variant = "button",
  className,
}: {
  slug: string;
  title: string;
  source: DashboardSource;
  building?: boolean;
  variant?: Variant;
  className?: string;
}) {
  const label = building ? "Open your plan" : "Plan my weekend";
  const Icon = building ? Hammer : CalendarDays;
  return (
    <Link
      href={building ? BUILDS_PATH : startPlanHref(slug, source)}
      title={variant === "icon" ? label : undefined}
      className={cn("inline-flex items-center transition-colors", VARIANT[variant], FOCUS, className)}
    >
      <Icon aria-hidden className="size-[17px] shrink-0" strokeWidth={1.7} />
      <span className={cn(variant === "icon" && "sr-only")}>{label}</span>
      <span className="sr-only"> for {title}</span>
    </Link>
  );
}

/** Shown on cards for the idea with the active plan (FR-20). Text, not colour alone. */
export function BuildingBadge() {
  return (
    <span className="inline-flex h-6 items-center gap-1 rounded-full bg-home-sage px-2 font-mono text-[10.5px] uppercase tracking-[0.08em] text-home-sage-ink">
      <Hammer aria-hidden className="size-3" strokeWidth={2} />
      Building
    </span>
  );
}
