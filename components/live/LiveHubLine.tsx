import Link from "next/link";
import { Container } from "@/components/home/ui";
import { HideAfter } from "@/components/live/HideAfter";
import { FREE_WEBINAR, liveFreeHref } from "@/lib/live/config";

export type LiveHubEndCopy = {
  lead: string;
  linkLabel: string;
};

const DATE_LABEL = "Sat 31 Oct at 16:00 GMT";
const DATE_TIME = "2026-10-31T16:00:00Z";

/**
 * SSR end-of-page line under HubPrimaryCta — crawlable link to /live/48-hours.
 * Hidden client-side at FREE_WEBINAR.startAt (cached HTML would otherwise linger).
 * Skip for hubs without liveCta. No Build-Along swap in this PR.
 */
export function LiveHubLine({
  src,
  copy,
}: {
  src: string;
  copy: LiveHubEndCopy;
}) {
  const href = liveFreeHref({ src, placement: "end" });
  const dateIdx = copy.lead.indexOf(DATE_LABEL);

  return (
    <HideAfter at={FREE_WEBINAR.startAt}>
      <Container className="pt-6">
        <p className="max-w-3xl text-[15px] leading-[1.6] text-home-ink-2">
          {dateIdx >= 0 ? (
            <>
              {copy.lead.slice(0, dateIdx)}
              <time dateTime={DATE_TIME}>{DATE_LABEL}</time>
              {copy.lead.slice(dateIdx + DATE_LABEL.length)}
            </>
          ) : (
            copy.lead
          )}{" "}
          <Link
            href={href}
            className="font-medium text-home-orange-ink underline underline-offset-4 transition-colors hover:text-home-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-home-orange-ink motion-reduce:transition-none"
          >
            {copy.linkLabel}
            <span aria-hidden="true"> →</span>
          </Link>
        </p>
      </Container>
    </HideAfter>
  );
}
