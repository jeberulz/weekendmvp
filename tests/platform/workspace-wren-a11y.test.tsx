// @vitest-environment jsdom
/**
 * WP77-S6 — accessibility of the Wren chat, driven through the real DOM
 * (Testing Library + user-event) and checked with axe-core (WCAG 2.1 A/AA):
 * - states: empty, streaming, stopped, done with cards, decision pending, decided;
 * - the thread's log is silent (`aria-live="off"`) and ONE sr-only polite region
 *   announces a reply once (started, finished, failed, stopped, capped), never per
 *   delta; send and retry notices have their own visible line;
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
import { approvalDecisionErrorCopy } from "@/lib/workspace/wrenCards";

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

/** The visible line for send and retry notices only. */
function noticeLine(): HTMLElement {
  const element = [...document.querySelectorAll<HTMLElement>('p[role="status"]')].find(
    (candidate) => !candidate.classList.contains("sr-only") && candidate.closest("[data-card-status]") === null,
  );
  if (element === undefined) throw new Error("notice line missing");
  return element;
}

/** The screen-reader-only region that announces Wren's replies. */
function announcer(): HTMLElement {
  const element = document.querySelector<HTMLElement>('p[role="status"].sr-only');
  if (element === null) throw new Error("announcer missing");
  return element;
}

/** What the announcer says, without the no-break space that makes repeated text re-announce. */
function said(): string {
  return (announcer().textContent ?? "").replaceAll("\u00A0", "");
}

function visibleText(): string {
  return [...document.querySelectorAll("[data-message], p[role='status']:not(.sr-only)")]
    .map((element) => element.textContent ?? "")
    .join(" | ");
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

  test("streaming: a silent log, no aria-busy, Send focusable but aria-disabled", async () => {
    mount([row("f1", "founder", "Hello", "done"), row("w1", "wren", "Sunday wor", "streaming")]);
    const log = screen.getByRole("log", { name: "Messages" });
    expect(log.getAttribute("aria-live")).toBe("off");
    expect(log.querySelector("[aria-busy]")).toBeNull();
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
    expect(document.querySelector("[aria-busy]")).toBeNull();
    expect(await violations()).toEqual([]);
  });

  test("done with cards: a labelled list of cards, no live region inside the log", async () => {
    mount([
      row("f1", "founder", "Can I post?", "done"),
      row("w1", "wren", "Here you go.", "done", [pendingCard, { kind: "explain", topic: "approvals" }, { kind: "navigate", route: "brand" }]),
    ]);
    const list = screen.getByRole("list", { name: "Cards from Wren" });
    const live = [...list.querySelectorAll("[aria-live], [role='status']")];
    expect(live.every((element) => element.closest("[data-card-status]") !== null)).toBe(true);
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
    expect(screen.getByText("Approved")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /^Approve/u })).toBeNull();
    expect(await violations()).toEqual([]);
  });
});

