/// <reference types="vite/client" />

import { describe, expect, test } from "vitest";
import libraryCardSource from "../../components/platform/library/LibraryCard.tsx?raw";
import librarySource from "../../components/platform/library/LibraryPicker.tsx?raw";
import explorePageSource from "../../app/dashboard/explore/page.tsx?raw";
import homeSource from "../../convex/platform/home.ts?raw";

describe("signed-in Library picker", () => {
  test("is one picker with search, category, and canonical or newest sort", () => {
    expect(librarySource).toContain('id="library-search"');
    expect(librarySource).toContain('name="q"');
    expect(librarySource).toContain('["score", "newest"]');
    expect(librarySource).not.toContain("for_you");
    expect(librarySource).not.toContain("Saved");
    expect(librarySource).not.toContain("Interested");
    expect(librarySource).not.toContain("Recommended");
    expect(explorePageSource).toContain("LibraryPicker");
    expect(explorePageSource).not.toContain("ExploreWorkspace");
  });

  test("preview is the primary and research is the title", () => {
    expect(libraryCardSource).toContain('href={`/ideas/${idea.slug}`}');
    expect(libraryCardSource).toContain('href={`/build/${idea.slug}`}');
    expect(libraryCardSource).toContain("This is the one you’re on");
    expect(libraryCardSource).toContain("Open project");
    expect(libraryCardSource).not.toContain("setIntent");
    expect(libraryCardSource).not.toContain("Canonical score");
    expect(libraryCardSource).not.toContain("Mark Interested");
  });

  test("library rank is canonical scores, not For you", () => {
    expect(homeSource).toContain('v.literal("score")');
    expect(homeSource).toContain('v.literal("newest")');
    expect(homeSource).not.toContain("recommended");
    expect(homeSource).not.toContain("for_you");
    expect(librarySource).toContain("Nothing matches. Clear filters.");
  });
});
