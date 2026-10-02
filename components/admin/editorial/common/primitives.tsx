import { AlertTriangle, CheckCircle2, CircleDashed, Info, OctagonAlert } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { formatAbsolute, formatRelative } from "@/lib/editorial/presentation/format";
import { cn } from "@/lib/utils";

export type Tone = "neutral" | "success" | "warning" | "danger" | "info";

const TONE_CLASSES: Record<Tone, string> = {
  neutral: "border-(--ed-border-strong) bg-(--ed-sunk) text-(--ed-text)",
  success: "border-(--ed-success) bg-(--ed-success-bg) text-(--ed-success)",
  warning: "border-(--ed-warning) bg-(--ed-warning-bg) text-(--ed-warning)",
  danger: "border-(--ed-danger) bg-(--ed-danger-bg) text-(--ed-danger)",
  info: "border-(--ed-info) bg-(--ed-info-bg) text-(--ed-info)",
};

const TONE_ICONS: Record<Tone, typeof Info | null> = {
  neutral: null,
  success: CheckCircle2,
  warning: AlertTriangle,
  danger: OctagonAlert,
  info: Info,
};

/** Status is always spelled out; colour and icon only reinforce the text. */
export function StatusBadge({ tone = "neutral", children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  const Icon = TONE_ICONS[tone];
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center gap-1 rounded-[5px] border px-1.5 py-0.5 text-xs font-medium leading-tight",
        TONE_CLASSES[tone],
        className,
      )}
    >
      {Icon ? <Icon aria-hidden="true" className="size-3.5 shrink-0" /> : null}
      <span className="min-w-0">{children}</span>
    </span>
  );
}

export function PageHeader({
  title,
  description,
  actions,
  eyebrow,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  eyebrow?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {eyebrow ? <div className="mb-1 text-sm text-(--ed-text-2)">{eyebrow}</div> : null}
        <h1 className="text-[1.75rem] font-semibold leading-tight tracking-tight">{title}</h1>
        {description ? <div className="mt-1.5 max-w-[70ch] text-[0.9375rem] text-(--ed-text-2)">{description}</div> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function PageBody({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("mx-auto flex w-full max-w-[1200px] flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8", className)}>{children}</div>;
}

/**
 * A region that scrolls sideways (wide tables on narrow screens). Focusable and
 * labelled, so keyboard users can scroll it too (WCAG 2.1.1).
 */
export function ScrollRegion({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div
      role="region"
      aria-label={label}
      tabIndex={0}
      className={cn(
        "overflow-x-auto focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-(--ed-focus)",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-2 rounded-lg border border-dashed border-(--ed-border-strong) bg-(--ed-surface) px-5 py-8">
      <CircleDashed aria-hidden="true" className="size-5 text-(--ed-text-2)" />
      <h2 className="text-base font-semibold">{title}</h2>
      {children ? <div className="max-w-[60ch] text-sm text-(--ed-text-2)">{children}</div> : null}
      {action ? <div className="mt-1">{action}</div> : null}
    </div>
  );
}

export function ErrorState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div role="alert" className="rounded-lg border border-(--ed-danger) bg-(--ed-danger-bg) px-5 py-4 text-(--ed-danger)">
      <h2 className="flex items-center gap-2 text-base font-semibold">
        <OctagonAlert aria-hidden="true" className="size-4" />
        {title}
      </h2>
      {children ? <div className="mt-1 text-sm">{children}</div> : null}
    </div>
  );
}

export function Time({ iso, nowMs, className }: { iso: string; nowMs: number; className?: string }) {
  return (
    <time dateTime={iso} title={formatAbsolute(iso)} className={cn("whitespace-nowrap font-mono text-xs tabular-nums", className)}>
      {formatRelative(iso, nowMs)}
    </time>
  );
}

export const linkClass =
  "underline underline-offset-2 outline-hidden hover:text-(--ed-text) focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-(--ed-focus)";

export const buttonClass = {
  primary:
    "inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-(--ed-text) px-4 text-sm font-medium text-white outline-hidden hover:bg-(--ed-primary-hover) focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-(--ed-focus) disabled:cursor-not-allowed disabled:opacity-50",
  secondary:
    "inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-(--ed-input) bg-(--ed-surface) px-4 text-sm font-medium text-(--ed-text) outline-hidden hover:bg-(--ed-sunk) focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-(--ed-focus) disabled:cursor-not-allowed disabled:opacity-50",
  danger:
    "inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-(--ed-danger) px-4 text-sm font-medium text-white outline-hidden hover:bg-(--ed-danger-hover) focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-(--ed-focus) disabled:cursor-not-allowed disabled:opacity-50",
  ghost:
    "inline-flex min-h-10 items-center justify-center gap-2 rounded-md px-3 text-sm font-medium text-(--ed-text) outline-hidden hover:bg-(--ed-sunk) focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-(--ed-focus) disabled:cursor-not-allowed disabled:opacity-50",
} as const;

export const fieldClass =
  "min-h-10 w-full rounded-md border border-(--ed-input) bg-(--ed-surface) px-3 text-sm text-(--ed-text) outline-hidden focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-1 focus-visible:outline-(--ed-focus)";

/**
 * Cursor pagination. "Showing x–y of n" uses a display-only `start` value;
 * the cursor alone decides what the server returns. With an unknown total
 * (the live activity log) it says "Showing x–y" only.
 */
export function Pagination({
  total,
  start,
  count,
  firstHref,
  nextHref,
  label,
}: {
  total: number | null;
  start: number;
  count: number;
  firstHref: string | null;
  nextHref: string | null;
  label: string;
}) {
  if (total === 0 || (total === null && count === 0 && !firstHref)) return null;
  const end = total === null ? start + count - 1 : Math.min(start + count - 1, total);
  return (
    <nav aria-label={`${label} pages`} className="flex flex-wrap items-center justify-between gap-3 text-sm">
      <p className="text-(--ed-text-2)">
        Showing{" "}
        <span className="font-mono tabular-nums text-(--ed-text)">
          {start}–{end}
        </span>
        {total === null ? null : (
          <>
            {" "}
            of <span className="font-mono tabular-nums text-(--ed-text)">{total}</span>
          </>
        )}
      </p>
      <div className="flex gap-2">
        {firstHref ? (
          <Link href={firstHref} className={buttonClass.secondary}>
            First page
          </Link>
        ) : null}
        {nextHref ? (
          <Link href={nextHref} className={buttonClass.secondary}>
            Next page
          </Link>
        ) : null}
      </div>
    </nav>
  );
}
