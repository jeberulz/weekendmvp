import { FlaskConical } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { RANGE_IDS, RANGE_LABELS, type RangeId } from "@/lib/admin/ai-costs/ranges";
import { cn } from "@/lib/utils";
import editorial from "../editorial/editorial.module.css";
import viz from "./ai-costs.module.css";

export const AI_COSTS_BASE = "/admin/ai";

export type ConsoleTab = "overview" | "prompts" | "founders" | "forecast";

const TABS: ReadonlyArray<{ id: ConsoleTab; label: string; href: string }> = [
  { id: "overview", label: "Overview", href: AI_COSTS_BASE },
  { id: "prompts", label: "Prompts and models", href: `${AI_COSTS_BASE}/prompts` },
  { id: "founders", label: "Founders", href: `${AI_COSTS_BASE}/founders` },
  { id: "forecast", label: "Forecast", href: `${AI_COSTS_BASE}/forecast` },
];

export const focusRing =
  "outline-hidden focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-(--ed-focus)";

function tabHref(href: string, range: RangeId | null): string {
  return range === null || range === "7d" ? href : `${href}?range=${range}`;
}

export function ConsoleShell({
  mode,
  active,
  range,
  rangePath,
  children,
}: {
  mode: "fixture" | "live";
  active: ConsoleTab | null;
  /** The current range, or null on screens without one. */
  range: RangeId | null;
  /** Where the range links point (defaults to the active tab). */
  rangePath?: string;
  children: ReactNode;
}) {
  const current = TABS.find((tab) => tab.id === active);
  const rangeBase = rangePath ?? current?.href ?? AI_COSTS_BASE;
  return (
    <div className={cn(editorial.theme, editorial.root, viz.viz, "flex min-h-dvh flex-col")}>
      <a
        href="#ai-costs-main"
        className="sr-only z-50 rounded-md bg-(--ed-text) px-3 py-2 text-sm text-white focus:not-sr-only focus:absolute focus:left-3 focus:top-3"
      >
        Skip to main content
      </a>
      {mode === "fixture" ? (
        <section aria-label="Environment" className="border-b border-(--ed-demo) bg-(--ed-demo-bg) px-4 py-2 text-sm text-(--ed-demo)">
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <FlaskConical aria-hidden="true" className="size-4 shrink-0" />
            <strong className="font-semibold uppercase tracking-wide">Local demo — fictional data.</strong>
            <span>No live usage is read. Emails use example.test.</span>
          </p>
        </section>
      ) : null}
      <header className="border-b border-(--ed-border) bg-(--ed-surface) px-4 pt-3">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-4 gap-y-2">
          <p className="text-[0.9375rem] font-semibold">
            <span className="text-(--ed-text-2)">Weekend MVP</span>
            <span aria-hidden="true" className="px-1.5 text-(--ed-text-2)">/</span>
            AI costs
          </p>
          <p className="ml-auto text-xs text-(--ed-text-2)">
            {mode === "fixture" ? "Local demo" : "Live · super admin only · read only"}
          </p>
        </div>
        <nav aria-label="AI cost console" className="mx-auto mt-2 max-w-7xl overflow-x-auto">
          <ul className="flex gap-1">
            {TABS.map((tab) => (
              <li key={tab.id}>
                <Link
                  href={tabHref(tab.href, range)}
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
      <main id="ai-costs-main" tabIndex={-1} className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 outline-hidden">
        {range !== null ? <RangeSwitch range={range} base={rangeBase} /> : null}
        {children}
      </main>
    </div>
  );
}

function RangeSwitch({ range, base }: { range: RangeId; base: string }) {
  return (
    <nav aria-label="Time range" className="mb-6">
      <ul className="inline-flex rounded-md border border-(--ed-border-strong) bg-(--ed-surface) p-0.5">
        {RANGE_IDS.map((id) => (
          <li key={id}>
            <Link
              href={id === "7d" ? base : `${base}?range=${id}`}
              aria-current={id === range ? "true" : undefined}
              className={cn(
                "inline-flex min-h-10 items-center rounded px-3 text-sm",
                id === range ? "bg-(--ed-text) font-semibold text-white" : "text-(--ed-text-2) hover:text-(--ed-text)",
                focusRing,
              )}
            >
              {RANGE_LABELS[id]}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export function ConsoleFallback() {
  return (
    <div className={cn(editorial.theme, editorial.root, "flex min-h-dvh items-center justify-center")}>
      <p role="status" className="text-sm text-(--ed-text-2)">Loading AI costs…</p>
    </div>
  );
}
