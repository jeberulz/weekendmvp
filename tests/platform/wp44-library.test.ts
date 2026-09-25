/// <reference types="vite/client" />

import { describe, expect, test } from "vitest";
import explorePageSource from "../../app/dashboard/explore/page.tsx?raw";
import exploreLoadingSource from "../../app/dashboard/explore/loading.tsx?raw";
import savedPageSource from "../../app/dashboard/saved/page.tsx?raw";
import librarySource from "../../components/platform/explore/IdeasLibrary.tsx?raw";
import filtersSource from "../../components/platform/explore/LibraryFilters.tsx?raw";
import cardSource from "../../components/platform/explore/IdeaCard.tsx?raw";
import savedSource from "../../components/platform/explore/SavedIdeas.tsx?raw";
import saveSource from "../../components/platform/home/SaveIdeaButton.tsx?raw";
import picksSource from "../../components/platform/home/PickedForYou.tsx?raw";
import searchSource from "../../components/platform/shell/WorkspaceSearch.tsx?raw";
import ideasQuerySource from "../../convex/platform/ideas.ts?raw";
import schemaSource from "../../convex/schema.ts?raw";
import {
  IDEAS_PATH,
  SAVED_PATH,
  hasFilters,
  libraryEntries,
  libraryHref,
  libraryKey,
  newSince,
  parseLibraryParams,
} from "../../components/platform/explore/library-params";

const params = (query: string) => parseLibraryParams(new URLSearchParams(query));

const librarySources = {
  explorePageSource,
  exploreLoadingSource,
  savedPageSource,
  librarySource,
  filtersSource,
  cardSource,
  savedSource,
};

describe("WP44-S5 library URL state", () => {
  test("reads defaults and rejects values it does not know", () => {
    expect(params("")).toEqual({ view: "all", q: "", tools: [], category: undefined, hours: undefined, goal: undefined, sort: undefined });
    expect(params("view=saved&hours=5&sort=random").view).toBe("all");
    expect(params("view=saved&hours=5&sort=random").hours).toBeUndefined();
    expect(params("view=saved&hours=5&sort=random").sort).toBeUndefined();
    expect(params("view=new&hours=more&sort=score")).toMatchObject({ view: "new", hours: "more", sort: "score" });
  });

  test("trims search and dedupes and caps tools", () => {
    expect(params(`q=${"x".repeat(120)}`).q).toHaveLength(80);
    expect(params("q=%20invoice%20").q).toBe("invoice");
    expect(params("tools=cursor,,bolt,cursor").tools).toEqual(["cursor", "bolt"]);
    expect(params("tools=a,b,c,d,e,f,g,h,i,j").tools).toHaveLength(8);
  });

  test("writes only non-default values, in a stable order", () => {
    const state = params("sort=score&goal=5k-month&tools=cursor,bolt&view=for_you&q=crm&category=saas&hours=8");
    expect(libraryEntries(state)).toEqual([
      ["view", "for_you"],
      ["q", "crm"],
      ["category", "saas"],
      ["tools", "cursor,bolt"],
      ["hours", "8"],
      ["goal", "5k-month"],
      ["sort", "score"],
    ]);
    expect(libraryHref(params(""))).toBe(IDEAS_PATH);
    expect(libraryHref(state, { view: "all", tools: [], sort: undefined })).toBe(
      `${IDEAS_PATH}?q=crm&category=saas&hours=8&goal=5k-month`,
    );
    expect(libraryKey(params("q=crm"))).toBe(libraryKey(params("q=crm&view=all")));
  });

  test("knows when anything narrows the results", () => {
    expect(hasFilters(params("view=new&sort=score"))).toBe(false);
    expect(hasFilters(params("tools=bolt"))).toBe(true);
    expect(hasFilters(params("q=crm"))).toBe(true);
  });

  test("the New window starts at UTC midnight, 30 days back", () => {
    expect(new Date(newSince(new Date("2026-09-25T15:42:00Z"))).toISOString()).toBe("2026-08-26T00:00:00.000Z");
    expect(newSince(new Date("2026-09-25T00:00:01Z"))).toBe(newSince(new Date("2026-09-25T23:59:59Z")));
  });
});

