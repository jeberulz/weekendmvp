// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { getFunctionName } from "convex/server";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { axe } from "vitest-axe";

import type { WizardSessionView } from "@/convex/workspace/wizard";
import { wizardSeedFor } from "@/lib/workspace/wizard/defaults";

type Mutation = (args: Record<string, unknown>) => Promise<unknown>;

const state = vi.hoisted(() => ({
  view: undefined as unknown,
  calls: [] as { name: string; args: Record<string, unknown> }[],
  replace: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: state.replace }) }));
vi.mock("convex/react", async () => {
  const { getFunctionName: name } = await import("convex/server");
  return {
    useQuery: () => state.view,
    useMutation: (ref: Parameters<typeof name>[0]): Mutation => async (args) => {
      const fn = name(ref);
      state.calls.push({ name: fn, args });
      if (fn.endsWith(":startOrResume")) return "session123";
      return { applied: true, step: "blueprint", completed: false, action: "kept" };
    },
  };
});

import { WizardFlow } from "@/components/workspace/wizard/WizardFlow";
import { api } from "@/convex/_generated/api";

afterEach(cleanup);

const seed = wizardSeedFor({ idea: { source: "library", ideaSlug: "hydrotrail" } });

function view(step: WizardSessionView["step"], stepIndex: number, completed = false): WizardSessionView {
  return {
    sessionId: "session123" as WizardSessionView["sessionId"],
    step,
    stepIndex,
    totalSteps: 8,
    completed,
    ideaTitle: "HydroTrail",
    answers: { idea: { source: "library", ideaSlug: "hydrotrail" } },
    defaults: seed.defaults,
    suggestedNames: [...seed.suggestedNames],
    blueprint: { ...seed.blueprint, features: [...seed.blueprint.features], scopeCuts: [...seed.blueprint.scopeCuts] },
    seedSource: "fixture_hydrotrail",
  };
}

describe("WP74-S1 WizardFlow", () => {
  beforeEach(() => {
    state.view = undefined;
    state.calls = [];
    state.replace.mockReset();
  });

  test("a library idea starts or resumes its session on open, then renders the server's current step", async () => {
    const { rerender } = render(<WizardFlow idea={{ source: "library", ideaSlug: "hydrotrail" }} ideaTitle="HydroTrail" initialSessionId={null} />);
    await waitFor(() => expect(state.calls[0]?.name).toBe(getFunctionName(api.workspace.wizard.startOrResume)));
    expect(state.calls[0]?.args).toEqual({ idea: { source: "library", ideaSlug: "hydrotrail" } });
    expect(screen.getByText("Opening your build…")).toBeTruthy();

    // The live query answers with a resumed session already on step 3.
    state.view = view("platform", 2);
    rerender(<WizardFlow idea={{ source: "library", ideaSlug: "hydrotrail" }} ideaTitle="HydroTrail" initialSessionId={null} />);
    expect(screen.getByRole("heading", { level: 1, name: "Build HydroTrail" })).toBeTruthy();
    expect(screen.getByRole("heading", { level: 2, name: "Where should people use it?" })).toBeTruthy();
    expect(screen.getByText("Step 3 of 8: Platform")).toBeTruthy();
  });

  test("accepting sends the suggested default for the current step; a step change is announced and focused", async () => {
    state.view = view("platform", 2);
    const props = { idea: { source: "library" as const, ideaSlug: "hydrotrail" }, ideaTitle: "HydroTrail", initialSessionId: null };
    const { rerender, container } = render(<WizardFlow {...props} />);
    await userEvent.setup().click(screen.getByRole("button", { name: "Use this platform" }));
    const save = state.calls.find((call) => call.name === getFunctionName(api.workspace.wizard.saveStep));
    expect(save?.args).toEqual({ sessionId: "session123", step: "platform", answer: { kind: "web" } });

    await act(async () => {
      state.view = view("commercial_model", 3);
      rerender(<WizardFlow {...props} />);
    });
    const live = container.querySelector('[aria-live="polite"]');
    expect(live?.textContent).toBe("Step 4 of 8: Commercial model");
    expect(document.activeElement?.textContent).toBe("How will it make money?");
    const results = await axe(container, { rules: { "color-contrast": { enabled: false } } });
    expect(results.violations.map((violation) => violation.id)).toEqual([]);
  });

  test("own idea: the first sentence starts a session and puts its id in the URL for reloads", async () => {
    render(<WizardFlow idea={null} ideaTitle={null} initialSessionId={null} />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Your idea in one sentence"), "A packing list for campers");
    await user.click(screen.getByRole("button", { name: "Start building" }));
    await waitFor(() => expect(state.replace).toHaveBeenCalledWith("/start/own?session=session123", { scroll: false }));
    expect(state.calls[0]?.args).toEqual({ idea: { source: "own_idea", text: "A packing list for campers" } });
  });

  test("a library session rewritten as an own idea moves to the own-idea URL, carrying the session", async () => {
    state.view = { ...view("blueprint", 1), ideaTitle: "Trail water refill map", answers: { idea: { source: "own_idea", text: "Trail water refill map" } } };
    const props = { idea: { source: "library" as const, ideaSlug: "hydrotrail" }, ideaTitle: "HydroTrail", initialSessionId: null };
    const { rerender } = render(<WizardFlow {...props} />);
    await waitFor(() => expect(state.replace).toHaveBeenCalledWith("/start/own?session=session123", { scroll: false }));
    rerender(<WizardFlow {...props} />);
    expect(state.replace).toHaveBeenCalledTimes(1);
  });

  test("a library session that stays a library idea keeps its URL", async () => {
    state.view = view("blueprint", 1);
    render(<WizardFlow idea={{ source: "library", ideaSlug: "hydrotrail" }} ideaTitle="HydroTrail" initialSessionId={null} />);
    await waitFor(() => expect(state.calls.length).toBeGreaterThan(0));
    expect(state.replace).not.toHaveBeenCalled();
  });

  test("the finished session shows Meet your co-founder and creates nothing", () => {
    state.view = { ...view("partner_name", 7, true), answers: seed.defaults };
    render(<WizardFlow idea={{ source: "library", ideaSlug: "hydrotrail" }} ideaTitle="HydroTrail" initialSessionId={null} />);
    expect(screen.getByRole("heading", { level: 2, name: "Meet Wren, your co-founder" })).toBeTruthy();
    expect(screen.getByText("All 8 steps done")).toBeTruthy();
    expect(state.calls.map((call) => call.name).filter((name) => !name.endsWith(":startOrResume"))).toEqual([]);
  });
});
