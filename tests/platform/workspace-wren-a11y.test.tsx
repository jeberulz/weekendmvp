// @vitest-environment jsdom
/**
 * WP77-S6 — accessibility of the Wren chat, driven through the real DOM
 * (Testing Library + user-event) and checked with axe-core (WCAG 2.1 A/AA):
 * - states: empty, streaming, stopped, done with cards, decision pending, decided;
 * - the thread's log is silent (`aria-live="off"`) and ONE polite status line
 *   announces a reply once (started, finished, failed, stopped), never per delta;
 * - keyboard: Tab order, Enter and Shift+Enter in the composer, focus stays
 *   in the composer after a send, and never falls to `<body>`.
 */
import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axe from "axe-core";
import type { FunctionReturnType } from "convex/server";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import type { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { WREN_STREAM_STALE_MS } from "@/lib/workspace/wren";

type Thread = FunctionReturnType<typeof api.workspace.chat.listWrenThread>;
type Row = Thread[number];

const state: {
  thread: Thread | undefined;
  send: (args: { body: string }) => Promise<{ kind: string }>;
  decide: () => Promise<{ status: string }>;
  retry: () => Promise<{ kind: string }>;
} = {
  thread: undefined,
  send: async () => ({ kind: "sent" }),
  decide: async () => ({ status: "approved" }),
  retry: async () => ({ kind: "started" }),
};
const sent: string[] = [];

vi.mock("convex/react", async () => {
  const { getFunctionName } = await import("convex/server");
  return {
    useQuery: () => state.thread,
    useMutation: (ref: Parameters<typeof getFunctionName>[0]) => {
      const name = getFunctionName(ref);
      if (name.endsWith("sendWrenMessage")) return (args: { body: string }) => state.send(args);
      if (name.endsWith("retryWrenReply")) return () => state.retry();
      return () => state.decide();
    },
  };
});
vi.mock("@/components/platform/client-gates", () => ({
  WhenConvexReady: ({ children }: { children: ReactNode }) => children,
  QuietErrorBoundary: ({ children }: { children: ReactNode }) => children,
}));

const { WrenChatPanel } = await import("@/components/workspace/chat/WrenChatPanel");
const projectId = "p1" as Id<"projects">;
const NOW = Date.UTC(2026, 10, 6, 12, 0, 0);

function row(id: string, author: Row["author"], body: string, status: Row["status"], cards: Row["cards"] = [], updatedAt = NOW): Row {
  return { _id: id as Id<"chat_messages">, author, body, status, createdAt: NOW, updatedAt, cards };
}

const pendingCard: Row["cards"][number] = {
  kind: "approval", approvalId: "a1" as Id<"approvals">, approvalKind: "post", status: "pending",
  title: "Post this social post", subject: "Social post: Trail day is Saturday", reviewRoute: "social",
};

async function violations(): Promise<string[]> {
  const results = await axe.run(document.body, {
    runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] },
    resultTypes: ["violations"],
    rules: { "color-contrast": { enabled: false } }, // jsdom has no layout or computed colours
  });
  return results.violations.map((violation) => violation.id);
}

function mount(thread: Thread | undefined) {
  state.thread = thread;
  return render(<main><WrenChatPanel projectId={projectId} /></main>);
}

function statusLine(): HTMLElement {
  const element = document.querySelector<HTMLElement>('p[role="status"]');
  if (element === null) throw new Error("status line missing");
  return element;
}

