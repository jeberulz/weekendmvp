/**
 * Fetch the readable text of a cited page so the pipeline can check claims
 * against it. Not a billed provider: no API key, no cost record.
 *
 * - Reddit threads → the official OAuth API (app-only token) when
 *   REDDIT_CLIENT_ID / REDDIT_CLIENT_SECRET are set, else the public `.json`
 *   listing. Reddit answers the public endpoint with 403 from most cloud
 *   networks, so set the credentials anywhere but a home connection.
 * - Hacker News items → the Algolia items API (story + comment tree).
 * - Anything else → the HTML with scripts/styles/tags stripped.
 *
 * Citation URLs come from search results, so every byte, hop and second a
 * source can cost is bounded, and every failure is typed:
 *
 * - Addresses: the original URL and every redirect target must resolve only
 *   to public addresses (`assertPublicUrl`), and the default transport
 *   re-checks the address the socket connects to (`publicOnlyLookup`), plus
 *   IP-literal hosts, which Node connects to without calling `lookup`.
 *   Loopback, private, link-local and metadata-service targets are refused.
 * - Size and time (`SOURCE_LIMITS`): body bytes are counted as they stream and
 *   the request is destroyed at the cap; one deadline per `fetchText` call
 *   covers the DNS checks, the socket lookup, every redirect hop and the body.
 * - Compression: requests ask for `identity`, and any other Content-Encoding
 *   fails as `unsupported_encoding`. Nothing is decompressed, so a small
 *   compressed body can never expand past the cap. (node:http never decodes
 *   on its own; this is a decision, not a default.)
 * - Redirects: only GET/HEAD follow them. Authorization, Cookie and
 *   Proxy-Authorization are dropped when a hop changes origin, and an
 *   authenticated HTTPS→HTTP hop is refused. URL userinfo is never sent.
 * - Failures reject with `SourceFetchError`. Messages never carry header
 *   values; URLs in them lose userinfo and non-identifying query values.
 */

import { lookup as dnsLookup } from "node:dns";
import { lookup } from "node:dns/promises";
import http from "node:http";
import https from "node:https";
import type { LookupFunction } from "node:net";
import { isIP } from "node:net";

export type SourceTextProvider = {
  fetchText(url: string): Promise<string>;
};

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export type CreateSourceTextOptions = {
  fetchImpl?: FetchLike;
  /** Deadline for one whole `fetchText` call (default `SOURCE_LIMITS.deadlineMs`). */
  timeoutMs?: number;
  userAgent?: string;
  /** Reddit app credentials (script or web app, app-only OAuth). */
  redditClientId?: string;
  redditClientSecret?: string;
  /** Resolve a hostname to its IP addresses (defaults to DNS). */
  resolveHost?: (hostname: string) => Promise<string[]>;
};

// ---------------------------------------------------------------------------
// Limits and typed failures
// ---------------------------------------------------------------------------

export type SourceLimits = {
  /** Response body bytes accepted off the socket, per response. */
  readonly maxWireBytes: number;
  /** Body bytes handed to the text decoder, per read. */
  readonly maxDecodedBytes: number;
  /** One deadline per `fetchText` call. */
  readonly deadlineMs: number;
  /** Redirects followed per request. */
  readonly maxRedirects: number;
  /** Source reads in flight per research run (the acquirer's semaphore). */
  readonly concurrency: number;
};

/**
 * Finite bounds on what one cited URL can consume. No environment override:
 * changing a bound is a reviewed code change.
 */
export const SOURCE_LIMITS: SourceLimits = Object.freeze({
  // A pricing page, article or forum thread is far smaller; 2 MiB still holds
  // a long Hacker News comment tree from the Algolia API.
  maxWireBytes: 2 * 1024 * 1024,
  // Equal to the wire cap because only identity encoding is accepted, so no
  // decoder runs. Kept separate so adding one cannot lift the memory bound;
  // it also caps an injected fetch implementation that decompresses.
  maxDecodedBytes: 2 * 1024 * 1024,
  // DNS checks, socket lookup, every redirect hop and the body share one
  // allowance, so neither a redirect chain nor a slow body extends a read.
  deadlineMs: 15_000,
  // Unchanged from the first reader; real citations take one or two hops.
  maxRedirects: 5,
  // With 2 MiB per read, at most 8 MiB of bodies are in memory at once, and
  // a run stays polite to the sites it cites.
  concurrency: 4,
});

/**
 * Why a source read failed. `network` covers connection and protocol
 * failures and unusable responses (reset, parse error, malformed JSON).
 */
export type SourceFetchErrorCode =
  | "oversized"
  | "timeout"
  | "no_content"
  | "http_status"
  | "blocked_address"
  | "redirect_rejected"
  | "too_many_redirects"
  | "unsupported_encoding"
  | "network"
  | "invalid_url";

export class SourceFetchError extends Error {
  readonly code: SourceFetchErrorCode;
  /** HTTP status when the failure came with one. */
  readonly status?: number;

  constructor(code: SourceFetchErrorCode, message: string, status?: number) {
    super(message);
    this.name = "SourceFetchError";
    this.code = code;
    this.status = status;
  }
}

/** Statuses whose responses never carry a body (Node handles 1xx itself). */
const NULL_BODY_STATUSES: ReadonlySet<number> = new Set([204, 205, 304]);

const REDIRECT_STATUSES: ReadonlySet<number> = new Set([301, 302, 303, 307, 308]);