describe("one announcement per reply", () => {
  const rerenderWith = (view: ReturnType<typeof mount>, thread: Thread) => {
    state.thread = thread;
    view.rerender(<main><WrenChatPanel projectId={projectId} /></main>);
  };

  test("nothing is announced for what was on the page at load", () => {
    mount([row("f1", "founder", "Hi", "done"), row("w1", "wren", "Earlier reply", "done")]);
    expect(said()).toBe("");
  });

  test("started, deltas, finished: the region changes twice, never per delta; the reply text is not shown a second time", () => {
    const view = mount([row("f1", "founder", "Hi", "done")]);
    const seen: string[] = [];
    const step = (thread: Thread) => {
      rerenderWith(view, thread);
      const text = said() ?? "";
      if (seen.at(-1) !== text) seen.push(text);
    };
    step([row("f1", "founder", "Hi", "done"), row("w1", "wren", "", "streaming")]);
    step([row("f1", "founder", "Hi", "done"), row("w1", "wren", "Sun", "streaming")]);
    step([row("f1", "founder", "Hi", "done"), row("w1", "wren", "Sunday works", "streaming")]);
    step([row("f1", "founder", "Hi", "done"), row("w1", "wren", "Sunday works.", "done", [pendingCard])]);
    expect(seen).toEqual(["Wren is writing…", "Wren replied: Sunday works. 1 card from Wren is below the reply."]);
    // The announcement is sr-only: the visible text shows the reply once and no announcement line.
    expect(announcer().classList.contains("sr-only")).toBe(true);
    expect(noticeLine().textContent).toBe("");
    expect(visibleText().match(/Sunday works\./gu)?.length).toBe(1);
  });

  test("while streaming, 'Wren is writing…' is visible once (bubble) and also said once, with an empty notice line", () => {
    const view = mount([row("f1", "founder", "Hi", "done")]);
    rerenderWith(view, [row("f1", "founder", "Hi", "done"), row("w1", "wren", "", "streaming")]);
    expect(visibleText().match(/Wren is writing…/gu)?.length).toBe(1);
    expect(said()).toBe("Wren is writing…");
    expect(noticeLine().textContent).toBe("");
  });

  test("the same text twice in a row is still announced (the region's text changes)", () => {
    const view = mount([row("f1", "founder", "Hi", "done")]);
    rerenderWith(view, [row("f1", "founder", "Hi", "done"), row("w1", "wren", "Same.", "done")]);
    const first = announcer().textContent;
    rerenderWith(view, [row("f1", "founder", "Hi", "done"), row("w1", "wren", "Same.", "done"), row("f2", "founder", "Again", "done"), row("w2", "wren", "Same.", "done")]);
    const second = announcer().textContent;
    expect(said()).toBe("Wren replied: Same.");
    expect(second).not.toBe(first);
    rerenderWith(view, [row("f1", "founder", "Hi", "done"), row("w1", "wren", "Same.", "done"), row("f2", "founder", "Again", "done"), row("w2", "wren", "Same.", "done"), row("f3", "founder", "More", "done"), row("w3", "wren", "Same.", "done")]);
    expect(announcer().textContent).not.toBe(second);
  });

  test("a capped send shows the break card once, on screen once, and says it through the sr-only region", async () => {
    state.send = async () => ({ kind: "capped", resetsAt: NOW + 3_600_000 } as { kind: string });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    mount([]);
    await user.type(composer(), "Hello");
    await user.keyboard("{Enter}");
    await act(async () => {
      await Promise.resolve();
    });
    expect(document.querySelectorAll('[data-card="wren-tomorrow"]').length).toBe(1);
    expect(noticeLine().textContent).toBe("");
    expect(said()).toBe(document.querySelector('[data-card="wren-tomorrow"] p')?.textContent);
    expect((document.body.textContent ?? "").match(/Wren needs a break/gu)?.length).toBe(2); // the card title and the sr-only announcement
    expect(visibleText().includes("break")).toBe(false);
  });

  test("the announcement is cleared after it has been read", () => {
    const view = mount([row("f1", "founder", "Hi", "done")]);
    rerenderWith(view, [row("f1", "founder", "Hi", "done"), row("w1", "wren", "Hello.", "done")]);
    expect(said()).toContain("Wren replied");
    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    expect(said()).toBe("");
  });

  test("a failed reply and a stopped reply are announced", () => {
    const view = mount([row("f1", "founder", "Hi", "done")]);
    rerenderWith(view, [row("f1", "founder", "Hi", "done"), row("w1", "wren", "x", "streaming")]);
    act(() => {
      vi.advanceTimersByTime(WREN_STREAM_STALE_MS + 5);
    });
    expect(said()).toBe("Wren stopped partway through. You can try again.");
    rerenderWith(view, [row("f1", "founder", "Hi", "done"), row("w2", "wren", "", "failed")]);
    expect(said()).toBe("Wren couldn't finish this reply. You can try again.");
  });

  test("a send notice stays on its own line and never hides a later reply announcement; the new reply clears it", async () => {
    state.send = async () => ({ kind: "busy" });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const view = mount([]);
    await user.type(composer(), "Hello");
    await user.keyboard("{Enter}");
    expect(noticeLine().textContent).toContain("Wren is still answering");
    expect(said()).toBe("");
    rerenderWith(view, [row("f1", "founder", "Hello", "done"), row("w1", "wren", "Hi there.", "done")]);
    expect(said()).toBe("Wren replied: Hi there.");
    expect(noticeLine().textContent).toBe("");
  });

  test("a retry notice does not hide the next announcement either", async () => {
    state.retry = async () => ({ kind: "busy" });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const view = mount([row("f1", "founder", "Hi", "done"), row("w1", "wren", "", "failed")]);
    await user.click(screen.getByRole("button", { name: /Try again/u }));
    await act(async () => {
      await Promise.resolve();
    });
    expect(noticeLine().textContent).toContain("still answering");
    rerenderWith(view, [row("f1", "founder", "Hi", "done"), row("w1", "wren", "Now answered.", "done")]);
    expect(said()).toBe("Wren replied: Now answered.");
  });

  test("a long reply is cut by code point, never through a surrogate pair", () => {
    const view = mount([row("f1", "founder", "Hi", "done")]);
    const body = "\u{1F600}".repeat(700);
    rerenderWith(view, [row("f1", "founder", "Hi", "done"), row("w1", "wren", body, "done")]);
    const text = said() ?? "";
    expect(text).toContain("Read the rest in the thread.");
    expect(text).not.toMatch(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u);
    expect(Array.from(text.replace("Wren replied: ", "").split("…")[0]).length).toBe(600);
  });

  test("the card count matches the cards shown (unknown keys are not counted)", () => {
    const view = mount([row("f1", "founder", "Hi", "done")]);
    const cards: Row["cards"] = [
      { kind: "explain", topic: "approvals" },
      { kind: "navigate", route: "https://evil.example/login" },
      { kind: "explain", topic: "<b>nope</b>" },
    ];
    rerenderWith(view, [row("f1", "founder", "Hi", "done"), row("w1", "wren", "Look.", "done", cards)]);
    expect(said()).toBe("Wren replied: Look. 1 card from Wren is below the reply.");
    expect(document.querySelectorAll('[aria-label="Cards from Wren"] > li').length).toBe(1);
  });

  test("Try again does nothing while a send is in flight (aria-disabled)", async () => {
    let release: (value: { kind: string }) => void = () => undefined;
    state.send = () => new Promise((done) => {
      release = done;
    });
    let retried = 0;
    state.retry = async () => {
      retried += 1;
      return { kind: "started" };
    };
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    mount([row("f1", "founder", "Hi", "done"), row("w1", "wren", "", "failed")]);
    await user.type(composer(), "Again");
    await user.keyboard("{Enter}");
    const tryAgain = screen.getByRole("button", { name: /Try again/u });
    await user.click(tryAgain);
    expect(retried).toBe(0);
    // Without the guard, retry() would have moved focus to the composer.
    expect(document.activeElement).toBe(tryAgain);
    await act(async () => {
      release({ kind: "sent" });
      await Promise.resolve();
    });
  });
});

