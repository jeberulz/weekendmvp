// @vitest-environment jsdom
/**
 * WP77-S4 review fixes — keyboard and focus on Wren's approval cards, driven
 * through the real DOM (Testing Library + user-event):
 * - after a decision, focus lands on the card's status line, never `<body>`;
 * - a card that leaves `pending` while focus is on its buttons moves focus
 *   to the status line too, but focus that already left the buttons (blur to
 *   the page or to another control) is never taken back;
 * - `decideApproval` refusals read as plain, accurate copy;
 * - the same approval shown in two replies never duplicates a DOM id.
 */
import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ConvexError } from "convex/values";
import { afterEach, describe, expect, test, vi } from "vitest";

import type { Id } from "@/convex/_generated/dataModel";
import type { WrenCardView } from "@/convex/workspace/wrenCards";

type Decide = (args: { projectId: string; approvalId: string; decision: string }) => Promise<{ status: string }>;
const state: { decide: Decide } = { decide: async () => ({ status: "approved" }) };

vi.mock("convex/react", () => ({
  useMutation: () => (args: Parameters<Decide>[0]) => state.decide(args),
}));

const { WrenChatCards } = await import("@/components/workspace/chat/WrenChatCards");

const projectId = "p1" as Id<"projects">;
type ApprovalView = Extract<WrenCardView, { kind: "approval" }>;

function card(status: ApprovalView["status"], approvalId = "a1"): ApprovalView {
  return {
    kind: "approval",
    approvalId: approvalId as Id<"approvals">,
    approvalKind: "post",
    status,
    title: "Post this social post",
    subject: "Social post: Trail day is Saturday",
    reviewRoute: "social",
  };
}

function statusLine(): HTMLElement {
  const element = document.querySelector<HTMLElement>("[data-card-status]");
  if (element === null) throw new Error("status line missing");
  return element;
}

afterEach(() => {
  cleanup();
  state.decide = async () => ({ status: "approved" });
});

describe("Wren approval card focus", () => {
  test("Approve by keyboard: focus moves to the status line, and stays there when the buttons go", async () => {
    const user = userEvent.setup();
    const view = render(<WrenChatCards projectId={projectId} cards={[card("pending")]} />);
    // WP67: the From line's employee link, then Review, then Approve.
    await user.tab();
    await user.tab();
    await user.tab();
    const approve = screen.getByRole("button", { name: /^Approve/u });
    expect(document.activeElement).toBe(approve);
    await user.keyboard("{Enter}");
    expect(document.activeElement).toBe(statusLine());
    expect(statusLine().getAttribute("tabindex")).toBe("-1");
    expect(statusLine().textContent).toContain("Approved.");

    view.rerender(<WrenChatCards projectId={projectId} cards={[card("approved")]} />);
    expect(screen.queryByRole("button", { name: /^Approve/u })).toBeNull();
    expect(document.activeElement).toBe(statusLine());
    expect(document.activeElement).not.toBe(document.body);
  });

  test("the card leaves pending while focus is on its buttons: focus lands on the status line, not body", async () => {
    let resolve: (value: { status: string }) => void = () => undefined;
    state.decide = () => new Promise((done) => {
      resolve = done;
    });
    const user = userEvent.setup();
    const view = render(<WrenChatCards projectId={projectId} cards={[card("pending")]} />);
    await user.click(screen.getByRole("button", { name: /^Not now/u }));
    // The thread updates before the mutation promise settles: the buttons unmount first.
    view.rerender(<WrenChatCards projectId={projectId} cards={[card("cancelled")]} />);
    expect(document.activeElement).toBe(statusLine());
    await act(async () => {
      resolve({ status: "cancelled" });
      await Promise.resolve();
    });
    expect(document.activeElement).toBe(statusLine());
    expect(statusLine().textContent).toContain("Okay, not now.");
  });

  test("focus elsewhere is left alone when the card changes", async () => {
    const view = render(
      <div>
        <button type="button">Elsewhere</button>
        <WrenChatCards projectId={projectId} cards={[card("pending")]} />
      </div>,
    );
    screen.getByRole("button", { name: "Elsewhere" }).focus();
    view.rerender(
      <div>
        <button type="button">Elsewhere</button>
        <WrenChatCards projectId={projectId} cards={[card("approved")]} />
      </div>,
    );
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Elsewhere" }));
  });

  test("focus that left the buttons (blur to the page) is not taken back by a remote status change", async () => {
    const user = userEvent.setup();
    const view = render(<WrenChatCards projectId={projectId} cards={[card("pending")]} />);
    // WP67: the From line's employee link, then Review, then Approve.
    await user.tab();
    await user.tab();
    await user.tab();
    const approve = screen.getByRole("button", { name: /^Approve/u });
    expect(document.activeElement).toBe(approve);
    // Focus leaves for nowhere in particular (a click on empty page), the button still in the page.
    act(() => approve.blur());
    expect(document.activeElement).toBe(document.body);
    view.rerender(<WrenChatCards projectId={projectId} cards={[card("approved")]} />);
    expect(document.activeElement).toBe(document.body);
    expect(document.activeElement).not.toBe(statusLine());
  });

  test("tabbing out of the buttons to the next control is not taken back either", async () => {
    const user = userEvent.setup();
    const view = render(
      <div>
        <WrenChatCards projectId={projectId} cards={[card("pending")]} />
        <button type="button">Next control</button>
      </div>,
    );
    // WP67: the From line's employee link, Review, Approve, Not now, then out.
    await user.tab();
    await user.tab();
    await user.tab();
    await user.tab();
    await user.tab();
    const next = screen.getByRole("button", { name: "Next control" });
    expect(document.activeElement).toBe(next);
    view.rerender(
      <div>
        <WrenChatCards projectId={projectId} cards={[card("approved")]} />
        <button type="button">Next control</button>
      </div>,
    );
    expect(document.activeElement).toBe(next);
  });

  test("a changed subject reads as changed, not as try again", async () => {
    state.decide = async () => {
      throw new ConvexError({ code: "APPROVAL_SUBJECT_CHANGED" });
    };
    const user = userEvent.setup();
    render(<WrenChatCards projectId={projectId} cards={[card("pending")]} />);
    await user.click(screen.getByRole("button", { name: /^Approve/u }));
    expect(statusLine().textContent).toContain("This changed since Wren raised it. Ask Wren again for a fresh card.");
    expect(statusLine().textContent).not.toContain("Try again");
    expect(document.activeElement).toBe(statusLine());
  });

  test("the button names carry the subject line", () => {
    render(<WrenChatCards projectId={projectId} cards={[card("pending")]} />);
    expect(screen.getByRole("button", { name: "Approve · Post this social post, Social post: Trail day is Saturday" }))
      .toBeTruthy();
    // The Social specialist raised it: the From line carries the one Review link.
    expect(screen.getByRole("link", { name: /^Review · Theo, Social/u }).getAttribute("href")).toBe("/dashboard/b/p1/social");
  });

  test("the same approval in two replies never duplicates an id", () => {
    render(
      <div>
        <WrenChatCards projectId={projectId} cards={[card("pending"), { kind: "explain", topic: "credits" }]} />
        <WrenChatCards projectId={projectId} cards={[card("pending"), { kind: "explain", topic: "credits" }]} />
      </div>,
    );
    const ids = Array.from(document.querySelectorAll("[id]")).map((element) => element.id);
    expect(ids.length).toBe(4);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
