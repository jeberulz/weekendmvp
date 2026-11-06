/**
 * WP77-S3. Wren chat: pure rules shared by the chat mutations, the gateway's
 * stream writer and the chat panel. No Convex, no provider, no env, no clock
 * read (callers pass `now`).
 *
 * Routing (`02` §5.2, D11): every turn runs the `fast` (Haiku) Wren prompt
 * unless `isPlanChangingTurn` says the founder asked to change the plan. Then
 * it runs the `draft` (Sonnet) plan-turn prompt, if the business has an
 * escalation left today (`WREN_ESCALATIONS_PER_BUSINESS_PER_DAY`). The model
 * comes from each spec's tier through the router; nothing here names one.
 *
 * The rule (deterministic, tested in `tests/platform/workspace-wren.test.ts`):
 * after lower-casing and folding whitespace, a turn is plan-changing when it
 * contains (a) a change verb from `PLAN_CHANGE_VERBS` and (b) a plan noun from
 * `PLAN_NOUNS`, each as a whole word, or (c) one of `PLAN_CHANGE_PHRASES`.
 * Questions without a change verb ("what is on Saturday?") stay on Haiku.
 * The founder can always trigger it by asking to change the plan; the daily
 * cap bounds what that costs, and past the cap the turn runs on Haiku.
 */

// ---------------------------------------------------------------------------
// Limits
// ---------------------------------------------------------------------------

/** The longest founder message Wren accepts, in characters. */
export const WREN_MESSAGE_MAX_CHARS = 4_000;

/** Messages sent to the model as history before the founder's message. */
export const WREN_HISTORY_MESSAGES = 12;

/** Each history message is cut to this many characters before it is quoted. */
export const WREN_HISTORY_MESSAGE_MAX_CHARS = 1_500;

/** Messages the thread query returns (newest, oldest first). */
export const WREN_THREAD_PAGE = 50;

/**
 * Sonnet plan turns per business per UTC day. Provisional, like the meter's
 * caps: about 1/8 of a Free founder's 40 messages.
 */
export const WREN_ESCALATIONS_PER_BUSINESS_PER_DAY = 5;

/**
 * The most `ai_usage` rows the escalation count reads for one business-day.
 * A day past it counts as capped (the turn runs on Haiku), never as free.
 */
export const WREN_ESCALATION_SCAN_MAX = 1_000;

/** Attempt numbers one founder message may use (first try, re-asks, retries). */
export const WREN_MAX_ATTEMPTS_PER_MESSAGE = 6;

/**
 * A `streaming` reply older than this is stuck (its action ran out): a new
 * send or retry marks it failed. One Convex action runs at most 10 minutes;
 * the extra two cover a late start.
 */
export const WREN_STREAM_STALE_MS = 12 * 60 * 1_000;

/** The least time between two draft writes of one reply (`02` §16: ~250 ms). */
export const WREN_STREAM_INTERVAL_MS = 250;

/** Draft writes one reply may make before the final write. */
export const WREN_STREAM_MAX_WRITES = 120;

// ---------------------------------------------------------------------------
// Routing
// ---------------------------------------------------------------------------

export type WrenRoute = "fast" | "plan";

export const PLAN_CHANGE_VERBS = [
  "change", "move", "reschedule", "swap", "skip", "drop", "remove", "add", "cut", "push", "delay",
  "postpone", "replace", "rework", "redo", "switch", "rename", "pivot", "reorder", "reprioritize",
  "reprioritise", "prioritize", "prioritise", "cancel", "shift", "rearrange", "rethink", "replan",
] as const;

export const PLAN_NOUNS = [
  "plan", "schedule", "weekend", "launch", "timeline", "task", "tasks", "step", "steps", "deadline",
  "thursday", "friday", "saturday", "sunday", "monday", "tonight", "tomorrow", "team", "crew", "hire",
  "role", "goal", "audience", "pricing", "price", "name", "brand", "landing", "page", "site", "email",
  "emails", "sequence", "post", "posts", "ads", "offer", "idea", "positioning", "order",
] as const;

