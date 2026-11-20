/**
 * WP95. The rules for what the beta feedback loop stores, in one place so the
 * browser, the Convex functions and the tests agree.
 *
 * Nothing here ever holds chat text, a business name, idea text, an email or a
 * URL query. Feedback keeps the note the founder types into the feedback
 * dialog and nothing else free-form; error records keep an error class and a
 * masked route.
 */

export const FEEDBACK_NOTE_MAX = 1_000;
export const FEEDBACK_RATING_MIN = 1;
export const FEEDBACK_RATING_MAX = 5;
export const FEEDBACK_SURFACES = ["workspace", "wizard"] as const;
export type FeedbackSurface = (typeof FEEDBACK_SURFACES)[number];

/** Launch step states stored per feedback entry. */
export const STEP_STATES_MAX = 16;
export const STEP_TOKEN = /^[a-z][a-z0-9_]{0,31}$/;

export const ERROR_SOURCES = ["boundary", "action", "wren"] as const;
export type ErrorSource = (typeof ERROR_SOURCES)[number];
export const ERROR_SOURCE_LABELS: Readonly<Record<ErrorSource, string>> = {
  boundary: "Page error",
  action: "Failed action",
  wren: "Wren could not finish",
};

export const ERROR_CLASS_MAX = 64;
const ERROR_CLASS = /^[A-Za-z0-9_.:-]{1,64}$/;
const DEDUPE_KEY = /^[A-Za-z0-9_.:-]{1,64}$/;
const BUILD_VERSION = /^[A-Za-z0-9._-]{1,40}$/;

export const ROUTE_MAX = 200;
const ROUTE_CHARS = /^[A-Za-z0-9_\-./[\]]+$/;
/** A Convex document id is 32 lowercase letters and digits; anything this long and plain is an id, not a slug. */
const ID_SEGMENT = /^[a-z0-9]{20,}$/;
export const UNKNOWN_ROUTE = "/unknown";

export type StepState = { readonly key: string; readonly state: string };

export type NoteCheck = { readonly ok: true; readonly note: string } | { readonly ok: false; readonly reason: "empty" | "too_long" };

/** Trim, then check the length by code point so an emoji counts once. */
export function checkNote(raw: string): NoteCheck {
  const note = raw.trim();
  if (note.length === 0) return { ok: false, reason: "empty" };
  if (Array.from(note).length > FEEDBACK_NOTE_MAX) return { ok: false, reason: "too_long" };
  return { ok: true, note };
}

export function noteLength(raw: string): number {
  return Array.from(raw.trim()).length;
}

export function isValidRating(value: number): boolean {
  return Number.isInteger(value) && value >= FEEDBACK_RATING_MIN && value <= FEEDBACK_RATING_MAX;
}

/**
 * A route pattern from a pathname: no query or fragment, and every id-like
 * segment masked, so `/dashboard/b/abc…/email` is stored as
 * `/dashboard/b/[id]/email`. Anything that does not look like a path is
 * `/unknown`.
 */
export function sanitizeRoute(raw: string): string {
  const path = raw.split(/[?#]/, 1)[0] ?? "";
  if (!path.startsWith("/") || path.length > ROUTE_MAX || !ROUTE_CHARS.test(path)) return UNKNOWN_ROUTE;
  const masked = path
    .split("/")
    .map((segment) => (ID_SEGMENT.test(segment) ? "[id]" : segment))
    .join("/");
  return masked.length > ROUTE_MAX ? UNKNOWN_ROUTE : masked;
}

/** The class if it is a plain token, else null: a message or a path never passes. */
export function sanitizeErrorClass(raw: unknown): string | null {
  return typeof raw === "string" && ERROR_CLASS.test(raw) ? raw : null;
}

export function sanitizeDedupeKey(raw: unknown): string | null {
  return typeof raw === "string" && DEDUPE_KEY.test(raw) ? raw : null;
}

export function sanitizeBuildVersion(raw: unknown): string {
  return typeof raw === "string" && BUILD_VERSION.test(raw) ? raw : "unknown";
}

/** At most `STEP_STATES_MAX` plain `key`/`state` tokens; the rest is dropped. */
export function sanitizeStepStates(raw: readonly StepState[]): StepState[] {
  const out: StepState[] = [];
  for (const entry of raw) {
    if (out.length >= STEP_STATES_MAX) break;
    if (STEP_TOKEN.test(entry.key) && STEP_TOKEN.test(entry.state)) out.push({ key: entry.key, state: entry.state });
  }
  return out;
}

/**
 * The class of a thrown value, from its shape alone: a `ConvexError` code (or
 * the rate limiter's kind) when it has one, else the error's name. Never the
 * message, which can carry text the founder typed.
 */
export function errorClassOf(error: unknown): string {
  if (typeof error === "object" && error !== null && "data" in error) {
    const data: unknown = error.data;
    if (typeof data === "object" && data !== null) {
      if ("code" in data) {
        const code = sanitizeErrorClass(data.code);
        if (code !== null) return code;
      }
      if ("kind" in data) {
        const kind = sanitizeErrorClass(data.kind);
        if (kind !== null) return kind;
      }
    }
  }
  if (error instanceof Error) return sanitizeErrorClass(error.name) ?? "Error";
  return "Unknown";
}
