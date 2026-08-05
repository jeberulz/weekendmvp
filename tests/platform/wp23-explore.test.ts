/// <reference types="vite/client" />

import { describe, expect, test } from "vitest";
import exploreCardSource from "../../components/platform/explore/ExploreCard.tsx?raw";
import exploreSource from "../../components/platform/explore/ExploreWorkspace.tsx?raw";
import explorePageSource from "../../app/dashboard/explore/page.tsx?raw";
import platformIdeasSource from "../../convex/platform/ideas.ts?raw";

describe("WP23 Explore workspace", () => {
  test("keeps views, search, filters, and sorting URL-addressable", () => {
    for (const view of ["all", "for_you", "saved", "interested", "building"]) {
      expect(exploreSource).toContain(`value: "${view}"`);
    }
    expect(exploreSource).toContain('name="q"');
    expect(exploreSource).toContain(
      "const [searchValue, setSearchValue] = useState(initialQuery)",
    );
    expect(exploreSource).toContain("<ExploreSearchForm");
    expect(exploreSource).toContain("key={query}");
    expect(exploreSource).toContain("initialQuery={query}");
    expect(exploreSource).toContain("value={searchValue}");
    expect(exploreSource).toContain(
      "onChange={(event) => setSearchValue(event.target.value)}",
    );
    expect(exploreSource).not.toContain("defaultValue={query}");
    expect(exploreSource).toContain('replaceParam("category"');
    expect(exploreSource).toContain('replaceParam("sort"');
    expect(exploreSource).toContain("Load next page");
  });

  test("explains bounded recommendations and per-page filtering", () => {
    expect(exploreSource).toContain("canonical scores and recency");
    expect(exploreSource).toContain("ideas you saved or marked Interested");
    expect(exploreSource).toContain("Search and filters apply to each indexed page");
  });

  test("links canonical research and the frozen preview path only", () => {
    expect(exploreCardSource).toContain('href={`/ideas/${idea.slug}`}');
    expect(exploreCardSource).toContain('href={`/build/${idea.slug}`}');
    expect(exploreCardSource).not.toContain("/dashboard/ideas/");
    expect(explorePageSource).toContain("same evidence-backed ideas published in the public library");
  });

  test("ships explicit loading, empty, and data-configuration states", () => {
    expect(exploreSource).toContain("ExploreSkeleton");
    expect(exploreSource).toContain("No ideas on this page");
    expect(exploreSource).toContain("Explore data is unavailable");
    expect(exploreSource).toContain("isValidPlatformConvexUrl");
  });

  test("waits for the server-confirmed intent mutation and never writes Building", () => {
    expect(exploreCardSource).toContain("await setIntent");
    expect(exploreCardSource).toContain("setConfirmed({ saved: result.saved");
    expect(exploreCardSource).toContain('aria-pressed={confirmed.saved}');
    expect(exploreCardSource).toContain('aria-pressed={confirmed.interested}');
    expect(exploreCardSource).toContain('aria-live="polite"');
    expect(exploreCardSource).not.toContain('updateIntent("building")');
    const mutationSource = platformIdeasSource.slice(
      platformIdeasSource.indexOf("export const setIntent"),
    );
    expect(mutationSource).not.toContain("userId:");
    expect(mutationSource).not.toContain('flag: v.literal("building")');
  });

  test("keeps controls named, touchable, and reduced-motion safe", () => {
    expect(exploreSource).toContain('role="group"');
    expect(exploreSource).toContain('aria-current={view === option.value ? "page" : undefined}');
    expect(exploreSource).toContain('htmlFor="explore-search"');
    expect(exploreSource).toContain("min-h-11");
    expect(exploreSource).toContain("motion-reduce:animate-none");
    expect(exploreCardSource).toContain("min-h-9");
    expect(exploreCardSource).not.toMatch(/text-zinc-(500|600)/);
    expect(exploreCardSource).not.toContain("bg-orange-600");
  });
});