export const PLAN_CHANGE_PHRASES = [
  "instead of", "rather than", "new plan", "different plan", "start over", "change of plan",
] as const;

function normalised(text: string): string {
  return text.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();
}

/** True when the founder's message asks to change the plan (see the file header). */
export function isPlanChangingTurn(text: string): boolean {
  const flat = normalised(text);
  if (flat.length === 0) return false;
  const words = new Set(flat.split(" "));
  if (PLAN_CHANGE_PHRASES.some((phrase) => ` ${flat} `.includes(` ${phrase} `))) return true;
  return PLAN_CHANGE_VERBS.some((verb) => words.has(verb)) && PLAN_NOUNS.some((noun) => words.has(noun));
}

export type WrenRouteDecision = {
  readonly route: WrenRoute;
  /** True when the rule asked for a plan turn but today's escalations are used up. */
  readonly escalationCapped: boolean;
};

/** The route for a turn, given how many plan turns the business has used today. */
export function decideWrenRoute(text: string, escalationsToday: number | "unknown"): WrenRouteDecision {
  if (!isPlanChangingTurn(text)) return { route: "fast", escalationCapped: false };
  const capped = escalationsToday === "unknown" || escalationsToday >= WREN_ESCALATIONS_PER_BUSINESS_PER_DAY;
  return capped ? { route: "fast", escalationCapped: true } : { route: "plan", escalationCapped: false };
}

/** Midnight UTC of the day `now` falls in: the escalation and limiter day. */
export function utcDayStart(now: number): number {
  const day = new Date(now);
  return Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate());
}

// ---------------------------------------------------------------------------
// Founder text
// ---------------------------------------------------------------------------

/** The message as sent, trimmed; null when it is empty or too long. */
export function normaliseFounderMessage(text: string): string | null {
  const trimmed = text.trim();
  if (trimmed.length === 0 || trimmed.length > WREN_MESSAGE_MAX_CHARS) return null;
  return trimmed;
}

/** One history line for the prompt: `founder: ...` or `wren: ...`, cut to the history limit. */
export function historyLine(author: "founder" | "wren", body: string): string {
  const text = body.length > WREN_HISTORY_MESSAGE_MAX_CHARS
    ? `${body.slice(0, WREN_HISTORY_MESSAGE_MAX_CHARS)}…`
    : body;
  return `${author}: ${text}`;
}

// ---------------------------------------------------------------------------
// Streamed reply text
// ---------------------------------------------------------------------------

