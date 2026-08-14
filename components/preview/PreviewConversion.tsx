"use client";

import Link from "next/link";
import { useState } from "react";

export function PreviewConversion({ token }: { token: string }) {
  const [stamp, setStamp] = useState("");

  return (
    <aside
      aria-label="Keep this site"
      className="border-t border-white/10 bg-black/90 px-5 py-5"
    >
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
        {stamp ? (
          <p className="text-sm text-zinc-200">{stamp}</p>
        ) : null}
        <label className="block text-xs uppercase tracking-wide text-zinc-400">
          Your shop / brand
          <input
            value={stamp}
            onChange={(event) => setStamp(event.target.value)}
            autoComplete="organization"
            className="mt-2 min-h-11 w-full rounded-2xl border border-white/15 bg-black px-3 text-sm text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          />
        </label>
        <p className="text-sm text-zinc-300">Private preview. Not published.</p>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Link
            href="/startup-ideas"
            className="text-sm text-zinc-400 underline-offset-4 hover:text-zinc-200 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            Not this one
          </Link>
          <Link
            href={`/signin?claimPreview=${encodeURIComponent(token)}`}
            className="inline-flex min-h-11 items-center justify-center rounded-2xl bg-orange-700 px-5 font-medium text-white transition-colors hover:bg-orange-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
          >
            Keep this site
          </Link>
        </div>
      </div>
    </aside>
  );
}
