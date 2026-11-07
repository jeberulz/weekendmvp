// @vitest-environment jsdom
/**
 * L1-C6 and L1 UI fidelity: Team HQ through the real DOM and axe-core: the
 * header counts, the Crew Lead card, the team grid and its filters, the launch
 * steps by owner, Try again (`retryLaunch`), Resume (`resumeLaunch`), a
 * refusal in plain words, focus and live regions, skipped roles, "Why this
 * team?", every loading/empty/error state and the section order.
 */
import axe from "axe-core";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ConvexError } from "convex/values";
import type { ReactNode } from "react";
import { act } from "react";
import { afterEach, describe, expect, test, vi } from "vitest";

import type { Id } from "@/convex/_generated/dataModel";
import { resumeMessage, retryMessage } from "@/lib/workspace/reviewPages";

const live: { progress: unknown; status: unknown; reviews: unknown; blueprint: unknown } = {
  progress: undefined,
  status: undefined,
  reviews: [],
  blueprint: { state: "none" },
};
const retryMock = vi.fn();
const resumeMock = vi.fn();
const otherMock = vi.fn();

vi.mock("convex/react", async () => {
  const { getFunctionName } = await import("convex/server");
  return {
    useQuery: (ref: Parameters<typeof getFunctionName>[0], args: unknown) => {
      if (args === "skip") return undefined;
      const name = getFunctionName(ref);
      if (live.progress === "throw" && name.includes("launchProgress")) throw new Error("boom");
      if (name.includes("launchProgress")) return live.progress;
      if (name.includes("launchStatus")) return live.status;
      if (name.includes("pendingReviews")) return live.reviews;
      if (name.includes("blueprintDraft")) return live.blueprint;
      throw new Error(`unexpected query ${name}`);
    },
    useMutation: (ref: Parameters<typeof getFunctionName>[0]) => {
      const name = getFunctionName(ref);
      if (name.endsWith(":retryLaunch")) return retryMock;
      if (name.endsWith(":resumeLaunch")) return resumeMock;
      return otherMock;
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

const { TeamHqPanel } = await import("@/components/workspace/team/TeamHqPanel");

const PROJECT = "project1" as Id<"projects">;
const DAY = 86_400_000;

type StepState = "waiting" | "queued" | "running" | "paused" | "succeeded" | "failed" | "skipped";
const step = (
  key: string,
  title: string,
  employee: string,
  state: StepState,
  extra: Record<string, unknown> = {},
) => ({ key, title, employee, notBuilt: false, state, ...extra });
const later = (key: string, title: string, employee: string, reason: string) =>
  step(key, title, employee, "skipped", { notBuilt: true, reason });

const progress = (steps: ReturnType<typeof step>[], retryable = false) => ({ started: true, retryable, steps });

const role = (roleKey: string, employeeName: string, roleLabel: string, reason = `${roleLabel} reason.`) => ({
  roleKey,
  employeeName,
  roleLabel,
  reason,
});
const HIRED = [
  role("lead", "Wren", "Crew Lead", "Always: runs the team."),
  role("brand", "Iris", "Brand", "Always: designs the logo."),
  role("email", "Elle", "Email"),
  role("social", "Theo", "Social"),
  role("seo", "Sana", "SEO"),
  role("ads", "Ada", "Ads", "You want a waitlist test."),
];
const SKIPPED = [{ roleKey: "outbound", roleLabel: "Outbound", reason: "Nobody to email yet." }];
const READY = { state: "ready", hired: HIRED, skipped: SKIPPED };

const BASE_STEPS = () => [
  step("blueprint", "Blueprint", "lead", "succeeded"),
  step("roster", "Your team", "lead", "succeeded"),
  step("brand_kit", "Brand kit", "brand", "running"),
  later("logo_marks", "Logo marks", "brand", "Logo marks is not built yet, so nothing was written for it yet."),
  step("email_sequence", "Email sequence", "email", "waiting", { reason: "Waiting on the brand kit." }),
  step("social_pack", "Social pack", "social", "queued", { reason: "Waiting for a free slot: your team is busy with other work." }),
  later("seo_pack", "SEO pack", "seo", "SEO pack is coming in a later update, so nothing was written for it yet."),
];

const review = (extra: Record<string, unknown> = {}) => ({
  approvalId: "approval1",
  kind: "brand_kit",
  title: "Brand kit",
  changeRound: 0n,
  expiresAt: Date.now() + 2 * DAY + 1000,
  href: "/dashboard/b/project1/brand",
  ...extra,
});

function show(
  options: {
    status?: unknown;
    progress?: unknown;
    reviews?: unknown;
    blueprint?: unknown;
  } = {},
) {
  live.status = "status" in options ? options.status : READY;
  live.progress = "progress" in options ? options.progress : progress(BASE_STEPS());
  live.reviews = "reviews" in options ? options.reviews : [];
  live.blueprint = "blueprint" in options ? options.blueprint : { state: "none" };
  return render(<TeamHqPanel projectId={PROJECT} businessName="HydroTrail" />);
}

afterEach(() => {
  cleanup();
  retryMock.mockReset();
  resumeMock.mockReset();
  otherMock.mockReset();
  live.progress = undefined;
  live.status = undefined;
  live.reviews = [];
  live.blueprint = { state: "none" };
});

async function noAxe(container: Element) {
  const results = await axe.run(container, { runOnly: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] });
  expect(results.violations.map((v) => v.id)).toEqual([]);
}

describe("helpers", () => {
  test("retry and resume wording", () => {
    expect(resumeMessage({ resumed: 1, waitingForSlot: false })).toBe("Resumed 1 step.");
    expect(resumeMessage({ resumed: 2, waitingForSlot: true })).toBe("Resumed 2 steps. Others are waiting for a free slot.");
    expect(resumeMessage({ resumed: 0, waitingForSlot: true })).toMatch(/busy with other work/);
    expect(resumeMessage({ resumed: 0, waitingForSlot: false })).toBe("Nothing was waiting to resume.");
    expect(retryMessage({ state: "failed" }, "Sent.")).toMatch(/Nothing could start yet/);
    expect(retryMessage({ state: "assembling" }, "Sent.")).toBe("Sent.");
  });
});

describe("page states", () => {
  test("loading: the h1 is there, with a skeleton and the state in words", () => {
    const { container } = show({ status: undefined, progress: undefined });
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Team HQ");
    expect(screen.getAllByText("Loading your team…").length).toBeGreaterThan(0);
    expect(container.querySelector("[data-state='skeleton']")?.getAttribute("aria-hidden")).toBe("true");
    expect(container.querySelector(".animate-spin")).toBeNull();
  });

  test("an error in a query shows a plain message and keeps the h1 and the blueprint", () => {
    show({ progress: "throw", blueprint: { state: "none" } });
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Team HQ");
    expect(screen.getAllByText(/can't be shown right now/).length).toBeGreaterThan(0);
    expect(screen.getByRole("alert")).toBeTruthy();
    expect(screen.getByRole("heading", { level: 2, name: "Your blueprint, for your OK." })).toBeTruthy();
  });

  test("not started says so, with no team, no lead card, no why link and no button", () => {
    show({ status: { state: "not_started" }, progress: { started: false, retryable: false, steps: [] } });
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Team HQ");
    expect(screen.getAllByText("Your launch hasn't started, so there is no team yet.").length).toBeGreaterThan(0);
    expect(screen.queryByText(/putting your team together/)).toBeNull();
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.queryByRole("link", { name: "Why this team?" })).toBeNull();
    expect(screen.queryByRole("list", { name: "Specialists" })).toBeNull();
    expect(screen.getByText("Your launch hasn't started yet, so there are no steps to show.")).toBeTruthy();
  });

  test("assembling shows the way-in header, the lead card and skeleton cards, and no retry", () => {
    const { container } = show({ status: { state: "assembling" }, progress: progress([step("blueprint", "Blueprint", "lead", "running")]) });
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Team HQ. Your team is on its way.");
    expect(screen.getAllByText(/is putting your team together/).length).toBeGreaterThan(0);
    expect(container.querySelector("[data-state='skeleton']")).not.toBeNull();
    expect(screen.queryByRole("button")).toBeNull();
  });

  test("assembling names the lead with the chosen partner name, not 'Your co-founder'", () => {
    live.status = { state: "assembling" };
    live.progress = progress([step("blueprint", "Blueprint", "lead", "running")]);
    live.reviews = [];
    live.blueprint = { state: "none" };
    render(<TeamHqPanel projectId={PROJECT} businessName="HydroTrail" partnerName="Juno" />);
    expect(screen.getAllByText(/Juno is putting your team together/).length).toBeGreaterThan(0);
    expect(screen.queryByText(/Your co-founder is putting/)).toBeNull();
  });
});

describe("header", () => {
  test("eyebrow, h1 counts from the data, summary and a Why this team link", () => {
    show();
    const h1 = screen.getByRole("heading", { level: 1 });
    expect(h1.textContent).toBe("6 on the team. Nobody needs you right now.");
    expect(screen.getByText("Team HQ · HydroTrail")).toBeTruthy();
    expect(screen.getByText(/Of 5 specialists: 2 working, 1 queued, 2 coming soon\./)).toBeTruthy();
    expect(screen.getByRole("link", { name: "Why this team?" }).getAttribute("href")).toBe("#why-this-team");
  });

  test("a pending review makes the owner need you, and the tail says so", () => {
    show({ reviews: [review()] });
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("6 on the team. 1 needs you.");
    expect(screen.getByText(/routing 1 review\./)).toBeTruthy();
  });
});

describe("Crew Lead card", () => {
  test("names the lead, points at the chat on the right and does not link to the dashboard", () => {
    show();
    expect(screen.getByRole("heading", { level: 2, name: "Wren routes every approval." })).toBeTruthy();
    expect(screen.getByText(/Chat stays with Wren\./)).toBeTruthy();
    expect(screen.getByText(/The chat on the right is/)).toBeTruthy();
    expect(screen.queryByRole("link", { name: /dashboard chat/i })).toBeNull();
    expect(document.querySelector("a[href='/dashboard/b/project1']")).toBeNull();
    expect(screen.getByText("All reviews routed")).toBeTruthy();
    expect(screen.getByText("Nothing is waiting on you right now.")).toBeTruthy();
    expect(screen.getByText("0 waiting")).toBeTruthy();
  });

  test("rows name the owner, the title, the change round and the honest expiry, with one Review link and no approve toggles", () => {
    show({
      reviews: [
        review(),
        review({ approvalId: "approval2", kind: "social_pack", title: "Social posts", changeRound: 2n, expiresAt: Date.now() + 5 * 3_600_000 + 1000, href: "/dashboard/b/project1/social" }),
      ],
    });
    const list = screen.getByRole("list", { name: "Reviews Wren is routing" });
    const rows = within(list).getAllByRole("listitem");
    expect(rows).toHaveLength(2);
    expect(rows[0].textContent).toContain("From Brand · Iris");
    expect(rows[0].textContent).toContain("Waiting on you");
    expect(rows[0].textContent).toContain("Closes in 2 days.");
    expect(rows[1].textContent).toContain("From Social · Theo");
    expect(rows[1].textContent).toContain("Change round 2");
    expect(rows[1].textContent).toContain("Waiting on you");
    expect(rows[1].textContent).toContain("Closes in 5 hours.");
    expect(within(rows[0]).getByRole("link", { name: "Review Brand kit" }).getAttribute("href")).toBe("/dashboard/b/project1/brand");
    expect(within(rows[1]).getByRole("link", { name: "Review Social posts" }).getAttribute("href")).toBe("/dashboard/b/project1/social");
    expect(within(list).queryByRole("button")).toBeNull();
    expect(screen.getByText("Working · Routing 2 reviews")).toBeTruthy();
    expect(screen.getByText("2 waiting")).toBeTruthy();
  });

  test("a failed team stage shows Try again through retryLaunch, and says sent", async () => {
    retryMock.mockResolvedValue({ state: "assembling" });
    show({ status: { state: "failed", paused: false, retryable: true }, progress: progress([step("blueprint", "Blueprint", "lead", "failed", { retryable: true })], true) });
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Team HQ");
    await userEvent.setup().click(screen.getByRole("button", { name: "Try again: put your team together" }));
    expect(retryMock).toHaveBeenCalledWith({ projectId: PROJECT });
    await waitFor(() => expect(screen.getByText("Sent. Launch progress above shows where each step stands.")).toBeTruthy());
  });

  test("a retry that did nothing says so", async () => {
    retryMock.mockResolvedValue({ state: "failed", paused: true, retryable: true });
    show({ status: { state: "failed", paused: true, retryable: true }, progress: progress([step("blueprint", "Blueprint", "lead", "paused")]) });
    await userEvent.setup().click(screen.getByRole("button", { name: /Try again: put your team together/ }));
    await waitFor(() => expect(screen.getByText(/Nothing could start yet/)).toBeTruthy());
  });

  test("failed with no retry that helps shows a plain message and no team button", () => {
    show({ status: { state: "failed", paused: false, retryable: false }, progress: progress([step("blueprint", "Blueprint", "lead", "failed", { retryable: false })]) });
    expect(screen.getAllByText(/trying again will not change it/).length).toBeGreaterThan(0);
    expect(screen.queryByRole("button")).toBeNull();
  });

  test("a refused team retry shows a plain error", async () => {
    retryMock.mockRejectedValue(new ConvexError({ kind: "RateLimited" }));
    show({ status: { state: "failed", paused: false, retryable: true }, progress: progress([step("blueprint", "Blueprint", "lead", "failed", { retryable: true })], true) });
    await userEvent.setup().click(screen.getByRole("button", { name: /Try again/ }));
    expect((await screen.findByRole("alert")).textContent).toMatch(/a lot of crew work/);
  });

  test("a card that closes while the page is open drops off after a minute", () => {
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval", "Date"] });
    try {
      show({ reviews: [review({ expiresAt: Date.now() + 30_000 })] });
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
});

describe("Team grid", () => {
  const cards = () => within(screen.getByRole("list", { name: "Specialists" })).getAllByRole("listitem");

  test("one card per specialist (not the lead), with statuses in words", () => {
    show();
    const items = cards();
    expect(items).toHaveLength(5);
    const by = (id: string) => items.find((item) => item.getAttribute("data-employee") === id) as HTMLElement;
    expect(by("brand").textContent).toContain("Working");
    expect(by("brand").textContent).toContain("Writing the brand kit");
    expect(by("email").textContent).toContain("Queued");
    expect(by("email").textContent).toContain("Waiting on the brand kit.");
    expect(by("social").textContent).toContain("Waiting for a free slot");
    expect(by("lead")).toBeUndefined();
  });

  test("a role whose steps are all unbuilt reads Coming soon, never Queued", () => {
    show();
    const seo = cards().find((item) => item.getAttribute("data-employee") === "seo") as HTMLElement;
    expect(seo.querySelector("[data-status]")?.getAttribute("data-status")).toBe("coming_soon");
    expect(seo.textContent).toContain("Coming soon");
    expect(seo.textContent).not.toContain("Queued");
    const ads = cards().find((item) => item.getAttribute("data-employee") === "ads") as HTMLElement;
    expect(ads.textContent).toContain("Nothing to do in this beta yet.");
  });

  test("Open workstream goes to the built page; other roles say Workstream coming soon", () => {
    show();
    const items = cards();
    const brand = items.find((item) => item.getAttribute("data-employee") === "brand") as HTMLElement;
    expect(within(brand).getByRole("link", { name: /Open Brand kit/ }).getAttribute("href")).toBe("/dashboard/b/project1/brand");
    const seo = items.find((item) => item.getAttribute("data-employee") === "seo") as HTMLElement;
    expect(within(seo).queryByRole("link")).toBeNull();
    expect(within(seo).getByText("Workstream coming soon")).toBeTruthy();
    expect(screen.queryByRole("switch")).toBeNull();
  });

  test("filter pills are toggles with counts, one on at a time, and the count line is a live status", async () => {
    show();
    const user = userEvent.setup();
    const group = screen.getByRole("group", { name: "Filter specialists by status" });
    const all = within(group).getByRole("button", { name: /^All/ });
    const soon = within(group).getByRole("button", { name: /^Coming soon/ });
    expect(all.getAttribute("aria-pressed")).toBe("true");
    expect(soon.getAttribute("aria-pressed")).toBe("false");
    expect(within(group).getByRole("button", { name: /^Working/ }).textContent).toContain("2");
    await user.click(soon);
    expect(soon.getAttribute("aria-pressed")).toBe("true");
    expect(all.getAttribute("aria-pressed")).toBe("false");
    expect(cards()).toHaveLength(2);
    expect(screen.getByText("Showing 2 of 5 specialists. Filter: Coming soon.").getAttribute("role")).toBe("status");
    await user.click(within(group).getByRole("button", { name: /^Needs you/ }));
    expect(screen.queryByRole("list", { name: "Specialists" })).toBeNull();
    expect(screen.getByText("Nobody needs you right now. Wren will bring the next decision here.")).toBeTruthy();
  });

  test("filters are keyboard operable", async () => {
    show({ reviews: [review()] });
    const user = userEvent.setup();
    const needs = screen.getByRole("button", { name: /^Needs you/ });
    needs.focus();
    await user.keyboard("{Enter}");
    expect(needs.getAttribute("aria-pressed")).toBe("true");
    expect(cards()).toHaveLength(1);
    await user.keyboard(" ");
    expect(needs.getAttribute("aria-pressed")).toBe("true");
  });

  test("a review makes its owner Needs you, with the ember detail", () => {
    show({ reviews: [review({ changeRound: 1n })] });
    const brand = cards().find((item) => item.getAttribute("data-employee") === "brand") as HTMLElement;
    expect(brand.textContent).toContain("Needs you");
    expect(brand.textContent).toContain("Brand kit · change round 1 ready for your OK");
  });
});

describe("Launch steps by owner", () => {
  test("each step shows its title, owner chip and state in words; unbuilt steps are under Coming later", () => {
    show();
    const section = screen.getByRole("heading", { level: 2, name: "Launch steps, by owner." }).closest("section") as HTMLElement;
    const now = within(within(section).getByRole("list", { name: "Launch steps and owners" })).getAllByRole("listitem");
    expect(now.map((item) => item.getAttribute("data-step"))).toEqual(["blueprint", "roster", "brand_kit", "email_sequence", "social_pack"]);
    expect(now[0].textContent).toContain("Owner: Wren, Crew Lead");
    expect(now[0].textContent).toContain("Done");
    expect(now[2].textContent).toContain("Working");
    expect(now[3].textContent).toContain("Waiting");
    expect(now[4].textContent).toContain("Queued");
    expect(within(section).getByRole("heading", { level: 3, name: "Coming later (2)" })).toBeTruthy();
    const soon = within(within(section).getByRole("list", { name: "Launch steps coming later" })).getAllByRole("listitem");
    expect(soon.map((item) => item.textContent)).toEqual([
      expect.stringContaining("Coming soon"),
      expect.stringContaining("Coming soon"),
    ]);
    expect(soon[0].textContent).not.toContain("Queued");
    expect(within(section).getByText("2 of 5 steps done. 2 coming later.")).toBeTruthy();
    expect(within(section).queryByRole("button")).toBeNull();
  });

  test("a failed step that no retry can help shows the reason and no button", () => {
    show({ progress: progress([step("brand_kit", "Brand kit", "brand", "failed", { retryable: false, reason: "This step could not finish, and trying again would not help." })]) });
    expect(screen.getAllByText(/trying again would not help/).length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: /Try again|Resume/ })).toBeNull();
    expect(document.querySelector("[data-step='brand_kit']")?.textContent).toContain("Failed");
  });

  test("Try again calls retryLaunch, announces, and keeps focus on the button while it can still be retried", async () => {
    retryMock.mockResolvedValue({ state: "assembling" });
    show({ progress: progress([step("brand_kit", "Brand kit", "brand", "failed", { retryable: true, reason: "This step did not finish. Try again to run it again." })], true) });
    const user = userEvent.setup();
    const button = screen.getByRole("button", { name: "Try again: run the failed steps again" });
    await user.click(button);
    expect(retryMock).toHaveBeenCalledWith({ projectId: PROJECT });
    expect(resumeMock).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.getByText("Sent. Each step below shows where it stands.")).toBeTruthy());
    expect(document.activeElement).toBe(button);
    expect(screen.getByText("Each try counts toward your hourly crew work.")).toBeTruthy();
  });

  test("a Try again that did nothing says so and never claims work started", async () => {
    retryMock.mockResolvedValue({ state: "failed", paused: false, retryable: true });
    show({ progress: progress([step("brand_kit", "Brand kit", "brand", "failed", { retryable: true })], true) });
    await userEvent.setup().click(screen.getByRole("button", { name: /Try again: run the failed steps again/ }));
    await waitFor(() =>
      expect(screen.getByText("Nothing could start yet: your team is busy with other work. Try again in a few minutes.")).toBeTruthy(),
    );
    expect(screen.queryByText(/Sent\./)).toBeNull();
  });

  test("a double click makes one call, and while working the name carries the visible text", async () => {
    let finish: (value: unknown) => void = () => undefined;
    retryMock.mockReturnValue(new Promise((resolve) => { finish = resolve; }));
    show({ progress: progress([step("brand_kit", "Brand kit", "brand", "failed", { retryable: true })], true) });
    const user = userEvent.setup();
    const button = screen.getByRole("button", { name: /Try again/ });
    await user.dblClick(button);
    expect(retryMock).toHaveBeenCalledTimes(1);
    expect(button.getAttribute("aria-disabled")).toBe("true");
    expect(button.textContent).toBe("Trying again");
    expect(button.getAttribute("aria-label")).toBe("Trying again: running the failed steps");
    expect((button.getAttribute("aria-label") ?? "").startsWith(button.textContent ?? "")).toBe(true);
    finish({ state: "ready", hired: [], skipped: [] });
    await waitFor(() => expect(button.getAttribute("aria-disabled")).toBeNull());
  });

  test("both buttons are aria-disabled while either is working", async () => {
    retryMock.mockReturnValue(new Promise(() => undefined));
    show({
      progress: progress(
        [step("brand_kit", "Brand kit", "brand", "failed", { retryable: true }), step("social_pack", "Social pack", "social", "paused")],
        true,
      ),
    });
    await userEvent.setup().click(screen.getByRole("button", { name: /Try again/ }));
    expect(screen.getByRole("button", { name: /Resume/ }).getAttribute("aria-disabled")).toBe("true");
  });

  test("when the button goes away after a retry, focus moves to the heading", async () => {
    retryMock.mockResolvedValue({ state: "ready", hired: [], skipped: [] });
    const view = show({ progress: progress([step("brand_kit", "Brand kit", "brand", "failed", { retryable: true })], true) });
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /Try again: run the failed steps again/ }));
    await waitFor(() => expect(screen.getByText(/^Sent\./)).toBeTruthy());
    // Convex pushes the new state: the failed step is running, so the button unmounts.
    live.progress = progress([step("brand_kit", "Brand kit", "brand", "running")]);
    (document.activeElement as HTMLElement | null)?.blur();
    view.rerender(<TeamHqPanel projectId={PROJECT} businessName="HydroTrail" />);
    expect(screen.queryByRole("button", { name: /Try again: run the failed steps again/ })).toBeNull();
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole("heading", { name: "Launch steps, by owner." })));
  });

  test("the blueprint and team stage is left to the Crew Lead card: no second Try again or Resume", () => {
    show({ progress: progress([step("blueprint", "Blueprint", "lead", "failed", { retryable: true, reason: "This step did not finish. Try again to run it again." })], true) });
    expect(screen.queryByRole("button", { name: /run the failed steps/ })).toBeNull();
    expect(screen.getAllByText(/This step did not finish/).length).toBeGreaterThan(0);
    cleanup();
    show({ progress: progress([step("blueprint", "Blueprint", "lead", "paused", { reason: "Paused." })]) });
    expect(screen.queryByRole("button", { name: /Resume/ })).toBeNull();
  });

  test("a refused Try again says why in plain words; an unknown refusal is generic", async () => {
    retryMock.mockRejectedValue(new ConvexError({ kind: "RateLimited" }));
    show({ progress: progress([step("brand_kit", "Brand kit", "brand", "failed", { retryable: true })], true) });
    await userEvent.setup().click(screen.getByRole("button", { name: /Try again: run the failed steps again/ }));
    expect((await screen.findByRole("alert")).textContent).toBe("You have started a lot of crew work this hour. Try again in a little while.");
    cleanup();
    retryMock.mockRejectedValue(new Error("secret internals"));
    show({ progress: progress([step("brand_kit", "Brand kit", "brand", "failed", { retryable: true })], true) });
    await userEvent.setup().click(screen.getByRole("button", { name: /Try again: run the failed steps again/ }));
    expect((await screen.findByRole("alert")).textContent).toBe("Something went wrong. Try again.");
  });

  test("a paused step is resumed with resumeLaunch and the result is announced", async () => {
    resumeMock.mockResolvedValue({ resumed: 1, paused: 0, waitingForSlot: false });
    show({ progress: progress([step("brand_kit", "Brand kit", "brand", "paused", { reason: "Paused: the AI budget ran out." })]) });
    const user = userEvent.setup();
    expect(document.querySelector("[data-step='brand_kit']")?.textContent).toContain("Paused");
    expect(screen.queryByRole("button", { name: /Try again: run the failed/ })).toBeNull();
    await user.click(screen.getByRole("button", { name: "Resume: restart the paused steps" }));
    expect(resumeMock).toHaveBeenCalledWith({ projectId: PROJECT });
    expect(retryMock).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.getByText("Resumed 1 step.")).toBeTruthy());
  });

  test("a refused Resume shows a plain error", async () => {
    resumeMock.mockRejectedValue(new ConvexError({ code: "AI_DISABLED" }));
    show({ progress: progress([step("brand_kit", "Brand kit", "brand", "paused")]) });
    await userEvent.setup().click(screen.getByRole("button", { name: /Resume/ }));
    expect((await screen.findByRole("alert")).textContent).toBe("AI work is switched off right now. Try again later.");
  });
});

