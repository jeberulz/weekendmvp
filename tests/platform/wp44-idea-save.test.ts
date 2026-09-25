/// <reference types="vite/client" />

import { describe, expect, test } from "vitest";
import ideaPageSource from "../../app/ideas/[slug]/page.tsx?raw";
import routeSource from "../../app/api/platform/saved/route.ts?raw";
import islandSource from "../../components/ideas/SaveIdeaButton.tsx?raw";
import runnerSource from "../../components/platform/shell/PendingSaveRunner.tsx?raw";
import shellSource from "../../components/platform/shell/WorkspaceShell.tsx?raw";
import { isSameOriginWrite, parseSaveBody, parseSlugParam } from "../../app/api/platform/saved/_server";
import { safePlatformReturn } from "../../lib/auth-return";
import {
  PENDING_SAVE_KEY,
  PENDING_SAVE_TTL_MS,
  isIdeaSlug,
  signupForPendingSave,
  stashPendingSave,
  takePendingSave,
} from "../../lib/pending-save";

function memoryStorage() {
  const map = new Map<string, string>();
  return {
    map,
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => void map.set(key, value),
    removeItem: (key: string) => void map.delete(key),
  };
}

const NOW = 1_800_000_000_000;

describe("WP44-S6 pending save", () => {
  test("round-trips one idea and clears it after reading", () => {
    const storage = memoryStorage();
    stashPendingSave(storage, { slug: "ai-code-reviewer", title: "AI Code Reviewer", at: NOW });
    expect(takePendingSave(storage, NOW + 1000)).toEqual({
      slug: "ai-code-reviewer",
      title: "AI Code Reviewer",
      at: NOW,
    });
    expect(storage.map.has(PENDING_SAVE_KEY)).toBe(false);
    expect(takePendingSave(storage, NOW + 2000)).toBeNull();
  });

  test("drops stale, future-dated, malformed and unsafe entries", () => {
    const storage = memoryStorage();
    stashPendingSave(storage, { slug: "old", title: "Old", at: NOW });
    expect(takePendingSave(storage, NOW + PENDING_SAVE_TTL_MS + 1)).toBeNull();

    stashPendingSave(storage, { slug: "future", title: "Future", at: NOW + 3_600_000 });
    expect(takePendingSave(storage, NOW)).toBeNull();

    storage.setItem(PENDING_SAVE_KEY, "{not json");
    expect(takePendingSave(storage, NOW)).toBeNull();

    storage.setItem(PENDING_SAVE_KEY, JSON.stringify({ slug: "../dashboard", title: "x", at: NOW }));
    expect(takePendingSave(storage, NOW)).toBeNull();

    stashPendingSave(storage, { slug: "Bad Slug", title: "x", at: NOW });
    expect(storage.map.has(PENDING_SAVE_KEY)).toBe(false);
  });

  test("survives blocked storage", () => {
    const blocked = {
      getItem: () => {
        throw new Error("SecurityError");
      },
      setItem: () => {
        throw new Error("SecurityError");
      },
      removeItem: () => {
        throw new Error("SecurityError");
      },
    };
    expect(() => stashPendingSave(blocked, { slug: "a", title: "A", at: NOW })).not.toThrow();
    expect(takePendingSave(blocked, NOW)).toBeNull();
  });

  test("sign-up returns to Saved, inside the existing auth allowlist", () => {
    expect(signupForPendingSave()).toBe("/signup?returnTo=%2Fdashboard%2Fsaved");
    expect(safePlatformReturn("/dashboard/saved")).toBe("/dashboard/saved");
  });

  test("slugs are lowercase words and hyphens only", () => {
    expect(isIdeaSlug("ai-code-reviewer")).toBe(true);
    for (const bad of ["", "-lead", "UPPER", "a/b", "a b", "a".repeat(121), null, 3]) {
      expect(isIdeaSlug(bad)).toBe(false);
    }
  });
});

