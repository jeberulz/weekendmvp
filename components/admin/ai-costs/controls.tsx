"use client";

import { useRouter } from "next/navigation";
import { useId, useState, useTransition, type FormEvent } from "react";

import { findAccountAction, setCohortAction, simulateSignInAction, updateSpendControlsAction } from "@/app/admin/ai/_actions/controls";
import { StrongAuthStep } from "@/components/admin/editorial/common/StrongAuthStep";
import {
  CONFIRM_PHRASE,
  POOL_LABELS,
  SWITCH_KEYS,
  SWITCH_LABELS,
  budgetAllowed,
  describeRisk,
  parseUsdInput,
  riskReasons,
  type KillSwitches,
  type Pool,
  type SpendControls,
} from "@/lib/admin/ai-costs/controls";
import type { CohortMember, FoundAccount } from "@/lib/admin/ai-costs/controls-server";
import { formatUtc } from "@/lib/admin/ai-costs/labels";
import { MICRO_USD_PER_USD, formatUsd } from "@/lib/admin/ai-costs/money";
import { cn } from "@/lib/utils";
import { buttonClass, controlClass } from "./interactive";
import { Notice, StatusBadge, TableRegion, td, th } from "./primitives";

type Feedback = { tone: "good" | "critical"; text: string } | null;

const primaryButton = cn(buttonClass, "border-(--ed-text) bg-(--ed-text) text-white hover:bg-(--ed-primary-hover) disabled:cursor-not-allowed disabled:opacity-50");

const STEP_UP_MECHANISM = "A fresh sign-in with this account's own sign-in method within the last 10 minutes. Risky control changes ask for it.";

async function simulate(): Promise<{ ok: true } | { ok: false; message: string }> {
  const result = await simulateSignInAction();
  return result.ok ? { ok: true } : { ok: false, message: result.message };
}

function FeedbackLine({ feedback }: { feedback: Feedback }) {
  return (
    <p role={feedback?.tone === "critical" ? "alert" : "status"} className={cn("text-sm", feedback?.tone === "critical" ? "text-(--ed-danger)" : "text-(--ed-success)")}>
      {feedback?.text ?? ""}
    </p>
  );
}

function dollars(microUsd: number): string {
  return (microUsd / MICRO_USD_PER_USD).toFixed(2);
}

/* Spend controls --------------------------------------------------------- */