describe("Skipped roles and Why this team", () => {
  test("skipped roles are cards with their reasons, no Hire button, and a coming-soon note", () => {
    show();
    const section = screen.getByRole("heading", { level: 2, name: "Skipped for HydroTrail, on purpose." }).closest("section") as HTMLElement;
    const items = within(within(section).getByRole("list", { name: "Skipped roles" })).getAllByRole("listitem");
    expect(items).toHaveLength(1);
    expect(items[0].textContent).toContain("Outbound");
    expect(items[0].textContent).toContain("Skipped");
    expect(items[0].textContent).toContain("Nobody to email yet.");
    expect(within(section).queryByRole("button")).toBeNull();
    expect(screen.queryByRole("button", { name: /^Hire/ })).toBeNull();
    expect(within(section).getByText("Hiring a skipped role is coming soon.")).toBeTruthy();
  });

  test("no skipped roles hides the section", () => {
    show({ status: { ...READY, skipped: [] } });
    expect(screen.queryByRole("heading", { name: /Skipped for/ })).toBeNull();
  });

  test("Why this team is a table of every role with its decision and reason, opened by the header link", async () => {
    show();
    const summary = screen.getByText("Why this team?", { selector: "summary" });
    const details = summary.closest("details") as HTMLDetailsElement;
    expect(details.id).toBe("why-this-team");
    const table = within(details).getByRole("table", { name: /Each role, whether it was hired or skipped, and why/ });
    const rows = within(table).getAllByRole("row");
    expect(rows).toHaveLength(1 + HIRED.length + SKIPPED.length);
    const lead = within(table).getByRole("rowheader", { name: "Crew Lead" }).closest("tr") as HTMLElement;
    expect(lead.textContent).toContain("Hired · always");
    expect(lead.textContent).toContain("Always: runs the team.");
    const ads = within(table).getByRole("rowheader", { name: "Ads" }).closest("tr") as HTMLElement;
    expect(ads.textContent).toContain("Hired · added");
    const outbound = within(table).getByRole("rowheader", { name: "Outbound" }).closest("tr") as HTMLElement;
    expect(outbound.textContent).toContain("Skipped");
    expect(details.open).toBe(false);
    await userEvent.setup().click(screen.getByRole("link", { name: "Why this team?" }));
    await waitFor(() => expect(details.open).toBe(true));
  });
});

