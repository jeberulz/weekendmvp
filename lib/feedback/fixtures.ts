import type { ErrorRow, FeedbackOverview, FeedbackRow } from "./types";

/**
 * Fictional data for the local demo (`EDITORIAL_FIXTURE_MODE=local-demo`,
 * development only). Ids and notes are invented; nothing here is a real
 * founder's.
 */

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

const OWNERS = ["k17demoowner0000000000000a1", "k17demoowner0000000000000b2", "k17demoowner0000000000000c3"] as const;
const BUSINESSES = ["k97demobusiness00000000000d4", "k97demobusiness00000000000e5", "k97demobusiness00000000000f6"] as const;
const FULL_STEPS = [
  { key: "blueprint", state: "succeeded" },
  { key: "roster", state: "succeeded" },
  { key: "brand_kit", state: "succeeded" },
  { key: "email", state: "needs_you" },
  { key: "social", state: "needs_you" },
];

export function fixtureFeedback(nowMs: number): FeedbackRow[] {
  const row = (index: number, ago: number, rest: Omit<FeedbackRow, "id" | "createdAt" | "buildVersion">): FeedbackRow => ({
    id: `fixture-feedback-${index}`,
    createdAt: nowMs - ago,
    buildVersion: index < 4 ? "9f3c2ab" : "41d7e0c",
    ...rest,
  });
  return [
    row(1, 12 * MIN, { ownerId: OWNERS[0], projectId: BUSINESSES[0], surface: "workspace", rating: 5, route: "/dashboard/b/[id]/email", stepStates: FULL_STEPS,
      note: "Approving all four emails in one go was exactly what I wanted. I would like to edit one line myself without asking for a whole round of changes." }),
    row(2, 3 * HOUR, { ownerId: OWNERS[1], projectId: null, surface: "wizard", rating: 3, route: "/start/own", stepStates: [{ key: "wizard_step", state: "commercial_model" }],
      note: "I did not know what freemium meant here. A one-line example under each choice would help." }),
    row(3, 7 * HOUR, { ownerId: OWNERS[0], projectId: BUSINESSES[0], surface: "workspace", rating: null, route: "/dashboard/b/[id]", stepStates: FULL_STEPS,
      note: "The chat column covers the right edge of my laptop screen when the window is narrow." }),
    row(4, 1 * DAY + 2 * HOUR, { ownerId: OWNERS[2], projectId: BUSINESSES[2], surface: "workspace", rating: 2, route: "/dashboard/b/[id]/team", stepStates: [
      { key: "blueprint", state: "succeeded" }, { key: "roster", state: "failed" }, { key: "brand_kit", state: "waiting" },
    ], note: "My team never showed up. It says it could not finish and the retry button did nothing for me." }),
    row(5, 2 * DAY, { ownerId: OWNERS[1], projectId: BUSINESSES[1], surface: "workspace", rating: 4, route: "/dashboard/b/[id]/brand", stepStates: FULL_STEPS,
      note: "Love the palette. Can the kit show the font names in plain words next to the sample?" }),
    row(6, 3 * DAY, { ownerId: OWNERS[2], projectId: null, surface: "wizard", rating: 5, route: "/start/[idea]", stepStates: [{ key: "wizard_step", state: "blueprint" }],
      note: "Short and clear. I knew what to do at every step." }),
  ];
}

export function fixtureErrors(nowMs: number): ErrorRow[] {
  const row = (index: number, ago: number, rest: Omit<ErrorRow, "id" | "createdAt" | "buildVersion">): ErrorRow => ({
    id: `fixture-error-${index}`,
    createdAt: nowMs - ago,
    buildVersion: index < 5 ? "9f3c2ab" : "41d7e0c",
    ...rest,
  });
  return [
    row(1, 4 * MIN, { ownerId: OWNERS[2], projectId: BUSINESSES[2], source: "wren", errorClass: "wren_failed", route: "/dashboard/b/[id]" }),
    row(2, 40 * MIN, { ownerId: OWNERS[2], projectId: BUSINESSES[2], source: "action", errorClass: "RateLimited", route: "/dashboard/b/[id]/team" }),
    row(3, 2 * HOUR, { ownerId: OWNERS[0], projectId: BUSINESSES[0], source: "boundary", errorClass: "TypeError", route: "/dashboard/b/[id]/social" }),
    row(4, 5 * HOUR, { ownerId: OWNERS[0], projectId: BUSINESSES[0], source: "action", errorClass: "APPROVAL_NOT_PENDING", route: "/dashboard/b/[id]/email" }),
    row(5, 9 * HOUR, { ownerId: OWNERS[1], projectId: null, source: "action", errorClass: "RATE_LIMITED", route: "/start/own" }),
    row(6, 1 * DAY, { ownerId: OWNERS[1], projectId: BUSINESSES[1], source: "boundary", errorClass: "TypeError", route: "/dashboard/b/[id]/social" }),
    row(7, 1 * DAY + 3 * HOUR, { ownerId: OWNERS[2], projectId: BUSINESSES[2], source: "wren", errorClass: "wren_stopped", route: "/dashboard/b/[id]" }),
    row(8, 2 * DAY, { ownerId: OWNERS[0], projectId: BUSINESSES[0], source: "action", errorClass: "Error", route: "/dashboard/b/[id]/files" }),
  ];
}

function groupBy(values: readonly string[]): { key: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return [...counts.entries()].map(([key, count]) => ({ key, count })).sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
}

export function fixtureOverview(feedback: readonly FeedbackRow[], errors: readonly ErrorRow[]): FeedbackOverview {
  const ratingCounts = [0, 0, 0, 0, 0];
  let sum = 0;
  let rated = 0;
  for (const row of feedback) {
    if (row.rating === null) continue;
    ratingCounts[row.rating - 1] = (ratingCounts[row.rating - 1] ?? 0) + 1;
    sum += row.rating;
    rated += 1;
  }
  return {
    feedback: { count: feedback.length, ratingAverage: rated === 0 ? null : sum / rated, ratingCounts, unrated: feedback.length - rated, truncated: false },
    errors: {
      count: errors.length,
      byClass: groupBy(errors.map((row) => row.errorClass)),
      byRoute: groupBy(errors.map((row) => row.route)),
      bySource: groupBy(errors.map((row) => row.source)),
      truncated: false,
    },
  };
}