describe("WP44-S5 search and data", () => {
  test("search runs over the whole library through search indexes", () => {
    expect(schemaSource).toContain('.searchIndex("search_title", { searchField: "title", filterFields: ["category"] })');
    expect(schemaSource).toContain('.searchIndex("search_description", {');
    expect(ideasQuerySource).toContain('.withSearchIndex("search_title"');
    expect(ideasQuerySource).toContain('.withSearchIndex("search_description"');
    expect(ideasQuerySource).not.toContain(".paginate(");
    expect(ideasQuerySource).not.toContain(".collect()");
  });

  test("the old per-page caveat and system copy are gone", () => {
    const gone = [
      "apply to each indexed page",
      "Search loaded idea metadata",
      "Canonical score",
      "Load next page",
      "Explore data is unavailable",
      "Mark Interested",
      "Preview this idea",
      "/build/",
    ];
    for (const [name, source] of Object.entries(librarySources)) {
      for (const phrase of gone) expect(source, `${name}: ${phrase}`).not.toContain(phrase);
    }
  });

  test("Home picks rank the whole library and skip saved ideas", () => {
    expect(picksSource).toContain("api.platform.ideas.library");
    expect(picksSource).toContain("unsavedOnly: true");
    expect(picksSource).not.toContain("paginationOpts");
  });
});

describe("WP44-S5 pages", () => {
  test("Ideas has one search field: the top bar", () => {
    expect(librarySource).not.toMatch(/<input\b/);
    expect(filtersSource).not.toMatch(/type="search"/);
    expect(explorePageSource).not.toMatch(/<input\b/);
    expect(searchSource).toContain("action={IDEAS_PATH}");
    expect(searchSource).toContain('<input key={name} type="hidden" name={name} value={value} />');
  });

  test("old Saved and Building views redirect", () => {
    expect(explorePageSource).toContain('if (view === "saved" || view === "interested") redirect(SAVED_PATH);');
    expect(explorePageSource).toContain('if (view === "building") redirect("/dashboard/explore");');
    expect(SAVED_PATH).toBe("/dashboard/saved");
  });

  test("tabs are All, For you and New, and live in the URL", () => {
    expect(librarySource).toContain('<nav aria-label="Idea views"');
    expect(librarySource).toContain('aria-current={current ? "page" : undefined}');
    expect(librarySource).toContain("router.replace(libraryHref(params, patch), { scroll: false })");
  });

  test("cards show art, pitch, four scores, hours, tools and Save", () => {
    expect(cardSource).toContain("<IdeaArt");
    expect(cardSource).toContain("idea.description");
    expect(cardSource).toContain('<ScoreMeters scores={idea.scores} size="sm" />');
    expect(cardSource).toContain("HRS");
    expect(cardSource).toContain("toolList(idea.tools)");
    expect(cardSource).toContain("saved={idea.saved}");
  });

  test("Save keeps its live announcements, with or without a known state", () => {
    expect(saveSource).toContain('saved === undefined ? { slug } : "skip"');
    expect(saveSource).toContain('<span role="status" className="sr-only">');
    expect(savedSource).toContain("useKeptRows");
  });

  test("filters are labelled controls, and the layout toggle is stateful", () => {
    expect(filtersSource).toContain('label="Category"');
    expect(filtersSource).toContain('label="Build time"');
    expect(filtersSource).toContain('label="Revenue goal"');
    expect(filtersSource).toContain("<DropdownMenu.CheckboxItem");
    expect(filtersSource).toContain('<div role="group" aria-label="Layout"');
    expect(filtersSource).toContain("aria-pressed={layout === value}");
    expect(filtersSource).toContain('<ul aria-label="Active filters"');
  });

  test("Ideas and Saved are on the research-desk tokens", () => {
    for (const [name, source] of Object.entries(librarySources)) {
      expect(source, name).not.toContain("#050505");
      expect(source, name).not.toMatch(/\bzinc-\d/);
      expect(source, name).not.toMatch(/\bwhite\/\d/);
      // aria-label needs a role on a div (axe aria-prohibited-attr).
      expect(source, name).not.toMatch(/<div(?![^>]*\brole=)[^>]*aria-label=/);
    }
  });
});
