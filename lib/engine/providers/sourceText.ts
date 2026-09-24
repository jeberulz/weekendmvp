/**
 * Fetch the readable text of a cited page so the pipeline can check that a
 * community quote really appears there. Not a billed provider: no API key,
 * no cost record.
 *
 * - Reddit threads → the public `.json` listing (post + every comment).
 * - Hacker News items → the Algolia items API (story + comment tree).
 * - Anything else → the HTML with scripts/styles/tags stripped.
 */

export type SourceTextProvider = {
  fetchText(url: string): Promise<string>;
};

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export type CreateSourceTextOptions = {
  fetchImpl?: FetchLike;
  timeoutMs?: number;
  userAgent?: string;
};

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

export function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ");
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

export function createSourceTextProvider(
  options: CreateSourceTextOptions = {},
): SourceTextProvider {
  const fetchImpl: FetchLike = options.fetchImpl ?? ((i, init) => fetch(i, init));
  const timeoutMs = options.timeoutMs ?? 15_000;
  const userAgent =
    options.userAgent ?? process.env.ENGINE_QUOTE_FETCH_UA ?? DEFAULT_UA;

  const get = async (url: string): Promise<Response> => {
    const res = await fetchImpl(url, {
      headers: { "user-agent": userAgent, accept: "application/json,text/html" },
      signal: AbortSignal.timeout(timeoutMs),
      redirect: "follow",
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    return res;
  };

  return {
    async fetchText(url: string): Promise<string> {
      const reddit = redditJsonUrl(url);
      if (reddit) {
        const json: unknown = await (await get(reddit)).json();
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
      return htmlToText(await (await get(url)).text());
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
  const page = normalizeForMatch(pageText);
  const fragments = quote
    .split(/\.\.\.|…/)
    .map(normalizeForMatch)
    .filter((f) => f.split(" ").length >= 3);
  if (fragments.length === 0) return false;
  let from = 0;
  for (const fragment of fragments) {
    const at = page.indexOf(fragment, from);
    if (at === -1) return false;
    from = at + fragment.length;
  }
  return true;
}
