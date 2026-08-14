"use client";

import Link from "next/link";
import { SIGNED_IN_HREF } from "@/lib/signed-in-chrome";

export default function DashboardError({ reset }: { reset: () => void }) {
  return (
    <div className="mx-auto max-w-3xl px-5 py-12 sm:px-8" role="alert">
      <h1 className="text-2xl font-semibold tracking-[-0.02em] text-stone-950">
        This page could not be loaded
      </h1>
      <p className="mt-3 max-w-xl text-sm leading-6 text-stone-600">
        No action was taken. Try again or return home.
      </p>
      <div className="mt-6 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={reset}
          className="min-h-11 rounded-2xl bg-stone-900 px-4 text-sm font-semibold text-[#f3f1eb] hover:bg-stone-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-800"
        >
          Try again
        </button>
        <Link
          href={SIGNED_IN_HREF.home}
          className="inline-flex min-h-11 items-center rounded-2xl border border-stone-900/15 px-4 text-sm text-stone-800 hover:border-stone-900/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-800"
        >
          Home
        </Link>
      </div>
    </div>
  );
}
