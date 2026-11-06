// @vitest-environment jsdom
/**
 * WP77-S5 — "What Wren knows" on the Files page, driven through the real DOM
 * (Testing Library + user-event) and run through axe-core (WCAG 2.1 A/AA):
 * - keyboard edit: the form opens with focus in a labelled field, Escape
 *   cancels and focus returns to that Edit button, Save returns it too;
 * - a refused edit keeps the form open with the reason tied to the field;
 * - delete asks first with focus on "Keep it", Escape keeps, confirming
 *   moves focus to the next fact's Edit button (never `<body>`);
 * - a stale edit reports calmly in the status line;
 * - an open edit or delete question closes when another tab moves the list,
 *   instead of reappearing under another fact; focus goes to the heading;
 * - one status line in every state, so the last delete is announced;
 * - the character count matches the server's cleaner;
 * - loading, empty (with "Write a summary") and error states.
 */
import axe from "axe-core";
import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState, type ReactNode } from "react";
import { afterEach, describe, expect, test, vi } from "vitest";

import type { Id } from "@/convex/_generated/dataModel";
import type { MemoryEditResult, WrenMemoryView as View } from "@/convex/workspace/memory";
import { deleteFact, editFact, editSummary, WREN_MEMORY_STALE_COPY, type FounderMemoryEdit } from "@/lib/workspace/wrenMemory";

const live: { memory: View | undefined } = { memory: undefined };
const gates: { mode: "ready" | "unavailable" } = { mode: "ready" };

vi.mock("convex/react", () => ({
  useQuery: () => live.memory,
  useMutation: () => vi.fn(),
}));
vi.mock("@/components/platform/client-gates", () => ({
  WhenConvexReady: ({ children, unavailable }: { children: ReactNode; unavailable: ReactNode }) =>
    gates.mode === "ready" ? children : unavailable,
  QuietErrorBoundary: ({ children }: { children: ReactNode }) => children,
}));

const { WrenMemoryPanel, WrenMemoryView } = await import("@/components/workspace/files/WrenMemoryPanel");

const LIMITS = { factsMax: 20, factMaxChars: 200, summaryMaxChars: 600 };

function view(facts: string[], summary = "Hikers app, launching Sunday."): View {
  return { facts, summary, updatedAt: 1, limits: LIMITS };
}

function outcome(result: FounderMemoryEdit): MemoryEditResult {
  return result.kind === "refused" ? { kind: "refused", code: result.code } : { kind: result.kind };
}

/**
 * The view with a stand-in server: actions apply the same pure rules as
 * `convex/workspace/wrenMemory.ts` and update the "live query" state.
 */
function Harness({ initial, onChange, remote }: {
  initial: View;
  onChange?: (next: View) => void;
  /** Receives a setter that changes the "live query" as another tab or Wren would. */
  remote?: (set: (next: View) => void) => void;
}) {
  const [memory, setMemory] = useState(initial);
  remote?.(setMemory);
  const apply = (result: FounderMemoryEdit) => {
    if (result.kind === "saved") {
      const next = { ...memory, facts: [...result.next.facts], summary: result.next.summary };
      setMemory(next);
      onChange?.(next);
    }
    return outcome(result);
  };
  return (
    <WrenMemoryView
      memory={memory}
      actions={{
        editFact: async (index, expected, text) => apply(editFact(memory, index, expected, text)),
        deleteFact: async (index, expected) => apply(deleteFact(memory, index, expected)),
        editSummary: async (expected, text) => apply(editSummary(memory, expected, text)),
      }}
    />
  );
}

async function violations() {
  const results = await axe.run(document.body, {
    runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] },
    resultTypes: ["violations"],
    rules: { "color-contrast": { enabled: false } }, // jsdom has no layout or computed colours
  });
  return results.violations.map((violation) => `${violation.id}: ${violation.nodes.map((n) => n.html).join(" | ")}`);
}

function status(): HTMLElement {
  return screen.getByRole("status", { name: "" });
}

afterEach(() => {
  cleanup();
  live.memory = undefined;
  gates.mode = "ready";
});

