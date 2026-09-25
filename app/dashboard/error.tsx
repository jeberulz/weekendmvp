"use client";

import Link from "next/link";

export default function DashboardError({ reset }: { reset: () => void }) {
  return (
    <div className="mx-auto w-full max-w-[1200px] px-5 py-8 sm:px-8 lg:px-10 lg:py-10">
      <div
        role="alert"
        className="flex max-w-2xl flex-col gap-3 rounded-[14px] border border-home-rule bg-home-card p-5 text-home-ink sm:p-6"
      >
        <h1 className="font-editorial text-[26px] font-normal leading-[1.15] tracking-[-0.015em]">
          Your workspace could not be loaded
        </h1>
        <p className="text-[15px] leading-[1.55] text-home-ink-2">
          No action was taken. Try again, or read the public idea library in the meantime.
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={reset}
            className="inline-flex h-11 items-center rounded-[9px] bg-home-ink px-4 text-sm font-medium text-home-card transition-colors hover:bg-home-panel focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-home-orange-ink"
          >
            Try again
          </button>
          <Link
            href="/startup-ideas"
            className="inline-flex h-11 items-center rounded-[9px] border border-home-rule bg-home-card px-4 text-sm font-medium text-home-ink transition-colors hover:border-home-ink-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-home-orange-ink"
          >
            Browse public ideas
          </Link>
        </div>
      </div>
    </div>
  );
}
