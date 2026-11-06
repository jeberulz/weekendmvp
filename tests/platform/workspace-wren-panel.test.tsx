// @vitest-environment jsdom
/**
 * WP77-S3 — the minimal Wren chat panel: rendered markup with a mocked
 * thread, checked for its accessible structure and run through axe-core
 * (WCAG 2.1 A/AA). Full a11y polish is S6; this keeps the panel from
 * regressing axe.
 */
import axe from "axe-core";
import type { FunctionReturnType } from "convex/server";
import { renderToStaticMarkup } from "react-dom/server";
import type { ReactNode } from "react";
import { afterEach, describe, expect, test, vi } from "vitest";

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
const row = (id: string, author: "founder" | "wren", body: string, status: Thread[number]["status"]): Thread[number] => ({
  _id: id as Id<"chat_messages">, author, body, status, createdAt: Date.UTC(2026, 10, 6, 12, 0, 0),
});

function render(thread: Thread | undefined): string {
  state.thread = thread;
  const markup = renderToStaticMarkup(<WrenChatPanel projectId={projectId} />);
  document.body.innerHTML = `<main>${markup}</main>`;
  return markup;
}

async function violations() {
  const results = await axe.run(document.body, {
    runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] },
    resultTypes: ["violations"],
    rules: { "color-contrast": { enabled: false } }, // jsdom has no layout or computed colours
  });
  return results.violations.map((violation) => violation.id);
}

afterEach(() => {
  document.body.innerHTML = "";
});

describe("WrenChatPanel", () => {
  test("loading: a status, no log", async () => {
    const markup = render(undefined);
    expect(markup).toContain('role="status"');
    expect(markup).not.toContain('role="log"');
    expect(await violations()).toEqual([]);
  });

  test("empty: the empty state and a labelled composer", async () => {
    const markup = render([]);
    expect(markup).toContain("Ask Wren anything about your launch");
    expect(markup).toContain("Message Wren");
    expect(await violations()).toEqual([]);
  });

  test("streaming: the log holds the thread and the reply being written is aria-busy", async () => {
    const markup = render([
      row("f1", "founder", "Move the launch email to Sunday?", "done"),
      row("w1", "wren", "Sunday works", "streaming"),
    ]);
    expect(markup).toContain('role="log"');
    expect(markup).toContain('aria-busy="true"');
    expect(markup).toContain("Sunday works");
    // The composer's Send waits for the reply (focusable, aria-disabled).
    expect(markup).toMatch(/aria-label="Send message" aria-disabled="true"/);
    expect(await violations()).toEqual([]);
  });

  test("failed: the honest line and a Try again button on the last reply", async () => {
    const markup = render([
      row("f1", "founder", "Hello", "done"),
      row("w1", "wren", "Wren couldn't finish this reply. You can try again.", "failed"),
    ]);
    expect(markup).toContain("Wren couldn&#x27;t finish this reply.");
    expect(markup).toContain("Try again");
    expect(markup).not.toContain('aria-busy="true"');
    expect(await violations()).toEqual([]);
  });
});
