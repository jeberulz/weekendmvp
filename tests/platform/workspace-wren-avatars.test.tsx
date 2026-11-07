// @vitest-environment jsdom
/**
 * L1 beta: avatars in the Wren chat. Wren's generated crew-lead portrait
 * (WP67-S7) on the column header and on each of Wren's messages; the
 * founder's initial beside each of their messages. Both are decorative: the
 * name is written next to Wren's, and each founder message reads "You:".
 */
import { cleanup, render } from "@testing-library/react";
import axe from "axe-core";
import { getFunctionName } from "convex/server";
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, test, vi } from "vitest";

import type { Id } from "@/convex/_generated/dataModel";
import { CREW_AVATAR_SRC } from "@/lib/workspace/crew-avatars";

const NOW = Date.UTC(2026, 10, 6, 12, 0, 0);
const thread = [
  {
    _id: "m1" as Id<"chat_messages">, author: "founder", body: "What needs my approval right now?", status: "done",
    createdAt: NOW, updatedAt: NOW, cards: [],
  },
  {
    _id: "m2" as Id<"chat_messages">, author: "wren", body: "Here is what is waiting on you.", status: "done",
    createdAt: NOW, updatedAt: NOW, cards: [],
  },
];

vi.mock("convex/react", () => ({
  useQuery: (ref: Parameters<typeof getFunctionName>[0]) => {
    const name = getFunctionName(ref);
    if (name.endsWith("listWrenThread")) return thread;
    if (name.endsWith("launchStatus")) return { state: "ready", hired: new Array<unknown>(8).fill({}) };
    return undefined;
  },
  useMutation: () => async () => ({ kind: "sent" }),
}));
vi.mock("@/components/platform/client-gates", () => ({
  WhenConvexReady: ({ children }: { children: ReactNode }) => children,
  QuietErrorBoundary: ({ children }: { children: ReactNode }) => children,
}));

const { WrenChatColumn } = await import("@/components/workspace/chat/WrenChatColumn");
const { FounderAvatar, UserMessage, founderInitial } = await import("@/components/workspace/kit/WrenThread");
const { WrenMessage } = await import("@/components/workspace/kit/WrenCards");

afterEach(cleanup);

const WREN_SRC = CREW_AVATAR_SRC.lead;

describe("Wren and founder avatars in the chat", () => {
  test("the crew lead's portrait is shipped", () => {
    expect(WREN_SRC).toBe("/image/crew/lead-wren.webp");
  });

  test("Wren's message shows the portrait, hidden from assistive tech, beside the written name", () => {
    const markup = renderToStaticMarkup(<WrenMessage time="9:02 AM" name="Wren">Hi</WrenMessage>);
    expect(markup).toContain(`src="${WREN_SRC ?? ""}"`);
    expect(markup).toMatch(/<span aria-hidden="true"[^>]*><span role="img"/u);
    expect(markup).toContain(">Wren</span>");
  });

  test("a renamed co-founder keeps the lead's portrait", () => {
    const markup = renderToStaticMarkup(<WrenMessage time="9:02 AM" name="Robin">Hi</WrenMessage>);
    expect(markup).toContain(`src="${WREN_SRC ?? ""}"`);
    expect(markup).toContain(">Robin</span>");
  });

  test("the founder's message shows their initial, or a person icon without a name", () => {
    expect(founderInitial("john iseghohi")).toBe("J");
    expect(founderInitial("  ")).toBeNull();
    expect(founderInitial(undefined)).toBeNull();
    const named = renderToStaticMarkup(<UserMessage founderName="john">Hello</UserMessage>);
    expect(named).toMatch(/data-avatar="founder"[^>]*>J<\/span>/u);
    expect(named).toContain('<span class="sr-only">You: </span>');
    const unnamed = renderToStaticMarkup(<FounderAvatar />);
    expect(unnamed).toContain("<svg");
    expect(unnamed).toContain('aria-hidden="true"');
  });

  test("the column: header portrait, both avatars in the thread, and no axe violations", async () => {
    const { container } = render(<WrenChatColumn projectId={"p1" as Id<"projects">} name="Wren" founderName="John" />);
    const portraits = container.querySelectorAll(`img[src="${WREN_SRC ?? ""}"]`);
    // The header and the one Wren message.
    expect(portraits).toHaveLength(2);
    for (const img of portraits) expect(img.closest('[aria-hidden="true"]')).not.toBeNull();
    const founder = container.querySelector('[data-avatar="founder"]');
    expect(founder?.textContent).toBe("J");
    expect(founder?.getAttribute("aria-hidden")).toBe("true");
    // jsdom has no layout or canvas: contrast is checked in the browser instead.
    const results = await axe.run(container, { rules: { region: { enabled: false }, "color-contrast": { enabled: false } } });
    expect(results.violations.map((violation) => violation.id)).toEqual([]);
  });
});
