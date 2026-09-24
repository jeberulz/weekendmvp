/**
 * Fetch the readable text of a cited page so the pipeline can check that a
 * community quote really appears there. Not a billed provider: no API key,
 * no cost record.
 *
 * - Reddit threads → the official OAuth API (app-only token) when
 *   REDDIT_CLIENT_ID / REDDIT_CLIENT_SECRET are set, else the public `.json`
 *   listing. Reddit answers the public endpoint with 403 from most cloud
 *   networks, so set the credentials anywhere but a home connection.
 * - Hacker News items → the Algolia items API (story + comment tree).
 * - Anything else → the HTML with scripts/styles/tags stripped. Citation
 *   URLs come from search results, so every hop (the first request and each
 *   redirect) must resolve to a public address: loopback, private, link-local
 *   and metadata-service targets are refused.
 */

import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

export type SourceTextProvider = {
  fetchText(url: string): Promise<string>;
};

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export type CreateSourceTextOptions = {
  fetchImpl?: FetchLike;
  timeoutMs?: number;
  userAgent?: string;
  /** Reddit app credentials (script or web app, app-only OAuth). */
  redditClientId?: string;
  redditClientSecret?: string;
  /** Resolve a hostname to its IP addresses (defaults to DNS). */
  resolveHost?: (hostname: string) => Promise<string[]>;
};

const MAX_REDIRECTS = 5;

const DEFAULT_UA =
  "weekendmvp-idea-engine/1.0 (quote verification; +https://www.weekendmvp.app)";

/** Collect every string under the given keys in a nested JSON value. */
function collectStrings(value: unknown, keys: Set<string>, out: string[]): void {
  if (Array.isArray(value)) {
    for (const v of value) collectStrings(v, keys, out);
    return;
  }
  if (typeof value !== "object" || value === null) return;
  for (const [k, v] of Object.entries(value)) {
    if (typeof v === "string" && keys.has(k)) out.push(v);
    else if (typeof v === "object") collectStrings(v, keys, out);
  }
}

/** The character for a numeric entity, or the raw entity when out of range. */
function codePointOr(n: number, raw: string): string {
  return Number.isInteger(n) && n >= 0 && n <= 0x10ffff ? String.fromCodePoint(n) : raw;
}

export function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    // Numeric entities (HN's Algolia text encodes "/" as &#x2F;, "'" as &#x27;).
    .replace(/&#x([0-9a-f]+);/gi, (m: string, h: string) => codePointOr(parseInt(h, 16), m))
    .replace(/&#(\d+);/g, (m: string, d: string) => codePointOr(Number(d), m))
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    // Last, so "&amp;lt;" becomes "&lt;" text rather than "<".
    .replace(/&amp;/g, "&");
}

/** Rewrite a Reddit thread URL to its JSON listing, or null. */
export function redditJsonUrl(url: string): string | null {
  try {
    const u = new URL(url);
    if (!/(^|\.)reddit\.com$/.test(u.hostname)) return null;
    if (!/\/comments\//.test(u.pathname)) return null;
    const pathname = u.pathname.replace(/\/+$/, "");
    return `https://www.reddit.com${pathname}.json?limit=500&raw_json=1`;
  } catch {
    return null;
  }
}

/** Reddit thread path (`/r/x/comments/id/slug`) for the OAuth host, or null. */
export function redditThreadPath(url: string): string | null {
  try {
    const u = new URL(url);
    if (!/(^|\.)reddit\.com$/.test(u.hostname)) return null;
    if (!/\/comments\//.test(u.pathname)) return null;
    return u.pathname.replace(/\/+$/, "");
  } catch {
    return null;
  }
}

/** Rewrite a Hacker News item URL to the Algolia items API, or null. */
export function hnApiUrl(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname !== "news.ycombinator.com") return null;
    const id = u.searchParams.get("id");
    if (!id || !/^\d+$/.test(id)) return null;
    return `https://hn.algolia.com/api/v1/items/${id}`;
  } catch {
    return null;
  }
}

function ipv4Blocked(ip: string): boolean {
  const [a = 0, b = 0, c = 0] = ip.split(".").map(Number);
  return (
    a === 0 || // "this" network
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) || // carrier-grade NAT
    (a === 169 && b === 254) || // link-local, cloud metadata
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 192 && b === 0 && c === 0) ||
    (a === 198 && (b === 18 || b === 19)) || // benchmarking
    a >= 224 // multicast and reserved
  );
}

