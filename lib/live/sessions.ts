/**
 * Weekend MVP Live — typed free-session list.
 *
 * Config-only (no Convex). One entry per free session page at
 * `/live/{slug}`. Paid Build-Along stays on `/live/build-along`.
 *
 * John flow: copy the last block, fill slug/times/Luma, open a PR.
 * After the session: add youtubeId, durationIso, thumbnail, recap.
 */

export const LIVE_SESSION_RESERVED_SLUGS = [
  "build-along",
  "48-hours",
  "replays",
] as const;

/** Status override wins over the clock in `sessionPhase`. */
export type LiveSessionStatus = "cancelled" | "postponed" | "draft";

export type LiveSessionChapter = {
  name: string;
  /** Seconds from the start of the video. */
  startOffset: number;
  endOffset: number;
};

export type LiveSessionAgendaItem = {
  clock: string;
  title: string;
  body?: string;
  approx?: boolean;
  mark?: string;
};

export type LiveSessionSeo = {
  title?: string;
  description?: string;
};

export type LiveSession = {
  /** Stable id, e.g. `2026-10-31-hydrotrail`. */
  id: string;
  /** URL segment under `/live/`. Defaults to ideaSlug for the first build. */
  slug: string;
  ideaSlug: string;
  ideaName: string;
  title: string;
  oneLiner: string;
  kind: "free";
  /**
   * Plain category noun people search ("hydration", "habit tracker").
   * Feeds the Demand title formulas — not the idea name.
   */
  category: string;
  /** Tool shown live when known (e.g. "Claude Code"). */
  tool?: string;
  /** ISO-8601 with an explicit offset (`…Z` or `…+01:00`). */
  startsAt: string;
  endsAt: string;
  timezone: "Europe/London";
  lumaUrl: string;
  youtubeLiveUrl?: string;
  /** Public YouTube video id (11 chars). Absent → replay-pending after live. */
  youtubeId?: string;
  replayPublishedAt?: string;
  /** ISO-8601 duration, required once youtubeId is set (e.g. `PT58M`). */
  durationIso?: string;
  /** Path under `public/`, e.g. `/image/live/{slug}.png`. */
  thumbnail?: string;
  agenda?: readonly LiveSessionAgendaItem[];
  chapters?: readonly LiveSessionChapter[];
  /** 3–5 lines on what got built — keeps past pages from going thin. */
  recap?: string;
  /** Gated prompt-pack / extras link (PR 6). */
  extrasHref?: string;
  status?: LiveSessionStatus;
  seo?: LiveSessionSeo;
  /** Real content date for sitemap lastmod. */
  updatedAt: string;
};

/**
 * Free sessions, newest first by startsAt when sorted.
 * HydroTrail (31 Oct 2026) ships without youtubeId → replay-pending until
 * John adds the public replay.
 */
export const LIVE_SESSIONS: readonly LiveSession[] = [
  {
    id: "2026-10-31-hydrotrail",
    slug: "hydration-app-for-hikers",
    ideaSlug: "hydration-app-for-hikers",
    ideaName: "HydroTrail",
    title: "Build a real app live in one hour (free)",
    oneLiner: "a hydration coach for hikers",
    kind: "free",
    category: "hydration",
    tool: "Claude Code",
    startsAt: "2026-10-31T16:00:00.000Z",
    endsAt: "2026-10-31T17:00:00.000Z",
    timezone: "Europe/London",
    lumaUrl: "https://luma.com/wzlj5h23",
    // youtubeId omitted on purpose: page shows replay-pending until John adds it.
    agenda: [
      {
        clock: "16:00",
        title: "Why HydroTrail",
        body: "I explain the idea and open an empty folder. Put the idea you've been sitting on in the chat, in five words.",
      },
      {
        clock: "16:08",
        title: "The weekend test",
        body: "I score HydroTrail against the six checks, then two ideas from the chat.",
      },
      {
        clock: "16:18",
        title: "The idea page and Prompt 1",
        body: "I open the HydroTrail idea page and its research, then paste Prompt 1 into Claude Code.",
      },
      {
        clock: "16:25",
        approx: true,
        title: "First screen working",
        body: "The landing screen runs, built from the empty folder.",
        mark: "This is the promise.",
      },
      {
        clock: "16:27–16:43",
        title: "Setup and the live hike",
        body: "The next two screens, then the recap if time holds.",
      },
      {
        clock: "16:45",
        approx: true,
        title: "Deploy",
        body: "If it holds, it goes live on a public link before the hour's up.",
        mark: "A bonus, not a promise.",
      },
      {
        clock: "16:50",
        title: "Your questions",
        body: "Ask anything, including how to run the same steps on your own idea.",
      },
      { clock: "17:00", title: "Close" },
    ],
    seo: {
      // Demand §4 replay-pending / replay titles (HydroTrail launches after 31 Oct).
      title: "Build a Hydration App with AI: HydroTrail Replay | Weekend MVP",
      description:
        "Full replay: HydroTrail, a hydration coach for hikers, taken from idea to first screen live with AI. Chapters, the exact prompt used, and the 48-hour plan for your own build.",
    },
    updatedAt: "2026-11-02T00:00:00.000Z",
  },
] as const;

