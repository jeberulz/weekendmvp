"use client";

import type { ReactNode } from "react";
import { AlertTriangle, Coins } from "lucide-react";
import { cn } from "@/lib/utils";
import { EmployeeAvatar } from "./EmployeeAvatar";
import { BTN_APPROVED, BTN_CHANGES, BTN_SECONDARY, CARD } from "./styles";
import {
  costLabel,
  costState,
  ROLE_LABELS,
  type ApprovalCost,
  type EmployeeIdentity,
} from "./types";

export type ApprovalDecisionState = "open" | "approved" | "changes";

export type ApprovalCardProps = {
  id: string;
  title: string;
  from: EmployeeIdentity;
  preview?: ReactNode;
  cost: ApprovalCost;
  state: ApprovalDecisionState;
  /**
   * True while a decision is in flight. Buttons stay focusable (`aria-disabled`)
   * and ignore activation, so keyboard focus is never dropped.
   */
  pending?: boolean;
  /** Announced in a polite live region after a decision. */
  statusMessage?: string;
  onApprove: (id: string) => void;
  onAskChanges: (id: string) => void;
  /** Prefix for generated ids. Defaults to `approval-<id>`. */
  idPrefix?: string;
};

export function CostBadge({ cost, id }: { cost: ApprovalCost; id?: string }) {
  const state = costState(cost);
  return (
    <span
      id={id}
      data-cost={state}
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium",
        state === "free" && "border-home-sage-ink/30 bg-home-sage text-home-sage-ink",
        state === "credits" && "border-home-rule bg-home-sunk text-home-ink-2",
        state === "not-enough" && "border-home-clay-ink/30 bg-home-clay text-home-clay-ink",
      )}
    >
      {state === "not-enough" ? (
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
  idPrefix,
}: ApprovalCardProps) {
  const prefix = idPrefix ?? `approval-${id}`;
  const costId = `${prefix}-cost`;
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
          aria-disabled={pending || undefined}
          className={state === "approved" ? BTN_APPROVED : BTN_SECONDARY}
          onClick={() => {
            if (!pending) onApprove(id);
          }}
        >
          {state === "approved" ? "✓ " : ""}Looks good
          <span className="sr-only"> · {title}</span>
        </button>
        <button
          type="button"
          aria-pressed={state === "changes"}
          aria-disabled={pending || undefined}
          className={state === "changes" ? BTN_CHANGES : BTN_SECONDARY}
          onClick={() => {
            if (!pending) onAskChanges(id);
          }}
        >
          Ask for changes
          <span className="sr-only"> · {title}</span>
        </button>
      </div>
      <p role="status" aria-live="polite" className="min-h-5 text-[13px] text-home-ink-2">
        {pending ? "Sending your decision…" : statusMessage}
      </p>
    </li>
  );
}
