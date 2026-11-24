"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, useTransition, type FormEvent, type RefObject } from "react";

import { clearCapOverrideAction, setCapOverrideAction } from "@/app/admin/ai/_actions/controls";
import { StrongAuthStep } from "@/components/admin/editorial/common/StrongAuthStep";
import {
  CAP_OVERRIDE_CEILING_MICRO_USD,
  EXPIRY_CHOICES,
  EXPIRY_LABELS,
  capOverrideRefusal,
  type CapOverride,
  type ExpiryChoice,
} from "@/lib/admin/ai-costs/cap-override";
import { CONFIRM_PHRASE, CONTROL_ERRORS, parseUsdInput } from "@/lib/admin/ai-costs/controls";
import { formatUtc } from "@/lib/admin/ai-costs/labels";
import { formatUsd } from "@/lib/admin/ai-costs/money";
import { cn } from "@/lib/utils";
import { FeedbackLine, STEP_UP_MECHANISM, primaryButton, simulate, type Feedback } from "./controls";
import { buttonClass, controlClass } from "./interactive";
import { Notice } from "./primitives";

/**
 * WP93 Phase 3. Raise one founder's daily AI cap until a set time, or end
 * a raise early. The server re-checks every rule; this only explains them.
 */
export function CapOverridePanel({
  ownerId,
  label,
  planCapMicroUsd,
  freePlan,
  override,
  signedInRecently,
}: {
  ownerId: string;
  /** The founder's email, or a stand-in when the account has none. */
  label: string;
  planCapMicroUsd: number;
  freePlan: boolean;
  override: CapOverride | null;
  signedInRecently: boolean;
}) {
  const [feedback, setFeedback] = useState<Feedback>(null);
  // After a save or an end, focus moves to what replaced the control the owner used.
  const focusNext = useRef(false);
  const activeRef = useRef<HTMLParagraphElement>(null);
  const amountRef = useRef<HTMLInputElement>(null);
  const active = override !== null;
  useEffect(() => {
    if (!focusNext.current) return;
    focusNext.current = false;
    if (active) activeRef.current?.focus();
    else amountRef.current?.focus();
  }, [active]);

  return (
    <div className="flex flex-col gap-3">
      {override ? (
        <ActiveOverride
          ownerId={ownerId}
          override={override}
          planCapMicroUsd={planCapMicroUsd}
          headingRef={activeRef}
          onEnded={(next) => { focusNext.current = true; setFeedback(next); }}
          onFailed={setFeedback}
        />
      ) : (
        <RaiseForm
          ownerId={ownerId}
          label={label}
          planCapMicroUsd={planCapMicroUsd}
          freePlan={freePlan}
          signedInRecently={signedInRecently}
          amountRef={amountRef}
          onSaved={(next) => { focusNext.current = true; setFeedback(next); }}
          onFailed={setFeedback}
        />
      )}
      <FeedbackLine feedback={feedback} />
    </div>
  );
}

function ActiveOverride({
  ownerId,
  override,
  planCapMicroUsd,
  headingRef,
  onEnded,
  onFailed,
}: {
  ownerId: string;
  override: CapOverride;
  planCapMicroUsd: number;
  headingRef: RefObject<HTMLParagraphElement | null>;
  onEnded(feedback: Feedback): void;
  onFailed(feedback: Feedback): void;
}) {
  const router = useRouter();
  const [busy, startBusy] = useTransition();
  const end = () => {
    if (busy) return;
    startBusy(async () => {
      const result = await clearCapOverrideAction({ ownerId }).catch(() => null);
      if (!result || !result.ok) {
        onFailed({ tone: "critical", text: result && !result.ok ? result.message : "The server could not be reached. Nothing was changed." });
        return;
      }
      onEnded({
        tone: "good",
        text: result.value.changed ? `Ended. The cap is back to the plan's ${formatUsd(planCapMicroUsd)} a day; the change is in the audit log.` : "It had already ended; nothing changed.",
      });
      router.refresh();
    });
  };
  return (
    <div className="flex flex-col gap-2 rounded-md border border-(--ed-border) p-3 text-sm">
      <p ref={headingRef} tabIndex={-1} className="font-medium focus-visible:outline-2 focus-visible:outline-(--ed-focus)">
        Raised to {formatUsd(override.capMicroUsd)} a day until {formatUtc(override.expiresAt)}
      </p>
      <p className="text-(--ed-text-2)">
        Plan cap {formatUsd(planCapMicroUsd)} · set {formatUtc(override.setAt)} · reason: {override.reason}
      </p>
      <button type="button" className={cn(buttonClass, "self-start")} disabled={busy} onClick={end}>
        {busy ? "Ending…" : "End it now"}
      </button>
    </div>
  );
}