/** Request headers that carry credentials; dropped when a redirect changes origin. */
const CREDENTIAL_HEADERS = ["authorization", "cookie", "proxy-authorization"] as const;

const DEFAULT_UA =
  "weekendmvp-idea-engine/1.0 (quote verification; +https://www.weekendmvp.app)";

// ---------------------------------------------------------------------------
// Redaction (every URL or free text that reaches an error message)
// ---------------------------------------------------------------------------

/** Query keys whose numeric value identifies a page (HN `item?id=`, forum `?t=`). */
const IDENTITY_QUERY_KEYS: ReadonlySet<string> = new Set([
  "id",
  "t",
  "p",
  "f",
  "topic",
  "thread",
  "story",
  "item",
  "page",
]);

/**
 * A path segment name whose next segment is a credential (`/token/<value>`),
 * compared lowercased with `-` and `_` removed.
 */
const SECRET_SEGMENT_NAME =
  /^(?:(?:access|refresh|id|auth)?tokens?|apikeys?|keys?|secrets?|clientsecret|passwords?|passwd|pwd|auth|authorization|bearer|jwt|sig|signatures?|hmac|otp|sessions?|sessionid|sid|jsessionid|phpsessid|credentials?)$/;

/** Base64 or base64url runs long enough to be a credential (24+ characters). */
const LONG_TOKEN_RUN = /[A-Za-z0-9+/_-]{24,}/g;

/**
 * True when a long run reads as words: at least three `-`/`_`-separated
 * parts, two thirds of them all letters or all digits, and no mixed part
 * longer than 16 characters. A slug ("best-saas-tools-for-2024") or a slug
 * with a short id ("why-we-rewrote-billing-1a2b3c4d5e6f") passes; a random
 * token rarely has several separators between whole words.
 */
function isWordyRun(run: string): boolean {
  const parts = run.split(/[-_]+/).filter((part) => part !== "");
  if (parts.length < 3) return false;
  let wordy = 0;
  for (const part of parts) {
    if (/^(?:[A-Za-z]+|\d+)$/.test(part)) wordy += 1;
    else if (part.length > 16) return false;
  }
  return wordy * 3 >= parts.length * 2;
}

function decodeSegment(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment; // malformed escapes: judge the raw text
  }
}

function looksLikeCredential(segment: string): boolean {
  for (const run of decodeSegment(segment).match(LONG_TOKEN_RUN) ?? []) {
    if (!isWordyRun(run)) return true;
  }
  return false;
}

function isSecretSegmentName(segment: string): boolean {
  return SECRET_SEGMENT_NAME.test(decodeSegment(segment).toLowerCase().replace(/[-_]/g, ""));
}

/** One path segment for a diagnostic: kept as is, cut back to its name, or "…". */
function redactSegment(segment: string, afterSecretName: boolean): string {
  if (segment === "") return segment;
  if (afterSecretName) return "…";
  // Matrix parameters (`a;jsessionid=…`) and `name=value` segments keep the name.
  const cut = segment.search(/[;=]/);
  if (cut !== -1) {
    const name = segment.slice(0, cut);
    return `${looksLikeCredential(name) ? "…" : name}${segment[cut]}…`;
  }
  return looksLikeCredential(segment) ? "…" : segment;
}

function redactPath(pathname: string): string {
  let afterSecretName = false;
  return pathname
    .split("/")
    .map((segment) => {
      const out = redactSegment(segment, afterSecretName);
      afterSecretName = isSecretSegmentName(segment);
      return out;
    })
    .join("/");
}

/**
 * A URL safe for diagnostics: no userinfo or fragment, only numeric
 * page-identifying query values kept (anything else becomes "…"), and path
 * segments that look like credentials replaced by "…": long random tokens,
 * whatever follows a credential-like segment name (`/token/<value>`), and the
 * values of matrix or `name=value` segments. Slugs and numeric ids stay
 * readable. Non-http(s) URLs show only their scheme, which also keeps local
 * file paths out.
 */
export function redactUrl(url: string): string {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return "[invalid URL]";
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return `${parsed.protocol}[redacted]`;
  }
  const kept: string[] = [];
  let dropped = false;
  for (const [key, value] of parsed.searchParams) {
    if (IDENTITY_QUERY_KEYS.has(key.toLowerCase()) && /^\d{1,20}$/.test(value)) {
      kept.push(`${encodeURIComponent(key)}=${value}`);
    } else {
      dropped = true;
    }
  }
  if (dropped) kept.push("…");
  const query = kept.length > 0 ? `?${kept.join("&")}` : "";
  return `${parsed.protocol}//${parsed.host}${redactPath(parsed.pathname)}${query}`;
}

function isAsciiLetter(c: string): boolean {
  return (c >= "a" && c <= "z") || (c >= "A" && c <= "Z");
}

function isSchemeChar(c: string): boolean {
  return isAsciiLetter(c) || (c >= "0" && c <= "9") || c === "+" || c === "." || c === "-";
}

function isWordChar(c: string): boolean {
  return isAsciiLetter(c) || (c >= "0" && c <= "9") || c === "_";
}

