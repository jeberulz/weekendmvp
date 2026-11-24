// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ConvexError } from "convex/values";
import { afterEach, describe, expect, test, vi } from "vitest";
import { axe } from "vitest-axe";

import { MeetCofounder } from "@/components/workspace/wizard/MeetCofounder";
import { FounderSignals } from "@/components/workspace/wizard/FounderSignals";
import { wizardErrorMessage } from "@/components/workspace/wizard/WizardFlow";
import { WizardProgress, progressCaption, progressLabel } from "@/components/workspace/wizard/WizardProgress";
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
  };
  const props: WizardStepPanelProps = {
    step,
    ideaTitle: "HydroTrail",
    ideaSlug: "hydrotrail",
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

describe("L1 UI fidelity: WizardStepPanel", () => {
  test("each step's h1 is its question with an italic tail, plus a sub line", () => {
    setup("platform");
    const h1 = screen.getByRole("heading", { level: 1, name: "Where should it live first?" });
    expect(h1.querySelector("i")?.textContent).toBe("live");
    expect(h1.getAttribute("tabindex")).toBe("-1");
    expect(screen.getByText("Pick what you can ship this weekend. Native apps can come later.")).toBeTruthy();
  });

  test("options are inline radio cards; the suggested one carries the chip and Use suggested accepts it", async () => {
    const { container, handlers, user } = setup("platform");
    const group = screen.getByRole("group", { name: "Platform" });
    const radios = within(group).getAllByRole("radio");
    expect(radios).toHaveLength(3);
    const web = within(group).getByRole("radio", { name: /Mobile web, installable/ }) as HTMLInputElement;
    expect(web.checked).toBe(true);
    expect(web.closest("label")?.textContent).toContain("Suggested");
    expect(within(group).getByRole("radio", { name: /iOS and Android app/ }).closest("label")?.textContent).not.toContain("Suggested");
    // The old model is gone: no Suggested card, no Rewrite disclosure, no Skip, no Save my answer.
    expect(screen.queryByRole("heading", { level: 3, name: "Suggested" })).toBeNull();
    expect(screen.queryByRole("button", { name: /^Rewrite/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Skip for now/ })).toBeNull();
    expect(screen.queryByRole("button", { name: "Save my answer" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Back" })).toBeNull();

    await user.click(screen.getByRole("button", { name: "Use suggested · Continue" }));
    expect(handlers.onAccept).toHaveBeenCalledTimes(1);
    expect(handlers.onChoose).not.toHaveBeenCalled();
    await expectNoAxeViolations(container);
  });

  test("changing an answer takes two clicks: pick the option, then Continue", async () => {
    const { handlers, user } = setup("platform");
    let clicks = 0;
    const count = (event: Event) => {
      if (event.target instanceof HTMLElement && event.target.closest("label, button")) clicks += 1;
    };
    document.addEventListener("click", count, true);
    await user.click(screen.getByRole("radio", { name: /iOS and Android app/ }));
    const next = screen.getByRole("button", { name: "Continue" });
    await user.click(next);
    document.removeEventListener("click", count, true);
    expect(handlers.onChoose).toHaveBeenCalledWith({ kind: "native" });
    expect(handlers.onAccept).not.toHaveBeenCalled();
    expect(clicks).toBeLessThanOrEqual(2);
  });

  test("a 'fill this in first' error clears once the founder picks a valid choice", async () => {
    const { user } = setup("platform");
    await user.click(screen.getByRole("radio", { name: /Something else/ }));
    await user.click(screen.getByRole("button", { name: "Continue" }));
    expect(screen.getByRole("alert").textContent).toMatch(/Describe the platform first/);
    await user.click(screen.getByRole("radio", { name: /Mobile web, installable/ }));
    expect(screen.queryByRole("alert")).toBeNull();
    // Back to "Something else" with the field still empty: the error stays hidden until the next Continue.
    await user.click(screen.getByRole("radio", { name: /Something else/ }));
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByLabelText("Describe the platform").getAttribute("aria-invalid")).toBeNull();
  });

  test("a custom platform reveals a labelled field; empty text is an announced error, then it is sent as the founder's words", async () => {
    const { container, handlers, user } = setup("platform");
    await user.click(screen.getByRole("radio", { name: /Something else/ }));
    await user.click(screen.getByRole("button", { name: "Continue" }));
    expect(screen.getByRole("alert").textContent).toMatch(/Describe the platform first/);
    expect(handlers.onRewrite).not.toHaveBeenCalled();
    const field = screen.getByLabelText("Describe the platform");
    expect(field.getAttribute("aria-invalid")).toBe("true");
    expect(field.getAttribute("maxlength")).toBe("120");
    await user.type(field, "Chrome extension");
    await user.click(screen.getByRole("button", { name: "Continue" }));
    expect(handlers.onRewrite).toHaveBeenCalledWith("Chrome extension");
    await expectNoAxeViolations(container);
  });

  test("the keyboard alone can pick another goal, a deadline pill and the paid test", async () => {
    const { handlers, user } = setup("goal");
    const goal = screen.getByRole("group", { name: "Goal" });
    within(goal).getByRole("radio", { name: /First 50 waitlist signups/ }).focus();
    await user.keyboard("{ArrowDown}");
    expect((within(goal).getByRole("radio", { name: /First sale/ }) as HTMLInputElement).checked).toBe(true);
    const when = screen.getByRole("group", { name: /By when/ });
    expect(within(when).getAllByRole("radio")).toHaveLength(4);
    expect(within(when).getByRole("radio", { name: /This weekend/ }).closest("label")?.textContent).toContain("Suggested");
    within(when).getByRole("radio", { name: /This weekend/ }).focus();
    await user.keyboard("{ArrowRight}");
    expect((within(when).getByRole("radio", { name: /In two weeks/ }) as HTMLInputElement).checked).toBe(true);
    await user.click(screen.getByRole("checkbox", { name: /paid test/ }));
    screen.getByRole("button", { name: "Continue" }).focus();
    await user.keyboard("{Enter}");
    expect(handlers.onChoose).toHaveBeenCalledWith({
      kind: "first_sale",
      timeframe: "2w",
      paidPush: { dailyBudgetUsd: 7 },
    });
  });

  test("an own idea's blueprint is labelled Not yet validated, with Looks good and I'd change some things", async () => {
    const { container, handlers, user } = setup("blueprint", {
      ideaTitle: "A packing list",
      ideaSlug: null,
      answers: { idea: own.defaults.idea },
      defaults: own.defaults,
      blueprint: own.blueprint,
      suggestedNames: own.suggestedNames,
    });
    expect(screen.getByText("Not yet validated")).toBeTruthy();
    expect(screen.getByRole("heading", { level: 3, name: "What I\u2019d build" })).toBeTruthy();
    expect(screen.getAllByRole("listitem").length).toBeGreaterThanOrEqual(3);
    expect(container.textContent).not.toMatch(/MATCH|N°|build pack/i);
    const toggle = screen.getByRole("button", { name: "I\u2019d change some things" });
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    await user.click(screen.getByRole("button", { name: "Looks good" }));
    expect(handlers.onAccept).toHaveBeenCalledTimes(1);
    await user.click(toggle);
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    expect(screen.queryByRole("button", { name: "Looks good" })).toBeNull();
    // Opening the notes field puts the cursor in it.
    expect(document.activeElement).toBe(screen.getByLabelText("What should change?"));
    // Empty notes are caught before any call.
    await user.click(screen.getByRole("button", { name: "Save notes" }));
    expect(screen.getByRole("alert").textContent).toMatch(/Say what should change/);
    await user.type(screen.getByLabelText("What should change?"), "Drop one feature");
    await user.click(screen.getByRole("button", { name: "Save notes" }));
    expect(handlers.onRewrite).toHaveBeenCalledWith("Drop one feature");
    await expectNoAxeViolations(container);
  });

  test("saved rework notes close the field, show under the outline, return focus to Looks good and can be edited", async () => {
    const props = {
      ideaTitle: "A packing list",
      ideaSlug: null,
      answers: { idea: own.defaults.idea },
      defaults: own.defaults,
      blueprint: own.blueprint,
      suggestedNames: own.suggestedNames,
    };
    const { container, handlers, rerender, user } = setup("blueprint", props);
    await user.click(screen.getByRole("button", { name: "I\u2019d change some things" }));
    await user.type(screen.getByLabelText("What should change?"), "Drop one feature");
    await user.click(screen.getByRole("button", { name: "Save notes" }));
    expect(handlers.onRewrite).toHaveBeenCalledWith("Drop one feature");

    // The server saved the rework: the session stays on the blueprint with the notes.
    rerender(
      <WizardStepPanel
        step="blueprint"
        {...props}
        answers={{ idea: own.defaults.idea, blueprintDecision: { decision: "rework", notes: "Drop one feature" } }}
        pending={false}
        error={null}
        {...handlers}
      />,
    );
    const looksGood = screen.getByRole("button", { name: "Looks good" });
    expect(document.activeElement).toBe(looksGood);
    expect(screen.queryByLabelText("What should change?")).toBeNull();
    expect(container.textContent).toMatch(/Your notes\s*Drop one feature/);
    expect(screen.getByRole("status").textContent).toBe("Notes saved. Your crew will read them.");
    await expectNoAxeViolations(container);

    // Editing starts from the saved notes.
    const edit = screen.getByRole("button", { name: "Edit my notes" });
    await user.click(edit);
    expect((screen.getByLabelText("What should change?") as HTMLTextAreaElement).value).toBe("Drop one feature");
    expect(screen.getByRole("status").textContent).toBe("");

    await user.click(edit);
    await user.click(screen.getByRole("button", { name: "Looks good" }));
    expect(handlers.onAccept).toHaveBeenCalledTimes(1);
  });

  test("notes already carried in the blueprint signal (Back after Looks good) still show", () => {
    setup("blueprint", {
      ideaTitle: "A packing list",
      ideaSlug: null,
      answers: {
        idea: own.defaults.idea,
        blueprintDecision: { decision: "looks_good" },
        signals: { blueprint: { signal: "edited", note: "Approved blueprint with notes: Drop one feature" } },
      },
      defaults: own.defaults,
      blueprint: own.blueprint,
      suggestedNames: own.suggestedNames,
    });
    expect(screen.getByText("Drop one feature")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Edit my notes" })).toBeTruthy();
    // Nothing was just saved, so focus is not moved and nothing is announced.
    expect(screen.getByRole("status").textContent).toBe("");
  });

  test("saving the notes unchanged closes the editor without a server call", async () => {
    const { handlers, user } = setup("blueprint", {
      ideaTitle: "A packing list",
      ideaSlug: null,
      answers: { idea: own.defaults.idea, blueprintDecision: { decision: "rework", notes: "Drop one feature" } },
      defaults: own.defaults,
      blueprint: own.blueprint,
      suggestedNames: own.suggestedNames,
    });
    await user.click(screen.getByRole("button", { name: "Edit my notes" }));
    // Only trailing whitespace added: still the same notes.
    await user.type(screen.getByLabelText("What should change?"), "   ");
    await user.click(screen.getByRole("button", { name: "Save notes" }));
    expect(handlers.onRewrite).not.toHaveBeenCalled();
    expect(screen.queryByLabelText("What should change?")).toBeNull();
    const looksGood = screen.getByRole("button", { name: "Looks good" });
    expect(document.activeElement).toBe(looksGood);
    expect(screen.getByRole("status").textContent).toBe("Notes saved. Your crew will read them.");
  });

  test("a previous, different answer is preselected and kept with Continue", async () => {
    const { handlers, user } = setup("platform", {
      answers: { idea: hydro.defaults.idea, platform: { kind: "native" } },
    });
    expect((screen.getByRole("radio", { name: /iOS and Android app/ }) as HTMLInputElement).checked).toBe(true);
    await user.click(screen.getByRole("button", { name: "Continue" }));
    expect(handlers.onChoose).toHaveBeenCalledWith({ kind: "native" });
  });

  test("while a save is pending, Continue stays focusable but does nothing, and errors are announced", async () => {
    const { handlers, user } = setup("commercial_model", { pending: true, error: "That answer cannot be saved." });
    const accept = screen.getByRole("button", { name: "Use suggested · Continue" });
    expect(accept.getAttribute("aria-disabled")).toBe("true");
    await user.click(accept);
    expect(handlers.onAccept).not.toHaveBeenCalled();
    expect(screen.getByRole("alert").textContent).toBe("That answer cannot be saved.");
    expect(screen.getByRole("status").textContent).toBe("Saving…");
  });

  test("the library idea step: the picked idea, the research link, a different idea, and writing your own", async () => {
    const { container, handlers, user } = setup("idea");
    // textContent, not the computed name: jsdom pads inline <i> with spaces in the name.
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("What are we building?");
    expect(screen.getByText("From the library")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Read the research" }).getAttribute("href")).toBe("/ideas/hydrotrail");
    expect(screen.getByRole("link", { name: "Pick a different idea" }).getAttribute("href")).toBe("/ideas");
    expect(container.textContent).not.toMatch(/I already run a business|N°/);
    await user.click(screen.getByRole("button", { name: "Use this idea · Continue" }));
    expect(handlers.onAccept).toHaveBeenCalledTimes(1);

    const toggle = screen.getByRole("button", { name: "Write my own instead" });
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    await user.click(toggle);
    await user.type(screen.getByLabelText("Your idea in one sentence"), "A packing list for campers");
    await user.click(screen.getByRole("button", { name: "Use my idea" }));
    expect(handlers.onRewrite).toHaveBeenCalledWith("A packing list for campers");
    // Escape closes the disclosure and hands focus back to its button.
    await user.keyboard("{Escape}");
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(toggle);
    await expectNoAxeViolations(container);
  });

  test("an own idea on step 1 is a labelled field; Continue accepts it unchanged and rewrites it when edited", async () => {
    const { handlers, user } = setup("idea", {
      ideaSlug: null,
      defaults: own.defaults,
      answers: { idea: own.defaults.idea },
    });
    // The shared own-idea surface (OwnIdeaForm): the save note and the example chips, never the old boxed card.
    expect(screen.getByText("Your answers save as you go.")).toBeTruthy();
    expect(screen.getByText("Try one of these")).toBeTruthy();
    expect((screen.getByLabelText("Your idea in one sentence") as HTMLInputElement).value).toBe(own.defaults.idea?.source === "own_idea" ? own.defaults.idea.text : "");
    expect(screen.queryByText("From the library")).toBeNull();
    const field = screen.getByLabelText("Your idea in one sentence");
    await user.click(screen.getByRole("button", { name: "Continue" }));
    expect(handlers.onAccept).toHaveBeenCalledTimes(1);
    await user.clear(field);
    await user.type(field, "A smarter packing list");
    await user.click(screen.getByRole("button", { name: "Continue" }));
    expect(handlers.onRewrite).toHaveBeenCalledWith("A smarter packing list");
  });

  test("name step: the rename-risk callout shows only for a different name, and nothing claims a name is free", async () => {
    const { container, handlers, user } = setup("name");
    expect(screen.getByText("Your web address is confirmed when you publish.")).toBeTruthy();
    expect(screen.queryByRole("note")).toBeNull();
    const field = screen.getByLabelText("Or type your own");
    await user.type(field, "Trailhead Water");
    expect(screen.getByRole("note").textContent).toMatch(/Renaming later costs links\./);
    expect(container.textContent).not.toMatch(/is free|available/i);
    await user.click(screen.getByRole("button", { name: "Continue" }));
    expect(handlers.onRewrite).toHaveBeenCalledWith("Trailhead Water");
    await expectNoAxeViolations(container);
  });

  test("name step: picking an alternative sends the choice and its alternatives", async () => {
    const { handlers, user } = setup("name");
    const alt = hydro.suggestedNames[1];
    if (alt === undefined) throw new Error("the seed offers an alternative name");
    await user.click(screen.getByRole("radio", { name: new RegExp(alt) }));
    expect(screen.getByRole("note")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Continue" }));
    expect(handlers.onChoose).toHaveBeenCalledWith({
      chosen: alt,
      alternatives: hydro.suggestedNames.filter((name) => name !== alt),
    });
  });

  test("personality step: an example line follows the selection and is labelled as an example", async () => {
    const { container, user } = setup("partner_personality");
    expect(screen.getByText(/How I.ll sound · example/)).toBeTruthy();
    expect(screen.getByText("Today's one priority: approve the brand kit, so your emails and posts can use it.")).toBeTruthy();
    await user.click(screen.getByRole("radio", { name: /Creative/ }));
    expect(screen.getByText("I drafted a few hero lines. Want to pick the voice together?")).toBeTruthy();
    expect(container.textContent).not.toMatch(/hiking|4 of 8|HydroTrail/);
    await expectNoAxeViolations(container);
  });

  test("partner name step: presets with their lines, or type your own", async () => {
    const { handlers, user } = setup("partner_name");
    expect(screen.getByText("Small bird, big range.")).toBeTruthy();
    await user.type(screen.getByLabelText("Or type your own"), "Captain");
    await user.click(screen.getByRole("button", { name: "Continue" }));
    expect(handlers.onRewrite).toHaveBeenCalledWith("Captain");
  });

  test("no step mentions SMS, a phone number or a match score", () => {
    const steps: WizardStep[] = ["idea", "blueprint", "platform", "commercial_model", "goal", "name", "partner_personality", "partner_name"];
    for (const step of steps) {
      const { container } = setup(step);
      expect(container.textContent).not.toMatch(/\bSMS\b|phone number|text me|% MATCH/i);
      cleanup();
    }
  });
});

describe("L1 UI fidelity: WizardProgress", () => {
  test("eight labelled segments in an ol, the current one aria-current, a mono caption, no navigation landmark", async () => {
    const { container } = render(<WizardProgress currentIndex={2} />);
    const list = screen.getByRole("list", { name: "Onboarding steps" });
    const items = within(list).getAllByRole("listitem");
    expect(items).toHaveLength(8);
    expect(items.map((item) => item.textContent?.replace(/\s+/g, " ").trim())).toEqual([
      expect.stringContaining("Idea"),
      expect.stringContaining("Blueprint"),
      expect.stringContaining("Platform"),
      expect.stringContaining("Model"),
      expect.stringContaining("Goal"),
      expect.stringContaining("Name"),
      expect.stringContaining("Personality"),
      expect.stringContaining("Lead name"),
    ]);
    expect(items[2]?.getAttribute("aria-current")).toBe("step");
    expect(items[2]?.textContent).toContain("(current step)");
    expect(items[0]?.textContent).toContain("(done)");
    expect(items[0]?.getAttribute("aria-current")).toBeNull();
    expect(screen.getByText("Step 3 of 8 · Platform")).toBeTruthy();
    expect(screen.queryByRole("navigation")).toBeNull();
    expect(container.textContent).not.toMatch(/of 9|Updates/);
    await expectNoAxeViolations(container);
  });

  test("the back chevron is a 44px labelled button, hidden when there is nowhere to go back to", async () => {
    const onBack = vi.fn();
    const user = userEvent.setup();
    const { rerender } = render(<WizardProgress currentIndex={3} onBack={onBack} />);
    const back = screen.getByRole("button", { name: "Back to previous step" });
    expect(back.className).toContain("size-11");
    await user.click(back);
    expect(onBack).toHaveBeenCalledTimes(1);
    rerender(<WizardProgress currentIndex={3} onBack={onBack} pending />);
    expect(screen.getByRole("button", { name: "Back to previous step" }).getAttribute("aria-disabled")).toBe("true");
    await user.click(screen.getByRole("button", { name: "Back to previous step" }));
    expect(onBack).toHaveBeenCalledTimes(1);
    rerender(<WizardProgress currentIndex={0} />);
    expect(screen.queryByRole("button")).toBeNull();
  });

  test("labels: of 8 everywhere, and the finished caption can be replaced", () => {
    expect(progressLabel(8)).toBe("All 8 steps done");
    expect(progressLabel(0)).toBe("Step 1 of 8: Your idea");
    expect(progressCaption(7)).toBe("Step 8 of 8 · Partner name");
    render(<WizardProgress currentIndex={8} finishedCaption="Meet your co-founder" />);
    expect(screen.getByText("Meet your co-founder")).toBeTruthy();
    expect(screen.getAllByRole("listitem").every((item) => item.textContent?.includes("(done)"))).toBe(true);
  });
});

describe("L1 UI fidelity: Founder signals aside", () => {
  const withSignals = {
    ...hydro.defaults,
    signals: {
      platform: { signal: "kept" as const, note: "Approved suggested platform: Mobile web, installable" },
      goal: { signal: "edited" as const, note: "Changed goal: First 50 waitlist signups → First sale" },
    },
  };

  test("logged signals appear in step order with KEPT and EDIT as words, and a count", async () => {
    const { container } = render(<FounderSignals answers={withSignals} />);
    const aside = screen.getByRole("complementary", { name: "Founder signals" });
    expect(within(aside).getByText("2 logged")).toBeTruthy();
    const rows = within(aside).getAllByRole("listitem");
    expect(rows).toHaveLength(2);
    expect(rows[0]?.textContent).toBe("KEPTApproved suggested platform: Mobile web, installable");
    expect(rows[1]?.textContent).toBe("EDITChanged goal: First 50 waitlist signups → First sale");
    expect(within(rows[0] as HTMLElement).getByText("KEPT").className).toContain("bg-home-sage");
    expect(within(rows[1] as HTMLElement).getByText("EDIT").className).toContain("bg-home-ember-soft");
    await expectNoAxeViolations(container);
  });

  test("with no signals it says they appear as you answer", async () => {
    const { container } = render(<FounderSignals answers={{ idea: hydro.defaults.idea }} />);
    expect(screen.getByText("0 logged")).toBeTruthy();
    expect(screen.getByText("Signals appear as you answer.")).toBeTruthy();
    expect(screen.queryByRole("list")).toBeNull();
    await expectNoAxeViolations(container);
  });
});

describe("L1 UI fidelity: Meet your co-founder", () => {
  test("the hero names the partner as the page's h1; the team starts on its own, so there is no Assemble button", async () => {
    const { container } = render(
      <MeetCofounder
        answers={{ ...hydro.defaults, partnerName: { kind: "custom", name: "Captain" } }}
        business={{ projectId: "proj1", name: "HydroTrail", slug: "hydrotrail" }}
        launch={{ state: "assembling" }}
      />,
    );
    const h1 = screen.getByRole("heading", { level: 1 });
    expect(h1.textContent).toBe("Hi, I'm Captain.");
    expect(h1.querySelector("i")?.textContent).toBe("Captain");
    expect(screen.getByText("hydrotrail.weekendmvp.app")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Assemble/ })).toBeNull();
    expect(screen.queryByRole("button", { name: "Back" })).toBeNull();
    await expectNoAxeViolations(container);
  });
});

describe("WP74-S1 wizard error copy", () => {
  test("maps guard codes to plain messages and never leaks raw errors", () => {
    expect(wizardErrorMessage(new ConvexError({ code: "RATE_LIMITED" }))).toMatch(/Try again tomorrow/);
    // What `startOrResume` really throws once the 3-a-day wizardStart allowance is used.
    expect(wizardErrorMessage(new ConvexError({ kind: "RateLimited", name: "wizardStart", retryAfter: 14_781_540 })))
      .toBe("You have started a lot of builds today. Try again in about 5 hours.");
    expect(wizardErrorMessage(new ConvexError({ kind: "RateLimited", name: "wizardStart", retryAfter: 90_000 })))
      .toBe("You have started a lot of builds today. Try again in about an hour.");
    expect(wizardErrorMessage(new ConvexError({ kind: "RateLimited", name: "wizardStart" })))
      .toBe("You have started a lot of builds today. Try again later.");
    expect(wizardErrorMessage(new ConvexError({ code: "INVALID_ANSWER", message: "name.chosen: Too big" })))
      .toBe("That answer cannot be saved (name.chosen: Too big).");
    expect(wizardErrorMessage(new Error("stack trace"))).toBe("Something went wrong. Try again.");
    // AI switched off (or no budget): a new start is refused with words, not the generic line.
    expect(wizardErrorMessage(new ConvexError({ code: "AI_DISABLED" }))).toBe(
      "Starting new builds is paused right now. Builds you already started still open. Try again later.",
    );
  });
});