describe("What Wren knows: keyboard edit", () => {
  test("Edit opens a labelled field with focus; Escape cancels and focus returns to Edit", async () => {
    const user = userEvent.setup();
    render(<main><Harness initial={view(["Launch is Sunday.", "Price is $9 a month."])} /></main>);
    const edit2 = screen.getByRole("button", { name: "Edit fact 2" });
    edit2.focus();
    await user.keyboard("{Enter}");
    const field = screen.getByRole("textbox", { name: "Edit fact 2" });
    expect(document.activeElement).toBe(field);
    expect(field).toHaveProperty("value", "Price is $9 a month.");
    expect(field.getAttribute("aria-describedby")).toBeTruthy();
    expect(document.getElementById(field.getAttribute("aria-describedby") ?? "")?.textContent)
      .toContain("20 of 200 characters.");
    expect(await violations()).toEqual([]);
    await user.type(field, " Edited");
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Edit fact 2" }));
    expect(screen.getByText("Price is $9 a month.")).toBeTruthy();
  });

  test("Save writes the fact, announces it, and returns focus to that Edit button", async () => {
    const user = userEvent.setup();
    const changes: View[] = [];
    render(<main><Harness initial={view(["Launch is Sunday.", "Price is $9 a month."])} onChange={(next) => changes.push(next)} /></main>);
    await user.click(screen.getByRole("button", { name: "Edit fact 1" }));
    const field = screen.getByRole("textbox", { name: "Edit fact 1" });
    await user.clear(field);
    await user.type(field, "Launch moved to Saturday.");
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(changes.at(-1)?.facts).toEqual(["Launch moved to Saturday.", "Price is $9 a month."]);
    expect(screen.getByText("Launch moved to Saturday.")).toBeTruthy();
    expect(status().textContent).toBe("Fact saved.");
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Edit fact 1" }));
  });

  test("a refused edit keeps the form open with the reason tied to the field, focus on the field", async () => {
    const user = userEvent.setup();
    render(<main><Harness initial={view(["Launch is Sunday."])} /></main>);
    await user.click(screen.getByRole("button", { name: "Edit fact 1" }));
    const field = screen.getByRole("textbox", { name: "Edit fact 1" });
    await user.clear(field);
    await user.type(field, "See https://evil.example/login");
    await user.keyboard("{Tab}{Enter}");
    const alert = screen.getByRole("alert");
    expect(field.getAttribute("aria-invalid")).toBe("true");
    expect(field.getAttribute("aria-describedby")).toContain(alert.id);
    expect(document.activeElement).toBe(field);
    expect(await violations()).toEqual([]);
  });

  test("the summary: edit, then clear by saving it empty", async () => {
    const user = userEvent.setup();
    render(<main><Harness initial={view(["Launch is Sunday."])} /></main>);
    await user.click(screen.getByRole("button", { name: "Edit summary" }));
    const field = screen.getByRole("textbox", { name: "Edit Wren's summary" });
    await user.clear(field);
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(status().textContent).toBe("Summary cleared.");
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Write a summary" }));
  });

  test("a stale edit closes the form, reports calmly and moves focus to the Facts heading", async () => {
    const user = userEvent.setup();
    const stale = async (): Promise<MemoryEditResult> => ({ kind: "stale" });
    render(<main><WrenMemoryView memory={view(["Launch is Sunday."])} actions={{ editFact: stale, deleteFact: stale, editSummary: stale }} /></main>);
    await user.click(screen.getByRole("button", { name: "Edit fact 1" }));
    await user.type(screen.getByRole("textbox", { name: "Edit fact 1" }), " Really.");
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(status().textContent).toBe(WREN_MEMORY_STALE_COPY);
    expect(document.activeElement).toBe(screen.getByRole("heading", { name: /Facts/u }));
  });

  test("a failed mutation says nothing changed and keeps the form open", async () => {
    const user = userEvent.setup();
    const fail = async (): Promise<MemoryEditResult> => {
      throw new Error("network");
    };
    render(<main><WrenMemoryView memory={view(["Launch is Sunday."])} actions={{ editFact: fail, deleteFact: fail, editSummary: fail }} /></main>);
    await user.click(screen.getByRole("button", { name: "Edit fact 1" }));
    await user.type(screen.getByRole("textbox", { name: "Edit fact 1" }), " Really.");
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(status().textContent).toContain("Nothing was changed");
    expect(screen.getByRole("textbox", { name: "Edit fact 1" })).toBeTruthy();
  });
});

