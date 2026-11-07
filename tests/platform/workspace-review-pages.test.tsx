// @vitest-environment jsdom
/**
 * L1-C1 and L1-C6: the Brand kit panel and the Team HQ panel through the real
 * DOM and axe-core: each state, swatch text, the "Not yet validated" label, the
 * "Waiting on you" rows and links, the empty state, and approve / ask for
 * changes through the shared review card.
 */
import axe from "axe-core";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { act } from "react";
import { afterEach, describe, expect, test, vi } from "vitest";

import type { Id } from "@/convex/_generated/dataModel";
import { changeRoundNote, expiresInWords, isHexColour } from "@/lib/workspace/reviewPages";

const FREE_PREVIEW = { outcome: "free", changeRound: 1, freeRoundsLeft: 2 };
const READY_TEAM = {
  state: "ready",
  hired: [
    { roleKey: "lead", employeeName: "Wren", roleLabel: "Crew Lead", reason: "Always." },
    { roleKey: "brand", employeeName: "Iris", roleLabel: "Brand", reason: "Always." },
    { roleKey: "social", employeeName: "Theo", roleLabel: "Social", reason: "Always." },
  ],
  skipped: [],
};
const live: { brand: unknown; blueprint: unknown; pending: unknown; preview: unknown; status: unknown; progress: unknown } = {
  status: READY_TEAM,
  progress: { started: true, retryable: false, steps: [] },
  brand: undefined,
  blueprint: undefined,
  pending: undefined,
  preview: FREE_PREVIEW,
};
const decideMock = vi.fn();

vi.mock("convex/react", async () => {
  const { getFunctionName } = await import("convex/server");
  return {
    useQuery: (ref: Parameters<typeof getFunctionName>[0], args: unknown) => {
      if (args === "skip") return undefined;
      const name = getFunctionName(ref);
      if (name.includes("previewChangeRound")) return live.preview;
      if (name.includes("launchStatus")) return live.status;
      if (name.includes("launchProgress")) return live.progress;
      if (name.includes("brandKitDraft")) return live.brand;
      if (name.includes("blueprintDraft")) return live.blueprint;
      if (name.includes("pendingReviews")) return live.pending;
      throw new Error(`unexpected query ${name}`);
    },
    useMutation: (ref: Parameters<typeof getFunctionName>[0]) => {
      const name = getFunctionName(ref);
      if (name.endsWith(":decideApproval")) return decideMock;
      if (name.endsWith(":retryLaunch") || name.endsWith(":resumeLaunch")) return vi.fn();
      throw new Error(`unexpected mutation ${name}`);
    },
  };
});
vi.mock("@/components/platform/client-gates", async () => {
  const actual = await vi.importActual<typeof import("@/components/platform/client-gates")>("@/components/platform/client-gates");
  return {
    WhenConvexReady: ({ children }: { children: ReactNode }) => children,
    QuietErrorBoundary: actual.QuietErrorBoundary,
  };
});

vi.mock("next/font/google", async () => (await import("./tenant-site-helpers")).fontMockModule([]));

const { BrandKitPanel } = await import("@/components/workspace/brand/BrandKitPanel");
const { TENANT_FONTS } = await import("@/components/tenant-site/fonts");
const { TeamHqPanel } = await import("@/components/workspace/team/TeamHqPanel");

const PROJECT = "project1" as Id<"projects">;
const APPROVAL = "approval1" as Id<"approvals">;
const DAY = 86_400_000;

const card = (extra: Record<string, unknown> = {}) => ({
  approvalId: APPROVAL,
  status: "pending",
  changeRound: 0n,
  expiresAt: Date.now() + DAY,
  ...extra,
});

const colour = (name: string, hex: string, use: string) => ({ name, hex, use });

