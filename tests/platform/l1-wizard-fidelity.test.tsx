// @vitest-environment jsdom
/**
 * L1 UI fidelity (wave 2): the wizard frame and Meet your co-founder, through
 * the real `WizardFlow`. Eight steps (D10: no SMS anywhere), at most two clicks
 * to change an answer, the Founder signals aside, "Save & exit" only when a
 * session can be resumed, and the Meet screen's states and Team HQ link.
 */
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { getFunctionName } from "convex/server";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { axe } from "vitest-axe";

import type { WizardSessionView } from "@/convex/workspace/wizard";
import { planRoster } from "@/convex/crew/roles";
import { hydrotrailRosterInput } from "@/lib/workspace/contracts/fixtures/hydrotrail";
import { WIZARD_STEPS, type WizardStep } from "@/lib/workspace/contracts/wizard";
import { readyLaunchView } from "@/lib/workspace/crew/launch";
import { wizardSeedFor } from "@/lib/workspace/wizard/defaults";

type Mutation = (args: Record<string, unknown>) => Promise<unknown>;

const state = vi.hoisted(() => ({
  view: undefined as unknown,
  launch: undefined as unknown,
  progress: undefined as unknown,
  calls: [] as { name: string; args: Record<string, unknown> }[],
  replace: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: state.replace }) }));
vi.mock("convex/react", async () => {
  const { getFunctionName: name } = await import("convex/server");
  return {
    useQuery: (ref: Parameters<typeof name>[0]) => {
      const fn = name(ref);
      if (fn.endsWith(":launchStatus")) return state.launch;
      if (fn.endsWith(":launchProgress")) return state.progress;
      return state.view;
    },
    useMutation: (ref: Parameters<typeof name>[0]): Mutation => async (args) => {
      const fn = name(ref);
      state.calls.push({ name: fn, args });
      if (fn.endsWith(":startOrResume")) return "session123";
      return { applied: true };
    },
  };
});

import { WizardFlow } from "@/components/workspace/wizard/WizardFlow";
import { api } from "@/convex/_generated/api";

afterEach(cleanup);

const seed = wizardSeedFor({ idea: { source: "library", ideaSlug: "hydrotrail" } });
const library = { idea: { source: "library" as const, ideaSlug: "hydrotrail" }, ideaTitle: "HydroTrail", initialSessionId: null };

function view(
  index: number,
  overrides: Partial<WizardSessionView> = {},
): WizardSessionView {
  return {
    sessionId: "session123" as WizardSessionView["sessionId"],
    step: WIZARD_STEPS[index] as WizardStep,
    stepIndex: index,
    totalSteps: 8,
    completed: false,
    ideaTitle: "HydroTrail",
    answers: { idea: { source: "library", ideaSlug: "hydrotrail" } },
    defaults: seed.defaults,
    suggestedNames: [...seed.suggestedNames],
    suggestedPartnerNames: [...seed.suggestedPartnerNames],
    blueprint: { ...seed.blueprint, features: [...seed.blueprint.features], scopeCuts: [...seed.blueprint.scopeCuts] },
    seedSource: "fixture_hydrotrail",
    business: null,
    ...overrides,
  };
}

const withBusiness = (): WizardSessionView =>
  view(7, {
    completed: true,
    answers: seed.defaults,
    business: { projectId: "project1" as never, name: "HydroTrail", slug: "hydrotrail" },
  });

async function axeClean(container: Element) {
  const results = await axe(container, { rules: { "color-contrast": { enabled: false } } });
  expect(results.violations.map((violation) => `${violation.id}: ${violation.help}`)).toEqual([]);
}

beforeEach(() => {
  state.view = undefined;
  state.launch = { state: "assembling" };
  state.progress = { started: false, steps: [] };
  state.calls = [];
  state.replace.mockReset();
});

