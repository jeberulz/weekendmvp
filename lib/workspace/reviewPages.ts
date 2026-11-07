import {
  ART_DIRECTION_INFO,
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
  readFrom: "above",
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

/** "3 of 6 steps done", counting skipped steps as settled but not as done. */
export function progressSummary(states: readonly string[]): string {
  const done = states.filter((state) => state === "succeeded").length;
  return `${done} of ${states.length} steps done.`;
}

export function resumeMessage(result: { resumed: number; waitingForSlot: boolean }): string {
  if (result.resumed > 0) {
    return `Resumed ${result.resumed} ${result.resumed === 1 ? "step" : "steps"}.${result.waitingForSlot ? " Others are waiting for a free slot." : ""}`;
  }
  return result.waitingForSlot
    ? "Your team is busy with other work. Try resuming again in a little while."
    : "Nothing was waiting to resume.";
}
