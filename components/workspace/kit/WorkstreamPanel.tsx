"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import type { RoleKey } from "@/lib/workspace/contracts/roster";
import { DefaultLink } from "./DefaultLink";
import { EmployeeAvatar } from "./EmployeeAvatar";
import { StatusPill } from "./StatusPill";
import { BTN_PRIMARY, BTN_SECONDARY, CARD, EYEBROW, FOCUS } from "./styles";
import { EmptyState } from "./states";
import {
  ROLE_LABELS,
  type EmployeeStatus,
  type LinkComponent,
  type OutputStatus,
  type WorkstreamKind,
} from "./types";

export type WorkstreamKindConfig = {
  role: RoleKey;
  /** Shown when the workstream has no blockers. */
  noBlockers: (name: string) => string;
};

/** One typed config per kind. Product-specific data (brief, outputs, files) arrives as props. */
export const WORKSTREAM_KIND_CONFIG: Record<WorkstreamKind, WorkstreamKindConfig> = {
  brand: { role: "brand", noBlockers: (name) => `${name} needs only your OK and your final logo upload.` },
  landing: { role: "landing", noBlockers: (name) => `${name} is clear to keep going on the site.` },
  seo: { role: "seo", noBlockers: (name) => `${name} is clear to keep going on the search work.` },
  marketing: { role: "marketing", noBlockers: (name) => `${name} is clear to keep going on the plan.` },
  email: { role: "email", noBlockers: (name) => `${name} is clear to keep going on the sequence.` },
  social: { role: "social", noBlockers: (name) => `${name} is clear to keep going on the posts.` },
  engineering: { role: "engineering", noBlockers: (name) => `${name} is clear to keep going on the build pack.` },
  ads: { role: "ads", noBlockers: (name) => `${name} is clear to keep going on the test.` },
};

export type WorkstreamOutput = {
  id: string;
  title: string;
  /** Mono label, e.g. "Board". */
  kindLabel: string;
  status: OutputStatus;
  preview?: ReactNode;
  /** The founder's last change note, shown after a change request. */
  changeNote?: string;
};

export type WorkstreamBlocker = {
  waitingOn: RoleKey | "you";
  detail: string;
  severity: "soft" | "blocking";
};

export type WorkstreamHold = { holder: RoleKey | "you"; detail?: string };

export type WorkstreamData = {
  kind: WorkstreamKind;
  employee: { id: string; name: string; specialty: string; status: EmployeeStatus; statusDetail: string };
  whyHired: string;
  brief: readonly string[];
  outputs: readonly WorkstreamOutput[];
  files: readonly { name: string; meta?: string }[];
  /** This employee waits on these. */
  blockers: readonly WorkstreamBlocker[];
  /** These wait on this employee. */
  holds: readonly WorkstreamHold[];
};

export function validateChangeNote(note: string, name: string, title: string): string | null {
  return note.trim().length === 0 ? `Write what ${name} should change in ${title} first.` : null;
}

export function approvedMessage(title: string): string {
  return `${title} approved. Wren will route this.`;
}

export function changesSentMessage(name: string, title: string): string {
  return `Sent to ${name}. A new version of ${title} comes back here, and Wren will flag it in chat.`;
}

export function countOutputs(outputs: readonly WorkstreamOutput[]) {
  return {
    total: outputs.length,
    waiting: outputs.filter((o) => o.status === "ready").length,
    approved: outputs.filter((o) => o.status === "approved").length,
  };
}

function holderLabel(holder: RoleKey | "you"): string {
  return holder === "you" ? "You" : ROLE_LABELS[holder];
}

export type WorkstreamPanelProps = {
  businessName: string;
  data: WorkstreamData;
  onApproveOutput: (outputId: string) => void;
  onRequestChanges: (outputId: string, note: string) => void;
  /** Extra content under Outputs, e.g. build-pack prompt cards. */
  extra?: ReactNode;
  linkComponent?: LinkComponent;
  filesHref?: string;
};

