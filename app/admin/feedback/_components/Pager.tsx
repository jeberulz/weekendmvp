import Link from "next/link";

import { cn } from "@/lib/utils";
import { FEEDBACK_BASE, type FeedbackTab } from "./Shell";

/** "Older" through the next cursor; the first page is the plain tab URL. */
export function Pager({ tab, shown, nextCursor }: { tab: FeedbackTab; shown: number; nextCursor: string | null }) {
  const href = nextCursor === null ? null : `${FEEDBACK_BASE}?${new URLSearchParams({ ...(tab === "errors" ? { tab } : {}), cursor: nextCursor }).toString()}`;
  return (
    <nav aria-label="Pages" className="mt-4 flex flex-wrap items-center gap-3 text-sm text-(--ed-text-2)">
      <p>
        Showing {shown} {shown === 1 ? "row" : "rows"}, newest first.
      </p>
      {href === null ? (
        <p>That is all of them.</p>
      ) : (
        <Link
          href={href}
          className={cn(
            "inline-flex min-h-11 items-center rounded-md border border-(--ed-border-strong) bg-(--ed-surface) px-3 font-medium text-(--ed-text) outline-hidden focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-(--ed-focus)",
          )}
        >
          Older
        </Link>
      )}
    </nav>
  );
}
