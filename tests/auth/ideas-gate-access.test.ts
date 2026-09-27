import { afterEach, describe, expect, test, vi } from "vitest";
import {
  hasImmediateGateAccess,
  resolveAccess,
  STORAGE_KEY,
} from "../../components/ideas/gate-access";
import { SESSION_HINT_COOKIE } from "../../lib/auth-session-cookie";
import gateAccessSource from "../../components/ideas/gate-access.ts?raw";
import emailGateSource from "../../components/ideas/EmailGate.tsx?raw";
import ideaPageSource from "../../app/ideas/[slug]/page.tsx?raw";
import weeklyPickSource from "../../components/platform/home/WeeklyPick.tsx?raw";
import exploreCardSource from "../../components/platform/explore/IdeaCard.tsx?raw";
import planDetailSource from "../../components/platform/builds/PlanDetail.tsx?raw";

function stubBrowser(opts: {
  hostname: string;
  cookie: string;
  storedEmail?: string | null;
  search?: string;
}) {
  const store = new Map<string, string>();
  if (opts.storedEmail) store.set(STORAGE_KEY, opts.storedEmail);

  vi.stubGlobal("localStorage", {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
  });
  vi.stubGlobal("document", { cookie: opts.cookie });
  vi.stubGlobal("window", {
    location: {
      hostname: opts.hostname,
      search: opts.search ?? "",
      href: `https://${opts.hostname}/ideas/example${opts.search ?? ""}`,
      pathname: "/ideas/example",
      hash: "",
    },
    history: { replaceState: () => {} },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("idea email gate — signed-in members skip lead capture", () => {
  test("a WP44 session hint unlocks without ideas_email localStorage", () => {
    expect(
      hasImmediateGateAccess({
        storedEmail: null,
        cookieSource: `${SESSION_HINT_COOKIE}=1`,
        hostname: "www.weekendmvp.app",
      }),
    ).toBe(true);
  });

  test("anonymous visitors on production stay locked without a stored email", () => {
    expect(
      hasImmediateGateAccess({
        storedEmail: null,
        cookieSource: "unrelated=1",
        hostname: "www.weekendmvp.app",
      }),
    ).toBe(false);
  });

  test("stored ideas_email still unlocks when there is no session hint", () => {
    expect(
      hasImmediateGateAccess({
        storedEmail: "reader@example.com",
        cookieSource: "",
        hostname: "www.weekendmvp.app",
      }),
    ).toBe(true);
  });

  test("localhost keeps the existing dev bypass for anonymous browsers", () => {
    expect(
      hasImmediateGateAccess({
        storedEmail: null,
        cookieSource: "",
        hostname: "localhost",
      }),
    ).toBe(true);
    expect(
      hasImmediateGateAccess({
        storedEmail: null,
        cookieSource: "",
        hostname: "127.0.0.1",
      }),
    ).toBe(true);
  });

  test("a forged-looking hint value other than =1 does not unlock", () => {
    expect(
      hasImmediateGateAccess({
        storedEmail: null,
        cookieSource: `${SESSION_HINT_COOKIE}=0`,
        hostname: "www.weekendmvp.app",
      }),
    ).toBe(false);
  });

  test("resolveAccess unlocks a signed-in member on the public idea host", async () => {
    stubBrowser({
      hostname: "www.weekendmvp.app",
      cookie: `${SESSION_HINT_COOKIE}=1`,
      storedEmail: null,
    });
    await expect(resolveAccess()).resolves.toBe(true);
  });

  test("resolveAccess keeps anonymous visitors locked on the public idea host", async () => {
    stubBrowser({
      hostname: "www.weekendmvp.app",
      cookie: "",
      storedEmail: null,
    });
    await expect(resolveAccess()).resolves.toBe(false);
  });

  test("EmailGate and shared entry points stay on canonical /ideas/{slug}", () => {
    expect(gateAccessSource).toContain('from "@/lib/auth-session-cookie"');
    expect(gateAccessSource).toContain("hasSessionHintCookie");
    expect(gateAccessSource).toContain("hasImmediateGateAccess");
    expect(gateAccessSource).toContain("cookieSource: document.cookie");
    expect(emailGateSource).toContain("resolveAccess()");
    expect(emailGateSource).toContain("session hint");
    expect(ideaPageSource).toContain("<EmailGate");
    // Dashboard research CTAs stay on the public canonical URL — no second corpus.
    expect(weeklyPickSource).toContain("href={`/ideas/${idea.slug}`}");
    expect(weeklyPickSource).toContain("Read the research");
    expect(exploreCardSource).toContain("href={`/ideas/${idea.slug}`}");
    expect(planDetailSource).toContain("href={`/ideas/${idea.slug}`}");
    expect(planDetailSource).toContain("Read the research");
  });
});
