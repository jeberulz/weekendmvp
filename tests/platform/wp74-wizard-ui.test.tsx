// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ConvexError } from "convex/values";
import { afterEach, describe, expect, test, vi } from "vitest";
import { axe } from "vitest-axe";

import { MeetCofounder } from "@/components/workspace/wizard/MeetCofounder";
import { wizardErrorMessage } from "@/components/workspace/wizard/WizardFlow";
import { WizardProgress, progressLabel } from "@/components/workspace/wizard/WizardProgress";
import { WizardStepPanel, type WizardStepPanelProps } from "@/components/workspace/wizard/WizardStepPanel";
import type { WizardStep } from "@/lib/workspace/contracts/wizard";
import { wizardSeedFor } from "@/lib/workspace/wizard/defaults";

afterEach(cleanup);

// jsdom has no CSS.escape; user-event's radio arrow-key walk needs it.
if (typeof globalThis.CSS === "undefined" || typeof globalThis.CSS.escape !== "function") {
  Object.assign(globalThis, {
    CSS: { escape: (value: string) => value.replace(/[^a-zA-Z0-9_-]/g, (char) => `\\${char}`) },
  });
}

const hydro = wizardSeedFor({ idea: { source: "library", ideaSlug: "hydrotrail" } });
const own = wizardSeedFor({ idea: { source: "own_idea", text: "A packing list that adapts to the forecast" } });

function setup(step: WizardStep, overrides: Partial<WizardStepPanelProps> = {}) {
  const handlers = {
    onAccept: vi.fn(),
    onChoose: vi.fn(),
    onRewrite: vi.fn(),
    onSkip: vi.fn(),
    onBack: vi.fn(),
  };
  const props: WizardStepPanelProps = {
    step,
    ideaTitle: "HydroTrail",
    answers: { idea: hydro.defaults.idea },
    defaults: hydro.defaults,
    suggestedNames: hydro.suggestedNames,
    blueprint: hydro.blueprint,
    pending: false,
    error: null,
    ...handlers,
    ...overrides,
  };
  const view = render(<WizardStepPanel {...props} />);
  return { ...view, handlers, user: userEvent.setup() };
}

async function expectNoAxeViolations(container: Element) {
  // jsdom cannot paint, so axe's colour-contrast rule cannot run here; the
  // home-* token pairs are checked by the live a11y pass (WP74-S6).
  const results = await axe(container, { rules: { "color-contrast": { enabled: false } } });
  expect(results.violations.map((violation) => `${violation.id}: ${violation.help}`)).toEqual([]);
}