const URL_BODY_STOP = /[\s"'<>]/;

/**
 * `text.replace(/\b[a-z][a-z0-9+.-]*:\/\/[^\s"'<>]+/gi, redactUrl)` in linear
 * time. The regex rescans a scheme-like run (`a.a.a.…`) from every word
 * boundary inside it, which is quadratic: 64k characters took 1.8 s. Here
 * each "://" is found once; its match starts at the leftmost letter at a word
 * boundary in the scheme-character run before it (as the regex's would), and
 * that run cannot reach back past the previous "://", so every character is
 * scanned a bounded number of times.
 */
function redactUrlsInText(text: string): string {
  let out = "";
  let from = 0; // end of the last match: the regex's lastIndex
  let search = 0;
  for (;;) {
    const sep = text.indexOf("://", search);
    if (sep === -1) break;
    search = sep + 1;
    let end = sep + 3;
    if (end >= text.length || URL_BODY_STOP.test(text.charAt(end))) continue;
    let runStart = sep;
    while (runStart > from && isSchemeChar(text.charAt(runStart - 1))) runStart -= 1;
    let start = -1;
    for (let p = runStart; p < sep; p += 1) {
      if (isAsciiLetter(text.charAt(p)) && (p === 0 || !isWordChar(text.charAt(p - 1)))) {
        start = p;
        break;
      }
    }
    if (start === -1) continue;
    while (end < text.length && !URL_BODY_STOP.test(text.charAt(end))) end += 1;
    out += text.slice(from, start) + redactUrl(text.slice(start, end));
    from = end;
    search = end;
  }
  return out + text.slice(from);
}

// Both run in linear time: a fixed keyword or prefix, then one greedy class.
const CREDENTIAL_IN_TEXT = /\b(bearer|basic)\s+[^\s,;"']+/gi;
const LOCAL_PATH_IN_TEXT =
  /(^|[\s("'=])(?:\/(?:Users|home|private|tmp|var|opt|root)\/|[A-Za-z]:\\)[^\s"'<>)]*/g;

/**
 * Free text safe for diagnostics: URLs redacted, auth values and local paths
 * masked, collapsed to one line and capped at `maxChars`. Linear in the
 * length of `text`.
 */
export function redactText(text: string, maxChars = 200): string {
  const clean = redactUrlsInText(text)
    .replace(CREDENTIAL_IN_TEXT, "$1 [redacted]")
    .replace(LOCAL_PATH_IN_TEXT, "$1[path]")
    .replace(/\s+/g, " ")
    .trim();
  return clean.length <= maxChars ? clean : `${clean.slice(0, maxChars - 1)}…`;
}

function errorCode(error: unknown): string | undefined {
  return typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof error.code === "string"
    ? error.code
    : undefined;
}

/** A short, redacted description of an unexpected error. */
function errorLabel(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  const code = errorCode(error);
  const text = code && !message.includes(code) ? `${code} ${message}` : message;
  return redactText(text, 120);
}

/** Keep typed failures; anything else becomes a redacted `network` failure. */
function asSourceFetchError(error: unknown, label: string): SourceFetchError {
  if (error instanceof SourceFetchError) return error;
  return new SourceFetchError("network", `Could not read ${label}: ${errorLabel(error)}`);
}

function oversizedError(label: string, maxBytes: number): SourceFetchError {
  return new SourceFetchError("oversized", `Response from ${label} exceeds ${maxBytes} bytes`);
}

// ---------------------------------------------------------------------------
// Page text extraction
// ---------------------------------------------------------------------------

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

/**
 * `html.replace(/<tag[\s\S]*?<\/tag>/gi, " ")` in linear time. The regex
 * rescans to the end of the input from every unclosed opening tag, which is
 * quadratic on a hostile page (and no deadline can interrupt a regex).
 * Once one opening tag has no closing tag after it, none later can either.
 */
function stripElement(html: string, tag: "script" | "style"): string {
  const open = new RegExp(`<${tag}`, "gi");
  const close = new RegExp(`</${tag}>`, "gi");
  let out = "";
  let from = 0;
  for (;;) {
    open.lastIndex = from;
    const start = open.exec(html);
    if (!start) break;
    close.lastIndex = start.index + tag.length + 1;
    const end = close.exec(html);
    if (!end) break;
    out += `${html.slice(from, start.index)} `;
    from = end.index + end[0].length;
  }
  return out + html.slice(from);
}

/**
 * `text.replace(/<[^>]+>/g, " ")` in linear time: a tag runs from "<" to the
 * first ">" after it with at least one character between. With no ">" left,
 * no later "<" can match either.
 */
function stripTags(text: string): string {
  let out = "";
  let from = 0;
  let scan = 0;
  for (;;) {
    const lt = text.indexOf("<", scan);
    if (lt === -1) break;
    const gt = text.indexOf(">", lt + 1);
    if (gt === -1) break;
    if (gt === lt + 1) {
      scan = gt;
      continue;
    }
    out += `${text.slice(from, lt)} `;
    from = gt + 1;
    scan = gt + 1;
  }
  return out + text.slice(from);
}

export function htmlToText(html: string): string {
  const withoutCode = stripElement(stripElement(html, "script"), "style");
  // Keep block boundaries, so separate pricing cards or table rows stay on
  // separate lines for per-competitor price checks.
  const withBreaks = withoutCode
    .replace(/<\/(?:tr|li|p|div)\s*>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n");
  return stripTags(withBreaks)
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

// ---------------------------------------------------------------------------
// Address safety
// ---------------------------------------------------------------------------

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

/** Expand an IPv6 address (any notation) to its eight 16-bit groups. */
function ipv6Groups(ip: string): number[] | null {
  let text = ip.toLowerCase().replace(/%.*$/, "");
  // A trailing dotted IPv4 part becomes two hex groups.
  const dotted = text.match(/^(.*:)(\d+\.\d+\.\d+\.\d+)$/);
  if (dotted) {
    const [a, b, c, d] = dotted[2]!.split(".").map(Number) as [number, number, number, number];
    text = `${dotted[1]}${((a << 8) | b).toString(16)}:${((c << 8) | d).toString(16)}`;
  }
  const halves = text.split("::");
  if (halves.length > 2) return null;
  const head = halves[0] ? halves[0].split(":") : [];
  const tail = halves.length === 2 && halves[1] ? halves[1].split(":") : [];
  const fill = halves.length === 2 ? 8 - head.length - tail.length : 0;
  const parts = [...head, ...Array<string>(Math.max(fill, 0)).fill("0"), ...tail];
  if (parts.length !== 8) return null;
  const groups = parts.map((g) => parseInt(g, 16));
  return groups.every((g) => Number.isInteger(g) && g >= 0 && g <= 0xffff) ? groups : null;
}

/** True for loopback, private, link-local, metadata and other non-public IPs. */
export function isBlockedAddress(ip: string): boolean {
  const version = isIP(ip);
  if (version === 4) return ipv4Blocked(ip);
  if (version !== 6) return true;
  const g = ipv6Groups(ip);
  if (!g) return true;
  // ipv6Groups returns exactly eight groups, so these defaults never apply.
  const [first = 0, second = 0, third = 0] = g;
  /** Groups `hi` and `hi + 1` as a dotted IPv4 address. */
  const ipv4At = (hi: number): string => {
    const [high = 0, low = 0] = g.slice(hi, hi + 2);
    return `${high >> 8}.${high & 0xff}.${low >> 8}.${low & 0xff}`;
  };
  const zeroTo = (n: number) => g.slice(0, n).every((x) => x === 0);
  // ::a.b.c.d (IPv4-compatible, also covers :: and ::1) and ::ffff:a.b.c.d (mapped),
  // in dotted or hex form.
  if (zeroTo(6) || (zeroTo(5) && g[5] === 0xffff)) {
    return zeroTo(7) ? true : ipv4Blocked(ipv4At(6));
  }
  // ::ffff:0:a.b.c.d (IPv4-translated, SIIT ::ffff:0:0/96).
  if (zeroTo(4) && g[4] === 0xffff && g[5] === 0) return ipv4Blocked(ipv4At(6));
  // 64:ff9b::/96 NAT64 carries an IPv4 address in its last 32 bits.
  if (first === 0x64 && second === 0xff9b && g.slice(2, 6).every((x) => x === 0)) {
    return ipv4Blocked(ipv4At(6));
  }
  // 2002::/16 6to4 carries an IPv4 address in bits 16–47.
  if (first === 0x2002) return ipv4Blocked(ipv4At(1));
  return (
    (first === 0x64 && second === 0xff9b && third === 1) || // local-use NAT64 64:ff9b:1::/48
    (first & 0xfe00) === 0xfc00 || // unique local fc00::/7
    (first & 0xffc0) === 0xfe80 || // link-local fe80::/10
    (first & 0xffc0) === 0xfec0 || // deprecated site-local fec0::/10
    (first & 0xff00) === 0xff00 // multicast
  );
}

async function defaultResolveHost(hostname: string): Promise<string[]> {
  const found = await lookup(hostname, { all: true, verbatim: true });
  return found.map((a) => a.address);
}

/** `[::1]` → `::1`; other hostnames unchanged. */
function bareHost(hostname: string): string {
  return hostname.replace(/^\[|\]$/g, "").toLowerCase();
}

/** Parse a source URL, accepting only http(s). */
function parseSourceUrl(url: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new SourceFetchError("invalid_url", "Invalid source URL");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new SourceFetchError("invalid_url", `Refusing non-http source URL: ${redactUrl(url)}`);
  }
  return parsed;
}

/**
 * Throw unless the URL is http(s) and its host resolves only to public IPs.
 * With `signal`, the resolution is raced against it: dns.lookup cannot be
 * cancelled, so a stalled resolver must not hold the read past its deadline.
 */
export async function assertPublicUrl(
  url: string,
  resolveHost: (hostname: string) => Promise<string[]> = defaultResolveHost,
  signal?: AbortSignal,
): Promise<void> {
  const host = bareHost(parseSourceUrl(url).hostname);
  if (host === "localhost" || host.endsWith(".localhost")) {
    throw new SourceFetchError("blocked_address", `Refusing non-public source URL: ${redactUrl(url)}`);
  }
  let addresses: string[];
  if (isIP(host)) {
    addresses = [host];
  } else {
    try {
      const pending = resolveHost(host);
      addresses = signal ? await untilAborted(pending, signal) : await pending;
    } catch (error) {
      if (error instanceof SourceFetchError) throw error;
      throw new SourceFetchError("network", `Could not resolve ${host}: ${errorLabel(error)}`);
    }
  }
  if (addresses.length === 0 || addresses.some(isBlockedAddress)) {
    throw new SourceFetchError("blocked_address", `Refusing non-public source URL: ${redactUrl(url)}`);
  }
}

/**
 * DNS lookup for the socket itself: refuses the connection when any resolved
 * address is non-public. Because the check runs at connect time, a host that
 * re-resolves to a private address after `assertPublicUrl` is still refused.
 */
const publicOnlyLookup: LookupFunction = (hostname, options, callback) => {
  dnsLookup(hostname, { ...options, all: true }, (err, addresses) => {
    if (err) return callback(err, "", 0);
    const list = addresses as { address: string; family: number }[];
    if (list.length === 0 || list.some((a) => isBlockedAddress(a.address))) {
      return callback(
        Object.assign(new Error(`Refusing non-public address for ${hostname}`), {
          code: "ENONPUBLIC",
        }),
        "",
        0,
      );
    }
    if (options.all) return callback(null, list as never);
    callback(null, list[0]!.address, list[0]!.family);
  });
};

// ---------------------------------------------------------------------------
// Deadlines
// ---------------------------------------------------------------------------

type Deadline = { signal: AbortSignal; clear: () => void };

/**
 * One timer per operation, deliberately ref'd: a read stalled on a lookup
 * that holds no handle must still time out instead of letting the process
 * exit with the promise pending. `clear` releases it once the read settles.
 */
function startDeadline(ms: number): Deadline {
  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort(new SourceFetchError("timeout", `Source read exceeded the ${ms} ms deadline`));
  }, ms);
  return { signal: controller.signal, clear: () => clearTimeout(timer) };
}

function isTimeoutReason(reason: unknown): boolean {
  return (
    typeof reason === "object" &&
    reason !== null &&
    "name" in reason &&
    reason.name === "TimeoutError"
  );
}

/** The failure an aborted signal stands for. */
function abortError(signal: AbortSignal): SourceFetchError {
  const reason: unknown = signal.reason;
  if (reason instanceof SourceFetchError) return reason;
  if (isTimeoutReason(reason)) return new SourceFetchError("timeout", "Source read timed out");
  return new SourceFetchError("network", "Source read was cancelled");
}

/**
 * `promise`, or a rejection as soon as `signal` aborts. Work that cannot be
 * cancelled (dns.lookup, a shared token request) is raced, never awaited past
 * the deadline; its late outcome is still observed, so it cannot surface as
 * an unhandled rejection.
 */
function untilAborted<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(abortError(signal));
    if (signal.aborted) onAbort();
    else signal.addEventListener("abort", onAbort, { once: true });
    promise.then(
      (value) => {
        signal.removeEventListener("abort", onAbort);
        resolve(value);
      },
      (error: unknown) => {
        signal.removeEventListener("abort", onAbort);
        reject(error);
      },
    );
  });
}

function positiveInteger(value: number | undefined, fallback: number, name: string): number {
  if (value === undefined) return fallback;
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new RangeError(`${name} must be a positive integer, got ${value}`);
  }
  return value;
}

