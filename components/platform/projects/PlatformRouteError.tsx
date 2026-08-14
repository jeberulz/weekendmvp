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
    <section aria-labelledby="platform-route-error-heading" className="px-5 py-12 sm:px-8 lg:px-12">
      <div className="mx-auto max-w-xl border-y border-white/10 py-8">
        <h1 id="platform-route-error-heading" className="text-xl font-semibold text-zinc-100">
          {title}
        </h1>
        <p className="mt-2 text-sm leading-6 text-zinc-400">
          This item does not exist or is not available to this account.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          {reset ? (
            <button
              type="button"
              onClick={reset}
              className="inline-flex h-9 items-center justify-center rounded-md bg-zinc-100 px-4 text-sm font-medium text-zinc-950 outline-none transition-colors hover:bg-white focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              Try again
            </button>
          ) : null}
          <Link
            href="/dashboard/projects"
            className="inline-flex h-9 items-center justify-center rounded-md border border-white/15 px-4 text-sm font-medium text-zinc-100 outline-none transition-colors hover:bg-white/[0.06] focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            Back to projects
          </Link>
        </div>
      </div>
    </section>
  );
}
