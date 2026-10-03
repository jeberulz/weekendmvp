/**
 * Citation identity and vendor/host matching (WP54, contract §5).
 *
 * Two URLs are the same source only when their canonical forms are equal.
 * Canonicalization keeps every identity-bearing part of the URL (path and
 * non-tracking query parameters such as Hacker News `item?id=`) and drops
 * only presentation and tracking noise. There is no `www.` folding.
 *
 * First-party detection compares a vendor key with the registrable label of
 * the host ("loopio" in app.loopio.com). It uses a small built-in list of
 * multi-part public suffixes, not the full Public Suffix List; an unknown
 * multi-part suffix makes the check answer "not first-party", which sends the
 * price through the stricter secondary-source rules (fail closed).
 *
 * Ruling R15: a URL whose path or query holds an opaque credential-like
 * value is refused as a citation (citationRefusal, with the redactUrl
 * detectors of providers/sourceText.ts), so a private or signed link is
 * never read, stored or published.
 */

import { isSecretSegmentName, looksLikeCredential } from "../providers/sourceText.ts";

const TRACKING_PARAM_RE = /^(?:utm_.*|fbclid|gclid|ref)$/i;

/**
 * Query parameters that carry a credential or a signature (review P3-6): a
 * URL with any of them is a signed or private link, so it is never a
 * citation and never stored. Matched case-insensitively on the decoded name:
 * an exact name below, an `x-amz-` / `x-goog-` prefix (S3 and GCS signed
 * URLs), or a name part (split on "_", "-", ".") that is a credential word.
 * CloudFront's Expires+Signature(+Key-Pair-Id) and Azure SAS `sig` are
 * covered by the exact names.
 */
const CREDENTIAL_PARAM_NAMES: ReadonlySet<string> = new Set([
  "signature", "sig", "token", "access_token", "auth", "key", "api_key", "apikey", "password", "secret",
  "passwd", "pwd", "client_secret", "refresh_token", "id_token", "auth_token", "api_token", "apitoken",
  "accesstoken", "sessionid", "session_id", "jwt", "googleaccessid", "key-pair-id", "awsaccesskeyid",
]);
const CREDENTIAL_PARAM_PREFIXES = ["x-amz-", "x-goog-"] as const;
const CREDENTIAL_NAME_PARTS: ReadonlySet<string> = new Set([
  "token", "secret", "password", "passwd", "signature", "credential", "credentials", "apikey",
]);

function isCredentialParam(name: string): boolean {
  const lower = name.trim().toLowerCase();
  if (CREDENTIAL_PARAM_NAMES.has(lower)) return true;
  if (CREDENTIAL_PARAM_PREFIXES.some((prefix) => lower.startsWith(prefix))) return true;
  return lower.split(/[_.-]+/).some((part) => CREDENTIAL_NAME_PARTS.has(part));
}

/** Two-label public suffixes the first-party check understands. */
const MULTI_PART_SUFFIXES = new Set([
  "co.uk", "org.uk", "ac.uk", "gov.uk", "me.uk", "ltd.uk", "plc.uk",
  "com.au", "net.au", "org.au", "co.nz", "org.nz", "co.jp", "ne.jp", "or.jp",
  "com.br", "com.mx", "com.ar", "co.in", "co.za", "com.sg", "com.hk", "co.kr",
  "com.tr", "com.cn", "com.tw", "co.il", "co.id", "com.my", "com.ph", "com.vn",
  "com.ng", "co.ke",
]);

/** Pages that compare vendors; first-party prices and availability are rejected there. */
const COMPARISON_PATH_RE =
  /(?:^|[/_.-])(?:vs|versus|alternatives?|compare|compared|compares|comparing|comparisons?|competitors?|best|top)(?:[/_.-]|$)/i;

function parseUrl(url: string): URL | null {
  try {
    return new URL(url.trim());
  } catch {
    // Not a URL at all: callers treat null as "not an acceptable citation".
    return null;
  }
}

