// @vitest-environment jsdom
/**
 * WP75-S1 + L1 UI fidelity T1. Meet your co-founder and Team assembly as one
 * screen: the hero, "putting your team together" (skeletons), the failed state
 * with its Try again button, the hired rows (specialty, Always / Added with the
 * real reason), the skipped roles, "Meanwhile, building" from the launch
 * steps, the "Team ready" banner and the way into Team HQ. Rendered from the
 * pure roster (`planRoster` on the HydroTrail input), with axe on every state.
 */
import { act, cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ConvexError } from "convex/values";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { axe } from "vitest-axe";

import {
  CofounderTeam,
  LiveMeetCofounder,
  MeanwhileBuilding,
  MeetCofounder,
  launchErrorMessage,
  teamAnnouncement,
  type CofounderTeamProps,
  type MeetCofounderProps,
  type MeetProgress,
} from "@/components/workspace/wizard/MeetCofounder";
import { ROLE_CATALOGUE } from "@/convex/crew/roles";
import type { Id } from "@/convex/_generated/dataModel";
import { planRoster } from "@/convex/crew/roles";
import { hydrotrailRosterInput, hydrotrailWizardAnswers } from "@/lib/workspace/contracts/fixtures/hydrotrail";
import { readyLaunchView, type LaunchView } from "@/lib/workspace/crew/launch";

type Mutation = (args: Record<string, unknown>) => Promise<unknown>;

const live = vi.hoisted(() => ({
  launch: undefined as unknown,
  progress: undefined as unknown,
  calls: [] as string[],
  startError: null as unknown,
  retryError: null as unknown,
}));

// Only `LiveMeetCofounder` uses these hooks; `CofounderTeam`, `MeetCofounder` and `MeanwhileBuilding` are pure.
vi.mock("convex/react", async () => {
  const { getFunctionName: name } = await import("convex/server");
  return {
    useQuery: (ref: Parameters<typeof name>[0]) => (name(ref).endsWith(":launchProgress") ? live.progress : live.launch),
    useMutation: (ref: Parameters<typeof name>[0]): Mutation => async () => {
      const fn = name(ref);
      live.calls.push(fn);
      if (fn.endsWith(":startLaunch") && live.startError) throw live.startError;
      if (fn.endsWith(":retryLaunch") && live.retryError) throw live.retryError;
      return live.launch;
    },
  };
});

afterEach(cleanup);

const ready = readyLaunchView(planRoster(hydrotrailRosterInput));
const BUSINESS = { projectId: "proj1", name: "HydroTrail", slug: "hydrotrail" };

function setup(launch: LaunchView | undefined, overrides: Partial<MeetCofounderProps> = {}) {
  const onRetry = vi.fn();
  const onStart = vi.fn();
  const props: MeetCofounderProps = {
    answers: hydrotrailWizardAnswers,
    business: BUSINESS,
    ideaTitle: "HydroTrail",
    launch,
    onStart,
    onRetry,
    retrying: false,
    error: null,
    ...overrides,
  };
  const view = render(<MeetCofounder {...props} />);
  return { ...view, onRetry, onStart, user: userEvent.setup() };
}

async function expectNoAxeViolations(container: Element) {
  // jsdom cannot paint, so axe's colour-contrast rule cannot run here; the home-* token pairs are checked live.
  const results = await axe(container, { rules: { "color-contrast": { enabled: false } } });
  expect(results.violations.map((violation) => `${violation.id}: ${violation.help}`)).toEqual([]);
}

const status = () => screen.getByRole("status");
const teamHqLink = () => screen.getByRole("link", { name: "Meet your team in Team HQ" });
const workspaceLink = () => screen.getByRole("link", { name: "Go to your workspace" });

