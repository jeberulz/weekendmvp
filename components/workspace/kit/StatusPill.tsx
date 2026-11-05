import { cn } from "@/lib/utils";
import type { EmployeeStatus, OutputStatus, SiteStatus } from "./types";

type PillStyle = { label: string; classes: string };

export const EMPLOYEE_STATUS_STYLES: Record<EmployeeStatus, PillStyle> = {
  queued: { label: "Queued", classes: "bg-home-sunk text-home-ink-2 border-home-rule" },
  working: { label: "Working", classes: "bg-home-sky text-home-sky-ink border-home-sky-ink/30" },
  needs_you: { label: "Needs you", classes: "bg-[#fbf3e8] text-home-orange-ink border-home-orange-ink/30" },
  done: { label: "Done", classes: "bg-home-sage text-home-sage-ink border-home-sage-ink/30" },
};

export const OUTPUT_STATUS_STYLES: Record<OutputStatus, PillStyle> = {
  draft: { label: "Draft", classes: "bg-home-sunk text-home-ink-2 border-home-rule" },
  ready: { label: "Ready for your OK", classes: "bg-[#fbf3e8] text-home-orange-ink border-home-orange-ink/30" },
  approved: { label: "Approved", classes: "bg-home-sage text-home-sage-ink border-home-sage-ink/30" },
  changes_requested: {
    label: "Changes requested",
    classes: "bg-home-clay text-home-clay-ink border-home-clay-ink/30",
  },
};

export const SITE_STATUS_STYLES: Record<SiteStatus, PillStyle> = {
  live: { label: "Live", classes: "bg-home-sage text-home-sage-ink border-home-sage-ink/30" },
};

export type StatusPillProps = (
  | { set: "employee"; status: EmployeeStatus }
  | { set: "output"; status: OutputStatus }
  | { set: "site"; status: SiteStatus }
) & {
  /** Overrides the default label (e.g. "Working · Routing 4 approvals"). */
  label?: string;
  className?: string;
};

function styleFor(props: StatusPillProps): PillStyle {
  switch (props.set) {
    case "employee":
      return EMPLOYEE_STATUS_STYLES[props.status];
    case "output":
      return OUTPUT_STATUS_STYLES[props.status];
    case "site":
      return SITE_STATUS_STYLES[props.status];
  }
}

/**
 * Status is always the text label; the colour only reinforces it. The dot is
 * decorative.
 */
export function StatusPill(props: StatusPillProps) {
  const style = styleFor(props);
  return (
    <span
      data-status={props.status}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium",
        style.classes,
        props.className,
      )}
    >
      <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
      {props.label ?? style.label}
    </span>
  );
}
