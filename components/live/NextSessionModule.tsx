import Link from "next/link";

import { LiveButton } from "@/components/live/LiveButton";
import { LocalTime } from "@/components/live/LocalTime";
import {
  nextSessionEmptyCopy,
  nextUpcomingSession,
  sessionPhase,
} from "@/lib/live/session-phase";
import { sessionPath, type LiveSession } from "@/lib/live/sessions";

/**
 * Next free session card for past / replay-pending pages.
 * Never shows a stale date — empty state + newsletter when none scheduled.
 */
export function NextSessionModule({
  nowMs,
  excludeId,
}: {
  nowMs: number;
  excludeId?: string;
}) {
  const next = nextUpcomingSession(nowMs);
  const session = next && next.id !== excludeId ? next : null;

  if (!session) {
    const empty = nextSessionEmptyCopy();
    return (
      <aside className="rounded-2xl border border-home-rule bg-[#FCFAF7] p-6 sm:p-8">
        <div className="font-mono text-[11px] tracking-[0.08em] text-home-orange uppercase">
          Next free session
        </div>
        <p className="mt-2 text-base leading-relaxed text-home-ink">{empty.line}</p>
        <LiveButton href={empty.ctaHref} variant="secondary" className="mt-5 w-auto">
          {empty.ctaLabel}
        </LiveButton>
      </aside>
    );
  }

  return <NextSessionCard session={session} nowMs={nowMs} />;
}

function NextSessionCard({
  session,
  nowMs,
}: {
  session: LiveSession;
  nowMs: number;
}) {
  const phase = sessionPhase(session, nowMs);
  const startMs = Date.parse(session.startsAt);
  const href = sessionPath(session.slug);
  const cta =
    phase === "live"
      ? "Watch live"
      : "Save my free seat";

  return (
    <aside className="rounded-2xl border border-home-rule bg-[#FCFAF7] p-6 sm:p-8">
      <div className="font-mono text-[11px] tracking-[0.08em] text-home-orange uppercase">
        Next free session
      </div>
      <h2 className="font-editorial mt-2 text-[28px] leading-tight font-medium tracking-[-0.015em]">
        Build {session.ideaName} live
      </h2>
      <p className="mt-2 max-w-[52ch] text-[15px] leading-relaxed text-[#4A453C]">
        {session.ideaName}, {session.oneLiner}. Free on YouTube Live.
      </p>
      <p className="mt-3 text-[15px] text-home-ink">
        <strong className="font-semibold">
          {new Date(session.startsAt).toLocaleDateString("en-GB", {
            weekday: "short",
            day: "numeric",
            month: "short",
            year: "numeric",
            timeZone: "UTC",
          })}
          ,{" "}
          {new Date(session.startsAt).toLocaleTimeString("en-GB", {
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
            timeZone: "UTC",
          })}{" "}
          GMT
        </strong>
      </p>
      <LocalTime startMs={startMs} className="mt-1 text-[14px] text-[#6B6457]" />
      <div className="mt-5 flex flex-wrap items-center gap-4">
        <LiveButton href={href} variant="primary" className="w-auto">
          {cta}
        </LiveButton>
        <Link
          href={href}
          className="text-sm font-medium text-home-ink underline decoration-home-rule underline-offset-4"
        >
          Session page
        </Link>
      </div>
    </aside>
  );
}
