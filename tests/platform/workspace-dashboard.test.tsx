// @vitest-environment jsdom
/**
 * L1 UI fidelity: the workspace Dashboard through the real DOM and axe-core:
 * the h1 and header, the launch banner counts, the team strip, pending
 * approvals with links, the checklist (Coming soon for what is not built), the
 * no-fake-data guarantees and every state.
 */
import axe from "axe-core";
import { cleanup, render, screen, within } from "@testing-library/react";
import { ConvexError } from "convex/values";
import type { ReactNode } from "react";
import { afterEach, describe, expect, test, vi } from "vitest";

import type { Id } from "@/convex/_generated/dataModel";
import type { ArtifactKind } from "@/lib/workspace/contracts/artifacts";
import {
  bannerCopy,
  checklistRows,
  dashboardErrorCopy,
  DASHBOARD_AI_OFF_COPY,
  DASHBOARD_ERROR_COPY,
  openReviews,
  segments,
  statusLine,
  teamCounts,
  type DashStep,
} from "@/lib/workspace/dashboard";

const live: { progress: unknown; status: unknown; reviews: unknown } = { progress: undefined, status: undefined, reviews: [] };

vi.mock("convex/react", async () => {
  const { getFunctionName } = await import("convex/server");
  return {
    useQuery: (ref: Parameters<typeof getFunctionName>[0]) => {
      const name = getFunctionName(ref);
      if (live.status === "throw-ai" && name.includes("launchStatus")) {
        throw new ConvexError({ code: "AI_DISABLED" });
      }
      if (live.status === "throw" && name.includes("launchStatus")) throw new Error("boom");
      if (name.includes("launchProgress")) return live.progress;
      if (name.includes("launchStatus")) return live.status;
      if (name.includes("pendingReviews")) return live.reviews;
      throw new Error(`unexpected query ${name}`);
    },
  };
});
vi.mock("@/components/platform/client-gates", () => ({
  WhenConvexReady: ({ children }: { children: ReactNode }) => children,
}));

const { DashboardPanel } = await import("@/components/workspace/dashboard/DashboardPanel");

const PROJECT = "project1" as Id<"projects">;
const DAY = 86_400_000;

const step = (key: string, title: string, employee: string, state: DashStep["state"], extra: Partial<DashStep> = {}): DashStep => ({
  key,
  title,
  employee,
  notBuilt: false,
  state,
  ...extra,
});
const later = (key: string, title: string, employee: string): DashStep =>
  step(key, title, employee, "skipped", { notBuilt: true, reason: "Coming soon." });

const role = (roleKey: string, employeeName: string, roleLabel: string) => ({ roleKey, employeeName, roleLabel, reason: "Because." });

const READY = {
  state: "ready",
  hired: [role("lead", "Wren", "Crew Lead"), role("brand", "Iris", "Brand"), role("email", "Elle", "Email"), role("social", "Theo", "Social")],
  skipped: [],
};

const STEPS = [
  step("blueprint", "Blueprint", "lead", "succeeded"),
  step("roster", "Team", "lead", "succeeded"),
  step("brand_kit", "Brand kit", "brand", "succeeded"),
  step("email_sequence", "Email sequence", "email", "succeeded"),
  step("social_pack", "Social pack", "social", "running"),
  later("landing_spec", "Landing page", "landing"),
  later("build_pack", "Build pack", "engineering"),
];

const review = (id: string, kind: ArtifactKind, title: string, href: string, changeRound = 0) => ({
  approvalId: id,
  kind,
  title,
  changeRound,
  expiresAt: Date.now() + 2 * DAY + 60_000,
  href,
});

const REVIEWS = [
  review("a1", "brand_kit", "Brand kit", "/dashboard/b/project1/brand"),
  review("a2", "email_sequence", "Waitlist emails", "/dashboard/b/project1/email", 1),
];

function setLive(status: unknown, progress: unknown, reviews: unknown = []) {
  live.status = status;
  live.progress = progress;
  live.reviews = reviews;
}