function decodeKey(pair: string): string {
  const key = pair.split("=")[0] ?? "";
  try {
    return decodeURIComponent(key.replace(/\+/g, " "));
  } catch {
    // A malformed escape is kept verbatim; it simply is not a tracking key.
    return key;
  }
}

/** A JSON Web Token: base64url header "eyJ…", payload and signature. */
const JWT_RE = /^eyJ[A-Za-z0-9_-]{4,}\.[A-Za-z0-9_-]{4,}\.[A-Za-z0-9_-]*$/;

function decodeValue(value: string): string {
  try {
    return decodeURIComponent(value.replace(/\+/g, " "));
  } catch {
    // A malformed escape is judged as written.
    return value;
  }
}

/** Words or numbers joined by - _ . (a version or a name), not a random token. */
function isWordy(value: string): boolean {
  return value.split(/[-_.]+/).every((part) => /^(?:[A-Za-z]+|\d+)$/.test(part));
}

/**
 * A slug, as redactUrl's detectors read one: three or more - _ . parts, two
 * thirds of them all letters or all digits, no mixed part over 16
 * characters ("why-we-rewrote-billing-1a2b3c4d5e6f").
 */
function isSlugLike(value: string): boolean {
  const parts = value.split(/[-_.]+/).filter((part) => part !== "");
  if (parts.length < 3) return false;
  let wordy = 0;
  for (const part of parts) {
    if (/^(?:[A-Za-z]+|\d+)$/.test(part)) wordy += 1;
    else if (part.length > 16) return false;
  }
  return wordy * 3 >= parts.length * 2;
}

/**
 * An opaque secret-looking value (ruling R15): a JWT, a long random run
 * (looksLikeCredential), or 16+ characters of letters and digits mixed
 * with no spaces that are not words ("abc123def456ghi789", "4/0AbCd…").
 */
function credentialLikeValue(raw: string): boolean {
  const value = decodeValue(raw);
  if (JWT_RE.test(value) || looksLikeCredential(value)) return true;
  if (value.length < 16 || /\s/.test(value) || !/[A-Za-z]/.test(value) || !/\d/.test(value)) return false;
  return /^[A-Za-z0-9._~+/=-]+$/.test(value) && !isWordy(value) && !isSlugLike(value);
}

/** A short code after a secret path name ("/token/abc123"): letters and digits mixed, not words. */
function codeAfterSecretName(segment: string): boolean {
  const value = decodeValue(segment);
  return value.length >= 6 && /[A-Za-z]/.test(value) && /\d/.test(value) && !isWordy(value);
}

/** Ruling R15: why a path is credential-like (names only, never the value), or null. */
function pathRefusal(pathname: string): string | null {
  let previous = "";
  for (const segment of pathname.split("/")) {
    if (segment === "") continue;
    const [base = "", ...matrix] = segment.split(";");
    for (const parameter of matrix) {
      const [name = "", value = ""] = parameter.split("=");
      if (isSecretSegmentName(name) || credentialLikeValue(value)) {
        return `path parameter "${clipName(name)}" holds a credential-like value`;
      }
    }
    if (credentialLikeValue(base)) return "a path segment holds a credential-like value";
    if (previous !== "" && isSecretSegmentName(previous) && codeAfterSecretName(base)) {
      return `the path segment after "${clipName(previous)}" holds a credential-like value`;
    }
    previous = base;
  }
  return null;
}

function clipName(name: string): string {
  const decoded = decodeValue(name);
  return decoded.length > 40 ? `${decoded.slice(0, 39)}…` : decoded;
}

/**
 * Why a URL can never be a citation (ruling R15; review P3-6), or null:
 * not an http(s) URL; userinfo; a credential or signature query parameter
 * (CREDENTIAL_PARAM_NAMES); a query value or path that holds an opaque
 * credential-like value — a JWT, a long random token, a mixed letter and
 * digit code of 16+ characters, a code after a secret path name
 * ("/token/…"), a session or secret matrix parameter (";jsessionid=…"). The
 * reason names parameters, never their values. Ordinary values such as
 * `?plan=team`, `?page=2`, `item?id=4101` and slugs pass.
 */
