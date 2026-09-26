"use client";

import { useQuery } from "convex/react";
import { useState } from "react";
import { api } from "@/convex/_generated/api";
import { QuietErrorBoundary, WhenConvexReady } from "@/components/platform/client-gates";
import { dateLine, greeting, statusLine } from "./home-copy";

const DATE_CLASS = "font-mono text-[11px] uppercase tracking-[0.08em] text-home-ink-3";
const H1_CLASS =
  "font-editorial text-[34px] font-normal leading-[1.05] tracking-[-0.025em] text-home-ink sm:text-[42px]";
const STATUS_CLASS = "text-[15px] text-home-ink-2";

function GreetingFrame({ firstName, status }: { firstName: string | null; status: string | null }) {
  // Browser-only (behind WhenConvexReady), so local time is safe to read here.
  const [now] = useState(() => new Date());
  return (
    <header className="flex flex-col gap-1.5">
      <p className={DATE_CLASS}>{dateLine(now)}</p>
      <h1 className={H1_CLASS}>{greeting(now.getHours(), firstName)}</h1>
      {status && <p className={STATUS_CLASS}>{status}</p>}
    </header>
  );
}

function GreetingSkeleton() {
  return (
    <header className="flex flex-col gap-1.5">
      <span aria-hidden className="h-3.5 w-40 rounded bg-home-sunk" />
      <h1 className={H1_CLASS}>
        <span className="sr-only">Home</span>
        <span aria-hidden className="block h-[36px] w-64 rounded-md bg-home-sunk sm:h-[44px] sm:w-80" />
      </h1>
      <span aria-hidden className="h-[22px] w-72 max-w-full rounded bg-home-sunk" />
    </header>
  );
}

function LiveGreeting() {
  const home = useQuery(api.platform.dashboard.home);
  const [weekday] = useState(() => new Date().getDay());
  if (home === undefined) return <GreetingSkeleton />;
  return <GreetingFrame firstName={home.firstName} status={statusLine(home.saved, weekday)} />;
}

/** Date line, serif greeting and status line (PRD 6.2). */
export function Greeting() {
  const plain = <GreetingFrame firstName={null} status={null} />;
  return (
    <WhenConvexReady fallback={<GreetingSkeleton />} unavailable={plain}>
      <QuietErrorBoundary fallback={plain}>
        <LiveGreeting />
      </QuietErrorBoundary>
    </WhenConvexReady>
  );
}
