// @vitest-environment jsdom
/**
 * WP76-S1b: the Email page panel through the real DOM (Testing Library +
 * user-event) and axe-core: each state, the four emails in order, text never
 * parsed as HTML, approve and ask-for-changes arguments, an empty note
 * refused before sending, focus and live region, and no buttons on a
 * non-pending or expired card.
 */
import axe from "axe-core";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, describe, expect, test, vi } from "vitest";

import type { Id } from "@/convex/_generated/dataModel";
import {
  changesOutcomeCopy,
  checkEmailNote,
  emailBodyParagraphs,
  emailCtaCopy,
  emailDecisionErrorCopy,
  emailDelayCopy,
  EMAIL_NOTE_MAX_LENGTH,
  splitMergeTags,
} from "@/lib/workspace/emailPage";

const FREE_PREVIEW = { outcome: "free", changeRound: 1, freeRoundsLeft: 2 };
const live: { view: unknown; preview: unknown; previewThrows: boolean } = {
  view: undefined,
  preview: FREE_PREVIEW,
  previewThrows: false,
};
const decideMock = vi.fn();
const FREE_RESULT = {
  approvalId: "approval1",
  status: "changes_requested",
  changed: true,
  changeRound: { outcome: "free", changeRound: 1, freeRoundsLeft: 1, taskId: "task1" },
};

vi.mock("convex/react", async () => {
  const { getFunctionName } = await import("convex/server");
  return {
    useQuery: (ref: Parameters<typeof getFunctionName>[0], args: unknown) => {
      if (args === "skip") return undefined;
      if (getFunctionName(ref).includes("previewChangeRound")) {
        if (live.previewThrows) throw new Error("preview failed");
        return live.preview;
      }
      return live.view;
    },
    useMutation: () => decideMock,
  };
});
vi.mock("@/components/platform/client-gates", async () => {
  const actual = await vi.importActual<typeof import("@/components/platform/client-gates")>("@/components/platform/client-gates");
  return {
    WhenConvexReady: ({ children }: { children: ReactNode }) => children,
    QuietErrorBoundary: actual.QuietErrorBoundary,
  };
});

const { EmailSequencePanel } = await import("@/components/workspace/email/EmailSequencePanel");

const PROJECT = "project1" as Id<"projects">;
const APPROVAL = "approval1" as Id<"approvals">;

function email(kind: string, delayHours: number, extra: Record<string, unknown> = {}) {
  return {
    kind,
    delayHours,
    subject: `Subject ${kind}`,
    preview: `Preview ${kind}`,
    body: `First paragraph for ${kind}.\n\nSecond paragraph, hi {first name}.`,
    goal: `Goal ${kind}`,
    ...extra,
  };
}

function ready(card: unknown = { approvalId: APPROVAL, status: "pending", changeRound: 0n, expiresAt: Date.now() + 86_400_000 }) {
  return {
    state: "ready",
    status: "draft",
    name: "HydroTrail welcome",
    senderName: "John at HydroTrail",
    emails: [
      email("welcome", 0, { cta: { label: "Join the waitlist", target: "waitlist" } }),
      email("value", 48),
      email("offer", 36, { cta: { label: "See it", target: "site" } }),
      email("follow_up", 24, { cta: { label: "Reply to me", target: "reply" } }),
    ],
    card,
  };
}

function show() {
  return render(<EmailSequencePanel projectId={PROJECT} />);
}

afterEach(() => {
  cleanup();
  decideMock.mockReset();
  live.view = undefined;
  live.preview = FREE_PREVIEW;
  live.previewThrows = false;
});

