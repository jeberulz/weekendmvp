"use client";

import { Clock, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import type { RoleKey } from "@/lib/workspace/contracts/roster";
import { DefaultLink } from "./DefaultLink";
import { EmployeeAvatar } from "./EmployeeAvatar";
import { StatusPill } from "./StatusPill";
import { BTN_SECONDARY, CARD, COMING_SOON_TAG, FOCUS } from "./styles";
import { ROLE_LABELS, type LinkComponent, type TeamCardStatus } from "./types";

export type EmployeeBlocker =
  | { label: string; detail?: string }
  /** Legacy shape: names the role being waited on. */
  | { waitingOn: RoleKey; detail: string };

export type EmployeeCardData = {
  id: string;
  name: string;
  role: RoleKey;
  specialty: string;
  /** The four data statuses plus the display states `coming_soon` and `failed`. */
  status: TeamCardStatus;
  statusDetail: string;
  /** Legacy: the switch value when the card is given `onAutopilotToggle`. Prefer the `autopilot` prop. */
  autopilot?: boolean;
  blocker?: EmployeeBlocker;
};

export type EmployeeAutopilot = {
  on: boolean;
  /** False on Free: the switch shows a lock and the tooltip names the plan. */
  available: boolean;
  /** Called with the requested next value. The page decides what happens (toggle or gate). */
  onToggle: (employeeId: string, next: boolean) => void;
};

export type EmployeeCardProps = {
  employee: EmployeeCardData;
  /** The workstream link. `null` (or omitted) shows "Workstream coming soon" in words. */
  workstream?: { href: string; label: string } | null;
  /** `null` hides the switch. Omitted: the legacy props below decide. */
  autopilot?: EmployeeAutopilot | null;
  /** Legacy: same as `workstream={{ href, label: "Open workstream" }}`. */
  workstreamHref?: string;
  /** Legacy: with `onAutopilotToggle`, shows the switch using `employee.autopilot`. */
  autopilotAvailable?: boolean;
  /** Legacy: see `autopilotAvailable`. */
  onAutopilotToggle?: (employeeId: string, next: boolean) => void;
  linkComponent?: LinkComponent;
  /** Prefix for generated ids. Defaults to `employee-<id>`; pass one if the same employee renders twice. */
  idPrefix?: string;
};

function blockerParts(blocker: EmployeeBlocker): { label: string; detail?: string } {
  if ("waitingOn" in blocker) {
    return { label: `Waiting on ${ROLE_LABELS[blocker.waitingOn]}`, detail: blocker.detail };
  }
  return blocker;
}

function cardTone(status: TeamCardStatus): string {
  if (status === "needs_you") return "border-home-orange-ink/30";
  if (status === "failed") return "border-home-clay-ink/30";
  if (status === "coming_soon") return "border-dashed border-home-d2";
  return "";
}

export function autopilotTooltip(name: string, available: boolean): string {
  return available
    ? `Autopilot for ${name}`
    : `Autopilot is on paid plans. On Free, ${name} asks before acting.`;
}

export function EmployeeCard({
  employee,
  workstream,
  autopilot,
  workstreamHref,
  autopilotAvailable = true,
  onAutopilotToggle,
  linkComponent: Link = DefaultLink,
  idPrefix,
}: EmployeeCardProps) {
  const hintId = `${idPrefix ?? `employee-${employee.id}`}-autopilot-hint`;
  const roleLabel = ROLE_LABELS[employee.role];
  const who = `${employee.name}, ${roleLabel}`;
  const link =
    workstream !== undefined
      ? workstream
      : workstreamHref === undefined
        ? null
        : { href: workstreamHref, label: "Open workstream" };
  const switchState: EmployeeAutopilot | null =
    autopilot !== undefined
      ? autopilot
      : onAutopilotToggle === undefined
        ? null
        : { on: employee.autopilot ?? false, available: autopilotAvailable, onToggle: onAutopilotToggle };
  const blocker = employee.blocker === undefined ? null : blockerParts(employee.blocker);
  return (
    <li data-employee={employee.id} className={cn(CARD, "flex flex-col gap-3 p-4", cardTone(employee.status))}>
      <div className="flex items-start gap-3">
        <EmployeeAvatar name={employee.name} role={employee.role} size="md2" showAiBadge />
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-medium text-home-ink">{employee.name}</h3>
          <p className="text-[13px] text-home-ink-2">{roleLabel}</p>
        </div>
        <StatusPill set="employee" status={employee.status} />
      </div>
      <p className="text-[13px] text-home-ink-2">{employee.specialty}</p>
      <p className="text-[13px] text-home-ink">
        <span className="sr-only">Status detail: </span>
        {employee.statusDetail}
      </p>
      {blocker ? (
        <p className="flex items-start gap-1.5 text-[13px] text-home-ochre-ink">
          <Clock aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
          <span>
            <strong className="font-semibold">{blocker.label}</strong>
            {blocker.detail ? <> · {blocker.detail}</> : null}
          </span>
        </p>
      ) : null}
      <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-home-rule pt-3">
        {link ? (
          <Link
            href={link.href}
            className={cn(
              "inline-flex min-h-10 items-center text-[13px] font-medium text-home-ink underline underline-offset-2",
              FOCUS,
            )}
          >
            {link.label}<span className="sr-only"> · {who}</span>
          </Link>
        ) : (
          <span className={cn(COMING_SOON_TAG, "inline-flex min-h-10 items-center")}>
            Workstream coming soon
          </span>
        )}
        {switchState ? (
          <>
            <button
              type="button"
              role="switch"
              aria-checked={switchState.on}
              aria-label={`Autopilot for ${who}${switchState.available ? "" : " (paid plans)"}`}
              title={autopilotTooltip(employee.name, switchState.available)}
              aria-describedby={switchState.available ? undefined : hintId}
              onClick={() => switchState.onToggle(employee.id, !switchState.on)}
              className={cn(
                "inline-flex min-h-10 items-center gap-2 rounded-full px-2 text-[13px] text-home-ink",
                FOCUS,
              )}
            >
              <span aria-hidden="true">Autopilot</span>
              <span
                aria-hidden="true"
                className={cn(
                  "relative inline-block h-[18px] w-[30px] rounded-full border",
                  switchState.on ? "border-home-ink bg-home-ink" : "border-home-ink-3 bg-home-sunk",
                )}
              >
                <span
                  className={cn(
                    "absolute top-[3px] size-[10px] rounded-full motion-safe:transition-all",
                    switchState.on ? "left-[16px] bg-home-card" : "left-[3px] bg-home-ink-3",
                  )}
                />
              </span>
              <span aria-hidden="true" className="font-mono text-[11px]">
                {switchState.on ? "On" : "Off"}
              </span>
              {switchState.available ? null : (
                <>
                  <Lock aria-hidden="true" className="size-3.5" />
                  <span aria-hidden="true" className="text-[11px] font-medium text-home-ink-2">
                    Paid
                  </span>
                </>
              )}
            </button>
            {switchState.available ? null : (
              <span id={hintId} className="sr-only">
                {autopilotTooltip(employee.name, false)}
              </span>
            )}
          </>
        ) : null}
      </div>
    </li>
  );
}

export type SkippedRoleCardProps = {
  role: RoleKey;
  reason: string;
  hireRequested?: boolean;
  /** Omit it and the card shows the reason with no Hire button. */
  onHire?: (role: RoleKey) => void;
};

/** Skipped-role variant: dashed card, the reason, and an optional Hire button. */
export function SkippedRoleCard({ role, reason, hireRequested = false, onHire }: SkippedRoleCardProps) {
  const label = ROLE_LABELS[role];
  return (
    <li
      data-skipped-role={role}
      className="flex flex-col gap-3 rounded-xl border border-dashed border-home-d2 bg-home-card p-4"
    >
      <h3 className="text-base font-semibold text-home-ink">{label}</h3>
      <p className="rounded-md bg-home-clay px-2.5 py-1.5 text-[13px] text-home-clay-ink">
        <strong className="font-semibold">Skipped</strong> · {reason}
      </p>
      {onHire ? (
        <button
          type="button"
          className={cn(BTN_SECONDARY, "self-start")}
          aria-disabled={hireRequested || undefined}
          aria-label={hireRequested ? `Hire requested for ${label}` : `Hire ${label}`}
          onClick={() => {
            if (!hireRequested) onHire(role);
          }}
        >
          {hireRequested ? "Hire requested" : "Hire"}
        </button>
      ) : null}
    </li>
  );
}