function OutputCard({
  output,
  employeeName,
  onApprove,
  onRequestChanges,
}: {
  output: WorkstreamOutput;
  employeeName: string;
  onApprove: (id: string) => void;
  onRequestChanges: (id: string, note: string) => void;
}) {
  const [asking, setAsking] = useState(false);
  const [note, setNote] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const formId = `${output.id}-ask`;
  const noteId = `${output.id}-note`;
  const errorId = `${output.id}-note-error`;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const problem = validateChangeNote(note, employeeName, output.title);
    setError(problem);
    if (problem) return;
    onRequestChanges(output.id, note.trim());
    setMessage(changesSentMessage(employeeName, output.title));
    setAsking(false);
    setNote("");
  }

  return (
    <li data-output={output.id} className={cn(CARD, "flex flex-col gap-3 p-4")}>
      <div className="flex flex-wrap items-center gap-2">
        <p className="font-mono text-[11px] uppercase text-home-ink-3">{output.kindLabel}</p>
        <StatusPill set="output" status={output.status} className="ml-auto" />
      </div>
      <h3 className="text-[15px] font-semibold text-home-ink">{output.title}</h3>
      {output.preview ? <div>{output.preview}</div> : null}
      {output.changeNote ? (
        <p className="text-[13px] text-home-ink-2">
          <strong className="font-semibold">Your note to {employeeName}:</strong> “{output.changeNote}”
        </p>
      ) : null}
      {output.status === "approved" ? (
        <p className="text-[13px] font-medium text-home-sage-ink">Approved · Wren will route this</p>
      ) : output.status === "ready" ? (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={BTN_PRIMARY}
            onClick={() => {
              onApprove(output.id);
              setMessage(approvedMessage(output.title));
              setAsking(false);
            }}
          >
            Looks good<span className="sr-only"> · {output.title}</span>
          </button>
          <button
            type="button"
            className={BTN_SECONDARY}
            aria-expanded={asking}
            aria-controls={formId}
            onClick={() => setAsking((open) => !open)}
          >
            Ask for changes<span className="sr-only"> · {output.title}</span>
          </button>
        </div>
      ) : null}
      {asking ? (
        <form id={formId} onSubmit={handleSubmit} noValidate className="flex flex-col gap-2">
          <label htmlFor={noteId} className="text-[13px] font-medium text-home-ink">
            What should {employeeName} change in “{output.title}”?
          </label>
          <textarea
            id={noteId}
            rows={3}
            value={note}
            placeholder="Be specific — e.g. what to keep, what to drop."
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : undefined}
            onChange={(event) => setNote(event.target.value)}
            className={cn(
              "rounded-lg border border-home-ink-3 bg-home-card px-3 py-2 text-sm text-home-ink placeholder:text-home-ink-3",
              FOCUS,
            )}
          />
          {error ? (
            <p id={errorId} className="text-[13px] text-home-clay-ink">
              {error}
            </p>
          ) : null}
          <div className="flex gap-2">
            <button type="submit" className={BTN_PRIMARY}>
              Send to {employeeName}
            </button>
            <button
              type="button"
              className={BTN_SECONDARY}
              onClick={() => {
                setAsking(false);
                setError(null);
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      ) : null}
      <p role="status" aria-live="polite" className="min-h-5 text-[13px] text-home-ink-2">
        {message}
      </p>
    </li>
  );
}