function composer(): HTMLTextAreaElement {
  return screen.getByRole("textbox", { name: "Message Wren" });
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(new Date(NOW));
  sent.length = 0;
  state.send = async ({ body }) => {
    sent.push(body);
    return { kind: "sent" };
  };
  state.decide = async () => ({ status: "approved" });
  state.retry = async () => ({ kind: "started" });
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("Wren chat axe, by state", () => {
  test("empty thread", async () => {
    mount([]);
    expect(screen.getByText("Ask Wren anything about your launch")).toBeTruthy();
    expect(screen.queryByRole("log")).toBeNull();
    expect(await violations()).toEqual([]);
  });

  test("streaming: aria-busy reply, a silent log, Send focusable but aria-disabled", async () => {
    mount([row("f1", "founder", "Hello", "done"), row("w1", "wren", "Sunday wor", "streaming")]);
    const log = screen.getByRole("log", { name: "Messages" });
    expect(log.getAttribute("aria-live")).toBe("off");
    expect(log.querySelector('[aria-busy="true"]')).not.toBeNull();
    expect(screen.getByRole("button", { name: "Send message" }).getAttribute("aria-disabled")).toBe("true");
    expect(await violations()).toEqual([]);
  });

  test("stopped (stale): the honest line and Try again", async () => {
    mount([row("f1", "founder", "Hello", "done"), row("w1", "wren", "Partial", "streaming", [], NOW - WREN_STREAM_STALE_MS - 1_000)]);
    act(() => {
      vi.advanceTimersByTime(5);
    });
    expect(screen.getByText("Wren stopped partway through.")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Try again/u })).toBeTruthy();
    expect(document.querySelector('[aria-busy="true"]')).toBeNull();
    expect(await violations()).toEqual([]);
  });

  test("done with cards: a labelled list of cards, no live region inside the log", async () => {
    mount([
      row("f1", "founder", "Can I post?", "done"),
      row("w1", "wren", "Here you go.", "done", [pendingCard, { kind: "explain", topic: "approvals" }, { kind: "navigate", route: "brand" }]),
    ]);
    const list = screen.getByRole("list", { name: "Cards from Wren" });
    expect(list.querySelector("[aria-live], [role='status']")).toBeNull();
    expect(await violations()).toEqual([]);
  });

  test("card decision pending: buttons stay focusable, aria-disabled, status says so", async () => {
    let resolve: (value: { status: string }) => void = () => undefined;
    state.decide = () => new Promise((done) => {
      resolve = done;
    });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    mount([row("w1", "wren", "Here.", "done", [pendingCard])]);
    await user.click(screen.getByRole("button", { name: /^Approve/u }));
    expect(screen.getByRole("button", { name: /^Approve/u }).getAttribute("aria-disabled")).toBe("true");
    expect(screen.getByText("Sending your decision…")).toBeTruthy();
    expect(await violations()).toEqual([]);
    await act(async () => {
      resolve({ status: "approved" });
      await Promise.resolve();
    });
  });

  test("card decided: status text, no buttons", async () => {
    mount([row("w1", "wren", "Done.", "done", [{ ...pendingCard, status: "approved" }])]);
    expect(screen.getByText("Status: Approved")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /^Approve/u })).toBeNull();
    expect(await violations()).toEqual([]);
  });
});

describe("one announcement per reply", () => {
  test("nothing is announced for what was on the page at load", () => {
    mount([row("f1", "founder", "Hi", "done"), row("w1", "wren", "Earlier reply", "done")]);
    expect(statusLine().textContent).toBe("");
  });

  test("started, deltas, finished: the status line changes twice, never per delta", () => {
    const view = mount([row("f1", "founder", "Hi", "done")]);
    const rerender = (thread: Thread) => {
      state.thread = thread;
      view.rerender(<main><WrenChatPanel projectId={projectId} /></main>);
    };
    const texts: string[] = [];
    const observer = new MutationObserver(() => texts.push(statusLine().textContent ?? ""));
    observer.observe(statusLine(), { childList: true, characterData: true, subtree: true });

    rerender([row("f1", "founder", "Hi", "done"), row("w1", "wren", "", "streaming")]);
    expect(statusLine().textContent).toBe("Wren is writing…");
    rerender([row("f1", "founder", "Hi", "done"), row("w1", "wren", "Sun", "streaming")]);
    rerender([row("f1", "founder", "Hi", "done"), row("w1", "wren", "Sunday works", "streaming")]);
    expect(statusLine().textContent).toBe("Wren is writing…");
    rerender([row("f1", "founder", "Hi", "done"), row("w1", "wren", "Sunday works.", "done", [pendingCard])]);
    expect(statusLine().textContent).toBe("Wren replied: Sunday works. 1 card from Wren is below the reply.");
    return Promise.resolve().then(() => {
      observer.disconnect();
      expect(texts.length).toBeLessThanOrEqual(2);
    });
  });

  test("a failed reply and a stopped reply are announced", () => {
    const view = mount([row("f1", "founder", "Hi", "done")]);
    state.thread = [row("f1", "founder", "Hi", "done"), row("w1", "wren", "x", "streaming")];
    view.rerender(<main><WrenChatPanel projectId={projectId} /></main>);
    act(() => {
      vi.advanceTimersByTime(WREN_STREAM_STALE_MS + 5);
    });
    expect(statusLine().textContent).toBe("Wren stopped partway through. You can try again.");
    state.thread = [row("f1", "founder", "Hi", "done"), row("w2", "wren", "", "failed")];
    view.rerender(<main><WrenChatPanel projectId={projectId} /></main>);
    expect(statusLine().textContent).toBe("Wren couldn't finish this reply. You can try again.");
  });

  test("a send outcome beats the reply announcement", async () => {
    state.send = async () => ({ kind: "busy" });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    mount([]);
    await user.type(composer(), "Hello");
    await user.keyboard("{Enter}");
    expect(statusLine().textContent).toContain("Wren is still answering");
  });
});

