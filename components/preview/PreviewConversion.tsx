"use client";

import Link from "next/link";
import { useState } from "react";

export function PreviewConversion({ token }: { token: string }) {
  const [stamp, setStamp] = useState("");

  return (
    <aside
      aria-label="Keep this site"
      className="border-t border-stone-900/10 bg-[#f3f1eb] px-5 py-5"
    >
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
        {stamp ? (
          <p className="text-sm text-[#1c1917]">{stamp}</p>
        ) : null}
        <label className="block text-xs font-semibold uppercase tracking-[0.14em] text-[#57534e]">
          Your shop / brand
          <input
            value={stamp}
            onChange={(event) => setStamp(event.target.value)}
            autoComplete="organization"
            className="mt-2 min-h-11 w-full rounded-2xl border border-stone-900/15 bg-white px-3 text-sm text-[#1c1917] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-800"
          />
        </label>
        <p className="text-sm text-[#44403c]">Private preview. Not published.</p>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Link
            href="/startup-ideas"
            className="text-sm text-[#57534e] underline-offset-4 hover:text-[#1c1917] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-800"
          >
            Not this one
          </Link>
          <Link
            href={`/signin?claimPreview=${encodeURIComponent(token)}`}
            className="inline-flex min-h-11 items-center justify-center rounded-2xl bg-[#cc5500] px-5 font-medium text-[#fcfaf7] transition-transform duration-300 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] hover:bg-[#b34b00] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#cc5500] focus-visible:ring-offset-2 focus-visible:ring-offset-[#f3f1eb] active:scale-[0.98]"
          >
            Keep this site
          </Link>
        </div>
      </div>
    </aside>
  );
}