// ---------------------------------------------------------------------------
// Transport: node:http(s) with public-only sockets and a streamed byte cap
// ---------------------------------------------------------------------------

export type PublicOnlyFetchOptions = {
  /**
   * Socket DNS lookup. Defaults to `publicOnlyLookup`. Only tests inject
   * another one (mapping a fake public hostname to a local server); no
   * production caller passes it.
   */
  lookup?: LookupFunction;
  limits?: Partial<Pick<SourceLimits, "maxWireBytes">>;
};

type TransportConfig = { lookup: LookupFunction; maxWireBytes: number };

/** Content codings other than identity, sanitized for messages. */
function contentCodings(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((coding) => coding.trim().toLowerCase())
    .filter((coding) => coding !== "" && coding !== "identity")
    .map((coding) => coding.replace(/[^a-z0-9._+-]/g, "?").slice(0, 32));
}

/** A valid Content-Length, else null (the streamed byte count still applies). */
function declaredLength(value: string | null | undefined): number | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return /^\d+$/.test(trimmed) ? Number(trimmed) : null;
}

function fetchHeaders(raw: http.IncomingHttpHeaders): Headers {
  const headers = new Headers();
  for (const [name, value] of Object.entries(raw)) {
    if (typeof value === "string") headers.append(name, value);
    else if (Array.isArray(value)) for (const item of value) headers.append(name, item);
  }
  return headers;
}

