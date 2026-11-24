// @vitest-environment jsdom
/**
 * WP100-S4. The "Improve with AI" control on the unified own-idea Step 1
 * (`OwnIdeaForm`): states, use / keep / try again / undo, selection mode,
 * the live region, the field staying usable, and axe. The Convex binding is
 * replaced by a scripted `IdeaImproveApi`; nothing reaches a model.
 */
import { act, cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import { axe } from "vitest-axe";

import { OwnIdeaForm } from "@/components/workspace/wizard/OwnIdeaForm";
import type { IdeaImproveApi, IdeaImproveId, IdeaImproveResult } from "@/components/workspace/wizard/useIdeaImprove";
import { wordDiff } from "@/lib/workspace/wizard/idea-diff";

afterEach(cleanup);

const ROUGH = "basically an app for campers so they dont forget stuff";
const SHARP = "A packing app for campers so they don't forget anything.";
const ID = "improvement1" as IdeaImproveId;
const ID2 = "improvement2" as IdeaImproveId;

function deferred<T>() {
  let resolve: (value: T) => void = () => undefined;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function setup(results: IdeaImproveResult[] | (() => Promise<IdeaImproveResult>), options: { enabled?: boolean; initialText?: string } = {}) {
  const queue = Array.isArray(results) ? [...results] : null;
  const improve = vi.fn<IdeaImproveApi["improve"]>(async () =>
    queue === null ? await (results as () => Promise<IdeaImproveResult>)() : (queue.shift() ?? { status: "failed", improvementId: ID }),
  );
  const decide = vi.fn<IdeaImproveApi["decide"]>(async () => null);
  const onSubmit = vi.fn();
  const api: IdeaImproveApi = { enabled: options.enabled ?? true, improve, decide };
  const view = render(
    <OwnIdeaForm pending={false} error={null} onSubmit={onSubmit} initialText={options.initialText ?? ROUGH} improve={api} />,
  );
  const field = screen.getByLabelText("Your idea in one sentence") as HTMLInputElement;
  return { ...view, improve, decide, onSubmit, field, user: userEvent.setup() };
}

const status = () => screen.getAllByRole("status").map((node) => node.textContent ?? "").join(" ");

describe("Improve with AI on Step 1", () => {
  test("hidden when AI is unavailable; the field works as before", async () => {
    const { field, user, onSubmit } = setup([], { enabled: false });
    expect(screen.queryByRole("button", { name: /improve/i })).toBeNull();
    await user.clear(field);
    await user.type(field, "a list app for my running club");
    await user.click(screen.getByRole("button", { name: "Continue" }));
    expect(onSubmit).toHaveBeenCalledWith("a list app for my running club");
  });

  test("a suggestion shows beside the field and changes nothing until Use this", async () => {
    const { field, user, improve, decide } = setup([{ status: "suggested", improvementId: ID, mode: "whole", text: SHARP, changeNote: "Named what it is." }]);
    await user.click(screen.getByRole("button", { name: "Improve" }));
    expect(improve).toHaveBeenCalledWith({ text: ROUGH });

    const card = await screen.findByRole("region", { name: "A sharper version" });
    expect(field.value).toBe(ROUGH);
    expect(within(card).getByText("Named what it is.")).toBeTruthy();
    expect(card.querySelectorAll("mark").length).toBeGreaterThan(0);
    expect(card.querySelector("mark .sr-only")?.textContent).toBe("changed: ");
    expect(status()).toContain(`Suggestion ready: ${SHARP}`);

    await user.click(within(card).getByRole("button", { name: "Use this" }));
    expect(field.value).toBe(SHARP);
    expect(decide).toHaveBeenCalledWith({ improvementId: ID, outcome: "accepted" });
    expect(screen.queryByRole("region", { name: "A sharper version" })).toBeNull();
    expect(screen.getByText("Sharpened with AI.")).toBeTruthy();
    expect(status()).toContain(`Your idea now reads: ${SHARP}`);
  });

  test("Undo returns the founder's own words", async () => {
    const { field, user, decide } = setup([{ status: "suggested", improvementId: ID, mode: "whole", text: SHARP, changeNote: "" }]);
    await user.click(screen.getByRole("button", { name: "Improve" }));
    await user.click(await screen.findByRole("button", { name: "Use this" }));
    await user.click(screen.getByRole("button", { name: "Undo" }));
    expect(field.value).toBe(ROUGH);
    expect(decide).toHaveBeenLastCalledWith({ improvementId: ID, outcome: "undone" });
    expect(status()).toContain("Restored your words.");
    expect(screen.queryByRole("button", { name: "Undo" })).toBeNull();
  });

  test("after two rounds, Back to my words returns the first text", async () => {
    const second = "A packing app for weekend campers so they don't forget anything.";
    const { field, user, improve } = setup([
      { status: "suggested", improvementId: ID, mode: "whole", text: SHARP, changeNote: "" },
      { status: "suggested", improvementId: ID2, mode: "whole", text: second, changeNote: "" },
    ]);
    await user.click(screen.getByRole("button", { name: "Improve" }));
    await user.click(await screen.findByRole("button", { name: "Use this" }));
    await user.click(screen.getByRole("button", { name: "Improve" }));
    expect(improve).toHaveBeenLastCalledWith({ text: SHARP, parentId: ID });
    await user.click(await screen.findByRole("button", { name: "Use this" }));
    expect(field.value).toBe(second);
    await user.click(screen.getByRole("button", { name: "Back to my words" }));
    expect(field.value).toBe(ROUGH);
  });

  test("Keep mine leaves the text and returns focus to the field", async () => {
    const { field, user, decide } = setup([{ status: "suggested", improvementId: ID, mode: "whole", text: SHARP, changeNote: "" }]);
    await user.click(screen.getByRole("button", { name: "Improve" }));
    await user.click(await screen.findByRole("button", { name: "Keep mine" }));
    expect(field.value).toBe(ROUGH);
    expect(decide).toHaveBeenCalledWith({ improvementId: ID, outcome: "dismissed" });
    await act(async () => await new Promise<void>((done) => requestAnimationFrame(() => done())));
    expect(document.activeElement).toBe(field);
  });

  test("Try again asks once more and records the retry", async () => {
    const { user, improve, decide } = setup([
      { status: "suggested", improvementId: ID, mode: "whole", text: SHARP, changeNote: "" },
      { status: "already_clear", improvementId: ID2 },
    ]);
    await user.click(screen.getByRole("button", { name: "Improve" }));
    await user.click(await screen.findByRole("button", { name: "Try again" }));
    expect(improve).toHaveBeenCalledTimes(2);
    expect(decide).toHaveBeenCalledWith({ improvementId: ID, outcome: "retried" });
    expect(await screen.findByText("Your sentence is already clear. Nothing to change.", { selector: "span" })).toBeTruthy();
  });

  test("typing after asking keeps the card but marks it as based on the earlier text", async () => {
    const { field, user } = setup([{ status: "suggested", improvementId: ID, mode: "whole", text: SHARP, changeNote: "" }]);
    await user.click(screen.getByRole("button", { name: "Improve" }));
    await screen.findByRole("region", { name: "A sharper version" });
    await user.type(field, " today");
    expect(screen.getByText("Based on your earlier text.")).toBeTruthy();
    expect(field.value).toBe(`${ROUGH} today`);
  });

  test("selected words switch the button to Improve selection and send the range", async () => {
    const { field, user, improve } = setup([{ status: "failed", improvementId: ID }]);
    act(() => {
      field.focus();
      field.setSelectionRange(0, "basically an app".length);
      field.dispatchEvent(new Event("select", { bubbles: true }));
    });
    const button = screen.getByRole("button", { name: "Improve selection" });
    await user.click(button);
    expect(improve).toHaveBeenCalledWith({ text: ROUGH, selection: { start: 0, end: 16 } });
  });

  test("while loading the field is read-only, Stop drops the late reply", async () => {
    const pending = deferred<IdeaImproveResult>();
    const { field, user } = setup(() => pending.promise);
    await user.click(screen.getByRole("button", { name: "Improve" }));
    expect(field.readOnly).toBe(true);
    expect(field.getAttribute("aria-busy")).toBe("true");
    expect(screen.getByRole("button", { name: "Improving…" }).getAttribute("aria-disabled")).toBe("true");
    await user.click(screen.getByRole("button", { name: "Stop" }));
    expect(field.readOnly).toBe(false);
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Improve" }));
    await act(async () => pending.resolve({ status: "suggested", improvementId: ID, mode: "whole", text: SHARP, changeNote: "" }));
    expect(screen.queryByRole("region", { name: "A sharper version" })).toBeNull();
    expect(field.value).toBe(ROUGH);
  });

  test.each([
    [{ status: "rate_limited" } as const, "You've used today's improvements. Your idea works as it is, so carry on.", false],
    [{ status: "failed", improvementId: ID } as const, "Couldn't improve it just now. Your idea is unchanged.", true],
    [{ status: "rejected", improvementId: ID } as const, "We couldn't sharpen this without changing your idea, so yours stays as it is.", true],
    [{ status: "unavailable" } as const, "Improve isn't available right now. Your idea works as it is, so carry on.", true],
  ])("%o shows a calm notice and leaves the text", async (result, copy, retry) => {
    const { field, user } = setup([result]);
    await user.click(screen.getByRole("button", { name: "Improve" }));
    expect(await screen.findByText(copy, { selector: "span" })).toBeTruthy();
    expect(field.value).toBe(ROUGH);
    expect(screen.queryAllByRole("button", { name: "Try again" })).toHaveLength(retry ? 1 : 0);
  });

  test("a thrown call is a notice, never an error boundary", async () => {
    const { field, user } = setup(async () => {
      throw new Error("offline");
    });
    await user.click(screen.getByRole("button", { name: "Improve" }));
    expect(await screen.findByText(/isn't available right now/u, { selector: "span" })).toBeTruthy();
    expect(field.value).toBe(ROUGH);
  });

  test("fewer than three words: the button explains instead of calling", async () => {
    const { user, improve } = setup([], { initialText: "camping app" });
    const button = screen.getByRole("button", { name: "Improve" });
    expect(button.getAttribute("aria-disabled")).toBe("true");
    await user.click(button);
    expect(improve).not.toHaveBeenCalled();
    expect(status()).toContain("Write a few words first.");
  });

  test("Ctrl+Shift+Enter in the field runs Improve; plain Enter still submits", async () => {
    const { field, user, improve, onSubmit } = setup([{ status: "already_clear", improvementId: ID }]);
    field.focus();
    await user.keyboard("{Control>}{Shift>}{Enter}{/Shift}{/Control}");
    expect(improve).toHaveBeenCalledTimes(1);
    expect(onSubmit).not.toHaveBeenCalled();
    await user.keyboard("{Enter}");
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  test("the button names its shortcut and hint for assistive tech", () => {
    setup([]);
    const button = screen.getByRole("button", { name: "Improve" });
    expect(button.getAttribute("aria-keyshortcuts")).toContain("Control+Shift+Enter");
    expect(button.getAttribute("aria-describedby")).toBeTruthy();
  });

  test("no axe violations in the suggestion state", async () => {
    const { container, user } = setup([{ status: "suggested", improvementId: ID, mode: "whole", text: SHARP, changeNote: "Named what it is." }]);
    await user.click(screen.getByRole("button", { name: "Improve" }));
    await screen.findByRole("region", { name: "A sharper version" });
    const results = await axe(container);
    expect(results.violations).toEqual([]);
  });
});

describe("wordDiff", () => {
  test("marks only the new words and joins back to the suggestion", () => {
    const parts = wordDiff(ROUGH, SHARP);
    expect(parts.map((part) => part.text).join("")).toBe(SHARP);
    const added = parts.filter((part) => part.added).map((part) => part.text.trim());
    expect(added.join(" ")).toContain("packing");
    expect(parts.some((part) => !part.added && part.text.includes("campers"))).toBe(true);
  });

  test("an identical sentence has nothing marked", () => {
    expect(wordDiff(SHARP, SHARP)).toEqual([{ text: SHARP, added: false }]);
  });
});
