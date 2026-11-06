"use client";

import Link from "next/link";
import { ErrorState } from "@/components/workspace/kit";

/** A wizard view that fails to load (e.g. a stale `?session=` link) gets one clear way forward. */
export default function StartError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="mx-auto flex w-full max-w-[720px] flex-col gap-4 px-5 py-10 sm:px-8">
      <h1 className="font-editorial text-[32px] leading-tight text-home-ink">We could not open this build</h1>
      <ErrorState message="This build could not be loaded. It may belong to another account or have been replaced." onRetry={reset} />
      <p className="text-sm text-home-ink-2">
        <Link
          href="/start/own"
          className="underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-home-orange-ink"
        >
          Start a new build
        </Link>
      </p>
    </main>
  );
}
