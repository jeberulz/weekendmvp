"use client";

import { useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { ExternalLink } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { ModuleSkeleton, PersonalModule } from "@/components/platform/home/module-states";
import { useFeatureGate } from "@/components/platform/hub/useFeatureGate";
import { trackDashboardEvent } from "@/lib/track";
import { cn } from "@/lib/utils";

type Listing = FunctionReturnType<typeof api.platform.liveBuilds.list>;
type Session = Listing["upcoming"][number];

const EYEBROW = "font-mono text-[11px] uppercase tracking-[0.08em] text-home-ink-3";
const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-home-orange-ink";
const ACTION = cn(
  "inline-flex min-h-11 items-center justify-center gap-1.5 self-start rounded-[9px] px-4 text-sm font-medium transition-colors",
  FOCUS,
);

/** "Wednesday, November 4, 2026 at 5:00 PM GMT": the member's own zone, named. */
export function formatSessionTime(ms: number): string {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(ms);
}

function SessionLink({ href, label, action }: { href: string; label: string; action: "join" | "replay" }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => trackDashboardEvent({ name: "live_build_opened", props: { action } })}
      className={cn(ACTION, "bg-home-ink text-home-card hover:bg-home-panel")}
    >
      {label}
      <ExternalLink aria-hidden className="size-3.5 shrink-0" />
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  );
}

function SessionAction({
  session,
  entitled,
  onLocked,
}: {
  session: Session;
  entitled: boolean;
  onLocked: (from: HTMLElement) => void;
}) {
  const past = session.status === "ended";
  if (!entitled) {
    // Point of intent: the member asked for something Builder's Hub includes.
    if (past && !session.hasReplay) return <p className="text-sm text-home-ink-2">Replay coming soon.</p>;
    return (
      <button
        type="button"
        onClick={(event) => onLocked(event.currentTarget)}
        className={cn(ACTION, "border border-home-ink bg-home-card text-home-ink hover:bg-home-sunk")}
      >
        {past ? "Watch the replay" : "Join the live build"}
      </button>
    );
  }
  if (past) {
    return session.replayUrl ? (
      <SessionLink href={session.replayUrl} label="Watch the replay" action="replay" />
    ) : (
      <p className="text-sm text-home-ink-2">Replay coming soon.</p>
    );
  }
  if (session.joinUrl) return <SessionLink href={session.joinUrl} label="Join the live build" action="join" />;
  return (
    <p className="text-sm text-home-ink-2">
      {session.status === "open"
        ? "The join link will appear here before the start."
        : "The join link opens here 24 hours before the start."}
    </p>
  );
}

function SessionCard({
  session,
  entitled,
  onLocked,
}: {
  session: Session;
  entitled: boolean;
  onLocked: (from: HTMLElement) => void;
}) {
  const titleId = `live-${session.id}`;
  return (
    <li>
      <article aria-labelledby={titleId} className="flex flex-col gap-2.5 rounded-[14px] border border-home-rule bg-home-card p-5">
        <p className={EYEBROW}>
          <time dateTime={new Date(session.startsAt).toISOString()}>{formatSessionTime(session.startsAt)}</time>
          {" · "}
          {session.durationMin} minutes
        </p>
        <h3 id={titleId} className="font-editorial text-[22px] font-normal leading-[1.2] text-home-ink">
          {session.title}
        </h3>
        {session.summary ? <p className="text-[15px] leading-[1.5] text-home-ink-2">{session.summary}</p> : null}
        <SessionAction session={session} entitled={entitled} onLocked={onLocked} />
      </article>
    </li>
  );
}

function LiveList() {
  const listing = useQuery(api.platform.liveBuilds.list, {});
  const { openSheet, sheet } = useFeatureGate();
  if (!listing) return <ModuleSkeleton label="Loading live builds" className="h-[320px]" />;
  const onLocked = (from: HTMLElement) => openSheet("live_builds", from);
  const { entitled, upcoming, past } = listing;

  return (
    <div className="flex flex-col gap-10">
      <section aria-labelledby="live-upcoming" className="flex flex-col gap-3">
        <h2 id="live-upcoming" className={EYEBROW}>
          Coming up
        </h2>
        {upcoming.length === 0 ? (
          <p className="border-t border-home-ink pt-3 text-[15px] text-home-ink-2">
            No live build is scheduled yet. The next one will show here.
          </p>
        ) : (
          <ul className="flex flex-col gap-4">
            {upcoming.map((session) => (
              <SessionCard key={session.id} session={session} entitled={entitled} onLocked={onLocked} />
            ))}
          </ul>
        )}
      </section>

      {past.length > 0 ? (
        <section aria-labelledby="live-past" className="flex flex-col gap-3">
          <h2 id="live-past" className={EYEBROW}>
            Replays
          </h2>
          <ul className="flex flex-col gap-4">
            {past.map((session) => (
              <SessionCard key={session.id} session={session} entitled={entitled} onLocked={onLocked} />
            ))}
          </ul>
        </section>
      ) : null}

      {sheet}
    </div>
  );
}

/**
 * WP63-S8. The live builds hub. Client-rendered from the member query, so no
 * join or replay link is ever in static HTML or a client bundle. Times show
 * in the member's own time zone, with the zone named.
 */
export function LiveBuilds() {
  return (
    <PersonalModule skeleton={<ModuleSkeleton label="Loading live builds" className="h-[320px]" />}>
      <LiveList />
    </PersonalModule>
  );
}
