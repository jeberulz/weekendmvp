// @vitest-environment jsdom

import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test, vi } from "vitest";
import DarePage, { generateMetadata } from "@/app/(marketing)/dare/page";
import { dareTicketLines } from "@/app/(marketing)/dare/dare-data";
import { mapDare, readDare } from "@/lib/landing/read-dare";
import published from "./fixtures/wp104-dare/published-page.json";

vi.mock("@/lib/fonts", () => ({ newsreader: { variable: "newsreader-test" } }));

function inspect(html: string) {
  const document = new DOMParser().parseFromString(html, "text/html");
  const text = (node: Element) => node.textContent.replace(/\s+/g, " ").trim();
  const main = document.querySelector("main:has(#seat)");
  if (!main?.nextElementSibling) throw new Error("Dare draft body or sticky bar missing");
  const section = (node: Element) => ({
    id: node.id,
    text: text(node),
    links: Array.from(node.querySelectorAll("a"), (link) => [link.getAttribute("href"), text(link)]),
  });
  return {
    sections: Array.from(main.children, section),
    stickyBar: section(main.nextElementSibling),
    robots: document.querySelector("meta[name=robots]")?.getAttribute("content"),
    jsonLd: Array.from(document.querySelectorAll('script[type="application/ld+json"]'), (script) => script.textContent),
  };
}

test("renders the original draft, including its placeholders and offers", async () => {
  expect(inspect(renderToStaticMarkup(await DarePage()))).toEqual({ ...published, robots: undefined });
  const metadata = await generateMetadata();
  expect(metadata.robots).toEqual({ index: false, follow: false });
  expect(metadata.alternates).toEqual({ canonical: "/dare" });
});

test.runIf(process.env.CHECK_BUILT_GUIDE === "1")("keeps the draft content and noindex in the production HTML", () => {
  expect(inspect(readFileSync(".next/server/app/dare.html", "utf8"))).toEqual(published);
});

test("edits ticket labels and section order without accepting a replacement for the draft date", async () => {
  const { copy, stack } = await readDare();
  const sections = [...copy.sections].reverse();
  expect(mapDare({ ...copy, sections }).sections).toEqual(sections);
  expect(() => mapDare({ ...copy, timezones: { ...copy.timezones, remainder: "on 12 March." } })).toThrow("draft placeholders");
  expect(() => mapDare({ ...copy, ticket: { ...copy.ticket, note: "A $49 workshop." } })).toThrow("monetary amounts");

  const lines = dareTicketLines({ ...stack, workshop: { ...stack.workshop, ticketLabel: "Working session" } });
  expect(lines[0]).toMatchObject({ label: "Working session", value: "$97" });
  expect(lines.map(({ value }) => value)).toEqual(["$97", "$47", "$67", "$147", "$47", "$97", "—"]);
});
