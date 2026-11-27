import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";
import BuildAlongPage, { metadata } from "@/app/(live-checkout)/live/build-along/page";
import { BUILD_ALONG, LIVE_ASSETS } from "@/lib/live/config";

vi.mock("next/server", () => ({ connection: async () => {} }));
vi.mock("@/lib/live/now", () => ({ readLiveClockMs: () => Date.parse("2026-11-27T00:00:00Z") }));
vi.mock("@/lib/live/seats-server", () => ({ loadSeatsInfo: async () => ({ soldOut: false }) }));

const EVENINGS_PREFIX =
  "I build Weekend MVP around a full-time job, on evenings and Saturdays";

describe("host evenings confirmed", () => {
  test("LIVE_ASSETS.hostEveningsConfirmed is on", () => {
    expect(LIVE_ASSETS.hostEveningsConfirmed).toBe(true);
  });

  test("free webinar, hub, and build-along pages gate the evenings line on the flag", () => {
    const free = readFileSync("app/(marketing)/live/48-hours/page.tsx", "utf8");
    const hub = readFileSync("app/(marketing)/live/live-hub-data.tsx", "utf8");
    const paid = readFileSync(
      "app/(live-checkout)/live/build-along/page.tsx",
      "utf8",
    );
    for (const src of [free, hub, paid]) {
      expect(src).toContain("hostEveningsConfirmed");
      expect(src).toContain(EVENINGS_PREFIX);
    }
  });
});

test("Build-Along metadata and event schema use the standard price after early-bird", async () => {
  expect(metadata.description).toContain(`$${BUILD_ALONG.standardUsd}`);
  expect(metadata.description).not.toContain(`$${BUILD_ALONG.earlyBirdUsd}`);

  const html = renderToStaticMarkup(await BuildAlongPage({ searchParams: Promise.resolve({}) }));
  const jsonLd = html.match(/<script type="application\/ld\+json">(.*?)<\/script>/)?.[1] ?? "";
  expect(JSON.parse(jsonLd)["@graph"]).toContainEqual(expect.objectContaining({
    "@type": "EducationEvent",
    description: metadata.description,
    offers: expect.objectContaining({ price: String(BUILD_ALONG.standardUsd) }),
  }));
});
