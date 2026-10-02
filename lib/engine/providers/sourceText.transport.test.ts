/**
 * Source transport regressions (WP46-S1: F4 bounded reads, F7 settlement,
 * redirect credential handling). Every test drives the real node:http
 * transport against local servers. The only seam is the socket lookup
 * (`*.source.test` → 127.0.0.1) and a pretend-public pre-flight resolver;
 * production keeps `publicOnlyLookup`, whose refusals are tested here too.
 */

import { spawn } from "node:child_process";
import { getEventListeners } from "node:events";
import http from "node:http";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";

import { afterEach, describe, expect, it } from "vitest";

import {
  captureProcessErrors,
  deferred,
  fakeTlsFetch,
  loopbackLookup,
  PUBLIC_TEST_DNS,
  settleWithin,
  sleep,
  stalledLookup,
  startRawServer,
  startServer,
  type TestServer,
} from "./__smoke__/harness.ts";
import {
  assertPublicUrl,
  createPublicOnlyFetch,
  createSourceTextProvider,
  htmlToText,
  publicOnlyFetch,
  redactText,
  redactUrl,
  sendWithRedirects,
  SOURCE_LIMITS,
  SourceFetchError,
  type CreateSourceTextOptions,
  type SourceLimits,
} from "./sourceText.ts";

const MiB = 1024 * 1024;

const open: TestServer[] = [];

afterEach(async () => {
  await Promise.all(open.splice(0).map((server) => server.close()));
});

async function serve(handler: http.RequestListener): Promise<TestServer> {
  const server = await startServer(handler);
  open.push(server);
  return server;
}

async function serveRaw(respond: Parameters<typeof startRawServer>[0]): Promise<TestServer> {
  const server = await startRawServer(respond);
  open.push(server);
  return server;
}

function transport(limits?: Partial<Pick<SourceLimits, "maxWireBytes">>) {
  return createPublicOnlyFetch({ lookup: loopbackLookup, limits });
}

function provider(options: CreateSourceTextOptions = {}) {
  return createSourceTextProvider({
    fetchImpl: transport(),
    resolveHost: PUBLIC_TEST_DNS,
    ...options,
  });
}

/** Resolves with whether the server-side response closed before it finished. */
function cutShort(res: http.ServerResponse): Promise<boolean> {
  return new Promise((resolve) => res.on("close", () => resolve(!res.writableFinished)));
}

describe("source transport: body bounds (F4)", () => {
  it("returns a body below the cap", async () => {
    const server = await serve((_req, res) => res.end("x".repeat(1000)));
    const res = await transport({ maxWireBytes: 1024 })(`${server.origin("page")}/`);
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("x".repeat(1000));
  });

  it("accepts a body of exactly the default 2 MiB cap", async () => {
    expect(SOURCE_LIMITS.maxWireBytes).toBe(2 * MiB);
    const server = await serve((_req, res) => res.end(Buffer.alloc(2 * MiB, "a")));
    const res = await transport()(`${server.origin("page")}/`);
    expect((await res.arrayBuffer()).byteLength).toBe(2 * MiB);
    // The provider's decoded-bytes cap admits the same body.
    expect((await provider().fetchText(`${server.origin("page")}/`)).length).toBe(2 * MiB);
  });

  it("rejects one byte over the cap, whether declared or only streamed", async () => {
    const declared = await serve((_req, res) => res.end(Buffer.alloc(2 * MiB + 1, "a")));
    await expect(transport()(`${declared.origin("page")}/`)).rejects.toMatchObject({
      name: "SourceFetchError",
      code: "oversized",
    });
    const streamed = await serve((_req, res) => {
      res.writeHead(200); // no Content-Length: chunked
      res.write(Buffer.alloc(2 * MiB, "a"));
      res.end("b");
    });
    await expect(transport()(`${streamed.origin("page")}/`)).rejects.toMatchObject({
      code: "oversized",
    });
  });

  it("rejects a huge declared Content-Length before any body byte and drops the connection", async () => {
    let bodyWritten = false;
    const closedEarly = deferred<boolean>();
    const server = await serve((_req, res) => {
      res.writeHead(200, { "content-length": String(64 * 1024 * MiB) });
      res.flushHeaders();
      void cutShort(res).then(closedEarly.resolve);
      const timer = setTimeout(() => {
        bodyWritten = true;
        res.write("late");
      }, 1000);
      res.on("close", () => clearTimeout(timer));
    });
    const started = Date.now();
    await expect(transport()(`${server.origin("page")}/`)).rejects.toMatchObject({
      code: "oversized",
    });
    expect(Date.now() - started).toBeLessThan(900);
    expect(bodyWritten).toBe(false);
    expect(await closedEarly.promise).toBe(true);
  });

  it("stops an oversized chunked body without Content-Length and closes the connection", async () => {
    const seen = deferred<{ written: number; cutShort: boolean }>();
    const server = await serve((_req, res) => {
      res.writeHead(200, { "content-type": "text/plain" });
      const chunk = Buffer.alloc(16 * 1024, "a");
      let written = 0;
      const pump = () => {
        while (written < 8 * MiB && !res.destroyed) {
          written += chunk.length;
          if (!res.write(chunk)) {
            res.once("drain", pump);
            return;
          }
        }
        res.end();
      };
      res.on("close", () => seen.resolve({ written, cutShort: !res.writableFinished }));
      pump();
    });
    await expect(
      transport({ maxWireBytes: 64 * 1024 })(`${server.origin("page")}/`),
    ).rejects.toMatchObject({ code: "oversized" });
    const outcome = await seen.promise;
    expect(outcome.cutShort).toBe(true);
    expect(outcome.written).toBeLessThan(8 * MiB);
  });

  it("refuses a single chunk larger than the cap", async () => {
    const closed = deferred<boolean>();
    const server = await serve((_req, res) => {
      res.writeHead(200);
      void cutShort(res).then(closed.resolve);
      res.write(Buffer.alloc(512 * 1024, "a")); // one write, far over the cap
    });
    await expect(transport({ maxWireBytes: 1000 })(`${server.origin("page")}/`)).rejects.toMatchObject({
      code: "oversized",
    });
    expect(await closed.promise).toBe(true);
  });

  it("never accepts more than a misleading small Content-Length declares", async () => {
    const socketClosed = deferred<void>();
    const server = await serveRaw((socket) => {
      socket.write("HTTP/1.1 200 OK\r\nContent-Length: 10\r\n\r\n0123456789");
      // Keep streaming bytes past the declared length until the client hangs up.
      const timer = setInterval(() => socket.write(Buffer.alloc(64 * 1024, "x")), 5);
      socket.on("close", () => {
        clearInterval(timer);
        socketClosed.resolve();
      });
    });
    const settled = await settleWithin(transport()(`${server.origin("page")}/`), 2000);
    if (settled.state === "fulfilled") {
      expect(await settled.value.text()).toBe("0123456789");
    } else {
      expect(settled).toMatchObject({ state: "rejected", reason: { code: "network" } });
    }
    expect(await settleWithin(socketClosed.promise, 2000)).toEqual({
      state: "fulfilled",
      value: undefined,
    });
  });
});

