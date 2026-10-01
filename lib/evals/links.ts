/**
 * WP41-S6. Link liveness for every ## Sources link.
 *
 * Reuses fetchSource (and its cache), so a link checked here is not fetched
 * again by Layer 2 that week. No LLM, no key; it does need the network.
 *
 *   alive    page served (HTML, text, or a non-text file like a PDF)
 *   dead     404 / 410, or a network or DNS failure that repeats on retry
 *   blocked  401 / 403 / 429: a bot wall, not proof the page is gone
 *   error    anything else (5xx, odd 4xx): unknown, retried next week
 *
 * Only dead links count against a page. Blocked links are reported so a
 * person can check them by hand.
 */

import type { JsonCache } from "./cache.ts";
import { fetchSource, type SourceDoc } from "./fetch-source.ts";
import type { Fetcher } from "./providers/openrouter.ts";

export type LinkStatus = "alive" | "dead" | "blocked" | "error";
export type LinkResult = { url: string; status: LinkStatus; httpStatus?: number; detail?: string };

export type LinkCheckOptions = {
  fetchImpl?: Fetcher;
  cache?: JsonCache;
  timeoutMs: number;
  maxBytes: number;
  maxTextChars: number;
  concurrency: number;
  perHost: number;
};

export function classify(doc: SourceDoc): LinkStatus {
  if (doc.status === "ok" || doc.status === "unreadable") return "alive";
  if (doc.status === "network_error") return "dead";
  const s = doc.httpStatus ?? 0;
  if (s === 404 || s === 410) return "dead";
  if (s === 401 || s === 403 || s === 429) return "blocked";
  return "error";
}

const hostOf = (url: string) => {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
};

/** Check each URL once, politely: a global limit and a per-host limit. */
export async function checkLinks(urls: string[], options: LinkCheckOptions): Promise<Map<string, LinkResult>> {
  const queue = [...new Set(urls)];
  const results = new Map<string, LinkResult>();
  const busy = new Map<string, number>();
  const fetchOnce = (url: string) =>
    fetchSource(url, {
      fetchImpl: options.fetchImpl,
      cache: options.cache,
      timeoutMs: options.timeoutMs,
      maxBytes: options.maxBytes,
      maxTextChars: options.maxTextChars,
    });

  const take = (): string | undefined => {
    const i = queue.findIndex((u) => (busy.get(hostOf(u)) ?? 0) < options.perHost);
    return i === -1 ? undefined : queue.splice(i, 1)[0];
  };

  const worker = async () => {
    while (queue.length > 0) {
      const url = take();
      if (!url) {
        // Every remaining URL's host is at its limit: wait for a slot.
        await new Promise((r) => setTimeout(r, 25));
        continue;
      }
      const host = hostOf(url);
      busy.set(host, (busy.get(host) ?? 0) + 1);
      try {
        let doc = await fetchOnce(url);
        // One retry for a network failure: a single blip is not a dead link.
        if (doc.status === "network_error") doc = await fetchOnce(url);
        results.set(url, {
          url,
          status: classify(doc),
          ...(doc.httpStatus ? { httpStatus: doc.httpStatus } : {}),
          ...(doc.detail ? { detail: doc.detail } : {}),
        });
      } finally {
        busy.set(host, (busy.get(host) ?? 1) - 1);
      }
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, options.concurrency) }, worker));
  return results;
}

export type PageLinks = { checked: number; dead: LinkResult[]; blocked: LinkResult[]; errors: number };

export function pageLinkSummary(urls: string[], results: Map<string, LinkResult>): PageLinks {
  const mine = [...new Set(urls)].map((u) => results.get(u)).filter((r): r is LinkResult => r !== undefined);
  return {
    checked: mine.length,
    dead: mine.filter((r) => r.status === "dead"),
    blocked: mine.filter((r) => r.status === "blocked"),
    errors: mine.filter((r) => r.status === "error").length,
  };
}

/** warn sources.dead when any cited link is dead; the message lists them. */
export function linkFindings(summary: PageLinks, options: { deadShareWarn: number }) {
  if (summary.dead.length === 0) return [];
  const share = summary.dead.length / Math.max(1, summary.checked);
  const list = summary.dead
    .slice(0, 4)
    .map((d) => `${d.url} (${d.httpStatus ?? "unreachable"})`)
    .join(", ");
  return [
    {
      check: "sources.dead",
      message:
        `${summary.dead.length} of ${summary.checked} source links are dead` +
        (share >= options.deadShareWarn ? `, ${Math.round(share * 100)}% of the page's sources` : "") +
        `: ${list}`,
    },
  ];
}
