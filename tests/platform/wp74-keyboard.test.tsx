// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ConvexError } from "convex/values";
import { getFunctionName } from "convex/server";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { axe } from "vitest-axe";

import type { WizardSessionView } from "@/convex/workspace/wizard";
import { WIZARD_STEPS, type WizardStep } from "@/lib/workspace/contracts/wizard";
import { wizardSeedFor } from "@/lib/workspace/wizard/defaults";
import { stepHeadText } from "@/lib/workspace/wizard/copy";

type Mutation = (args: Record<string, unknown>) => Promise<unknown>;

const store = vi.hoisted(() => ({
  view: undefined as unknown,
  listeners: new Set<() => void>(),
  calls: [] as { name: string; args: Record<string, unknown> }[],
  failCreate: null as unknown,
  handlers: {} as Record<string, (args: Record<string, unknown>) => void>,
  replace: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: store.replace }) }));
vi.mock("convex/react", async () => {
  const { getFunctionName: name } = await import("convex/server");
  const { useSyncExternalStore } = await import("react");
  const subscribe = (listener: () => void) => {
    store.listeners.add(listener);
    return () => store.listeners.delete(listener);
  };
  return {
    // The session view for the wizard; the launch reads (Meet your co-founder) get an assembling team.
    useQuery: (ref: Parameters<typeof name>[0]) => {
      const fn = name(ref);
      const view = useSyncExternalStore(subscribe, () => store.view, () => store.view);
      if (fn.endsWith(":launchStatus")) return { state: "assembling" };
      if (fn.endsWith(":launchProgress")) return { started: false, steps: [] };
      return view;
    },
    useMutation: (ref: Parameters<typeof name>[0]): Mutation => async (args) => {
      const fn = name(ref);
      store.calls.push({ name: fn, args });
      if (fn.endsWith(":startOrResume")) return "session123";
      const handler = store.handlers[fn.split(":")[1] ?? ""];
      if (handler) handler(args);
      return { applied: true };
    },
  };
});

import { WizardFlow } from "@/components/workspace/wizard/WizardFlow";
import { WizardStepPanel } from "@/components/workspace/wizard/WizardStepPanel";
import StartError from "@/app/start/error";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

afterEach(cleanup);

// jsdom has no CSS.escape; user-event's radio arrow-key walk needs it.
if (typeof globalThis.CSS === "undefined" || typeof globalThis.CSS.escape !== "function") {
  Object.assign(globalThis, {
    CSS: { escape: (value: string) => value.replace(/[^a-zA-Z0-9_-]/g, (char) => `\\${char}`) },
  });
}

const seed = wizardSeedFor({ idea: { source: "library", ideaSlug: "hydrotrail" } });

function viewAt(index: number, completed = false, business: WizardSessionView["business"] = null): WizardSessionView {
  return {
    sessionId: "session123" as WizardSessionView["sessionId"],
    step: WIZARD_STEPS[index] as WizardStep,
    stepIndex: index,
    totalSteps: 8,
    completed,
    ideaTitle: "HydroTrail",
    answers: seed.defaults,
    defaults: seed.defaults,
    suggestedNames: [...seed.suggestedNames],
    suggestedPartnerNames: [...seed.suggestedPartnerNames],
    blueprint: { ...seed.blueprint, features: [...seed.blueprint.features], scopeCuts: [...seed.blueprint.scopeCuts] },
    seedSource: "fixture_hydrotrail",
    hints: {},
    crew: null,
    business,
  };
}

function publish(next: WizardSessionView) {
  store.view = next;
  for (const listener of store.listeners) listener();
}

function current(): WizardSessionView {
  return store.view as WizardSessionView;
}

function advance() {
  const now = current();
  publish(now.stepIndex === 7 ? viewAt(7, true) : viewAt(now.stepIndex + 1));
}

async function axeClean(container: Element) {
  // jsdom cannot paint, so colour contrast is computed from the tokens instead (wp74-progress.md).
  const results = await axe(container, { rules: { "color-contrast": { enabled: false } } });
  expect(results.violations.map((violation) => `${violation.id}: ${violation.help}`)).toEqual([]);
}

type User = ReturnType<typeof userEvent.setup>;

/** Tab (keyboard only) until a control matching the test has focus. */
async function tabTo(user: User, matches: (element: Element | null) => boolean, what: string) {
  for (let i = 0; i < 60; i += 1) {
    const active = document.activeElement;
    if (matches(active)) return active as HTMLElement;
    await user.tab();
  }
  throw new Error(`Never reached ${what} by Tab`);
}

/** Tab until a button whose text matches has focus. */
async function tabToButton(user: User, label: RegExp) {
  return tabTo(user, (el) => el instanceof HTMLButtonElement && label.test(el.textContent ?? ""), `a button matching ${String(label)}`);
}

