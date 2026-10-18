/**
 * Weekend MVP Live — date/price/URL config.
 *
 * One timestamp drives every early-bird string and the Stripe price pick
 * (`EARLY_BIRD_ENDS_AT`). Asset slots stay empty until filled; UI hides them.
 *
 * Seller / MoR: Rulz&Co (confirmed). Checkout uses automatic_tax with
 * tax-inclusive Stripe prices and the line
 * "No VAT added: Rulz&Co is not VAT-registered."
 */

export const LIVE_EVENT_KEY = "build-along-2026-11-14" as const;

/** Shared 20-seat cap across the $19 and $29 prices. */
export const SEATS_TOTAL = 20;

/** Sales open Sunday 1 Nov 2026 00:00 GMT. */
export const SALES_OPEN_AT = Date.parse("2026-11-01T00:00:00.000Z");

/**
 * Early-bird cut-off: inclusive through 23:59:59 GMT Sun 8 Nov 2026.
 * From 2026-11-09T00:00:00Z the regular $29 lookup key is used.
 */
export const EARLY_BIRD_ENDS_AT = Date.parse("2026-11-08T23:59:59.000Z");

/** Seller / MoR line on the paid page and checkout custom text. */
export const LIVE_WORKSHOP_SELLER_LINE =
  "No VAT added: Rulz&Co is not VAT-registered." as const;

/** Zoom join link placeholder — fill via NEXT_PUBLIC_LIVE_ZOOM_URL. */
export function liveZoomUrl(env: NodeJS.ProcessEnv = process.env): string {
  return (env.NEXT_PUBLIC_LIVE_ZOOM_URL ?? "").trim();
}

/** Signup attribution tag for Build-Along gate → account creation. */
export const LIVE_BUILDALONG_SIGNUP_SRC = "live-buildalong" as const;

export const FREE_WEBINAR = {
  slug: "48-hours",
  title: "Ship a Weekend MVP in 48 Hours",
  startAt: Date.parse("2026-10-31T16:00:00.000Z"),
  endAt: Date.parse("2026-10-31T17:00:00.000Z"),
  /** 7-day registrant replay window after the session. */
  replayEndsAt: Date.parse("2026-11-07T17:00:00.000Z"),
  durationMin: 60,
  platform: "YouTube Live" as const,
} as const;

export const BUILD_ALONG = {
  slug: "build-along",
  title: "Weekend MVP Build-Along",
  subline: "Build it Saturday, ship it Sunday.",
  startAt: Date.parse("2026-11-14T15:00:00.000Z"),
  endAt: Date.parse("2026-11-14T17:00:00.000Z"),
  durationMin: 120,
  platform: "Zoom" as const,
  earlyBirdUsd: 19,
  standardUsd: 29,
} as const;

/** Next build-along (sold-out / after-event). Ticket link only once configured. */
export const NEXT_BUILD_ALONG = {
  startAt: Date.parse("2026-12-05T15:00:00.000Z"),
  endAt: Date.parse("2026-12-05T17:00:00.000Z"),
  label: "Sat 5 Dec 2026, 15:00 GMT, on Zoom",
  shortLabel: "Sat 5 Dec, 15:00 GMT",
} as const;

/**
 * Public URLs — placeholders until John fills them.
 * Luma: `NEXT_PUBLIC_LIVE_LUMA_URL`
 * YouTube live (public during the hour): `NEXT_PUBLIC_LIVE_YOUTUBE_URL`
 * Edited public replay (later): `NEXT_PUBLIC_LIVE_YOUTUBE_REPLAY_URL`
 * Next session Stripe price (5 Dec): `STRIPE_LIVE_WORKSHOP_PRICE_DEC5`
 */
export function liveUrls(env: NodeJS.ProcessEnv = process.env) {
  return {
    lumaEventUrl: (env.NEXT_PUBLIC_LIVE_LUMA_URL ?? "").trim(),
    youtubeLiveUrl: (env.NEXT_PUBLIC_LIVE_YOUTUBE_URL ?? "").trim(),
    youtubeReplayUrl: (env.NEXT_PUBLIC_LIVE_YOUTUBE_REPLAY_URL ?? "").trim(),
  };
}

/**
 * Asset slots — empty means the section stays hidden.
 * Fill via env or edit these defaults before launch; never show placeholders.
 */
export type LiveAssets = {
  hostHeadshotUrl: string;
  hostVideoUrl: string;
  hostVideoCaption: string;
  /** John's personal note (paid page). Empty = hide section; P.S. still shows. */
  personalNoteHtml: string;
  /** Confirmed host line about evenings/Saturdays. Empty = omit that sentence. */
  hostEveningsConfirmed: boolean;
  /** Tool names for the paid "what you need" / FAQ. Empty = hide tool-specific lines. */
  toolList: readonly string[];
  /** Demo idea shown in free webinar copy. Empty = generic "one real idea". */
  demoIdeaSlug: string;
  /** Three idea slugs for free-now cards. Empty = hide the card row. */
  freeNowIdeaSlugs: readonly string[];
  /** Dry-run passed → stronger "live URL" deal line. */
  dryRunPassed: boolean;
  /** Attendee proof quotes. Empty = hide proof sections. */
  freeProofQuotes: readonly { quote: string; name: string }[];
  paidProofQuotes: readonly { quote: string; name: string; url?: string }[];
};

export const LIVE_ASSETS: LiveAssets = {
  hostHeadshotUrl: "",
  hostVideoUrl: "",
  hostVideoCaption: "A minute from John on what we'll cover.",
  personalNoteHtml: "",
  hostEveningsConfirmed: false,
  toolList: [],
  demoIdeaSlug: "",
  freeNowIdeaSlugs: [],
  dryRunPassed: false,
  freeProofQuotes: [],
  paidProofQuotes: [],
};

/**
 * Manual seat sold count when Convex live count isn't wired.
 * `null` = no live count → copy reads "20 seats only."
 * Set via `LIVE_SEATS_SOLD` (integer string) or leave unset.
 */
export function seatsSoldOverride(env: NodeJS.ProcessEnv = process.env): number | null {
  const raw = (env.LIVE_SEATS_SOLD ?? "").trim();
  if (!raw) return null;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.min(SEATS_TOTAL, n);
}

/** Refund-policy workshop section ships in this PR — link is live. */
export const POLICY_SECTION_LIVE = true;

export const POLICY_ANCHOR = "/refund-policy#live-workshop-tickets";

export const UTM = {
  free: "live-w1",
  paid: "live-p1",
  hubBanner: "hub",
} as const;

export const STARTUP_IDEAS_HREF = `/startup-ideas?utm_campaign=${UTM.free}`;
export const STARTUP_IDEAS_PAID_HREF = `/startup-ideas?utm_campaign=${UTM.paid}`;