function kit(extra: Record<string, unknown> = {}) {
  return {
    name: "HydroTrail",
    nameAlternatives: ["TrailSip", "Aquapath"],
    tagline: { text: "Drink better on every trail." },
    palette: {
      primary: colour("River blue", "#1D4ED8", "Buttons and links"),
      secondary: colour("Moss", "#4D7C0F", "Supporting shapes"),
      accent: colour("Sunrise", "#F59E0B", "One highlight per page"),
      ground: colour("Paper", "#FAF7F2", "Page background"),
      ink: colour("Charcoal", "#1F2937", "Text"),
    },
    visualSystem: { direction: "warm_utility", shape: "soft", density: "balanced", theme: { mode: "light", reason: "Used outdoors in daylight." } },
    type: { pair: "bricolage_grotesque_figtree", scale: "H1 56/0.98 · Body 16/1.5", notes: "Headings in the display face only." },
    voice: { traits: ["Friendly", "Plain"], say: "Fill up and go.", dontSay: "Hydration solution.", dontSayWhy: "Sounds like a brochure." },
    logo: { markDescription: "A droplet shaped like a trail marker.", alt: "HydroTrail logo" },
    heroArt: { description: "A bottle on a mossy rock at sunrise.", alt: "A bottle on a rock" },
    ...extra,
  };
}

const brandReady = (extra: Record<string, unknown> = {}, cardValue: unknown = card()) => ({
  state: "ready",
  kit: kit(extra),
  card: cardValue,
});

function blueprint(extra: Record<string, unknown> = {}) {
  return {
    source: "library",
    validated: true,
    pitch: "A refill map for trail runners.",
    oneUser: "Trail runners who run long.",
    oneLoop: "Find a refill point, fill up, rate it.",
    features: ["Refill map", "Ratings"],
    scopeCuts: ["No accounts for friends"],
    profile: { ideaKind: "app", buyer: "consumer", deliveryFormat: "self_serve", audiencePlural: "trail runners" },
    market: { summary: "Runners already share refill spots in group chats.", competitors: [{ name: "WaterMap", note: "Static and out of date" }] },
    ...extra,
  };
}

const blueprintReady = (extra: Record<string, unknown> = {}, cardValue: unknown = card()) => ({
  state: "ready",
  blueprint: blueprint(extra),
  card: cardValue,
});

const review = (extra: Record<string, unknown> = {}) => ({
  approvalId: APPROVAL,
  kind: "brand_kit",
  title: "Brand kit",
  changeRound: 0n,
  expiresAt: Date.now() + 2 * DAY + 1000,
  href: "/dashboard/b/project1/brand",
  ...extra,
});

afterEach(() => {
  cleanup();
  decideMock.mockReset();
  live.brand = undefined;
  live.blueprint = undefined;
  live.pending = undefined;
  live.preview = FREE_PREVIEW;
  live.status = READY_TEAM;
  live.progress = { started: true, retryable: false, steps: [] };
});

describe("helpers", () => {
  test("expiry in words", () => {
    const now = 1_000_000;
    expect(expiresInWords(now + 2 * DAY + 5, now)).toBe("in 2 days");
    expect(expiresInWords(now + DAY, now)).toBe("in 1 day");
    expect(expiresInWords(now + 5 * 3_600_000, now)).toBe("in 5 hours");
    expect(expiresInWords(now + 30 * 60_000, now)).toBe("in 30 minutes");
    expect(expiresInWords(now + 10_000, now)).toBe("in under a minute");
    expect(expiresInWords(now, now)).toBe("closed");
  });
  test("change round note only after round 0", () => {
    expect(changeRoundNote(0)).toBeNull();
    expect(changeRoundNote(2)).toBe("Change round 2");
  });
  test("only a #RRGGBB string is a swatch colour", () => {
    expect(isHexColour("#1D4ED8")).toBe(true);
    expect(isHexColour("red")).toBe(false);
    expect(isHexColour("#fff")).toBe(false);
    expect(isHexColour("#12345G")).toBe(false);
    expect(isHexColour('#123456" onload="x')).toBe(false);
  });
});

