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
  _id: id as Id<"chat_messages">, author, body, status, createdAt: Date.UTC(2026, 10, 6, 12, 0, 0), cards: [],
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

  test("WP77-S4 cards: approval, explain and navigate render accessibly from server keys only", async () => {
    const reply: Thread[number] = {
      ...row("w2", "wren", "Here is your publish card.", "done"),
      cards: [
        {
          kind: "approval", approvalId: "a1" as Id<"approvals">, approvalKind: "publish", status: "pending",
          title: "Publish this landing page version", subject: "Landing page version 3", reviewRoute: "launch",
        },
        { kind: "explain", topic: "approvals" },
        { kind: "navigate", route: "brand" },
        { kind: "navigate", route: "https://evil.example/login" },
        { kind: "explain", topic: "<img src=x onerror=alert(1)>" },
      ],
    };
    const markup = render([row("f2", "founder", "Can I publish?", "done"), reply]);
    expect(markup).toContain('aria-label="Cards from Wren"');
    expect(markup).toContain("Publish this landing page version");
    expect(markup).toContain("Status: Waiting for you");
    expect(markup).toContain("Landing page version 3");
    expect(markup).toContain(
      "Approve<span class=\"sr-only\"> · Publish this landing page version, Landing page version 3</span>",
    );
    expect(markup).toContain('href="/dashboard/b/p1/launch"');
    expect(markup).toContain("Review it on the launch page");
    expect(markup).toContain('tabindex="-1"');
    // No live region nested in the thread's role="log".
    expect(document.querySelector('[aria-label="Cards from Wren"] [aria-live], [aria-label="Cards from Wren"] [role="status"]'))
      .toBeNull();
    expect(markup).toContain("Not now");
    expect(markup).toContain("How approval cards work");
    expect(markup).toContain('href="/dashboard/b/p1/brand"');
    expect(markup).toContain("Open the brand kit");
    expect(markup).not.toContain("evil.example");
    expect(markup).not.toContain("onerror");
    expect(await violations()).toEqual([]);
  });

  test("WP77-S4 cards: a decided approval card shows its status without buttons; streaming replies show no cards", async () => {
    const decided: Thread[number] = {
      ...row("w3", "wren", "Done.", "done"),
      cards: [{
        kind: "approval", approvalId: "a2" as Id<"approvals">, approvalKind: "post", status: "approved", title: "Post this social post",
        subject: "Social post: <b>Launch day</b> is here", reviewRoute: "social",
      }],
    };
    const streaming: Thread[number] = {
      ...row("w4", "wren", "Writing", "streaming"),
      cards: [{ kind: "explain", topic: "credits" }],
    };
    const markup = render([row("f3", "founder", "Post it", "done"), decided, row("f4", "founder", "And?", "done"), streaming]);
    expect(markup).toContain("Status: Approved");
    expect(markup).not.toContain(">Approve<");
    // Founder text in the subject line is a text node, never markup.
    expect(markup).toContain("Social post: &lt;b&gt;Launch day&lt;/b&gt; is here");
    expect(markup).not.toContain("<b>Launch day</b>");
    expect(markup).not.toContain("Credits");
    expect(await violations()).toEqual([]);
  });
});