export function SpendControlsForm({
  version,
  current,
  spentToday,
  signedInRecently,
}: {
  version: number | null;
  current: SpendControls;
  spentToday: Readonly<Record<Pool, number>>;
  signedInRecently: boolean;
}) {
  const router = useRouter();
  const ids = { free: useId(), paid: useId(), confirm: useId(), risks: useId() };
  const [budgets, setBudgets] = useState<Record<Pool, string>>({ free: dollars(current.freeBudgetMicroUsd), paid: dollars(current.paidBudgetMicroUsd) });
  const [switches, setSwitches] = useState<KillSwitches>(current.killSwitches);
  const [confirm, setConfirm] = useState("");
  const [fresh, setFresh] = useState(signedInRecently);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [saving, startSaving] = useTransition();

  const parsed: Record<Pool, number | null> = { free: parseUsdInput(budgets.free), paid: parseUsdInput(budgets.paid) };
  const valid = parsed.free !== null && parsed.paid !== null && budgetAllowed(parsed.free) && budgetAllowed(parsed.paid);
  const next: SpendControls | null = valid
    ? { freeBudgetMicroUsd: parsed.free ?? 0, paidBudgetMicroUsd: parsed.paid ?? 0, killSwitches: switches }
    : null;
  const risks = next ? riskReasons(current, next, spentToday) : [];
  const changed = next !== null && (
    next.freeBudgetMicroUsd !== current.freeBudgetMicroUsd ||
    next.paidBudgetMicroUsd !== current.paidBudgetMicroUsd ||
    SWITCH_KEYS.some((key) => next.killSwitches[key] !== current.killSwitches[key])
  );

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (saving || !next) return;
    startSaving(async () => {
      const result = await updateSpendControlsAction({
        expectedVersion: version,
        freeBudgetMicroUsd: next.freeBudgetMicroUsd,
        paidBudgetMicroUsd: next.paidBudgetMicroUsd,
        killSwitches: { ...next.killSwitches },
        confirm: risks.length > 0 ? confirm : null,
      }).catch(() => null);
      if (!result) {
        setFeedback({ tone: "critical", text: "The server could not be reached. Nothing was changed." });
      } else if (!result.ok) {
        if (result.code === "REAUTH_REQUIRED") setFresh(false);
        setFeedback({ tone: "critical", text: result.message });
      } else {
        setConfirm("");
        setFeedback({ tone: "good", text: result.value.risky ? "Saved. The change and its confirmation are in the audit log." : "Saved. The change is in the audit log." });
        router.refresh();
      }
    });
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-4" aria-describedby={risks.length > 0 ? ids.risks : undefined}>
      <div className="grid gap-4 sm:grid-cols-2">
        {(["free", "paid"] as const).map((pool) => {
          const value = parsed[pool];
          const invalid = value === null || !budgetAllowed(value);
          const errorId = `${ids[pool]}-error`;
          return (
            <div key={pool} className="flex flex-col gap-1">
              <label htmlFor={ids[pool]} className="text-sm font-medium">{POOL_LABELS[pool]} budget, dollars a day</label>
              <input
                id={ids[pool]}
                inputMode="decimal"
                autoComplete="off"
                className={cn(controlClass, "max-w-40 tabular-nums")}
                value={budgets[pool]}
                aria-invalid={invalid || undefined}
                aria-describedby={`${ids[pool]}-hint${invalid ? ` ${errorId}` : ""}`}
                onChange={(event) => setBudgets((prev) => ({ ...prev, [pool]: event.target.value }))}
              />
              <p id={`${ids[pool]}-hint`} className="text-xs text-(--ed-text-2)">
                Now {formatUsd(pool === "free" ? current.freeBudgetMicroUsd : current.paidBudgetMicroUsd)} · spent today {formatUsd(spentToday[pool])} · at most $100
              </p>
              {invalid ? <p id={errorId} className="text-xs text-(--ed-danger)">Enter a dollar amount from 0 to 100, like 7 or 7.50.</p> : null}
            </div>
          );
        })}
      </div>

      <fieldset className="rounded-md border border-(--ed-border) p-3">
        <legend className="px-1 text-sm font-medium">Features</legend>
        <ul className="grid gap-2 sm:grid-cols-3">
          {SWITCH_KEYS.map((key) => {
            const on = !switches[key];
            return (
              <li key={key}>
                <label className="flex min-h-10 items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    role="switch"
                    className="size-4 accent-(--ed-text)"
                    checked={on}
                    onChange={(event) => setSwitches((prev) => ({ ...prev, [key]: !event.target.checked }))}
                  />
                  <span>{SWITCH_LABELS[key]}</span>
                  <span className="text-xs text-(--ed-text-2)">{on ? "on" : "off"}</span>
                </label>
              </li>
            );
          })}
        </ul>
        <p className="mt-2 text-xs text-(--ed-text-2)">Turning a feature off takes effect on the next call. Turning one back on needs the confirmation below.</p>
      </fieldset>

      {risks.length > 0 ? (
        <div className="flex flex-col gap-3">
          <div id={ids.risks}>
            <Notice tone="warning">This change {risks.map(describeRisk).join(", and ")}. It needs a recent sign-in and a typed confirmation.</Notice>
          </div>
          <StrongAuthStep fresh={fresh} mechanism={STEP_UP_MECHANISM} onConfirmed={() => { setFresh(true); router.refresh(); }} simulate={simulate} />
          <div className="flex flex-col gap-1">
            <label htmlFor={ids.confirm} className="text-sm font-medium">Type “{CONFIRM_PHRASE}” to make this change</label>
            <input id={ids.confirm} autoComplete="off" className={cn(controlClass, "max-w-56")} value={confirm} onChange={(event) => setConfirm(event.target.value)} />
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" className={primaryButton} disabled={saving || !changed}>
          {saving ? "Saving…" : "Save controls"}
        </button>
        {!changed && valid ? <span className="text-xs text-(--ed-text-2)">No changes yet.</span> : null}
      </div>
      <FeedbackLine feedback={feedback} />
    </form>
  );
}

/* Beta cohort ------------------------------------------------------------ */

export function AddToCohort() {
  const router = useRouter();
  const emailId = useId();
  const [email, setEmail] = useState("");
  const [found, setFound] = useState<FoundAccount | null>(null);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [busy, startBusy] = useTransition();

  const find = (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setFeedback(null);
    startBusy(async () => {
      const result = await findAccountAction({ email }).catch(() => null);
      if (!result || !result.ok) {
        setFound(null);
        setFeedback({ tone: "critical", text: result && !result.ok ? result.message : "The server could not be reached." });
      } else {
        setFound(result.value);
      }
    });
  };

  const add = (ownerId: string) => {
    if (busy) return;
    startBusy(async () => {
      const result = await setCohortAction({ ownerId, allowed: true, reason: null }).catch(() => null);
      if (!result || !result.ok) {
        setFeedback({ tone: "critical", text: result && !result.ok ? result.message : "The server could not be reached." });
      } else {
        setFeedback({ tone: "good", text: result.value.changed ? "Added to the cohort." : "Already in the cohort; nothing changed." });
        setFound(null);
        setEmail("");
        router.refresh();
      }
    });
  };

  return (
    <div className="flex flex-col gap-3">
      <form onSubmit={find} className="flex flex-wrap items-end gap-2">
        <div className="flex flex-col gap-1">
          <label htmlFor={emailId} className="text-sm font-medium">Account email</label>
          <input
            id={emailId}
            type="email"
            autoComplete="off"
            className={cn(controlClass, "w-72 max-w-full")}
            value={email}
            onChange={(event) => { setEmail(event.target.value); setFound(null); }}
          />
        </div>
        <button type="submit" className={buttonClass} disabled={busy || email.trim().length === 0}>
          {busy && found === null ? "Finding…" : "Find account"}
        </button>
      </form>
      <div aria-live="polite">
        {found?.status === "invalid" ? <p className="text-sm text-(--ed-danger)">That is not an email address.</p> : null}
        {found?.status === "none" ? <p className="text-sm">No account uses that email. They need to sign up first.</p> : null}
        {found?.status === "many" ? <p className="text-sm text-(--ed-danger)">{found.count} accounts use that email, so none is added. Investigate before adding.</p> : null}
        {found?.status === "one" ? (
          <div className="flex flex-col gap-2 rounded-md border border-(--ed-border) p-3 text-sm">
            <p className="font-medium">{found.account.email}</p>
            <p className="text-(--ed-text-2)">
              Created {formatUtc(found.account.createdAt)} · {found.account.verified ? "email verified" : "email not verified"}
              {found.account.inCohort ? " · already in the cohort" : ""}
            </p>
            {found.account.inCohort ? null : found.account.verified ? (
              <button type="button" className={cn(primaryButton, "self-start")} disabled={busy} onClick={() => add(found.account.ownerId)}>
                {busy ? "Adding…" : `Add ${found.account.email} to the cohort`}
              </button>
            ) : (
              <p className="text-(--ed-danger)">This account has not verified its email, so it cannot join the cohort.</p>
            )}
          </div>
        ) : null}
      </div>
      <FeedbackLine feedback={feedback} />
    </div>
  );
}

function RemoveMember({ member }: { member: CohortMember }) {
  const router = useRouter();
  const reasonId = useId();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [busy, startBusy] = useTransition();
  const label = member.email ?? "this account";

  if (!open) {
    return (
      <button type="button" className={buttonClass} onClick={() => setOpen(true)} aria-label={`Remove ${label} from the cohort`}>
        Remove…
      </button>
    );
  }
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;
    startBusy(async () => {
      const result = await setCohortAction({ ownerId: member.ownerId, allowed: false, reason }).catch(() => null);
      if (!result || !result.ok) {
        setFeedback({ tone: "critical", text: result && !result.ok ? result.message : "The server could not be reached." });
      } else {
        setOpen(false);
        router.refresh();
      }
    });
  };
  return (
    <form onSubmit={submit} className="flex min-w-64 flex-col gap-2 whitespace-normal">
      <label htmlFor={reasonId} className="text-sm font-medium">Reason for removing {label}</label>
      <textarea id={reasonId} rows={2} maxLength={300} required className={cn(controlClass, "py-1.5")} value={reason} onChange={(event) => setReason(event.target.value)} />
      <div className="flex gap-2">
        <button type="submit" className={primaryButton} disabled={busy || reason.trim().length === 0}>{busy ? "Removing…" : "Remove from cohort"}</button>
        <button type="button" className={buttonClass} onClick={() => { setOpen(false); setReason(""); setFeedback(null); }}>Cancel</button>
      </div>
      <FeedbackLine feedback={feedback} />
    </form>
  );
}

export function CohortTable({ members, labelledBy }: { members: readonly CohortMember[]; labelledBy: string }) {
  if (members.length === 0) return <p className="text-sm text-(--ed-text-2)">Nobody is in the cohort yet.</p>;
  return (
    <TableRegion labelledBy={labelledBy}>
      <table className="w-full text-sm">
        <thead>
          <tr>
            <th scope="col" className={th}>Email</th>
            <th scope="col" className={th}>Email verified</th>
            <th scope="col" className={th}>Added (UTC)</th>
            <th scope="col" className={th}><span className="sr-only">Actions</span></th>
          </tr>
        </thead>
        <tbody>
          {members.map((member) => (
            <tr key={member.ownerId}>
              <th scope="row" className={cn(td, "text-left font-normal")}>{member.email ?? "No email"}</th>
              <td className={td}>{member.verified ? <StatusBadge tone="good">Verified</StatusBadge> : <StatusBadge tone="warning">Not verified</StatusBadge>}</td>
              <td className={cn(td, "tabular-nums")}>{formatUtc(member.addedAt)}</td>
              <td className={td}><RemoveMember member={member} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </TableRegion>
  );
}