describe("L1 T1 Meet your co-founder: structure", () => {
  test("one h1 (the hero) and h2 sections; the heading order never skips", () => {
    setup(ready);
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Hi, I'm Wren.");
    expect(screen.getAllByRole("heading", { level: 2 }).map((heading) => heading.textContent)).toEqual([
      "Your team",
      "What I read",
      "Who I hired",
      "They start now. I keep the chat.",
      "Roles I checked",
      "Not hiring, on purpose",
    ]);
    expect(screen.queryAllByRole("heading", { level: 3 })).toHaveLength(0);
  });

  test("What I read: tiles from the wizard answers, with real labels and no invented figures", async () => {
    const { container } = setup(ready);
    const read = screen.getByRole("heading", { level: 2, name: "What I read" }).closest("section");
    if (read === null) throw new Error("expected the What I read section");
    const text = read.textContent ?? "";
    expect(text).toContain("Library idea");
    expect(text).toContain("HydroTrail");
    expect(text).toContain("Your wizard answers + library research");
    for (const label of ["Idea", "Money", "First goal", "Platform"]) expect(within(read).getByText(label)).toBeTruthy();
    expect(container.textContent).not.toMatch(/N°|% MATCH|is free|Fri 6|Sun 8|Autopilot|credits|See plans|Show all now|Replay/i);
    await expectNoAxeViolations(container);
  });

  test("an own idea reads as Your own idea, Not yet validated", () => {
    setup(ready, { answers: { ...hydrotrailWizardAnswers, idea: { source: "own_idea", text: "A packing list" } }, ideaTitle: null });
    const read = screen.getByRole("heading", { level: 2, name: "What I read" }).closest("section");
    expect(read?.textContent).toContain("Your own idea");
    expect(read?.textContent).toContain("Not yet validated");
    expect(read?.textContent).not.toContain("library research");
  });
});

