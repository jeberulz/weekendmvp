/**
 * Quote and URL identity shared by the pipeline and the MDX auditor.
 * Equivalent URLs collapse. Visible quote text is taken from the Markdown AST
 * so HTML entities decode the same way the page does.
 */

import { createProcessor } from "@mdx-js/mdx";

const processor = createProcessor();

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

export function decodeHtmlEntities(text) {
  return String(text)
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#123;/g, "{")
    .replace(/&#125;/g, "}")
    .replace(/&#x([0-9a-f]+);/gi, (_m, hex) =>
      String.fromCodePoint(Number.parseInt(hex, 16)),
    )
    .replace(/&#(\d+);/g, (_m, dec) => String.fromCodePoint(Number(dec)));
}

export function normalizeQuoteExact(text) {
  return decodeHtmlEntities(text)
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

function textOf(node) {
  if (!node || typeof node !== "object") return "";
  if (node.type === "text" || node.type === "inlineCode") {
    return typeof node.value === "string" ? node.value : "";
  }
  if (!Array.isArray(node.children)) return "";
  return node.children.map(textOf).join("");
}

function firstLinkUrl(node) {
  if (!node || typeof node !== "object") return "";
  if (node.type === "link" && typeof node.url === "string") return node.url;
  for (const child of node.children ?? []) {
    const found = firstLinkUrl(child);
    if (found) return found;
  }
  return "";
}

/**
 * Visible blockquote text plus its attribution URL, after Markdown decoding.
 */
export function extractAttributedQuotes(body) {
  const source = String(body).replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, "");
  const tree = processor.parse(source);
  const out = [];
  for (const child of tree.children ?? []) {
    if (child.type !== "blockquote") continue;
    const paragraphs = (child.children ?? []).filter(
      (node) => node.type === "paragraph",
    );
    if (paragraphs.length === 0) continue;
    let quote = textOf(paragraphs[0]).trim();
    quote = quote.replace(/^["“]|["”]$/g, "").trim();
    quote = quote.replace(/\s*[—–-]\s*.*$/u, "").trim();
    const url = firstLinkUrl(child);
    if (quote.length >= 12) out.push({ quote, url });
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
