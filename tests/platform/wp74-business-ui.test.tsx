// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ConvexError } from "convex/values";
import { getFunctionName } from "convex/server";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { axe } from "vitest-axe";

import type { WizardSessionView } from "@/convex/workspace/wizard";
import { wizardSeedFor } from "@/lib/workspace/wizard/defaults";

type Mutation = (args: Record<string, unknown>) => Promise<unknown>;

const state = vi.hoisted(() => ({
  view: undefined as unknown,
  calls: [] as { name: string; args: Record<string, unknown> }[],
  createError: null as unknown,
  replace: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: state.replace }) }));
vi.mock("convex/react", async () => {
  const { getFunctionName: name } = await import("convex/server");
  return {
    // The session view for the wizard; the launch reads (Meet your co-founder) get an assembling team.
    useQuery: (ref: Parameters<typeof name>[0]) => {
      const fn = name(ref);
      if (fn.endsWith(":launchStatus")) return { state: "assembling" };
      if (fn.endsWith(":launchProgress")) return { started: false, steps: [] };
      return state.view;
    },
    useMutation: (ref: Parameters<typeof name>[0]): Mutation => async (args) => {
      const fn = name(ref);
      state.calls.push({ name: fn, args });
      if (fn.endsWith(":createBusiness")) {
        if (state.createError) throw state.createError;
        return { projectId: "project1", name: "HydroTrail", slug: "hydrotrail", created: true };
      }
      if (fn.endsWith(":startOrResume")) return "session123";
      return { applied: true, step: "partner_name", completed: false, action: null };
    },
  };
});

import { CreateBusiness } from "@/components/workspace/wizard/CreateBusiness";
import { WizardFlow, businessRefusal, libraryIdeaUrl, wizardErrorMessage } from "@/components/workspace/wizard/WizardFlow";
import { api } from "@/convex/_generated/api";

afterEach(cleanup);

const seed = wizardSeedFor({ idea: { source: "library", ideaSlug: "hydrotrail" } });

async function expectNoAxeViolations(container: Element) {
  // jsdom cannot paint, so colour contrast is left to the live a11y pass (WP74-S6).
  const results = await axe(container, { rules: { "color-contrast": { enabled: false } } });
  expect(results.violations.map((violation) => `${violation.id}: ${violation.help}`)).toEqual([]);
}

function finished(business: WizardSessionView["business"] = null): WizardSessionView {
  return {
    sessionId: "session123" as WizardSessionView["sessionId"],
    step: "partner_name",
    stepIndex: 7,
    totalSteps: 8,
    completed: true,
    ideaTitle: "HydroTrail",
    answers: seed.defaults,
    defaults: seed.defaults,
    suggestedNames: [...seed.suggestedNames],
    blueprint: { ...seed.blueprint, features: [...seed.blueprint.features], scopeCuts: [...seed.blueprint.scopeCuts] },
    seedSource: "fixture_hydrotrail",
    hints: {},
    crew: null,
    business,
  };
}

