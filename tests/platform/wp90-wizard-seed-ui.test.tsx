// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import { axe } from "vitest-axe";

import { CrewPreview } from "@/components/workspace/wizard/CrewPreview";
import { WizardStepPanel, type WizardStepPanelProps } from "@/components/workspace/wizard/WizardStepPanel";
import { crewPreviewFor } from "@/convex/workspace/wizard";
import { BAKERY_SLUG, bakerySeedDraft, hydrotrailSeedDraft } from "@/lib/workspace/contracts/fixtures/seeds";
import { seedFromDraft } from "@/lib/workspace/contracts/seeds";
import type { WizardStep } from "@/lib/workspace/contracts/wizard";
import { wizardSeedFor, type WizardSeed } from "@/lib/workspace/wizard/defaults";

afterEach(cleanup);

if (typeof globalThis.CSS === "undefined" || typeof globalThis.CSS.escape !== "function") {
  Object.assign(globalThis, {
    CSS: { escape: (value: string) => value.replace(/[^a-zA-Z0-9_-]/g, (char) => `\\${char}`) },
  });
}

const bakeryIdea = { source: "library" as const, ideaSlug: BAKERY_SLUG };
const bakery = wizardSeedFor({
  idea: bakeryIdea,
  ideaTitle: "Neighbourhood bakery pre-orders",
  storedSeed: seedFromDraft(bakerySeedDraft, { ideaSlug: BAKERY_SLUG, researchLevel: "deep" }),
  ideaFacts: { researchLevel: "deep" },
});
const hydroIdea = { source: "library" as const, ideaSlug: "hydrotrail" };
const hydro = wizardSeedFor({
  idea: hydroIdea,
  storedSeed: seedFromDraft(hydrotrailSeedDraft, { ideaSlug: "hydrotrail", researchLevel: "deep" }),
  ideaFacts: { researchLevel: "deep" },
});

