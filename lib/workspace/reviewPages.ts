import {
  ART_DIRECTION_INFO,
  contrastRatio,
  MIN_TEXT_CONTRAST,
  TYPE_PAIRS,
  type ArtDirection,
  type TypePairId,
} from "./contracts/artifacts";

/**
 * L1-C1 and L1-C6: the words on the Brand kit page and Team HQ. Pure, so the
 * wording and the arithmetic are unit-tested. A page only says what it checked.
 */

export const BRAND_NONE_COPY = "Your brand kit will appear here once your team writes it.";
export const BRAND_UNAVAILABLE_COPY = "Your brand kit can't be shown right now. Check back in a little while.";
export const BRAND_IMAGES_COPY = "Image generation is coming soon, so the logo and hero art are described in words for now.";
export const BRAND_APPROVED_NOTE = "Nothing is published yet.";
/** "details" reads as a plural noun in the shared review card's sentences ("Approve these brand kit details as they are"). */
export const BRAND_ARTIFACT = {
  plural: "brand kit details",
  approvedNote: BRAND_APPROVED_NOTE,
  readFrom: "below",
} as const;

export const BLUEPRINT_NONE_COPY = "Your blueprint will appear here once your team writes it.";
export const BLUEPRINT_UNAVAILABLE_COPY = "Your blueprint can't be shown right now. Check back in a little while.";
export const BLUEPRINT_APPROVED_NOTE = "Your team carries on from it.";
export const BLUEPRINT_ARTIFACT = {
  plural: "blueprint details",
  approvedNote: BLUEPRINT_APPROVED_NOTE,
  readFrom: "above",
} as const;

export const WAITING_EMPTY_COPY = "Nothing is waiting on you right now.";
export const WAITING_ERROR_COPY = "Your reviews couldn't load right now. Reload the page to try again.";
export const BLUEPRINT_SECTION_ID = "blueprint";

const HEX = /^#[0-9A-Fa-f]{6}$/;

export const PALETTE_ROLES = [
  ["primary", "Primary"],
  ["secondary", "Secondary"],
  ["accent", "Accent"],
  ["ground", "Ground"],
  ["ink", "Ink"],
] as const;
export type PaletteRoleKey = (typeof PALETTE_ROLES)[number][0];

/**
 * Black or white, whichever reads better on `hex`. Used for the text on a palette tile, so the text sits only on
 * a pair that passes. `ok` is false when even the better one is under 4.5:1 (a mid-tone colour): the caller then
 * puts the text in a ground chip instead.
 */
export function readableOn(hex: string): { text: "black" | "white"; ratio: number; ok: boolean } {
  const black = contrastRatio("#000000", hex);
  const white = contrastRatio("#ffffff", hex);
  const text = black >= white ? "black" : "white";
  const ratio = Math.max(black, white);
  return { text, ratio, ok: ratio >= MIN_TEXT_CONTRAST };
}
/** True for a `#RRGGBB` string; the swatch is drawn only from one. */
export function isHexColour(value: string): boolean {
  return HEX.test(value);
}

export const SHAPE_LABELS = { sharp: "Sharp corners", soft: "Soft corners", round: "Round corners" } as const;
export const DENSITY_LABELS = { airy: "Airy spacing", balanced: "Balanced spacing", compact: "Compact spacing" } as const;
export const THEME_LABELS = { light: "Light theme", dark: "Dark theme" } as const;

export function directionLabel(direction: ArtDirection): string {
  return ART_DIRECTION_INFO[direction].label;
}
export function directionSummary(direction: ArtDirection): string {
  return ART_DIRECTION_INFO[direction].summary;
}

