// @vitest-environment jsdom
/**
 * WP95: the feedback loop's browser side. Contracts (what may be stored), the
 * error registry, the feedback dialog (what it attaches, what it never does),
 * and the funnel wiring of the review card.
 */
import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axe from "axe-core";
import { ConvexError } from "convex/values";
import { getFunctionName } from "convex/server";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { errorClassOf, sanitizeErrorClass, sanitizeRoute } from "@/lib/feedback/contracts";

const nav = vi.hoisted(() => ({ pathname: "/dashboard/b/k57abcdefghijklmnopqrstuvwxyz1234/email" }));
const convexState = vi.hoisted(() => ({
  submit: vi.fn<(args: Record<string, unknown>) => Promise<null>>(async () => null),
  queryRefs: [] as string[],
  progress: { steps: [{ key: "blueprint", state: "succeeded" }, { key: "email", state: "needs_you" }] } as { steps: { key: string; state: string }[] } | Error,
}));

vi.mock("next/navigation", () => ({ usePathname: () => nav.pathname }));
vi.mock("convex/react", () => ({
  useMutation: () => convexState.submit,
  useConvex: () => ({
    query: async (ref: Parameters<typeof getFunctionName>[0]) => {
      convexState.queryRefs.push(getFunctionName(ref));
      if (convexState.progress instanceof Error) throw convexState.progress;
      return convexState.progress;
    },
  }),
}));
vi.mock("@/components/platform/client-gates", () => ({
  WhenConvexReady: ({ children }: { children: ReactNode }) => children,
  QuietErrorBoundary: ({ children }: { children: ReactNode }) => children,
}));

const { FeedbackControl } = await import("@/components/workspace/feedback/FeedbackControl");
const clientErrors = await import("@/components/workspace/feedback/clientErrors");

const PROJECT = "k57abcdefghijklmnopqrstuvwxyz1234";

/** The dialog's submit button: the last "Send feedback" button in the document (the trigger comes first). */
function sendButton(): HTMLElement {
  return screen.getAllByRole("button", { name: "Send feedback" }).at(-1)!;
}

describe("feedback contracts", () => {
  test("a route keeps its pattern: no query, ids masked, weird input is unknown", () => {
    expect(sanitizeRoute(`/dashboard/b/${PROJECT}/email?x=hello@example.com#top`)).toBe("/dashboard/b/[id]/email");
    expect(sanitizeRoute("/start/ai-protein-tracker")).toBe("/start/ai-protein-tracker");
    expect(sanitizeRoute("https://evil.example/x")).toBe("/unknown");
    expect(sanitizeRoute("/a b")).toBe("/unknown");
    expect(sanitizeRoute(`/${"a".repeat(300)}`)).toBe("/unknown");
  });

  test("an error class is a token: a sentence, an email or a path never passes", () => {
    for (const bad of ["Could not load Luna's plan", "a@b.test", "../etc/passwd", "", "x".repeat(65)]) {
      expect(sanitizeErrorClass(bad)).toBeNull();
    }
    expect(sanitizeErrorClass("RESOURCE_NOT_FOUND")).toBe("RESOURCE_NOT_FOUND");
  });

  test("the class comes from a ConvexError code, the limiter kind or the error name, never the message", () => {
    expect(errorClassOf(new ConvexError({ code: "APPROVAL_NOT_PENDING", message: "my secret idea" }))).toBe("APPROVAL_NOT_PENDING");
    expect(errorClassOf(new ConvexError({ kind: "RateLimited", retryAfter: 5 }))).toBe("RateLimited");
    expect(errorClassOf(new TypeError("Cannot read my business name"))).toBe("TypeError");
    expect(errorClassOf(new ConvexError("a plain sentence the founder typed"))).toBe("ConvexError");
    expect(errorClassOf("boom")).toBe("Unknown");
  });
});