const REPLY_OPENING = /^\s*\{\s*"reply"\s*:\s*"/u;

const SIMPLE_ESCAPES: Readonly<Record<string, string>> = {
  '"': '"', "\\": "\\", "/": "/", b: "\b", f: "\f", n: "\n", r: "\r", t: "\t",
};

/**
 * The `reply` string decoded from a partial structured reply
 * (`{"reply":"...`), as far as it has arrived. Stops before an escape that
 * is not complete yet, and at the closing quote. Anything else (another
 * shape, a reply not yet started) gives "". Display only: the final text is
 * the schema-checked output, never this.
 */
export function partialReplyText(raw: string): string {
  const opening = REPLY_OPENING.exec(raw);
  if (opening === null) return "";
  let out = "";
  let i = opening[0].length;
  while (i < raw.length) {
    const ch = raw[i];
    if (ch === '"') break;
    if (ch !== "\\") {
      out += ch;
      i += 1;
      continue;
    }
    const next = raw[i + 1];
    if (next === undefined) break;
    if (next === "u") {
      const hex = raw.slice(i + 2, i + 6);
      if (!/^[0-9a-fA-F]{4}$/u.test(hex)) break;
      out += String.fromCharCode(Number.parseInt(hex, 16));
      i += 6;
      continue;
    }
    const simple = SIMPLE_ESCAPES[next];
    if (simple === undefined) break;
    out += simple;
    i += 2;
  }
  return out;
}

export type ReplyDraftWriterOptions = {
  /** Writes the reply so far (the whole text, not a delta). */
  readonly write: (body: string) => Promise<unknown>;
  readonly now: () => number;
  /** The longest draft written; the final reply is checked by the schema. */
  readonly maxChars: number;
  readonly minIntervalMs?: number;
  readonly maxWrites?: number;
};

export type ReplyDraftWriter = {
  /** One streamed text delta of attempt `attempt` (a re-ask starts over). */
  push(attempt: number, delta: string): void;
  /** Waits for the write in flight. Call before the final write. */
  drain(): Promise<void>;
  /** Draft writes started so far. */
  writes(): number;
};

/**
 * Bounded, throttled draft writes for one streaming reply. Each write carries
 * the whole reply so far (so a late or repeated write cannot garble it), at
 * most one write is in flight, writes are at least `minIntervalMs` apart, and
 * there are at most `maxWrites`. A delta that arrives too soon is not lost:
 * the next write, or the final write, carries it. A new attempt (the re-ask)
 * clears the draft. A failed draft write is ignored; the final write is the
 * record.
 */
export function createReplyDraftWriter(options: ReplyDraftWriterOptions): ReplyDraftWriter {
  const minInterval = options.minIntervalMs ?? WREN_STREAM_INTERVAL_MS;
  const maxWrites = options.maxWrites ?? WREN_STREAM_MAX_WRITES;
  let attempt: number | null = null;
  let raw = "";
  let written = "";
  let lastWriteAt = Number.NEGATIVE_INFINITY;
  let count = 0;
  let inFlight: Promise<void> | null = null;

  const start = (body: string) => {
    count += 1;
    written = body;
    lastWriteAt = options.now();
    inFlight = options.write(body).then(
      () => undefined,
      () => undefined,
    ).finally(() => {
      inFlight = null;
    });
  };

  return {
    push(nextAttempt, delta) {
      if (attempt !== nextAttempt) {
        attempt = nextAttempt;
        raw = "";
      }
      raw += delta;
      const body = partialReplyText(raw).slice(0, options.maxChars);
      if (body === written || inFlight !== null || count >= maxWrites) return;
      if (options.now() - lastWriteAt < minInterval) return;
      start(body);
    },
    async drain() {
      while (inFlight !== null) await inFlight;
    },
    writes: () => count,
  };
}

// ---------------------------------------------------------------------------
// Copy
// ---------------------------------------------------------------------------

/**
 * The calm card shown instead of a reply when the plan's Wren messages are
 * used up. The C-LIMITS window is a rolling day, not midnight-aligned, so the
 * copy never says "tomorrow"; the panel adds the real reset from the
 * limiter's `retryAfter` (`resetsInLabel`).
 */
export const WREN_TOMORROW_CARD = {
  title: "Wren needs a break",
  body: "You've used the messages your plan includes for now. Your plan, cards and crew keep working, and approvals still go through.",
} as const;

/** What the failed reply says, by cause. Honest: it never claims Wren did anything. */
export const WREN_FAILURE_COPY = {
  paused: "Wren is paused right now, so this message wasn't answered. Try again later.",
  budget: "Wren has used today's AI budget for your account, so this message wasn't answered. Try again tomorrow.",
  refusal: "Wren can't help with that request.",
  invalid: "Wren's reply came back unreadable, so it isn't shown. You can try again.",
  failed: "Wren couldn't finish this reply. You can try again.",
  stale: "Wren didn't finish this reply in time. You can try again.",
} as const;

export type WrenFailureCause = keyof typeof WREN_FAILURE_COPY;

/** Hours and minutes until `resetAt`, for the tomorrow card ("in about 3 hours"). */
export function resetsInLabel(now: number, resetAt: number): string {
  const minutes = Math.max(1, Math.ceil((resetAt - now) / 60_000));
  if (minutes < 60) return `in about ${minutes} minute${minutes === 1 ? "" : "s"}`;
  const hours = Math.round(minutes / 60);
  return `in about ${hours} hour${hours === 1 ? "" : "s"}`;
}