describe("helpers", () => {
  test("delay wording", () => {
    expect(emailDelayCopy(0)).toBe("As soon as someone confirms");
    expect(emailDelayCopy(1)).toBe("1 hour after the previous email");
    expect(emailDelayCopy(36)).toBe("36 hours after the previous email");
    expect(emailDelayCopy(24)).toBe("1 day after the previous email");
    expect(emailDelayCopy(72)).toBe("3 days after the previous email");
  });
  test("paragraphs and cta wording", () => {
    expect(emailBodyParagraphs("a\nb\n\n\nc\r\n\r\nd")).toEqual(["a\nb", "c", "d"]);
    expect(emailCtaCopy({ label: "Go", target: "site" })).toEqual({ label: "Go", destination: "your site" });
    expect(emailCtaCopy({ label: "Go", target: "waitlist" }).destination).toBe("your waitlist");
    expect(emailCtaCopy({ label: "Go", target: "reply" }).destination).toBe("a reply");
  });
  test("note rule mirrors the server", () => {
    expect(checkEmailNote("   ").ok).toBe(false);
    expect(checkEmailNote("x".repeat(EMAIL_NOTE_MAX_LENGTH + 1)).ok).toBe(false);
    expect(checkEmailNote("  shorter  ")).toEqual({ ok: true, note: "shorter" });
  });
  test("change round answers", () => {
    expect(changesOutcomeCopy({ outcome: "free" }, "pending", true)).toMatch(/rewriting/);
    const spend = changesOutcomeCopy({ outcome: "spend_required" }, "pending", true);
    expect(spend).toMatch(/costs credits/);
    expect(spend).not.toMatch(/approvals|settings|billing/i);
    expect(changesOutcomeCopy({ outcome: "not_available", reason: "busy" }, "pending", false)).toMatch(/still working/);
    expect(changesOutcomeCopy({ outcome: "not_available", reason: "stale" }, "pending", false)).toMatch(/can't be asked for/);
    expect(changesOutcomeCopy({ outcome: "not_available", reason: "plan_gated" }, "pending", false)).toMatch(/can't/);
    expect(changesOutcomeCopy(undefined, "expired", true)).toBe("This card expired.");
    expect(changesOutcomeCopy(undefined, "changes_requested", false)).toMatch(/note wasn't sent/);
    expect(changesOutcomeCopy({ outcome: "spend_required", costCredits: 1 }, "pending", true)).toMatch(/costs 1 credit\./);
  });
  test("merge tags split out as tokens", () => {
    expect(splitMergeTags("Hi {first name}, welcome")).toEqual([
      { text: "Hi ", tag: false },
      { text: "{first name}", tag: true },
      { text: ", welcome", tag: false },
    ]);
    expect(splitMergeTags("none")).toEqual([{ text: "none", tag: false }]);
  });
  test("error copy", () => {
    expect(emailDecisionErrorCopy(null, true)).toMatch(/lot of changes/);
    expect(emailDecisionErrorCopy("APPROVAL_SUBJECT_CHANGED", false)).toMatch(/newest version/);
    expect(emailDecisionErrorCopy("APPROVAL_SUBJECT_CHANGED", false)).not.toMatch(/reload/i);
    expect(emailDecisionErrorCopy("APPROVAL_INVALID_NOTE", false)).toMatch(/2,000/);
    expect(emailDecisionErrorCopy("APPROVAL_ALREADY_DECIDED", false)).toBeNull();
  });
});

describe("states", () => {
  test("loading", () => {
    show();
    expect(screen.getByText("Loading your emails…")).toBeTruthy();
  });
  test("none", () => {
    live.view = { state: "none" };
    show();
    expect(screen.getByText(/on its way/)).toBeTruthy();
  });
  test("unavailable shows calm copy with no detail", () => {
    live.view = { state: "unavailable" };
    show();
    expect(screen.getByText(/can't be shown right now/)).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
  });
});

describe("ready", () => {
  test("four emails in order with their facts, and a heading outline", () => {
    live.view = ready();
    show();
    expect(screen.getByRole("heading", { level: 2, name: "HydroTrail welcome" })).toBeTruthy();
    expect(screen.getByText(/Sent from John at HydroTrail/)).toBeTruthy();
    expect(screen.getByText(/Sequence status: Draft/)).toBeTruthy();
    const list = screen.getByRole("list", { name: "The emails, in order" });
    const items = within(list).getAllByRole("listitem");
    expect(items).toHaveLength(4);
    expect(within(items[0]).getByRole("heading", { level: 3 }).textContent).toBe("Welcome");
    expect(within(items[1]).getByRole("heading", { level: 3 }).textContent).toBe("Value");
    expect(within(items[2]).getByRole("heading", { level: 3 }).textContent).toBe("Offer");
    expect(within(items[3]).getByRole("heading", { level: 3 }).textContent).toBe("Follow-up");
    expect(within(items[0]).getByText("As soon as someone confirms")).toBeTruthy();
    expect(within(items[1]).getByText("2 days after the previous email")).toBeTruthy();
    expect(within(items[2]).getByText("36 hours after the previous email")).toBeTruthy();
    expect(within(items[0]).getByText("Subject welcome")).toBeTruthy();
    expect(within(items[0]).getByText("Preview welcome")).toBeTruthy();
    expect(within(items[0]).getByText(/Join the waitlist/).textContent).toContain("your waitlist");
    expect(within(items[3]).getByText(/Reply to me/).textContent).toContain("a reply");
    expect(within(items[1]).queryByText("Button")).toBeNull();
    expect(within(items[0]).getByText("Goal welcome")).toBeTruthy();
    expect(within(items[0]).getByText("Email 1 of 4")).toBeTruthy();
    expect(within(items[0]).getAllByText(/paragraph/)).toHaveLength(2);
    // The merge tag is a visible token with a spoken hint, never filled in.
    const token = within(items[0]).getByText("{first name}");
    expect(token.textContent).toBe("{first name} (merge tag)");
    expect(token.querySelector(".sr-only")?.textContent).toBe(" (merge tag)");
  });

  test("no ids or raw statuses render", () => {
    live.view = ready();
    const { container } = show();
    const text = container.textContent ?? "";
    expect(text).not.toContain("approval1");
    expect(text).not.toContain("project1");
    expect(text).not.toMatch(/changes_requested|\bpending\b/);
  });

  test("body text is never parsed as HTML", () => {
    const view = ready();
    view.emails[0] = email("welcome", 0, { body: "<b>bold</b> <img src=x onerror=alert(1)> **star**" });
    live.view = view;
    const { container } = show();
    expect(container.querySelector("b")).toBeNull();
    expect(container.querySelector("img")).toBeNull();
    expect(container.textContent).toContain("<b>bold</b>");
    expect(container.textContent).toContain("**star**");
  });

  test("passes axe", async () => {
    live.view = ready();
    const { container } = show();
    const results = await axe.run(container, { runOnly: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] });
    expect(results.violations.map((v) => v.id)).toEqual([]);
  });
});

describe("card", () => {
  test("approve calls the mutation, announces, and moves focus to the status line", async () => {
    decideMock.mockResolvedValue({ status: "approved", changed: true });
    live.view = ready();
    show();
    const user = userEvent.setup();
    const approve = screen.getByRole("button", { name: "Approve" });
    approve.focus();
    await user.click(approve);
    expect(decideMock).toHaveBeenCalledWith({ projectId: PROJECT, approvalId: APPROVAL, decision: "approve" });
    await waitFor(() => expect(screen.getByText("Approved.")).toBeTruthy());
    expect(document.activeElement).toBe(screen.getByText(/^Review status:/).parentElement);
    expect(screen.getByRole("status").textContent).toBe("Approved.");
  });

  test("ask for changes: labelled field, trimmed note sent, form closes, focus on status", async () => {
    decideMock.mockResolvedValue(FREE_RESULT);
    live.view = ready();
    show();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Ask for changes" }));
    const field = screen.getByLabelText("What should change?");
    expect(document.activeElement).toBe(field);
    expect(field.getAttribute("aria-describedby")).toBeTruthy();
    await user.type(field, "  Warmer tone  ");
    await user.click(screen.getByRole("button", { name: "Send changes" }));
    expect(decideMock).toHaveBeenCalledWith({
      projectId: PROJECT,
      approvalId: APPROVAL,
      decision: "request_changes",
      note: "Warmer tone",
    });
    await waitFor(() => expect(screen.queryByLabelText("What should change?")).toBeNull());
    expect(screen.getByRole("status").textContent).toMatch(/rewriting/);
    expect(document.activeElement).toBe(screen.getByText(/^Review status:/).parentElement);
  });

  test("an empty note is refused before sending, tied to the field", async () => {
    live.view = ready();
    show();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Ask for changes" }));
    await user.type(screen.getByLabelText("What should change?"), "   ");
    await user.click(screen.getByRole("button", { name: "Send changes" }));
    expect(decideMock).not.toHaveBeenCalled();
    const alert = screen.getByRole("alert");
    const field = screen.getByLabelText("What should change?");
    expect(field.getAttribute("aria-describedby")).toContain(alert.id);
    expect(document.activeElement).toBe(field);
  });

  test("Escape and Cancel close the form and return focus to Ask for changes", async () => {
    live.view = ready();
    show();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Ask for changes" }));
    await user.keyboard("{Escape}");
    expect(screen.queryByLabelText("What should change?")).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Ask for changes" }));
    await user.click(screen.getByRole("button", { name: "Ask for changes" }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Ask for changes" }));
  });

  test("a refused decision shows calm copy", async () => {
    const { ConvexError } = await import("convex/values");
    decideMock.mockRejectedValue(new ConvexError({ code: "APPROVAL_ALREADY_DECIDED" }));
    live.view = ready();
    show();
    await userEvent.setup().click(screen.getByRole("button", { name: "Approve" }));
    await waitFor(() => expect(screen.getByText("This card was already decided.")).toBeTruthy());
  });

  test("buttons stay focusable while a decision is in flight", async () => {
    let resolve: (value: unknown) => void = () => undefined;
    decideMock.mockReturnValue(new Promise((r) => { resolve = r; }));
    live.view = ready();
    show();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Approve" }));
    const approve = screen.getByRole("button", { name: "Approve" });
    expect(approve.getAttribute("aria-disabled")).toBe("true");
    expect(approve.hasAttribute("disabled")).toBe(false);
    await user.click(approve);
    expect(decideMock).toHaveBeenCalledTimes(1);
    resolve({ status: "approved", changed: true });
    await waitFor(() => expect(screen.getByText("Approved.")).toBeTruthy());
  });

  test.each([
    ["approved", "Review status: Approved. Nothing is sent yet."],
    ["expired", "Review status: Expired"],
    ["cancelled", "Review status: Not going ahead"],
  ])("a %s card shows its status in words and no buttons", (status, words) => {
    live.view = ready({ approvalId: APPROVAL, status, changeRound: 0n, expiresAt: Date.now() + 1000 });
    show();
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByText(words)).toBeTruthy();
    if (status === "expired" || status === "cancelled") {
      expect(screen.getByText(/This review closed without a decision\. Your emails stay as they are\./)).toBeTruthy();
    }
  });

  test("an expired pending card shows no buttons", () => {
    live.view = ready({ approvalId: APPROVAL, status: "pending", changeRound: 0n, expiresAt: Date.now() - 1 });
    show();
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByText("Review status: Expired")).toBeTruthy();
    expect(screen.getByText(/This review closed/)).toBeTruthy();
  });

  async function askFor(text: string) {
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Ask for changes" }));
    await user.type(screen.getByLabelText("What should change?"), text);
    await user.click(screen.getByRole("button", { name: "Send changes" }));
    return user;
  }

  test("an expired result is announced", async () => {
    decideMock.mockResolvedValue({ status: "expired", changed: true });
    live.view = ready();
    show();
    await askFor("Shorter");
    await waitFor(() => expect(screen.getByRole("status").textContent).toBe("This card expired."));
  });

  test("a busy answer keeps the form open with the note", async () => {
    decideMock.mockResolvedValue({ status: "pending", changed: false, changeRound: { outcome: "not_available", reason: "busy" } });
    live.view = ready();
    show();
    await askFor("Warmer");
    await waitFor(() => expect(screen.getByRole("status").textContent).toMatch(/still working/));
    expect((screen.getByLabelText("What should change?") as HTMLTextAreaElement).value).toBe("Warmer");
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Send changes" }));
  });

  test("a spend-required answer closes the form and names no unbuilt place", async () => {
    decideMock.mockResolvedValue({ status: "pending", changed: false, changeRound: { outcome: "spend_required" } });
    live.view = ready();
    show();
    await askFor("More");
    await waitFor(() => expect(screen.queryByLabelText("What should change?")).toBeNull());
    expect(screen.getByRole("status").textContent).toMatch(/costs credits/);
  });

  test("a changes_requested card offers Ask for changes again, with no Approve", async () => {
    decideMock.mockResolvedValue(FREE_RESULT);
    live.view = ready({ approvalId: APPROVAL, status: "changes_requested", changeRound: 1n, expiresAt: Date.now() + 1000 });
    show();
    expect(screen.getByText("Review status: Changes requested")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Approve" })).toBeNull();
    await askFor("Try again");
    expect(decideMock).toHaveBeenCalledWith({
      projectId: PROJECT,
      approvalId: APPROVAL,
      decision: "request_changes",
      note: "Try again",
    });
  });

  test("a network error shows calm copy and keeps the form open", async () => {
    decideMock.mockRejectedValue(new Error("offline"));
    live.view = ready();
    show();
    await askFor("Hello");
    await waitFor(() => expect(screen.getByRole("status").textContent).toMatch(/didn't go through/));
    expect((screen.getByLabelText("What should change?") as HTMLTextAreaElement).value).toBe("Hello");
  });

  test("a server APPROVAL_INVALID_NOTE shows under the field", async () => {
    const { ConvexError } = await import("convex/values");
    decideMock.mockRejectedValue(new ConvexError({ code: "APPROVAL_INVALID_NOTE" }));
    live.view = ready();
    show();
    await askFor("Hello");
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toMatch(/2,000/);
    expect(screen.getByLabelText("What should change?").getAttribute("aria-describedby")).toContain(alert.id);
  });

  test("a changed subject says to look at the newest version, not reload", async () => {
    const { ConvexError } = await import("convex/values");
    decideMock.mockRejectedValue(new ConvexError({ code: "APPROVAL_SUBJECT_CHANGED" }));
    live.view = ready();
    show();
    await userEvent.setup().click(screen.getByRole("button", { name: "Approve" }));
    await waitFor(() => expect(screen.getByRole("status").textContent).toMatch(/newest version/));
    expect(screen.getByRole("status").textContent).not.toMatch(/reload/i);
  });

  test("a rate-limited answer has its own line", async () => {
    const { ConvexError } = await import("convex/values");
    decideMock.mockRejectedValue(new ConvexError({ kind: "RateLimited" }));
    live.view = ready();
    show();
    await userEvent.setup().click(screen.getByRole("button", { name: "Approve" }));
    await waitFor(() => expect(screen.getByRole("status").textContent).toMatch(/lot of changes this hour/));
  });

  test("a live update that leaves pending returns focus from Approve to the status line", () => {
    live.view = ready();
    const { rerender } = show();
    screen.getByRole("button", { name: "Approve" }).focus();
    live.view = ready({ approvalId: APPROVAL, status: "approved", changeRound: 0n, expiresAt: Date.now() + 1000 });
    rerender(<EmailSequencePanel projectId={PROJECT} />);
    expect(screen.queryByRole("button")).toBeNull();
    expect(document.activeElement).toBe(screen.getByText(/^Review status:/).parentElement);
  });

  test("a live update does not steal focus the founder moved elsewhere", () => {
    const tree = (
      <>
        <button type="button">Elsewhere</button>
        <EmailSequencePanel projectId={PROJECT} />
      </>
    );
    live.view = ready();
    const { rerender } = render(tree);
    screen.getByRole("button", { name: "Approve" }).focus();
    screen.getByRole("button", { name: "Elsewhere" }).focus();
    live.view = ready({ approvalId: APPROVAL, status: "approved", changeRound: 0n, expiresAt: Date.now() + 1000 });
    rerender(tree);
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Elsewhere" }));
  });

  test("Ask for changes does not open while a decision is in flight", async () => {
    decideMock.mockReturnValue(new Promise(() => undefined));
    live.view = ready();
    show();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Approve" }));
    await user.click(screen.getByRole("button", { name: "Ask for changes" }));
    expect(screen.queryByLabelText("What should change?")).toBeNull();
  });

  test("a pending card with a spend_required preview keeps Approve, hides Ask, and says the cost", () => {
    live.preview = { outcome: "spend_required", changeRound: 3, costCredits: 5 };
    live.view = ready();
    show();
    expect(screen.getByRole("button", { name: "Approve" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Ask for changes" })).toBeNull();
    expect(screen.getByText("Another round of changes costs 5 credits. Paying for changes isn't open yet, so you can approve these emails as they are.")).toBeTruthy();
    expect(decideMock).not.toHaveBeenCalled();
  });

  test("a changes_requested card with a spend_required preview is honest and never says the team is working", () => {
    live.preview = { outcome: "spend_required", changeRound: 3, costCredits: 5 };
    live.view = ready({ approvalId: APPROVAL, status: "changes_requested", changeRound: 2n, expiresAt: Date.now() + 1000 });
    show();
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByText("The next round of changes costs 5 credits. Paying for changes isn't open yet, so your emails stay as they are.")).toBeTruthy();
    expect(screen.queryByText(/working on your changes/)).toBeNull();
  });

  test("a free preview shows the free rounds left", () => {
    live.preview = { outcome: "free", changeRound: 1, freeRoundsLeft: 2 };
    live.view = ready();
    show();
    expect(screen.getByText("2 free rounds of changes left.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Ask for changes" })).toBeTruthy();
  });

  test("a not_available preview hides Ask and gives the reason", () => {
    live.preview = { outcome: "not_available", reason: "plan_gated" };
    live.view = ready();
    show();
    expect(screen.queryByRole("button", { name: "Ask for changes" })).toBeNull();
    expect(screen.getByRole("button", { name: "Approve" })).toBeTruthy();
    expect(screen.getByText("Changes can't be asked for on this right now.")).toBeTruthy();
  });

  test("a failed preview hides Ask for changes and keeps Approve", () => {
    live.previewThrows = true;
    live.view = ready();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    show();
    expect(screen.queryByRole("button", { name: "Ask for changes" })).toBeNull();
    expect(screen.getByRole("button", { name: "Approve" })).toBeTruthy();
    vi.restoreAllMocks();
  });

  test("the team is working only while the preview says busy", async () => {
    live.view = ready({ approvalId: APPROVAL, status: "changes_requested", changeRound: 1n, expiresAt: Date.now() + 1000 });
    live.preview = { outcome: "free", changeRound: 2, freeRoundsLeft: 1 };
    const { unmount } = show();
    expect(screen.queryByText("Your team is working on your changes.")).toBeNull();
    expect(screen.getByText(/You can ask for changes again\. 1 free round of changes left\./)).toBeTruthy();
    unmount();
    live.preview = { outcome: "not_available", reason: "busy" };
    show();
    expect(screen.getByText("Your team is working on your changes.")).toBeTruthy();
  });

  test("a re-ask that changes nothing keeps the form and the note, and says it was not sent", async () => {
    decideMock.mockResolvedValue({ approvalId: "approval1", status: "changes_requested", changed: false });
    live.view = ready({ approvalId: APPROVAL, status: "changes_requested", changeRound: 1n, expiresAt: Date.now() + 1000 });
    show();
    await askFor("Second note");
    await waitFor(() => expect(screen.getByRole("status").textContent).toMatch(/This note wasn't sent/));
    expect((screen.getByLabelText("What should change?") as HTMLTextAreaElement).value).toBe("Second note");
    expect(screen.queryByText("Your team is working on your changes.")).toBeNull();
  });

  test("the working line clears when the preview is free again, and sets when it turns busy", () => {
    live.view = ready({ approvalId: APPROVAL, status: "changes_requested", changeRound: 1n, expiresAt: Date.now() + 1000 });
    live.preview = { outcome: "not_available", reason: "busy" };
    const { rerender } = show();
    expect(screen.getByText("Your team is working on your changes.")).toBeTruthy();
    live.preview = { outcome: "free", changeRound: 2, freeRoundsLeft: 1 };
    rerender(<EmailSequencePanel projectId={PROJECT} />);
    expect(screen.queryByText("Your team is working on your changes.")).toBeNull();
    expect(screen.getByRole("button", { name: "Ask for changes" })).toBeTruthy();
  });

  test("focus on Ask for changes moves to the status line when the preview turns busy", () => {
    live.view = ready({ approvalId: APPROVAL, status: "changes_requested", changeRound: 1n, expiresAt: Date.now() + 1000 });
    const { rerender } = show();
    screen.getByRole("button", { name: "Ask for changes" }).focus();
    live.preview = { outcome: "not_available", reason: "busy" };
    rerender(<EmailSequencePanel projectId={PROJECT} />);
    expect(screen.queryByRole("button", { name: "Ask for changes" })).toBeNull();
    expect(document.activeElement).toBe(screen.getByText(/^Review status:/).parentElement);
  });

  test("a live update from pending to changes_requested returns focus from Approve to the status line", () => {
    live.view = ready();
    const { rerender } = show();
    screen.getByRole("button", { name: "Approve" }).focus();
    live.view = ready({ approvalId: APPROVAL, status: "changes_requested", changeRound: 1n, expiresAt: Date.now() + 1000 });
    rerender(<EmailSequencePanel projectId={PROJECT} />);
    expect(screen.queryByRole("button", { name: "Approve" })).toBeNull();
    expect(document.activeElement).toBe(screen.getByText(/^Review status:/).parentElement);
  });

  test("no card, no review section", () => {
    live.view = ready(null);
    show();
    expect(screen.queryByText("Your review")).toBeNull();
    expect(screen.getAllByRole("listitem")).toHaveLength(4);
  });
});