afterEach(() => {
  cleanup();
  live.status = undefined;
  live.progress = undefined;
  live.reviews = [];
});

async function noAxe(container: Element) {
  const results = await axe.run(container, { runOnly: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] });
  expect(results.violations.map((v) => v.id)).toEqual([]);
}

const renderPanel = () =>
  render(<DashboardPanel projectId={PROJECT} businessName="HydroTrail" partnerName="Wren" />);

describe("helpers", () => {
  test("banner counts only steps that exist in this beta", () => {
    const copy = bannerCopy({ launch: READY as never, started: true, steps: STEPS, reviews: REVIEWS, lead: "Wren" });
    expect(copy.lead).toBe("4 of 5 ready.");
    expect(copy.tail).toBe("2 need you.");
    expect(copy.status).toBe("Ready for your OK: brand kit and waitlist emails. Drafting: social pack.");
  });

  test("banner tail names a failed or paused step before reviews", () => {
    const failed = [...STEPS.slice(0, 4), step("social_pack", "Social pack", "social", "failed")];
    expect(bannerCopy({ launch: READY as never, started: true, steps: failed, reviews: REVIEWS, lead: "Wren" }).tail).toBe("1 did not finish.");
    const paused = [...STEPS.slice(0, 4), step("social_pack", "Social pack", "social", "paused")];
    expect(bannerCopy({ launch: READY as never, started: true, steps: paused, reviews: [], lead: "Wren" }).tail).toBe("1 is paused.");
  });

  test("statusLine when everything is done and when nothing runs", () => {
    expect(statusLine([step("blueprint", "Blueprint", "lead", "succeeded")], [])).toBe("Everything the crew can build so far is done.");
    expect(statusLine([step("blueprint", "Blueprint", "lead", "waiting")], [])).toBe("Nothing is running right now.");
  });

  test("segments name every step and its state", () => {
    const parts = segments(STEPS, REVIEWS);
    expect(parts).toHaveLength(5);
    expect(parts.find((p) => p.key === "brand_kit")?.label).toBe("ready for your OK");
    expect(parts.find((p) => p.key === "social_pack")?.label).toBe("in progress");
    expect(parts.find((p) => p.key === "blueprint")?.label).toBe("done");
  });

  test("team counts use distinct hired owners of open reviews", () => {
    const hired = [
      { role: "lead" as const, name: "Wren", roleLabel: "Crew Lead" },
      { role: "brand" as const, name: "Iris", roleLabel: "Brand" },
      { role: "email" as const, name: "Elle", roleLabel: "Email" },
    ];
    expect(teamCounts(hired, [{ kind: "brand_kit" }, { kind: "brand_kit" }])).toEqual({ onIt: 3, needYou: 1 });
  });

  test("expired reviews drop off", () => {
    expect(openReviews([{ expiresAt: 5 }, { expiresAt: 50 }], 10)).toEqual([{ expiresAt: 50 }]);
  });

  test("checklist never calls an unbuilt step done or queued", () => {
    const rows = checklistRows({
      projectId: "p",
      launch: READY as never,
      steps: [step("brand_kit", "Brand kit", "brand", "skipped", { notBuilt: true })],
      reviews: [],
    });
    expect(rows.find((r) => r.id === "brand")?.status).toEqual({ set: "step", status: "coming_soon" });
    expect(rows.find((r) => r.id === "site")?.status).toEqual({ set: "step", status: "coming_soon" });
    expect(rows.find((r) => r.id === "email")?.status).toEqual({ set: "step", status: "coming_soon" });
  });

  test("error copy tells AI-off apart", () => {
    expect(dashboardErrorCopy(new ConvexError({ code: "AI_DISABLED" }))).toBe(DASHBOARD_AI_OFF_COPY);
    expect(dashboardErrorCopy(new Error("x"))).toBe(DASHBOARD_ERROR_COPY);
  });
});