describe("What Wren knows: delete", () => {
  test("Delete asks first with focus on Keep it; Escape keeps and focus returns to Delete", async () => {
    const user = userEvent.setup();
    render(<main><Harness initial={view(["Launch is Sunday.", "Price is $9 a month."])} /></main>);
    await user.click(screen.getByRole("button", { name: "Delete fact 1" }));
    const group = screen.getByRole("group", { name: "Delete fact 1? Wren will forget it." });
    expect(group).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Keep it" }));
    expect(await violations()).toEqual([]);
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("group")).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Delete fact 1" }));
    expect(screen.getByText("Launch is Sunday.")).toBeTruthy();
  });

  test("confirming deletes the fact and moves focus to the next fact's Edit button", async () => {
    const user = userEvent.setup();
    render(<main><Harness initial={view(["Launch is Sunday.", "Price is $9 a month.", "Audience is day hikers."])} /></main>);
    await user.click(screen.getByRole("button", { name: "Delete fact 2" }));
    await user.click(screen.getByRole("button", { name: "Delete fact" }));
    expect(screen.queryByText("Price is $9 a month.")).toBeNull();
    expect(status().textContent).toBe("Fact deleted. Wren will no longer use it.");
    // The fact that was third is now second; focus is on its Edit button.
    const focused = document.activeElement;
    expect(focused).toBe(screen.getByRole("button", { name: "Edit fact 2" }));
    expect(focused?.closest("li")?.textContent).toContain("Audience is day hikers.");
  });

  test("deleting the last fact moves focus to the previous one, and the only fact to the Facts heading", async () => {
    const user = userEvent.setup();
    render(<main><Harness initial={view(["Launch is Sunday.", "Price is $9 a month."])} /></main>);
    await user.click(screen.getByRole("button", { name: "Delete fact 2" }));
    await user.click(screen.getByRole("button", { name: "Delete fact" }));
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Edit fact 1" }));
    await user.click(screen.getByRole("button", { name: "Delete fact 1" }));
    await act(async () => {
      await user.click(screen.getByRole("button", { name: "Delete fact" }));
    });
    expect(document.activeElement).toBe(screen.getByRole("heading", { name: /Facts/u }));
    expect(document.activeElement).not.toBe(document.body);
  });
});