describe("L1 T1 Meet your co-founder: the team", () => {
  test("assembling: a polite status, three skeleton rows, no hired list, no Assemble button, and the way in", async () => {
    const { container } = setup({ state: "assembling" });
    expect(status().getAttribute("aria-live")).toBe("polite");
    expect(status().textContent).toBe("Wren is putting your team together.");
    expect(screen.getByText(/Wren is putting your team together\. This takes about a minute\./)).toBeTruthy();
    expect(container.querySelectorAll('[data-skeleton] > div')).toHaveLength(3);
    expect(container.querySelector("[data-skeleton]")?.getAttribute("aria-hidden")).toBe("true");
    expect(screen.queryByRole("list", { name: "Hired specialists" })).toBeNull();
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByText(/Checking 13 roles against your answers/)).toBeTruthy();
    expect(screen.getByText("Specialists appear here once I’ve checked every role.")).toBeTruthy();
    expect(screen.getByText("Your workspace is ready now. Team HQ fills in as I hire.")).toBeTruthy();
    expect(teamHqLink().getAttribute("href")).toBe("/dashboard/b/proj1/team");
    expect(workspaceLink().getAttribute("href")).toBe("/dashboard/b/proj1");
    await expectNoAxeViolations(container);
  });

  test("loading and not-started read as putting the team together", () => {
    setup(undefined);
    expect(status().textContent).toBe("Wren is putting your team together.");
    cleanup();
    setup({ state: "not_started" });
    expect(status().textContent).toBe("Wren is putting your team together.");
  });

  test("ready: the banner, 9 hired rows with specialty and an Always or Added reason, 4 skipped, 13 checked", async () => {
    const { container } = setup(ready);
    expect(status().textContent).toBe("Your team is ready: 9 hired, 4 skipped for now.");

    const hiredList = screen.getByRole("list", { name: "Hired specialists" });
    const hired = within(hiredList).getAllByRole("listitem");
    expect(hired).toHaveLength(9);
    for (const [index, role] of ready.hired.entries()) {
      const row = hired[index];
      expect(row?.textContent).toContain(role.employeeName);
      expect(row?.textContent).toContain(role.roleLabel);
      expect(row?.textContent).toContain(role.reason);
      const entry = ROLE_CATALOGUE.find((candidate) => candidate.key === role.roleKey);
      expect(row?.textContent).toContain(entry?.does ?? "missing specialty");
      expect(row?.textContent).toContain("Why hired: ");
    }
    // The lead stays in the chat; the paid-test hire is Added, the rest Always.
    expect(hired[0]?.textContent).toContain("Stays in your chat");
    expect(within(hired[0] as HTMLElement).getByText("Always")).toBeTruthy();
    const ads = hired.find((row) => row.getAttribute("data-role") === "ads");
    expect(ads).toBeTruthy();
    expect(within(ads as HTMLElement).getByText("Added")).toBeTruthy();
    expect(ads?.textContent).toContain("Goal has a paid push: $7/day test");
    expect(within(hiredList).getAllByText("Always")).toHaveLength(8);

    const skipped = within(screen.getByRole("list", { name: "Skipped roles" })).getAllByRole("listitem");
    expect(skipped).toHaveLength(4);
    for (const [index, role] of ready.skipped.entries()) {
      expect(skipped[index]?.textContent).toContain(role.roleLabel);
      expect(skipped[index]?.textContent).toContain(`Skipped · ${role.reason}`);
    }
    expect(screen.getByText(/No course content/)).toBeTruthy();
    expect(screen.getByText("Hiring a skipped role is coming soon.")).toBeTruthy();

    const checked = within(screen.getByRole("list", { name: "Roles checked" })).getAllByRole("listitem");
    expect(checked).toHaveLength(13);
    expect(checked.filter((chip) => chip.textContent?.endsWith("· hire"))).toHaveLength(9);
    expect(checked.filter((chip) => chip.textContent?.endsWith("· skip"))).toHaveLength(4);

    const banner = screen.getByRole("heading", { level: 2, name: /They start now/ }).closest("section");
    expect(banner?.textContent).toContain("Team ready · 9 hired · 4 skipped");
    // Q13: no approval card, no hire or assemble controls.
    expect(screen.queryByRole("button")).toBeNull();
    expect(container.textContent).not.toMatch(/Assemble my team/);
    await expectNoAxeViolations(container);
  });

  test("ready: the primary CTA goes to Team HQ, the workspace link stays with its neutral line, and both come after the team", () => {
    const { container } = setup(ready, { business: { ...BUSINESS, projectId: "proj 1/x" } });
    expect(teamHqLink().getAttribute("href")).toBe("/dashboard/b/proj%201%2Fx/team");
    expect(workspaceLink().getAttribute("href")).toBe("/dashboard/b/proj%201%2Fx");
    expect(teamHqLink().tagName).toBe("A");
    const links = within(container).getAllByRole("link");
    expect(links[links.length - 1]).toBe(workspaceLink());
    const hired = screen.getByRole("list", { name: "Hired specialists" });
    expect(hired.compareDocumentPosition(teamHqLink()) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // The line under it claims nothing about the launch's state.
    expect(screen.getByText("Your workspace is where you and Wren work on HydroTrail.")).toBeTruthy();
    expect(container.textContent).not.toMatch(/carries on|launch is|launched/i);
  });

  test("failed: the reason, a clearly labelled Try again that calls back once, and the announcement", async () => {
    const { container, onRetry, user } = setup({ state: "failed", paused: false, retryable: true });
    expect(status().textContent).toBe("Wren could not put your team together. You can try again.");
    const retry = screen.getByRole("button", { name: "Try again: put your team together" });
    expect(retry.textContent).toBe("Try again");
    const description = document.getElementById(retry.getAttribute("aria-describedby") ?? "");
    expect(description?.textContent).toMatch(/could not put your team together this time\. Nothing was charged\./);
    await user.click(retry);
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("list", { name: "Hired specialists" })).toBeNull();
    // Even failed, the way into the workspace is on screen.
    expect(workspaceLink().getAttribute("href")).toBe("/dashboard/b/proj1");
    await expectNoAxeViolations(container);
  });

  test("paused reads as paused; retrying keeps focus on an aria-disabled button and ignores clicks", async () => {
    const { container, onRetry, user } = setup({ state: "failed", paused: true, retryable: true }, { retrying: true });
    expect(status().textContent).toBe("Wren paused putting your team together. You can try again.");
    const retry = screen.getByRole("button", { name: "Trying again to put your team together" });
    expect(retry.getAttribute("aria-disabled")).toBe("true");
    expect(retry.textContent).toBe("Trying again…");
    await user.click(retry);
    expect(onRetry).not.toHaveBeenCalled();
    await expectNoAxeViolations(container);
  });

  test("a refused start or retry shows plain words in an alert", async () => {
    const { container } = setup({ state: "failed", paused: false, retryable: true }, { error: "AI work is switched off right now. Try again later." });
    expect(screen.getByRole("alert").textContent).toBe("AI work is switched off right now. Try again later.");
    await expectNoAxeViolations(container);
  });

  test("a refused start: no spinner, no 'putting together', and Try again starts again", async () => {
    const { container, onStart, onRetry, user } = setup({ state: "not_started" }, {
      error: "You have started a lot of crew work this hour. Try again in a little while.",
    });
    expect(screen.queryByText(/This takes about a minute/)).toBeNull();
    expect(status().textContent).toBe("Wren could not start putting your team together. You can try again.");
    expect(screen.getByRole("alert").textContent).toMatch(/a lot of crew work this hour/);
    await user.click(screen.getByRole("button", { name: "Try again: put your team together" }));
    expect(onStart).toHaveBeenCalledTimes(1);
    expect(onRetry).not.toHaveBeenCalled();
    await expectNoAxeViolations(container);
  });

  test("a team no retry can fix says so, with no button", async () => {
    const { container } = setup({ state: "failed", paused: false, retryable: false });
    expect(status().textContent).toBe("Wren could not put your team together for this business.");
    expect(screen.getByText(/trying again will not change it/)).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
    await expectNoAxeViolations(container);
  });

  test("the launch could not be read at all: it says so and the way in stays", async () => {
    const { container } = setup(undefined, { unavailable: true });
    expect(screen.getByText("Your team cannot be shown right now. It will be in your workspace.")).toBeTruthy();
    expect(teamHqLink().getAttribute("href")).toBe("/dashboard/b/proj1/team");
    expect(workspaceLink()).toBeTruthy();
    expect(screen.queryByRole("list", { name: "Hired specialists" })).toBeNull();
    await expectNoAxeViolations(container);
  });

  test("the status region stays mounted across state changes", () => {
    const base: MeetCofounderProps = { answers: hydrotrailWizardAnswers, business: BUSINESS, launch: { state: "assembling" } };
    const { rerender } = render(<MeetCofounder {...base} />);
    const region = status();
    rerender(<MeetCofounder {...base} launch={ready} />);
    expect(status()).toBe(region);
    expect(region.textContent).toBe(teamAnnouncement(ready, "Wren"));
  });

  test("after Try again, focus moves to the team heading when the button goes away (WCAG 2.4.3)", async () => {
    const user = userEvent.setup();
    const base: MeetCofounderProps = { answers: hydrotrailWizardAnswers, business: BUSINESS, launch: { state: "failed", paused: false, retryable: true }, onRetry: vi.fn() };
    const { rerender } = render(<MeetCofounder {...base} />);
    const retry = screen.getByRole("button", { name: "Try again: put your team together" });
    await user.click(retry);
    rerender(<MeetCofounder {...base} retrying />);
    expect(document.activeElement).toBe(retry);
    rerender(<MeetCofounder {...base} launch={{ state: "assembling" }} />);
    const heading = screen.getByRole("heading", { level: 2, name: "Your team" });
    expect(heading.getAttribute("tabindex")).toBe("-1");
    expect(document.activeElement).toBe(heading);
  });

  test("the heading never takes focus the founder did not lose to Try again, or moved elsewhere", async () => {
    const user = userEvent.setup();
    const base: MeetCofounderProps = { answers: hydrotrailWizardAnswers, business: BUSINESS, launch: { state: "failed", paused: false, retryable: true } };
    const { rerender } = render(<MeetCofounder {...base} />);
    rerender(<MeetCofounder {...base} launch={{ state: "assembling" }} />);
    expect(document.activeElement).toBe(document.body);
    cleanup();
    const view = render(<MeetCofounder {...base} />);
    await user.click(screen.getByRole("button", { name: "Try again: put your team together" }));
    const link = workspaceLink();
    link.focus();
    view.rerender(<MeetCofounder {...base} launch={{ state: "assembling" }} />);
    expect(document.activeElement).toBe(link);
  });
});