describe("L1 wizard: eight steps, no SMS", () => {
  test.each(WIZARD_STEPS.map((step, index) => [step, index] as const))("step %s says of 8 and mentions no SMS, phone or match score", (step, index) => {
    state.view = view(index);
    const { container } = render(<WizardFlow {...library} />);
    expect(screen.getByText(new RegExp(`^Step ${index + 1} of 8 · `))).toBeTruthy();
    expect(container.textContent).not.toMatch(/of 9|\bSMS\b|phone number|text me|reply stop|% MATCH|N°/i);
    expect(screen.getByRole("list", { name: "Onboarding steps" }).querySelectorAll("li")).toHaveLength(8);
    expect(step).toBe(WIZARD_STEPS[index]);
  });

  test("the frame: logo as a labelled image, banner, one main landmark, one h1", async () => {
    state.view = view(2);
    const { container } = render(<WizardFlow {...library} />);
    expect(screen.getByRole("img", { name: "Weekend MVP" })).toBeTruthy();
    expect(screen.getAllByRole("main")).toHaveLength(1);
    expect(container.querySelectorAll("h1")).toHaveLength(1);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Where should it live first?");
    await axeClean(container);
  });
});

describe("L1 wizard: changing an answer takes at most two clicks", () => {
  test("pick another platform, then Continue: the choice is saved, not the suggestion", async () => {
    state.view = view(2);
    render(<WizardFlow {...library} />);
    let clicks = 0;
    const count = (event: Event) => {
      if (event.target instanceof HTMLElement && event.target.closest("label, button, a")) clicks += 1;
    };
    document.addEventListener("click", count, true);
    const user = userEvent.setup();
    await user.click(screen.getByRole("radio", { name: /iOS and Android app/ }));
    await user.click(screen.getByRole("button", { name: "Continue" }));
    document.removeEventListener("click", count, true);
    await waitFor(() => expect(state.calls.some((call) => call.name === getFunctionName(api.workspace.wizard.saveStep))).toBe(true));
    expect(state.calls.find((call) => call.name === getFunctionName(api.workspace.wizard.saveStep))?.args).toEqual({
      sessionId: "session123",
      step: "platform",
      answer: { kind: "native" },
    });
    expect(clicks).toBe(2);
  });

  test("keeping the suggestion is one click on Use suggested · Continue", async () => {
    state.view = view(3);
    render(<WizardFlow {...library} />);
    await userEvent.setup().click(screen.getByRole("button", { name: "Use suggested · Continue" }));
    await waitFor(() => expect(state.calls.length).toBeGreaterThan(0));
    expect(state.calls.find((call) => call.name === getFunctionName(api.workspace.wizard.saveStep))?.args).toMatchObject({
      step: "commercial_model",
      answer: seed.defaults.commercialModel,
    });
  });

  test("the back chevron goes one step back in one click", async () => {
    state.view = view(4);
    render(<WizardFlow {...library} />);
    await userEvent.setup().click(screen.getByRole("button", { name: "Back to previous step" }));
    await waitFor(() => expect(state.calls.length).toBeGreaterThan(0));
    expect(state.calls.find((call) => call.name === getFunctionName(api.workspace.wizard.goBack))?.args).toEqual({
      sessionId: "session123",
      step: "goal",
    });
  });
});

describe("L1 wizard: Founder signals aside", () => {
  test("shows what the founder kept and changed, tagged in words, beside the step", async () => {
    state.view = view(5, {
      answers: {
        ...seed.defaults,
        signals: {
          platform: { signal: "kept", note: "Approved suggested platform: Mobile web, installable" },
          goal: { signal: "edited", note: "Changed goal: First 50 waitlist signups → First sale" },
        },
      },
    });
    const { container } = render(<WizardFlow {...library} />);
    const aside = screen.getByRole("complementary", { name: "Founder signals" });
    expect(within(aside).getByText("2 logged")).toBeTruthy();
    const rows = within(aside).getAllByRole("listitem");
    expect(rows.map((row) => row.textContent)).toEqual([
      "KEPTApproved suggested platform: Mobile web, installable",
      "EDITChanged goal: First 50 waitlist signups → First sale",
    ]);
    await axeClean(container);
  });

  test("empty at the start, and gone once the business exists", () => {
    state.view = view(0);
    const { unmount } = render(<WizardFlow {...library} />);
    expect(screen.getByText("Signals appear as you answer.")).toBeTruthy();
    unmount();
    state.view = withBusiness();
    render(<WizardFlow {...library} />);
    expect(screen.queryByRole("complementary", { name: "Founder signals" })).toBeNull();
  });
});

