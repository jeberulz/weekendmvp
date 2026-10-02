/**
 * Source acquirer (WP54-S1, evidence contract §3): one fetch per URL per run,
 * bounded concurrency, typed statuses, and a `read` that never rejects.
 */

import { createHash } from "node:crypto";
import http from "node:http";
import { gzipSync } from "node:zlib";

import { afterEach, describe, expect, it } from "vitest";

import { createSourceAcquirer, type SourceRead } from "./acquire.ts";
import {
  deferred,
  loopbackLookup,
  PUBLIC_TEST_DNS,
  settleWithin,
  sleep,
  startServer,
  type TestServer,
} from "./providers/__smoke__/harness.ts";
import {
  createPublicOnlyFetch,
  createSourceTextProvider,
  SOURCE_LIMITS,
  SourceFetchError,
  type SourceFetchErrorCode,
  type SourceTextProvider,
} from "./providers/sourceText.ts";

const FIXED_NOW = new Date("2026-10-01T12:00:00.000Z");
const now = () => FIXED_NOW;
const sha256 = (text: string) => createHash("sha256").update(text, "utf8").digest("hex");

/** A provider that records calls and in-flight counts; each read takes `delayMs`. */
function instrumented(answer: (url: string) => Promise<string>, delayMs = 15) {
  const stats = { calls: [] as string[], active: 0, maxActive: 0 };
  const sourceText: SourceTextProvider = {
    async fetchText(url) {
      stats.calls.push(url);
      stats.active += 1;
      stats.maxActive = Math.max(stats.maxActive, stats.active);
      try {
        await sleep(delayMs);
        return await answer(url);
      } finally {
        stats.active -= 1;
      }
    },
  };
  return { sourceText, stats };
}

const pageText = async (url: string) => `text of ${url}`;