function setup(step: WizardStep, seed: WizardSeed, overrides: Partial<WizardStepPanelProps> = {}) {
  const handlers = { onAccept: vi.fn(), onChoose: vi.fn(), onRewrite: vi.fn() };
  const props: WizardStepPanelProps = {
    step,
    ideaTitle: "Bakery",
    ideaSlug: BAKERY_SLUG,
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
  // jsdom cannot paint: colour contrast is checked by the live a11y pass.
  const results = await axe(container, { rules: { "color-contrast": { enabled: false } } });
  expect(results.violations.map((violation) => `${violation.id}: ${violation.help}`)).toEqual([]);
}

describe("WP90-S4 seeded wizard defaults", () => {
  test("the seed sets the defaults, and a fixture seed has no hints", () => {
    expect(bakery.source).toBe("idea_crew_seeds");
    expect(bakery.defaults.commercialModel).toBe("one_time");
    expect(bakery.profile?.ideaKind).toBe("local_business");
    const generic = wizardSeedFor({ idea: { source: "library", ideaSlug: "x" }, ideaFacts: { researchLevel: "concept" } });
    expect(generic.source).toBe("fixture_generic");
    expect(generic.hints).toEqual({});
    expect(generic.blueprint.validated).toBe(false);
  });

  test("a stored seed for another idea is ignored", () => {
    const seed = wizardSeedFor({
      idea: { source: "library", ideaSlug: "other" },
      storedSeed: seedFromDraft(bakerySeedDraft, { ideaSlug: BAKERY_SLUG, researchLevel: "deep" }),
    });
    expect(seed.source).toBe("fixture_generic");
  });

  test("the crew preview reads the profile and the answers; no profile, no preview", () => {
    const base = crewPreviewFor(bakery.profile, {}, bakery.defaults);
    expect(base?.hired.map((entry) => entry.roleKey)).toContain("merch");
    expect(base?.skipped.map((entry) => entry.roleKey)).toContain("ads");
    const paid = crewPreviewFor(
      bakery.profile,
      { goal: { kind: "first_sale", timeframe: "2w", paidPush: { dailyBudgetUsd: 10 } }, partnerName: { kind: "preset", name: "Juno" } },
      bakery.defaults,
    );
    expect(paid?.hired.map((entry) => entry.roleKey)).toContain("ads");
    expect(paid?.hired.find((entry) => entry.roleKey === "lead")?.employeeName).toBe("Juno");
    expect(crewPreviewFor(null, {}, bakery.defaults)).toBeNull();
  });
});

describe("WP90-S4 quick confirm and reasons", () => {
  test("a confident platform hint opens as a quick confirm; Looks right accepts it", async () => {
    const { container, handlers, user } = setup("platform", bakery);
    expect(screen.queryByRole("radio")).toBeNull();
    expect(screen.getByText("Mobile web, installable")).toBeTruthy();
    expect(screen.getByText(/Why I suggest it:/).closest("p")?.textContent).toMatch(/browser/);
    const looksRight = screen.getByRole("button", { name: "Looks right" });
    expect(looksRight.getAttribute("aria-describedby")).toBeTruthy();
    expect(document.getElementById(looksRight.getAttribute("aria-describedby") ?? "")?.textContent).toMatch(/Why I suggest it/);
    await expectNoAxeViolations(container);
    await user.click(looksRight);
    expect(handlers.onAccept).toHaveBeenCalledTimes(1);
  });

  test("Change opens the full choice and puts focus on the suggested option", async () => {
    const { container, handlers, user } = setup("commercial_model", bakery);
    await user.click(screen.getByRole("button", { name: "Change" }));
    const group = screen.getByRole("group", { name: "Commercial model" });
    const checked = within(group).getAllByRole("radio").find((radio) => (radio as HTMLInputElement).checked);
    expect(checked).toBeTruthy();
    expect(document.activeElement).toBe(checked);
    // The reason stays with the full choice.
    expect(screen.getByText(/Why I suggest it:/)).toBeTruthy();
    await expectNoAxeViolations(container);
    await user.click(within(group).getByRole("radio", { name: /Free for now/ }));
    await user.click(screen.getByRole("button", { name: "Continue" }));
    expect(handlers.onChoose).toHaveBeenCalledWith("free");
  });

  test("a step answered differently before opens on the full choice", () => {
    setup("goal", bakery, { answers: { idea: bakery.defaults.idea, goal: { kind: "waitlist", timeframe: "weekend" } } });
    expect(screen.getAllByRole("radio").length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: "Looks right" })).toBeNull();
  });

  test("a low-confidence hint shows its reason with the full choice", async () => {
    const { container } = setup("commercial_model", hydro, { ideaSlug: "hydrotrail" });
    expect(screen.getAllByRole("radio").length).toBeGreaterThan(0);
    expect(screen.getByText(hydrotrailSeedDraft.wizardHints.commercialModel.reason)).toBeTruthy();
    expect(screen.getByRole("button", { name: /Use suggested/ })).toBeTruthy();
    await expectNoAxeViolations(container);
  });

  test("a fixture seed shows no reason and no quick confirm", () => {
    const fixture = wizardSeedFor({ idea: hydroIdea });
    setup("platform", fixture, { ideaSlug: "hydrotrail" });
    expect(screen.queryByText(/Why I suggest it:/)).toBeNull();
    expect(screen.getAllByRole("radio").length).toBe(3);
  });
});

describe("WP90-S4 crew preview", () => {
  test("lists the hires and the roles left out, each with its reason", async () => {
    const crew = crewPreviewFor(bakery.profile, {}, bakery.defaults);
    if (crew === null) throw new Error("expected a crew");
    const { container } = render(<CrewPreview crew={crew} />);
    const region = screen.getByRole("region", { name: "Your crew" });
    expect(within(region).getByText(`Hiring · ${crew.hired.length}`)).toBeTruthy();
    expect(within(region).getByText("Sells goods in store")).toBeTruthy();
    expect(within(region).getByText(`Not hiring yet · ${crew.skipped.length}`)).toBeTruthy();
    await expectNoAxeViolations(container);
  });
});
