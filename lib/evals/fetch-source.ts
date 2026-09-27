/**
 * WP41-S3. Fetch a cited source and reduce it to plain text.
 *
 * Each URL is fetched at most once per cache TTL. Only extracted text is
 * kept (never raw HTML), in a gitignored cache. Anything that is not HTML
 * or plain text (PDFs, images) is `unreadable`: the claim that cites it is
 * reported as unverifiable, never as supported.
 */

import * as cheerio from "cheerio";

import { hashKey, type JsonCache } from "./cache.ts";
import type { Fetcher } from "./providers/openrouter.ts";

export type SourceStatus = "ok" | "http_error" | "unreadable" | "network_error";

export type SourceDoc = {
  url: string;
  status: SourceStatus;
  httpStatus?: number;
  /** Plain text, capped. Empty unless status is "ok". */
  text: string;
  detail?: string;
};

export type FetchSourceOptions = {
  fetchImpl?: Fetcher;
  cache?: JsonCache;
  timeoutMs: number;
  maxBytes: number;
  maxTextChars: number;
};

const USER_AGENT =
  "Mozilla/5.0 (compatible; WeekendMVP-ContentEvals/1.0; +https://www.weekendmvp.app)";

const DROP = "script, style, noscript, svg, iframe, template, nav, footer, header, form, button";
const BLOCK = "p, li, h1, h2, h3, h4, h5, h6, td, th, tr, dd, dt, blockquote, pre, br, div, section, article";

/** HTML -> readable text: chrome removed, one block per line. */
export function htmlToText(html: string): string {
  const $ = cheerio.load(html);
  $(DROP).remove();
  $(BLOCK).each((_, el) => {
    $(el).append("\n");
  });
  const text =
    $("main").length > 0 ? $("main").text() : $("body").length > 0 ? $("body").text() : $.root().text();
  return text
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n");
}

export async function fetchSource(url: string, options: FetchSourceOptions): Promise<SourceDoc> {
  const key = hashKey("source-v1", url);
  const cached = options.cache?.get<SourceDoc>("sources", key);
  if (cached) return cached;

  const done = (doc: SourceDoc, cacheIt = true) => {
    // Transient failures are not cached, so the next run retries them.
    if (cacheIt) options.cache?.set("sources", key, doc);
    return doc;
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs);
  let response: Response;
  try {
    response = await (options.fetchImpl ?? fetch)(url, {
      headers: { "user-agent": USER_AGENT, accept: "text/html,text/plain;q=0.9,*/*;q=0.1" },
      redirect: "follow",
      signal: controller.signal,
    });
  } catch (error) {
    clearTimeout(timer);
    return done(
      { url, status: "network_error", text: "", detail: error instanceof Error ? error.message : String(error) },
      false,
    );
  }

  try {
    if (!response.ok) {
      return done(
        { url, status: "http_error", httpStatus: response.status, text: "" },
        response.status !== 429 && response.status < 500,
      );
    }
    const type = (response.headers.get("content-type") ?? "").toLowerCase();
    const isHtml = type.includes("html") || type === "";
    if (!isHtml && !type.startsWith("text/plain")) {
      return done({ url, status: "unreadable", httpStatus: response.status, text: "", detail: type });
    }
    const declared = Number(response.headers.get("content-length") ?? 0);
    if (declared > options.maxBytes) {
      return done({ url, status: "unreadable", httpStatus: response.status, text: "", detail: "too large" });
    }
    const buffer = await response.arrayBuffer();
    if (buffer.byteLength > options.maxBytes) {
      return done({ url, status: "unreadable", httpStatus: response.status, text: "", detail: "too large" });
    }
    const body = new TextDecoder().decode(buffer);
    const text = (isHtml ? htmlToText(body) : body).slice(0, options.maxTextChars);
    if (text.trim().length < 200) {
      // Script-rendered pages and bot walls come back near-empty.
      return done({ url, status: "unreadable", httpStatus: response.status, text: "", detail: "no readable text" });
    }
    return done({ url, status: "ok", httpStatus: response.status, text });
  } catch (error) {
    return done(
      { url, status: "network_error", text: "", detail: error instanceof Error ? error.message : String(error) },
      false,
    );
  } finally {
    clearTimeout(timer);
  }
}