function outgoingHeaders(init: HeadersInit | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  new Headers(init).forEach((value, name) => {
    out[name] = value;
  });
  // Compressed bodies are never decoded here (see the module comment).
  out["accept-encoding"] = "identity";
  return out;
}

function requestBody(body: RequestInit["body"]): string | undefined {
  if (body === undefined || body === null) return undefined;
  if (typeof body === "string") return body;
  throw new SourceFetchError("network", "Only string request bodies are supported");
}

function transportTarget(input: string): URL {
  const target = parseSourceUrl(input);
  const host = bareHost(target.hostname);
  // Node connects to an IP-literal host without calling `lookup`, so the
  // socket-level check would never see it.
  if (isIP(host) !== 0 && isBlockedAddress(host)) {
    throw new SourceFetchError("blocked_address", `Refusing non-public source URL: ${redactUrl(input)}`);
  }
  return target;
}

function transportError(error: unknown, label: string): SourceFetchError {
  if (error instanceof SourceFetchError) return error;
  if (errorCode(error) === "ENONPUBLIC") {
    return new SourceFetchError("blocked_address", `Refusing non-public address for ${label}`);
  }
  return new SourceFetchError("network", `Network error for ${label}: ${errorLabel(error)}`);
}

/**
 * One HTTP exchange. It settles exactly once: every path (body end, size cap,
 * bad status or encoding, response error or premature close, request or
 * socket error, abort) funnels through `succeed` or `fail`, which detach the
 * listeners and drop buffered chunks. `fail` destroys request and response;
 * the request keeps a no-op error listener for life, because a destroyed
 * socket can still emit an error and an unheard one crashes the process.
 */