describe("What Wren knows: states", () => {
  test("loading: a status, no list", async () => {
    live.memory = undefined;
    render(<main><WrenMemoryPanel projectId={"p1" as Id<"projects">} /></main>);
    expect(screen.getByRole("heading", { level: 2, name: "What Wren knows" })).toBeTruthy();
    expect(screen.getByText("Loading what Wren knows…")).toBeTruthy();
    expect(screen.queryByRole("list")).toBeNull();
    expect(await violations()).toEqual([]);
  });

  test("empty: the empty state explains what will appear", async () => {
    live.memory = view([], "");
    render(<main><WrenMemoryPanel projectId={"p1" as Id<"projects">} /></main>);
    expect(screen.getByText("Wren hasn't noted anything yet")).toBeTruthy();
    expect(await violations()).toEqual([]);
  });

  test("loaded: facts render as plain text, never markup", async () => {
    live.memory = view(["<img src=x onerror=alert(1)> is a fact"], "Summary <b>bold</b>");
    render(<main><WrenMemoryPanel projectId={"p1" as Id<"projects">} /></main>);
    expect(document.querySelector("img")).toBeNull();
    expect(document.querySelector("b")).toBeNull();
    expect(screen.getByText("<img src=x onerror=alert(1)> is a fact")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Facts (1 of 20)" })).toBeTruthy();
    expect(await violations()).toEqual([]);
  });

  test("a full list says so", () => {
    live.memory = view(Array.from({ length: 20 }, (_, index) => `Fact ${(index + 1).toString()}.`));
    render(<main><WrenMemoryPanel projectId={"p1" as Id<"projects">} /></main>);
    expect(screen.getByText(/notes are full/u)).toBeTruthy();
  });

  test("unavailable: the error state", async () => {
    gates.mode = "unavailable";
    render(<main><WrenMemoryPanel projectId={"p1" as Id<"projects">} /></main>);
    expect(screen.getByText(/couldn't load right now/u)).toBeTruthy();
    expect(await violations()).toEqual([]);
  });
});

describe("What Wren knows: review fixes", () => {
  test("an open edit closes when another tab deletes that fact; it never reopens under the next fact", async () => {
    const user = userEvent.setup();
    let setRemote: (next: View) => void = () => undefined;
    render(<main><Harness initial={view(["Launch is Sunday.", "Price is $9 a month."])} remote={(set) => { setRemote = set; }} /></main>);
    await user.click(screen.getByRole("button", { name: "Edit fact 1" }));
    expect(document.activeElement).toBe(screen.getByRole("textbox", { name: "Edit fact 1" }));
    act(() => setRemote(view(["Price is $9 a month."])));
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.getByText("Price is $9 a month.")).toBeTruthy();
    expect(status().textContent).toBe(WREN_MEMORY_STALE_COPY);
    expect(document.activeElement).toBe(screen.getByRole("heading", { name: /Facts/u }));
    expect(await violations()).toEqual([]);
  });

  test("an open delete question closes when the list moves under it", async () => {
    const user = userEvent.setup();
    let setRemote: (next: View) => void = () => undefined;
    render(<main><Harness initial={view(["Launch is Sunday.", "Price is $9 a month."])} remote={(set) => { setRemote = set; }} /></main>);
    await user.click(screen.getByRole("button", { name: "Delete fact 1" }));
    expect(screen.getByRole("group")).toBeTruthy();
    act(() => setRemote(view(["Audience is day hikers.", "Price is $9 a month."])));
    expect(screen.queryByRole("group")).toBeNull();
    expect(status().textContent).toBe(WREN_MEMORY_STALE_COPY);
    expect(document.activeElement).toBe(screen.getByRole("heading", { name: /Facts/u }));
  });

  test("one status line in every state: deleting the last fact (no summary) is announced in the empty state", async () => {
    const user = userEvent.setup();
    render(<main><Harness initial={view(["Launch is Sunday."], "")} /></main>);
    const line = status();
    await user.click(screen.getByRole("button", { name: "Delete fact 1" }));
    await user.click(screen.getByRole("button", { name: "Delete fact" }));
    expect(screen.getByText("Wren hasn't noted anything yet")).toBeTruthy();
    // The same live region element, now holding the outcome.
    expect(status()).toBe(line);
    expect(line.textContent).toBe("Fact deleted. Wren will no longer use it.");
    expect(document.activeElement).not.toBe(document.body);
    expect(screen.getAllByRole("status")).toHaveLength(1);
  });

  test("the empty state offers Write a summary; Escape returns focus to it", async () => {
    const user = userEvent.setup();
    const changes: View[] = [];
    render(<main><Harness initial={view([], "")} onChange={(next) => changes.push(next)} /></main>);
    const write = screen.getByRole("button", { name: "Write a summary" });
    await user.click(write);
    const field = screen.getByRole("textbox", { name: "Edit Wren's summary" });
    expect(document.activeElement).toBe(field);
    await user.keyboard("{Escape}");
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Write a summary" }));
    await user.click(screen.getByRole("button", { name: "Write a summary" }));
    await user.type(screen.getByRole("textbox", { name: "Edit Wren's summary" }), "Hikers app, launching Sunday.");
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(changes.at(-1)?.summary).toBe("Hikers app, launching Sunday.");
    expect(status().textContent).toBe("Summary saved.");
    expect(await violations()).toEqual([]);
  });

  test("the character count is the server's: spaces and invisible characters are not counted", async () => {
    const user = userEvent.setup();
    render(<main><Harness initial={view(["Launch is Sunday."])} /></main>);
    await user.click(screen.getByRole("button", { name: "Edit fact 1" }));
    const field = screen.getByRole("textbox", { name: "Edit fact 1" });
    await user.clear(field);
    await user.type(field, "   Launch   is\u200b Sunday   ");
    const hint = document.getElementById(field.getAttribute("aria-describedby") ?? "");
    expect(hint?.textContent).toContain(`${"Launch is Sunday".length.toString()} of 200 characters.`);
  });
});