/** True for loopback, private, link-local, metadata and other non-public IPs. */
export function isBlockedAddress(ip: string): boolean {
  const version = isIP(ip);
  if (version === 4) return ipv4Blocked(ip);
  if (version !== 6) return true;
  const v6 = ip.toLowerCase();
  const mapped = v6.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return ipv4Blocked(mapped[1]!);
  return (
    v6 === "::" ||
    v6 === "::1" ||
    /^f[cd]/.test(v6) || // unique local fc00::/7
    /^fe[89ab]/.test(v6) || // link-local fe80::/10
    /^ff/.test(v6) // multicast
  );
}

async function defaultResolveHost(hostname: string): Promise<string[]> {
  const found = await lookup(hostname, { all: true, verbatim: true });
  return found.map((a) => a.address);
}

/** Throw unless the URL is http(s) and its host resolves only to public IPs. */
export async function assertPublicUrl(
  url: string,
  resolveHost: (hostname: string) => Promise<string[]> = defaultResolveHost,
): Promise<void> {
  const u = new URL(url);
  if (u.protocol !== "http:" && u.protocol !== "https:") {
    throw new Error(`Refusing non-http source URL: ${url}`);
  }
  const host = u.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (host === "localhost" || host.endsWith(".localhost")) {
    throw new Error(`Refusing non-public source URL: ${url}`);
  }
  const addresses = isIP(host) ? [host] : await resolveHost(host);
  if (addresses.length === 0 || addresses.some(isBlockedAddress)) {
    throw new Error(`Refusing non-public source URL: ${url}`);
  }
}