describe("source transport: compression is refused, never decoded", () => {
  it("asks for identity encoding", async () => {
    const seen: string[] = [];
    const server = await serve((req, res) => {
      seen.push(req.headers["accept-encoding"] ?? "(none)");
      res.end("ok");
    });
    await transport()(`${server.origin("page")}/`, {
      headers: { "accept-encoding": "gzip, br" },
    });
    expect(seen).toEqual(["identity"]);
  });

  it("fails a gzip bomb as unsupported_encoding without inflating it", async () => {
    const bomb = gzipSync(Buffer.alloc(64 * MiB)); // ~64 KiB on the wire
    const closed = deferred<boolean>();
    const server = await serve((_req, res) => {
      res.writeHead(200, { "content-encoding": "gzip", "content-length": String(bomb.length) });
      void cutShort(res).then(closed.resolve);
      res.end(bomb);
    });
    const error = await provider()
      .fetchText(`${server.origin("page")}/`)
      .then(
        () => null,
        (e: unknown) => e,
      );
    expect(error).toBeInstanceOf(SourceFetchError);
    expect(error).toMatchObject({ code: "unsupported_encoding", status: 200 });
    expect((error as Error).message).toMatch(/content-encoding "gzip"/);
    await closed.promise;
  });

  it("fails br and stacked codings, and accepts an explicit identity coding", async () => {
    const server = await serve((req, res) => {
      const coding = req.url === "/br" ? "br" : req.url === "/stacked" ? "gzip, br" : "identity";
      res.writeHead(200, { "content-encoding": coding });
      res.end("plain text");
    });
    for (const path of ["/br", "/stacked"]) {
      await expect(transport()(`${server.origin("page")}${path}`)).rejects.toMatchObject({
        code: "unsupported_encoding",
      });
    }
    expect(await provider().fetchText(`${server.origin("page")}/identity`)).toBe("plain text");
  });
});

