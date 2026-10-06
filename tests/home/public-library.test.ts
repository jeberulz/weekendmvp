import { expect, test } from "vitest";

import { librarySlugs } from "../../lib/public/library";

type Publications = Parameters<typeof librarySlugs>[1];

const meta = {
  description: "d",
  category: "saas",
  buildTime: "10",
  revenueGoal: "1k-month",
  tools: ["cursor"],
  audiences: ["developers"],
  highlights: null,
  og: null,
};

test("public lists use the homepage rule: live manifest ideas plus released publications", () => {
  const manifest = [
    { slug: "live-idea", title: "Live" },
    { slug: "retired-idea", title: "Retired", _retiredAt: "2026-04-21T19:38:10.512Z" },
    { slug: "engine-draft-spot-check", title: "Draft" },
    { slug: "withdrawn-idea", title: "Withdrawn" },
  ];
  const publications = [
    { slug: "released-only", state: "released", releaseId: "r1", updatedAt: "2026-10-04", firstPublishedAt: "2026-10-04", title: "New", metadata: meta },
    { slug: "withdrawn-idea", state: "removed", releaseId: "r2", updatedAt: "2026-10-04", firstPublishedAt: null, title: null, metadata: null },
  ] as unknown as Publications;

  expect(librarySlugs(manifest, publications).sort()).toEqual(["live-idea", "released-only"]);
});

test("a Convex-only row is never listed (stale rows such as ai-built-app-code-audit answer 404)", () => {
  expect(librarySlugs([{ slug: "live-idea", title: "Live" }], [])).not.toContain("ai-built-app-code-audit");
});
