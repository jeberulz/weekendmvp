import type { LiveSession } from "@/lib/live/sessions";
import { LIVE_SESSIONS, LIVE_SERIES_SUBSCRIBE_HREF } from "@/lib/live/sessions";

/** ±15 min pad around the live hour (spec §3). */
export const SESSION_LIVE_LEAD_MS = 15 * 60 * 1000;
export const SESSION_LIVE_TRAIL_MS = 15 * 60 * 1000;

export type SessionPhase =
  | "upcoming"
  | "live"
  | "replay-pending"
  | "past"
  | "cancelled"
  | "postponed"
  | "draft";

/**
 * Pure clock → phase. Status override wins. No Date.now() inside.
 * Unit-tested the same way as freeWebinarPhase.
 */
export function sessionPhase(session: LiveSession, nowMs: number): SessionPhase {
  switch (session.status) {
    case "cancelled":
      return "cancelled";
    case "postponed":
      return "postponed";
    case "draft":
      return "draft";
    case undefined:
      break;
    default: {
      const _exhaustive: never = session.status;
      return _exhaustive;
    }
  }

  const startMs = Date.parse(session.startsAt);
  const endMs = Date.parse(session.endsAt);
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) {
    throw new Error(`Invalid session times for ${session.id}`);
  }

  if (nowMs < startMs - SESSION_LIVE_LEAD_MS) return "upcoming";
  if (nowMs <= endMs + SESSION_LIVE_TRAIL_MS) return "live";
  if (session.youtubeId) return "past";
  return "replay-pending";
}

/** Next scheduled free session that is still upcoming or live (not draft/cancelled). */
export function nextUpcomingSession(nowMs: number): LiveSession | null {
  const candidates = LIVE_SESSIONS.filter((s) => {
    const phase = sessionPhase(s, nowMs);
    return phase === "upcoming" || phase === "live";
  }).sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
  return candidates[0] ?? null;
}

/** Past + replay-pending sessions, newest first (hub archive). */
export function pastSessions(nowMs: number): LiveSession[] {
  return LIVE_SESSIONS.filter((s) => {
    const phase = sessionPhase(s, nowMs);
    return phase === "past" || phase === "replay-pending";
  }).sort((a, b) => Date.parse(b.startsAt) - Date.parse(a.startsAt));
}

/**
 * CTA for the "no next session" empty state on past / replay-pending pages.
 * Newsletter chosen: no Luma series calendar URL in repo/env.
 */
export function nextSessionEmptyCopy(): {
  line: string;
  ctaLabel: string;
  ctaHref: string;
} {
  return {
    line: "Next session date coming soon.",
    ctaLabel: "Get session dates by email",
    ctaHref: LIVE_SERIES_SUBSCRIBE_HREF,
  };
}

/** Next boundary (ms) where the phase can flip — for PhaseRefresh. */
export function nextPhaseBoundaryMs(
  session: LiveSession,
  nowMs: number,
): number | null {
  const phase = sessionPhase(session, nowMs);
  const startMs = Date.parse(session.startsAt);
  const endMs = Date.parse(session.endsAt);

  switch (phase) {
    case "upcoming":
      return startMs - SESSION_LIVE_LEAD_MS;
    case "live":
      return endMs + SESSION_LIVE_TRAIL_MS;
    case "replay-pending":
    case "past":
    case "cancelled":
    case "postponed":
    case "draft":
      return null;
    default: {
      const _exhaustive: never = phase;
      return _exhaustive;
    }
  }
}
