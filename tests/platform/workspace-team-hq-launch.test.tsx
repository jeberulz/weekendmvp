// @vitest-environment jsdom
/**
 * L1-C6: launch progress and the team on Team HQ, through the real DOM and
 * axe-core: each state, Try again (`retryLaunch`), Resume (`resumeLaunch`), a
 * refusal in plain words, focus and live regions, and the section order.
 */
import axe from "axe-core";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ConvexError } from "convex/values";
import type { ReactNode } from "react";
import { afterEach, describe, expect, test, vi } from "vitest";

import type { Id } from "@/convex/_generated/dataModel";
import { progressSummary, resumeMessage, retryMessage } from "@/lib/workspace/reviewPages";

const live: { progress: unknown; status: unknown } = { progress: undefined, status: undefined };
const retryMock = vi.fn();
const resumeMock = vi.fn();
const otherMock = vi.fn();

vi.mock("convex/react", async () => {
  const { getFunctionName } = await import("convex/server");
  return {
    useQuery: (ref: Parameters<typeof getFunctionName>[0], args: unknown) => {
      if (args === "skip") return undefined;
      const name = getFunctionName(ref);
      if (name.includes("launchProgress")) return live.progress;
      if (name.includes("launchStatus")) return live.status;
      if (name.includes("pendingReviews")) return [];
      if (name.includes("blueprintDraft")) return { state: "none" };
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
const { LaunchProgress } = await import("@/components/workspace/team/LaunchProgress");
const { YourTeam } = await import("@/components/workspace/team/YourTeam");

const PROJECT = "project1" as Id<"projects">;

type StepState = "waiting" | "queued" | "running" | "paused" | "succeeded" | "failed" | "skipped";
const step = (key: string, title: string, state: StepState, extra: Record<string, unknown> = {}) => ({ key, title, state, ...extra });

const progress = (steps: ReturnType<typeof step>[], retryable = false) => ({ started: true, retryable, steps });

const HIRED = [{ roleKey: "ads", employeeName: "Ada", roleLabel: "Ads", reason: "You want a waitlist test." }];
const SKIPPED = [{ roleKey: "outbound", roleLabel: "Outbound", reason: "Nobody to email yet." }];

afterEach(() => {
  cleanup();
  retryMock.mockReset();
  resumeMock.mockReset();
  otherMock.mockReset();
  live.progress = undefined;
  live.status = undefined;
});

async function noAxe(container: Element) {
  const results = await axe.run(container, { runOnly: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] });
  expect(results.violations.map((v) => v.id)).toEqual([]);
}

describe("helpers", () => {
  test("summary and resume wording", () => {
    expect(progressSummary(["succeeded", "failed", "queued"])).toBe("1 of 3 steps done.");
    expect(progressSummary(["succeeded", "succeeded", "skipped", "skipped"])).toBe("2 of 2 steps done. 2 skipped for now.");
    expect(resumeMessage({ resumed: 1, waitingForSlot: false })).toBe("Resumed 1 step.");
    expect(resumeMessage({ resumed: 2, waitingForSlot: true })).toBe("Resumed 2 steps. Others are waiting for a free slot.");
    expect(resumeMessage({ resumed: 0, waitingForSlot: true })).toMatch(/busy with other work/);
    expect(resumeMessage({ resumed: 0, waitingForSlot: false })).toBe("Nothing was waiting to resume.");
    expect(retryMessage({ state: "failed" }, "Sent.")).toMatch(/Nothing could start yet/);
    expect(retryMessage({ state: "assembling" }, "Sent.")).toBe("Sent.");
  });
});

describe("Launch progress", () => {
  test("loading", () => {
    render(<LaunchProgress projectId={PROJECT} />);
    expect(screen.getByText("Loading your launch progress…")).toBeTruthy();
  });

  test("not started says so and offers no button or made-up link", () => {
    live.progress = { started: false, retryable: false, steps: [] };
    render(<LaunchProgress projectId={PROJECT} />);
    expect(screen.getByText("Your launch hasn't started yet, so there are no steps to show.")).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.queryByRole("link")).toBeNull();
  });

  test("each step shows its title, its state in words and its reason", () => {
    live.progress = progress([
      step("blueprint", "Blueprint", "succeeded"),
      step("roster", "Your team", "succeeded"),
      step("brand_kit", "Brand kit", "running"),
      step("email_sequence", "Waitlist emails", "queued", { reason: "Waiting for a free slot: your team is busy with other work." }),
      step("social_pack", "Social posts", "waiting", { reason: "Waits for the brand kit." }),
      step("ads", "Ad drafts", "skipped", { reason: "Not part of this launch." }),
    ]);
    render(<LaunchProgress projectId={PROJECT} />);
    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(6);
    expect(items[0].textContent).toBe("Blueprint: Done");
    expect(items[2].textContent).toBe("Brand kit: Running");
    expect(items[3].textContent).toContain("Waitlist emails: Queued");
    expect(items[3].textContent).toContain("Waiting for a free slot");
    expect(items[4].textContent).toContain("Social posts: Waiting");
    expect(items[5].textContent).toContain("Ad drafts: Skipped");
    expect(screen.getByText("2 of 5 steps done. 1 skipped for now.")).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
  });

  test("a failed step that no retry can help shows the reason and no button", () => {
    live.progress = progress([step("blueprint", "Blueprint", "failed", { retryable: false, reason: "This step could not finish, and trying again would not help." })]);
    render(<LaunchProgress projectId={PROJECT} />);
    expect(screen.getByText(/trying again would not help/)).toBeTruthy();
    expect(screen.getByRole("listitem").textContent).toContain("Blueprint: Failed");
    expect(screen.queryByRole("button")).toBeNull();
  });

  test("Try again calls retryLaunch, announces, and keeps focus on the button while it can still be retried", async () => {
    retryMock.mockResolvedValue({ state: "assembling" });
    live.progress = progress([step("brand_kit", "Brand kit", "failed", { retryable: true, reason: "This step did not finish. Try again to run it again." })], true);
    render(<LaunchProgress projectId={PROJECT} />);
    const user = userEvent.setup();
    const button = screen.getByRole("button", { name: "Try again: run the failed steps again" });
    await user.click(button);
    expect(retryMock).toHaveBeenCalledWith({ projectId: PROJECT });
    expect(resumeMock).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.getByText("Sent. Each step below shows where it stands.")).toBeTruthy());
    expect(screen.queryByText(/Trying the failed steps again/)).toBeNull();
    expect(document.activeElement).toBe(button);
    expect(screen.getByText("Each try counts toward your hourly crew work.")).toBeTruthy();
  });

  test("a Try again that did nothing says so and never claims work started", async () => {
    retryMock.mockResolvedValue({ state: "failed", paused: false, retryable: true });
    live.progress = progress([step("brand_kit", "Brand kit", "failed", { retryable: true })], true);
    render(<LaunchProgress projectId={PROJECT} />);
    await userEvent.setup().click(screen.getByRole("button", { name: /Try again/ }));
    await waitFor(() =>
      expect(screen.getByText("Nothing could start yet: your team is busy with other work. Try again in a few minutes.")).toBeTruthy(),
    );
    expect(screen.queryByText(/Sent\./)).toBeNull();
  });

  test("a double click makes one call, and while working the name carries the visible text", async () => {
    let finish: (value: unknown) => void = () => undefined;
    retryMock.mockReturnValue(new Promise((resolve) => { finish = resolve; }));
    live.progress = progress([step("brand_kit", "Brand kit", "failed", { retryable: true })], true);
    render(<LaunchProgress projectId={PROJECT} />);
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
    live.progress = progress(
      [step("brand_kit", "Brand kit", "failed", { retryable: true }), step("social_pack", "Social posts", "paused")],
      true,
    );
    render(<LaunchProgress projectId={PROJECT} />);
    await userEvent.setup().click(screen.getByRole("button", { name: /Try again/ }));
    expect(screen.getByRole("button", { name: /Resume/ }).getAttribute("aria-disabled")).toBe("true");
  });

  test("when the button goes away after a retry, focus moves to the heading", async () => {
    retryMock.mockResolvedValue({ state: "ready", hired: [], skipped: [] });
    live.progress = progress([step("brand_kit", "Brand kit", "failed", { retryable: true })], true);
    const { rerender } = render(<LaunchProgress projectId={PROJECT} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /Try again/ }));
    await waitFor(() => expect(screen.getByText(/^Sent\./)).toBeTruthy());
    live.progress = progress([step("brand_kit", "Brand kit", "running")]);
    rerender(<LaunchProgress projectId={PROJECT} />);
    expect(screen.queryByRole("button")).toBeNull();
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole("heading", { name: "Launch progress" })));
  });

  test("the blueprint and team stage is left to Your team: no second Try again or Resume", () => {
    live.progress = progress([step("blueprint", "Blueprint", "failed", { retryable: true, reason: "This step did not finish. Try again to run it again." })], true);
    const first = render(<LaunchProgress projectId={PROJECT} />);
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByText(/This step did not finish/)).toBeTruthy();
    first.unmount();
    live.progress = progress([step("blueprint", "Blueprint", "paused", { reason: "Paused." })]);
    render(<LaunchProgress projectId={PROJECT} />);
    expect(screen.queryByRole("button")).toBeNull();
  });

  test("a refused Try again says why in plain words", async () => {
    retryMock.mockRejectedValue(new ConvexError({ kind: "RateLimited" }));
    live.progress = progress([step("brand_kit", "Brand kit", "failed", { retryable: true })], true);
    render(<LaunchProgress projectId={PROJECT} />);
    await userEvent.setup().click(screen.getByRole("button", { name: /Try again/ }));
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toBe("You have started a lot of crew work this hour. Try again in a little while.");
  });

  test("an unknown refusal is generic, never the raw error", async () => {
    retryMock.mockRejectedValue(new Error("secret internals"));
    live.progress = progress([step("brand_kit", "Brand kit", "failed", { retryable: true })], true);
    render(<LaunchProgress projectId={PROJECT} />);
    await userEvent.setup().click(screen.getByRole("button", { name: /Try again/ }));
    expect((await screen.findByRole("alert")).textContent).toBe("Something went wrong. Try again.");
  });

  test("a paused step is resumed with resumeLaunch and the result is announced", async () => {
    resumeMock.mockResolvedValue({ resumed: 1, paused: 0, waitingForSlot: false });
    live.progress = progress([step("brand_kit", "Brand kit", "paused", { reason: "Paused: the AI budget ran out." })]);
    render(<LaunchProgress projectId={PROJECT} />);
    const user = userEvent.setup();
    expect(screen.getByRole("listitem").textContent).toContain("Brand kit: Paused");
    expect(screen.queryByRole("button", { name: /Try again/ })).toBeNull();
    await user.click(screen.getByRole("button", { name: "Resume: restart the paused steps" }));
    expect(resumeMock).toHaveBeenCalledWith({ projectId: PROJECT });
    expect(retryMock).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.getByText("Resumed 1 step.")).toBeTruthy());
  });

  test("a refused Resume shows a plain error", async () => {
    resumeMock.mockRejectedValue(new ConvexError({ code: "AI_DISABLED" }));
    live.progress = progress([step("brand_kit", "Brand kit", "paused")]);
    render(<LaunchProgress projectId={PROJECT} />);
    await userEvent.setup().click(screen.getByRole("button", { name: /Resume/ }));
    expect((await screen.findByRole("alert")).textContent).toBe("AI work is switched off right now. Try again later.");
  });

  test("passes axe with failed, paused and running steps and both buttons", async () => {
    live.progress = progress(
      [
        step("blueprint", "Blueprint", "succeeded"),
        step("brand_kit", "Brand kit", "failed", { retryable: true, reason: "This step did not finish." }),
        step("social_pack", "Social posts", "paused"),
        step("email_sequence", "Waitlist emails", "running"),
      ],
      true,
    );
    const { container } = render(<LaunchProgress projectId={PROJECT} />);
    await noAxe(container);
  });
});

