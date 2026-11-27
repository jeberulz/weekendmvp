// @vitest-environment jsdom

import { renderToStaticMarkup } from "react-dom/server";
import { expect, test, vi } from "vitest";
import LiveHub, { generateMetadata } from "@/app/(marketing)/live/page";
import { readLiveHub, validateLiveHub } from "@/lib/landing/read-live-hub";
import { NEXT_BUILD_ALONG } from "@/lib/live/config";
import published from "./fixtures/wp104-live-hub/published-ended.json";

vi.mock("next/server", () => ({ connection: async () => {} }));
vi.mock("@/lib/fonts", () => ({ newsreaderEditorial: { variable: "newsreader-test" } }));
vi.mock("@/lib/live/now", () => ({ readLiveClockMs: () => Date.parse("2026-11-27T12:00:00Z") }));
vi.mock("@/lib/live/seats-server", () => ({
  loadSeatsInfo: async () => ({ total: 20, sold: 2, left: 18, soldOut: false }),
}));

function inspect(html: string) {
  const document = new DOMParser().parseFromString(html, "text/html");
  const main = document.querySelector("main");
  if (!main) throw new Error("Live hub body missing");
  const text = (node: Element) => node.textContent.replace(/\s+/g, " ").trim();
  return {
    sections: Array.from(main.children, (node) => ({
      tag: node.tagName,
      text: text(node),
      links: Array.from(node.querySelectorAll("a"), (link) => [link.getAttribute("href"), text(link)]),
    })),
    jsonLd: Array.from(document.querySelectorAll('script[type="application/ld+json"]'), (script) => script.textContent),
  };
}

test("renders the published Live hub ended state from Keystatic without adding JSON-LD", async () => {
  const html = renderToStaticMarkup(await LiveHub());
  expect(inspect(html)).toEqual(published);
  expect(html).toContain(NEXT_BUILD_ALONG.label);
  const metadata = await generateMetadata();
  expect(metadata.alternates).toEqual({ canonical: "/live" });
  expect(metadata.description).toBe(
    "Free and paid live sessions where we take one idea from a page to a live link. Free webinar Sat 31 Oct, build-along Sat 14 Nov. Times in GMT.",
  );
});

test("requires the local time and next-session tokens after editorial changes", async () => {
  const copy = await readLiveHub();
  const sections = [...copy.sections].reverse();
  expect(validateLiveHub({ ...copy, sections }).sections).toEqual(sections);
  const withoutToken = sections.map((section) => section.discriminant === "faq"
    ? {
      ...section, value: {
        ...section.value, items: section.value.items.map((item) => item.discriminant === "nextSession"
          ? { ...item, value: { ...item.value, answer: "Soon." } }
          : item),
      },
    }
    : section);
  expect(() => validateLiveHub({ ...copy, sections: withoutToken })).toThrow("{nextBuildAlongLabel}");
});
