import { FlaskConical } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";
import styles from "../editorial.module.css";
import { MobileNav } from "./MobileNav";
import { NavList } from "./NavList";
import { EDITORIAL_BASE, type NavCounts } from "./nav-items";

export type ShellEnvironment = {
  /** Only "fixture" exists until the live adapter lands (WP46-E4). */
  mode: "fixture";
  connection: string;
  accountLabel: string;
};

/**
 * The fixture banner is deliberately loud, sits above everything and cannot
 * be dismissed: nothing in this mode is real.
 */
export function DemoBanner() {
  return (
    <section
      aria-label="Environment"
      className="border-b border-(--ed-demo) bg-(--ed-demo-bg) px-4 py-2 text-sm text-(--ed-demo)"
    >
      <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <FlaskConical aria-hidden="true" className="size-4 shrink-0" />
        <strong className="font-semibold uppercase tracking-wide">Local demo — fictional data.</strong>
        <span>Approvals and releases are simulated; the public site never changes.</span>
        <Link
          href={`${EDITORIAL_BASE}/settings`}
          className="underline underline-offset-2 outline-hidden focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-(--ed-demo)"
        >
          What is simulated?
        </Link>
      </p>
    </section>
  );
}

export function EditorialShell({
  environment,
  counts,
  children,
}: {
  environment: ShellEnvironment;
  counts: NavCounts;
  children: ReactNode;
}) {
  return (
    <div className={cn(styles.theme, styles.root, "flex min-h-dvh flex-col")}>
      <a
        href="#editorial-main"
        className="sr-only z-50 rounded-md bg-(--ed-text) px-3 py-2 text-sm text-white focus:not-sr-only focus:absolute focus:left-3 focus:top-3"
      >
        Skip to main content
      </a>
      <DemoBanner />
      <header className="flex min-h-14 flex-wrap items-center gap-x-4 gap-y-2 border-b border-(--ed-border) bg-(--ed-surface) px-4 py-2">
        <MobileNav counts={counts} accountLabel={environment.accountLabel} connection={environment.connection} />
        <p className="text-[0.9375rem] font-semibold">
          <span className="text-(--ed-text-2)">Weekend MVP</span>
          <span aria-hidden="true" className="px-1.5 text-(--ed-text-2)">
            /
          </span>
          Editorial
        </p>
        <dl className="ml-auto flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-(--ed-text-2)">
          <div className="flex items-center gap-1.5">
            <dt className="sr-only">Environment</dt>
            <dd className="rounded border border-(--ed-demo) bg-(--ed-demo-bg) px-1.5 py-0.5 font-semibold text-(--ed-demo)">
              Local demo
            </dd>
          </div>
          <div className="hidden items-center gap-1.5 md:flex">
            <dt>Data:</dt>
            <dd>{environment.connection}</dd>
          </div>
          <div className="hidden items-center gap-1.5 md:flex">
            <dt>Signed in as:</dt>
            <dd className="font-medium text-(--ed-text)">{environment.accountLabel}</dd>
          </div>
        </dl>
      </header>
      <div className="flex flex-1">
        <nav
          aria-label="Editorial"
          className="sticky top-0 hidden h-dvh w-[216px] shrink-0 flex-col border-r border-(--ed-border) px-2 py-4 xl:flex"
        >
          <NavList counts={counts} />
        </nav>
        <main id="editorial-main" tabIndex={-1} className="min-w-0 flex-1 outline-hidden">
          {children}
        </main>
      </div>
    </div>
  );
}

/** Frame shown while the workspace resolves; carries no data. */
export function EditorialShellFallback() {
  return (
    <div className={cn(styles.theme, styles.root)} aria-busy="true">
      <p className="sr-only" role="status">
        Loading…
      </p>
      <div className="h-14 border-b border-(--ed-border) bg-(--ed-surface)" />
    </div>
  );
}