describe("Your team", () => {
  test("loading", () => {
    render(<YourTeam projectId={PROJECT} />);
    expect(screen.getByText("Loading your team…")).toBeTruthy();
  });

  test("not started does not claim the team is being put together", () => {
    live.status = { state: "not_started" };
    render(<YourTeam projectId={PROJECT} />);
    expect(screen.getByText("Your launch hasn't started, so there is no team yet.")).toBeTruthy();
    expect(screen.queryByText(/putting your team together/)).toBeNull();
    expect(screen.queryByRole("button")).toBeNull();
  });

  test("assembling", () => {
    live.status = { state: "assembling" };
    render(<YourTeam projectId={PROJECT} />);
    expect(screen.getAllByText(/is putting your team together/).length).toBeGreaterThan(0);
    expect(screen.queryByRole("button")).toBeNull();
  });

  test("a retry that did nothing says so here too", async () => {
    retryMock.mockResolvedValue({ state: "failed", paused: true, retryable: true });
    live.status = { state: "failed", paused: true, retryable: true };
    render(<YourTeam projectId={PROJECT} />);
    await userEvent.setup().click(screen.getByRole("button", { name: /Try again/ }));
    await waitFor(() => expect(screen.getByText(/Nothing could start yet/)).toBeTruthy());
  });

  test("a retry that went through says sent, not that work started", async () => {
    retryMock.mockResolvedValue({ state: "assembling" });
    live.status = { state: "failed", paused: false, retryable: true };
    render(<YourTeam projectId={PROJECT} />);
    await userEvent.setup().click(screen.getByRole("button", { name: /Try again/ }));
    await waitFor(() => expect(screen.getByText("Sent. Launch progress above shows where each step stands.")).toBeTruthy());
  });

  test("failed offers Try again through retryLaunch", async () => {
    retryMock.mockResolvedValue({ state: "assembling" });
    live.status = { state: "failed", paused: false, retryable: true };
    render(<YourTeam projectId={PROJECT} />);
    await userEvent.setup().click(screen.getByRole("button", { name: "Try again: put your team together" }));
    expect(retryMock).toHaveBeenCalledWith({ projectId: PROJECT });
  });

  test("failed with no retry that helps shows a plain message and no button", () => {
    live.status = { state: "failed", paused: false, retryable: false };
    render(<YourTeam projectId={PROJECT} />);
    expect(screen.getByText(/trying again will not change it/)).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
  });

  test("a refused retry shows a plain error", async () => {
    retryMock.mockRejectedValue(new ConvexError({ kind: "RateLimited" }));
    live.status = { state: "failed", paused: false, retryable: true };
    render(<YourTeam projectId={PROJECT} />);
    await userEvent.setup().click(screen.getByRole("button", { name: /Try again/ }));
    expect((await screen.findByRole("alert")).textContent).toMatch(/a lot of crew work/);
  });

  test("ready shows hired and skipped roles under an h2 with h3 sub-headings", () => {
    live.status = { state: "ready", hired: HIRED, skipped: SKIPPED };
    render(<YourTeam projectId={PROJECT} />);
    expect(screen.getByRole("heading", { level: 2, name: "Your team" })).toBeTruthy();
    expect(screen.getByRole("heading", { level: 3, name: "Hired" })).toBeTruthy();
    expect(screen.getByText("Ada")).toBeTruthy();
    expect(screen.getByText("You want a waitlist test.")).toBeTruthy();
    expect(screen.getByText("Skipped")).toBeTruthy();
    expect(screen.getByText("Nobody to email yet.")).toBeTruthy();
  });

  test("passes axe when ready", async () => {
    live.status = { state: "ready", hired: HIRED, skipped: SKIPPED };
    const { container } = render(<YourTeam projectId={PROJECT} />);
    await noAxe(container);
  });
});

describe("Team HQ order", () => {
  test("Waiting on you, Launch progress, Your team, Your blueprint", () => {
    live.progress = progress([step("blueprint", "Blueprint", "succeeded")]);
    live.status = { state: "ready", hired: HIRED, skipped: [] };
    render(<TeamHqPanel projectId={PROJECT} />);
    const names = screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent);
    expect(names).toEqual(["Waiting on you", "Launch progress", "Your team", "Your blueprint"]);
    expect(screen.getByText("1 of 1 steps done.")).toBeTruthy();
  });
});
