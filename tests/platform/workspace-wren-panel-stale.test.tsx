// @vitest-environment jsdom
/**
 * WP77 PR #210 review: a newest Wren row stuck in `streaming` must not lock the
 * chat. Past WREN_STREAM_STALE_MS it stops counting as replying, the composer
 * is usable and Try again shows (one timer flips it at the threshold).
 */
import { act, cleanup, render, screen } from "@testing-library/react";
import type { FunctionReturnType } from "convex/server";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import type { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { WREN_STREAM_STALE_MS } from "@/lib/workspace/wren";

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

function thread(updatedAt: number, body = ""): Thread {
  return [
    { _id: "f1" as Id<"chat_messages">, author: "founder", body: "Hi", status: "done", createdAt: updatedAt, updatedAt, cards: [] },
    { _id: "w1" as Id<"chat_messages">, author: "wren", body, status: "streaming", createdAt: updatedAt, updatedAt, cards: [] },
  ];
}

function sendButton(): HTMLElement {
  return screen.getByRole("button", { name: "Send message" });
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(Date.UTC(2026, 10, 6, 12, 0, 0)));
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("stale streaming reply", () => {
  test("already past the window: composer enabled, Try again shown, no aria-busy", () => {
    state.thread = thread(Date.now() - WREN_STREAM_STALE_MS - 1_000);
    const { container } = render(<WrenChatPanel projectId={projectId} />);
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(sendButton().getAttribute("aria-disabled")).toBeNull();
    expect(screen.getByRole("button", { name: /Try again/u })).toBeTruthy();
    expect(screen.getByText("Wren stopped partway through.")).toBeTruthy();
    expect(screen.queryByText("Wren is writing…")).toBeNull();
    expect(container.querySelector('[aria-busy="true"]')).toBeNull();
  });

  test("a fresh streaming reply still disables the composer", () => {
    state.thread = thread(Date.now() - 1_000);
    const { container } = render(<WrenChatPanel projectId={projectId} />);
    expect(sendButton().getAttribute("aria-disabled")).toBe("true");
    expect(screen.queryByRole("button", { name: /Try again/u })).toBeNull();
    expect(screen.getByText("Wren is writing…")).toBeTruthy();
    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull();
  });

  test("flips exactly when the window passes", () => {
    state.thread = thread(Date.now());
    render(<WrenChatPanel projectId={projectId} />);
    expect(sendButton().getAttribute("aria-disabled")).toBe("true");
    act(() => {
      vi.advanceTimersByTime(WREN_STREAM_STALE_MS - 1);
    });
    expect(sendButton().getAttribute("aria-disabled")).toBe("true");
    act(() => {
      vi.advanceTimersByTime(2);
    });
    expect(sendButton().getAttribute("aria-disabled")).toBeNull();
    expect(screen.getByRole("button", { name: /Try again/u })).toBeTruthy();
  });
});