/** Lets the decision promise and its React update settle under fake timers, then checks. */
async function settle(check: () => void): Promise<void> {
  for (let i = 0; i < 20; i += 1) {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });
    try {
      check();
      return;
    } catch {
      // not settled yet
    }
  }
  check();
}

describe("card decision outcomes are announced", () => {
  test("approve, then an error: each outcome lands in the card's live region", async () => {
    const second: Row["cards"][number] = { ...pendingCard, approvalId: "a2" as Id<"approvals">, title: "Post the second one" };
    const outcomes = [async () => ({ status: "approved" }), async () => Promise.reject(new Error("boom"))];
    let call = 0;
    state.decide = () => outcomes[call++ % 2]();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    mount([row("w1", "wren", "Two cards.", "done", [pendingCard, second])]);
    const regions = () => [...document.querySelectorAll<HTMLElement>("[data-card-status] [role='status']")];
    expect(regions().length).toBe(2);
    expect(regions().every((region) => region.getAttribute("aria-live") === "polite")).toBe(true);
    const [firstRegion, secondRegion] = regions();
    await user.click(screen.getAllByRole("button", { name: /^Approve/u })[0]);
    await settle(() => expect(firstRegion.textContent).toContain("Approved."));
    await user.click(screen.getAllByRole("button", { name: /^Approve/u })[1]);
    await settle(() => expect(secondRegion.textContent).toBe(approvalDecisionErrorCopy(null)));
    expect(firstRegion.textContent).toContain("Approved.");
    // The same region elements stayed mounted: text changed inside a live region.
    expect(regions()[0]).toBe(firstRegion);
    expect(regions()[1]).toBe(secondRegion);
  });
});

describe("keyboard run-through", () => {
  test("Tab order: the From line's employee link, Review, Approve, Not now, the explain/navigate links, composer, Send", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    mount([
      row("f1", "founder", "Can I post?", "done"),
      row("w1", "wren", "Here.", "done", [pendingCard, { kind: "navigate", route: "brand" }]),
    ]);
    const order: string[] = [];
    for (let i = 0; i < 7; i += 1) {
      await user.tab();
      const active = document.activeElement;
      order.push(active?.tagName === "TEXTAREA" ? "composer" : (active?.textContent ?? "").split("·")[0].trim());
    }
    // WP67: the From line is one link to the specialist's page.
    expect(order[0]).toBe("From Social");
    expect(order[1]).toBe("Review");
    expect(order[2]).toBe("Approve");
    expect(order[3]).toBe("Not now");
    expect(order[4]).toMatch(/brand/iu);
    expect(order[5]).toBe("composer");
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

  test("focus the founder moved elsewhere is not taken back after a send settles", async () => {
    let release: (value: { kind: string }) => void = () => undefined;
    state.send = () => new Promise((done) => {
      release = done;
    });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    mount([row("w1", "wren", "Here.", "done", [{ kind: "navigate", route: "brand" }])]);
    await user.type(composer(), "Hi");
    await user.keyboard("{Enter}");
    const link = screen.getByRole("link", { name: /brand/iu });
    link.focus();
    await act(async () => {
      release({ kind: "sent" });
      await Promise.resolve();
    });
    expect(document.activeElement).toBe(link);
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
    // WP67: the From line's employee link, Review, then Approve.
    await user.tab();
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
