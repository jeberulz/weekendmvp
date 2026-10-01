/**
 * Test-only network harness for the source transport (WP46-S1): local
 * node:http servers on 127.0.0.1, a socket lookup that maps fake public
 * hostnames (`*.source.test`) to them, and a fake TLS shim.
 *
 * Production code never imports this file. The real transport keeps
 * `publicOnlyLookup`; tests swap the lookup through the
 * `createPublicOnlyFetch({ lookup })` seam instead of weakening it.
 */

import http from "node:http";
import net from "node:net";
import type { LookupFunction } from "node:net";

import type { FetchLike } from "../sourceText.ts";

export const TEST_DOMAIN = "source.test";

/** A public-looking answer for `assertPublicUrl`'s pre-flight DNS check. */
export const PUBLIC_TEST_DNS = async (): Promise<string[]> => ["93.184.215.14"];

/** Maps `<name>.source.test` to 127.0.0.1; any other name fails as unknown. */
export const loopbackLookup: LookupFunction = (hostname, options, callback) => {
  setImmediate(() => {
    if (!hostname.endsWith(`.${TEST_DOMAIN}`)) {
      callback(
        Object.assign(new Error(`test lookup: unknown host ${hostname}`), { code: "ENOTFOUND" }),
        "",
        0,
      );
    } else if (options.all) {
      callback(null, [{ address: "127.0.0.1", family: 4 }]);
    } else {
      callback(null, "127.0.0.1", 4);
    }
  });
};

/** A resolver that never answers, like a stalled DNS server. */
export const stalledLookup: LookupFunction = () => undefined;

export type TestServer = {
  readonly port: number;
  /** `http://<name>.source.test:<port>` */
  origin(name: string): string;
  /** TCP connections accepted so far. */
  connections(): number;
  close(): Promise<void>;
};

async function listen(server: net.Server): Promise<TestServer> {
  const sockets = new Set<net.Socket>();
  let accepted = 0;
  server.on("connection", (socket: net.Socket) => {
    accepted += 1;
    sockets.add(socket);
    socket.on("close", () => sockets.delete(socket));
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (address === null || typeof address === "string") {
    throw new Error("test server has no TCP port");
  }
  const { port } = address;
  return {
    port,
    origin: (name) => `http://${name}.${TEST_DOMAIN}:${port}`,
    connections: () => accepted,
    close: () =>
      new Promise<void>((resolve) => {
        for (const socket of sockets) socket.destroy();
        server.close(() => resolve());
      }),
  };
}

export function startServer(handler: http.RequestListener): Promise<TestServer> {
  return listen(http.createServer(handler));
}

/** A raw TCP server, for responses node:http will not produce (bad status, lying headers). */
export function startRawServer(onRequest: (socket: net.Socket) => void): Promise<TestServer> {
  return listen(
    net.createServer((socket) => {
      // The client resets connections mid-write on purpose in several tests.
      socket.on("error", () => undefined);
      socket.once("data", () => onRequest(socket));
    }),
  );
}

/**
 * Pretend TLS: `https://<host>/…` for a mapped host goes out as plain http to
 * that host's local server (as `<host>.tls.source.test`), while the redirect
 * logic still sees the https URL. Real TLS servers would need committed test
 * keys; the credential rules under test only read the URL scheme and origin.
 */
export function fakeTlsFetch(inner: FetchLike, ports: ReadonlyMap<string, number>): FetchLike {
  return (input, init) => {
    const url = new URL(input);
    const port = ports.get(url.hostname);
    if (url.protocol !== "https:" || port === undefined) return inner(input, init);
    return inner(
      `http://${url.hostname}.tls.${TEST_DOMAIN}:${port}${url.pathname}${url.search}`,
      init,
    );
  };
}

export type Deferred<T> = { promise: Promise<T>; resolve(value: T): void };

export function deferred<T>(): Deferred<T> {
  let settle: (value: T) => void = () => undefined;
  const promise = new Promise<T>((resolve) => {
    settle = resolve;
  });
  return { promise, resolve: (value) => settle(value) };
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export type Settled<T> =
  | { state: "fulfilled"; value: T }
  | { state: "rejected"; reason: unknown }
  | { state: "pending" };

/** How `promise` stands after at most `ms`; "pending" means it hung. */
export async function settleWithin<T>(promise: Promise<T>, ms: number): Promise<Settled<T>> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const hung = new Promise<Settled<T>>((resolve) => {
    timer = setTimeout(() => resolve({ state: "pending" }), ms);
  });
  try {
    return await Promise.race([
      promise.then(
        (value): Settled<T> => ({ state: "fulfilled", value }),
        (reason: unknown): Settled<T> => ({ state: "rejected", reason }),
      ),
      hung,
    ]);
  } finally {
    clearTimeout(timer);
  }
}

/** Uncaught exceptions and unhandled rejections raised while capturing. */
export function captureProcessErrors(): { stop(): string[] } {
  const seen: string[] = [];
  const record = (error: unknown) => {
    seen.push(error instanceof Error ? `${error.name}: ${error.message}` : String(error));
  };
  process.on("uncaughtException", record);
  process.on("unhandledRejection", record);
  return {
    stop: () => {
      process.off("uncaughtException", record);
      process.off("unhandledRejection", record);
      return seen;
    },
  };
}
