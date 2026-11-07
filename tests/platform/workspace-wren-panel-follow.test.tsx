// @vitest-environment jsdom
/**
 * L1 chat column: below xl the panel sits in a `display: none` drawer until it opens. When the message box gains a
 * size, it catches up to the newest message, unless the founder had scrolled back (PR #267 review).
 */
import { cleanup, fireEvent, render } from "@testing-library/react";
import type { FunctionReturnType } from "convex/server";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import type { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

type Thread = FunctionReturnType<typeof api.workspace.chat.listWrenThread>;

const state: { thread: Thread | undefined } = { thread: undefined };

vi.mock("convex/react", () => ({
  useQuery: () => state.thread,
  useMutation: () => vi.fn(),
}));
vi.mock("@/components/platform/client-gates", () => ({
  WhenConvexReady: ({ children }: { children: ReactNode }) => children,
  QuietErrorBoundary: ({ children }: { children: ReactNode }) => children,
}));

const { WrenChatPanel } = await import("@/components/workspace/chat/WrenChatPanel");

const projectId = "p1" as Id<"projects">;
const row = (id: string, author: "founder" | "wren", body: string): Thread[number] => ({
  _id: id as Id<"chat_messages">, author, body, status: "done", createdAt: Date.UTC(2026, 10, 6, 12, 0, 0), updatedAt: Date.now(), cards: [],
});

/** Captures the observer so a test can say "the box just got a size". */
let resize: (() => void) | null = null;
class FakeResizeObserver {
  constructor(callback: () => void) {
    resize = callback;
  }
  observe() {}
  disconnect() {
    resize = null;
  }
}

/** jsdom has no layout: give the scroll box a geometry. */
function setGeometry(box: HTMLElement, geometry: { clientHeight: number; scrollHeight: number }) {
  Object.defineProperty(box, "clientHeight", { configurable: true, value: geometry.clientHeight });
  Object.defineProperty(box, "scrollHeight", { configurable: true, value: geometry.scrollHeight });
}

function scrollBox(container: HTMLElement): HTMLElement {
  const box = container.querySelector<HTMLElement>(".overflow-y-auto");
  if (box === null) throw new Error("no scroll box");
  return box;
}

beforeEach(() => {
  vi.stubGlobal("ResizeObserver", FakeResizeObserver);
  state.thread = [row("f1", "founder", "Hi"), row("w1", "wren", "Hello"), row("f2", "founder", "Status?"), row("w2", "wren", "Two reviews wait.")];
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  resize = null;
});

describe("WrenChatPanel follows the newest message when it becomes visible", () => {
  test("a hidden box that gains a size scrolls to the bottom", () => {
    const { container } = render(<WrenChatPanel projectId={projectId} />);
    const box = scrollBox(container);
    setGeometry(box, { clientHeight: 400, scrollHeight: 1200 });
    box.scrollTop = 0;
    expect(resize).not.toBeNull();
    resize?.();
    expect(box.scrollTop).toBe(1200);
  });

  test("still hidden (no height): nothing moves", () => {
    const { container } = render(<WrenChatPanel projectId={projectId} />);
    const box = scrollBox(container);
    setGeometry(box, { clientHeight: 0, scrollHeight: 0 });
    box.scrollTop = 0;
    resize?.();
    expect(box.scrollTop).toBe(0);
  });

  test("a founder who scrolled back keeps their place", () => {
    const { container } = render(<WrenChatPanel projectId={projectId} />);
    const box = scrollBox(container);
    setGeometry(box, { clientHeight: 400, scrollHeight: 1200 });
    box.scrollTop = 100;
    fireEvent.scroll(box);
    resize?.();
    expect(box.scrollTop).toBe(100);
  });
});