/** Tab until the control with this accessible label (an icon button, say) has focus. */
async function tabToLabel(user: User, label: string) {
  return tabTo(user, (el) => el?.getAttribute("aria-label") === label, `the control labelled ${label}`);
}

function expectHeadingFocused(text: string) {
  const active = document.activeElement;
  expect(active?.tagName).toBe("H1");
  expect(active?.textContent).toBe(text);
}

/** The primary button on every step: "Use suggested · Continue", "Continue", "Looks good" or "Use this idea · Continue". */
const CONTINUE = /^(Use suggested · Continue|Continue|Looks good|Use this idea · Continue)$/;

const props = { idea: { source: "library" as const, ideaSlug: "hydrotrail" }, ideaTitle: "HydroTrail", initialSessionId: null };

describe("WP74-S6 keyboard-only run-through", () => {
  beforeEach(() => {
    store.listeners.clear();
    store.calls = [];
    store.failCreate = null;
    store.replace.mockReset();
    store.view = viewAt(0);
    store.handlers = {
      saveStep: advance,
      skipStep: advance,
      rewriteStep: (args) => {
        if (args.step !== "blueprint") advance();
      },
      goBack: (args) => {
        const now = current();
        const target = typeof args.to === "string" ? WIZARD_STEPS.indexOf(args.to as WizardStep) : now.completed ? 7 : now.stepIndex - 1;
        publish(viewAt(target));
      },
      createBusiness: () => {
        if (store.failCreate !== null) throw store.failCreate;
        publish(viewAt(7, true, { name: "HydroTrail", slug: "hydrotrail", projectId: "project1" as Id<"projects"> }));
      },
    };
  });

  test("idea to Meet your co-founder with Tab, Shift+Tab, Enter, Space, Escape and arrows only", async () => {
    const user = userEvent.setup();
    const { container } = render(<WizardFlow {...props} />);
    await waitFor(() => expect(screen.getByRole("heading", { level: 1 })).toBeTruthy());

    for (const [index, step] of WIZARD_STEPS.entries()) {
      // Focus moved to this step's h1 (not on the first render, which keeps the page's own focus).
      if (index > 0) {
        expectHeadingFocused(stepHeadText(step));
        expect(container.querySelector('[role="status"]')?.textContent).toMatch(new RegExp(`^Step ${index + 1} of 8`));
      }
      expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(stepHeadText(step));
      expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
      await axeClean(container);

      if (step === "platform") {
        // Arrow keys walk the radio cards; the custom choice reveals a labelled field.
        await tabTo(user, (el) => el instanceof HTMLInputElement && el.type === "radio", "the platform radios");
        await user.keyboard("{ArrowDown}{ArrowDown}");
        expect((screen.getByRole("radio", { name: /Something else/ }) as HTMLInputElement).checked).toBe(true);
        await user.tab();
        expect(document.activeElement).toBe(screen.getByLabelText("Describe the platform"));
        await user.keyboard("{Enter}");
        expect((await screen.findByRole("alert")).textContent).toBe("Describe the platform first, or pick one of the choices.");
        expect(screen.getByLabelText("Describe the platform").getAttribute("aria-invalid")).toBe("true");
        await axeClean(container);
        // Back to the suggestion with the arrow keys.
        await user.tab({ shift: true });
        await user.keyboard("{ArrowUp}{ArrowUp}");
        expect((screen.getByRole("radio", { name: /Mobile web, installable/ }) as HTMLInputElement).checked).toBe(true);
      }
      if (step === "partner_name") {
        await tabTo(user, (el) => el instanceof HTMLInputElement && el.type === "radio", "the partner name radios");
        await user.keyboard("{ArrowDown}");
        expect((screen.getByRole("radio", { name: /Juno/ }) as HTMLInputElement).checked).toBe(true);
        expect(screen.getByRole("button", { name: "Continue" })).toBeTruthy();
        await axeClean(container);
      }
      if (step === "blueprint") {
        // "I'd change some things" opens with Enter; Rework sends the notes and stays; Escape closes and returns focus.
        const toggle = await tabToButton(user, /^I.d change some things$/);
        expect(toggle.getAttribute("aria-expanded")).toBe("false");
        await user.keyboard("{Enter}");
        expect(toggle.getAttribute("aria-expanded")).toBe("true");
        await axeClean(container);
        await tabTo(user, (el) => el instanceof HTMLTextAreaElement, "the notes field");
        await user.keyboard("make it smaller{Enter}");
        await waitFor(() => expect(store.calls.some((call) => call.name.endsWith(":rewriteStep"))).toBe(true));
        expect(store.calls.find((call) => call.name.endsWith(":rewriteStep"))?.args).toMatchObject({
          step: "blueprint",
          text: "make it smaller",
        });
        await user.keyboard("{Escape}");
        expect(toggle.getAttribute("aria-expanded")).toBe("false");
        expect(document.activeElement).toBe(toggle);
        // Space opens it again; Escape from inside the field hands focus back.
        await user.keyboard(" ");
        expect(toggle.getAttribute("aria-expanded")).toBe("true");
        await user.tab({ shift: true });
        await user.tab();
        await user.keyboard("{Escape}");
        expect(document.activeElement).toBe(toggle);
      }

      if (index === 1) {
        // Back is the chevron before the step: reachable by Tab, works, and the step before it keeps its answer.
        const back = await tabToLabel(user, "Back to previous step");
        await user.keyboard("{Enter}");
        await waitFor(() => expectHeadingFocused(stepHeadText("idea")));
        expect(back.isConnected).toBe(false);
        await tabToButton(user, CONTINUE);
        await user.keyboard("{Enter}");
        await waitFor(() => expectHeadingFocused(stepHeadText("blueprint")));
        await tabToButton(user, CONTINUE);
        await user.keyboard("{Enter}");
        continue;
      }
      await tabToButton(user, CONTINUE);
      // Space activates the primary button too.
      await user.keyboard(index === 2 ? " " : "{Enter}");
      if (step !== "partner_name") await waitFor(() => expect(current().step).not.toBe(step));
    }

    // Create my business: every refusal is announced; the follow-up controls are reachable.
    await waitFor(() => expectHeadingFocused("Create HydroTrail."));
    expect(container.querySelector('[role="status"]')?.textContent).toBe("All steps done. Create your business.");
    await axeClean(container);

    store.failCreate = new ConvexError({ code: "NAME_RESERVED" });
    await tabToButton(user, /Create my business/);
    await user.keyboard("{Enter}");
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("kept for Weekend MVP");
    expect(document.activeElement?.getAttribute("aria-describedby")).toBe(alert.id);
    await axeClean(container);
    await tabToButton(user, /Choose a different name/);
    await user.keyboard("{Enter}");
    await waitFor(() => expectHeadingFocused(stepHeadText("name")));

    for (const step of ["name", "partner_personality", "partner_name"] as const) {
      await tabToButton(user, CONTINUE);
      await user.keyboard("{Enter}");
      await waitFor(() => expect(current().completed || current().step !== step).toBe(true));
    }
    await waitFor(() => expectHeadingFocused("Create HydroTrail."));

    store.failCreate = null;
    await tabToButton(user, /Create my business/);
    await user.keyboard("{Enter}");
    await waitFor(() => expect(document.activeElement?.tagName).toBe("H1"));
    expect(document.activeElement?.textContent).toBe("Hi, I'm Wren.");
    expect(container.querySelector('[role="status"]')?.textContent).toBe("Business created. Meet your co-founder.");
    await axeClean(container);
    // The whole wizard by keyboard takes about 2 s alone; under the full parallel suite it can pass 5 s.
  }, 30_000);

  test("Create my business: the back button works by keyboard and other refusals are alerts", async () => {
    store.view = viewAt(7, true);
    const user = userEvent.setup();
    const { container } = render(<WizardFlow {...props} />);
    for (const data of [{ code: "EMAIL_NOT_VERIFIED" }, { code: "DISPOSABLE_EMAIL" }, { code: "BUSINESS_LIMIT_REACHED", limit: 1, projectId: "abc1" }]) {
      store.failCreate = new ConvexError(data);
      await tabToButton(user, /Create my business/);
      await user.keyboard("{Enter}");
      expect((await screen.findByRole("alert")).textContent?.length).toBeGreaterThan(10);
      await axeClean(container);
    }
    expect(screen.getByRole("link", { name: "Open your business" })).toBeTruthy();
    await tabToButton(user, /^Back$/);
    await user.keyboard("{Enter}");
    await waitFor(() => expectHeadingFocused(stepHeadText("partner_name")));
  });

  test("own idea start: the labelled field, an empty submit is an alert, Enter starts the build", async () => {
    store.view = undefined;
    const user = userEvent.setup();
    const { container } = render(<WizardFlow idea={null} ideaTitle={null} initialSessionId={null} />);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("What are we building?");
    // No "Save & exit" yet: nothing can be resumed until the first sentence starts a session.
    expect(screen.queryByRole("link", { name: /Save/ })).toBeNull();
    await user.tab();
    expect(document.activeElement).toBe(screen.getByLabelText("Your idea in one sentence"));
    await user.keyboard("{Enter}");
    expect((await screen.findByRole("alert")).textContent).toBe("Write your idea in one sentence first.");
    expect(document.activeElement?.getAttribute("aria-invalid")).toBe("true");
    await axeClean(container);
    await user.keyboard("A packing list for campers{Enter}");
    await waitFor(() => expect(store.calls[0]?.name).toBe(getFunctionName(api.workspace.wizard.startOrResume)));
    expect(store.calls[0]?.args).toEqual({ idea: { source: "own_idea", text: "A packing list for campers" } });
  });

  test("a failed step save is an alert and focus stays on the control", async () => {
    store.handlers.saveStep = () => {
      throw new ConvexError({ code: "RATE_LIMITED" });
    };
    const user = userEvent.setup();
    const { container } = render(<WizardFlow {...props} />);
    const accept = await tabToButton(user, CONTINUE);
    await user.keyboard("{Enter}");
    expect((await screen.findByRole("alert")).textContent).toContain("started a lot of builds");
    expect(document.activeElement).toBe(accept);
    await axeClean(container);
  });

  test("the step bar names the step in text (no colour-only state), marks the current one and counts eight", () => {
    store.view = viewAt(3);
    const { container } = render(<WizardFlow {...props} />);
    const bar = screen.getByRole("list", { name: "Onboarding steps" });
    expect(bar.querySelectorAll("li")).toHaveLength(8);
    expect(screen.getByText("Step 4 of 8 · Commercial model")).toBeTruthy();
    expect(bar.textContent).toContain("(done)");
    expect(bar.textContent).toContain("(current step)");
    expect(bar.querySelector('[aria-current="step"]')?.textContent).toContain("Model");
    expect(container.querySelectorAll("h1")).toHaveLength(1);
    expect(container.textContent).not.toMatch(/of 9|\bSMS\b/);
  });

  test("the top bar: the logo is a labelled image and Save & exit is a link back to the idea for a library session", () => {
    store.view = viewAt(2);
    render(<WizardFlow {...props} />);
    expect(screen.getByRole("img", { name: "Weekend MVP" })).toBeTruthy();
    expect(screen.getByRole("banner")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Save & exit" }).getAttribute("href")).toBe("/ideas/hydrotrail");
  });
});

describe("WP74-S6 blueprint note and error boundary", () => {
  test("the Not yet validated note is text, is described to the accept button, and passes axe", async () => {
    const handlers = { onAccept: vi.fn(), onChoose: vi.fn(), onRewrite: vi.fn() };
    const { container } = render(
      <WizardStepPanel
        step="blueprint"
        ideaTitle="Own idea"
        answers={seed.defaults}
        defaults={seed.defaults}
        suggestedNames={[...seed.suggestedNames]}
        blueprint={{ ...seed.blueprint, validated: false, origin: "own_fallback", removedClaims: 2 }}
        pending={false}
        error={null}
        {...handlers}
      />,
    );
    const note = screen.getByText("Not yet validated");
    expect(note).toBeTruthy();
    const accept = screen.getByRole("button", { name: /Looks good/ });
    const noteBox = note.parentElement;
    expect(noteBox?.id).toBeTruthy();
    expect(accept.getAttribute("aria-describedby")).toBe(noteBox?.id);
    await axeClean(container);
    const user = userEvent.setup();
    await user.tab();
    expect(document.activeElement).toBe(accept);
    await user.keyboard("{Enter}");
    expect(handlers.onAccept).toHaveBeenCalledTimes(1);
  });

  test("the pending state is announced and the buttons stay focusable but inert", async () => {
    const onAccept = vi.fn();
    const { container } = render(
      <WizardStepPanel
        step="platform"
        ideaTitle="HydroTrail"
        answers={seed.defaults}
        defaults={seed.defaults}
        suggestedNames={[...seed.suggestedNames]}
        blueprint={seed.blueprint}
        pending
        error={null}
        onAccept={onAccept}
        onChoose={vi.fn()}
        onRewrite={vi.fn()}
      />,
    );
    expect(screen.getByRole("status").textContent).toBe("Saving…");
    const user = userEvent.setup();
    screen.getByRole("button", { name: "Use suggested · Continue" }).focus();
    await user.keyboard("{Enter}");
    expect(onAccept).not.toHaveBeenCalled();
    await axeClean(container);
  });

  test("the error boundary: Try again and Start a new build are both reachable by Tab", async () => {
    const reset = vi.fn();
    const { container } = render(<StartError error={new Error("x")} reset={reset} />);
    expect(screen.getByRole("heading", { level: 1, name: "We could not open this build" })).toBeTruthy();
    const user = userEvent.setup();
    await user.tab();
    const retry = document.activeElement;
    expect(retry?.tagName).toBe("BUTTON");
    await user.keyboard("{Enter}");
    expect(reset).toHaveBeenCalledTimes(1);
    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole("link", { name: "Start a new build" }));
    await act(async () => undefined);
    await axeClean(container);
  });
});