describe("source transport: every response settles (F7)", () => {
  it("settles HTTP 205 through the real transport as no_content, with no uncaught exception", async () => {
    const errors = captureProcessErrors();
    const server = await serve((_req, res) => {
      res.writeHead(205);
      res.end();
    });
    const res = await transport()(`${server.origin("page")}/`);
    expect(res.status).toBe(205);
    expect(res.body).toBeNull();
    const settled = await settleWithin(provider().fetchText(`${server.origin("page")}/`), 2000);
    expect(settled).toMatchObject({ state: "rejected", reason: { code: "no_content", status: 205 } });
    await sleep(20);
    expect(errors.stop()).toEqual([]);
  });

  it("ignores a body illegally sent with 205", async () => {
    const server = await serveRaw((socket) =>
      socket.end("HTTP/1.1 205 Reset Content\r\nContent-Length: 5\r\n\r\nhello"),
    );
    const res = await transport()(`${server.origin("page")}/`);
    expect(res.status).toBe(205);
    expect(res.body).toBeNull();
  });

  it("settles 204, 304 and HEAD as bodiless responses", async () => {
    const server = await serve((req, res) => {
      if (req.url === "/204") res.writeHead(204);
      else if (req.url === "/304") res.writeHead(304);
      else res.writeHead(200, { "content-length": "5" });
      res.end();
    });
    for (const status of [204, 304]) {
      const res = await transport()(`${server.origin("page")}/${status}`);
      expect(res.status).toBe(status);
      expect(res.body).toBeNull();
      await expect(provider().fetchText(`${server.origin("page")}/${status}`)).rejects.toMatchObject({
        code: "no_content",
        status,
      });
    }
    const head = await transport()(`${server.origin("page")}/head`, { method: "HEAD" });
    expect(head.status).toBe(200);
    expect(head.body).toBeNull();
  });

  it("reports an empty 200 body as no_content", async () => {
    const server = await serve((_req, res) => res.end());
    await expect(provider().fetchText(`${server.origin("page")}/`)).rejects.toMatchObject({
      code: "no_content",
      status: 200,
    });
  });

  it("rejects an out-of-range status instead of throwing in a callback", async () => {
    const errors = captureProcessErrors();
    const server = await serveRaw((socket) =>
      socket.end("HTTP/1.1 999 Odd\r\nContent-Length: 2\r\n\r\nhi"),
    );
    const settled = await settleWithin(transport()(`${server.origin("page")}/`), 2000);
    expect(settled).toMatchObject({ state: "rejected", reason: { code: "http_status", status: 999 } });
    await sleep(20);
    expect(errors.stop()).toEqual([]);
  });

  it("rejects a malformed status line and conflicting length headers", async () => {
    const server = await serveRaw((socket) => socket.end("HTTP/1.1 2x0 Bad\r\n\r\n"));
    await expect(transport()(`${server.origin("page")}/`)).rejects.toMatchObject({ code: "network" });
    const both = await serveRaw((socket) =>
      socket.end(
        "HTTP/1.1 200 OK\r\nContent-Length: 2\r\nTransfer-Encoding: chunked\r\n\r\n2\r\nhi\r\n0\r\n\r\n",
      ),
    );
    await expect(transport()(`${both.origin("page")}/`)).rejects.toMatchObject({ code: "network" });
  });

  it("rejects once when the server destroys the connection mid-body", async () => {
    const errors = captureProcessErrors();
    const server = await serve((_req, res) => {
      res.writeHead(200, { "content-length": "1000" });
      res.write("x".repeat(100), () => res.socket?.destroy());
    });
    const settled = await settleWithin(transport()(`${server.origin("page")}/`), 2000);
    expect(settled).toMatchObject({ state: "rejected", reason: { code: "network" } });
    await sleep(20);
    expect(errors.stop()).toEqual([]);
  });

  it("rejects a socket reset before any response and a refused connection", async () => {
    const reset = await serve((req) => req.socket.destroy());
    await expect(transport()(`${reset.origin("page")}/`)).rejects.toMatchObject({ code: "network" });
    const gone = await startServer(() => undefined);
    const { port } = gone;
    await gone.close();
    await expect(transport()(`http://gone.source.test:${port}/`)).rejects.toMatchObject({
      code: "network",
    });
  });

  it("removes its abort listener whether it succeeds or fails", async () => {
    const server = await serve((_req, res) => res.end("fine"));
    const controller = new AbortController();
    await transport()(`${server.origin("page")}/`, { signal: controller.signal });
    expect(getEventListeners(controller.signal, "abort")).toHaveLength(0);
    await expect(
      transport({ maxWireBytes: 2 })(`${server.origin("page")}/`, { signal: controller.signal }),
    ).rejects.toMatchObject({ code: "oversized" });
    expect(getEventListeners(controller.signal, "abort")).toHaveLength(0);
  });

  it("an abort mid-body rejects with its reason and destroys the connection", async () => {
    const closed = deferred<boolean>();
    const server = await serve((_req, res) => {
      res.writeHead(200);
      res.write("partial");
      void cutShort(res).then(closed.resolve);
    });
    const controller = new AbortController();
    const pending = transport()(`${server.origin("page")}/`, { signal: controller.signal });
    await sleep(50);
    controller.abort(new SourceFetchError("timeout", "test deadline"));
    await expect(pending).rejects.toMatchObject({ code: "timeout", message: "test deadline" });
    expect(await closed.promise).toBe(true);
    expect(getEventListeners(controller.signal, "abort")).toHaveLength(0);
  });
});

describe("source transport: address safety stays intact", () => {
  it("refuses private, loopback and metadata IP literals without connecting", async () => {
    // Node connects to an IP-literal host without calling `lookup`, so the
    // transport checks literals itself.
    const server = await serve((_req, res) => res.end("internal"));
    for (const url of [
      `http://127.0.0.1:${server.port}/`,
      `http://[::1]:${server.port}/`,
      `http://[::ffff:127.0.0.1]:${server.port}/`,
      "http://10.0.0.5/",
      "http://169.254.169.254/latest/meta-data/",
      "http://[fd00::1]/",
    ]) {
      await expect(publicOnlyFetch(url), url).rejects.toMatchObject({ code: "blocked_address" });
    }
    expect(server.connections()).toBe(0);
  });

  it("refuses a host whose socket lookup answers with loopback (rebinding)", async () => {
    const server = await serve((_req, res) => res.end("internal"));
    await expect(publicOnlyFetch(`http://localhost:${server.port}/`)).rejects.toMatchObject({
      code: "blocked_address",
      message: expect.stringMatching(/non-public/),
    });
    expect(server.connections()).toBe(0);
  });

  it("re-checks each redirect target before contacting it", async () => {
    const internal = await serve((_req, res) => res.end("internal"));
    const server = await serve((req, res) => {
      const location =
        req.url === "/to-loopback"
          ? `http://127.0.0.1:${internal.port}/admin`
          : "http://[::ffff:a9fe:a9fe]/latest/meta-data/";
      res.writeHead(302, { location });
      res.end();
    });
    for (const path of ["/to-loopback", "/to-metadata"]) {
      await expect(provider().fetchText(`${server.origin("page")}${path}`)).rejects.toMatchObject({
        code: "blocked_address",
      });
    }
    expect(internal.connections()).toBe(0);
  });
});

