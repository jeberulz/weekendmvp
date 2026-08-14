import { redirect } from "next/navigation";
import { Suspense } from "react";
import { LibraryPicker } from "@/components/platform/library/LibraryPicker";
import {
  SIGNED_IN_HREF,
  shouldStripLibraryView,
} from "@/lib/signed-in-chrome";

export const instant = false;

export default async function ExplorePage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const { view } = await searchParams;
  if (shouldStripLibraryView(view)) {
    redirect(SIGNED_IN_HREF.library);
  }

  return (
    <div className="mx-auto max-w-6xl px-5 py-9 sm:px-8 sm:py-11">
      <header className="mb-8">
        <h1 className="text-3xl font-semibold tracking-[-0.025em] text-stone-950 sm:text-4xl">
          Library
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-stone-600">
          Pick another idea, preview it, then leave.
        </p>
      </header>
      <Suspense
        fallback={
          <div
            className="h-64 animate-pulse rounded-3xl bg-stone-900/5 motion-reduce:animate-none"
            aria-label="Loading ideas"
          />
        }
      >
        <LibraryPicker />
      </Suspense>
    </div>
  );
}
