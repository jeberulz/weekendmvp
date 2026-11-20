/**
 * Pain Engine — fetch with retries, timeout, and the on-disk cache.
 *
 * One source failing (timeout, 403, 429, bad JSON) throws here; the
 * orchestrator catches it per listener, so a single dead source can never
 * kill a batch. Retries use exponential backoff and respect Retry-After.
 */
import { cacheKeyFor, readCache, writeCache } from "./cache.ts";
import type { FetchOptions } from "./types.ts";

export interface FetcherConfig {
  cacheDir: string;
  /** Max attempts per request (1 = no retry). Default 3. */
  maxAttempts?: number;
  /** Per-attempt timeout in ms. Default 15_000. */
  timeoutMs?: number;
  /** Injectable fetch for tests / offline mode. Defaults to global fetch. */
  fetchImpl?: typeof fetch;
  log?: (message: string) => void;
}

const DEFAULT_TTL_SECONDS = 24 * 60 * 60;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function createFetcher(config: FetcherConfig) {
  const maxAttempts = config.maxAttempts ?? 3;
  const timeoutMs = config.timeoutMs ?? 15_000;
  const doFetch = config.fetchImpl ?? fetch;
  const log = config.log ?? (() => {});

  async function fetchText(url: string, opts: FetchOptions = {}): Promise<string> {
    const method = opts.method ?? "GET";
    const ttlSeconds = opts.ttlSeconds ?? DEFAULT_TTL_SECONDS;
    const useCache = method === "GET" && opts.cacheKey !== "";
    const key = opts.cacheKey ?? cacheKeyFor(url, opts.body);
    if (useCache) {
      const hit = readCache(config.cacheDir, key);
      if (hit) {
        log(`cache hit: ${url}`);
        return hit.body;
      }
    }

    let lastError: Error | null = null;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);
        let response: Response;
        try {
          response = await doFetch(url, {
            method,
            headers: {
              Accept: "application/json, text/plain, */*",
              "User-Agent": "WeekendMVP-PainEngine/1.0 (+https://www.weekendmvp.app)",
              ...opts.headers,
            },
            body: opts.body,
            signal: controller.signal,
          });
        } finally {
          clearTimeout(timer);
        }
        if (!response.ok) {
          const retryAfter = response.headers.get("retry-after");
          if ((response.status === 429 || response.status >= 500) && attempt < maxAttempts) {
            const waitMs = retryAfter
              ? Number(retryAfter) * 1000
              : 1000 * 2 ** (attempt - 1);
            log(`retry ${attempt}/${maxAttempts} for ${url} (HTTP ${response.status})`);
            await sleep(Math.min(waitMs, 30_000));
            continue;
          }
          throw new Error(`HTTP ${response.status} for ${url}`);
        }
        const body = await response.text();
        if (useCache) writeCache(config.cacheDir, key, url, ttlSeconds, body);
        return body;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        if (attempt < maxAttempts) {
          log(`retry ${attempt}/${maxAttempts} for ${url}: ${lastError.message}`);
          await sleep(1000 * 2 ** (attempt - 1));
        }
      }
    }
    throw lastError ?? new Error(`fetch failed for ${url}`);
  }

  async function fetchJson<T>(url: string, opts: FetchOptions = {}): Promise<T> {
    const text = await fetchText(url, opts);
    try {
      return JSON.parse(text) as T;
    } catch {
      throw new Error(`Invalid JSON from ${url}`);
    }
  }

  return { fetchText, fetchJson };
}