describe("source reads: one deadline per read", () => {
  it("times out a slow body and drops the connection", async () => {
    const closed = deferred<boolean>();
    const server = await serve((_req, res) => {
      res.writeHead(200);
      const timer = setInterval(() => res.write("."), 50);
      res.on("close", () => clearInterval(timer));
      void cutShort(res).then(closed.resolve);
    });
    const started = Date.now();
    await expect(provider({ timeoutMs: 300 }).fetchText(`${server.origin("page")}/`)).rejects.toMatchObject({
      code: "timeout",
    });
    const elapsed = Date.now() - started;
    expect(elapsed).toBeGreaterThanOrEqual(250);
    expect(elapsed).toBeLessThan(2000);
    expect(await closed.promise).toBe(true);
  });

  it("times out a socket lookup that never answers", async () => {
    const reader = createSourceTextProvider({
      fetchImpl: createPublicOnlyFetch({ lookup: stalledLookup }),
      resolveHost: PUBLIC_TEST_DNS,
      timeoutMs: 200,
    });
    const settled = await settleWithin(reader.fetchText("http://stalled.source.test:9/"), 2000);
    expect(settled).toMatchObject({ state: "rejected", reason: { code: "timeout" } });
  });

  it("times out a pre-flight DNS check that never answers", async () => {
    let fetched = 0;
    const reader = createSourceTextProvider({
      fetchImpl: async () => {
        fetched += 1;
        return new Response("never");
      },
      resolveHost: () => new Promise<string[]>(() => undefined),
      timeoutMs: 200,
    });
    const settled = await settleWithin(reader.fetchText("https://stalled.example/"), 2000);
    expect(settled).toMatchObject({ state: "rejected", reason: { code: "timeout" } });
    expect(fetched).toBe(0);
  });

  it("stops waiting on a stalled resolver as soon as the operation signal aborts", async () => {
    // dns.lookup cannot be cancelled, so the pre-flight check itself races
    // the signal; the exported helpers honour it without fetchText's race.
    const stalled = () => new Promise<string[]>(() => undefined);
    const controller = new AbortController();
    const check = assertPublicUrl("https://stalled.example/", stalled, controller.signal);
    const send = sendWithRedirects(
      "https://stalled.example/",
      {},
      { fetchImpl: transport(), resolveHost: stalled, signal: controller.signal },
    );
    setTimeout(() => controller.abort(new SourceFetchError("timeout", "test deadline")), 50);
    const operations: Array<Promise<unknown>> = [check, send];
    for (const pending of operations) {
      expect(await settleWithin(pending, 2000)).toMatchObject({
        state: "rejected",
        reason: { code: "timeout", message: "test deadline" },
      });
    }
  });

  it("shares one deadline across a redirect chain", async () => {
    let pageHits = 0;
    const page = await serve((_req, res) => {
      pageHits += 1;
      res.end("<p>arrived</p>");
    });
    // hop0 → hop1 → hop2 → hop3 → page; each hop answers after 150 ms.
    let next = `${page.origin("page")}/`;
    for (let i = 3; i >= 0; i -= 1) {
      const target = next;
      const hop = await serve((_req, res) => {
        setTimeout(() => {
          res.writeHead(302, { location: target });
          res.end();
        }, 150);
      });
      next = `${hop.origin(`hop${i}`)}/`;
    }
    const started = Date.now();
    await expect(provider({ timeoutMs: 400 }).fetchText(next)).rejects.toMatchObject({
      code: "timeout",
    });
    expect(Date.now() - started).toBeLessThan(2000);
    expect(pageHits).toBe(0);
  });

  it("still allows a slow single hop inside the deadline", async () => {
    const page = await serve((_req, res) => res.end("<p>arrived</p>"));
    const hop = await serve((_req, res) => {
      setTimeout(() => {
        res.writeHead(302, { location: `${page.origin("page")}/` });
        res.end();
      }, 150);
    });
    expect((await provider({ timeoutMs: 1000 }).fetchText(`${hop.origin("hop")}/`)).trim()).toBe(
      "arrived",
    );
  });
});

