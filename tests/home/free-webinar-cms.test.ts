// @vitest-environment jsdom

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";
import FreeWebinarPage from "@/app/(marketing)/live/48-hours/page";
import { freeFaqItemsVisible } from "@/app/(marketing)/live/48-hours/free-data";
import { readFreeWebinar, validateFreeWebinar } from "@/lib/landing/read-free-webinar";
import { LIVE_ASSETS } from "@/lib/live/config";
import ended from "./fixtures/wp104-free-webinar/ended.json";
import open from "./fixtures/wp104-free-webinar/pre-sale.json";
import live from "./fixtures/wp104-free-webinar/webinar-live.json";
import replay from "./fixtures/wp104-free-webinar/replay-early-bird.json";
import configuredEnded from "./fixtures/wp104-free-webinar/configured-ended.json";
import configuredOpen from "./fixtures/wp104-free-webinar/configured-pre-sale.json";
import configuredLive from "./fixtures/wp104-free-webinar/configured-webinar-live.json";
import configuredReplay from "./fixtures/wp104-free-webinar/configured-replay-early-bird.json";

const runtime = vi.hoisted(() => ({ clock: 0 }));
vi.mock("next/server", () => ({ connection: async () => {} }));
vi.mock("@/lib/fonts", () => ({ newsreaderEditorial: { variable: "newsreader-test" } }));
vi.mock("@/lib/live/now", () => ({ readLiveClockMs: () => runtime.clock }));

function inspect(html: string) {
  const document = new DOMParser().parseFromString(html, "text/html");
  const main = document.querySelector("main:has(h1)");
  if (!main) throw new Error("Free webinar body missing");
  const text = (node: Element) => node.textContent.replace(/\s+/g, " ").trim();
  return {
    sections: Array.from(main.children, (node) => ({
      tag: node.tagName, id: node.id, text: text(node),
      links: Array.from(node.querySelectorAll("a"), (link) => [link.getAttribute("href"), text(link)]),
    })),
    jsonLd: Array.from(document.querySelectorAll('script[type="application/ld+json"]'), (script) => script.textContent),
  };
}

const cases = [
  ["ended", "2026-11-27T12:00:00Z", ended, configuredEnded],
  ["open", "2026-10-30T12:00:00Z", open, configuredOpen],
  ["live", "2026-10-31T16:30:00Z", live, configuredLive],
  ["replay", "2026-11-02T12:00:00Z", replay, configuredReplay],
] as const;

describe.each(cases)("free webinar %s", (_name, clock, fallback, configured) => {
  test.each([false, true])("preserves sections, links and JSON-LD (configured URLs: %s)", async (hasLinks) => {
    runtime.clock = Date.parse(clock);
    vi.stubEnv("NEXT_PUBLIC_LIVE_LUMA_URL", hasLinks ? "https://lu.ma/fixture-webinar" : "");
    vi.stubEnv("NEXT_PUBLIC_LIVE_YOUTUBE_URL", hasLinks ? "https://www.youtube.com/watch?v=fixtureLive" : "");
    vi.stubEnv("NEXT_PUBLIC_LIVE_YOUTUBE_REPLAY_URL", hasLinks ? "https://www.youtube.com/watch?v=fixtureReplay" : "");
    try {
      expect(inspect(renderToStaticMarkup(await FreeWebinarPage()))).toEqual(hasLinks ? configured : fallback);
    } finally {
      vi.unstubAllEnvs();
    }
  });
});

test("the tools answer follows configured tools and the support link keeps its token", async () => {
  const copy = await readFreeWebinar();
  const tools = copy.faq.items.find((item) => item.discriminant === "tools");
  expect(freeFaqItemsVisible(copy.faq).some((item) => item.question === tools?.value.question)).toBe(false);
  const saved = LIVE_ASSETS.toolList;
  try {
    LIVE_ASSETS.toolList = ["Example editor", "Example runtime"];
    expect(freeFaqItemsVisible(copy.faq).find((item) => item.question === tools?.value.question)?.answer)
      .toContain("We'll use Example editor, Example runtime.");
  } finally {
    LIVE_ASSETS.toolList = saved;
  }
  expect(() => validateFreeWebinar({
    ...copy, faq: { ...copy.faq, items: copy.faq.items.filter((item) => item.discriminant !== "support") },
  })).toThrow("{supportEmail}");
});
