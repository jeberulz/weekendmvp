/// <reference types="vite/client" />

import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { FunctionReference, FunctionReturnType } from "convex/server";
import { afterEach, describe, expect, test, vi } from "vitest";
import type { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { LiveBuilds, formatSessionTime } from "../../components/platform/live/LiveBuilds";
import { LIVE_NAV, PRIMARY_NAV, isWorkspaceNavCurrent } from "../../components/platform/shell/workspace-current";
import pageSource from "../../app/dashboard/live/page.tsx?raw";
import shellSource from "../../components/platform/shell/WorkspaceShell.tsx?raw";
import liveSource from "../../components/platform/live/LiveBuilds.tsx?raw";
import sheetSource from "../../components/platform/plan/UpgradeSheet.tsx?raw";
import operatorSource from "../../convex/platform/liveBuildsOperator.ts?raw";

// WP63-S8. The live builds page, rendered from what the member query returns.

type Listing = FunctionReturnType<typeof api.platform.liveBuilds.list>;
type Session = Listing["upcoming"][number];

const convex = vi.hoisted(() => ({ listing: undefined as unknown }));
vi.mock("convex/react", async () => {
  const { getFunctionName } = await import("convex/server");
  return {
    useQuery: (query: FunctionReference<"query">) =>
      getFunctionName(query) === "platform/liveBuilds:list" ? convex.listing : undefined,
    useConvex: () => ({ query: vi.fn() }),
    useConvexAuth: () => ({ isAuthenticated: true, isLoading: false }),
  };
});
vi.mock("../../components/platform/client-gates", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../components/platform/client-gates")>()),
  WhenConvexReady: ({ children }: { children: ReactNode }) => children,
}));
vi.mock("../../components/platform/plan/flag", () => ({ BUILDERS_HUB_UI: true, UPGRADE_HREF: "/dashboard/billing#builders-hub" }));
vi.mock("next/font/google", () => ({
  Newsreader: () => ({ className: "font-serif", variable: "--font-serif", style: { fontFamily: "serif" } }),
}));

const START = Date.UTC(2026, 10, 4, 17);
const JOIN = "https://meet.example.test/live-1";
const REPLAY = "https://video.example.test/replay-1";

function session(extra: Partial<Session>): Session {
  return {
    id: "live1" as Id<"live_builds">,
    title: "Build a waitlist app live",
    summary: "One idea, ninety minutes.",
    startsAt: START,
    durationMin: 90,
    status: "scheduled",
    hasJoinLink: false,
    hasReplay: false,
    joinUrl: null,
    replayUrl: null,
    ...extra,
  };
}

function render(listing: Listing) {
  convex.listing = listing;
  return renderToStaticMarkup(<LiveBuilds />);
}

afterEach(() => {
  convex.listing = undefined;
  vi.unstubAllEnvs();
});

