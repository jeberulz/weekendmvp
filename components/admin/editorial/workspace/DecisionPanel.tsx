"use client";

import { useId, useState } from "react";

import type { CandidateDecisionInput } from "@/lib/editorial/contracts/commands";
import { EDITORIAL_LIMITS } from "@/lib/editorial/contracts/limits";
import { REJECT_REASONS, REJECT_REASON_LABELS, type RejectReason } from "@/lib/editorial/contracts/states";
import type { IdeaListItem } from "@/lib/editorial/contracts/views";
import { formatAbsolute } from "@/lib/editorial/presentation/format";
import { ReasonDialog } from "../common/ReasonDialog";
import { fieldClass } from "../common/primitives";
import { CandidateBadge } from "../common/status";
import { smallButtonClass } from "./ui";

const RECOMMENDATION_TEXT = {
  accept: "accept",
  needs_research: "research more",
  reject: "reject",
  unknown: "no recommendation",
} as const;

/**
 * Your decision about the idea itself, kept apart from the engine's
 * recommendation. Rejecting never unpublishes a live page; reopening
 * revokes any approval that depended on the old decision.
 */
export function DecisionPanel({
  idea,
  disabledReason,
  onDecide,
}: {
  idea: IdeaListItem;
  disabledReason: string | null;
  /** Resolves with an error message, or null once recorded. */
  onDecide(input: CandidateDecisionInput): Promise<string | null>;
}) {
  const state = idea.candidate.state;
  const disabled = disabledReason !== null;
  return (
    <section
      id="decision-panel"
      tabIndex={-1}
      aria-labelledby="decision-heading"
      className="flex flex-col gap-2 rounded-lg border border-(--ed-border) bg-(--ed-surface) px-3 py-3 outline-hidden focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-(--ed-focus)"
    >
      <h2 id="decision-heading" className="text-sm font-semibold">
        Editorial decision
      </h2>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <CandidateBadge item={idea} />
        {idea.candidate.decidedAt ? (
          <span className="text-xs text-(--ed-text-2)">
            {formatAbsolute(idea.candidate.decidedAt)}
            {idea.candidate.decidedBy ? ` by ${idea.candidate.decidedBy.label}` : ""}
          </span>
        ) : null}
      </div>
      {idea.candidate.reasonCategory ? <p className="text-sm">Reason: {REJECT_REASON_LABELS[idea.candidate.reasonCategory]}</p> : null}
      {idea.candidate.note ? (
        <p className="text-sm">
          {state === "accepted" ? "Rationale" : state === "new" ? "Reason" : "Note"}: {idea.candidate.note}
        </p>
      ) : null}
      {idea.candidate.question ? <p className="text-sm">Research question: {idea.candidate.question}</p> : null}
      {state === "legacy" ? (
        <p className="text-xs text-(--ed-text-2)">Live before this workspace existed. A decision applies to its next revision.</p>
      ) : null}

      <div className="rounded-md bg-(--ed-sunk) px-2.5 py-2 text-xs">
        {idea.engineRecommendation ? (
          <>
            <p>
              Engine recommends: <span className="font-medium">{RECOMMENDATION_TEXT[idea.engineRecommendation.value]}</span>. A
              recommendation, not an approval.
            </p>
            {idea.engineRecommendation.reasons.length > 0 ? (
              <ul className="mt-1 list-disc pl-4 text-(--ed-text-2)">
                {idea.engineRecommendation.reasons.map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
            ) : null}
          </>
        ) : (
          <p>No engine recommendation for this idea.</p>
        )}
      </div>

      {disabled ? <p className="text-xs text-(--ed-text-2)">{disabledReason}</p> : null}
      <div className="flex flex-wrap gap-2">
        {state !== "accepted" ? (
          <ReasonDialog
            title="Accept this idea for editorial work?"
            description="Accepting means the buyer, problem and wedge merit editing. It does not approve or publish anything."
            label="Rationale"
            maxLength={EDITORIAL_LIMITS.reasonChars}
            confirmLabel="Accept idea"
            trigger={
              <button type="button" className={smallButtonClass} disabled={disabled}>
                Accept…
              </button>
            }
            onConfirm={(rationale) => onDecide({ decision: "accepted", rationale })}
          />
        ) : null}
        {state !== "needs_research" ? (
          <ReasonDialog
            title="Send back for research?"
            description="Ask one precise question the research has to answer. The idea leaves the review queue until it does."
            label="Research question"
            maxLength={EDITORIAL_LIMITS.questionChars}
            confirmLabel="Request research"
            trigger={
              <button type="button" className={smallButtonClass} disabled={disabled}>
                Needs research…
              </button>
            }
            onConfirm={(question) => onDecide({ decision: "needs_research", question })}
          />
        ) : null}
        {state !== "rejected" ? (
          <RejectDialog live={idea.publication === "live"} disabled={disabled} onDecide={onDecide} />
        ) : null}
        {state === "rejected" || state === "needs_research" ? (
          <ReasonDialog
            title="Reopen as a new candidate?"
            description="The idea returns to the review queue. Research and history are kept."
            label="Reason"
            maxLength={EDITORIAL_LIMITS.reasonChars}
            confirmLabel="Reopen"
            trigger={
              <button type="button" className={smallButtonClass} disabled={disabled}>
                Reopen…
              </button>
            }
            onConfirm={(reason) => onDecide({ decision: "new", reason })}
          />
        ) : null}
      </div>
    </section>
  );
}

function RejectDialog({
  live,
  disabled,
  onDecide,
}: {
  live: boolean;
  disabled: boolean;
  onDecide(input: CandidateDecisionInput): Promise<string | null>;
}) {
  const selectId = useId();
  const [category, setCategory] = useState<RejectReason | "">("");
  return (
    <ReasonDialog
      title="Reject this idea?"
      description={
        live
          ? "Rejecting records an editorial decision. It does not unpublish the live page; use Unpublish for that."
          : "Rejecting records an editorial decision. Research is kept and the idea can be reopened."
      }
      label="Note"
      required={category === "other"}
      hint={category === "other" ? "Explain the reason when choosing Other." : undefined}
      maxLength={EDITORIAL_LIMITS.noteChars}
      confirmLabel="Reject idea"
      tone="danger"
      canSubmit={category !== ""}
      onOpenChange={(open) => {
        if (!open) setCategory("");
      }}
      trigger={
        <button type="button" className={smallButtonClass} disabled={disabled}>
          Reject…
        </button>
      }
      onConfirm={(note) =>
        category === ""
          ? Promise.resolve("Choose a reason.")
          : onDecide({ decision: "rejected", reasonCategory: category, note: note || null })
      }
    >
      <div className="flex flex-col gap-1">
        <label htmlFor={selectId} className="text-sm font-medium">
          Reason (required)
        </label>
        <select
          id={selectId}
          className={fieldClass}
          value={category}
          onChange={(event) => setCategory(event.target.value as RejectReason | "")}
        >
          <option value="">Choose a reason</option>
          {REJECT_REASONS.map((reason) => (
            <option key={reason} value={reason}>
              {REJECT_REASON_LABELS[reason]}
            </option>
          ))}
        </select>
      </div>
    </ReasonDialog>
  );
}
