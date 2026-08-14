import { Suspense } from "react";
import { ExploreWorkspace } from "@/components/platform/explore/ExploreWorkspace";

export default function ExplorePage() {
  return (
    <div className="mx-auto max-w-6xl px-5 py-9 sm:px-8 sm:py-11">
      <header className="mb-8">
        <h1 className="text-3xl font-semibold tracking-[-0.025em] text-zinc-50 sm:text-4xl">
          Explore ideas
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-400">
          Discover the same evidence-backed ideas published in the public library, with your private intent and project state layered on top.
        </p>
      </header>
      <Suspense fallback={<div className="h-64 animate-pulse rounded-xl bg-white/[0.025] motion-reduce:animate-none" aria-label="Loading ideas" />}>
        <ExploreWorkspace />
      </Suspense>
    </div>
  );
}
