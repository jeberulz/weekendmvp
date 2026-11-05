"use client";

import { Clock, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import type { RoleKey } from "@/lib/workspace/contracts/roster";
import { DefaultLink } from "./DefaultLink";
import { EmployeeAvatar } from "./EmployeeAvatar";
import { StatusPill } from "./StatusPill";
import { BTN_SECONDARY, CARD, FOCUS } from "./styles";
import { ROLE_LABELS, type EmployeeStatus, type LinkComponent } from "./types";

export type EmployeeCardData = {
  id: string;
  name: string;
  role: RoleKey;
  specialty: string;
  status: EmployeeStatus;
  statusDetail: string;
  autopilot: boolean;
  blocker?: { waitingOn: RoleKey; detail: string };
};

export type EmployeeCardProps = {
  employee: EmployeeCardData;
  /** False on Free: the switch shows a lock and the tooltip names the plan. */
  autopilotAvailable: boolean;
  workstreamHref: string;
  /** Called with the requested next value. The page decides what happens (toggle or gate). */
  onAutopilotToggle: (employeeId: string, next: boolean) => void;
  linkComponent?: LinkComponent;
  /** Prefix for generated ids. Defaults to `employee-<id>`; pass one if the same employee renders twice. */
  idPrefix?: string;
};

export function autopilotTooltip(name: string, available: boolean): string {
  return available
    ? `Autopilot for ${name}`
    : `Autopilot is on paid plans. On Free, ${name} asks before acting.`;
}

export function EmployeeCard({
  employee,
  autopilotAvailable,
  workstreamHref,
  onAutopilotToggle,
  linkComponent: Link = DefaultLink,
  idPrefix,
}: EmployeeCardProps) {
  const hintId = `${idPrefix ?? `employee-${employee.id}`}-autopilot-hint`;
  const roleLabel = ROLE_LABELS[employee.role];
  const who = `${employee.name}, ${roleLabel}`;
  return (
    <li
      data-employee={employee.id}
      className={cn(
        CARD,
        "flex flex-col gap-3 p-4",
        employee.status === "needs_you" && "border-home-orange-ink/30",
      )}
    >
      <div className="flex items-start gap-3">
        <EmployeeAvatar name={employee.name} role={employee.role} size="lg" showAiBadge />
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-semibold text-home-ink">{employee.name}</h3>
          <p className="text-[13px] text-home-ink-2">{roleLabel}</p>
        </div>
        <StatusPill set="employee" status={employee.status} />
      </div>
      <p className="text-[13px] text-home-ink-2">{employee.specialty}</p>
      <p className="text-[13px] text-home-ink">
        <span className="sr-only">Status detail: </span>
        {employee.statusDetail}
      </p>
      {employee.blocker ? (
        <p className="flex items-start gap-1.5 text-[13px] text-home-ochre-ink">
          <Clock aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
          <span>
            <strong className="font-semibold">
              Waiting on {ROLE_LABELS[employee.blocker.waitingOn]}
            </strong>{" "}
            · {employee.blocker.detail}
          </span>
        </p>
      ) : null}
      <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-home-rule pt-3">
        <Link
          href={workstreamHref}
          className={cn(
            "inline-flex min-h-10 items-center text-[13px] font-medium text-home-ink underline underline-offset-2",
            FOCUS,
          )}
        >
          Open workstream<span className="sr-only"> · {who}</span>
        </Link>
        <button
          type="button"
          role="switch"
          aria-checked={employee.autopilot}
          aria-label={`Autopilot for ${who}${autopilotAvailable ? "" : " (paid plans)"}`}
          title={autopilotTooltip(employee.name, autopilotAvailable)}
          aria-describedby={autopilotAvailable ? undefined : hintId}
          onClick={() => onAutopilotToggle(employee.id, !employee.autopilot)}
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
              employee.autopilot
                ? "border-home-ink bg-home-ink"
                : "border-home-ink-3 bg-home-sunk",
            )}
          >
            <span
              className={cn(
                "absolute top-[3px] size-[10px] rounded-full motion-safe:transition-all",
                employee.autopilot ? "left-[16px] bg-home-card" : "left-[3px] bg-home-ink-3",
              )}
            />
          </span>
          <span aria-hidden="true" className="font-mono text-[11px]">
            {employee.autopilot ? "On" : "Off"}
          </span>
          {autopilotAvailable ? null : (
            <>
              <Lock aria-hidden="true" className="size-3.5" />
              <span aria-hidden="true" className="text-[11px] font-medium text-home-ink-2">
                Paid
              </span>
            </>
          )}
        </button>
        {autopilotAvailable ? null : (
          <span id={hintId} className="sr-only">
            {autopilotTooltip(employee.name, false)}
          </span>
        )}
      </div>
    </li>
  );
}

export type SkippedRoleCardProps = {
  role: RoleKey;
  reason: string;
  hireRequested?: boolean;
  onHire: (role: RoleKey) => void;
};

/** Skipped-role variant: dashed card, the reason, and a Hire button. */
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
    </li>
  );
}
