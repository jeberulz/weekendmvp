// @vitest-environment jsdom
/**
 * Roster per idea S2 (WP90): the partner-name step suggests three lead names
 * picked per wizard session, so businesses stop sharing one Crew Lead.
 */
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import { axe } from "vitest-axe";

import { WizardStepPanel, type WizardStepPanelProps } from "@/components/workspace/wizard/WizardStepPanel";
import { ROLE_CATALOGUE } from "@/convex/crew/roles";
import {
  LEAD_NAME_POOL,
  PARTNER_NAME_PRESETS,
  leadNameHint,
  leadNameSuggestions,
  nameDedupeKey,
  partnerNameAnswer,
  wizardLeadNameSchema,
} from "@/lib/workspace/contracts/wizard";
import { isDefaultAnswer, isRewrittenAnswer, wizardSeedFor } from "@/lib/workspace/wizard/defaults";

afterEach(cleanup);

const HYDRO = { source: "library", ideaSlug: "hydrotrail" } as const;

describe("lead name pool", () => {
  test("has about two dozen distinct names that the lead-name rules accept", () => {
    const names = LEAD_NAME_POOL.map((entry) => entry.name);
    expect(names.length).toBeGreaterThanOrEqual(20);
    expect(new Set(names.map(nameDedupeKey)).size).toBe(names.length);
    for (const name of names) expect(wizardLeadNameSchema.safeParse(name).success, name).toBe(true);
    for (const entry of LEAD_NAME_POOL) expect(entry.hint.length).toBeGreaterThan(0);
  });

  test("never clashes with a specialist's name", () => {
    const specialists = new Set(
      ROLE_CATALOGUE.filter((role) => role.key !== "lead").map((role) => nameDedupeKey(role.employeeName)),
    );
    for (const entry of LEAD_NAME_POOL) expect(specialists.has(nameDedupeKey(entry.name)), entry.name).toBe(false);
  });

  test("keeps the stored presets, so an old answer still reads as a suggestion", () => {
    const names = LEAD_NAME_POOL.map((entry) => entry.name);
    for (const preset of PARTNER_NAME_PRESETS) expect(names).toContain(preset);
  });
});

describe("leadNameSuggestions", () => {
  test("is stable for a key and gives three distinct pool names", () => {
    const first = leadNameSuggestions("session_abc");
    expect(first).toHaveLength(3);
    expect(new Set(first).size).toBe(3);
    expect(leadNameSuggestions("session_abc")).toEqual(first);
    for (const name of first) expect(leadNameHint(name)).toBeDefined();
  });

  test("varies across sessions", () => {
    const leads = new Set(Array.from({ length: 60 }, (_, i) => leadNameSuggestions(`session_${i.toString()}`)[0]));
    expect(leads.size).toBeGreaterThanOrEqual(12);
  });

  test("a preset name is stored as a preset, any other as custom", () => {
    expect(partnerNameAnswer("Juno")).toEqual({ kind: "preset", name: "Juno" });
    expect(partnerNameAnswer("Rowan")).toEqual({ kind: "custom", name: "Rowan" });
  });
});

describe("wizard seed", () => {
  test("a session key picks the lead names and the default is the first", () => {
    const seed = wizardSeedFor({ idea: HYDRO, leadSeedKey: "session_xyz" });
    const leads = leadNameSuggestions("session_xyz");
    expect(seed.suggestedPartnerNames).toEqual(leads);
    expect(seed.defaults.partnerName).toEqual(partnerNameAnswer(leads[0] ?? ""));
  });

  test("picking a suggestion is not a rewrite; typing a name is", () => {
    const seed = wizardSeedFor({ idea: HYDRO, leadSeedKey: "session_xyz" });
    const second = seed.suggestedPartnerNames[1] ?? "";
    const picked = { ...seed.defaults, partnerName: partnerNameAnswer(second) };
    expect(isRewrittenAnswer("partner_name", picked, seed)).toBe(false);
    expect(isDefaultAnswer("partner_name", picked, seed)).toBe(false);
    expect(isDefaultAnswer("partner_name", seed.defaults, seed)).toBe(true);
    const typed = { ...seed.defaults, partnerName: { kind: "custom" as const, name: "Captain" } };
    expect(isRewrittenAnswer("partner_name", typed, seed)).toBe(true);
  });
});

describe("partner-name step", () => {
  const seed = wizardSeedFor({ idea: HYDRO, leadSeedKey: "session_xyz" });

  function setup(overrides: Partial<WizardStepPanelProps> = {}) {
    const handlers = { onAccept: vi.fn(), onChoose: vi.fn(), onRewrite: vi.fn() };
    const props: WizardStepPanelProps = {
      step: "partner_name",
      ideaTitle: "HydroTrail",
      ideaSlug: "hydrotrail",
      answers: { idea: HYDRO },
      defaults: seed.defaults,
      suggestedNames: seed.suggestedNames,
      suggestedPartnerNames: seed.suggestedPartnerNames,
      blueprint: seed.blueprint,
      pending: false,
      error: null,
      ...handlers,
      ...overrides,
    };
    const view = render(<WizardStepPanel {...props} />);
    return { ...view, handlers, user: userEvent.setup() };
  }

  test("offers the session's three names, the first preselected, and passes axe", async () => {
    const { container } = setup();
    const radios = screen.getAllByRole("radio") as HTMLInputElement[];
    expect(radios.map((radio) => radio.value)).toEqual([...seed.suggestedPartnerNames]);
    expect(radios[0]?.checked).toBe(true);
    const results = await axe(container, { rules: { "color-contrast": { enabled: false } } });
    expect(results.violations.map((violation) => violation.id)).toEqual([]);
  });

  test("keeping the first name accepts the suggestion; another one is a choice", async () => {
    const first = setup();
    await first.user.click(screen.getByRole("button", { name: /Use suggested|Continue/u }));
    expect(first.handlers.onAccept).toHaveBeenCalledTimes(1);
    cleanup();
    const second = setup();
    const other = seed.suggestedPartnerNames[2] ?? "";
    await second.user.click(screen.getByRole("radio", { name: new RegExp(`^${other}\\b`, "u") }));
    await second.user.click(screen.getByRole("button", { name: /Continue/u }));
    expect(second.handlers.onChoose).toHaveBeenCalledWith(partnerNameAnswer(other));
  });

  test("a saved name that is not suggested shows in the text field", () => {
    setup({ answers: { idea: HYDRO, partnerName: { kind: "custom", name: "Captain" } } });
    expect((screen.getByRole("textbox", { name: "Or type your own" }) as HTMLInputElement).value).toBe("Captain");
    for (const radio of screen.getAllByRole("radio") as HTMLInputElement[]) expect(radio.checked).toBe(false);
  });
});