describe("Blueprint section", () => {
  test("the heading follows the board's pattern and the section stays a focusable jump target", () => {
    const { container } = show({ blueprint: { state: "none" } });
    expect(screen.getByText("From Wren · Crew Lead")).toBeTruthy();
    expect(screen.getByRole("heading", { level: 2, name: "Your blueprint, for your OK." })).toBeTruthy();
    expect(container.querySelector("section#blueprint")?.getAttribute("tabindex")).toBe("-1");
  });
});

describe("Team HQ order and accessibility", () => {
  test("one h1, then the lead, the team, the blueprint, the steps and the skipped roles", () => {
    show();
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    const names = screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent);
    expect(names).toEqual([
      "Wren routes every approval.",
      "The team, by status.",
      "Your blueprint, for your OK.",
      "Launch steps, by owner.",
      "Skipped for HydroTrail, on purpose.",
    ]);
  });

  test("the page has no Wren chat of its own", () => {
    show();
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.queryByRole("log")).toBeNull();
  });

  test("passes axe when ready, with reviews, a failed step, a paused step and filters", async () => {
    const steps = [
      ...BASE_STEPS(),
      step("extra", "Extra", "ads", "failed", { retryable: true, reason: "This step did not finish." }),
      step("extra2", "Extra two", "marketing", "paused"),
    ];
    const { container } = show({ progress: progress(steps, true), reviews: [review()] });
    await noAxe(container);
  });

  test("passes axe while loading, assembling, failed and not started", async () => {
    for (const options of [
      { status: undefined, progress: undefined },
      { status: { state: "assembling" }, progress: progress([step("blueprint", "Blueprint", "lead", "running")]) },
      { status: { state: "failed", paused: false, retryable: true }, progress: progress([step("blueprint", "Blueprint", "lead", "failed", { retryable: true })], true) },
      { status: { state: "not_started" }, progress: { started: false, retryable: false, steps: [] } },
    ]) {
      const { container } = show(options);
      await noAxe(container);
      cleanup();
    }
  });
});
