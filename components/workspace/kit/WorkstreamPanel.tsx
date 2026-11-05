"use client";

import {
  createElement,
  useEffect,
  useId,
  useRef,
  useState,
  type ComponentPropsWithRef,
  type FormEvent,
  type ReactNode,
} from "react";
import { FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import type { RoleKey } from "@/lib/workspace/contracts/roster";
import { DefaultLink } from "./DefaultLink";
import { EmployeeAvatar } from "./EmployeeAvatar";
import { StatusPill } from "./StatusPill";
import { BTN_PRIMARY, BTN_SECONDARY, CARD, EYEBROW, FOCUS } from "./styles";
import { EmptyState } from "./states";
import {
  pluralize,
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
  /** A decision is in flight: buttons stay focusable but ignore activation. */
  pending?: boolean;
  /** Owned by the parent (e.g. "Brand kit approved. Wren will route this."). Announced politely. */
  statusMessage?: string;
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

type HeadingTag = "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
const headingTag = (level: number): HeadingTag => `h${Math.min(6, Math.max(1, level))}` as HeadingTag;

function Heading({ level, ...props }: { level: number } & ComponentPropsWithRef<"h1">) {
  return createElement(headingTag(level), props);
}

export type WorkstreamPanelProps = {
  businessName: string;
  data: WorkstreamData;
  /** Level of the page title (default 1). Sections sit one below, output titles two below. */
  headingLevel?: 1 | 2 | 3;
  onApproveOutput: (outputId: string) => void;
  onRequestChanges: (outputId: string, note: string) => void;
  /** Extra content under Outputs, e.g. build-pack prompt cards (their headings are level `headingLevel + 1`). */
  extra?: ReactNode;
  linkComponent?: LinkComponent;
  filesHref?: string;
};

function OutputCard({
  output,
  employeeName,
  titleLevel,
  onApprove,
  onRequestChanges,
}: {
  output: WorkstreamOutput;
  employeeName: string;
  titleLevel: number;
  onApprove: (id: string) => void;
  onRequestChanges: (id: string, note: string) => void;
}) {
  const uid = useId();
  const [asking, setAsking] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const askButtonRef = useRef<HTMLButtonElement>(null);
  const noteRef = useRef<HTMLTextAreaElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const formId = `${uid}-ask`;
  const noteId = `${uid}-note`;
  const errorId = `${uid}-note-error`;
  const pending = output.pending === true;

  useEffect(() => {
    if (asking) noteRef.current?.focus();
  }, [asking]);

  function closeForm() {
    setAsking(false);
    setError(null);
    askButtonRef.current?.focus();
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const problem = validateChangeNote(note, employeeName, output.title);
    if (problem) {
      // Focus the textarea so its aria-describedby error is read.
      setError(problem);
      noteRef.current?.focus();
      return;
    }
    onRequestChanges(output.id, note.trim());
    setNote("");
    closeForm();
  }

  return (
    <li data-output={output.id} aria-busy={pending} className={cn(CARD, "flex flex-col gap-3 p-4")}>
      <div className="flex flex-wrap items-center gap-2">
        <p className="font-mono text-[11px] uppercase text-home-ink-3">{output.kindLabel}</p>
        <StatusPill set="output" status={output.status} className="ml-auto" />
      </div>
      <Heading level={titleLevel} ref={titleRef} tabIndex={-1} className="text-[15px] font-semibold text-home-ink outline-none">
        {output.title}
      </Heading>
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
            aria-disabled={pending || undefined}
            onClick={() => {
              if (pending) return;
              onApprove(output.id);
              // This button may unmount once the parent marks the output approved.
              titleRef.current?.focus();
            }}
          >
            Looks good<span className="sr-only"> · {output.title}</span>
          </button>
          <button
            ref={askButtonRef}
            type="button"
            className={BTN_SECONDARY}
            aria-expanded={asking}
            aria-controls={formId}
            aria-disabled={pending || undefined}
            onClick={() => {
              if (!pending) setAsking((open) => !open);
            }}
          >
            Ask for changes<span className="sr-only"> · {output.title}</span>
          </button>
        </div>
      ) : null}
      <form
        id={formId}
        hidden={!asking}
        onSubmit={handleSubmit}
        noValidate
        className="flex flex-col gap-2"
      >
        <label htmlFor={noteId} className="text-[13px] font-medium text-home-ink">
          What should {employeeName} change in “{output.title}”?
        </label>
        <textarea
          id={noteId}
          ref={noteRef}
          rows={3}
          value={note}
          placeholder="Be specific — e.g. what to keep, what to drop."
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          onChange={(event) => {
            setNote(event.target.value);
            if (error) setError(null);
          }}
          className={cn(
            "rounded-lg border border-home-ink-3 bg-home-card px-3 py-2 text-sm text-home-ink placeholder:text-home-ink-3",
            FOCUS,
          )}
        />
        {error ? (
          <p id={errorId} role="alert" className="text-[13px] text-home-clay-ink">
            {error}
          </p>
        ) : null}
        <div className="flex gap-2">
          <button type="submit" className={BTN_PRIMARY} aria-disabled={pending || undefined}>
            Send to {employeeName}
          </button>
          <button type="button" className={BTN_SECONDARY} onClick={closeForm}>
            Cancel
          </button>
        </div>
      </form>
      <p role="status" aria-live="polite" className="min-h-5 text-[13px] text-home-ink-2">
        {pending ? "Sending your decision…" : output.statusMessage}
      </p>
    </li>
  );
}

