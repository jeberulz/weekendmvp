// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import { axe } from "vitest-axe";

import { WizardStepPanel, type WizardStepPanelProps } from "@/components/workspace/wizard/WizardStepPanel";
import { hydrotrailSeedDraft } from "@/lib/workspace/contracts/fixtures/seeds";
import { seedFromDraft } from "@/lib/workspace/contracts/seeds";
import { goalLine } from "@/lib/workspace/wizard/goal-line";
import { FIRST_WIN_GOALS, goalKindsToOffer } from "@/lib/workspace/wizard/labels";
import { wizardSeedFor, type WizardSeed } from "@/lib/workspace/wizard/defaults";
import { GOAL_KINDS } from "@/lib/workspace/contracts/roster";

afterEach(cleanup);

if (typeof globalThis.CSS === "undefined" || typeof globalThis.CSS.escape !== "function") {
  Object.assign(globalThis, {
    CSS: { escape: (value: string) => value.replace(/[^a-zA-Z0-9_-]/g, (char) => `\\${char}`) },
  });
}

const fixture = wizardSeedFor({ idea: { source: "library", ideaSlug: "hydrotrail" } });
const seeded = wizardSeedFor({
  idea: { source: "library", ideaSlug: "hydrotrail" },
  storedSeed: seedFromDraft(hydrotrailSeedDraft, { ideaSlug: "hydrotrail", researchLevel: "deep" }),
  ideaFacts: { researchLevel: "deep" },
});
const crew = { hired: [{ roleKey: "landing", employeeName: "Leo" }, { roleKey: "email", employeeName: "Elle" }] };

function setup(seed: WizardSeed, overrides: Partial<WizardStepPanelProps> = {}) {
  const handlers = { onAccept: vi.fn(), onChoose: vi.fn(), onRewrite: vi.fn() };
  const props: WizardStepPanelProps = {
    step: "goal",
    ideaTitle: "HydroTrail",
    ideaSlug: "hydrotrail",
    answers: { idea: seed.defaults.idea },
    defaults: seed.defaults,
    suggestedNames: seed.suggestedNames,
    blueprint: seed.blueprint,
    hints: seed.hints,
    pending: false,
    error: null,
    ...handlers,
    ...overrides,
  };
  const view = render(<WizardStepPanel {...props} />);
  return { ...view, handlers, user: userEvent.setup() };
}

async function expectNoAxeViolations(container: Element) {
  const results = await axe(container, { rules: { "color-contrast": { enabled: false } } });
  expect(results.violations.map((violation) => `${violation.id}: ${violation.help}`)).toEqual([]);
}

describe("Step 5 goal: the options (decisions 1A, 6A)", () => {
  test("offers the three first wins, with hints that say what the crew builds", async () => {
    const { container } = setup(fixture);
    expect(screen.getByText("The one result your crew aims at first.")).toBeTruthy();
    const group = screen.getByRole("group", { name: "Goal" });
    const radios = within(group).getAllByRole("radio");
    expect(radios.map((radio) => radio.closest("label")?.querySelector(".font-medium")?.textContent)).toEqual([
      "First 50 signups",
      "First sale",
      "Test the idea",
    ]);
    expect(screen.queryByText("Right for a free app.")).toBeNull();
    expect(screen.queryByText(/\(optional\)/)).toBeNull();
    // One Suggested chip in the view, on the goal card.
    expect(screen.getAllByText("Suggested")).toHaveLength(1);
    await expectNoAxeViolations(container);
  });

  test("a suggested or saved goal outside the first wins is still offered", () => {
    expect(goalKindsToOffer(GOAL_KINDS)).toEqual([...FIRST_WIN_GOALS]);
    expect(goalKindsToOffer(GOAL_KINDS, "mrr_500")).toEqual(["waitlist", "first_sale", "mrr_500", "just_testing"]);
    const saved = { kind: "replace_income" as const, timeframe: "30d" as const };
    setup(fixture, { answers: { idea: fixture.defaults.idea, goal: saved } });
    const radio = screen.getByRole("radio", { name: /Replace my income/ }) as HTMLInputElement;
    expect(radio.checked).toBe(true);
  });
});

