import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, test, vi } from "vitest";
import type { FunctionReturnType } from "convex/server";
import type { api } from "../../convex/_generated/api";
import { Drafts } from "../../components/platform/builds/BuildsList";
import { SetupForm } from "../../components/platform/home/SetupForm";

type Project = FunctionReturnType<typeof api.platform.projects.listOwned>["page"][number];
const state = vi.hoisted(() => ({ results: [] as Project[], status: "CanLoadMore" }));
vi.mock("convex/react", () => ({
  usePaginatedQuery: () => ({ ...state, loadMore: vi.fn() }),
  useMutation: () => vi.fn(),
  useQuery: () => undefined,
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
beforeEach(() => { state.results = []; state.status = "CanLoadMore"; });

test("an empty filtered project page still renders the continuation control", () => {
  const html = renderToStaticMarkup(<Drafts />);
  expect(html).toContain("Check more projects for drafts");
  expect(html).toContain("No drafts in the projects checked so far.");
  expect(html).not.toContain("/dashboard/projects");
});

test("a complete empty draft scan has no misleading empty section", () => {
  state.status = "Exhausted";
  expect(renderToStaticMarkup(<Drafts />)).toBe("");
});

test("loading more keeps the draft continuation visible and disabled", () => {
  state.status = "LoadingMore";
  const html = renderToStaticMarkup(<Drafts />);
  expect(html).toContain("Checking your existing drafts");
  expect(html).toMatch(/<button[^>]*disabled=""/);
});

test("optional setup questions offer real radio choices to clear existing answers", () => {
  const html = renderToStaticMarkup(<SetupForm initial={{ tools: [], weeklyHours: "12", goal: "side-income" }} submitLabel="Save answers" onSaved={() => {}} />);
  expect(html.match(/No preference/g)).toHaveLength(2);
  // The two unselected clear choices belong to the native radio groups.
  expect(html).toMatch(/type="radio"[^>]*name="[^"]+-hours"[^>]*\/>No preference/);
  expect(html).toMatch(/type="radio"[^>]*name="[^"]+-goal"[^>]*\/>No preference/);
});