describe("source reads: redirects never leak credentials", () => {
  const credentials = {
    authorization: "Bearer dummy-token",
    cookie: "session=dummy-cookie",
    "proxy-authorization": "Basic ZHVtbXk6ZHVtbXk=",
    "user-agent": "transport-test",
  };

  function deps(fetchImpl = transport()) {
    return { fetchImpl, resolveHost: PUBLIC_TEST_DNS, signal: new AbortController().signal };
  }

  type Seen = Record<string, string | undefined>;
  const seenHeaders = (req: http.IncomingMessage): Seen => ({
    path: req.url,
    method: req.method,
    authorization: req.headers.authorization,
    cookie: req.headers.cookie,
    proxyAuthorization: req.headers["proxy-authorization"],
    userAgent: req.headers["user-agent"],
  });

  it("drops Authorization, Cookie and Proxy-Authorization when the origin changes", async () => {
    const atTarget: Seen[] = [];
    const atStart: Seen[] = [];
    const target = await serve((req, res) => {
      atTarget.push(seenHeaders(req));
      res.end("collected");
    });
    const start = await serve((req, res) => {
      atStart.push(seenHeaders(req));
      res.writeHead(302, { location: `${target.origin("other")}/collect` });
      res.end();
    });
    const res = await sendWithRedirects(`${start.origin("start")}/go`, { headers: credentials }, deps());
    expect(await res.text()).toBe("collected");
    expect(atStart).toEqual([
      expect.objectContaining({
        authorization: "Bearer dummy-token",
        cookie: "session=dummy-cookie",
        proxyAuthorization: "Basic ZHVtbXk6ZHVtbXk=",
      }),
    ]);
    expect(atTarget).toEqual([
      {
        path: "/collect",
        method: "GET",
        authorization: undefined,
        cookie: undefined,
        proxyAuthorization: undefined,
        userAgent: "transport-test",
      },
    ]);
  });

  it("keeps headers on a same-origin redirect", async () => {
    const seen: Seen[] = [];
    const server = await serve((req, res) => {
      seen.push(seenHeaders(req));
      if (req.url === "/old") {
        res.writeHead(301, { location: "/new" });
        res.end();
      } else res.end("moved here");
    });
    const res = await sendWithRedirects(`${server.origin("same")}/old`, { headers: credentials }, deps());
    expect(await res.text()).toBe("moved here");
    expect(seen.map((s) => [s.path, s.authorization, s.cookie])).toEqual([
      ["/old", "Bearer dummy-token", "session=dummy-cookie"],
      ["/new", "Bearer dummy-token", "session=dummy-cookie"],
    ]);
  });

  it("does not restore credentials when a later hop returns to the first origin", async () => {
    const seen: Seen[] = [];
    const first = await serve((req, res) => {
      seen.push(seenHeaders(req));
      if (req.url === "/start") {
        res.writeHead(302, { location: `${second.origin("second")}/bounce` });
        res.end();
      } else res.end("back home");
    });
    const second = await serve((req, res) => {
      seen.push(seenHeaders(req));
      res.writeHead(302, { location: `${first.origin("first")}/home` });
      res.end();
    });
    const res = await sendWithRedirects(`${first.origin("first")}/start`, { headers: credentials }, deps());
    expect(await res.text()).toBe("back home");
    expect(seen.map((s) => [s.path, s.authorization])).toEqual([
      ["/start", "Bearer dummy-token"],
      ["/bounce", undefined],
      ["/home", undefined],
    ]);
  });

  it("refuses an authenticated HTTPS-to-HTTP downgrade before contacting the target", async () => {
    const collector = await serve((_req, res) => res.end("collected"));
    const secure = await serve((_req, res) => {
      res.writeHead(302, { location: `${collector.origin("collector")}/collect` });
      res.end();
    });
    const fetchImpl = fakeTlsFetch(transport(), new Map([["secure.source.test", secure.port]]));
    const error = await sendWithRedirects(
      "https://secure.source.test/start",
      { headers: credentials },
      deps(fetchImpl),
    ).then(
      () => null,
      (e: unknown) => e,
    );
    expect(error).toMatchObject({ code: "redirect_rejected", status: 302 });
    expect((error as Error).message).not.toMatch(/dummy/);
    expect(collector.connections()).toBe(0);
  });

  it("follows an HTTPS-to-HTTP redirect that carries no credentials", async () => {
    const collector = await serve((_req, res) => res.end("public page"));
    const secure = await serve((_req, res) => {
      res.writeHead(302, { location: `${collector.origin("collector")}/page` });
      res.end();
    });
    const fetchImpl = fakeTlsFetch(transport(), new Map([["secure.source.test", secure.port]]));
    const res = await sendWithRedirects("https://secure.source.test/start", {}, deps(fetchImpl));
    expect(await res.text()).toBe("public page");
  });

  it("follows redirects for GET and HEAD only", async () => {
    const methods: string[] = [];
    const target = await serve((req, res) => {
      methods.push(req.method ?? "");
      res.end("target");
    });
    const start = await serve((_req, res) => {
      res.writeHead(307, { location: `${target.origin("target")}/` });
      res.end();
    });
    await expect(
      sendWithRedirects(`${start.origin("start")}/`, { method: "POST", body: "x=1" }, deps()),
    ).rejects.toMatchObject({ code: "redirect_rejected", status: 307 });
    const head = await sendWithRedirects(`${start.origin("start")}/`, { method: "HEAD" }, deps());
    expect(head.status).toBe(200);
    expect(methods).toEqual(["HEAD"]);
  });

  it("follows five redirects and refuses a sixth", async () => {
    let hits = 0;
    const server = await serve((req, res) => {
      hits += 1;
      const url = new URL(req.url ?? "/", "http://x");
      const n = Number(url.searchParams.get("n"));
      const last = Number(url.searchParams.get("last"));
      if (n < last) {
        res.writeHead(302, { location: `/?n=${n + 1}&last=${last}` });
        res.end();
      } else res.end("done");
    });
    const five = await sendWithRedirects(`${server.origin("chain")}/?n=0&last=5`, {}, deps());
    expect(await five.text()).toBe("done");
    expect(hits).toBe(6);
    hits = 0;
    await expect(
      sendWithRedirects(`${server.origin("chain")}/?n=0&last=6`, {}, deps()),
    ).rejects.toMatchObject({ code: "too_many_redirects" });
    expect(hits).toBe(6);
  });

  it("never sends URL userinfo and keeps it and secret query values out of errors", async () => {
    const seen: Seen[] = [];
    const server = await serve((req, res) => {
      seen.push(seenHeaders(req));
      res.writeHead(404);
      res.end("missing");
    });
    const handedToTransport: string[] = [];
    const recording: typeof publicOnlyFetch = (input, init) => {
      handedToTransport.push(input);
      return transport()(input, init);
    };
    const url = `http://user:hunter2@page.source.test:${server.port}/x?token=s3cret&id=42`;
    const error = await provider({ fetchImpl: recording })
      .fetchText(url)
      .then(
        () => null,
        (e: unknown) => e,
      );
    expect(error).toMatchObject({ code: "http_status", status: 404 });
    const message = (error as Error).message;
    expect(message).toContain(`page.source.test:${server.port}/x?id=42`);
    expect(message).not.toMatch(/hunter2|user:|s3cret/);
    // The redirect layer strips userinfo before any transport sees the URL…
    expect(handedToTransport).toEqual([`http://page.source.test:${server.port}/x?token=s3cret&id=42`]);
    // …and the transport itself never turns userinfo into an Authorization header.
    await transport()(url);
    expect(seen).toEqual([
      expect.objectContaining({ authorization: undefined, path: "/x?token=s3cret&id=42" }),
      expect.objectContaining({ authorization: undefined, path: "/x?token=s3cret&id=42" }),
    ]);
  });

  describe("Reddit OAuth", () => {
    const listing = JSON.stringify([
      { data: { children: [{ data: { title: "Thread", selftext: "" } }] } },
      { data: { children: [{ data: { body: "It's the most tedious part of my job." } }] } },
    ]);

    async function redditServers(apiLocation: (collector: TestServer) => string) {
      const seen = { token: [] as Seen[], api: [] as Seen[], collector: [] as Seen[] };
      const token = await serve((req, res) => {
        seen.token.push(seenHeaders(req));
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify({ access_token: "dummy-bearer-token" }));
      });
      const collector = await serve((req, res) => {
        seen.collector.push(seenHeaders(req));
        res.writeHead(200, { "content-type": "application/json" });
        res.end(listing);
      });
      const api = await serve((req, res) => {
        seen.api.push(seenHeaders(req));
        res.writeHead(302, { location: apiLocation(collector) });
        res.end();
      });
      const reader = provider({
        redditClientId: "dummy-id",
        redditClientSecret: "dummy-secret",
        fetchImpl: fakeTlsFetch(
          transport(),
          new Map([
            ["www.reddit.com", token.port],
            ["oauth.reddit.com", api.port],
            ["collector.source.test", collector.port],
          ]),
        ),
      });
      return { seen, collector, reader };
    }

    it("never forwards the bearer to a cross-origin redirect target", async () => {
      const { seen, reader } = await redditServers(() => "https://collector.source.test/collect");
      const text = await reader.fetchText("https://www.reddit.com/r/x/comments/abc/thread/");
      expect(text).toContain("It's the most tedious part of my job.");
      expect(seen.token[0]?.authorization).toMatch(/^Basic /);
      expect(seen.api[0]?.authorization).toBe("bearer dummy-bearer-token");
      expect(seen.collector).toEqual([expect.objectContaining({ authorization: undefined })]);
    });

    it("refuses an HTTPS-to-HTTP hop before the bearer can leave", async () => {
      const { seen, collector, reader } = await redditServers(
        (target) => `${target.origin("collector")}/collect`,
      );
      await expect(
        reader.fetchText("https://www.reddit.com/r/x/comments/abc/thread/"),
      ).rejects.toMatchObject({ code: "redirect_rejected" });
      expect(seen.collector).toEqual([]);
      expect(collector.connections()).toBe(0);
    });
  });
});

