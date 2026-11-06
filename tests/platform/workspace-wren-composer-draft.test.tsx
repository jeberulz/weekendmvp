// @vitest-environment jsdom
/**
 * WP77 PR #210 review: the composer keeps the draft unless onSend reports the
 * message was accepted; a void caller keeps the old clear-immediately behaviour.
 */
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";

import { WrenComposer } from "@/components/workspace/kit/WrenThread";

afterEach(cleanup);

function box(): HTMLTextAreaElement {
  return screen.getByRole("textbox", { name: "Message Wren" }) as HTMLTextAreaElement;
}

async function sendWith(onSend: (text: string) => boolean | Promise<boolean> | void) {
  const user = userEvent.setup();
  render(<WrenComposer onSend={onSend} />);
  await user.type(box(), "Move the email");
  await user.click(screen.getByRole("button", { name: "Send message" }));
}

describe("WrenComposer draft", () => {
  test.each([
    ["busy", async () => false],
    ["paused", async () => false],
    ["capped", async () => false],
    ["rejection", async () => Promise.reject(new Error("nope"))],
  ])("kept and focused when the send fails (%s)", async (_name, onSend) => {
    await sendWith(onSend);
    await waitFor(() => expect(document.activeElement).toBe(box()));
    expect(box().value).toBe("Move the email");
  });

  test("kept while the send is pending, cleared once it resolves true (sent / duplicate)", async () => {
    let resolve: (accepted: boolean) => void = () => {};
    await sendWith(() => new Promise<boolean>((done) => { resolve = done; }));
    expect(box().value).toBe("Move the email");
    resolve(true);
    await waitFor(() => expect(box().value).toBe(""));
  });

  test("a synchronous true clears", async () => {
    await sendWith(() => true);
    expect(box().value).toBe("");
  });

  test("a void caller clears straight away", async () => {
    const onSend = vi.fn();
    await sendWith(onSend);
    expect(onSend).toHaveBeenCalledWith("Move the email");
    expect(box().value).toBe("");
  });
});
