// @vitest-environment jsdom

import { readFileSync } from "node:fs";
import { act, fireEvent, render, within } from "@testing-library/react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test, vi } from "vitest";
import StarterKitPage, { generateMetadata } from "@/app/(marketing)/starter-kit/page";
import { Step2Spec, Step5Prompts } from "@/app/(marketing)/starter-kit/_sections";
import { mapStarterKit, readStarterKit } from "@/lib/landing/read-starter-kit";
import published from "./fixtures/wp104-starter-kit/published-page.json";
import promptsBefore from "./fixtures/wp104-starter-kit/copyable-prompts.json";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/lib/fonts", () => ({ newsreaderEditorial: { variable: "newsreader-test" } }));

function snapshot(html: string) {
  const document = new DOMParser().parseFromString(html, "text/html");
  const text = (node: Element) => node.textContent.replace(/\s+/g, " ").trim();
  const main = document.querySelector("main:has(#intro)");
  if (!main) throw new Error("Starter Kit body missing");
  return {
    sections: Array.from(main.querySelectorAll(":scope > #intro, section"), (section) => ({
      id: section.id,
      text: text(section),
      links: Array.from(section.querySelectorAll("a"), (link) => [link.getAttribute("href"), text(link)]),
    })),
    contents: Array.from(document.querySelectorAll("#sidebar a"), (link) => [link.getAttribute("href"), text(link)]),
    jsonLd: Array.from(document.querySelectorAll('script[type="application/ld+json"]'), (script) => script.textContent),
  };
}

test("renders the published Starter Kit section tree, links and JSON-LD from Keystatic", async () => {
  expect(snapshot(renderToStaticMarkup(await StarterKitPage()))).toEqual(published);
  const metadata = await generateMetadata();
  expect(metadata.alternates?.canonical).toBe("/starter-kit");
  expect(metadata.title).toEqual({ absolute: "Weekend MVP Starter Kit | Build your product in 48 hours" });
});

test.runIf(process.env.CHECK_BUILT_GUIDE === "1")("preserves the Starter Kit in the actual production build", () => {
  expect(snapshot(readFileSync(".next/server/app/starter-kit.html", "utf8"))).toEqual(published);
});

test("every existing copy button hands the exact original prompt to the clipboard", async () => {
  const copy = await readStarterKit();
  const prompts = copy.resources.find((resource) => resource.discriminant === "prompts");
  if (!prompts) throw new Error("Starter Kit build prompts missing");
  const saved = Object.getOwnPropertyDescriptor(navigator, "clipboard");
  const writeText = vi.fn(async (_text: string) => {});
  Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
  try {
    const spec = render(createElement(Step2Spec, { copy: copy.spec }));
    const resources = render(createElement(Step5Prompts, { resource: prompts }));
    try {
      const buttons = [spec.container, resources.container].flatMap((container) =>
        within(container).getAllByRole("button", { name: "Copy prompt to clipboard" }));
      await act(async () => {
        for (const button of buttons) fireEvent.click(button);
      });
      expect(writeText.mock.calls.map(([body]) => body)).toEqual(promptsBefore);
    } finally {
      spec.unmount();
      resources.unmount();
    }
  } finally {
    if (saved) Object.defineProperty(navigator, "clipboard", saved);
    else Reflect.deleteProperty(navigator, "clipboard");
  }
});

test("reordered resources keep public anchors and number the contents in displayed order", async () => {
  const kit = await readStarterKit();
  const [ideas, prompts, templates] = kit.resources;
  const reordered = mapStarterKit({ ...kit, resources: [templates, prompts, ideas] });
  expect(reordered.contents[2]).toEqual([
    { href: "#templates", label: "Templates & Scripts" },
    { href: "#step-5", label: "4. 10 Build Prompts" },
    { href: "#step-4", label: "5. 10 MVP Ideas" },
  ]);
  expect(() => mapStarterKit({ ...kit, resources: [ideas, ideas, templates] })).toThrow("one of each resource");
});
