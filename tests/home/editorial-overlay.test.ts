import { expect, test } from "vitest";

import { mergeHomeIdeas } from "../../lib/home/data";

test("an approved update drops evidence and OG art belonging to the prior Git version", () => {
  const legacy = {
    slug: "updated-idea",
    title: "Old title",
    publishedAt: "2026-01-01",
    scores: { opportunity: 9 },
    provenance: { citations: 14 },
    highlights: { problemQuote: "Old claim" },
    og: { status: "ready" },
    source: "engine:updated-idea",
  };
  const publications = [{
    slug: "updated-idea",
    state: "released",
    releaseId: "rel_new",
    updatedAt: "2026-10-04T00:00:00Z",
    firstPublishedAt: "2026-01-01",
    title: "Approved title",
    metadata: {
      description: "Approved description",
      category: "ai-tools",
      buildTime: "10",
      revenueGoal: "1k-month",
      tools: ["cursor"],
      audiences: ["developers"],
      highlights: null,
      og: null,
    },
  }] as Parameters<typeof mergeHomeIdeas>[1];

  const [updated] = mergeHomeIdeas([legacy], publications);
  expect(updated).toMatchObject({
    title: "Approved title",
    description: "Approved description",
    publishedAt: "2026-01-01",
  });
  expect(updated).not.toHaveProperty("scores");
  expect(updated).not.toHaveProperty("provenance");
  expect(updated).not.toHaveProperty("og");
  expect(updated).not.toHaveProperty("source");
  expect(updated.highlights).toBeNull();
});