describe("WP63-S8 the page", () => {
  test("an empty schedule says so", () => {
    const html = render({ entitled: true, upcoming: [], past: [] });
    expect(html).toContain("No live build is scheduled yet. The next one will show here.");
    expect(html).not.toContain("Replays");
  });

  test("times show in the member's zone, with the zone named and a machine-readable time", () => {
    expect(formatSessionTime(START)).toMatch(/^Wednesday, November 4, 2026 at \d{1,2}:00 [AP]M [A-Z]{2,5}([+-]\d{1,2})?$/);
    const html = render({ entitled: true, upcoming: [session({})], past: [] });
    expect(html).toContain(`<time dateTime="${new Date(START).toISOString()}">`);
    expect(html).toContain("</time> · 90 minutes</p>");
  });

  test("a Builder's Hub member gets the join link while open, in a new tab, and the replay after", () => {
    const html = render({
      entitled: true,
      upcoming: [session({ status: "open", hasJoinLink: true, joinUrl: JOIN }), session({ id: "live2" as Id<"live_builds"> })],
      past: [session({ id: "live3" as Id<"live_builds">, status: "ended", hasReplay: true, replayUrl: REPLAY })],
    });
    expect(html).toMatch(new RegExp(`<a href="${JOIN}" target="_blank" rel="noopener noreferrer"[^>]*>Join the live build`));
    expect(html).toMatch(new RegExp(`<a href="${REPLAY}" target="_blank" rel="noopener noreferrer"[^>]*>Watch the replay`));
    expect(html).toContain("(opens in a new tab)");
    expect(html).toContain("The join link opens here 24 hours before the start.");
    expect(html).not.toMatch(/<button[^>]*>Join the live build/);
  });

  test("a free member sees the schedule and titles, and every join or replay is a button for the sheet", () => {
    const html = render({
      entitled: false,
      upcoming: [session({ status: "open", hasJoinLink: true })],
      past: [
        session({ id: "live3" as Id<"live_builds">, status: "ended", hasReplay: true }),
        session({ id: "live4" as Id<"live_builds">, status: "ended", hasReplay: false }),
      ],
    });
    expect(html).toContain("Build a waitlist app live");
    expect(html).toMatch(/<button type="button"[^>]*>Join the live build<\/button>/);
    expect(html).toMatch(/<button type="button"[^>]*>Watch the replay<\/button>/);
    expect(html).toContain("Replay coming soon.");
    expect(html).not.toMatch(/href="https?:/);
  });

  test("the page is noindex, has no main of its own, and exists only with the flag on", async () => {
    expect(pageSource).toMatch(/robots:\s*\{\s*index:\s*false/);
    expect(pageSource).not.toMatch(/<main\b/);
    expect(pageSource).toContain("if (!buildersHubUiEnabled(process.env.NEXT_PUBLIC_BUILDERS_HUB)) notFound();");
    vi.stubEnv("NEXT_PUBLIC_BUILDERS_HUB", "");
    const { default: LiveBuildsPage } = await import("../../app/dashboard/live/page");
    expect(() => LiveBuildsPage()).toThrow();
  });
});

describe("WP63-S8 navigation", () => {
  test("Live builds sits under Builds in the sidebar and in the phone Account sheet, flag on only", () => {
    expect(LIVE_NAV).toEqual({ id: "live", label: "Live builds", href: "/dashboard/live" });
    expect(PRIMARY_NAV.map((item) => item.id)).toEqual(["home", "ideas", "saved", "builds"]);
    expect(isWorkspaceNavCurrent("live", "/dashboard/live", null)).toBe(true);
    expect(isWorkspaceNavCurrent("live", "/dashboard/builds", null)).toBe(false);
    expect(shellSource.match(/\{BUILDERS_HUB_UI \? \(/g)).toHaveLength(2);
    expect(shellSource).toContain('current={isWorkspaceNavCurrent("live", pathname, view)}');
    expect(shellSource).toContain("<Link href={LIVE_NAV.href} className={cn(sheetLink, focusRing)}>");
  });

  test("the upgrade sheet has its own words for live builds", () => {
    expect(sheetSource).toContain('title: "Join the live build?"');
    expect(sheetSource).toContain("The schedule stays free to see.");
  });
});

describe("WP63-S8 links never reach a client file, analytics or logs", () => {
  const clientFiles = {
    ...import.meta.glob("../../app/**/*.{ts,tsx}", { query: "?raw", import: "default", eager: true }),
    ...import.meta.glob("../../components/**/*.{ts,tsx}", { query: "?raw", import: "default", eager: true }),
    ...import.meta.glob("../../lib/**/*.{ts,tsx}", { query: "?raw", import: "default", eager: true }),
  } as Record<string, string>;
  const live = "../../components/platform/live/LiveBuilds.tsx";

  test("only the live page reads a join or replay link, and only as a link target", () => {
    const readers = Object.entries(clientFiles)
      .filter(([, source]) => /joinUrl|replayUrl/.test(source))
      .map(([path]) => path);
    expect(readers).toEqual([live]);
    expect(liveSource.match(/session\.(joinUrl|replayUrl)/g)).toEqual([
      "session.replayUrl",
      "session.replayUrl",
      "session.joinUrl",
      "session.joinUrl",
    ]);
    expect(liveSource).toContain('<SessionLink href={session.replayUrl} label="Watch the replay" action="replay" />');
    expect(liveSource).toContain('<SessionLink href={session.joinUrl} label="Join the live build" action="join" />');
  });

  test("no meeting or video link is typed into any client file", () => {
    for (const [path, source] of Object.entries(clientFiles)) {
      expect(source, path).not.toMatch(/zoom\.us|meet\.google|youtube\.com\/live|vimeo\.com\/event|riverside\.fm|streamyard/i);
    }
  });

  test("analytics and logs never carry a link", () => {
    expect(liveSource).toContain('trackDashboardEvent({ name: "live_build_opened", props: { action } })');
    expect(liveSource).not.toMatch(/console\./);
    expect(operatorSource).not.toMatch(/console\./);
    for (const [path, source] of Object.entries(clientFiles)) {
      expect(source, path).not.toMatch(/trackDashboardEvent\([^)]*(joinUrl|replayUrl|href)/s);
    }
  });
});
