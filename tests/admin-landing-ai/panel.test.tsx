// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { EnhancePanel } from "@/app/admin/pages/enhance/panel";
import type { PanelCatalog } from "@/lib/landing-ai/catalog-server";

const pages: PanelCatalog = [
  { id: "home", label: "Homepage", blocks: [
    { id: "hero", label: "Opening", kind: "edit", characters: 50, fieldCount: 2 },
    { id: "add:checklist", label: "New checklist", kind: "add", characters: 0, fieldCount: 2 },
  ] },
];

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

test("the panel shows a clear unavailable state and makes no request", () => {
  const fetcher = vi.fn();
  vi.stubGlobal("fetch", fetcher);
  render(<EnhancePanel pages={pages} generationAvailable={false} />);
  const button = screen.getByRole<HTMLButtonElement>("button", { name: "Generate preview" });
  expect(button.disabled).toBe(true);
  expect(screen.getByText(/provider is configured/)).toBeDefined();
  fireEvent.click(button);
  expect(fetcher).not.toHaveBeenCalled();
});

test("selecting a new section previews a fixture and discards it without writing", async () => {
  const fetcher = vi.fn().mockResolvedValue(Response.json({
    before: {}, after: { title: "Before Saturday", items: ["Choose a single idea."] },
    costEstimate: { inputTokens: 22, outputTokens: 15 },
  }));
  vi.stubGlobal("fetch", fetcher);
  render(<EnhancePanel pages={pages} generationAvailable />);
  fireEvent.change(screen.getByRole("combobox", { name: "Section" }), { target: { value: "add:checklist" } });
  fireEvent.click(screen.getByRole("button", { name: "Generate preview" }));
  expect(await screen.findByText("Choose a single idea.")).toBeDefined();
  const [path, options] = fetcher.mock.calls[0];
  expect(path).toBe("/api/admin/page-ai/generate");
  expect(JSON.parse(options.body)).toMatchObject({ page: "home", blockId: "add:checklist", action: "add" });
  fireEvent.click(screen.getByRole("button", { name: "Discard" }));
  expect(screen.queryByText("Choose a single idea.")).toBeNull();
  expect(fetcher).toHaveBeenCalledOnce();
});
