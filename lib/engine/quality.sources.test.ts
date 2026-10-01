/**
 * Source fetch safety for the idea engine: entity decoding, whole-word quote
 * matching and the SSRF guards. Split mechanically from quality.test.ts
 * (WP46-S3). Part 2 changed one test: quoteAppearsIn was removed, so
 * "matches quote fragments on whole words only" became "matches quote spans
 * on whole words only and never joins fragments" on the contract matcher
 * (findContiguousSpan): whole-word matching is unchanged, and a quote with an
 * internal ellipsis is now always rejected (contract §5) where the old helper
 * accepted ordered fragments.
 */

import { describe, expect, it } from "vitest";

import { findContiguousSpan } from "./evidence/quote.ts";
import {
  createSourceTextProvider,
  htmlToText,
  isBlockedAddress,
  publicOnlyFetch,
} from "./providers/sourceText.ts";

/** Stub resolver: every host is public (keeps tests off the network). */
const PUBLIC_DNS = async () => ["93.184.215.14"];

describe("source fetch safety", () => {
  it("keeps out-of-range numeric entities as text", () => {
    expect(htmlToText("a &#99999999; b &#x110000; c")).toBe("a &#99999999; b &#x110000; c");
  });

  it("matches quote spans on whole words only and never joins fragments", () => {
    const page = "We concatenate the results before review every single week.";
    expect(findContiguousSpan("cat the results before review", page).ok).toBe(false);
    expect(findContiguousSpan("the results before review", page).ok).toBe(true);
    // An internal ellipsis would join separate fragments: always rejected.
    expect(findContiguousSpan("the results before review … monthly", page)).toEqual({ ok: false, reason: "internal_ellipsis" });
    expect(findContiguousSpan("the results before review … week", page)).toEqual({ ok: false, reason: "internal_ellipsis" });
  });

  it("flags loopback, private, link-local and metadata addresses", () => {
    for (const ip of ["127.0.0.1", "10.1.2.3", "172.20.0.1", "192.168.1.1", "169.254.169.254", "0.0.0.0", "::1", "fd00::1", "fe80::1", "::ffff:127.0.0.1"]) {
      expect(isBlockedAddress(ip), ip).toBe(true);
    }
    // IPv4-mapped / compatible / NAT64 forms, dotted and hex (Node's URL
    // parser turns [::ffff:127.0.0.1] into [::ffff:7f00:1]).
    for (const ip of ["::ffff:7f00:1", "::ffff:c0a8:101", "::ffff:a9fe:a9fe", "::7f00:1", "0:0:0:0:0:ffff:127.0.0.1", "64:ff9b::a00:1"]) {
      expect(isBlockedAddress(ip), ip).toBe(true);
    }
    for (const ip of ["93.184.215.14", "151.101.1.140", "2606:4700::6810:84e5", "::ffff:5db8:d70e", "64:ff9b::5db8:d70e"]) {
      expect(isBlockedAddress(ip), ip).toBe(false);
    }
  });

  it("refuses a citation that resolves to a private address", async () => {
    let fetched = 0;
    const provider = createSourceTextProvider({
      resolveHost: async () => ["10.0.0.5"],
      fetchImpl: async () => {
        fetched += 1;
        return new Response("secret", { status: 200 });
      },
    });
    await expect(provider.fetchText("https://intranet.example/page")).rejects.toThrow(/non-public/);
    await expect(provider.fetchText("http://169.254.169.254/latest/meta-data/")).rejects.toThrow(/non-public/);
    // Both spellings of an IPv4-mapped loopback literal, after URL normalization.
    await expect(provider.fetchText("http://[::ffff:127.0.0.1]/")).rejects.toThrow(/non-public/);
    await expect(provider.fetchText("http://[::ffff:7f00:1]/")).rejects.toThrow(/non-public/);
    expect(fetched).toBe(0);
  });

  it("refuses a redirect to a private address", async () => {
    const calls: string[] = [];
    const provider = createSourceTextProvider({
      resolveHost: PUBLIC_DNS,
      fetchImpl: async (url) => {
        calls.push(url);
        return new Response(null, {
          status: 302,
          headers: { location: "http://127.0.0.1:8080/admin" },
        });
      },
    });
    await expect(provider.fetchText("https://example.com/post")).rejects.toThrow(/non-public/);
    expect(calls).toEqual(["https://example.com/post"]);
  });

  it("follows a redirect to another public page", async () => {
    const provider = createSourceTextProvider({
      resolveHost: PUBLIC_DNS,
      fetchImpl: async (url) =>
        url.endsWith("/old")
          ? new Response(null, { status: 301, headers: { location: "/new" } })
          : new Response("<p>moved here</p>", { status: 200 }),
    });
    expect((await provider.fetchText("https://example.com/old")).trim()).toBe("moved here");
  });

  it("checks redirects on the Reddit path too", async () => {
    const calls: string[] = [];
    const provider = createSourceTextProvider({
      redditClientId: "",
      redditClientSecret: "",
      resolveHost: async (host) => (host === "evil.example" ? ["10.0.0.9"] : ["151.101.1.140"]),
      fetchImpl: async (url) => {
        calls.push(url);
        return new Response(null, {
          status: 301,
          headers: { location: "https://evil.example/steal" },
        });
      },
    });
    await expect(
      provider.fetchText("https://www.reddit.com/r/x/comments/abc/y/"),
    ).rejects.toThrow(/non-public/);
    expect(calls).toHaveLength(1);
  });

  it("refuses to connect when the host resolves to a private address", async () => {
    const { createServer } = await import("node:http");
    const server = createServer((_req, res) => res.end("internal"));
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
    const { port } = server.address() as { port: number };
    try {
      // "localhost" resolves to loopback at connect time, as a rebinding host would.
      await expect(publicOnlyFetch(`http://localhost:${port}/`)).rejects.toThrow(/non-public/);
    } finally {
      server.close();
    }
  });
});