describe("Brand kit states", () => {
  test("loading", () => {
    render(<BrandKitPanel projectId={PROJECT} fonts={TENANT_FONTS} />);
    expect(screen.getByText("Loading your brand kit…")).toBeTruthy();
  });
  test("none", () => {
    live.brand = { state: "none" };
    render(<BrandKitPanel projectId={PROJECT} fonts={TENANT_FONTS} />);
    expect(screen.getByText("Your brand kit will appear here once your team writes it.")).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
  });
  test("unavailable shows calm copy with no detail", () => {
    live.brand = { state: "unavailable" };
    render(<BrandKitPanel projectId={PROJECT} fonts={TENANT_FONTS} />);
    expect(screen.getByText(/can't be shown right now/)).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
  });
});

describe("Brand kit ready", () => {
  test("shows the name, alternatives, tagline, look, voice, logo and hero art as text", () => {
    live.brand = brandReady();
    render(<BrandKitPanel projectId={PROJECT} fonts={TENANT_FONTS} />);
    expect(screen.getAllByText("HydroTrail").length).toBeGreaterThan(0);
    expect(screen.getByText("Other names your team considered: TrailSip, Aquapath.")).toBeTruthy();
    expect(screen.getAllByText("Drink better on every trail.").length).toBeGreaterThan(0);
    expect(screen.getByText(/Warm utility\./)).toBeTruthy();
    expect(screen.getByText("Soft corners, balanced spacing")).toBeTruthy();
    expect(screen.getByText(/Light theme\. Used outdoors in daylight\./)).toBeTruthy();
    expect(screen.getByText("Bricolage Grotesque for headings, Figtree for text")).toBeTruthy();
    const traits = within(screen.getByRole("list", { name: "Voice traits" })).getAllByRole("listitem");
    expect(traits.map((item) => item.textContent)).toEqual(["Friendly", "Plain"]);
    expect(screen.getByText(/Fill up and go\./)).toBeTruthy();
    expect(screen.getByText(/Hydration solution\./)).toBeTruthy();
    expect(screen.getByText("Sounds like a brochure.")).toBeTruthy();
    expect(screen.getByText("Logo idea")).toBeTruthy();
    expect(screen.getByText("A droplet shaped like a trail marker.")).toBeTruthy();
    expect(screen.getByText("Hero art idea")).toBeTruthy();
    expect(screen.getByText(/Image generation is coming soon/)).toBeTruthy();
    expect(screen.queryByText("Pattern and product moment")).toBeNull();
    expect(screen.queryByRole("img")).toBeNull();
  });

  test("pattern and product moment show when present", () => {
    live.brand = brandReady({ pattern: "Contour lines", productMoment: { title: "First refill", body: "The map pins your spot." } });
    render(<BrandKitPanel projectId={PROJECT} fonts={TENANT_FONTS} />);
    expect(screen.getByText("Contour lines")).toBeTruthy();
    expect(screen.getByText("First refill. The map pins your spot.")).toBeTruthy();
  });

  test("five colour cards each carry role, name, hex and use as text, and the swatch is hidden from assistive tech", () => {
    live.brand = brandReady();
    const { container } = render(<BrandKitPanel projectId={PROJECT} fonts={TENANT_FONTS} />);
    const items = within(screen.getByRole("list", { name: "Colours" })).getAllByRole("listitem");
    expect(items).toHaveLength(5);
    expect(items[0].textContent).toContain("Primary");
    expect(items[0].textContent).toContain("River blue");
    expect(items[0].textContent).toContain("#1D4ED8");
    expect(items[0].textContent).toContain("Buttons and links");
    expect(items[4].textContent).toContain("Charcoal");
    expect(items[4].textContent).toContain("#1F2937");
    items.forEach((item) => expect(item.querySelector("[aria-hidden='true']")?.className).toContain("h-[88px]"));
    expect(container.querySelector("[style]")).toBeNull();
    expect(container.querySelector("svg")).toBeNull();
  });

  test("a hex that is not #RRGGBB never reaches the page as a colour", () => {
    const bad = kit();
    bad.palette.primary = colour("Odd", 'red" onload="x', "Buttons");
    live.brand = { state: "ready", kit: bad, card: null };
    const { container } = render(<BrandKitPanel projectId={PROJECT} fonts={TENANT_FONTS} />);
    const first = within(screen.getByRole("list", { name: "Colours" })).getAllByRole("listitem")[0];
    expect(first.querySelector("[aria-hidden='true']")?.className).not.toContain("bg-(--t-primary)");
    expect(screen.getByText("Odd")).toBeTruthy();
    expect(container.querySelector("[onload]")).toBeNull();
    expect(container.querySelector("style")?.textContent).not.toContain("onload");
  });

  test("server text is never parsed as HTML", () => {
    live.brand = brandReady({ name: "<b>Bold</b> <img src=x onerror=alert(1)>" });
    const { container } = render(<BrandKitPanel projectId={PROJECT} fonts={TENANT_FONTS} />);
    expect(Array.from(container.querySelectorAll("b")).some((b) => b.textContent === "Bold")).toBe(false);
    expect(container.querySelector("img")).toBeNull();
    expect(screen.getAllByText(/<b>Bold<\/b>/).length).toBeGreaterThan(0);
  });

  test("the headings run h2 under the page's h1 with no jumps", () => {
    live.brand = brandReady();
    render(<BrandKitPanel projectId={PROJECT} fonts={TENANT_FONTS} />);
    const levels = screen.getAllByRole("heading").map((h) => Number(h.tagName.slice(1)));
    expect(levels[0]).toBe(2);
    expect(levels.every((level, i) => i === 0 || level - levels[i - 1] <= 1)).toBe(true);
  });

  test("passes axe", async () => {
    live.brand = brandReady({ pattern: "Contour lines", productMoment: { title: "First refill", body: "Pins your spot." } });
    const { container } = render(<BrandKitPanel projectId={PROJECT} fonts={TENANT_FONTS} />);
    const results = await axe.run(container, { runOnly: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] });
    expect(results.violations.map((v) => v.id)).toEqual([]);
  });
});

describe("Brand kit review card", () => {
  test("approve calls the mutation with the card's id and says what was read", async () => {
    decideMock.mockResolvedValue({ status: "approved", changed: true });
    live.brand = brandReady();
    render(<BrandKitPanel projectId={PROJECT} fonts={TENANT_FONTS} />);
    const user = userEvent.setup();
    expect(screen.getByText("Read the brand kit details below. Approve them as they are, or ask your team for changes.")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Approve" }));
    expect(decideMock).toHaveBeenCalledWith({ projectId: PROJECT, approvalId: APPROVAL, decision: "approve" });
    await waitFor(() => expect(screen.getByText("Approved.")).toBeTruthy());
  });

  test("ask for changes sends the trimmed note", async () => {
    decideMock.mockResolvedValue({
      status: "changes_requested",
      changed: true,
      changeRound: { outcome: "free", changeRound: 1, freeRoundsLeft: 1, taskId: "task1" },
    });
    live.brand = brandReady();
    render(<BrandKitPanel projectId={PROJECT} fonts={TENANT_FONTS} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Ask for changes" }));
    expect(screen.getByText(/rewrite the brand kit details/)).toBeTruthy();
    await user.type(screen.getByLabelText("What should change?"), "  Warmer colours  ");
    await user.click(screen.getByRole("button", { name: "Send changes" }));
    expect(decideMock).toHaveBeenCalledWith({ projectId: PROJECT, approvalId: APPROVAL, decision: "request_changes", note: "Warmer colours" });
    await waitFor(() => expect(screen.getByText(/Your team is rewriting the brand kit details\./)).toBeTruthy());
  });

  test("an approved card says nothing is published and offers no buttons", () => {
    live.brand = brandReady({}, card({ status: "approved" }));
    render(<BrandKitPanel projectId={PROJECT} fonts={TENANT_FONTS} />);
    expect(screen.getByText(/Review status: Approved\. Nothing is published yet\./)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Approve" })).toBeNull();
  });

  test("a paid round is explained in terms of the brand kit details and Ask for changes is not offered", () => {
    live.preview = { outcome: "spend_required", costCredits: 5 };
    live.brand = brandReady();
    render(<BrandKitPanel projectId={PROJECT} fonts={TENANT_FONTS} />);
    expect(
      screen.getByText("Another round of changes costs 5 credits. Paying for changes isn't open yet, so you can approve these brand kit details as they are."),
    ).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Ask for changes" })).toBeNull();
    expect(screen.getByRole("button", { name: "Approve" })).toBeTruthy();
  });

  test("the review card is its own h2 on this page, so the outline has no jump", () => {
    live.brand = brandReady();
    render(<BrandKitPanel projectId={PROJECT} fonts={TENANT_FONTS} />);
    const review = screen.getByRole("heading", { name: "Your review" });
    expect(review.tagName).toBe("H2");
  });

  test("a kit with no card still shows the kit", () => {
    live.brand = brandReady({}, null);
    render(<BrandKitPanel projectId={PROJECT} fonts={TENANT_FONTS} />);
    expect(screen.getAllByText("HydroTrail").length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: "Approve" })).toBeNull();
  });
});

describe("Team HQ: reviews the Crew Lead is routing", () => {
  test("loading", () => {
    live.status = undefined;
    live.progress = undefined;
    render(<TeamHqPanel projectId={PROJECT} businessName="HydroTrail" />);
    expect(screen.getAllByText("Loading your team…").length).toBeGreaterThan(0);
  });

  test("empty state is shown only when pendingReviews is an empty list", () => {
    live.pending = [];
    live.blueprint = { state: "none" };
    render(<TeamHqPanel projectId={PROJECT} businessName="HydroTrail" />);
    expect(screen.getByText("Nothing is waiting on you right now.")).toBeTruthy();
  });

  test("rows show the title, change round, expiry in words and a link named Review {title}", () => {
    live.pending = [
      review(),
      review({ approvalId: "approval2", kind: "social_pack", title: "Social posts", changeRound: 2n, expiresAt: Date.now() + 5 * 3_600_000 + 1000, href: "/dashboard/b/project1/social" }),
    ];
    live.blueprint = { state: "none" };
    render(<TeamHqPanel projectId={PROJECT} businessName="HydroTrail" />);
    const rows = within(screen.getByRole("list", { name: "Reviews Wren is routing" })).getAllByRole("listitem");
    expect(rows).toHaveLength(2);
    expect(rows[0].textContent).toContain("Brand kit");
    expect(rows[0].textContent).toContain("Closes in 2 days.");
    expect(rows[0].textContent).not.toContain("Change round");
    expect(rows[1].textContent).toContain("Change round 2");
    expect(rows[1].textContent).toContain("Closes in 5 hours.");
    expect(within(rows[0]).getByRole("link", { name: "Review Brand kit" }).getAttribute("href")).toBe("/dashboard/b/project1/brand");
    expect(within(rows[1]).getByRole("link", { name: "Review Social posts" }).getAttribute("href")).toBe("/dashboard/b/project1/social");
  });

  test("the blueprint row jumps to the blueprint section on this page", () => {
    live.pending = [review({ kind: "blueprint", title: "Blueprint", href: "/dashboard/b/project1/team" })];
    live.blueprint = blueprintReady();
    const { container } = render(<TeamHqPanel projectId={PROJECT} businessName="HydroTrail" />);
    const jump = screen.getByRole("link", { name: "Review Blueprint" });
    expect(jump.getAttribute("href")).toBe("#blueprint");
    expect(container.querySelector("section#blueprint")).not.toBeNull();
  });

  test("a blueprint row says the blueprint can't be shown when there is none to jump to", () => {
    live.pending = [review({ kind: "blueprint", title: "Blueprint", href: "/dashboard/b/project1/team" })];
    live.blueprint = { state: "unavailable" };
    render(<TeamHqPanel projectId={PROJECT} businessName="HydroTrail" />);
    expect(screen.queryByRole("link", { name: "Review Blueprint" })).toBeNull();
    expect(screen.getAllByText("The blueprint can't be shown right now.").length).toBeGreaterThan(0);
  });

  test("the blueprint section is a focusable jump target", () => {
    live.pending = [];
    live.blueprint = blueprintReady();
    const { container } = render(<TeamHqPanel projectId={PROJECT} businessName="HydroTrail" />);
    expect(container.querySelector("section#blueprint")?.getAttribute("tabindex")).toBe("-1");
  });

  test("a card that closes while the page is open drops off after a minute", () => {
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval", "Date"] });
    try {
      live.pending = [review({ expiresAt: Date.now() + 30_000 })];
      live.blueprint = { state: "none" };
      render(<TeamHqPanel projectId={PROJECT} businessName="HydroTrail" />);
      expect(screen.getByRole("link", { name: "Review Brand kit" })).toBeTruthy();
      act(() => {
        vi.advanceTimersByTime(61_000);
      });
      expect(screen.queryByRole("link", { name: "Review Brand kit" })).toBeNull();
      expect(screen.getByText("Nothing is waiting on you right now.")).toBeTruthy();
    } finally {
      vi.useRealTimers();
    }
  });

  test("a review past its expiry is not listed", () => {
    live.pending = [review({ expiresAt: Date.now() - 1000 })];
    live.blueprint = { state: "none" };
    render(<TeamHqPanel projectId={PROJECT} businessName="HydroTrail" />);
    expect(screen.queryByRole("link", { name: "Review Brand kit" })).toBeNull();
    expect(screen.getByText("Nothing is waiting on you right now.")).toBeTruthy();
  });
});

describe("Team HQ: the blueprint section", () => {
  test("none and unavailable", () => {
    live.pending = [];
    live.blueprint = { state: "none" };
    const first = render(<TeamHqPanel projectId={PROJECT} businessName="HydroTrail" />);
    expect(screen.getByText("Your blueprint will appear here once your team writes it.")).toBeTruthy();
    first.unmount();
    live.blueprint = { state: "unavailable" };
    render(<TeamHqPanel projectId={PROJECT} businessName="HydroTrail" />);
    expect(screen.getByText(/Your blueprint can't be shown right now/)).toBeTruthy();
  });

  test("a validated blueprint shows every part and no label", () => {
    live.pending = [];
    live.blueprint = blueprintReady();
    render(<TeamHqPanel projectId={PROJECT} businessName="HydroTrail" />);
    expect(screen.getByText("A refill map for trail runners.")).toBeTruthy();
    expect(screen.getByText("Trail runners who run long.")).toBeTruthy();
    expect(screen.getByText("Find a refill point, fill up, rate it.")).toBeTruthy();
    expect(screen.getByText("Refill map")).toBeTruthy();
    expect(screen.getByText("No accounts for friends")).toBeTruthy();
    expect(screen.getByText("Runners already share refill spots in group chats.")).toBeTruthy();
    expect(screen.getByText("WaterMap: Static and out of date")).toBeTruthy();
    expect(screen.queryByText("Not yet validated")).toBeNull();
    expect(screen.queryByText(/comes from your words only/)).toBeNull();
  });

  test("an own idea shows Not yet validated and no market block", () => {
    live.pending = [];
    live.blueprint = blueprintReady({ source: "own_idea", validated: false, market: undefined });
    render(<TeamHqPanel projectId={PROJECT} businessName="HydroTrail" />);
    expect(screen.getByText("Not yet validated")).toBeTruthy();
    expect(screen.getByText(/This outline comes from your words only/)).toBeTruthy();
    expect(screen.queryByText("The market")).toBeNull();
  });

  test("approve and ask for changes go through the blueprint's card", async () => {
    decideMock.mockResolvedValue({ status: "approved", changed: true });
    live.pending = [];
    live.blueprint = blueprintReady();
    render(<TeamHqPanel projectId={PROJECT} businessName="HydroTrail" />);
    const user = userEvent.setup();
    expect(screen.getByText(/Read the blueprint details above\./)).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Approve" }));
    expect(decideMock).toHaveBeenCalledWith({ projectId: PROJECT, approvalId: APPROVAL, decision: "approve" });
    await waitFor(() => expect(screen.getByText("Approved.")).toBeTruthy());
  });

  test("ask for changes sends the note", async () => {
    decideMock.mockResolvedValue({
      status: "changes_requested",
      changed: true,
      changeRound: { outcome: "free", changeRound: 1, freeRoundsLeft: 1, taskId: "task1" },
    });
    live.pending = [];
    live.blueprint = blueprintReady();
    render(<TeamHqPanel projectId={PROJECT} businessName="HydroTrail" />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Ask for changes" }));
    await user.type(screen.getByLabelText("What should change?"), "Cut a feature");
    await user.click(screen.getByRole("button", { name: "Send changes" }));
    expect(decideMock).toHaveBeenCalledWith({ projectId: PROJECT, approvalId: APPROVAL, decision: "request_changes", note: "Cut a feature" });
  });

  test("passes axe with a waiting list and a ready blueprint", async () => {
    live.pending = [review({ kind: "blueprint", title: "Blueprint", changeRound: 1n, href: "/dashboard/b/project1/team" }), review()];
    live.blueprint = blueprintReady({ source: "own_idea", validated: false, market: undefined });
    const { container } = render(<TeamHqPanel projectId={PROJECT} businessName="HydroTrail" />);
    const results = await axe.run(container, { runOnly: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] });
    expect(results.violations.map((v) => v.id)).toEqual([]);
  });
});