function transportFetch(
  input: string,
  init: RequestInit,
  config: TransportConfig,
): Promise<Response> {
  return new Promise<Response>((resolve, reject) => {
    const label = redactUrl(input);
    const signal = init.signal ?? undefined;
    let target: URL;
    let method: string;
    let headers: Record<string, string>;
    let body: string | undefined;
    try {
      target = transportTarget(input);
      method = (init.method ?? "GET").toUpperCase();
      headers = outgoingHeaders(init.headers);
      body = requestBody(init.body);
    } catch (error) {
      reject(transportError(error, label));
      return;
    }
    if (signal?.aborted) {
      reject(abortError(signal));
      return;
    }

    let settled = false;
    let request: http.ClientRequest | undefined;
    let response: http.IncomingMessage | undefined;
    let status = 0;
    let responseHeaders = new Headers();
    let chunks: Buffer[] = [];
    let received = 0;

    function finish(): boolean {
      if (settled) return false;
      settled = true;
      signal?.removeEventListener("abort", onAbort);
      response
        ?.off("data", onData)
        .off("end", onEnd)
        .off("close", onPrematureClose)
        .off("error", onFailure);
      chunks = [];
      return true;
    }

    function succeed(result: Response): void {
      if (finish()) resolve(result);
    }

    function fail(error: SourceFetchError): void {
      if (!finish()) return;
      response?.destroy();
      request?.destroy();
      reject(error);
    }

    function onAbort(): void {
      if (signal) fail(abortError(signal));
    }

    function onFailure(error: unknown): void {
      fail(transportError(error, label));
    }

    function onPrematureClose(): void {
      fail(new SourceFetchError("network", `Connection closed before the response from ${label} was complete`));
    }

    function onData(chunk: Buffer): void {
      if (settled) return;
      // Checked before retaining, so even one huge chunk is never kept.
      if (received + chunk.length > config.maxWireBytes) {
        fail(oversizedError(label, config.maxWireBytes));
        return;
      }
      received += chunk.length;
      chunks.push(chunk);
    }

    function onEnd(): void {
      if (settled) return;
      try {
        succeed(new Response(Buffer.concat(chunks, received), { status, headers: responseHeaders }));
      } catch (error) {
        fail(new SourceFetchError("network", `Unusable response from ${label}: ${errorLabel(error)}`, status));
      }
    }

    function onResponse(incoming: http.IncomingMessage): void {
      response = incoming;
      incoming.on("error", onFailure);
      if (settled) {
        incoming.destroy();
        return;
      }
      status = incoming.statusCode ?? 0;
      // Response() accepts only 200–599; a hostile server can send any
      // three-digit status.
      if (status < 200 || status > 599) {
        fail(new SourceFetchError("http_status", `Unsupported HTTP status ${status} from ${label}`, status));
        return;
      }
      const codings = contentCodings(incoming.headers["content-encoding"]);
      if (codings.length > 0) {
        fail(
          new SourceFetchError(
            "unsupported_encoding",
            `Unsupported content-encoding "${codings.join(", ")}" from ${label}`,
            status,
          ),
        );
        return;
      }
      try {
        responseHeaders = fetchHeaders(incoming.headers);
      } catch (error) {
        fail(new SourceFetchError("network", `Malformed response headers from ${label}: ${errorLabel(error)}`, status));
        return;
      }
      if (method === "HEAD" || NULL_BODY_STATUSES.has(status)) {
        // Never a body here, whatever the server sends, so do not read one.
        try {
          succeed(new Response(null, { status, headers: responseHeaders }));
        } catch (error) {
          fail(new SourceFetchError("network", `Unusable response from ${label}: ${errorLabel(error)}`, status));
          return;
        }
        incoming.destroy();
        return;
      }
      const declared = declaredLength(incoming.headers["content-length"]);
      if (declared !== null && declared > config.maxWireBytes) {
        fail(oversizedError(label, config.maxWireBytes));
        return;
      }
      incoming.on("data", onData);
      incoming.on("end", onEnd);
      incoming.on("close", onPrematureClose);
    }

    signal?.addEventListener("abort", onAbort, { once: true });
    try {
      const options: https.RequestOptions = {
        protocol: target.protocol,
        hostname: bareHost(target.hostname),
        port: target.port === "" ? undefined : Number(target.port),
        path: `${target.pathname}${target.search}`,
        method,
        headers,
        lookup: config.lookup,
        // A fresh connection per request: no pooled socket outlives the read
        // or skips the lookup check.
        agent: false,
      };
      request =
        target.protocol === "https:"
          ? https.request(options, onResponse)
          : http.request(options, onResponse);
    } catch (error) {
      fail(transportError(error, label));
      return;
    }
    request.on("error", onFailure);
    request.end(body);
  });
}

/**
 * A fetch over node:http(s) that only connects to public addresses, streams
 * at most `maxWireBytes` of body, refuses compressed bodies and never follows
 * redirects itself (`sendWithRedirects` checks each hop).
 */
export function createPublicOnlyFetch(options: PublicOnlyFetchOptions = {}): FetchLike {
  const config: TransportConfig = {
    lookup: options.lookup ?? publicOnlyLookup,
    maxWireBytes: positiveInteger(
      options.limits?.maxWireBytes,
      SOURCE_LIMITS.maxWireBytes,
      "maxWireBytes",
    ),
  };
  return (input, init = {}) => transportFetch(input, init, config);
}

