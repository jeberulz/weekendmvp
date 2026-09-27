/**
 * Quote and URL identity shared by the pipeline and the MDX auditor.
 * Equivalent URLs collapse. A quote matches only the whole normalised text.
 */

export function canonicalSourceKey(url) {
  let parsed;
  try {
    parsed = new URL(String(url));
  } catch {
    return null;
  }
  const host = parsed.hostname.replace(/^www\./, "").toLowerCase();
  if (host === "reddit.com" || host.endsWith(".reddit.com")) {
    const thread = parsed.pathname.match(/\/comments\/([a-z0-9]+)/i);
    if (thread?.[1]) return `reddit:${thread[1].toLowerCase()}`;
  }
  if (host === "news.ycombinator.com") {
    const id = parsed.searchParams.get("id");
    if (id && /^\d+$/.test(id)) return `hn:${id}`;
  }
  parsed.hash = "";
  for (const key of [...parsed.searchParams.keys()]) {
    if (key.startsWith("utm_")) parsed.searchParams.delete(key);
  }
  const pathname = parsed.pathname.replace(/\/+$/, "") || "/";
  return `${parsed.protocol}//${host}${pathname}${parsed.search}`;
}

export function discussionKey(url) {
  return canonicalSourceKey(url) ?? String(url);
}

export function normalizeQuoteExact(text) {
  return String(text)
    .replace(/[\u2018\u2019\u201A\u201B]/g, "'")
    .replace(/[\u201C\u201D\u201E\u201F]/g, '"')
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function quotesAreExact(left, right) {
  const a = normalizeQuoteExact(left);
  const b = normalizeQuoteExact(right);
  return a.length > 0 && a === b;
}

export function extractAttributedQuotes(body) {
  const lines = String(body).split("\n");
  const out = [];
  for (let i = 0; i < lines.length; i += 1) {
    const quoteLine = lines[i].match(/^>\s*"([^"]+)"/);
    if (!quoteLine) continue;
    const window = lines.slice(i, i + 5).join("\n");
    const link = window.match(/\]\((https?:\/\/[^)\s]+)\)/);
    out.push({ quote: quoteLine[1], url: link ? link[1] : "" });
  }
  return out;
}

export function countIndependentVerified(signals) {
  const keys = new Set();
  for (const signal of signals ?? []) {
    if (signal?.verified !== true) continue;
    keys.add(discussionKey(signal.citation?.url ?? ""));
  }
  return keys.size;
}