/** No Luma series calendar URL in repo/env → newsletter (owner-amended open). */
export const LIVE_SERIES_SUBSCRIBE_HREF = "/newsletter" as const;

export const LIVE_SESSION_PATH_PREFIX = "/live" as const;

export function sessionPath(slug: string): string {
  return `${LIVE_SESSION_PATH_PREFIX}/${slug}`;
}

export function sessionEmbedUrl(youtubeId: string): string {
  return `https://www.youtube.com/embed/${youtubeId}`;
}

export function sessionWatchUrl(youtubeId: string): string {
  return `https://www.youtube.com/watch?v=${youtubeId}`;
}

export function listLiveSessions(): readonly LiveSession[] {
  return LIVE_SESSIONS;
}

export function getSessionBySlug(slug: string): LiveSession | undefined {
  return LIVE_SESSIONS.find((s) => s.slug === slug);
}

export function getSessionById(id: string): LiveSession | undefined {
  return LIVE_SESSIONS.find((s) => s.id === id);
}

/** Non-draft sessions tied to an idea, newest first. */
export function sessionsForIdea(ideaSlug: string): LiveSession[] {
  return LIVE_SESSIONS.filter(
    (s) => s.ideaSlug === ideaSlug && s.status !== "draft",
  ).sort(
    (a, b) => Date.parse(b.startsAt) - Date.parse(a.startsAt),
  );
}

export function publishedSessions(): LiveSession[] {
  return LIVE_SESSIONS.filter((s) => s.status !== "draft");
}

/** HydroTrail — the 31 Oct free session that still backs FREE_WEBINAR. */
export function hydrotrailSession(): LiveSession {
  const session = getSessionById("2026-10-31-hydrotrail");
  if (!session) {
    throw new Error("HydroTrail session missing from LIVE_SESSIONS");
  }
  return session;
}

function titleCaseCategory(category: string): string {
  return category
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function shortUkDate(startsAt: string): string {
  const d = new Date(startsAt);
  const weekday = d.toLocaleDateString("en-GB", {
    weekday: "short",
    timeZone: "UTC",
  });
  const day = d.toLocaleDateString("en-GB", {
    day: "numeric",
    timeZone: "UTC",
  });
  const month = d.toLocaleDateString("en-GB", {
    month: "short",
    timeZone: "UTC",
  });
  return `${weekday} ${day} ${month}`;
}

/**
 * Demand category-led title formulas (seo-targets-v1 §2), not the
 * idea-name-led templates from spec-v1 §2.
 */
export function sessionDefaultTitle(
  session: LiveSession,
  kind: "before" | "after",
): string {
  if (session.seo?.title) return session.seo.title;
  const cat = titleCaseCategory(session.category);
  if (kind === "before") {
    const date = shortUkDate(session.startsAt);
    if (session.tool) {
      return `Build a ${cat} App with ${session.tool}, Live · ${date} | Weekend MVP`;
    }
    return `Build a ${cat} App with AI, Live · ${date} | Weekend MVP`;
  }
  return `Build a ${cat} App with AI: ${session.ideaName} Replay | Weekend MVP`;
}

export function sessionDefaultDescription(
  session: LiveSession,
  kind: "before" | "after",
): string {
  if (session.seo?.description) return session.seo.description;
  const tool = session.tool ?? "AI";
  if (kind === "before") {
    const date = shortUkDate(session.startsAt);
    const time = new Date(session.startsAt).toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: "UTC",
    });
    return `Free live session, ${date}, ${time} GMT. Watch John take ${session.ideaName}, ${session.oneLiner}, from idea page to first screen with ${tool}. Free on YouTube; register for reminders.`;
  }
  return `Full replay: ${session.ideaName}, ${session.oneLiner}, built live with ${tool}. Chapters, the exact prompts used, and the 48-hour plan to build your own version this weekend.`;
}

/** Hub series title from Demand §2 / §6. */
export const LIVE_HUB_SEO = {
  title: "Weekend MVP Live: Free Live AI App Builds, Every Two Weeks",
  description:
    "Watch an app idea go from page to live link with AI, live and free every two weeks. Past sessions and full replays below.",
  keywords: [
    "Weekend MVP Live",
    "build app live",
    "vibe coding live stream",
    "live AI app build",
  ],
} as const;
