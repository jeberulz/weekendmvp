import { FlaskConical } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import editorial from "@/components/admin/editorial/editorial.module.css";
import { cn } from "@/lib/utils";

export const FEEDBACK_BASE = "/admin/feedback";
export type FeedbackTab = "feedback" | "errors";

const TABS: ReadonlyArray<{ id: FeedbackTab; label: string; href: string }> = [
  { id: "feedback", label: "Feedback", href: FEEDBACK_BASE },
  { id: "errors", label: "Errors", href: `${FEEDBACK_BASE}?tab=errors` },
];

const focusRing =
  "outline-hidden focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-(--ed-focus)";

/**
 * WP95-S5. The feedback page's own simple admin header: the product, the page,
 * two tabs. No AI-console chrome. One `<main>`, one h1 (the page's), a skip link.
 */
export function Shell({ mode, active, children }: { mode: "fixture" | "live"; active: FeedbackTab; children: ReactNode }) {
  return (
    <div className={cn(editorial.theme, editorial.root, "flex min-h-dvh flex-col")}>
      <a
        href="#feedback-main"
        className="sr-only z-50 rounded-md bg-(--ed-text) px-3 py-2 text-sm text-white focus:not-sr-only focus:absolute focus:left-3 focus:top-3"
      >
        Skip to main content
      </a>
      {mode === "fixture" ? (
        <section aria-label="Environment" className="border-b border-(--ed-demo) bg-(--ed-demo-bg) px-4 py-2 text-sm text-(--ed-demo)">
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <FlaskConical aria-hidden="true" className="size-4 shrink-0" />
            <strong className="font-semibold uppercase tracking-wide">Local demo — fictional data.</strong>
            <span>No live feedback is read.</span>
          </p>
        </section>
      ) : null}
      <header className="border-b border-(--ed-border) bg-(--ed-surface) px-4 pt-3">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-2">
          <p className="text-[0.9375rem] font-semibold">
            <span className="text-(--ed-text-2)">Weekend MVP</span>
            <span aria-hidden="true" className="px-1.5 text-(--ed-text-2)">/</span>
            Feedback
          </p>
          <p className="ml-auto text-xs text-(--ed-text-2)">
            {mode === "fixture" ? "Local demo" : "Live · super admin only · read only"}
          </p>
        </div>
        <nav aria-label="Feedback sections" className="mx-auto mt-2 max-w-6xl overflow-x-auto">
          <ul className="flex gap-1">
            {TABS.map((tab) => (
              <li key={tab.id}>
                <Link
                  href={tab.href}
                  aria-current={tab.id === active ? "page" : undefined}
                  className={cn(
                    "inline-flex min-h-11 items-center whitespace-nowrap border-b-2 px-3 text-sm",
                    tab.id === active
                      ? "border-(--ed-text) font-semibold text-(--ed-text)"
                      : "border-transparent text-(--ed-text-2) hover:text-(--ed-text)",
                    focusRing,
                  )}
                >
                  {tab.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </header>
      <main id="feedback-main" tabIndex={-1} className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 outline-hidden">
        {children}
      </main>
    </div>
  );
}

export function Notice({ children }: { children: ReactNode }) {
  return (
    <p role="status" className="mb-4 rounded-md border border-(--ed-warning) bg-(--ed-warning-bg) px-3 py-2 text-sm text-(--ed-warning)">
      {children}
    </p>
  );
}

export function Tile({ label, value, detail }: { label: string; value: ReactNode; detail?: ReactNode }) {
  return (
    <div className="rounded-lg border border-(--ed-border) bg-(--ed-surface) p-4">
      <dt className="text-sm text-(--ed-text-2)">{label}</dt>
      <dd className="mt-1 text-2xl font-semibold tabular-nums">{value}</dd>
      {detail ? <dd className="mt-1 text-xs text-(--ed-text-2)">{detail}</dd> : null}
    </div>
  );
}

/** A scrollable table region a keyboard user can reach and scroll. */
export function TableRegion({ labelledBy, children }: { labelledBy: string; children: ReactNode }) {
  return (
    <div
      role="region"
      aria-labelledby={labelledBy}
      tabIndex={0}
      className="overflow-x-auto rounded-lg border border-(--ed-border) bg-(--ed-surface) focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-(--ed-focus)"
    >
      {children}
    </div>
  );
}

export const th = "whitespace-nowrap border-b border-(--ed-border) bg-(--ed-sunk) px-3 py-2 text-left text-xs font-semibold text-(--ed-text-2)";
export const td = "border-b border-(--ed-border) px-3 py-2 align-top";
export const tdNum = cn(td, "whitespace-nowrap text-right tabular-nums");

/** "2026-11-20 14:03 UTC": no locale or time zone surprises on the server. */
export function formatWhen(ms: number): string {
  return `${new Date(ms).toISOString().slice(0, 16).replace("T", " ")} UTC`;
}

/** The last eight characters of an id: enough to match rows, short enough to read. */
export function shortId(id: string): string {
  return `…${id.slice(-8)}`;
}