export const publicOnlyFetch: FetchLike = createPublicOnlyFetch();

// ---------------------------------------------------------------------------
// Redirects and credentials
// ---------------------------------------------------------------------------

export type SendOptions = {
  fetchImpl: FetchLike;
  resolveHost: (hostname: string) => Promise<string[]>;
  /** The operation deadline shared by every hop. */
  signal: AbortSignal;
  maxRedirects?: number;
};

/** Free an unread body (an in-memory buffer here; a socket for other fetches). */
function discardBody(response: Response): void {
  if (response.body && !response.bodyUsed) {
    // Cancelling a body nobody will read can only fail if it is already gone.
    response.body.cancel().catch(() => undefined);
  }
}

function withoutUserinfo(url: string): string {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return url; // assertPublicUrl reports it
  }
  if (parsed.username === "" && parsed.password === "") return url;
  parsed.username = "";
  parsed.password = "";
  return parsed.href;
}

function redirectTarget(location: string, from: URL): URL {
  let next: URL;
  try {
    next = new URL(location, from);
  } catch {
    throw new SourceFetchError("redirect_rejected", `Invalid redirect location from ${redactUrl(from.href)}`);
  }
  if (next.protocol !== "http:" && next.protocol !== "https:") {
    throw new SourceFetchError(
      "redirect_rejected",
      `Refusing a redirect to a non-http URL from ${redactUrl(from.href)}`,
    );
  }
  next.username = "";
  next.password = "";
  return next;
}

function headerRecord(headers: Headers): Record<string, string> {
  const out: Record<string, string> = {};
  headers.forEach((value, name) => {
    out[name] = value;
  });
  return out;
}

/**
 * Send a request and follow its redirects. Every hop's host must be public.
 * Only GET and HEAD follow redirects. Credential headers are dropped for good
 * once a hop changes origin, and a request that started with credentials is
 * refused an HTTPS→HTTP hop outright. URL userinfo is never sent.
 */
export async function sendWithRedirects(
  url: string,
  init: RequestInit,
  options: SendOptions,
): Promise<Response> {
  const { signal } = options;
  const maxRedirects = options.maxRedirects ?? SOURCE_LIMITS.maxRedirects;
  const method = (init.method ?? "GET").toUpperCase();
  const headers = new Headers(init.headers);
  headers.set("accept-encoding", "identity");
  const authenticated = CREDENTIAL_HEADERS.some((name) => headers.has(name));
  let current = withoutUserinfo(url);
  for (let redirects = 0; ; redirects += 1) {
    await assertPublicUrl(current, options.resolveHost, signal);
    const response = await untilAborted(
      options.fetchImpl(current, {
        method,
        headers: headerRecord(headers),
        body: init.body,
        signal,
        redirect: "manual",
      }),
      signal,
    );
    const location = response.headers.get("location");
    if (!REDIRECT_STATUSES.has(response.status) || location === null) return response;
    discardBody(response);
    if (method !== "GET" && method !== "HEAD") {
      throw new SourceFetchError(
        "redirect_rejected",
        `Refusing to follow a redirect for ${method} ${redactUrl(current)}`,
        response.status,
      );
    }
    if (redirects >= maxRedirects) {
      throw new SourceFetchError(
        "too_many_redirects",
        `Too many redirects for ${redactUrl(url)}`,
        response.status,
      );
    }
    const from = new URL(current);
    const next = redirectTarget(location, from);
    if (authenticated && from.protocol === "https:" && next.protocol === "http:") {
      throw new SourceFetchError(
        "redirect_rejected",
        `Refusing an authenticated HTTPS-to-HTTP redirect from ${redactUrl(current)}`,
        response.status,
      );
    }
    if (next.origin !== from.origin) {
      for (const name of CREDENTIAL_HEADERS) headers.delete(name);
    }
    current = next.href;
  }
}

// ---------------------------------------------------------------------------
// Bounded body reads
// ---------------------------------------------------------------------------

/** Throw unless `response` is a 2xx that may carry a body. */
function assertReadable(response: Response, describe: string): void {
  if (NULL_BODY_STATUSES.has(response.status)) {
    discardBody(response);
    throw new SourceFetchError(
      "no_content",
      `HTTP ${response.status} (no content) for ${describe}`,
      response.status,
    );
  }
  if (!response.ok) {
    discardBody(response);
    throw new SourceFetchError("http_status", `HTTP ${response.status} for ${describe}`, response.status);
  }
}

/**
 * Read at most `maxBytes` of body. The real transport already capped the
 * wire bytes; this cap also holds for an injected fetch that streams or
 * decompresses.
 */
async function readBounded(
  response: Response,
  describe: string,
  maxBytes: number,
  signal: AbortSignal,
): Promise<Uint8Array> {
  const declared = declaredLength(response.headers.get("content-length"));
  if (declared !== null && declared > maxBytes) {
    discardBody(response);
    throw oversizedError(describe, maxBytes);
  }
  if (!response.body) return new Uint8Array(0);
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const next = await untilAborted(reader.read(), signal);
      if (next.done) break;
      if (total + next.value.byteLength > maxBytes) throw oversizedError(describe, maxBytes);
      total += next.value.byteLength;
      chunks.push(next.value);
    }
  } catch (error) {
    // The read already failed; cancelling only releases the stream.
    reader.cancel().catch(() => undefined);
    throw error;
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return out;
}