export function WorkstreamPanel({
  businessName,
  data,
  headingLevel = 1,
  onApproveOutput,
  onRequestChanges,
  extra,
  linkComponent: Link = DefaultLink,
  filesHref,
}: WorkstreamPanelProps) {
  const uid = useId();
  const config = WORKSTREAM_KIND_CONFIG[data.kind];
  const { employee } = data;
  const roleLabel = ROLE_LABELS[config.role];
  const counts = countOutputs(data.outputs);
  const headingId = `${uid}-h`;
  return (
    <article aria-labelledby={headingId} data-kind={data.kind} className="flex flex-col gap-8">
      <header className="flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <EmployeeAvatar name={employee.name} role={config.role} size="lg" showAiBadge />
          <p className={EYEBROW}>AI employee · {businessName} workstream</p>
        </div>
        <Heading level={headingLevel} id={headingId} className="font-editorial text-3xl text-home-ink">
          {employee.name} · <em>{roleLabel}</em>
        </Heading>
        <p className="text-sm text-home-ink-2">{employee.specialty}</p>
        <p className="text-[13px] text-home-ink-2">
          Reports to <strong className="font-semibold text-home-ink">Wren, Crew Lead</strong> · Why hired:{" "}
          {data.whyHired}
        </p>
        <p className="flex flex-wrap items-center gap-2 text-[13px] text-home-ink">
          <StatusPill set="employee" status={employee.status} />
          <span>{employee.statusDetail}</span>
          <span className="font-mono text-[11px] text-home-ink-3">
            {pluralize(counts.total, "output", "outputs")} · {counts.waiting} waiting · {counts.approved} approved
          </span>
        </p>
      </header>

      <section aria-labelledby={`${uid}-brief`} className="flex flex-col gap-2">
        <Heading level={headingLevel + 1} id={`${uid}-brief`} className="font-editorial text-xl text-home-ink">
          Brief <em>from the Blueprint</em>
        </Heading>
        <ul className="list-disc pl-5 text-sm text-home-ink">
          {data.brief.map((line, i) => (
            <li key={`${i}-${line}`}>{line}</li>
          ))}
        </ul>
      </section>

      <section aria-labelledby={`${uid}-outputs`} className="flex flex-col gap-3">
        <Heading level={headingLevel + 1} id={`${uid}-outputs`} className="font-editorial text-xl text-home-ink">
          Outputs <em>for your OK</em>
        </Heading>
        <p className="text-[13px] text-home-ink-2">
          Approvals go to Wren, who routes them to the rest of the team.
        </p>
        <ul className="flex flex-col gap-3">
          {data.outputs.map((output) => (
            <OutputCard
              key={output.id}
              output={output}
              employeeName={employee.name}
              titleLevel={headingLevel + 2}
              onApprove={onApproveOutput}
              onRequestChanges={onRequestChanges}
            />
          ))}
        </ul>
        {extra}
      </section>

      <section aria-labelledby={`${uid}-files`} className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <Heading level={headingLevel + 1} id={`${uid}-files`} className="font-editorial text-xl text-home-ink">
            Files <em>{employee.name} owns</em>
          </Heading>
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
          {data.files.map((file, i) => (
            <li key={`${i}-${file.name}`} className="flex items-center gap-2 text-sm text-home-ink">
              <FileText aria-hidden="true" className="size-4 text-home-ink-3" />
              <span className="font-mono text-[13px]">{file.name}</span>
              {file.meta ? <span className="text-xs text-home-ink-3">{file.meta}</span> : null}
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby={`${uid}-blockers`} className="flex flex-col gap-2">
        <Heading level={headingLevel + 1} id={`${uid}-blockers`} className="font-editorial text-xl text-home-ink">
          Blockers
        </Heading>
        {data.blockers.length === 0 ? (
          <EmptyState>No blockers. {config.noBlockers(employee.name)}</EmptyState>
        ) : null}
        {data.blockers.length > 0 ? (
          <div>
            <Heading level={headingLevel + 2} className="text-sm font-semibold text-home-ink">{employee.name} is waiting on</Heading>
            <ul className="mt-1 flex flex-col gap-1 text-sm text-home-ink">
              {data.blockers.map((b, i) => (
                <li key={`${i}-${b.waitingOn}-${b.detail}`}>
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
            <Heading level={headingLevel + 2} className="text-sm font-semibold text-home-ink">Waiting on {employee.name}</Heading>
            <ul className="mt-1 flex flex-col gap-1 text-sm text-home-ink">
              {data.holds.map((h, i) => (
                <li key={`${i}-${h.holder}-${h.detail ?? ""}`}>
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