export function createSourceTextProvider(
  options: CreateSourceTextOptions = {},
): SourceTextProvider {
  const fetchImpl: FetchLike = options.fetchImpl ?? ((i, init) => fetch(i, init));
  const timeoutMs = options.timeoutMs ?? 15_000;
  // An empty value (e.g. copied from .env.example) means "unset".
  const userAgent =
    options.userAgent?.trim() ||
    process.env.ENGINE_QUOTE_FETCH_UA?.trim() ||
    DEFAULT_UA;
  const redditId = options.redditClientId ?? process.env.REDDIT_CLIENT_ID;
  const redditSecret =
    options.redditClientSecret ?? process.env.REDDIT_CLIENT_SECRET;
  let redditToken: Promise<string> | null = null;

  const redditBearer = (): Promise<string> => {
    if (!redditToken) {
      redditToken = (async () => {
        const basic = Buffer.from(`${redditId}:${redditSecret}`).toString("base64");
        const res = await fetchImpl("https://www.reddit.com/api/v1/access_token", {
          method: "POST",
          headers: {
            authorization: `Basic ${basic}`,
            "content-type": "application/x-www-form-urlencoded",
            "user-agent": userAgent,
          },
          body: "grant_type=client_credentials",
          signal: AbortSignal.timeout(timeoutMs),
        });
        if (!res.ok) {
          throw new Error(`Reddit OAuth token request failed: HTTP ${res.status}`);
        }
        const json = (await res.json()) as { access_token?: unknown };
        if (typeof json.access_token !== "string") {
          throw new Error("Reddit OAuth token response had no access_token");
        }
        return json.access_token;
      })();
      // A failed token request should be retried by the next fetch.
      redditToken.catch(() => {
        redditToken = null;
      });
    }
    return redditToken;
  };

  const resolveHost = options.resolveHost ?? defaultResolveHost;

  /** GET that checks the destination of the request and of every redirect. */
  const getPublic = async (url: string): Promise<Response> => {
    let current = url;
    for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
      await assertPublicUrl(current, resolveHost);
      const res = await fetchImpl(current, {
        headers: { "user-agent": userAgent, accept: "application/json,text/html" },
        signal: AbortSignal.timeout(timeoutMs),
        redirect: "manual",
      });
      const location = res.headers.get("location");
      if (res.status >= 300 && res.status < 400 && location) {
        current = new URL(location, current).toString();
        continue;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${current}`);
      return res;
    }
    throw new Error(`Too many redirects for ${url}`);
  };

  const get = async (url: string): Promise<Response> => {
    const res = await fetchImpl(url, {
      headers: { "user-agent": userAgent, accept: "application/json,text/html" },
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    return res;
  };

  return {
    async fetchText(url: string): Promise<string> {
      const threadPath = redditThreadPath(url);
      if (threadPath && redditId && redditSecret) {
        const token = await redditBearer();
        const res = await fetchImpl(
          `https://oauth.reddit.com${threadPath}?limit=500&raw_json=1`,
          {
            headers: { authorization: `bearer ${token}`, "user-agent": userAgent },
            signal: AbortSignal.timeout(timeoutMs),
          },
        );
        if (!res.ok) throw new Error(`HTTP ${res.status} for Reddit API ${threadPath}`);
        const parts: string[] = [];
        collectStrings(await res.json(), new Set(["title", "selftext", "body"]), parts);
        return parts.join("\n");
      }
      const reddit = redditJsonUrl(url);
      if (reddit) {
        const res = await fetchImpl(reddit, {
          headers: { "user-agent": userAgent, accept: "application/json" },
          signal: AbortSignal.timeout(timeoutMs),
        });
        if (!res.ok) {
          throw new Error(
            `HTTP ${res.status} for ${reddit}${res.status === 403 ? " (Reddit blocks this network; set REDDIT_CLIENT_ID and REDDIT_CLIENT_SECRET)" : ""}`,
          );
        }
        const json: unknown = await res.json();
        const parts: string[] = [];
        collectStrings(json, new Set(["title", "selftext", "body"]), parts);
        return parts.join("\n");
      }
      const hn = hnApiUrl(url);
      if (hn) {
        const json: unknown = await (await get(hn)).json();
        const parts: string[] = [];
        collectStrings(json, new Set(["title", "text"]), parts);
        return htmlToText(parts.join("\n"));
      }
      return htmlToText(await (await getPublic(url)).text());
    },
  };
}

/**
 * Loose-but-honest comparison form: lowercase, curly quotes and dashes
 * folded, every run of non-alphanumerics collapsed to one space. Wording
 * must match; punctuation and whitespace may differ.
 */
export function normalizeForMatch(text: string): string {
  return text
    .toLowerCase()
    .replace(/[‘’‚‛]/g, "'")
    .replace(/[“”„‟]/g, '"')
    .replace(/'/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * True when the quote appears in the page text. An ellipsis in the quote
 * marks an elision, so each fragment must appear, in order.
 */
export function quoteAppearsIn(quote: string, pageText: string): boolean {
  // Pad with spaces so fragments match whole words only ("cat" ≠ "concat").
  const page = ` ${normalizeForMatch(pageText)} `;
  const fragments = quote
    .split(/\.\.\.|…/)
    .map(normalizeForMatch)
    .filter((f) => f.length > 0);
  // At least one fragment must be long enough to be a real quote.
  if (!fragments.some((f) => f.split(" ").length >= 3)) return false;
  let from = 0;
  for (const fragment of fragments) {
    const at = page.indexOf(` ${fragment} `, from);
    if (at === -1) return false;
    from = at + fragment.length + 1;
  }
  return true;
}
