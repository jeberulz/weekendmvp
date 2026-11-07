// @vitest-environment jsdom
/**
 * WP75-S1. The team on Meet your co-founder: "putting your team together",
 * the failed state with its Retry button, and the hired and skipped roles with
 * their C-ROSTER reasons. Rendered from the pure roster (`planRoster` on the
 * HydroTrail input), with axe on every state.
 */
import { act, cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ConvexError } from "convex/values";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { axe } from "vitest-axe";

import {
  CofounderTeam,
  LiveCofounderTeam,
  MeetCofounder,
  launchErrorMessage,
  teamAnnouncement,
  type CofounderTeamProps,
} from "@/components/workspace/wizard/MeetCofounder";
import type { Id } from "@/convex/_generated/dataModel";
import { planRoster } from "@/convex/crew/roles";
import { hydrotrailRosterInput, hydrotrailWizardAnswers } from "@/lib/workspace/contracts/fixtures/hydrotrail";
import { readyLaunchView, type LaunchView } from "@/lib/workspace/crew/launch";

type Mutation = (args: Record<string, unknown>) => Promise<unknown>;

const live = vi.hoisted(() => ({
  launch: undefined as unknown,
  calls: [] as string[],
  startError: null as unknown,
  retryError: null as unknown,
}));

// Only `LiveCofounderTeam` uses these hooks; `CofounderTeam` and `MeetCofounder` are pure.
vi.mock("convex/react", async () => {
  const { getFunctionName: name } = await import("convex/server");
  return {
    useQuery: () => live.launch,
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

function setup(launch: LaunchView | undefined, overrides: Partial<CofounderTeamProps> = {}) {
  const onRetry = vi.fn();
  const onStart = vi.fn();
  const props: CofounderTeamProps = { partnerName: "Wren", launch, onStart, onRetry, retrying: false, error: null, ...overrides };
  const view = render(
    <MeetCofounder
      answers={hydrotrailWizardAnswers}
      business={{ projectId: "proj1", name: "HydroTrail", slug: "hydrotrail" }}
      team={<CofounderTeam {...props} />}
    />,
  );
  return { ...view, onRetry, onStart, user: userEvent.setup() };
}

async function expectNoAxeViolations(container: Element) {
  // jsdom cannot paint, so axe's colour-contrast rule cannot run here; the home-* token pairs are checked live.
  const results = await axe(container, { rules: { "color-contrast": { enabled: false } } });
  expect(results.violations.map((violation) => `${violation.id}: ${violation.help}`)).toEqual([]);
}

const status = () => screen.getByRole("status");

describe("WP75-S1 Meet your co-founder: the team", () => {
  test("headings run h2 → h3 → h4", () => {
    setup(ready);
    expect(screen.getByRole("heading", { level: 2, name: "Meet Wren, your co-founder" })).toBeTruthy();
    expect(screen.getByRole("heading", { level: 3, name: "Your team" })).toBeTruthy();
    expect(screen.getAllByRole("heading", { level: 4 }).map((heading) => heading.textContent)).toEqual(["Hired", "Skipped for now"]);
  });

  test("putting your team together: a polite status, no list, no retry", async () => {
    const { container } = setup({ state: "assembling" });
    expect(status().getAttribute("aria-live")).toBe("polite");
    expect(status().textContent).toBe("Wren is putting your team together.");
    expect(screen.getByText(/Wren is putting your team together\. This takes about a minute\./)).toBeTruthy();
    expect(screen.queryByRole("list")).toBeNull();
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.queryByText("Wren puts your team together in the next step.")).toBeNull();
    await expectNoAxeViolations(container);
  });

  test("loading and not-started read as putting the team together", () => {
    setup(undefined);
    expect(status().textContent).toBe("Wren is putting your team together.");
    cleanup();
    setup({ state: "not_started" });
    expect(status().textContent).toBe("Wren is putting your team together.");
  });

  test("failed: the reason, a clearly labelled Retry that calls back once, and the announcement", async () => {
    const { container, onRetry, user } = setup({ state: "failed", paused: false, retryable: true });
    expect(status().textContent).toBe("Wren could not put your team together. You can try again.");
    const retry = screen.getByRole("button", { name: "Try again: put your team together" });
    expect(retry.textContent).toBe("Try again");
    const description = document.getElementById(retry.getAttribute("aria-describedby") ?? "");
    expect(description?.textContent).toMatch(/could not put your team together this time\. Nothing was charged\./);
    await user.click(retry);
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("list")).toBeNull();
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

  test("ready: 9 hired and 4 skipped in lists, each with its C-ROSTER reason; skipped is said in text", async () => {
    const { container } = setup(ready);
    expect(status().textContent).toBe("Your team is ready: 9 hired, 4 skipped for now.");
    const [hiredList, skippedList] = screen.getAllByRole("list");
    if (hiredList === undefined || skippedList === undefined) throw new Error("expected two lists");
    const hired = within(hiredList).getAllByRole("listitem");
    expect(hired).toHaveLength(9);
    expect(hired[0]?.textContent).toBe(`Wren, Crew Lead${ready.hired[0]?.reason ?? ""}`);
    for (const [index, role] of ready.hired.entries()) {
      expect(hired[index]?.textContent).toContain(`${role.employeeName}, ${role.roleLabel}`);
      expect(hired[index]?.textContent).toContain(role.reason);
    }
    const skipped = within(skippedList).getAllByRole("listitem");
    expect(skipped).toHaveLength(4);
    for (const [index, role] of ready.skipped.entries()) {
      expect(skipped[index]?.textContent).toContain(`${role.roleLabel}: Skipped`);
      expect(skipped[index]?.textContent).toContain(role.reason);
    }
    expect(within(skippedList).getByText("No course content")).toBeTruthy();
    expect(within(hiredList).getByText("Goal has a paid push: $7/day test")).toBeTruthy();
    // Q13: no approval card and no approve button; the team just appears.
    expect(screen.queryByRole("button")).toBeNull();
    await expectNoAxeViolations(container);
  });

  test("a refused start or retry shows plain words in an alert", async () => {
    const { container } = setup({ state: "failed", paused: false, retryable: true }, { error: "AI work is switched off right now. Try again later." });
    expect(screen.getByRole("alert").textContent).toBe("AI work is switched off right now. Try again later.");
    await expectNoAxeViolations(container);
  });

  test("the status region stays mounted across state changes", () => {
    const onRetry = vi.fn();
    const base = { partnerName: "Wren", onRetry, onStart: vi.fn(), retrying: false, error: null };
    const { rerender } = render(<CofounderTeam {...base} launch={{ state: "assembling" }} />);
    const region = status();
    rerender(<CofounderTeam {...base} launch={ready} />);
    expect(status()).toBe(region);
    expect(region.textContent).toBe(teamAnnouncement(ready, "Wren"));
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

  test("after Try again, focus moves to the team heading when the button goes away (WCAG 2.4.3)", async () => {
    const user = userEvent.setup();
    const base = { partnerName: "Wren", onRetry: vi.fn(), onStart: vi.fn(), error: null };
    const { rerender } = render(<CofounderTeam {...base} retrying={false} launch={{ state: "failed", paused: false, retryable: true }} />);
    const retry = screen.getByRole("button", { name: "Try again: put your team together" });
    await user.click(retry);
    rerender(<CofounderTeam {...base} retrying launch={{ state: "failed", paused: false, retryable: true }} />);
    expect(document.activeElement).toBe(retry);
    rerender(<CofounderTeam {...base} retrying={false} launch={{ state: "assembling" }} />);
    const heading = screen.getByRole("heading", { level: 3, name: "Your team" });
    expect(heading.getAttribute("tabindex")).toBe("-1");
    expect(document.activeElement).toBe(heading);
  });

  test("the heading never takes focus the founder did not lose to Try again", () => {
    const base = { partnerName: "Wren", onRetry: vi.fn(), onStart: vi.fn(), retrying: false, error: null };
    const { rerender } = render(<CofounderTeam {...base} launch={{ state: "failed", paused: false, retryable: true }} />);
    rerender(<CofounderTeam {...base} launch={{ state: "assembling" }} />);
    expect(document.activeElement).toBe(document.body);
  });

  test("after Try again, focus the founder moved elsewhere stays where they put it", async () => {
    const user = userEvent.setup();
    const base = { partnerName: "Wren", onRetry: vi.fn(), onStart: vi.fn(), retrying: false, error: null };
    const page = (launch: LaunchView) => (
      <>
        <CofounderTeam {...base} launch={launch} />
        <button type="button">Elsewhere</button>
      </>
    );
    const { rerender } = render(page({ state: "failed", paused: false, retryable: true }));
    await user.click(screen.getByRole("button", { name: "Try again: put your team together" }));
    const elsewhere = screen.getByRole("button", { name: "Elsewhere" });
    elsewhere.focus();
    rerender(page({ state: "assembling" }));
    expect(document.activeElement).toBe(elsewhere);
  });

  test("without a team section the screen keeps its WP74 line", () => {
    render(<MeetCofounder answers={hydrotrailWizardAnswers} business={{ projectId: "proj1", name: "HydroTrail", slug: "hydrotrail" }} />);
    expect(screen.getByText("Wren puts your team together in the next step.")).toBeTruthy();
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

describe("WP75-S1 LiveCofounderTeam", () => {
  const projectId = "project1" as Id<"projects">;
  const team = () => <LiveCofounderTeam projectId={projectId} partnerName="Wren" />;
  const named = (suffix: string) => live.calls.filter((call) => call.endsWith(suffix)).length;

  beforeEach(() => {
    live.launch = undefined;
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