export function citationRefusal(url: string): string | null {
  if (typeof url !== "string" || url.trim() === "") return "not an http(s) URL";
  const parsed = parseUrl(url);
  if (!parsed || (parsed.protocol !== "http:" && parsed.protocol !== "https:") || parsed.hostname === "") {
    return "not an http(s) URL";
  }
  if (parsed.username !== "" || parsed.password !== "") return "the URL carries userinfo (a credential)";
  const pairs = parsed.search
    .replace(/^\?/, "")
    .split("&")
    .filter((pair) => pair !== "");
  for (const pair of pairs) {
    const name = decodeKey(pair);
    if (isCredentialParam(name)) return `query parameter "${clipName(name)}" is a credential or signature`;
    const value = pair.includes("=") ? pair.slice(pair.indexOf("=") + 1) : "";
    if (credentialLikeValue(value)) return `query parameter "${clipName(name)}" holds a credential-like value`;
  }
  return pathRefusal(parsed.pathname);
}

/**
 * Canonical citation URL, or null: http(s) only, no userinfo, no
 * credential or signature query parameter (CREDENTIAL_PARAM_NAMES; a signed
 * link is never a citation) and no credential-like query value or path
 * (citationRefusal, ruling R15), lowercase host, default port and fragment
 * dropped, tracking parameters (utm_ prefix, fbclid, gclid, ref) removed,
 * other query parameters kept verbatim and in order, trailing slash removed
 * except for the root path.
 */
export function canonicalSourceUrl(url: string): string | null {
  if (citationRefusal(url) !== null) return null;
  const parsed = parseUrl(url);
  if (!parsed) return null;
  let path = parsed.pathname;
  while (path.length > 1 && path.endsWith("/")) path = path.slice(0, -1);
  const pairs = parsed.search
    .replace(/^\?/, "")
    .split("&")
    .filter((pair) => pair !== "");
  const query = pairs.filter((pair) => !TRACKING_PARAM_RE.test(decodeKey(pair))).join("&");
  return `${parsed.protocol}//${parsed.host.toLowerCase()}${path}${query ? `?${query}` : ""}`;
}

/**
 * For operator-only records of a REJECTED candidate whose URL has no
 * canonical form: the http(s) origin and path only (no userinfo, query or
 * fragment), or null. Never a citation: canonicalSourceUrl decides those.
 */
export function strippedSourceUrl(url: string): string | null {
  if (typeof url !== "string" || url.trim() === "") return null;
  const parsed = parseUrl(url);
  if (!parsed || (parsed.protocol !== "http:" && parsed.protocol !== "https:") || parsed.hostname === "") return null;
  return `${parsed.protocol}//${parsed.host.toLowerCase()}${parsed.pathname}`;
}

/** True when both URLs canonicalize to the same non-null citation. */
export function sameSource(a: string, b: string): boolean {
  const left = canonicalSourceUrl(a);
  return left !== null && left === canonicalSourceUrl(b);
}

function stripHq(key: string): string {
  return key.length > 4 && key.endsWith("hq") ? key.slice(0, -2) : key;
}

/**
 * Comparable vendor key: lowercase letters and digits only, with a trailing
 * TLD-like suffix (.ai/.io/.com/…), a trailing " AI" word, a corporate suffix
 * (Inc., Ltd., LLC) and a trailing "hq" removed. "RFP.ai" → "rfp",
 * "AutoRFP.ai" → "autorfp", "LoopioHQ" → "loopio", "Qodo AI" → "qodo".
 */