describe("L1 T1 Meanwhile, building", () => {
  const steps = (items: [string, string, string, boolean][]): MeetProgress => ({
    started: true,
    steps: items.map(([key, title, state, notBuilt]) => ({ key, title, state, notBuilt })),
  });

  test("lists the built steps with their real state in words, and says the rest are coming later", async () => {
    const { container } = render(
      <MeanwhileBuilding
        progress={steps([
          ["blueprint", "Blueprint", "succeeded", false],
          ["brand_kit", "Brand kit", "running", false],
          ["email_sequence", "Email sequence", "waiting", false],
          ["social_pack", "Social pack", "failed", false],
          ["landing_spec", "Landing page", "skipped", true],
          ["seo_pack", "SEO pack", "skipped", true],
        ])}
      />,
    );
    const items = within(screen.getByRole("list")).getAllByRole("listitem");
    expect(items.map((item) => item.textContent)).toEqual([
      "BlueprintDone",
      "Brand kitWorking",
      "Email sequenceWaiting",
      "Social packFailed",
    ]);
    expect(screen.getByText("Landing page and seo pack are coming in a later update.")).toBeTruthy();
    expect(screen.getByText(/You can head into your workspace now/)).toBeTruthy();
    expect(container.textContent).not.toMatch(/deploy|site is live|% /i);
    await expectNoAxeViolations(container);
  });

  test("loading and not-started are honest, not a fake ticker", () => {
    render(<MeanwhileBuilding progress={undefined} />);
    expect(screen.getByText("Checking what is building…")).toBeTruthy();
    cleanup();
    render(<MeanwhileBuilding progress={{ started: false, steps: [] }} />);
    expect(screen.getByText(/Nothing is building yet/)).toBeTruthy();
  });

  test("the Meet screen shows it in the aside when given", () => {
    setup(ready, { meanwhile: <MeanwhileBuilding progress={steps([["blueprint", "Blueprint", "succeeded", false]])} /> });
    expect(screen.getByRole("heading", { level: 2, name: "Meanwhile, building" })).toBeTruthy();
  });
});

