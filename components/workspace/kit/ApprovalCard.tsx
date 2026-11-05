"use client";

import type { ReactNode } from "react";
import { AlertTriangle, Coins } from "lucide-react";
import { cn } from "@/lib/utils";
import { EmployeeAvatar } from "./EmployeeAvatar";
import { BTN_APPROVED, BTN_CHANGES, BTN_SECONDARY, CARD } from "./styles";
import { costLabel, ROLE_LABELS, type ApprovalCost, type EmployeeIdentity } from "./types";

export type ApprovalDecisionState = "open" | "approved" | "changes";

export type ApprovalCardProps = {
  id: string;
  title: string;
  from: EmployeeIdentity;
  preview?: ReactNode;
  cost: ApprovalCost;
  state: ApprovalDecisionState;
  /** True while a decision is in flight: both buttons disable and the card is aria-busy. */
  pending?: boolean;
  /** Announced in a polite live region after a decision. */
  statusMessage?: string;
  onApprove: (id: string) => void;
  onAskChanges: (id: string) => void;
};

export function CostBadge({ cost, id }: { cost: ApprovalCost; id?: string }) {
  const short = cost.kind === "credits" && cost.credits > cost.balance;
  return (
    <span
      id={id}
      data-cost={cost.kind === "free" ? "free" : short ? "not-enough" : "credits"}
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium",
        cost.kind === "free" && "border-[#bcd0b0] bg-home-sage text-home-sage-ink",
        cost.kind === "credits" && !short && "border-home-rule bg-home-sunk text-home-ink-2",
        short && "border-[#e4bfb4] bg-home-clay text-home-clay-ink",
      )}
    >
      {short ? (
        <AlertTriangle aria-hidden="true" className="size-3" />
      ) : (
        <Coins aria-hidden="true" className="size-3" />
      )}
      {costLabel(cost)}
    </span>
  );
}

export function ApprovalCard({
  id,
  title,
  from,
  preview,
  cost,
  state,
  pending = false,
  statusMessage,
  onApprove,
  onAskChanges,
}: ApprovalCardProps) {
  const costId = `${id}-cost`;
  const statusId = `${id}-status`;
  return (
    <li
      data-approval={id}
      data-state={state}
      aria-busy={pending}
      className={cn(CARD, "flex flex-col gap-3 p-4")}
    >
      <div className="flex items-center gap-2">
        <EmployeeAvatar name={from.name} role={from.role} size="md" />
        <p className="font-mono text-[11px] text-home-ink-3">
          From {ROLE_LABELS[from.role]} · {from.name}
        </p>
        <span className="ml-auto">
          <CostBadge cost={cost} id={costId} />
        </span>
      </div>
      <h3 className="text-[15px] font-semibold text-home-ink">{title}</h3>
      {preview ? <div>{preview}</div> : null}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          aria-pressed={state === "approved"}
          aria-describedby={costId}
          disabled={pending}
          className={state === "approved" ? BTN_APPROVED : BTN_SECONDARY}
          onClick={() => onApprove(id)}
        >
          {state === "approved" ? "✓ " : ""}Looks good
          <span className="sr-only"> · {title}</span>
        </button>
        <button
          type="button"
          aria-pressed={state === "changes"}
          disabled={pending}
          className={state === "changes" ? BTN_CHANGES : BTN_SECONDARY}
          onClick={() => onAskChanges(id)}
        >
          Ask for changes
          <span className="sr-only"> · {title}</span>
        </button>
      </div>
      <p
        id={statusId}
        role="status"
        aria-live="polite"
        className="min-h-5 text-[13px] text-home-ink-2"
      >
        {pending ? "Sending your decision…" : statusMessage}
      </p>
    </li>
  );
}
