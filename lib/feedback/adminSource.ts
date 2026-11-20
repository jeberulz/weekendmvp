import "server-only";

import { convexAuthNextjsToken } from "@convex-dev/auth/nextjs/server";
import { fetchQuery } from "convex/nextjs";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { cache } from "react";

import { api } from "@/convex/_generated/api";
import { isValidPlatformConvexUrl } from "@/lib/platform-convex-url";
import type { ErrorRow, FeedbackOverview, FeedbackRow, Page } from "./types";

/**
 * WP95-S5. The owner's feedback page data layer. Every page resolves it, so the
 * middleware gate in front of `/admin/*` is never the only check.
 *
 * - Development with `EDITORIAL_FIXTURE_MODE=local-demo` exactly (the switch the
 *   middleware already honours for the admin area): fictional fixtures. Compiled
 *   out of production builds, because `NODE_ENV` is inlined.
 * - Otherwise live Convex reads with the signed-in session's token. Every query
 *   checks `requireSuperAdmin`; any refusal or failure is a 404.
 */

export const PAGE_SIZE = 50;
/** The overview window: counts cover this many days up to now. */
export const OVERVIEW_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;
/** A cursor is an opaque Convex string; anything longer is not one. */
const CURSOR_MAX = 2_000;

export type FeedbackSource = {
  readonly mode: "fixture" | "live";
  readonly nowMs: number;
  overview(): Promise<FeedbackOverview>;
  feedbackPage(cursor: string | null): Promise<Page<FeedbackRow>>;
  errorsPage(cursor: string | null): Promise<Page<ErrorRow>>;
};

export function parseCursor(raw: string | string[] | undefined): string | null {
  return typeof raw === "string" && raw.length > 0 && raw.length <= CURSOR_MAX ? raw : null;
}

function liveSource(token: string, nowMs: number): FeedbackSource {
  const sinceMs = nowMs - OVERVIEW_DAYS * DAY_MS;
  return {
    mode: "live",
    nowMs,
    overview: () => fetchQuery(api.feedback.admin.overview, { sinceMs }, { token }),
    async feedbackPage(cursor) {
      const result = await fetchQuery(api.feedback.admin.listFeedback, { paginationOpts: { numItems: PAGE_SIZE, cursor } }, { token });
      return { page: result.page, isDone: result.isDone, continueCursor: result.isDone ? null : result.continueCursor };
    },
    async errorsPage(cursor) {
      const result = await fetchQuery(api.feedback.admin.listErrors, { paginationOpts: { numItems: PAGE_SIZE, cursor } }, { token });
      return { page: result.page, isDone: result.isDone, continueCursor: result.isDone ? null : result.continueCursor };
    },
  };
}

async function fixtureSource(nowMs: number): Promise<FeedbackSource> {
  const { fixtureErrors, fixtureFeedback, fixtureOverview } = await import("./fixtures");
  const feedback = fixtureFeedback(nowMs);
  const errors = fixtureErrors(nowMs);
  function slice<T>(rows: readonly T[], cursor: string | null): Page<T> {
    const start = cursor === null ? 0 : Number(cursor);
    const from = Number.isSafeInteger(start) && start >= 0 ? start : 0;
    const page = rows.slice(from, from + PAGE_SIZE);
    const next = from + page.length;
    return { page, isDone: next >= rows.length, continueCursor: next >= rows.length ? null : String(next) };
  }
  return {
    mode: "fixture",
    nowMs,
    overview: async () => fixtureOverview(feedback, errors),
    feedbackPage: async (cursor) => slice(feedback, cursor),
    errorsPage: async (cursor) => slice(errors, cursor),
  };
}

async function resolveSource(): Promise<FeedbackSource | null> {
  const nowMs = Date.now();
  if (process.env.NODE_ENV !== "production" && process.env.EDITORIAL_FIXTURE_MODE === "local-demo") {
    return await fixtureSource(nowMs);
  }
  if (!isValidPlatformConvexUrl(process.env.NEXT_PUBLIC_CONVEX_URL)) return null;
  const token = await convexAuthNextjsToken();
  if (!token) return null;
  const source = liveSource(token, nowMs);
  try {
    // A cheap super-admin read: anyone the backend cannot vouch for stops here.
    await source.overview();
  } catch {
    // FORBIDDEN, an expired session or an unreachable backend: all refusals.
    return null;
  }
  return source;
}

/** Request-time only, deduplicated per request. A refusal is indistinguishable from a missing page. */
export const requireFeedbackSource = cache(async (): Promise<FeedbackSource> => {
  await connection();
  const source = await resolveSource();
  if (source === null) notFound();
  return source;
});