describe("ready dashboard", () => {
  test("h1 is the business name with a sentence tail, and is the only h1", () => {
    setLive(READY, { started: true, retryable: false, steps: STEPS }, REVIEWS);
    renderPanel();
    const h1 = screen.getAllByRole("heading", { level: 1 });
    expect(h1).toHaveLength(1);
    expect(h1[0].textContent).toBe("HydroTrail Here is where your launch stands.");
    expect(screen.getByText(/Wren is running your launch/)).toBeTruthy();
  });

  test("banner shows real counts, a labelled bar and links", () => {
    setLive(READY, { started: true, retryable: false, steps: STEPS }, REVIEWS);
    renderPanel();
    const banner = screen.getByRole("region", { name: /4 of 5 ready/ });
    expect(within(banner).getByText("2 need you.")).toBeTruthy();
    const bar = within(banner).getByRole("list", { name: "Launch steps" });
    expect(within(bar).getAllByRole("listitem")).toHaveLength(5);
    expect(within(bar).getByText("Brand kit: ready for your OK")).toBeTruthy();
    expect(within(banner).getByRole("link", { name: "Open Team HQ" }).getAttribute("href")).toBe("/dashboard/b/project1/team");
    expect(within(banner).getByRole("link", { name: "Review Brand kit" }).getAttribute("href")).toBe("/dashboard/b/project1/brand");
  });

  test("team strip lists hired roles with the counts", () => {
    setLive(READY, { started: true, retryable: false, steps: STEPS }, REVIEWS);
    renderPanel();
    const team = screen.getByRole("region", { name: /Your team/ });
    expect(within(team).getByRole("heading", { level: 2 }).textContent).toContain("4 on it, 2 need you");
    expect(within(team).getAllByRole("listitem")).toHaveLength(4);
    expect(within(team).getByRole("img", { name: "Iris, Brand (AI employee)" })).toBeTruthy();
    expect(within(team).getByRole("link", { name: "Open Team HQ" })).toBeTruthy();
  });

  test("pending approvals link to their review pages with honest expiry", () => {
    setLive(READY, { started: true, retryable: false, steps: STEPS }, REVIEWS);
    renderPanel();
    const section = screen.getByRole("region", { name: "Pending approvals" });
    const rows = within(section).getAllByRole("listitem");
    expect(rows).toHaveLength(2);
    expect(rows[0].textContent).toContain("From Iris · Brand");
    expect(rows[0].textContent).toContain("Closes in 2 days");
    expect(rows[1].textContent).toContain("Change round 1");
    expect(within(section).getByRole("link", { name: "Review Waitlist emails" }).getAttribute("href")).toBe("/dashboard/b/project1/email");
    expect(within(section).queryByRole("button")).toBeNull();
  });

  test("no reviews reads as nothing waiting", () => {
    setLive(READY, { started: true, retryable: false, steps: STEPS }, []);
    renderPanel();
    expect(screen.getByText("Nothing is waiting on you right now.")).toBeTruthy();
    expect(screen.queryByRole("link", { name: /^Review/ })).toBeNull();
  });

  test("checklist statuses are words, and unbuilt things say Coming soon", () => {
    setLive(READY, { started: true, retryable: false, steps: STEPS }, REVIEWS);
    renderPanel();
    const list = screen.getByRole("region", { name: "What's ready" });
    const row = (id: string) => list.querySelector(`[data-row="${id}"]`) as HTMLElement;
    expect(within(row("brand")).getByText("Ready for your OK")).toBeTruthy();
    expect(within(row("email")).getByText("Ready for your OK")).toBeTruthy();
    expect(within(row("social")).getByText("Working")).toBeTruthy();
    expect(within(row("blueprint")).getByText("Drafted")).toBeTruthy();
    expect(within(row("site")).getByText("Coming soon")).toBeTruthy();
    expect(within(row("workspace")).getByText("Set up")).toBeTruthy();
  });

  test("never shows fake data: no dates, money, credits, inbox, numbers or site preview", () => {
    setLive(READY, { started: true, retryable: false, steps: STEPS }, REVIEWS);
    const { container } = renderPanel();
    const text = container.textContent ?? "";
    expect(text).not.toMatch(/\$\d/);
    expect(text).not.toMatch(/\b(Mon|Tue|Wed|Thu|Fri|Sat|Sun)\b/);
    expect(text).not.toMatch(/\b(Nov|Dec|Jan)\b/);
    expect(text).not.toMatch(/credits/i);
    expect(text).not.toMatch(/\d+\s*\/\s*\d+/);
    expect(text).not.toMatch(/weekendmvp\.app/i);
    expect(text).not.toMatch(/inbox|waitlist ·|payouts|net revenue/i);
    expect(container.querySelector("iframe")).toBeNull();
    expect(container.querySelector("[style]")).toBeNull();
  });

  test("passes axe", async () => {
    setLive(READY, { started: true, retryable: false, steps: STEPS }, REVIEWS);
    const { container } = renderPanel();
    await noAxe(container);
  });
});

