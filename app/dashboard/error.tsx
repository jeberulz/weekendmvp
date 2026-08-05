"use client";

import Link from "next/link";

export default function DashboardError({ reset }: { reset: () => void }) {
  return (
    <div className="mx-auto max-w-3xl px-5 py-12 sm:px-8" role="alert">
      <h1 className="text-2xl font-semibold tracking-[-0.02em] text-zinc-100">
        Your workspace could not be loaded
      </h1>
      <p className="mt-3 max-w-xl text-sm leading-6 text-zinc-400">
        No action was taken. Try the request again or return to the public idea library.
      </p>
      <div className="mt-6 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={reset}
          className="min-h-10 rounded-lg bg-orange-800 px-4 text-sm font-semibold text-white hover:bg-orange-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300"
        >
          Try again
        </button>
        <Link
          href="/startup-ideas"
          className="inline-flex min-h-10 items-center rounded-lg border border-white/10 px-4 text-sm text-zinc-300 hover:border-white/20 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500"
        >
          Browse public ideas
        </Link>
      </div>
    </div>
  );
}
