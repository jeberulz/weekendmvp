import Link from "next/link";
import { cn } from "@/lib/utils";
import type { BannerCopy, DashReview, Segment, SegmentTone } from "@/lib/workspace/dashboard";
import { workspacePath } from "@/lib/workspace/routes";

const TONE: Record<SegmentTone, string> = {
  done: "bg-home-sage",
  needs_you: "bg-home-orange-light",
  working: "bg-home-sky",
  problem: "bg-home-clay",
  idle: "bg-home-ink-3",
};

const ON_DARK_FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-home-orange-light";

const PRIMARY = cn(
  "inline-flex min-h-11 items-center rounded-full bg-home-card px-5 text-sm font-medium text-home-ink hover:bg-home-sunk",
  ON_DARK_FOCUS,
);
const SECONDARY = cn(
  "inline-flex min-h-11 items-center rounded-full border border-home-d2 px-5 text-sm font-medium text-home-d1 hover:bg-home-panel-rule",
  ON_DARK_FOCUS,
);

/**
 * The dark launch card. Real progress only: "{done} of {total} ready", a bar
 * with one segment per step (named for a screen reader), and one line of what
 * is happening now. No weekend dates and no invented counts. Its buttons go to
 * Team HQ (the launch plan page is not built) and to the next review.
 */
export function LaunchBanner({
  projectId,
  copy,
  segments,
  firstReview,
}: {
  projectId: string;
  copy: BannerCopy;
  segments: readonly Segment[];
  firstReview?: Pick<DashReview, "href" | "title">;
}) {
  return (
    <section
      aria-labelledby="launch-h"
      className="flex flex-wrap items-center justify-between gap-x-6 gap-y-5 rounded-[10px] bg-home-panel p-5 text-home-d1 @md:p-6"
    >
      <div className="flex min-w-0 flex-[1_1_18rem] flex-col gap-2.5">
        <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-home-orange-light">Your launch</p>
        <h2 id="launch-h" className="font-editorial text-[26px] font-normal leading-[1.15] @md:text-[28px]">
          {copy.lead}
          {copy.tail ? (
            <>
              {" "}
              <em className="italic text-home-d2">{copy.tail}</em>
            </>
          ) : null}
        </h2>
        {segments.length > 0 ? (
          <ol aria-label="Launch steps" className="flex max-w-[420px] gap-1">
            {segments.map((segment) => (
              <li key={segment.key} data-tone={segment.tone} className={cn("h-1.5 flex-1 rounded-sm", TONE[segment.tone])}>
                <span className="sr-only">
                  {segment.title}: {segment.label}
                </span>
              </li>
            ))}
          </ol>
        ) : null}
        <p className="text-[13px] text-home-d2">{copy.status}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Link href={workspacePath(projectId, "team")} className={PRIMARY}>
          Open Team HQ
        </Link>
        {firstReview === undefined ? null : (
          <Link href={firstReview.href} className={SECONDARY}>
            Review<span className="sr-only"> {firstReview.title}</span>
          </Link>
        )}
      </div>
    </section>
  );
}