describe("WP74-S1 WizardStepPanel", () => {
  test("shows the suggested default under a step heading, with Use, Rewrite, Back and Skip", async () => {
    const { container, handlers, user } = setup("platform");
    expect(screen.getByRole("heading", { level: 2, name: "Where should people use it?" })).toBeTruthy();
    expect(screen.getByRole("heading", { level: 3, name: "Suggested" })).toBeTruthy();
    expect(screen.getByText("Mobile web, installable")).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Use this platform" }));
    expect(handlers.onAccept).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole("button", { name: "Back" }));
    expect(handlers.onBack).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole("button", { name: /Skip for now/ }));
    expect(handlers.onSkip).toHaveBeenCalledTimes(1);
    await expectNoAxeViolations(container);
  });

  test("Rewrite opens a labelled editor; a custom platform is sent as the founder's words", async () => {
    const { container, handlers, user } = setup("platform");
    const toggle = screen.getByRole("button", { name: "Rewrite" });
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    await user.click(toggle);
    expect(toggle.getAttribute("aria-expanded")).toBe("true");

    const group = screen.getByRole("group", { name: "Platform" });
    await user.click(within(group).getByRole("radio", { name: /Something else/ }));
    // Empty custom text is caught before any call, with an announced error.
    await user.click(screen.getByRole("button", { name: "Save my answer" }));
    expect(screen.getByRole("alert").textContent).toMatch(/Write something first/);
    expect(handlers.onRewrite).not.toHaveBeenCalled();

    const field = screen.getByLabelText("Describe the platform");
    expect(field.getAttribute("aria-invalid")).toBe("true");
    expect(field.getAttribute("maxlength")).toBe("120");
    await user.type(field, "Chrome extension");
    await user.click(screen.getByRole("button", { name: "Save my answer" }));
    expect(handlers.onRewrite).toHaveBeenCalledWith("Chrome extension");
    await expectNoAxeViolations(container);
  });

  test("the keyboard alone can pick another goal and add the paid test", async () => {
    const { handlers, user } = setup("goal");
    await user.click(screen.getByRole("button", { name: "Rewrite" }));
    const goal = screen.getByRole("group", { name: "Goal" });
    within(goal).getByRole("radio", { name: "First 50 waitlist signups" }).focus();
    await user.keyboard("{ArrowDown}");
    expect((within(goal).getByRole("radio", { name: "First sale" }) as HTMLInputElement).checked).toBe(true);
    await user.click(screen.getByRole("checkbox", { name: /paid test/ }));
    screen.getByRole("button", { name: "Save my answer" }).focus();
    await user.keyboard("{Enter}");
    expect(handlers.onChoose).toHaveBeenCalledWith({
      kind: "first_sale",
      timeframe: "weekend",
      paidPush: { dailyBudgetUsd: 7 },
    });
  });

  test("an own idea's blueprint is labelled Not yet validated and lists its features", async () => {
    const { container } = setup("blueprint", {
      ideaTitle: "A packing list",
      answers: { idea: own.defaults.idea },
      defaults: own.defaults,
      blueprint: own.blueprint,
      suggestedNames: own.suggestedNames,
    });
    expect(screen.getByText("Not yet validated")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Looks good" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Rework it" })).toBeTruthy();
    expect(screen.getAllByRole("listitem").length).toBeGreaterThanOrEqual(3);
    await expectNoAxeViolations(container);
  });

  test("a previous, different answer can be kept after going Back", async () => {
    const { handlers, user } = setup("platform", {
      answers: { idea: hydro.defaults.idea, platform: { kind: "native" } },
    });
    expect(screen.getByText("iOS and Android app")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Keep my answer" }));
    expect(handlers.onChoose).toHaveBeenCalledWith({ kind: "native" });
  });

  test("while a save is pending, actions stay focusable but do nothing, and errors are announced", async () => {
    const { handlers, user } = setup("commercial_model", { pending: true, error: "That answer cannot be saved." });
    const accept = screen.getByRole("button", { name: "Use this model" });
    expect(accept.getAttribute("aria-disabled")).toBe("true");
    await user.click(accept);
    await user.click(screen.getByRole("button", { name: /Skip for now/ }));
    expect(handlers.onAccept).not.toHaveBeenCalled();
    expect(handlers.onSkip).not.toHaveBeenCalled();
    expect(screen.getByRole("alert").textContent).toBe("That answer cannot be saved.");
  });

  test("the first step has no Back button", () => {
    setup("idea");
    expect(screen.queryByRole("button", { name: "Back" })).toBeNull();
    expect(screen.getByRole("button", { name: "Build this idea" })).toBeTruthy();
  });
});

describe("WP74-S1 WizardProgress", () => {
  test("names the current step in text and marks it aria-current", async () => {
    const { container } = render(<WizardProgress currentIndex={2} />);
    expect(screen.getByRole("navigation", { name: "Wizard progress" })).toBeTruthy();
    expect(screen.getByText("Step 3 of 8: Platform")).toBeTruthy();
    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(8);
    expect(items[2]?.getAttribute("aria-current")).toBe("step");
    expect(items[0]?.textContent).toContain("(done)");
    expect(items[0]?.getAttribute("aria-current")).toBeNull();
    await expectNoAxeViolations(container);
  });

  test("labels the finished state", () => {
    expect(progressLabel(8)).toBe("All 8 steps done");
    expect(progressLabel(0)).toBe("Step 1 of 8: Your idea");
  });
});

describe("WP74-S1 Meet your co-founder", () => {
  test("is a placeholder that names the partner and offers Back", async () => {
    const onBack = vi.fn();
    const { container } = render(
      <MeetCofounder
        answers={{ ...hydro.defaults, partnerName: { kind: "custom", name: "Captain" } }}
        pending={false}
        onBack={onBack}
      />,
    );
    expect(screen.getByRole("heading", { level: 2, name: "Meet Captain, your co-founder" })).toBeTruthy();
    await userEvent.setup().click(screen.getByRole("button", { name: "Back" }));
    expect(onBack).toHaveBeenCalledTimes(1);
    await expectNoAxeViolations(container);
  });
});

describe("WP74-S1 Meet your co-founder errors", () => {
  test("a failed Back is announced as an alert", async () => {
    const { container } = render(
      <MeetCofounder answers={hydro.defaults} pending={false} error="Something went wrong. Try again." onBack={vi.fn()} />,
    );
    expect(screen.getByRole("alert").textContent).toBe("Something went wrong. Try again.");
    await expectNoAxeViolations(container);
  });
});

describe("WP74-S1 wizard error copy", () => {
  test("maps guard codes to plain messages and never leaks raw errors", () => {
    expect(wizardErrorMessage(new ConvexError({ code: "RATE_LIMITED" }))).toMatch(/Try again tomorrow/);
    expect(wizardErrorMessage(new ConvexError({ code: "INVALID_ANSWER", message: "name.chosen: Too big" })))
      .toBe("That answer cannot be saved (name.chosen: Too big).");
    expect(wizardErrorMessage(new Error("stack trace"))).toBe("Something went wrong. Try again.");
  });
});
