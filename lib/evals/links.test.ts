/**
 * WP41-S6 tests: link liveness. Fake transports only, no network.
 */

import { describe, expect, it } from "vitest";

import { createMemoryCache } from "./cache.ts";
import { checkLinks, classify, linkFindings, pageLinkSummary } from "./links.ts";
import type { Fetcher } from "./providers/openrouter.ts";

const OPTIONS = { timeoutMs: 1000, maxBytes: 100_000, maxTextChars: 10_000, concurrency: 4, perHost: 2 };
const page = `<html><body><main><p>${"Readable article text about the market. ".repeat(10)}</p></main></body></html>`;

function web(routes: Record<string, number | "pdf" | "throw" | "flaky">) {
  const hits = new Map<string, number>();
  let inFlight = 0;
  let maxInFlight = 0;
  const fetchImpl = (async (input: RequestInfo | URL) => {
    const url = String(input);
    hits.set(url, (hits.get(url) ?? 0) + 1);
    inFlight += 1;
    maxInFlight = Math.max(maxInFlight, inFlight);
    await new Promise((r) => setTimeout(r, 5));
    inFlight -= 1;
    const route = routes[url] ?? 200;
    if (route === "throw") throw new Error("getaddrinfo ENOTFOUND");
    if (route === "flaky" && hits.get(url) === 1) throw new Error("ECONNRESET");
    if (route === "pdf") return new Response("%PDF", { headers: { "content-type": "application/pdf" } });
    if (typeof route === "number" && route !== 200) return new Response("x", { status: route });
    return new Response(page, { headers: { "content-type": "text/html" } });
  }) as Fetcher;
  return { fetchImpl, hits, maxInFlight: () => maxInFlight };
}

describe("classify and checkLinks", () => {
  it("separates dead, blocked, alive and unknown links", async () => {
    const { fetchImpl } = web({
      "https://a.io/gone": 404,
      "https://a.io/removed": 410,
      "https://b.io/wall": 403,
      "https://b.io/slow": 429,
      "https://c.io/report.pdf": "pdf",
      "https://d.io/oops": 500,
      "https://nope.invalid/x": "throw",
    });
    const results = await checkLinks(
      ["https://a.io/gone", "https://a.io/removed", "https://b.io/wall", "https://b.io/slow", "https://c.io/report.pdf", "https://d.io/oops", "https://nope.invalid/x", "https://e.io/ok"],
      { ...OPTIONS, fetchImpl },
    );
    const status = Object.fromEntries([...results.values()].map((r) => [r.url, r.status]));
    expect(status).toEqual({
      "https://a.io/gone": "dead",
      "https://a.io/removed": "dead",
      "https://b.io/wall": "blocked",
      "https://b.io/slow": "blocked",
      "https://c.io/report.pdf": "alive",
      "https://d.io/oops": "error",
      "https://nope.invalid/x": "dead",
      "https://e.io/ok": "alive",
    });
    expect(classify({ url: "x", status: "ok", text: "t" })).toBe("alive");
  });

  it("retries a network blip once before calling a link dead", async () => {
    const { fetchImpl, hits } = web({ "https://f.io/blip": "flaky" });
    const results = await checkLinks(["https://f.io/blip"], { ...OPTIONS, fetchImpl });
    expect(results.get("https://f.io/blip")?.status).toBe("alive");
    expect(hits.get("https://f.io/blip")).toBe(2);
  });

  it("checks each URL once and respects the per-host limit", async () => {
    const urls = Array.from({ length: 8 }, (_, i) => `https://same.io/p${i}`);
    const { fetchImpl, hits, maxInFlight } = web({});
    const cache = createMemoryCache();
    await checkLinks([...urls, ...urls], { ...OPTIONS, fetchImpl, cache, concurrency: 8, perHost: 2 });
    expect([...hits.values()].every((n) => n === 1)).toBe(true);
    expect(maxInFlight()).toBeLessThanOrEqual(2);
    await checkLinks(urls, { ...OPTIONS, fetchImpl, cache });
    expect([...hits.values()].every((n) => n === 1)).toBe(true); // served from cache
  });
});

describe("page findings", () => {
  it("warns on dead links only, listing them", async () => {
    const { fetchImpl } = web({ "https://a.io/gone": 404, "https://b.io/wall": 403 });
    const urls = ["https://a.io/gone", "https://b.io/wall", "https://e.io/ok"];
    const summary = pageLinkSummary(urls, await checkLinks(urls, { ...OPTIONS, fetchImpl }));
    expect(summary).toMatchObject({ checked: 3, errors: 0 });
    expect(summary.blocked.map((b) => b.url)).toEqual(["https://b.io/wall"]);
    const findings = linkFindings(summary, { deadShareWarn: 0.3 });
    expect(findings).toEqual([
      { check: "sources.dead", message: "1 of 3 source links are dead, 33% of the page's sources: https://a.io/gone (404)" },
    ]);
    expect(linkFindings({ checked: 2, dead: [], blocked: summary.blocked, errors: 0 }, { deadShareWarn: 0.3 })).toEqual([]);
  });
});
