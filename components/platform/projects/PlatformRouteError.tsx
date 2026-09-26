"use client";

import Link from "next/link";

export function PlatformRouteError({
  title = "Workspace unavailable",
  reset,
}: {
  title?: string;
  reset?: () => void;
}) {
  return (
    <section aria-labelledby="platform-route-error-heading" className="mx-auto w-full max-w-[1200px] px-5 py-8 sm:px-8 lg:px-10 lg:py-10">
      <div className="mx-auto max-w-xl border-y border-home-rule py-8">
        <h1 id="platform-route-error-heading" className="font-editorial text-[26px] font-normal leading-[1.15] text-home-ink">
          {title}
        </h1>
        <p className="mt-2 text-sm leading-6 text-home-ink-3">
          This item does not exist or is not available to this account.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          {reset ? (
            <button
              type="button"
              onClick={reset}
              className="inline-flex h-9 items-center justify-center rounded-md bg-home-ink px-4 text-sm font-medium text-home-card outline-none transition-colors hover:bg-home-panel focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              Try again
            </button>
          ) : null}
          <Link
            href="/dashboard/projects"
            className="inline-flex h-9 items-center justify-center rounded-md border border-home-rule px-4 text-sm font-medium text-home-ink outline-none transition-colors hover:bg-home-sunk focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            Back to projects
          </Link>
        </div>
      </div>
    </section>
  );
}
