import { beforeEach, describe, expect, test, vi } from "vitest";

import type { ManifestIdea } from "@/lib/home/types";
import {
  OWN_IDEA_EXAMPLE_COUNT,
  OWN_IDEA_EXAMPLE_MAX,
  OWN_IDEA_FALLBACK_EXAMPLES,
  drawOwnIdeaExamples,
  ownIdeaExamplePool,
} from "@/lib/workspace/wizard/own-idea-examples";

const state = vi.hoisted(() => ({
  query: vi.fn(),
  manifest: [] as ManifestIdea[],
  life: [] as string[],
}));

vi.mock("convex/nextjs", () => ({ fetchQuery: state.query }));
vi.mock("next/cache", () => ({
  cacheLife: (profile: string) => {
    state.life.push(profile);
  },
  cacheTag: () => undefined,
}));
vi.mock("@/lib/public/library", () => ({ manifestIdeas: () => state.manifest }));

import { ownIdeaExamplePoolCached, ownIdeaExamplesForRequest } from "@/lib/workspace/wizard/own-idea-examples.server";

const idea = (slug: string, title: string, extra: Partial<ManifestIdea> = {}): ManifestIdea => ({ slug, title, ...extra });

/** A deterministic `random` that walks a fixed list. */
function sequence(values: number[]): () => number {
  let index = 0;
  return () => values[index++ % values.length] ?? 0;
}

const library = [
  idea("top-three-widget", "Widget that picks your top 3 tasks each morning"),
  idea("safe-meetups", "Safe meetup tracker for marketplace sellers"),
  idea("lookbook-studio", "AI lookbook studio for indie fashion brands"),
  idea("royalty-recovery", "Music royalty recovery platform for musicians' families"),
];

describe("WP99 ownIdeaExamplePool", () => {
  test("keeps live, buildable library ideas, as short headline lines with their slug", () => {
    const pool = ownIdeaExamplePool([
      ...library,
      idea("retired-one", "A retired idea", { _retiredAt: "2026-01-01" }),
      idea("engine-draft-abc123", "An engine draft"),
      idea("Bad Slug", "Not a slug the wizard can start"),
      idea("long-one", "A".repeat(OWN_IDEA_EXAMPLE_MAX + 1)),
      idea("subtitled", "Pocket CFO: cash forecasts for solo founders"),
      idea("market-claim", "Recipe app for a $4.2B market"),
      idea("dup-text", "Widget that picks your top 3 tasks each morning"),
      idea("top-three-widget", "Same slug again"),
    ]);
    expect(pool).toEqual([
      ...library.map((row) => ({ text: row.title, ideaSlug: row.slug })),
      { text: "Pocket CFO", ideaSlug: "subtitled" },
    ]);
    for (const example of pool) expect(example.text.length).toBeLessThanOrEqual(OWN_IDEA_EXAMPLE_MAX);
  });

  test("every chip the real manifest yields is at most 60 characters and unique", async () => {
    const manifest = (await import("@/ideas/manifest.json")).default as unknown as { ideas: ManifestIdea[] };
    const pool = ownIdeaExamplePool(manifest.ideas);
    expect(pool.length).toBeGreaterThan(OWN_IDEA_EXAMPLE_COUNT);
    expect(new Set(pool.map((example) => example.text.toLowerCase())).size).toBe(pool.length);
    for (const example of pool) {
      expect(example.text.length).toBeGreaterThan(0);
      expect(example.text.length).toBeLessThanOrEqual(OWN_IDEA_EXAMPLE_MAX);
    }
  });
});

describe("WP99 drawOwnIdeaExamples", () => {
  const pool = ownIdeaExamplePool(library);

  test("draws three distinct library chips, different draws for different randomness", () => {
    const first = drawOwnIdeaExamples(pool, sequence([0]));
    const second = drawOwnIdeaExamples(pool, sequence([0.99]));
    expect(first).toHaveLength(OWN_IDEA_EXAMPLE_COUNT);
    expect(new Set(first.map((example) => example.ideaSlug)).size).toBe(OWN_IDEA_EXAMPLE_COUNT);
    expect(first.every((example) => example.ideaSlug !== null)).toBe(true);
    expect(first).not.toEqual(second);
  });

  test("does not change the pool it draws from", () => {
    const before = [...pool];
    drawOwnIdeaExamples(pool, sequence([0.5]));
    expect(pool).toEqual(before);
  });

  test("a short pool is padded from the fallback lines, never repeating one", () => {
    const one = drawOwnIdeaExamples(pool.slice(0, 1), sequence([0]));
    expect(one).toEqual([pool[0], OWN_IDEA_FALLBACK_EXAMPLES[0], OWN_IDEA_FALLBACK_EXAMPLES[1]]);
    const overlapping = drawOwnIdeaExamples([{ text: OWN_IDEA_FALLBACK_EXAMPLES[0].text, ideaSlug: "packing" }], sequence([0]));
    expect(overlapping.map((example) => example.text)).toEqual([
      OWN_IDEA_FALLBACK_EXAMPLES[0].text,
      OWN_IDEA_FALLBACK_EXAMPLES[1].text,
      OWN_IDEA_FALLBACK_EXAMPLES[2].text,
    ]);
  });

  test("an empty pool gives the static fallback, with no slugs", () => {
    expect(drawOwnIdeaExamples([], Math.random)).toEqual([...OWN_IDEA_FALLBACK_EXAMPLES]);
  });
});

describe("WP99 the cached library read", () => {
  beforeEach(() => {
    state.query.mockReset();
    state.manifest = library;
    state.life = [];
  });

  test("merges editorial releases and drops withdrawn ideas, cached for hours", async () => {
    state.query.mockResolvedValue([
      { slug: "safe-meetups", state: "removed" },
      {
        slug: "released-idea",
        state: "released",
        title: "Shift swaps for small cafés",
        metadata: { description: "", category: "", buildTime: "", revenueGoal: "", tools: [], audiences: [] },
        firstPublishedAt: 1,
        updatedAt: 1,
      },
    ]);
    const pool = await ownIdeaExamplePoolCached();
    expect(pool.map((example) => example.ideaSlug)).toEqual([
      "top-three-widget",
      "lookbook-studio",
      "royalty-recovery",
      "released-idea",
    ]);
    expect(state.life).toEqual(["hours"]);
  });

  test("an unreachable editorial listing falls back to the manifest, cached for minutes", async () => {
    state.query.mockRejectedValue(new Error("convex down"));
    const pool = await ownIdeaExamplePoolCached();
    expect(pool.map((example) => example.ideaSlug)).toEqual(library.map((row) => row.slug));
    expect(state.life).toEqual(["minutes"]);
  });

  test("the request draw always returns three chips, even with no usable library", async () => {
    state.query.mockResolvedValue([]);
    await expect(ownIdeaExamplesForRequest(sequence([0]))).resolves.toHaveLength(OWN_IDEA_EXAMPLE_COUNT);
    state.manifest = [];
    await expect(ownIdeaExamplesForRequest(sequence([0]))).resolves.toEqual([...OWN_IDEA_FALLBACK_EXAMPLES]);
  });
});