describe("client error registry", () => {
  beforeEach(() => {
    clientErrors.resetClientErrorsForTests();
    window.history.pushState({}, "", `/dashboard/b/${PROJECT}/team?q=secret`);
  });

  test("a report made before the reporter exists is queued, then sent with route, business and class only", async () => {
    const sent: unknown[] = [];
    clientErrors.reportClientError({ source: "boundary", error: new TypeError("hello@example.com") });
    clientErrors.registerErrorReporter(async (entry) => void sent.push(entry));
    expect(sent).toEqual([
      expect.objectContaining({ source: "boundary", errorClass: "TypeError", route: "/dashboard/b/[id]/team", projectId: PROJECT }),
    ]);
    expect(JSON.stringify(sent)).not.toMatch(/example\.com|secret/);
  });

  test("the same error within a few seconds is one report", () => {
    const sent: unknown[] = [];
    clientErrors.registerErrorReporter(async (entry) => void sent.push(entry));
    for (let index = 0; index < 5; index += 1) clientErrors.reportClientError({ source: "action", error: new Error("x") });
    expect(sent).toHaveLength(1);
  });

  test("a reporter that throws or rejects never throws out", () => {
    clientErrors.registerErrorReporter(() => {
      throw new Error("down");
    });
    expect(() => clientErrors.reportClientError({ source: "action", error: new Error("x") })).not.toThrow();
    clientErrors.resetClientErrorsForTests();
    clientErrors.registerErrorReporter(async () => Promise.reject(new Error("down")));
    expect(() => clientErrors.reportClientError({ source: "action", errorClass: "other" })).not.toThrow();
  });

  test("the business id comes from the workspace path, and from nowhere else", () => {
    expect(clientErrors.projectIdFromPath(`/dashboard/b/${PROJECT}`)).toBe(PROJECT);
    expect(clientErrors.projectIdFromPath(`/dashboard/b/${PROJECT}/email`)).toBe(PROJECT);
    expect(clientErrors.projectIdFromPath("/dashboard/settings")).toBeUndefined();
    expect(clientErrors.projectIdFromPath("/start/own")).toBeUndefined();
  });
});

describe("FeedbackControl", () => {
  beforeEach(() => {
    convexState.submit.mockReset();
    convexState.submit.mockResolvedValue(null);
    convexState.queryRefs.length = 0;
    convexState.progress = { steps: [{ key: "blueprint", state: "succeeded" }, { key: "email", state: "needs_you" }] };
    clientErrors.resetClientErrorsForTests();
    // jsdom has no modal dialog support: model the open state.
    HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
      this.setAttribute("open", "");
    };
    HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
      this.removeAttribute("open");
    };
  });
  afterEach(() => cleanup());

  function setup() {
    return render(<FeedbackControl surface="workspace" projectId={PROJECT} />);
  }

  test("opens a labelled dialog with the note field focused, and the dialog passes axe", async () => {
    const user = userEvent.setup();
    const { container } = setup();
    await user.click(screen.getByRole("button", { name: "Send feedback" }));
    const dialog = await screen.findByRole("dialog", { name: "Send feedback" });
    expect(dialog.getAttribute("aria-describedby")).not.toBeNull();
    expect(document.getElementById(dialog.getAttribute("aria-describedby") ?? "")?.textContent).toMatch(/Your chat is never sent/);
    expect(document.activeElement).toBe(screen.getByLabelText("What should we know?"));
    const result = await axe.run(document.body, { rules: { "color-contrast": { enabled: false }, region: { enabled: false } } });
    expect(result.violations.map((violation) => violation.id)).toEqual([]);
    void container;
  });

  test("an empty note is refused in words, nothing is sent", async () => {
    const user = userEvent.setup();
    setup();
    await user.click(screen.getByRole("button", { name: "Send feedback" }));
    await user.click(sendButton());
    expect((await screen.findByRole("alert")).textContent).toMatch(/Write a few words first/);
    expect(convexState.submit).not.toHaveBeenCalled();
  });

  test("sends the note, rating, masked route, business, launch states and version, never chat, then closes", async () => {
    const user = userEvent.setup();
    setup();
    await user.click(screen.getByRole("button", { name: "Send feedback" }));
    await user.type(screen.getByLabelText("What should we know?"), "  The email page is slow  ");
    await user.click(screen.getByRole("radio", { name: "4 out of 5" }));
    await user.click(sendButton());
    await act(async () => undefined);
    expect(convexState.submit).toHaveBeenCalledTimes(1);
    const args = convexState.submit.mock.calls[0]![0];
    expect(args).toMatchObject({
      surface: "workspace",
      note: "The email page is slow",
      rating: 4,
      route: "/dashboard/b/[id]/email",
      projectId: PROJECT,
      stepStates: [{ key: "blueprint", state: "succeeded" }, { key: "email", state: "needs_you" }],
    });
    expect(Object.keys(args).sort()).toEqual(["buildVersion", "note", "projectId", "rating", "route", "stepStates", "surface"]);
    expect(convexState.queryRefs).toEqual(["crew/launch:launchProgress"]);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByRole("status").textContent).toBe("Thanks, your feedback was sent.");
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Send feedback" }));
  });

  test("a failed launch read still sends the feedback", async () => {
    convexState.progress = new Error("workspace off");
    const user = userEvent.setup();
    setup();
    await user.click(screen.getByRole("button", { name: "Send feedback" }));
    await user.type(screen.getByLabelText("What should we know?"), "Works");
    await user.click(sendButton());
    await act(async () => undefined);
    expect(convexState.submit.mock.calls[0]![0]).toMatchObject({ note: "Works", stepStates: [] });
  });

  test("a refusal keeps the note, says so, and is reported by class only", async () => {
    const sent: unknown[] = [];
    clientErrors.registerErrorReporter(async (entry) => void sent.push(entry));
    convexState.submit.mockRejectedValue(new ConvexError({ code: "RATE_LIMITED" }));
    const user = userEvent.setup();
    setup();
    await user.click(screen.getByRole("button", { name: "Send feedback" }));
    await user.type(screen.getByLabelText("What should we know?"), "Please keep me");
    await user.click(sendButton());
    await act(async () => undefined);
    expect(await screen.findByText(/Your note is still here/)).toBeTruthy();
    expect((screen.getByLabelText("What should we know?") as HTMLTextAreaElement).value).toBe("Please keep me");
    expect(sent).toEqual([expect.objectContaining({ source: "action", errorClass: "RATE_LIMITED" })]);
    expect(JSON.stringify(sent)).not.toContain("Please keep me");
  });

  test("Cancel closes the dialog and returns focus to the button", async () => {
    const user = userEvent.setup();
    setup();
    await user.click(screen.getByRole("button", { name: "Send feedback" }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Send feedback" }));
    expect(convexState.submit).not.toHaveBeenCalled();
  });
});

