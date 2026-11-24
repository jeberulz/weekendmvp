import { AlertTriangle, CheckCircle2, Info, OctagonAlert } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export function PageTitle({ title, description }: { title: string; description: ReactNode }) {
  return (
    <div className="mb-6">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-1 max-w-3xl text-sm text-(--ed-text-2)">{description}</p>
    </div>
  );
}

export function Section({
  id,
  title,
  description,
  actions,
  children,
}: {
  id: string;
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="mb-10">
      <div className="mb-3 flex flex-wrap items-end gap-x-4 gap-y-2">
        <div className="min-w-0 flex-1">
          <h2 id={id} className="text-lg font-semibold">{title}</h2>
          {description ? <p className="mt-0.5 max-w-3xl text-sm text-(--ed-text-2)">{description}</p> : null}
        </div>
        {actions}
      </div>
      {children}
    </section>
  );
}

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("rounded-lg border border-(--ed-border) bg-(--ed-surface) p-4", className)}>{children}</div>;
}

export function StatTile({ label, value, detail }: { label: string; value: ReactNode; detail?: ReactNode }) {
  return (
    <Card>
      <dt className="text-sm text-(--ed-text-2)">{label}</dt>
      <dd className="mt-1 text-2xl font-semibold tabular-nums">{value}</dd>
      {detail ? <dd className="mt-1 text-xs text-(--ed-text-2)">{detail}</dd> : null}
    </Card>
  );
}

export function StatGrid({ children, label }: { children: ReactNode; label: string }) {
  return (
    <dl aria-label={label} className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {children}
    </dl>
  );
}

type Tone = "info" | "warning" | "critical" | "good";

const TONE: Record<Tone, { className: string; icon: typeof Info; label: string }> = {
  info: { className: "border-(--ed-info) bg-(--ed-info-bg) text-(--ed-info)", icon: Info, label: "Note" },
  warning: { className: "border-(--ed-warning) bg-(--ed-warning-bg) text-(--ed-warning)", icon: AlertTriangle, label: "Warning" },
  critical: { className: "border-(--ed-danger) bg-(--ed-danger-bg) text-(--ed-danger)", icon: OctagonAlert, label: "Alert" },
  good: { className: "border-(--ed-success) bg-(--ed-success-bg) text-(--ed-success)", icon: CheckCircle2, label: "OK" },
};

export function Notice({ tone = "info", children }: { tone?: Tone; children: ReactNode }) {
  const { className, icon: Icon, label } = TONE[tone];
  return (
    <div role={tone === "critical" || tone === "warning" ? "status" : undefined} className={cn("mb-4 flex gap-2 rounded-md border px-3 py-2 text-sm", className)}>
      <Icon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      <p>
        <span className="sr-only">{label}: </span>
        {children}
      </p>
    </div>
  );
}

/** A status label that never relies on colour: icon + words. */
export function StatusBadge({ tone, children }: { tone: Tone; children: ReactNode }) {
  const { className, icon: Icon } = TONE[tone];
  return (
    <span className={cn("inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-xs font-semibold", className)}>
      <Icon aria-hidden="true" className="size-3.5 shrink-0" />
      {children}
    </span>
  );
}

/**
 * A scrollable, keyboard-reachable table region. Its name is the heading it
 * points at plus "table", so it never repeats the name of the section around it.
 */
export function TableRegion({ labelledBy, children }: { labelledBy: string; children: ReactNode }) {
  const suffixId = `${labelledBy}-table-suffix`;
  return (
    // A focusable scroll container so keyboard users can scroll wide tables.
    <div role="region" aria-labelledby={`${labelledBy} ${suffixId}`} tabIndex={0} className="overflow-x-auto rounded-lg border border-(--ed-border) bg-(--ed-surface) focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-(--ed-focus)">
      <span id={suffixId} hidden>table</span>
      {children}
    </div>
  );
}

export const th = "whitespace-nowrap border-b border-(--ed-border) bg-(--ed-sunk) px-3 py-2 text-left text-xs font-semibold text-(--ed-text-2)";
export const thNum = cn(th, "text-right");
export const td = "whitespace-nowrap border-b border-(--ed-border) px-3 py-2 align-top";
export const tdNum = cn(td, "text-right tabular-nums");