describe("source acquirer", () => {
  it("records a successful read with retrievedAt and textSha256", async () => {
    const acquirer = createSourceAcquirer({
      sourceText: { fetchText: async () => "hello" },
      now,
    });
    expect(await acquirer.read("https://example.com/a")).toEqual({
      url: "https://example.com/a",
      status: "read",
      text: "hello",
      retrievedAt: "2026-10-01T12:00:00.000Z",
      textSha256: sha256("hello"),
    });
  });

  it("maps every SourceFetchError code to a source status", async () => {
    const expected: Record<SourceFetchErrorCode, SourceRead["status"]> = {
      oversized: "oversized",
      timeout: "timeout",
      no_content: "no_content",
      http_status: "http_error",
      blocked_address: "blocked",
      redirect_rejected: "redirect_rejected",
      too_many_redirects: "redirect_rejected",
      unsupported_encoding: "unsupported_encoding",
      network: "unreadable",
      invalid_url: "unreadable",
    };
    const codes = Object.keys(expected) as SourceFetchErrorCode[];
    const acquirer = createSourceAcquirer({
      sourceText: {
        async fetchText(url) {
          throw new SourceFetchError(new URL(url).hostname as SourceFetchErrorCode, `failed ${url}`);
        },
      },
    });
    const reads = await acquirer.readMany(codes.map((code) => `https://${code}/`));
    for (const code of codes) {
      expect(reads.get(`https://${code}/`), code).toMatchObject({
        status: expected[code],
        detail: `failed https://${code}/`,
      });
    }
  });

  it("maps any other failure to unreadable with a short, redacted detail", async () => {
    const acquirer = createSourceAcquirer({
      sourceText: {
        async fetchText() {
          throw new Error(
            `boom at https://user:pw@x.example/a?token=s3cret with Bearer abc123 ${"x".repeat(400)}`,
          );
        },
      },
    });
    const result = await acquirer.read("https://x.example/a");
    expect(result.status).toBe("unreadable");
    if (result.status === "read") throw new Error("unreachable");
    expect(result.detail.length).toBeLessThanOrEqual(160);
    expect(result.detail).toMatch(/^boom at https:\/\/x\.example\/a\?… with Bearer \[redacted\]/);
    expect(result.detail).not.toMatch(/pw|s3cret|abc123/);
  });

  it("treats empty or whitespace-only text as no_content", async () => {
    const acquirer = createSourceAcquirer({
      sourceText: { fetchText: async (url) => (url.endsWith("empty") ? "" : " \n\t ") },
    });
    for (const url of ["https://example.com/empty", "https://example.com/blank"]) {
      expect(await acquirer.read(url)).toMatchObject({ url, status: "no_content" });
    }
  });

  it("settles an invalid URL as unreadable without fetching it", async () => {
    const { sourceText, stats } = instrumented(pageText);
    const acquirer = createSourceAcquirer({ sourceText });
    expect(await acquirer.read("not a url")).toEqual({
      url: "not a url",
      status: "unreadable",
      detail: "invalid URL",
    });
    expect(stats.calls).toEqual([]);
  });

  it("never rejects, even for a provider that throws synchronously or throws a non-Error", async () => {
    const hostile = Object.create(null) as object; // String(hostile) throws
    const acquirer = createSourceAcquirer({
      sourceText: {
        fetchText(url) {
          if (url.endsWith("sync")) throw new Error("thrown synchronously");
          return Promise.reject(url.endsWith("hostile") ? hostile : "a bare string");
        },
      },
    });
    const reads = await acquirer.readMany([
      "https://example.com/sync",
      "https://example.com/hostile",
      "https://example.com/string",
    ]);
    expect([...reads.values()].map((r) => [r.status, r.status === "read" ? "" : r.detail])).toEqual([
      ["unreadable", "thrown synchronously"],
      ["unreadable", "unexpected error"],
      ["unreadable", "a bare string"],
    ]);
  });

  it("never runs more reads at once than the concurrency limit", async () => {
    const urls = Array.from({ length: 13 }, (_, i) => `https://example.com/${i}`);
    const defaults = instrumented(pageText);
    await createSourceAcquirer({ sourceText: defaults.sourceText }).readMany(urls);
    expect(SOURCE_LIMITS.concurrency).toBe(4);
    expect(defaults.stats.maxActive).toBe(4);
    expect(defaults.stats.calls).toHaveLength(13);

    const two = instrumented(pageText);
    const reads = await createSourceAcquirer({ sourceText: two.sourceText, concurrency: 2 }).readMany(urls);
    expect(two.stats.maxActive).toBe(2);
    expect([...reads.values()].every((r) => r.status === "read")).toBe(true);
  });

  it("starts and settles queued reads after earlier reads fail or time out", async () => {
    const started: string[] = [];
    const sourceText: SourceTextProvider = {
      async fetchText(url) {
        started.push(url);
        await sleep(20);
        if (url.endsWith("/slow")) throw new SourceFetchError("timeout", "deadline");
        if (url.endsWith("/broken")) throw new SourceFetchError("network", "reset");
        return "ok";
      },
    };
    const acquirer = createSourceAcquirer({ sourceText, concurrency: 1 });
    const first = acquirer.read("https://example.com/slow");
    const second = acquirer.read("https://example.com/broken");
    const third = acquirer.read("https://example.com/fine");
    // Only the first read may run until it settles.
    await sleep(5);
    expect(started).toEqual(["https://example.com/slow"]);
    const settled = await settleWithin(Promise.all([first, second, third]), 2000);
    expect(settled).toMatchObject({
      state: "fulfilled",
      value: [{ status: "timeout" }, { status: "unreadable" }, { status: "read" }],
    });
    expect(started).toEqual([
      "https://example.com/slow",
      "https://example.com/broken",
      "https://example.com/fine",
    ]);
  });

  it("shares one in-flight fetch between concurrent duplicate reads", async () => {
    const gate = deferred<string>();
    let calls = 0;
    const acquirer = createSourceAcquirer({
      sourceText: {
        fetchText() {
          calls += 1;
          return gate.promise;
        },
      },
    });
    const a = acquirer.read("https://example.com/thread");
    const b = acquirer.read("https://example.com/thread");
    gate.resolve("shared text");
    const [first, second] = await Promise.all([a, b]);
    expect(calls).toBe(1);
    expect(second).toBe(first);
  });

  it("fetches a URL once across the market, competitor, community and supplement rounds", async () => {
    const { sourceText, stats } = instrumented(pageText);
    const acquirer = createSourceAcquirer({ sourceText });
    const shared = "https://news.ycombinator.com/item?id=27515468";
    await Promise.all([
      acquirer.readMany(["https://market.example/report", shared]),
      acquirer.readMany(["https://vendor.example/pricing", shared]),
      acquirer.readMany([shared, "https://forum.example/t/1"]),
    ]);
    // A later supplement search cites some of the same pages again.
    const supplement = await acquirer.readMany([shared, "https://forum.example/t/1", "https://ih.example/p"]);
    expect([...supplement.values()].map((r) => r.status)).toEqual(["read", "read", "read"]);
    expect([...stats.calls].sort()).toEqual(
      [
        "https://forum.example/t/1",
        "https://ih.example/p",
        "https://market.example/report",
        shared,
        "https://vendor.example/pricing",
      ].sort(),
    );
  });

  it("dedupes by keyOf, keeping the first URL requested", async () => {
    const { sourceText, stats } = instrumented(pageText);
    const acquirer = createSourceAcquirer({
      sourceText,
      keyOf: (url) => new URL(url).href.replace(/\/$/, ""),
    });
    const reads = await acquirer.readMany(["https://example.com/a/", "https://example.com/a"]);
    expect(stats.calls).toEqual(["https://example.com/a/"]);
    expect(reads.get("https://example.com/a")?.url).toBe("https://example.com/a/");
  });

  it("readMany keys results by each requested URL, duplicates included", async () => {
    const { sourceText } = instrumented(pageText);
    const reads = await createSourceAcquirer({ sourceText }).readMany([
      "https://example.com/1",
      "https://example.com/2",
      "https://example.com/1",
    ]);
    expect([...reads.keys()]).toEqual(["https://example.com/1", "https://example.com/2"]);
    expect(reads.get("https://example.com/2")).toMatchObject({
      status: "read",
      text: "text of https://example.com/2",
    });
  });

  it("snapshot lists every distinct URL attempted, in first-attempt order", async () => {
    const { sourceText } = instrumented(async (url) => {
      // The first URL finishes last, so settle order differs from attempt order.
      if (url.includes("a.example")) await sleep(40);
      if (url.includes("down")) throw new SourceFetchError("http_status", "HTTP 503", 503);
      return "page";
    }, 5);
    const acquirer = createSourceAcquirer({ sourceText, now });
    await acquirer.readMany(["https://a.example/", "https://down.example/", "bad url"]);
    await acquirer.readMany(["https://a.example/", "https://c.example/"]);
    expect(acquirer.snapshot().map((r) => [r.url, r.status])).toEqual([
      ["https://a.example/", "read"],
      ["https://down.example/", "http_error"],
      ["bad url", "unreadable"],
      ["https://c.example/", "read"],
    ]);
  });

  it("leaves reads still in flight out of the snapshot", async () => {
    const gate = deferred<string>();
    const acquirer = createSourceAcquirer({ sourceText: { fetchText: () => gate.promise } });
    const pending = acquirer.read("https://example.com/slow");
    expect(acquirer.snapshot()).toEqual([]);
    gate.resolve("done");
    await pending;
    expect(acquirer.snapshot()).toHaveLength(1);
  });

  it("refuses a concurrency that is not a positive integer", () => {
    const sourceText: SourceTextProvider = { fetchText: async () => "" };
    for (const concurrency of [0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => createSourceAcquirer({ sourceText, concurrency }), String(concurrency)).toThrow(
        RangeError,
      );
    }
  });
});