describe("keyboard run-through", () => {
  test("Tab order: card review link, Approve, Not now, the explain/navigate links, composer, Send", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    mount([
      row("f1", "founder", "Can I post?", "done"),
      row("w1", "wren", "Here.", "done", [pendingCard, { kind: "navigate", route: "brand" }]),
    ]);
    const order: string[] = [];
    for (let i = 0; i < 6; i += 1) {
      await user.tab();
      const active = document.activeElement;
      order.push(active?.tagName === "TEXTAREA" ? "composer" : (active?.textContent ?? "").split("·")[0].trim());
    }
    expect(order[0]).toMatch(/^Review it/u);
    expect(order[1]).toBe("Approve");
    expect(order[2]).toBe("Not now");
    expect(order[3]).toMatch(/brand/iu);
    expect(order[4]).toBe("composer");
    expect(screen.getByRole("button", { name: "Send message" })).toBe(document.activeElement);
  });

  test("Enter sends and keeps focus in the composer; Shift+Enter is a newline", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    mount([]);
    await user.click(composer());
    await user.type(composer(), "Line one{Shift>}{Enter}{/Shift}Line two");
    expect(composer().value).toBe("Line one\nLine two");
    expect(sent).toEqual([]);
    await user.keyboard("{Enter}");
    expect(sent).toEqual(["Line one\nLine two"]);
    await act(async () => {
      await Promise.resolve();
    });
    expect(composer().value).toBe("");
    expect(document.activeElement).toBe(composer());
  });

  test("pressing Send with the button returns focus to the composer", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    mount([]);
    await user.type(composer(), "Hi");
    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Send message" }));
    await user.keyboard("{Enter}");
    await act(async () => {
      await Promise.resolve();
    });
    expect(sent).toEqual(["Hi"]);
    expect(document.activeElement).toBe(composer());
  });

  test("Try again hands focus to the composer, not body, when the button leaves", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const view = mount([row("f1", "founder", "Hi", "done"), row("w1", "wren", "", "failed")]);
    await user.click(screen.getByRole("button", { name: /Try again/u }));
    state.thread = [row("f1", "founder", "Hi", "done"), row("w1", "wren", "", "streaming")];
    view.rerender(<main><WrenChatPanel projectId={projectId} /></main>);
    expect(screen.queryByRole("button", { name: /Try again/u })).toBeNull();
    expect(document.activeElement).toBe(composer());
  });

  test("a card decision by keyboard lands focus on the status line; rerendering never drops it on body", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const view = mount([row("w1", "wren", "Here.", "done", [pendingCard])]);
    await user.tab();
    await user.tab();
    await user.keyboard("{Enter}");
    const status = document.querySelector<HTMLElement>("[data-card-status]");
    expect(document.activeElement).toBe(status);
    state.thread = [row("w1", "wren", "Here.", "done", [{ ...pendingCard, status: "approved" }]), row("w2", "wren", "More", "streaming")];
    view.rerender(<main><WrenChatPanel projectId={projectId} /></main>);
    expect(document.activeElement).not.toBe(document.body);
    expect(document.activeElement).toBe(status);
  });

  test("there is no overlay: Escape does nothing and focus stays put", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    mount([]);
    await user.click(composer());
    await user.type(composer(), "draft{Escape}");
    expect(composer().value).toBe("draft");
    expect(document.activeElement).toBe(composer());
  });
});