const REFUSALS: [string, Record<string, unknown>, RegExp][] = [
  ["SESSION_INCOMPLETE", {}, /Finish every step and accept the blueprint/],
  ["EMAIL_NOT_VERIFIED", {}, /Verify your email address first/],
  ["DISPOSABLE_EMAIL", {}, /temporary email address/],
  ["BUSINESS_LIMIT_REACHED", { limit: 1 }, /Your plan includes one business, and you already have it\./],
  ["BUSINESS_LIMIT_REACHED", { limit: 3 }, /Your plan includes 3 businesses/],
  ["SLUG_UNAVAILABLE", {}, /free web address/],
  ["NAME_RESERVED", {}, /kept for Weekend MVP's own addresses\. Choose a different name\./],
  ["EMAIL_INVALID", {}, /could not read the domain of your email address/],
  ["WORKSPACE_DISABLED", {}, /switched off/],
  ["RESOURCE_NOT_FOUND", {}, /could not find this build/],
  ["UNAUTHENTICATED", {}, /Sign in again/],
];

describe("WP74-S4 refusal copy", () => {
  test.each(REFUSALS)("%s %o reads plainly", (code, detail, message) => {
    expect(wizardErrorMessage(new ConvexError({ ...detail, code }))).toMatch(message);
  });
});

describe("WP74-S4 CreateBusiness", () => {
  test("names the business and the partner; Create and Back work by keyboard", async () => {
    const onCreate = vi.fn();
    const onBack = vi.fn();
    const { container } = render(
      <CreateBusiness answers={seed.defaults} pending={false} onCreate={onCreate} onBack={onBack} />,
    );
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(`Create ${seed.defaults.name?.chosen}.`);
    const user = userEvent.setup();
    await user.tab();
    expect(document.activeElement?.textContent).toBe("Create my business");
    await user.keyboard("{Enter}");
    expect(onCreate).toHaveBeenCalledTimes(1);
    await user.tab();
    await user.keyboard("{Enter}");
    expect(onBack).toHaveBeenCalledTimes(1);
    await expectNoAxeViolations(container);
  });

  test("while pending, the button and a polite live region say so, the section is busy and a second click does nothing", async () => {
    const onCreate = vi.fn();
    const { container, rerender } = render(<CreateBusiness answers={seed.defaults} pending={false} onCreate={onCreate} onBack={vi.fn()} />);
    const status = screen.getByRole("status");
    expect(status.getAttribute("aria-live")).toBe("polite");
    expect(status.textContent).toBe("");
    rerender(<CreateBusiness answers={seed.defaults} pending onCreate={onCreate} onBack={vi.fn()} />);
    expect(screen.getByRole("status").textContent).toBe("Creating your business…");
    expect(container.querySelector("section")?.getAttribute("aria-busy")).toBe("true");
    const button = screen.getByRole("button", { name: "Creating your business…" });
    expect(button.getAttribute("aria-disabled")).toBe("true");
    await userEvent.setup().click(button);
    expect(onCreate).not.toHaveBeenCalled();
    await expectNoAxeViolations(container);
  });

  test("a reserved name offers Choose a different name; a used allowance links to the founder's business", async () => {
    const onChooseName = vi.fn();
    const { container, rerender } = render(
      <CreateBusiness
        answers={seed.defaults}
        pending={false}
        error={wizardErrorMessage(new ConvexError({ code: "NAME_RESERVED" }))}
        onChooseName={onChooseName}
        onCreate={vi.fn()}
        onBack={vi.fn()}
      />,
    );
    await userEvent.setup().click(screen.getByRole("button", { name: "Choose a different name" }));
    expect(onChooseName).toHaveBeenCalledTimes(1);
    await expectNoAxeViolations(container);

    rerender(
      <CreateBusiness
        answers={seed.defaults}
        pending={false}
        error={wizardErrorMessage(new ConvexError({ code: "BUSINESS_LIMIT_REACHED", limit: 1, projectId: "project1" }))}
        existingBusinessHref="/dashboard/b/project1"
        onCreate={vi.fn()}
        onBack={vi.fn()}
      />,
    );
    expect(screen.getByRole("link", { name: "Open your business" }).getAttribute("href")).toBe("/dashboard/b/project1");
    expect(screen.queryByRole("button", { name: "Choose a different name" })).toBeNull();
    await expectNoAxeViolations(container);
  });

  test("businessRefusal only links a well-formed project id from the limit refusal", () => {
    expect(businessRefusal(new ConvexError({ code: "BUSINESS_LIMIT_REACHED", limit: 1, projectId: "abc123" })))
      .toEqual({ chooseName: false, existingBusinessHref: "/dashboard/b/abc123" });
    expect(businessRefusal(new ConvexError({ code: "BUSINESS_LIMIT_REACHED", limit: 1 })))
      .toEqual({ chooseName: false, existingBusinessHref: null });
    expect(businessRefusal(new ConvexError({ code: "BUSINESS_LIMIT_REACHED", projectId: "../admin" })))
      .toEqual({ chooseName: false, existingBusinessHref: null });
    expect(businessRefusal(new ConvexError({ code: "NAME_RESERVED" }))).toEqual({ chooseName: true, existingBusinessHref: null });
    expect(businessRefusal(new ConvexError({ code: "SLUG_UNAVAILABLE" }))).toEqual({ chooseName: true, existingBusinessHref: null });
    expect(businessRefusal(new Error("x"))).toEqual({ chooseName: false, existingBusinessHref: null });
  });

  test.each(REFUSALS)("the %s refusal is an alert tied to the Create button, with no axe violations", async (code, detail) => {
    const message = wizardErrorMessage(new ConvexError({ ...detail, code }));
    const { container } = render(
      <CreateBusiness answers={seed.defaults} pending={false} error={message} onCreate={vi.fn()} onBack={vi.fn()} />,
    );
    const alert = screen.getByRole("alert");
    expect(alert.textContent).toBe(message);
    expect(screen.getByRole("button", { name: "Create my business" }).getAttribute("aria-describedby")).toBe(alert.id);
    await expectNoAxeViolations(container);
  });
});

describe("WP74-S4 WizardFlow handoff", () => {
  beforeEach(() => {
    state.view = undefined;
    state.calls = [];
    state.createError = null;
    state.replace.mockReset();
  });

  test("Create my business calls createBusiness once, pins the URL to the session, then shows Meet your co-founder", async () => {
    state.view = finished();
    const props = { idea: { source: "library" as const, ideaSlug: "hydrotrail" }, ideaTitle: "HydroTrail", initialSessionId: null };
    const { rerender, container } = render(<WizardFlow {...props} />);
    await userEvent.setup().click(screen.getByRole("button", { name: "Create my business" }));
    await waitFor(() => expect(state.replace).toHaveBeenCalledWith(libraryIdeaUrl("hydrotrail", "session123"), { scroll: false }));
    const creates = state.calls.filter((call) => call.name === getFunctionName(api.workspace.business.createBusiness));
    expect(creates).toEqual([{ name: getFunctionName(api.workspace.business.createBusiness), args: { sessionId: "session123" } }]);

    await act(async () => {
      state.view = finished({ projectId: "project1" as never, name: "HydroTrail", slug: "hydrotrail" });
      rerender(<WizardFlow {...props} />);
    });
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Hi, I'm Wren.");
    expect(container.querySelector('[aria-live="polite"]')?.textContent).toBe("Business created. Meet your co-founder.");
    expect(document.activeElement?.tagName).toBe("H1");
    expect(document.activeElement?.textContent).toBe("Hi, I'm Wren.");
    await expectNoAxeViolations(container);
  });

  test("a refusal stays on the screen as an alert and the URL does not move", async () => {
    state.view = finished();
    state.createError = new ConvexError({ code: "BUSINESS_LIMIT_REACHED", plan: "free", limit: 1 });
    const { container } = render(<WizardFlow idea={{ source: "library", ideaSlug: "hydrotrail" }} ideaTitle="HydroTrail" initialSessionId={null} />);
    await userEvent.setup().click(screen.getByRole("button", { name: "Create my business" }));
    expect((await screen.findByRole("alert")).textContent).toBe("Your plan includes one business, and you already have it.");
    expect(state.replace).not.toHaveBeenCalled();
    await expectNoAxeViolations(container);
  });

  test("NAME_RESERVED in the flow: Choose a different name goes back to the name step", async () => {
    state.view = finished();
    state.createError = new ConvexError({ code: "NAME_RESERVED" });
    const { container } = render(<WizardFlow idea={{ source: "library", ideaSlug: "hydrotrail" }} ideaTitle="HydroTrail" initialSessionId={null} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Create my business" }));
    expect((await screen.findByRole("alert")).textContent).toMatch(/Choose a different name/);
    await user.click(screen.getByRole("button", { name: "Choose a different name" }));
    const back = state.calls.find((call) => call.name === getFunctionName(api.workspace.wizard.goBack));
    expect(back?.args).toEqual({ sessionId: "session123", step: "partner_name", to: "name" });
    await expectNoAxeViolations(container);
  });

  test("BUSINESS_LIMIT_REACHED in the flow links to the founder's own business", async () => {
    state.view = finished();
    state.createError = new ConvexError({ code: "BUSINESS_LIMIT_REACHED", plan: "free", limit: 1, projectId: "project9" });
    render(<WizardFlow idea={{ source: "library", ideaSlug: "hydrotrail" }} ideaTitle="HydroTrail" initialSessionId={null} />);
    await userEvent.setup().click(screen.getByRole("button", { name: "Create my business" }));
    expect((await screen.findByRole("link", { name: "Open your business" })).getAttribute("href")).toBe("/dashboard/b/project9");
  });

  test("a reload with ?session= reopens the session instead of starting a new one", () => {
    state.view = finished({ projectId: "project1" as never, name: "HydroTrail", slug: "hydrotrail" });
    render(<WizardFlow idea={{ source: "library", ideaSlug: "hydrotrail" }} ideaTitle="HydroTrail" initialSessionId="session123" />);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Hi, I'm Wren.");
    // No wizard call: the session is reopened, never restarted.
    expect(state.calls.filter((call) => !call.name.startsWith("crew/roster:"))).toEqual([]);
    // WP75-S1: the team section asks for the launch once; `startLaunch` is idempotent, so a reload starts nothing new.
    expect(state.calls.map((call) => call.name).filter((name) => name.startsWith("crew/roster:"))).toEqual(["crew/roster:startLaunch"]);
  });
});
