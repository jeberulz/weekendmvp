import { cn } from "@/lib/utils";

/**
 * Placeholder cards while data loads or the team is being put together. Hidden
 * from assistive tech; the page announces the state in words next to it.
 */
export function TeamSkeleton({ count = 3, className }: { count?: number; className?: string }) {
  return (
    <ul
      aria-hidden="true"
      data-state="skeleton"
      className={cn("grid grid-cols-[repeat(auto-fill,minmax(min(100%,236px),1fr))] gap-3.5", className)}
    >
      {Array.from({ length: count }, (_, index) => (
        <li
          key={index}
          className="flex flex-col gap-3 rounded-xl border border-dashed border-home-rule p-4 motion-safe:animate-pulse"
        >
          <div className="flex items-center gap-3">
            <span className="size-8 rounded-full bg-home-sunk" />
            <span className="flex flex-1 flex-col gap-1.5">
              <span className="h-3 w-2/5 rounded bg-home-sunk" />
              <span className="h-2.5 w-1/4 rounded bg-home-sunk" />
            </span>
          </div>
          <span className="h-2.5 w-full rounded bg-home-sunk" />
          <span className="h-2.5 w-3/5 rounded bg-home-sunk" />
        </li>
      ))}
    </ul>
  );
}

/** A loading block for text sections: pulsing bars, plus the label in words for assistive tech. */
export function SkeletonBlock({ label, className }: { label: string; className?: string }) {
  return (
    <div role="status" data-state="loading" className={cn("flex flex-col gap-2 rounded-xl border border-dashed border-home-rule p-4", className)}>
      <span className="sr-only">{label}</span>
      <span aria-hidden="true" className="h-3 w-3/5 rounded bg-home-sunk motion-safe:animate-pulse" />
      <span aria-hidden="true" className="h-3 w-full rounded bg-home-sunk motion-safe:animate-pulse" />
      <span aria-hidden="true" className="h-3 w-2/5 rounded bg-home-sunk motion-safe:animate-pulse" />
    </div>
  );
}
