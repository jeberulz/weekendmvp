import Link from "next/link";
import { connection } from "next/server";
import { FREE_WEBINAR, UTM } from "@/lib/live/config";
import { readLiveClockMs } from "@/lib/live/now";
import { freeWebinarPhase, bannerPhase } from "@/lib/live/schedule";

/**
 * Below-the-fold module on idea pages, after Prompts.
 * Hidden once the banner window ends (build-along start).
 */
export async function LiveIdeaModule() {
  await connection();
  const nowMs = readLiveClockMs();
  if (bannerPhase(nowMs) === "hidden") return null;

  const freePhase = freeWebinarPhase(nowMs);
  const href =
    freePhase === "ended" || freePhase === "replay"
      ? `/live/build-along?utm_source=idea&utm_campaign=${UTM.paid}`
      : `/live/48-hours?utm_source=idea&utm_campaign=${UTM.free}`;

  const line =
    freePhase === "live"
      ? "We're live now — watch Ship a Weekend MVP in 48 Hours on YouTube."
      : freePhase === "open"
        ? `${FREE_WEBINAR.title}. Free, live Sat 31 Oct, 16:00 GMT. Register for reminders and the 7-day replay — then an edited version on YouTube.`
        : freePhase === "replay"
          ? "Replay for registrants for 7 days, then an edited version on YouTube. Or join the Build-Along on Sat 14 Nov."
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