describe("WP75-S1 CofounderTeam (kept for Team HQ until its rebuild drops it)", () => {
  const base: CofounderTeamProps = { partnerName: "Wren", launch: undefined, onStart: vi.fn(), onRetry: vi.fn(), retrying: false, error: null };

  test("ready: hired and skipped in lists with their reasons, skipped said in text", async () => {
    const { container } = render(<CofounderTeam {...base} launch={ready} />);
    const [hiredList, skippedList] = screen.getAllByRole("list");
    if (hiredList === undefined || skippedList === undefined) throw new Error("expected two lists");
    expect(within(hiredList).getAllByRole("listitem")).toHaveLength(9);
    const skipped = within(skippedList).getAllByRole("listitem");
    expect(skipped).toHaveLength(4);
    expect(skipped[0]?.textContent).toContain(`${ready.skipped[0]?.roleLabel}: Skipped`);
    await expectNoAxeViolations(container);
  });

  test("failed: Try again calls back once", async () => {
    const onRetry = vi.fn();
    render(<CofounderTeam {...base} onRetry={onRetry} launch={{ state: "failed", paused: false, retryable: true }} />);
    await userEvent.setup().click(screen.getByRole("button", { name: "Try again: put your team together" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});

describe("WP75-S1 launch error copy", () => {
  test("maps refusals to plain messages and never leaks raw errors", () => {
    expect(launchErrorMessage(new ConvexError({ code: "AI_DISABLED" }))).toBe("AI work is switched off right now. Try again later.");
    expect(launchErrorMessage(new ConvexError({ kind: "RateLimited", name: "crewJob", retryAfter: 1000 })))
      .toMatch(/a lot of crew work this hour/);
    expect(launchErrorMessage(new Error("stack trace"))).toBe("Something went wrong. Try again.");
  });
});

describe("WP75-S1 LiveMeetCofounder", () => {
  const projectId = "project1" as Id<"projects">;
  const team = () => (
    <LiveMeetCofounder answers={hydrotrailWizardAnswers} business={{ projectId, name: "HydroTrail", slug: "hydrotrail" }} ideaTitle="HydroTrail" />
  );
  const named = (suffix: string) => live.calls.filter((call) => call.endsWith(suffix)).length;

  beforeEach(() => {
    live.launch = undefined;
    live.progress = undefined;
    live.calls = [];
    live.startError = null;
    live.retryError = null;
  });

  test("starts the launch once on mount, never again on re-render, and never retries by itself", async () => {
    live.launch = { state: "assembling" };
    const { rerender } = render(team());
    rerender(team());
    rerender(team());
    await waitFor(() => expect(named(":startLaunch")).toBe(1));
    expect(named(":retryLaunch")).toBe(0);
  });

  test("shows the live roster and the live launch steps", () => {
    live.launch = ready;
    live.progress = { started: true, steps: [{ key: "brand_kit", title: "Brand kit", state: "running", notBuilt: false }] };
    render(team());
    expect(within(screen.getByRole("list", { name: "Hired specialists" })).getAllByRole("listitem")).toHaveLength(9);
    expect(screen.getByText("Brand kit")).toBeTruthy();
    expect(teamHqLink().getAttribute("href")).toBe("/dashboard/b/project1/team");
  });

  test("a refused start shows the mapped words and Try again; a start that works clears them", async () => {
    const user = userEvent.setup();
    live.launch = { state: "not_started" };
    live.startError = new ConvexError({ kind: "RateLimited", name: "crewJob", retryAfter: 1000 });
    const { rerender } = render(team());
    expect((await screen.findByRole("alert")).textContent).toBe(
      "You have started a lot of crew work this hour. Try again in a little while.",
    );
    expect(screen.queryByText(/This takes about a minute/)).toBeNull();
    live.startError = null;
    await user.click(screen.getByRole("button", { name: "Try again: put your team together" }));
    await waitFor(() => expect(named(":startLaunch")).toBe(2));
    expect(named(":retryLaunch")).toBe(0);
    live.launch = { state: "assembling" };
    rerender(team());
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByText(/This takes about a minute/)).toBeTruthy();
  });

  test("a refused retry is shown until the launch moves on, then it is cleared as stale", async () => {
    const user = userEvent.setup();
    live.launch = { state: "failed", paused: false, retryable: true };
    live.retryError = new ConvexError({ code: "AI_DISABLED" });
    const { rerender } = render(team());
    await user.click(screen.getByRole("button", { name: "Try again: put your team together" }));
    expect((await screen.findByRole("alert")).textContent).toBe("AI work is switched off right now. Try again later.");
    expect(named(":retryLaunch")).toBe(1);
    await act(async () => {
      live.launch = { state: "assembling" };
      rerender(team());
    });
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