async function readText(response: Response, describe: string, signal: AbortSignal): Promise<string> {
  assertReadable(response, describe);
  const bytes = await readBounded(response, describe, SOURCE_LIMITS.maxDecodedBytes, signal);
  if (bytes.byteLength === 0) {
    throw new SourceFetchError("no_content", `Empty response body for ${describe}`, response.status);
  }
  return new TextDecoder().decode(bytes);
}

async function readJson(response: Response, describe: string, signal: AbortSignal): Promise<unknown> {
  const text = await readText(response, describe, signal);
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new SourceFetchError("network", `Malformed JSON from ${describe}`, response.status);
  }
}

function collectText(json: unknown, keys: string[]): string {
  const parts: string[] = [];
  collectStrings(json, new Set(keys), parts);
  return parts.join("\n");
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

const REDDIT_BLOCKED_HINT =
  " (Reddit blocks this network; set REDDIT_CLIENT_ID and REDDIT_CLIENT_SECRET)";

export function createSourceTextProvider(
  options: CreateSourceTextOptions = {},
): SourceTextProvider {
  const fetchImpl: FetchLike = options.fetchImpl ?? publicOnlyFetch;
  const deadlineMs = positiveInteger(options.timeoutMs, SOURCE_LIMITS.deadlineMs, "timeoutMs");
  // An empty value (e.g. copied from .env.example) means "unset".
  const userAgent =
    options.userAgent?.trim() ||
    process.env.ENGINE_QUOTE_FETCH_UA?.trim() ||
    DEFAULT_UA;
  const redditId = options.redditClientId ?? process.env.REDDIT_CLIENT_ID;
  const redditSecret =
    options.redditClientSecret ?? process.env.REDDIT_CLIENT_SECRET;
  const resolveHost = options.resolveHost ?? defaultResolveHost;
  let redditToken: Promise<string> | null = null;

  const send = (url: string, init: RequestInit, signal: AbortSignal): Promise<Response> =>
    sendWithRedirects(url, init, { fetchImpl, resolveHost, signal });

  const requestRedditToken = async (signal: AbortSignal): Promise<string> => {
    const basic = Buffer.from(`${redditId}:${redditSecret}`).toString("base64");
    const res = await send(
      "https://www.reddit.com/api/v1/access_token",
      {
        method: "POST",
        headers: {
          authorization: `Basic ${basic}`,
          "content-type": "application/x-www-form-urlencoded",
          "user-agent": userAgent,
        },
        body: "grant_type=client_credentials",
      },
      signal,
    );
    const json = await readJson(res, "the Reddit OAuth token request", signal);
    const token =
      typeof json === "object" && json !== null && "access_token" in json
        ? json.access_token
        : undefined;
    if (typeof token !== "string") {
      throw new SourceFetchError("network", "Reddit OAuth token response had no access_token");
    }
    return token;
  };

  /**
   * One token per provider. The request runs under the deadline of the read
   * that started it; a read that joins it waits only within its own deadline.
   */
  const redditBearer = (signal: AbortSignal): Promise<string> => {
    if (!redditToken) {
      const pending = requestRedditToken(signal);
      redditToken = pending;
      // A failed token request should be retried by the next fetch.
      pending.catch(() => {
        if (redditToken === pending) redditToken = null;
      });
    }
    return untilAborted(redditToken, signal);
  };

  const readSource = async (url: string, signal: AbortSignal): Promise<string> => {
    const threadPath = redditThreadPath(url);
    if (threadPath && redditId && redditSecret) {
      const token = await redditBearer(signal);
      const res = await send(
        `https://oauth.reddit.com${threadPath}?limit=500&raw_json=1`,
        { headers: { authorization: `bearer ${token}`, "user-agent": userAgent } },
        signal,
      );
      return collectText(
        await readJson(res, `Reddit API ${threadPath}`, signal),
        ["title", "selftext", "body"],
      );
    }
    const reddit = redditJsonUrl(url);
    if (reddit) {
      const res = await send(
        reddit,
        { headers: { "user-agent": userAgent, accept: "application/json" } },
        signal,
      );
      if (res.status === 403) {
        discardBody(res);
        throw new SourceFetchError(
          "http_status",
          `HTTP 403 for ${redactUrl(reddit)}${REDDIT_BLOCKED_HINT}`,
          403,
        );
      }
      return collectText(await readJson(res, redactUrl(reddit), signal), [
        "title",
        "selftext",
        "body",
      ]);
    }
    const accept = { "user-agent": userAgent, accept: "application/json,text/html" };
    const hn = hnApiUrl(url);
    if (hn) {
      const res = await send(hn, { headers: accept }, signal);
      return htmlToText(collectText(await readJson(res, redactUrl(hn), signal), ["title", "text"]));
    }
    const res = await send(url, { headers: accept }, signal);
    return htmlToText(await readText(res, redactUrl(url), signal));
  };

  return {
    /**
     * The page text, or a `SourceFetchError`. One deadline covers the whole
     * call; the returned promise always settles by then.
     */
    async fetchText(url: string): Promise<string> {
      const deadline = startDeadline(deadlineMs);
      try {
        return await untilAborted(readSource(url, deadline.signal), deadline.signal);
      } catch (error) {
        throw asSourceFetchError(error, redactUrl(url));
      } finally {
        deadline.clear();
      }
    },
  };
}
