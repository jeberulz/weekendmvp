import { v, type Infer } from "convex/values";

/**
 * WP63-S8. Pure rules for live builds, shared by the schema, the member
 * query and the operator mutations. One live build a month, with a replay,
 * is part of Builder's Hub (ruling "WP55 / bundle").
 *
 * Status is stored, not computed in the query: scheduled mutations flip it
 * at the right moment, so the member query never reads the clock and a
 * browser clock can never open a join link early.
 *   scheduled: more than 24 hours before the start
 *   open:      from 24 hours before the start until the end (join link shown)
 *   ended:     after the end (replay shown once the operator adds it)
 *   canceled:  hidden from members
 */

export const LIVE_BUILD_STATUS_VALUES = ["scheduled", "open", "ended", "canceled"] as const;
export const liveBuildStatusValidator = v.union(
  v.literal("scheduled"),
  v.literal("open"),
  v.literal("ended"),
  v.literal("canceled"),
);
export type LiveBuildStatus = Infer<typeof liveBuildStatusValidator>;

/** The join link shows from this long before the start. */
export const JOIN_OPENS_BEFORE_MS = 24 * 60 * 60 * 1000;
export const MIN_DURATION_MIN = 15;
export const MAX_DURATION_MIN = 240;
export const MAX_TITLE_LENGTH = 120;
export const MAX_SUMMARY_LENGTH = 600;
export const MAX_URL_LENGTH = 2048;

export function endOf(session: { startsAt: number; durationMin: number }): number {
  return session.startsAt + session.durationMin * 60_000;
}

export function joinOpensAt(session: { startsAt: number }): number {
  return session.startsAt - JOIN_OPENS_BEFORE_MS;
}

/** What the status should be at `now`. A canceled session stays canceled. */
export function liveStatusAt(
  session: { startsAt: number; durationMin: number; status?: LiveBuildStatus },
  now: number,
): LiveBuildStatus {
  if (session.status === "canceled") return "canceled";
  if (now >= endOf(session)) return "ended";
  if (now >= joinOpensAt(session)) return "open";
  return "scheduled";
}

/**
 * An operator-supplied link: https only, no credentials, bounded. Returns the
 * normalized link or null. The tool is O8's call, so no host list here.
 */
export function readHttpsUrl(value: string): string | null {
  if (value.length > MAX_URL_LENGTH) return null;
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || url.username !== "" || url.password !== "") return null;
  return url.href;
}
