// @vitest-environment jsdom

import { renderToStaticMarkup } from "react-dom/server";
import { expect, test, vi } from "vitest";
import BuildAlongPage from "@/app/(live-checkout)/live/build-along/page";
import { readBuildAlong, validateBuildAlong } from "@/lib/landing/read-build-along";
import { BUILD_ALONG } from "@/lib/live/config";
import confirmation from "./fixtures/wp104-build-along/wp104-pr8-paid-confirmation.json";
import ended from "./fixtures/wp104-build-along/wp104-pr8-paid-ended.json";
import preSale from "./fixtures/wp104-build-along/wp104-pr8-paid-pre-sale.json";
import soldEarly from "./fixtures/wp104-build-along/wp104-pr8-paid-sold-early.json";
import soldStandard from "./fixtures/wp104-build-along/wp104-pr8-paid-sold-standard.json";
import soldLive from "./fixtures/wp104-build-along/wp104-pr8-paid-sold-live.json";

const runtime = vi.hoisted(() => ({ clock: 0, sold: 0 }));
vi.mock("next/server", () => ({ connection: async () => {} }));
vi.mock("@/lib/live/now", () => ({ readLiveClockMs: () => runtime.clock }));
vi.mock("@/lib/live/seats-server", async () => {
  const { seatsFromSold } = await import("@/lib/live/seats");
  return { loadSeatsInfo: async () => seatsFromSold(runtime.sold) };
});
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

async function renderPage(clock: string, sold: number, thanks = "") {
  runtime.clock = Date.parse(clock);
  runtime.sold = sold;
  const html = renderToStaticMarkup(await BuildAlongPage({ searchParams: Promise.resolve({ thanks }) }));
  return new DOMParser().parseFromString(html, "text/html");
}

function inspect(document: Document) {
  const main = document.body.firstElementChild;
  if (!main?.querySelector("h1")) throw new Error("Build-Along body missing");
  const text = (node: Element) => node.textContent.replace(/\s+/g, " ").trim();
  return {
    sections: Array.from(main.children).filter((node) => node.tagName !== "SCRIPT").map((node) => ({
      tag: node.tagName, id: node.id, text: text(node),
      links: Array.from(node.querySelectorAll("a"), (link) => [link.getAttribute("href"), text(link)]),
      buttons: Array.from(node.querySelectorAll("button"), (button) => [text(button), button.disabled]),
    })),
    jsonLd: Array.from(document.querySelectorAll('script[type="application/ld+json"]'), (script) => script.textContent),
  };
}

test.each([
  ["ended", "2026-11-27T12:00:00Z", 2, "", ended],
  ["confirmation", "2026-11-10T12:00:00Z", 2, "1", confirmation],
  ["pre-sale", "2026-10-30T12:00:00Z", 2, "", preSale],
  ["early-bird sold out", "2026-11-02T12:00:00Z", 20, "", soldEarly],
  ["standard sold out", "2026-11-10T12:00:00Z", 20, "", soldStandard],
  ["workshop live sold out", "2026-11-14T15:30:00Z", 20, "", soldLive],
] as const)("preserves the published %s page and JSON-LD", async (_name, clock, sold, thanks, expected) => {
  expect(inspect(await renderPage(clock, sold, thanks))).toEqual(expected);
});

test.each([
  ["2026-11-02T12:00:00Z", BUILD_ALONG.earlyBirdUsd],
  ["2026-11-10T12:00:00Z", BUILD_ALONG.standardUsd],
] as const)("renders purchasable tickets and code-owned pricing at %s", async (clock, amount) => {
  const document = await renderPage(clock, 2);
  const ticket = document.querySelector("#ticket")!;
  expect(document.querySelectorAll("#ticket")).toHaveLength(1);
  expect(ticket.querySelector("button")?.textContent).toBe(`Get my ticket, $${amount}`);
  expect(ticket.querySelector("button")?.disabled).toBe(false);
  expect(ticket.textContent).toContain("20 seats. 18 left.");
});

test("requires checkout tokens and rejects price literals in the editable copy", async () => {
  const copy = await readBuildAlong();
  expect(() => validateBuildAlong({ ...copy, personalNote: { ...copy.personalNote, earlyBird: "Early-bird is open." } }))
    .toThrow("{priceLine}");
  expect(() => validateBuildAlong({ ...copy, hero: { ...copy.hero, body: "Buy a ticket for $3." } }))
    .toThrow("code-owned tokens");
});
