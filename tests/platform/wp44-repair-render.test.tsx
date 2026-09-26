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

test("an untouched empty draft scan renders no region or live announcement", () => {
  state.status = "Exhausted";
  const html = renderToStaticMarkup(<Drafts />);
  expect(html).toBe("");
});

test("the initial draft scan is silent while parked drafts are unknown", () => {
  state.status = "LoadingFirstPage";
  const html = renderToStaticMarkup(<Drafts />);
  expect(html).toBe("");
});

test("a partial scan with a draft accurately announces found drafts", () => {
  state.results = [{ projectId: "project-one", source: "own_idea", nextAction: "resume_brief", title: "First draft", updatedAt: 1000 } as Project];
  const html = renderToStaticMarkup(<Drafts />);
  expect(html).toContain("1 existing idea draft found; more projects remain to check.");
  expect(html).not.toContain("No drafts in the projects checked so far.");
  expect(html).toContain("Resume brief");
});

test("loading more keeps the draft continuation focusable and marked unavailable", () => {
  state.status = "LoadingMore";
  const html = renderToStaticMarkup(<Drafts />);
  expect(html).toContain("Checking your existing drafts");
  expect(html).toMatch(/<button[^>]*aria-disabled="true"/);
  expect(html).not.toMatch(/<button[^>]* disabled=""/);
});

test("optional setup questions offer real radio choices to clear existing answers", () => {
  const html = renderToStaticMarkup(<SetupForm initial={{ tools: [], weeklyHours: "12", goal: "side-income" }} submitLabel="Save answers" onSaved={() => {}} />);
  expect(html.match(/No preference/g)).toHaveLength(2);
  // The two unselected clear choices belong to the native radio groups.
  expect(html).toMatch(/type="radio"[^>]*name="[^"]+-hours"[^>]*\/>No preference/);
  expect(html).toMatch(/type="radio"[^>]*name="[^"]+-goal"[^>]*\/>No preference/);
});

test("an exhausted first page with a draft still exposes the resume action", () => {
  state.status = "Exhausted";
  state.results = [{ projectId: "project-one", source: "own_idea", nextAction: "resume_brief", title: "First draft", updatedAt: 1000 } as Project];
  const html = renderToStaticMarkup(<Drafts />);
  expect(html).toContain("Your idea drafts");
  expect(html).toContain("Resume brief");
  expect(html).toContain("All projects checked for drafts.");
});