describe("WP44-S6 Save endpoint checks", () => {
  const post = (headers: Record<string, string>) =>
    new Request("https://weekendmvp.app/api/platform/saved", { method: "POST", headers });

  test("writes need a same-origin Origin header", () => {
    expect(isSameOriginWrite(post({ origin: "https://weekendmvp.app" }))).toBe(true);
    expect(
      isSameOriginWrite(post({ origin: "https://weekendmvp.app", "sec-fetch-site": "same-origin" })),
    ).toBe(true);
    expect(isSameOriginWrite(post({}))).toBe(false);
    expect(isSameOriginWrite(post({ origin: "https://evil.example" }))).toBe(false);
    expect(
      isSameOriginWrite(post({ origin: "https://weekendmvp.app", "sec-fetch-site": "cross-site" })),
    ).toBe(false);
  });

  test("reads only a valid slug and a boolean", () => {
    expect(parseSlugParam("https://weekendmvp.app/api/platform/saved?slug=ai-code-reviewer")).toBe(
      "ai-code-reviewer",
    );
    expect(parseSlugParam("https://weekendmvp.app/api/platform/saved?slug=../x")).toBeNull();
    expect(parseSlugParam("https://weekendmvp.app/api/platform/saved")).toBeNull();
    expect(parseSaveBody({ slug: "ai-code-reviewer", saved: true })).toEqual({
      slug: "ai-code-reviewer",
      saved: true,
    });
    expect(parseSaveBody({ slug: "ai-code-reviewer", saved: "yes" })).toBeNull();
    expect(parseSaveBody({ slug: "Nope!", saved: true })).toBeNull();
    expect(parseSaveBody([])).toBeNull();
    expect(parseSaveBody(null)).toBeNull();
  });

  test("the route checks the origin before it reads the body or the session", () => {
    const post = routeSource.slice(routeSource.indexOf("export async function POST"));
    expect(post.indexOf("isSameOriginWrite(request)")).toBeLessThan(post.indexOf("request.json()"));
    expect(post.indexOf("request.json()")).toBeLessThan(post.indexOf("convexAuthNextjsToken()"));
    expect(routeSource).toContain("headers: NO_STORE");
    expect(routeSource).not.toMatch(/userId|ownerId/);
  });
});

describe("WP44-S6 idea page", () => {
  test("the page stays static: no cookies or headers read on the server", () => {
    expect(ideaPageSource).not.toMatch(/from "next\/headers"/);
    expect(ideaPageSource).not.toContain("connection()");
    expect(ideaPageSource).not.toContain("AuthPlatformProvider");
  });

  test("mounts the Save island in a reserved slot and parks the preview CTA (R5)", () => {
    expect(ideaPageSource).toContain("<SaveIdeaButton slug={slug} title={title} />");
    expect(ideaPageSource).toContain('className="mt-6 flex min-h-10');
    expect(ideaPageSource).not.toMatch(/<PreviewIdeaCta\b/);
    expect(ideaPageSource).not.toContain('from "@/components/ideas/PreviewIdeaCta"');
  });

  test("keeps the canonical tag and JSON-LD", () => {
    expect(ideaPageSource).toMatch(/alternates:\s*\{ canonical: `?\/ideas\/\$\{slug\}`? \}/);
    expect(ideaPageSource).toContain("<JsonLd schema={schema} />");
  });

  test("the island renders nothing on the server or the first paint", () => {
    expect(islandSource).toContain('"use client"');
    expect(islandSource).toMatch(/function readServerHint\(\) \{\s*return null;\s*\}/);
    expect(islandSource).toContain("if (hint === null) return null;");
    expect(islandSource).toContain("hasSessionHintCookie(document.cookie)");
    expect(islandSource).not.toMatch(/document\.cookie\s*=/);
  });

  test("signed-in readers toggle, everyone else signs up first", () => {
    expect(islandSource).toContain("aria-pressed={pressed}");
    expect(islandSource).toContain('<span role="status" className="sr-only">');
    expect(islandSource).toContain("signupForPendingSave()");
    expect(islandSource).toContain("stashPendingSave(window.localStorage");
    expect(islandSource).toContain('source: "idea_page"');
  });

  test("the dashboard finishes a pending save behind the Convex gate", () => {
    expect(shellSource).toMatch(/<WhenConvexReady>\s*<PendingSaveRunner \/>\s*<\/WhenConvexReady>/);
    expect(runnerSource).toContain("takePendingSave(window.localStorage, Date.now())");
    expect(runnerSource).toContain('<div aria-live="polite">');
    expect(runnerSource).toContain("Back to the idea");
  });
});