/** The pre-WP46 regex chain, kept to prove the linear rewrite is equivalent. */
function regexHtmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<\/(?:tr|li|p|div)\s*>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x([0-9a-f]+);/gi, (m: string, h: string) => {
      const n = parseInt(h, 16);
      return Number.isInteger(n) && n >= 0 && n <= 0x10ffff ? String.fromCodePoint(n) : m;
    })
    .replace(/&#(\d+);/g, (m: string, d: string) => {
      const n = Number(d);
      return Number.isInteger(n) && n >= 0 && n <= 0x10ffff ? String.fromCodePoint(n) : m;
    })
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&");
}

describe("htmlToText stays linear on hostile markup", () => {
  it("strips 2 MiB of unclosed tags in well under a second each", () => {
    // The regex version took ~38 s for 640k characters of "<script ".
    for (const hostile of [
      "<script ".repeat(Math.floor((2 * MiB) / 8)),
      "<style>".repeat(Math.floor((2 * MiB) / 7)),
      "<".repeat(2 * MiB),
    ]) {
      const started = Date.now();
      htmlToText(hostile);
      expect(Date.now() - started).toBeLessThan(1000);
    }
  });

  it("produces exactly what the regex chain produced, on random markup", () => {
    const tokens = [
      "<", ">", "/", " ", "\n", "a", "Zé", "<>", "x>y", "<b>", "</b>", "<p>", "</p>", "</p >",
      "</div>", "</li>", "</tr\n>", "<br>", "<br/>", "<BR />", "<script>", "<script src=x>",
      "<SCRIPT>", "</script>", "</SCRIPT>", "</script >", "<style>", "</style>", "</STYLE>",
      "&amp;", "&amp;lt;", "&lt;", "&gt;", "&quot;", "&nbsp;", "&#x2F;", "&#39;", "&#99999999;",
    ];
    // Deterministic generator, so a failure is reproducible.
    let seed = 0x5eed;
    const random = () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed / 0x80000000;
    };
    for (let i = 0; i < 5000; i += 1) {
      const length = Math.floor(random() * 30);
      let html = "";
      for (let j = 0; j < length; j += 1) html += tokens[Math.floor(random() * tokens.length)];
      expect(htmlToText(html), JSON.stringify(html)).toBe(regexHtmlToText(html));
    }
  });
});

