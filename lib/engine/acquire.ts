/**
 * Source acquisition for one research run (WP54, evidence contract §3).
 *
 * A run keeps one acquirer, so a URL cited by the market, competitor and
 * community packs and by a later supplement search is fetched once. At most
 * `concurrency` reads are in flight; the rest wait in order, and a slot frees
 * when its read settles either way. `read` never rejects: every outcome is a
 * typed `SourceRead`, and failures carry a short, redacted `detail`.
 *
 * The provider settles every read within its own deadline (see
 * `sourceText.ts`); the acquirer adds no second timer, because releasing a
 * slot while its fetch is still running would break the concurrency bound.
 * One exception sits below the provider: a DNS lookup cannot be cancelled,
 * so a read that timed out on a stalled resolver frees its slot while the
 * lookup may still occupy a libuv thread (see `assertPublicUrl`).
 */

import { createHash } from "node:crypto";

import type { SourceStatus } from "./evidence/contract.ts";
import {
  redactText,
  SOURCE_LIMITS,
  SourceFetchError,
  type SourceFetchErrorCode,
  type SourceTextProvider,
} from "./providers/sourceText.ts";

export type SourceRead =
  | { url: string; status: "read"; text: string; retrievedAt: string; textSha256: string }
  | { url: string; status: Exclude<SourceStatus, "read">; detail: string };

export type SourceAcquirerOptions = {
  sourceText: SourceTextProvider;
  /** Reads in flight at once (default `SOURCE_LIMITS.concurrency`). */
  concurrency?: number;
  /**
   * Dedupe key (default `new URL(url).href`). A URL whose key cannot be
   * computed settles as "unreadable" without a fetch.
   */
  keyOf?: (url: string) => string;
  /** Clock for `retrievedAt`. */
  now?: () => Date;
};

export type SourceAcquirer = {
  /**
   * The read for this URL's key. The first call fetches; concurrent and later
   * calls with the same key share that result (its `url` is the first URL
   * requested). Never rejects.
   */
  read(url: string): Promise<SourceRead>;
  /** `read` for each distinct URL, keyed by the URL as given. */
  readMany(urls: string[]): Promise<Map<string, SourceRead>>;
  /**
   * One entry per distinct key, in first-attempt order. Reads still in
   * flight are not listed yet; await them first.
   */
  snapshot(): SourceRead[];
};

const STATUS_BY_CODE: Record<SourceFetchErrorCode, Exclude<SourceStatus, "read">> = {
  oversized: "oversized",
  timeout: "timeout",
  no_content: "no_content",
  blocked_address: "blocked",
  http_status: "http_error",
  unsupported_encoding: "unsupported_encoding",
  redirect_rejected: "redirect_rejected",
  too_many_redirects: "redirect_rejected",
  network: "unreadable",
  invalid_url: "unreadable",
};

const DETAIL_MAX_CHARS = 160;

function defaultKeyOf(url: string): string {
  return new URL(url).href;
}

function sha256Hex(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

/** An error's message, even for a thrown value that cannot be stringified. */
function messageOf(error: unknown): string {
  try {
    return error instanceof Error ? error.message : String(error);
  } catch {
    return "unexpected error";
  }
}

function failedRead(url: string, error: unknown): SourceRead {
  const status =
    error instanceof SourceFetchError ? (STATUS_BY_CODE[error.code] ?? "unreadable") : "unreadable";
  return { url, status, detail: redactText(messageOf(error), DETAIL_MAX_CHARS) || status };
}

/**
 * Runs at most `limit` tasks at once, first come first served. A finished
 * task hands its slot straight to the next waiter, so the count of running
 * tasks never exceeds `limit`.
 */
function createLimiter(limit: number): <T>(task: () => Promise<T>) => Promise<T> {
  let running = 0;
  const waiting: Array<() => void> = [];
  const release = () => {
    const next = waiting.shift();
    if (next) next();
    else running -= 1;
  };
  return async <T>(task: () => Promise<T>): Promise<T> => {
    if (running < limit) running += 1;
    else await new Promise<void>((resolve) => waiting.push(resolve));
    try {
      return await task();
    } finally {
      release();
    }
  };
}

export function createSourceAcquirer(options: SourceAcquirerOptions): SourceAcquirer {
  const concurrency = options.concurrency ?? SOURCE_LIMITS.concurrency;
  if (!Number.isSafeInteger(concurrency) || concurrency < 1) {
    throw new RangeError(`concurrency must be a positive integer, got ${concurrency}`);
  }
  const { sourceText } = options;
  const keyOf = options.keyOf ?? defaultKeyOf;
  const now = options.now ?? (() => new Date());
  const limit = createLimiter(concurrency);
  // Insertion order is first-attempt order.
  const reads = new Map<string, Promise<SourceRead>>();
  const settled = new Map<string, SourceRead>();

  const fetchOnce = async (url: string): Promise<SourceRead> => {
    try {
      const text = await limit(() => sourceText.fetchText(url));
      if (text.trim() === "") {
        return { url, status: "no_content", detail: "the page has no readable text" };
      }
      return {
        url,
        status: "read",
        text,
        retrievedAt: now().toISOString(),
        textSha256: sha256Hex(text),
      };
    } catch (error) {
      return failedRead(url, error);
    }
  };

  const keyFor = (url: string): { key: string; valid: boolean } => {
    try {
      return { key: keyOf(url), valid: true };
    } catch {
      // Namespaced, so an invalid string never collides with a real key.
      return { key: `invalid\u0000${url}`, valid: false };
    }
  };

  const read = (url: string): Promise<SourceRead> => {
    const { key, valid } = keyFor(url);
    const existing = reads.get(key);
    if (existing) return existing;
    const attempt: Promise<SourceRead> = valid
      ? fetchOnce(url)
      : Promise.resolve({ url, status: "unreadable", detail: "invalid URL" });
    const pending = attempt
      // fetchOnce already maps every failure; this keeps `read` total even if
      // that mapping throws on a hostile error value.
      .catch((): SourceRead => ({ url, status: "unreadable", detail: "unexpected error" }))
      .then((result) => {
        settled.set(key, result);
        return result;
      });
    reads.set(key, pending);
    return pending;
  };

  return {
    read,
    async readMany(urls) {
      const distinct = [...new Set(urls)];
      return new Map(await Promise.all(distinct.map(async (url) => [url, await read(url)] as const)));
    },
    snapshot() {
      const out: SourceRead[] = [];
      for (const key of reads.keys()) {
        const result = settled.get(key);
        if (result) out.push(result);
      }
      return out;
    },
  };
}
