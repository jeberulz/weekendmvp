import Link from "next/link";
import { EmptyState } from "@/components/workspace/kit/states";
import { CARD, EYEBROW, FOCUS } from "@/components/workspace/kit/styles";
import { ROLE_LABELS } from "@/components/workspace/kit/types";
import { cn } from "@/lib/utils";
import { approvalOwner, type DashHired, type DashReview } from "@/lib/workspace/dashboard";
import { changeRoundNote, expiresInWords, WAITING_EMPTY_COPY } from "@/lib/workspace/reviewPages";

/**
 * "Needs your call / Pending approvals": the crew's pending reviews. Each row
 * links to the page where it is reviewed, so the review's change rounds stay
 * in the loop; the dashboard never approves anything itself.
 */
export function PendingApprovals({
  reviews,
  hired,
  now,
}: {
  reviews: readonly DashReview[];
  hired: readonly DashHired[];
  now: number;
}) {
  return (
    <section aria-labelledby="appr-h" className="flex min-w-0 flex-col gap-2.5">
      <p className={EYEBROW}>Needs your call</p>
      <h2 id="appr-h" className="font-editorial text-2xl font-normal text-home-ink">
        Pending approvals
      </h2>
      {reviews.length === 0 ? (
        <EmptyState>{WAITING_EMPTY_COPY}</EmptyState>
      ) : (
        <ul className={cn(CARD, "overflow-hidden")}>
          {reviews.map((review) => {
            const round = changeRoundNote(Number(review.changeRound));
            return (
              <li
                key={review.approvalId}
                className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-home-sunk px-3.5 py-3 last:border-b-0"
              >
                <span className="flex min-w-0 flex-[1_1_10rem] flex-col">
                  <span className="text-sm font-medium text-home-ink">{review.title}</span>
                  <span className="text-[13px] text-home-ink-2">
                    From {approvalOwner(review, hired, ROLE_LABELS)}
                    {round === null ? "" : ` · ${round}`} · Closes {expiresInWords(review.expiresAt, now)}
                  </span>
                </span>
                <Link
                  href={review.href}
                  className={cn("inline-flex min-h-6 items-center text-[13px] font-medium text-home-orange-ink underline underline-offset-2 hover:text-home-ink", FOCUS)}
                >
                  Review<span className="sr-only"> {review.title}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