describe("states", () => {
  test("loading keeps the h1 and announces", async () => {
    const { container } = renderPanel();
    expect(screen.getByRole("heading", { level: 1 }).textContent).toContain("HydroTrail");
    expect(screen.getByRole("status").textContent).toBe("Loading your launch…");
    await noAxe(container);
  });

  test("launch not started points to Team HQ", async () => {
    setLive({ state: "not_started" }, { started: false, retryable: false, steps: [] }, []);
    const { container } = renderPanel();
    expect(screen.getByRole("region", { name: "Your launch hasn't started yet." })).toBeTruthy();
    expect(screen.getByText("Your launch hasn't started, so there is no team yet.")).toBeTruthy();
    expect(screen.getAllByRole("link", { name: "Open Team HQ" }).length).toBeGreaterThan(0);
    expect(screen.queryByRole("region", { name: "What's ready" })).toBeNull();
    await noAxe(container);
  });

  test("team assembling", async () => {
    setLive({ state: "assembling" }, { started: true, retryable: false, steps: [step("blueprint", "Blueprint", "lead", "running")] }, []);
    const { container } = renderPanel();
    expect(screen.getByRole("region", { name: "Your team is being put together." })).toBeTruthy();
    expect(screen.getByText("Your team is being put together.", { selector: "p, div" })).toBeTruthy();
    await noAxe(container);
  });

  test("failed launch sends the founder to Team HQ to try again", async () => {
    setLive({ state: "failed", paused: false, retryable: true }, { started: true, retryable: true, steps: [step("blueprint", "Blueprint", "lead", "failed")] }, []);
    const { container } = renderPanel();
    const banner = screen.getByRole("region", { name: "Your launch needs a hand." });
    expect(within(banner).getByText(/Try again in Team HQ/)).toBeTruthy();
    expect(within(banner).getByRole("link", { name: "Open Team HQ" }).getAttribute("href")).toBe("/dashboard/b/project1/team");
    await noAxe(container);
  });

  test("a paused step is named, with Resume in Team HQ", () => {
    const paused = [...STEPS.slice(0, 4), step("social_pack", "Social pack", "social", "paused")];
    setLive(READY, { started: true, retryable: false, steps: paused }, []);
    renderPanel();
    const banner = screen.getByRole("region", { name: /of 5 ready/ });
    expect(within(banner).getByText("1 is paused.")).toBeTruthy();
    expect(within(banner).getByText(/Resume in Team HQ/)).toBeTruthy();
  });

  test("AI off reads as its own state", async () => {
    setLive("throw-ai", undefined, []);
    const { container } = renderPanel();
    expect(screen.getByRole("heading", { level: 1 }).textContent).toContain("HydroTrail");
    expect(screen.getAllByText(DASHBOARD_AI_OFF_COPY).length).toBeGreaterThan(0);
    await noAxe(container);
  });

  test("a read error shows a plain alert and still lists the reviews", async () => {
    setLive("throw", undefined, REVIEWS);
    const { container } = renderPanel();
    expect(screen.getByRole("alert").textContent).toContain(DASHBOARD_ERROR_COPY);
    expect(screen.getByRole("link", { name: "Review Brand kit" })).toBeTruthy();
    await noAxe(container);
  });
});