describe("redaction", () => {
  it("keeps only page-identifying query values and drops userinfo and fragments", () => {
    expect(redactUrl("https://user:pw@news.ycombinator.com/item?id=27515468#c1")).toBe(
      "https://news.ycombinator.com/item?id=27515468",
    );
    expect(redactUrl("https://forum.example/viewtopic.php?t=123&sid=abcdef")).toBe(
      "https://forum.example/viewtopic.php?t=123&…",
    );
    expect(redactUrl("https://cdn.example/file?X-Amz-Signature=abc&token=xyz")).toBe(
      "https://cdn.example/file?…",
    );
    expect(redactUrl("file:///Users/someone/.ssh/id_rsa")).toBe("file:[redacted]");
    expect(redactUrl("not a url")).toBe("[invalid URL]");
  });

  it("masks URLs, auth values and local paths inside free text", () => {
    const text = redactText(
      "GET https://u:p@x.example/a?key=v failed: Bearer abc.def-123 at /Users/someone/app/x.ts",
    );
    expect(text).toBe("GET https://x.example/a?… failed: Bearer [redacted] at [path]");
    expect(redactText("x".repeat(500), 50)).toHaveLength(50);
  });

  it("redacts credential-like path segments and matrix parameters", () => {
    for (const [url, redacted] of [
      // A webhook secret: one long random run.
      [
        "https://hooks.example.com/services/T0A1B2C3D/B4E5F6G7H/aB3dE5fG7hJ9kL1mN3pQ5rS7",
        "https://hooks.example.com/services/T0A1B2C3D/B4E5F6G7H/…",
      ],
      // A capability document id and a hex token, mid-path.
      [
        "https://docs.example.com/document/d/1AbC2dEf3GhI4jKl5MnO6pQr7StU8vWx9YzA0bCd/edit",
        "https://docs.example.com/document/d/…/edit",
      ],
      [
        "https://cdn.example/download/3f786850e387550fdab836ed7e6dc881de23001b/report.pdf",
        "https://cdn.example/download/…/report.pdf",
      ],
      // Separators inside a random token do not make it a slug.
      ["https://x.example/s/aB3dE-5fG7hJ9kL1_mN3pQ5rS7tU9vW", "https://x.example/s/…"],
      ["https://x.example/gh/ghp_Ab12Cd34Ef56Gh78Ij90Kl12Mn34Op56Qr78", "https://x.example/gh/…"],
      // Percent-encoded base64 is checked decoded.
      ["https://x.example/t/dG9rZW4%2Bd2l0aCtwbHVz%2FYW5kL3NsYXNoZXM", "https://x.example/t/…"],
      // Whatever follows a credential-like name, however short.
      ["https://api.example/v1/token/abc123/refresh", "https://api.example/v1/token/…/refresh"],
      ["https://api.example/api_key/k1", "https://api.example/api_key/…"],
      ["https://x.example/reset/Session-ID/42", "https://x.example/reset/Session-ID/…"],
      // Matrix parameters and name=value segments keep only the name.
      ["https://host.example/a;jsessionid=SECRET7", "https://host.example/a;…"],
      ["https://host.example/files/sig=c2VjcmV0/x", "https://host.example/files/sig=…/x"],
    ] as const) {
      expect(redactUrl(url), url).toBe(redacted);
    }
  });

  it("keeps ordinary slugs, numeric ids and HN item ids readable", () => {
    for (const url of [
      "https://news.ycombinator.com/item?id=27515468",
      "https://www.reddit.com/r/shopify/comments/1n2jsoc/meta_ad_landing_page_poor_conversion_rate/",
      "https://tianpan.co/forum/t/ai-code-review-bottleneck-our-pr-queue-grew-91-and-nobody-knows-how-to-fix-it/2001",
      "https://www.industryresearch.biz/market-reports/request-for-proposal-rfp-software-market-109348",
      "https://en.wikipedia.example/wiki/List_of_Software_as_a_Service_companies_in_the_United_States",
      "https://medium.example/@writer/why-we-rewrote-our-billing-system-1a2b3c4d5e6f",
      "https://x.example/status/1234567890123456789",
      "https://x.example/best-SaaS-tools-for-startups-in-2024/",
      "https://x.example/report_%28v2%29",
      "https://x.example/",
    ]) {
      expect(redactUrl(url), url).toBe(url);
    }
  });

  it("finds URLs in text exactly as the old regex did, on random input", () => {
    const tokens = [
      "https://", "http://", "a://", "Z.y-1+q://", "1abc://", "-x://", "://", ":", "/", "//", " ", "\t",
      "\n", "\u00a0", "\u2028", '"', "'", "<", ">", "(", ")", "=", ",", ";", "a", "Z", "1", "_", "-",
      ".", "+", "é", "user:pw@", "host.example", "?token=s3cret", "&id=7", "#frag", "Bearer ", "basic ",
      "/Users/me/x", "C:\\x", "/home/u/.ssh", "%2F", "\u{1F600}",
    ];
    // Deterministic generator, so a failure is reproducible.
    let seed = 0x7ed;
    const random = () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed / 0x80000000;
    };
    for (let i = 0; i < 5000; i += 1) {
      const length = Math.floor(random() * 24);
      let text = "";
      for (let j = 0; j < length; j += 1) text += tokens[Math.floor(random() * tokens.length)];
      expect(redactText(text, 10_000), JSON.stringify(text)).toBe(regexRedactText(text, 10_000));
    }
  });

  it("stays linear on hostile text: 2 MiB redacts in well under the bound each", () => {
    // The URL regex rescanned every scheme-like run from each word boundary:
    // 64k characters of "a." took 1.8 s, and the cost grew with the square
    // (2 MiB would take about half an hour). Linear work takes milliseconds
    // here, ~200 ms for the URL-dense units; the bounds only separate the two.
    const units = [
      "a.", "a:", "a-1+", "1://", "a://", "a://b ", "https://h/a/b?token=1 ", "x?a=1&", "bearer \t",
      "/Users/x ", "%",
    ];
    for (const unit of units) {
      for (const size of [64 * 1024, 2 * MiB]) {
        const text = unit.repeat(Math.ceil(size / unit.length)).slice(0, size);
        const started = performance.now();
        redactText(text, 200);
        const elapsed = performance.now() - started;
        expect(elapsed, `${JSON.stringify(unit)} × ${size}`).toBeLessThan(size === 2 * MiB ? 3000 : 250);
      }
    }
  });
});