describe("Step 5 goal: the live crew line (decision 4A)", () => {
  test("names the crew and follows the selection and the paid test", async () => {
    const { user } = setup(fixture, { crew });
    const line = () => screen.getByText(/Your crew will/).textContent;
    expect(line()).toBe("Your crew will aim at 50 signups. Leo builds a site and waitlist; Elle writes the waitlist emails.");
    await user.click(screen.getByRole("radio", { name: /First sale/ }));
    expect(line()).toBe(
      "Your crew will aim at 1 sale. Leo builds a sales page and early-bird list; Elle writes the pre-launch and launch-day emails.",
    );
    await user.click(screen.getByRole("checkbox", { name: /paid test/ }));
    expect(line()).toMatch(/Ads joins for a \$7 a day test\.$/);
  });

  test("without a crew the line names the work, not people", () => {
    expect(goalLine("just_testing", false, null)).toEqual({
      lead: "Your crew will test the idea with ",
      target: "no target",
      rest: ": a site and waitlist, and a short welcome sequence.",
    });
    expect(goalLine("waitlist", false, { hired: [{ roleKey: "email", employeeName: "Elle" }] }).rest).toBe(
      ". Elle writes the waitlist emails.",
    );
  });
});

describe("Step 5 goal: the quick confirm (decisions 3A, 5A)", () => {
  test("reads goal and deadline as one line, says no paid ads, and the link focuses the paid test", async () => {
    const { container, handlers, user } = setup(seeded);
    expect(screen.queryByRole("radio")).toBeNull();
    expect(screen.getByText("First 50 signups · by this weekend")).toBeTruthy();
    expect(screen.getByText("No paid ads.")).toBeTruthy();
    await expectNoAxeViolations(container);
    await user.click(screen.getByRole("button", { name: "Add a $7 a day test" }));
    const paid = screen.getByRole("checkbox", { name: /paid test/ }) as HTMLInputElement;
    expect(document.activeElement).toBe(paid);
    expect(paid.checked).toBe(false);
    await user.keyboard(" ");
    await user.click(screen.getByRole("button", { name: "Continue" }));
    expect(handlers.onChoose).toHaveBeenCalledWith({ kind: "waitlist", timeframe: "weekend", paidPush: { dailyBudgetUsd: 7 } });
  });
});

describe("Step 5 goal: Continue on a phone", () => {
  test("the full choice puts Continue in a bar that sticks below sm; the quick confirm does not", () => {
    setup(fixture);
    const bar = screen.getByRole("button", { name: /Continue/ }).parentElement;
    expect(bar?.className).toContain("max-sm:sticky");
    expect(bar?.className).toContain("max-sm:bottom-0");
    cleanup();
    setup(seeded);
    expect(screen.getByRole("button", { name: "Looks right" }).parentElement?.className).not.toContain("sticky");
  });
});

describe("Step 6 name: Continue on a phone", () => {
  test("Step 6 puts Continue in the same sticky bar; Step 7 does not", () => {
    setup(fixture, { step: "name" });
    const bar = document.querySelector('button[type="submit"]')?.parentElement;
    expect(bar?.className).toContain("max-sm:sticky");
    expect(bar?.className).toContain("max-sm:bottom-0");
    expect(document.querySelector("form")?.className).toContain("max-sm:[&_input]:scroll-mb-28");
    cleanup();
    setup(fixture, { step: "partner_personality" });
    expect(document.querySelector('button[type="submit"]')?.parentElement?.className ?? "").not.toContain("sticky");
    expect(document.querySelector("form")?.className).not.toContain("scroll-mb-28");
  });
});