export function WorkstreamPanel({
  businessName,
  data,
  onApproveOutput,
  onRequestChanges,
  extra,
  linkComponent: Link = DefaultLink,
  filesHref,
}: WorkstreamPanelProps) {
  const config = WORKSTREAM_KIND_CONFIG[data.kind];
  const { employee } = data;
  const roleLabel = ROLE_LABELS[config.role];
  const counts = countOutputs(data.outputs);
  const headingId = `ws-${data.kind}-h`;
  return (
    <article aria-labelledby={headingId} data-kind={data.kind} className="flex flex-col gap-8">
      <header className="flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <EmployeeAvatar name={employee.name} role={config.role} size="lg" showAiBadge />
          <p className={EYEBROW}>AI employee · {businessName} workstream</p>
        </div>
        <h1 id={headingId} className="font-editorial text-3xl text-home-ink">
          {employee.name} · <em>{roleLabel}</em>
        </h1>
        <p className="text-sm text-home-ink-2">{employee.specialty}</p>
        <p className="text-[13px] text-home-ink-2">
          Reports to <strong className="font-semibold text-home-ink">Wren, Crew Lead</strong> · Why hired:{" "}
          {data.whyHired}
        </p>
        <p className="flex flex-wrap items-center gap-2 text-[13px] text-home-ink">
          <StatusPill set="employee" status={employee.status} />
          <span>{employee.statusDetail}</span>
          <span className="font-mono text-[11px] text-home-ink-3">
            {counts.total} outputs · {counts.waiting} waiting · {counts.approved} approved
          </span>
        </p>
      </header>

      <section aria-labelledby={`${headingId}-brief`} className="flex flex-col gap-2">
        <h2 id={`${headingId}-brief`} className="font-editorial text-xl text-home-ink">
          Brief <em>from the Blueprint</em>
        </h2>
        <ul className="list-disc pl-5 text-sm text-home-ink">
          {data.brief.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </section>

      <section aria-labelledby={`${headingId}-outputs`} className="flex flex-col gap-3">
        <h2 id={`${headingId}-outputs`} className="font-editorial text-xl text-home-ink">
          Outputs <em>for your OK</em>
        </h2>
        <p className="text-[13px] text-home-ink-2">
          Approvals go to Wren, who routes them to the rest of the team.
        </p>
        <ul className="flex flex-col gap-3">
          {data.outputs.map((output) => (
            <OutputCard
              key={output.id}
              output={output}
              employeeName={employee.name}
              onApprove={onApproveOutput}
              onRequestChanges={onRequestChanges}
            />
          ))}
        </ul>
        {extra}
      </section>

      <section aria-labelledby={`${headingId}-files`} className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <h2 id={`${headingId}-files`} className="font-editorial text-xl text-home-ink">
            Files <em>{employee.name} owns</em>
          </h2>
          {filesHref ? (
            <Link
              href={filesHref}
              className={cn("ml-auto inline-flex min-h-6 items-center text-[13px] underline", FOCUS)}
            >
              Open all files
            </Link>
          ) : null}
        </div>
        <ul className="flex flex-col gap-1">
          {data.files.map((file) => (
            <li key={file.name} className="flex items-center gap-2 text-sm text-home-ink">
              <FileText aria-hidden="true" className="size-4 text-home-ink-3" />
              <span className="font-mono text-[13px]">{file.name}</span>
              {file.meta ? <span className="text-xs text-home-ink-3">{file.meta}</span> : null}
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby={`${headingId}-blockers`} className="flex flex-col gap-2">
        <h2 id={`${headingId}-blockers`} className="font-editorial text-xl text-home-ink">
          Blockers
        </h2>
        {data.blockers.length === 0 ? (
          <EmptyState>No blockers. {config.noBlockers(employee.name)}</EmptyState>
        ) : null}
        {data.blockers.length > 0 ? (
          <div>
            <h3 className="text-sm font-semibold text-home-ink">{employee.name} is waiting on</h3>
            <ul className="mt-1 flex flex-col gap-1 text-sm text-home-ink">
              {data.blockers.map((b) => (
                <li key={`${b.waitingOn}-${b.detail}`}>
                  <strong className="font-semibold">
                    {b.severity === "blocking" ? "Blocking" : "Soft"} · {holderLabel(b.waitingOn)}
                  </strong>{" "}
                  — {b.detail}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {data.holds.length > 0 ? (
          <div>
            <h3 className="text-sm font-semibold text-home-ink">Waiting on {employee.name}</h3>
            <ul className="mt-1 flex flex-col gap-1 text-sm text-home-ink">
              {data.holds.map((h) => (
                <li key={h.holder}>
                  <strong className="font-semibold">{holderLabel(h.holder)}</strong>
                  {h.detail ? ` — ${h.detail}` : ""}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>
    </article>
  );
}