/** The pre-fix URL matcher (quadratic), kept to prove the linear scan is equivalent. */
function regexRedactText(text: string, maxChars: number): string {
  const clean = text
    .replace(/\b[a-z][a-z0-9+.-]*:\/\/[^\s"'<>]+/gi, (match) => redactUrl(match))
    .replace(/\b(bearer|basic)\s+[^\s,;"']+/gi, "$1 [redacted]")
    .replace(/(^|[\s("'=])(?:\/(?:Users|home|private|tmp|var|opt|root)\/|[A-Za-z]:\\)[^\s"'<>)]*/g, "$1[path]")
    .replace(/\s+/g, " ")
    .trim();
  return clean.length <= maxChars ? clean : `${clean.slice(0, maxChars - 1)}…`;
}

describe("child-process smoke", () => {
  type ChildResult = { code: number | null; signal: string | null; stdout: string; stderr: string };

  function runNode(args: string[], timeoutMs: number): Promise<ChildResult & { timedOut: boolean }> {
    return new Promise((resolve) => {
      const child = spawn(process.execPath, args, { stdio: ["ignore", "pipe", "pipe"] });
      let stdout = "";
      let stderr = "";
      let timedOut = false;
      child.stdout.setEncoding("utf8").on("data", (d: string) => {
        stdout += d;
      });
      child.stderr.setEncoding("utf8").on("data", (d: string) => {
        stderr += d;
      });
      const timer = setTimeout(() => {
        timedOut = true;
        child.kill("SIGKILL");
      }, timeoutMs);
      child.on("close", (code, signal) => {
        clearTimeout(timer);
        resolve({ code, signal, stdout, stderr, timedOut });
      });
    });
  }

  it(
    "exits 0 by itself after reading an HTTP 205 under node --experimental-strip-types",
    async () => {
      const script = fileURLToPath(new URL("./__smoke__/http205.ts", import.meta.url));
      const result = await runNode(["--experimental-strip-types", script], 20_000);
      expect(
        { code: result.code, signal: result.signal, timedOut: result.timedOut, stdout: result.stdout.trim() },
        result.stderr,
      ).toEqual({ code: 0, signal: null, timedOut: false, stdout: '{"outcome":"no_content"}' });
    },
    30_000,
  );
});
