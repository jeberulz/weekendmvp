import Link from "next/link";
import { connection } from "next/server";

import { freeWebinarTitlePlain, UTM } from "@/lib/live/config";
import { readLiveClockMs } from "@/lib/live/now";
import { bannerPhase, freeWebinarPhase } from "@/lib/live/schedule";
import { sessionPhase } from "@/lib/live/session-phase";
import { sessionPath, sessionsForIdea } from "@/lib/live/sessions";

/**
 * Below-the-fold module on idea pages, after Prompts.
 *
 * When `ideaSlug` matches a LIVE_SESSIONS entry: past → "Watch this built live",
 * upcoming/live → "We're building this live on {date}". Otherwise the generic
 * series promo (hidden once the banner window ends).
 */
export async function LiveIdeaModule({ ideaSlug }: { ideaSlug?: string }) {
  await connection();
  const nowMs = readLiveClockMs();

  if (ideaSlug) {
    const tied = sessionsForIdea(ideaSlug);
    const tiedLive = tied.find((s) => {
      const phase = sessionPhase(s, nowMs);
      return phase === "upcoming" || phase === "live";
    });
    const tiedPast = tied.find((s) => {
      const phase = sessionPhase(s, nowMs);
      return phase === "past" || phase === "replay-pending";
    });

    if (tiedLive) {
      const start = new Date(tiedLive.startsAt);
      const dateLabel = start.toLocaleDateString("en-GB", {
        weekday: "short",
        day: "numeric",
        month: "short",
        timeZone: "UTC",
      });
      const href = `${sessionPath(tiedLive.slug)}?utm_source=idea&utm_campaign=${UTM.free}`;
      const live = sessionPhase(tiedLive, nowMs) === "live";
      return (
        <aside className="mt-12 rounded-2xl border border-home-rule bg-[#FCFAF7] p-6">
          <div className="font-mono text-[11px] tracking-[0.08em] text-home-orange uppercase">
            Weekend MVP Live
          </div>
          <p className="mt-2 text-base leading-relaxed text-home-ink">
            {live
              ? `We're live now — watching ${tiedLive.ideaName} get built.`
              : `We're building this live on ${dateLabel}.`}
          </p>
          <Link
            href={href}
            className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-[#A84A00] underline-offset-2 hover:underline"
          >
            {live ? "Watch live" : "Save my free seat"}
            <span aria-hidden="true">→</span>
          </Link>
        </aside>
      );
    }

    if (tiedPast) {
      const phase = sessionPhase(tiedPast, nowMs);
      const href = `${sessionPath(tiedPast.slug)}?utm_source=idea&utm_campaign=${UTM.free}`;
      return (
        <aside className="mt-12 rounded-2xl border border-home-rule bg-[#FCFAF7] p-6">
          <div className="font-mono text-[11px] tracking-[0.08em] text-home-orange uppercase">
            Weekend MVP Live
          </div>
          <p className="mt-2 text-base leading-relaxed text-home-ink">
            {phase === "past"
              ? `${tiedPast.ideaName} was built live. Watch the replay.`
              : `${tiedPast.ideaName} was built live. Replay coming soon — registrants get it by email.`}
          </p>
          <Link
            href={href}
            className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-[#A84A00] underline-offset-2 hover:underline"
          >
            Watch this built live
            <span aria-hidden="true">→</span>
          </Link>
        </aside>
      );
    }
  }

  if (bannerPhase(nowMs) === "hidden") return null;

  const freePhase = freeWebinarPhase(nowMs);
  const href =
    freePhase === "ended" || freePhase === "replay"
      ? `/live/build-along?utm_source=idea&utm_campaign=${UTM.paid}`
      : `/live/hydration-app-for-hikers?utm_source=idea&utm_campaign=${UTM.free}`;

  const line =
    freePhase === "live"
      ? `We're live now — watch ${freeWebinarTitlePlain()} on YouTube.`
      : freePhase === "open"
        ? `${freeWebinarTitlePlain()}. Free, live Sat 31 Oct, 16:00 GMT. Register for reminders — the edited replay stays public on YouTube.`
        : freePhase === "replay"
          ? "Replay for registrants for 7 days, then the public YouTube cut on the session page. Or join the Build-Along on Sat 14 Nov."
          : "Join the Weekend MVP Build-Along — build it Saturday, ship it Sunday.";

  const cta =
    freePhase === "live"
      ? "Watch live"
      : freePhase === "open"
        ? "Save my free seat"
        : "See the build-along";

  return (
    <aside className="mt-12 rounded-2xl border border-home-rule bg-[#FCFAF7] p-6">
      <div className="font-mono text-[11px] tracking-[0.08em] text-home-orange uppercase">
        Weekend MVP Live
      </div>
      <p className="mt-2 text-base leading-relaxed text-home-ink">{line}</p>
      <Link
        href={href}
        className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-[#A84A00] underline-offset-2 hover:underline"
      >
        {cta}
        <span aria-hidden="true">→</span>
      </Link>
    </aside>
  );
}