function RaiseForm({
  ownerId,
  label,
  planCapMicroUsd,
  freePlan,
  signedInRecently,
  amountRef,
  onSaved,
  onFailed,
}: {
  ownerId: string;
  label: string;
  planCapMicroUsd: number;
  freePlan: boolean;
  signedInRecently: boolean;
  amountRef: RefObject<HTMLInputElement | null>;
  onSaved(feedback: Feedback): void;
  onFailed(feedback: Feedback): void;
}) {
  const router = useRouter();
  const ids = { amount: useId(), expiry: useId(), reason: useId(), confirm: useId(), note: useId() };
  const [amount, setAmount] = useState("");
  const [expiry, setExpiry] = useState<ExpiryChoice>("end_of_day");
  const [reason, setReason] = useState("");
  const [confirm, setConfirm] = useState("");
  const [fresh, setFresh] = useState(signedInRecently);
  const [saving, startSaving] = useTransition();

  const parsed = parseUsdInput(amount);
  const refusal = parsed === null ? (amount.trim() === "" ? null : "INVALID_BUDGET") : capOverrideRefusal(parsed, planCapMicroUsd);
  const ready = parsed !== null && refusal === null && reason.trim().length > 0;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (saving || !ready || parsed === null) return;
    startSaving(async () => {
      const result = await setCapOverrideAction({ ownerId, capMicroUsd: parsed, expiry, reason, confirm }).catch(() => null);
      if (!result) {
        onFailed({ tone: "critical", text: "The server could not be reached. Nothing was changed." });
      } else if (!result.ok) {
        if (result.code === "REAUTH_REQUIRED") setFresh(false);
        onFailed({ tone: "critical", text: result.message });
      } else {
        onSaved({ tone: "good", text: `Raised to ${formatUsd(result.value.override.capMicroUsd)} a day. The change and its confirmation are in the audit log.` });
        router.refresh();
      }
    });
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-4" aria-describedby={ids.note}>
      <div id={ids.note}>
        <Notice tone="warning">
          Raising a cap lets {label} spend more today, so it needs a recent sign-in and a typed confirmation. It never lifts
          {freePlan ? " the $1.50 Free lifetime ceiling," : ""} the pool budgets or the kill switches, and it ends on its own.
        </Notice>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <label htmlFor={ids.amount} className="text-sm font-medium">New daily cap, dollars</label>
          <input
            ref={amountRef}
            id={ids.amount}
            inputMode="decimal"
            autoComplete="off"
            className={cn(controlClass, "max-w-40 tabular-nums")}
            value={amount}
            aria-invalid={refusal !== null || undefined}
            aria-describedby={`${ids.amount}-hint${refusal !== null ? ` ${ids.amount}-error` : ""}`}
            onChange={(event) => setAmount(event.target.value)}
          />
          <p id={`${ids.amount}-hint`} className="text-xs text-(--ed-text-2)">
            Plan cap {formatUsd(planCapMicroUsd)} · at most {formatUsd(CAP_OVERRIDE_CEILING_MICRO_USD)}
          </p>
          {refusal !== null ? <p id={`${ids.amount}-error`} className="text-xs text-(--ed-danger)">{CONTROL_ERRORS[refusal]}</p> : null}
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor={ids.expiry} className="text-sm font-medium">Ends</label>
          <select id={ids.expiry} className={cn(controlClass, "max-w-64")} value={expiry} onChange={(event) => setExpiry(event.target.value as ExpiryChoice)}>
            {EXPIRY_CHOICES.map((choice) => <option key={choice} value={choice}>{EXPIRY_LABELS[choice]}</option>)}
          </select>
          <p className="text-xs text-(--ed-text-2)">Never later than midnight UTC.</p>
        </div>
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor={ids.reason} className="text-sm font-medium">Reason</label>
        <textarea id={ids.reason} rows={2} maxLength={300} required className={cn(controlClass, "py-1.5")} value={reason} onChange={(event) => setReason(event.target.value)} />
      </div>
      <StrongAuthStep fresh={fresh} mechanism={STEP_UP_MECHANISM} onConfirmed={() => { setFresh(true); router.refresh(); }} simulate={simulate} />
      <div className="flex flex-col gap-1">
        <label htmlFor={ids.confirm} className="text-sm font-medium">Type “{CONFIRM_PHRASE}” to raise the cap</label>
        <input id={ids.confirm} autoComplete="off" className={cn(controlClass, "max-w-56")} value={confirm} onChange={(event) => setConfirm(event.target.value)} />
      </div>
      <button type="submit" className={cn(primaryButton, "self-start")} disabled={saving || !ready}>
        {saving ? "Raising…" : "Raise the cap"}
      </button>
    </form>
  );
}
