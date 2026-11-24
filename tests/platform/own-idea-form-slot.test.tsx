// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";

import { OwnIdeaForm, type OwnIdeaFieldApi } from "@/components/workspace/wizard/OwnIdeaForm";

afterEach(cleanup);

describe("OwnIdeaForm field action slot", () => {
  test("the action reads the text and selection, replaces the text and clears the error", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    const seen: { selection: ReturnType<OwnIdeaFieldApi["getSelection"]>; text: string }[] = [];
    render(
      <OwnIdeaForm
        pending={false}
        error={null}
        onSubmit={onSubmit}
        renderFieldAction={(field) => (
          <button
            type="button"
            aria-controls={field.fieldId}
            onClick={() => {
              seen.push({ selection: field.getSelection(), text: field.text });
              field.setText(`${field.text} for hikers`);
            }}
          >
            Improve
          </button>
        )}
      />,
    );

    // An empty submit shows the local error; the action's setText clears it.
    await user.click(screen.getByRole("button", { name: "Continue" }));
    expect(screen.getByRole("alert").textContent).toBe("Write your idea in one sentence first.");

    const input = screen.getByLabelText("Your idea in one sentence") as HTMLInputElement;
    await user.type(input, "A packing list");
    input.setSelectionRange(2, 9);
    await user.click(screen.getByRole("button", { name: "Improve" }));

    expect(seen).toEqual([{ selection: { start: 2, end: 9 }, text: "A packing list" }]);
    expect(input.value).toBe("A packing list for hikers");
    expect(screen.queryByRole("alert")).toBeNull();

    await user.click(screen.getByRole("button", { name: "Continue" }));
    expect(onSubmit).toHaveBeenCalledWith("A packing list for hikers");
  });

  test("without an action the form renders as before", () => {
    render(<OwnIdeaForm pending={false} error={null} onSubmit={vi.fn()} />);
    expect(screen.queryByRole("button", { name: "Improve" })).toBeNull();
    expect(screen.getByRole("button", { name: "Continue" })).toBeTruthy();
  });
});