/** "Fraunces for headings, Newsreader for text". */
export function typePairLabel(pair: TypePairId): string {
  const { heading, body } = TYPE_PAIRS[pair];
  return `${heading.family} for headings, ${body.family} for text`;
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const plural = (count: number, unit: string): string => `${count} ${unit}${count === 1 ? "" : "s"}`;

/** When a review closes, in words: "in 2 days", "in 5 hours", "in 30 minutes", "soon", or "closed". */
export function expiresInWords(expiresAt: number, now: number): string {
  const left = expiresAt - now;
  if (left <= 0) return "closed";
  if (left >= DAY) return `in ${plural(Math.floor(left / DAY), "day")}`;
  if (left >= HOUR) return `in ${plural(Math.floor(left / HOUR), "hour")}`;
  if (left >= MINUTE) return `in ${plural(Math.floor(left / MINUTE), "minute")}`;
  return "in under a minute";
}

export function changeRoundNote(changeRound: number): string | null {
  return changeRound > 0 ? `Change round ${changeRound}` : null;
}

export const BLUEPRINT_LABELS = {
  oneUser: "Who it is for",
  oneLoop: "The one loop",
  features: "Features",
  scopeCuts: "Left out on purpose",
  market: "The market",
  competitors: "Other options people use",
} as const;

// ---------------------------------------------------------------------------
// Team HQ: launch progress and the team
// ---------------------------------------------------------------------------

/** The partner's name is not known on Team HQ (it lives in the wizard's answers), so the team section says this. */
export const TEAM_PARTNER_NAME = "Your co-founder";
export const TEAM_NOT_STARTED_COPY = "Your launch hasn't started, so there is no team yet.";
export const TEAM_UNAVAILABLE_COPY = "Your team can't be shown right now. Check back in a little while.";
export const PROGRESS_NOT_STARTED_COPY = "Your launch hasn't started yet, so there are no steps to show.";
export const PROGRESS_UNAVAILABLE_COPY = "Your launch progress can't be shown right now. Check back in a little while.";

export const STEP_STATE_LABELS = {
  waiting: "Waiting",
  queued: "Queued",
  running: "Running",
  paused: "Paused",
  succeeded: "Done",
  failed: "Failed",
  skipped: "Skipped",
} as const;

/**
 * "5 of 5 steps done. 6 skipped for now." Skipped steps are not built yet and
 * can never finish, so they are counted apart, not as steps left to do.
 */
export function progressSummary(states: readonly string[]): string {
  const skipped = states.filter((state) => state === "skipped").length;
  const counted = states.length - skipped;
  const done = states.filter((state) => state === "succeeded").length;
  return `${done} of ${counted} steps done.${skipped === 0 ? "" : ` ${skipped} skipped for now.`}`;
}

/** The blueprint and team stage belongs to "Your team"; Launch progress leaves its buttons to that section. */
export const TEAM_STAGE_KEYS: readonly string[] = ["blueprint", "roster"];

export const RETRY_NOOP_COPY = "Nothing could start yet: your team is busy with other work. Try again in a few minutes.";
export const RETRY_SENT_PROGRESS_COPY = "Sent. Each step below shows where it stands.";
export const RETRY_SENT_TEAM_COPY = "Sent. Launch progress above shows where each step stands.";
export const TRY_COST_COPY = "Each try counts toward your hourly crew work.";
export const BLUEPRINT_MISSING_COPY = "The blueprint can't be shown right now.";

/** What a Try again says, from what `retryLaunch` returned: never a claim that work started. */
export function retryMessage(view: { state: string }, sent: string): string {
  return view.state === "failed" ? RETRY_NOOP_COPY : sent;
}

export function resumeMessage(result: { resumed: number; waitingForSlot: boolean }): string {
  if (result.resumed > 0) {
    return `Resumed ${result.resumed} ${result.resumed === 1 ? "step" : "steps"}.${result.waitingForSlot ? " Others are waiting for a free slot." : ""}`;
  }
  return result.waitingForSlot
    ? "Your team is busy with other work. Try resuming again in a little while."
    : "Nothing was waiting to resume.";
}

// ---------------------------------------------------------------------------
// Files: the reader's meta line
// ---------------------------------------------------------------------------

const WEEK = 7 * DAY;

/** "Thu, 9:20 PM" within a week, "Nov 7" after; an unknown or future time reads as a plain date. */
export function formatKeptWhen(at: number, now: number, timeZone?: string): string {
  const age = now - at;
  if (age >= 0 && age < WEEK) {
    return new Intl.DateTimeFormat("en-US", { weekday: "short", hour: "numeric", minute: "2-digit", timeZone }).format(at);
  }
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone }).format(at);
}

/** "Kept by Wren · updated Thu, 9:20 PM · 3 of 20 facts", or "Nothing kept yet · 0 of 20 facts". */
export function memoryMetaLine(input: { name: string; updatedAt: number | null; facts: number; factsMax: number; now: number; timeZone?: string }): string {
  const kept = input.updatedAt === null ? "Nothing kept yet" : `Kept by ${input.name} · updated ${formatKeptWhen(input.updatedAt, input.now, input.timeZone)}`;
  return `${kept} · ${input.facts} of ${input.factsMax} facts`;
}

/** The text a Copy puts on the clipboard: the summary and the facts, as plain text. */
export function memoryCopyText(name: string, summary: string, facts: readonly string[]): string {
  const parts = [`# What ${name} knows`, summary === "" ? "(No summary yet.)" : summary, "## Facts"];
  const list = facts.length === 0 ? "(No facts yet.)" : facts.map((fact) => `- ${fact}`).join("\n");
  return `${parts[0]}\n\n${parts[1]}\n\n${parts[2]}\n${list}\n`;
}

/** The rail's links to the pages that hold the team's work. Only built pages; each has its own empty state. */
export const FILES_RAIL_LINKS = [
  { label: "Blueprint", slug: "team", hash: BLUEPRINT_SECTION_ID },
  { label: "Brand kit", slug: "brand" },
  { label: "Email sequence", slug: "email" },
  { label: "Social posts", slug: "social" },
] as const;