describe("source acquirer over the real transport", () => {
  const open: TestServer[] = [];
  afterEach(async () => {
    await Promise.all(open.splice(0).map((server) => server.close()));
  });

  async function serve(handler: http.RequestListener): Promise<TestServer> {
    const server = await startServer(handler);
    open.push(server);
    return server;
  }

  it("turns each transport outcome into its source status", async () => {
    const server = await serve((req, res) => {
      switch (req.url) {
        case "/page":
          res.end("<p>Quotable text.</p>");
          return;
        case "/reset":
          res.writeHead(205);
          res.end();
          return;
        case "/huge":
          res.writeHead(200, { "content-length": String(3 * 1024 * 1024) });
          res.flushHeaders();
          return;
        case "/missing":
          res.writeHead(404);
          res.end("no");
          return;
        case "/gzip":
          res.writeHead(200, { "content-encoding": "gzip" });
          res.end(gzipSync("hidden"));
          return;
        case "/slow":
          res.writeHead(200);
          res.write("partial");
          return;
        default: {
          // /loop?n=…: an endless redirect chain
          const n = Number(new URL(req.url ?? "/", "http://x").searchParams.get("n"));
          res.writeHead(302, { location: `/loop?n=${n + 1}` });
          res.end();
        }
      }
    });
    const acquirer = createSourceAcquirer({
      sourceText: createSourceTextProvider({
        fetchImpl: createPublicOnlyFetch({ lookup: loopbackLookup }),
        resolveHost: PUBLIC_TEST_DNS,
        timeoutMs: 400,
      }),
      now,
    });
    const at = (path: string) => `${server.origin("site")}${path}`;
    const reads = await acquirer.readMany([
      at("/page"),
      at("/reset"),
      at("/huge"),
      at("/missing"),
      at("/gzip"),
      at("/slow"),
      at("/loop?n=0"),
      `http://127.0.0.1:${server.port}/page`,
    ]);
    expect([...reads.values()].map((r) => r.status)).toEqual([
      "read",
      "no_content",
      "oversized",
      "http_error",
      "unsupported_encoding",
      "timeout",
      "redirect_rejected",
      "blocked",
    ]);
    expect(reads.get(at("/page"))).toMatchObject({
      text: " Quotable text.\n",
      retrievedAt: FIXED_NOW.toISOString(),
      textSha256: sha256(" Quotable text.\n"),
    });
    expect(reads.get(at("/missing"))).toMatchObject({ detail: expect.stringMatching(/^HTTP 404 for /) });
  });
});