export function vendorKey(name: string): string {
  let n = name.normalize("NFKC").toLowerCase().trim();
  n = n.replace(/[\s,]+(?:inc|ltd|llc|gmbh|corp|co)\.?$/u, "");
  n = n.replace(/\.(?:ai|io|com|co|app|dev|so|net|org)$/u, "");
  n = n.replace(/\s+ai$/u, "");
  return stripHq(n.replace(/[^\p{L}\p{N}]+/gu, ""));
}

/** The label left of the public suffix ("loopio" for app.loopio.co.uk), or null. */
export function registrableLabel(url: string): string | null {
  const parsed = parseUrl(url);
  if (!parsed) return null;
  const host = parsed.hostname.toLowerCase().replace(/\.$/, "");
  if (/^[\d.]+$/.test(host) || host.includes(":") || host.startsWith("[")) return null;
  const labels = host.split(".").filter(Boolean);
  if (labels.length < 2) return null;
  const lastTwo = labels.slice(-2).join(".");
  const suffixLength = MULTI_PART_SUFFIXES.has(lastTwo) ? 2 : 1;
  if (labels.length <= suffixLength) return null;
  return labels[labels.length - suffixLength - 1] ?? null;
}

/**
 * True when the vendor's key equals the host's registrable label key:
 * Loopio on loopio.com, RFP.ai on rfp.ai — but not DeepRFP on rfp.ai and not
 * an app listed on apps.shopify.com.
 */
export function isFirstPartyHost(vendor: string, url: string): boolean {
  const key = vendorKey(vendor);
  if (key.length < 2) return false;
  const label = registrableLabel(url);
  if (!label) return false;
  return key === stripHq(label.replace(/[^\p{L}\p{N}]+/gu, ""));
}

const GENERIC_LISTING_TOKENS: ReadonlySet<string> = new Set([
  "page", "pages", "landing", "builder", "store", "shop", "shopify", "ecommerce", "website", "webpage",
]);

/**
 * A marketplace controls the listing path and the app controls its offer.
 * Bind an exact Shopify app slug to the claimed name, or a distinctive first
 * brand token in both the slug and a longer product name ("instant-builder"
 * and "Instant AI Page Builder"). Generic category tokens cannot establish
 * identity. Other marketplace paths remain neutral sources. Listings retain
 * secondary attribution so readers can distinguish them from vendor sites.
 */
export function isVendorMarketplaceListing(vendor: string, url: string): boolean {
  const key = vendorKey(vendor);
  const parsed = parseUrl(url);
  if (key.length < 3 || parsed?.hostname.toLowerCase() !== "apps.shopify.com") return false;
  const match = /^\/([a-z0-9]+(?:-[a-z0-9]+)*)\/?$/i.exec(parsed.pathname);
  if (!match) return false;
  if (key === match[1]?.replace(/-/g, "")) return true;
  const brand = match[1]?.split("-")[0]?.toLowerCase() ?? "";
  const firstName = /^[a-z0-9]+/iu.exec(vendor.trim())?.[0]?.toLowerCase() ?? "";
  return brand.length >= 4 && !GENERIC_LISTING_TOKENS.has(brand) && brand === firstName;
}

/** True when the URL path looks like a comparison, roundup or alternatives page. */
export function isComparisonPage(url: string): boolean {
  const parsed = parseUrl(url);
  return parsed !== null && COMPARISON_PATH_RE.test(parsed.pathname.toLowerCase());
}

/** General guides and blog posts repeat market figures without publishing the study. */
export function isSecondaryMarketPage(url: string): boolean {
  const parsed = parseUrl(url);
  return parsed !== null && (
    isComparisonPage(url) ||
    /(?:^|\/)(?:blog|blogs|guide|guides)(?:\/|$)/.test(parsed.pathname.toLowerCase())
  );
}

/** Host for display ("g2.com", "news.ycombinator.com"): no "www.", "" when unparseable. */
export function sourceHostLabel(url: string): string {
  const parsed = parseUrl(url);
  return parsed ? parsed.hostname.toLowerCase().replace(/^www\./, "") : "";
}