describe("L1 wizard: Save & exit only when a session can be resumed", () => {
  test("a library idea resumes by its slug, so the link goes back to the idea", () => {
    state.view = view(1);
    render(<WizardFlow {...library} />);
    expect(screen.getByRole("link", { name: "Save & exit" }).getAttribute("href")).toBe("/ideas/hydrotrail");
  });

  test("an own idea has no link until its first sentence starts a session, then it goes to the ideas index", () => {
    state.view = undefined;
    const { unmount } = render(<WizardFlow idea={null} ideaTitle={null} initialSessionId={null} />);
    expect(screen.queryByRole("link", { name: /Save/ })).toBeNull();
    unmount();
    state.view = view(2, { answers: { idea: { source: "own_idea", text: "A packing list" } } });
    render(<WizardFlow idea={null} ideaTitle={null} initialSessionId="session123" />);
    expect(screen.getByRole("link", { name: "Save & exit" }).getAttribute("href")).toBe("/ideas");
  });

  test("an own idea's first step tells the founder the answers save as they go", () => {
    state.view = view(0, { answers: { idea: { source: "own_idea", text: "A packing list" } }, defaults: wizardSeedFor({ idea: { source: "own_idea", text: "A packing list" } }).defaults });
    render(<WizardFlow idea={null} ideaTitle={null} initialSessionId="session123" />);
    expect(screen.getByText("Your answers save as you go. Bookmark this page to come back.")).toBeTruthy();
  });

  test("there is nothing to save once the business exists", () => {
    state.view = withBusiness();
    render(<WizardFlow {...library} initialSessionId="session123" />);
    expect(screen.queryByRole("link", { name: /Save/ })).toBeNull();
  });
});

describe("L1 wizard: Meet your co-founder after the business exists", () => {
  test("assembling: the hero is the h1, all eight steps are done, the caption says Meet your co-founder, and Team HQ is one click away", async () => {
    state.view = withBusiness();
    state.launch = { state: "assembling" };
    const { container } = render(<WizardFlow {...library} initialSessionId="session123" />);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Hi, I'm Wren.");
    expect(screen.getByText("Meet your co-founder")).toBeTruthy();
    const steps = within(screen.getByRole("list", { name: "Onboarding steps" })).getAllByRole("listitem");
    expect(steps.every((item) => item.textContent?.includes("(done)"))).toBe(true);
    expect(screen.queryByRole("button", { name: "Back to previous step" })).toBeNull();
    expect(screen.getByRole("link", { name: "Meet your team in Team HQ" }).getAttribute("href")).toBe("/dashboard/b/project1/team");
    expect(screen.getByRole("link", { name: "Go to your workspace" }).getAttribute("href")).toBe("/dashboard/b/project1");
    expect(container.textContent).not.toMatch(/Assemble my team/);
    await axeClean(container);
  });

  test("ready: the dark Team ready banner and the hired rows", async () => {
    state.view = withBusiness();
    state.launch = readyLaunchView(planRoster(hydrotrailRosterInput));
    state.progress = {
      started: true,
      steps: [
        { key: "blueprint", title: "Blueprint", state: "succeeded", notBuilt: false },
        { key: "brand_kit", title: "Brand kit", state: "running", notBuilt: false },
        { key: "landing_spec", title: "Landing page", state: "skipped", notBuilt: true },
      ],
    };
    const { container } = render(<WizardFlow {...library} initialSessionId="session123" />);
    expect(within(screen.getByRole("list", { name: "Hired specialists" })).getAllByRole("listitem")).toHaveLength(9);
    expect(screen.getByText("Team ready · 9 hired · 4 skipped")).toBeTruthy();
    expect(screen.getByText("Brand kit")).toBeTruthy();
    expect(screen.getByText("Landing page is coming in a later update.")).toBeTruthy();
    await axeClean(container);
  });

  test("failed: the failure copy and Try again, with the workspace link still there", async () => {
    state.view = withBusiness();
    state.launch = { state: "failed", paused: false, retryable: true };
    const { container } = render(<WizardFlow {...library} initialSessionId="session123" />);
    expect(screen.getByRole("button", { name: "Try again: put your team together" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Go to your workspace" })).toBeTruthy();
    await axeClean(container);
  });
});