describe("ReportingBoundary", () => {
  beforeEach(() => {
    clientErrors.resetClientErrorsForTests();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    window.history.pushState({}, "", `/dashboard/b/${PROJECT}/files`);
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  function Boom(): never {
    throw new TypeError("secret idea text");
  }

  test("reports class and route, shows the fallback, and clears it when the key changes", async () => {
    const { ReportingBoundary } = await import("@/components/workspace/feedback/ReportingBoundary");
    const sent: unknown[] = [];
    clientErrors.registerErrorReporter(async (entry) => void sent.push(entry));
    const view = render(
      <ReportingBoundary resetKey="a" fallback={() => <p>fallback shown</p>}>
        <Boom />
      </ReportingBoundary>,
    );
    expect(screen.getByText("fallback shown")).toBeTruthy();
    expect(sent).toEqual([expect.objectContaining({ source: "boundary", errorClass: "TypeError", route: "/dashboard/b/[id]/files", projectId: PROJECT })]);
    expect(JSON.stringify(sent)).not.toContain("secret");
    view.rerender(
      <ReportingBoundary resetKey="b" fallback={() => <p>fallback shown</p>}>
        <p>recovered</p>
      </ReportingBoundary>,
    );
    expect(screen.getByText("recovered")).toBeTruthy();
  });

  test("without a fallback it reports and hands the error to the next boundary", async () => {
    const { ReportingBoundary } = await import("@/components/workspace/feedback/ReportingBoundary");
    const sent: unknown[] = [];
    clientErrors.registerErrorReporter(async (entry) => void sent.push(entry));
    render(
      <ReportingBoundary fallback={() => <p>outer fallback</p>}>
        <ReportingBoundary>
          <Boom />
        </ReportingBoundary>
      </ReportingBoundary>,
    );
    expect(screen.getByText("outer fallback")).toBeTruthy();
    expect(sent).toHaveLength(1);
  });
});

describe("review card funnel events", () => {
  let gtag: ReturnType<typeof vi.fn<(...args: unknown[]) => void>>;
  beforeEach(() => {
    gtag = vi.fn<(...args: unknown[]) => void>();
    window.gtag = gtag;
  });
  afterEach(() => {
    cleanup();
    delete window.gtag;
  });

  async function renderCard(decide: () => Promise<{ status: string; changed: boolean }>) {
    const { ArtifactReviewCard } = await import("@/components/workspace/review/ArtifactReviewCard");
    return render(
      <ArtifactReviewCard
        card={{ status: "pending", expiresAt: Date.now() + 86_400_000 }}
        decide={decide}
        preview={{ kind: "failed" }}
        artifact={{ plural: "emails", approvedNote: "Nothing is sent yet.", piece: "email_sequence" }}
      />,
    );
  }

  test("approving sends review_approved with the piece only", async () => {
    const user = userEvent.setup();
    await renderCard(async () => ({ status: "approved", changed: true }));
    await user.click(screen.getByRole("button", { name: "Approve" }));
    await act(async () => undefined);
    expect(gtag).toHaveBeenCalledWith("event", "review_approved", { piece: "email_sequence" });
  });

  test("a failed approval sends no funnel event but is reported by class", async () => {
    const user = userEvent.setup();
    const sent: unknown[] = [];
    clientErrors.resetClientErrorsForTests();
    clientErrors.registerErrorReporter(async (entry) => void sent.push(entry));
    await renderCard(async () => {
      throw new ConvexError({ code: "APPROVAL_NOT_PENDING" });
    });
    await user.click(screen.getByRole("button", { name: "Approve" }));
    await act(async () => undefined);
    expect(gtag).not.toHaveBeenCalled();
    expect(sent).toEqual([expect.objectContaining({ source: "action", errorClass: "APPROVAL_NOT_PENDING" })]);
  });
});
