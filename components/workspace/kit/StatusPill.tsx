import { cn } from "@/lib/utils";
import { PILL_BASE } from "./styles";
import type { OutputStatus, SiteStatus, StepStatus, TeamCardStatus } from "./types";

type PillStyle = { label: string; classes: string };

const NEUTRAL = "bg-home-sunk text-home-ink-2 border-home-rule";
const EMBER = "bg-home-ember-soft text-home-orange-ink border-home-orange-ink/30";
const SKY = "bg-home-sky text-home-sky-ink border-home-sky-ink/30";
const SAGE = "bg-home-sage text-home-sage-ink border-home-sage-ink/30";
const CLAY = "bg-home-clay text-home-clay-ink border-home-clay-ink/30";
const OCHRE = "bg-home-ochre text-home-ochre-ink border-home-ochre-ink/30";
/** Not built yet: dashed border plus the words "Coming soon", so it is never colour alone. */
const NOT_BUILT = "bg-home-sunk text-home-ink-3 border-dashed border-home-d2";

export const EMPLOYEE_STATUS_STYLES: Record<TeamCardStatus, PillStyle> = {
  queued: { label: "Queued", classes: NEUTRAL },
  working: { label: "Working", classes: SKY },
  needs_you: { label: "Needs you", classes: EMBER },
  done: { label: "Done", classes: SAGE },
  failed: { label: "Failed", classes: CLAY },
  coming_soon: { label: "Coming soon", classes: NOT_BUILT },
};

export const STEP_STATUS_STYLES: Record<StepStatus, PillStyle> = {
  waiting: { label: "Waiting", classes: NEUTRAL },
  queued: { label: "Queued", classes: NEUTRAL },
  working: { label: "Working", classes: SKY },
  paused: { label: "Paused", classes: OCHRE },
  done: { label: "Done", classes: SAGE },
  failed: { label: "Failed", classes: CLAY },
  coming_soon: { label: "Coming soon", classes: NOT_BUILT },
  skipped: { label: "Skipped", classes: CLAY },
};

export const OUTPUT_STATUS_STYLES: Record<OutputStatus, PillStyle> = {
  draft: { label: "Draft", classes: NEUTRAL },
  ready: { label: "Ready for your OK", classes: EMBER },
  approved: { label: "Approved", classes: SAGE },
  changes_requested: { label: "Changes requested", classes: CLAY },
};

export const SITE_STATUS_STYLES: Record<SiteStatus, PillStyle> = {
  live: { label: "Live", classes: SAGE },
};

export type StatusPillProps = (
  | { set: "employee"; status: TeamCardStatus }
  | { set: "step"; status: StepStatus }
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
    case "step":
      return STEP_STATUS_STYLES[props.status];
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
    <span data-status={props.status} className={cn(PILL_BASE, "border", style.classes, props.className)}>
      <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
      {props.label ?? style.label}
    </span>
  );
}
