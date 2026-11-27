// @vitest-environment jsdom

import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test, vi } from "vitest";
import ShipablePage, { generateMetadata } from "@/app/(marketing)/shipable/page";
import { shipableTicketLines } from "@/app/(marketing)/shipable/shipable-data";
import { mapShipable, readShipable } from "@/lib/landing/read-shipable";
import published from "./fixtures/wp104-shipable/published-page.json";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/lib/fonts", () => ({ newsreader: { variable: "newsreader-test" } }));

function inspect(html: string) {
  const document = new DOMParser().parseFromString(html, "text/html");
  const text = (node: Element) => node.textContent.replace(/\s+/g, " ").trim();
  const main = document.querySelector("main:has(#seat)");
  if (!main?.nextElementSibling) throw new Error("Shipable page body or sticky bar missing");
  const section = (node: Element) => ({
    id: node.id,
    text: text(node),
    links: Array.from(node.querySelectorAll("a"), (link) => [link.getAttribute("href"), text(link)]),
  });
  return {
    document,
    snapshot: {
      sections: Array.from(main.children, section),
      stickyBar: section(main.nextElementSibling),
      jsonLd: Array.from(document.querySelectorAll('script[type="application/ld+json"]'), (script) => script.textContent),
    },
  };
}

test("renders Shipable's published copy, section order, links and structured data from Keystatic", async () => {
  expect(inspect(renderToStaticMarkup(await ShipablePage())).snapshot).toEqual(published);
  const metadata = await generateMetadata();
  expect(metadata.alternates?.canonical).toBe("/shipable");
  expect(metadata.title).toEqual({ absolute: "ship·able | Build & Ship Your MVP Live in 90 Minutes (Workshop)" });
});

test.runIf(process.env.CHECK_BUILT_GUIDE === "1")("preserves the Shipable page and free form in the production build", () => {
  const { document, snapshot } = inspect(readFileSync(".next/server/app/shipable.html", "utf8"));
  expect(snapshot).toEqual(published);
  expect(document.querySelector("#seat form input[type=email]")).not.toBeNull();
  expect(document.querySelector("#seat a[href*=checkout], #seat a[href*=stripe]")).toBeNull();
});

test("editors can reorder content and rename ticket lines while code supplies amounts", async () => {
  const { copy, stack } = await readShipable();
  const reversed = [...copy.sections].reverse();
  expect(mapShipable({ ...copy, sections: reversed }).sections).toEqual(reversed);
  expect(() => mapShipable({ ...copy, sections: [...reversed.slice(1), reversed[1]] })).toThrow("one of each");

  const lines = shipableTicketLines({ ...stack, workshop: { ...stack.workshop, ticketLabel: "Workshop seat" } });
  expect(lines[0]).toMatchObject({ label: "Workshop seat", value: "$97" });
  expect(lines.map(({ value }) => value)).toEqual(["$97", "$47", "$47", "$199", "$199", "$149"]);
  expect(() => mapShipable({ ...copy, ticket: { ...copy.ticket, accent: "$29 admission" } })).toThrow("price tokens");
  expect(() => mapShipable({ ...copy, ticket: { ...copy.ticket, intro: "Costs $29" } })).toThrow("monetary amounts");
});
