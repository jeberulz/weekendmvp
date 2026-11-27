// @vitest-environment jsdom

import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, expect, test, vi } from "vitest";
import Homepage, { generateMetadata } from "@/app/(marketing)/page";
import * as homeReader from "@/lib/landing/read-home";

const data = vi.hoisted(() => ({
  totals: { ideas: 243, categories: [], averageHours: 11, tools: {} },
  week: { label: "Nov 27" },
  newest: [], hero: null, spotlight: null, inside: null, strip: [],
}));

vi.mock("next/server", () => ({ connection: async () => {} }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/lib/fonts", () => ({ newsreaderEditorial: { variable: "newsreader-test" } }));
vi.mock("@/lib/home/data", () => ({ getHomeData: async () => data }));
vi.mock("@/lib/workspace/build-cta-access", () => ({ buildCtaVisible: async () => false }));

afterEach(() => vi.restoreAllMocks());

test("one CMS edit updates the visible FAQ and FAQPage while the idea count and estimate stay live", async () => {
  const copy = await homeReader.readHome();
  const answer = "The new editorial answer.";
  const question = "Where is the plan?";
  vi.spyOn(homeReader, "readHome").mockResolvedValue({
    ...copy, finalCall: { ...copy.finalCall, faqs: [{ question, answer }] },
  });

  const html = renderToStaticMarkup(await Homepage());
  const document = new DOMParser().parseFromString(html, "text/html");
  const faq = document.querySelector('section[aria-labelledby="home-final-title"] dl');
  expect(faq?.querySelector("dt")?.textContent).toBe(question);
  expect(faq?.querySelector("dd")?.textContent).toBe(answer);
  const graph = JSON.parse(document.querySelector('script[type="application/ld+json"]')!.textContent)["@graph"];
  expect(graph.find((node: { "@type": string }) => node["@type"] === "FAQPage").mainEntity).toMatchObject([
    { name: question, acceptedAnswer: { text: answer } },
  ]);
  expect(graph.find((node: { "@type": string }) => node["@type"] === "SoftwareApplication").offers.price).toBe("0");
  expect(document.querySelector('section[aria-labelledby="home-test-title"]')?.textContent).toContain("estimated at 11 hours");
  const metadata = await generateMetadata();
  expect(metadata.title).toEqual({ absolute: "Weekend MVP | 243 Startup Ideas You Can Build in a Weekend" });
  expect(metadata.description).toMatch(/^243 researched startup ideas/);
});

test("the homepage requires the live tokens in metadata and the build estimate", async () => {
  const copy = await homeReader.readHome();
  expect(() => homeReader.validateHome({ ...copy, seoDescription: "Fixed count of 229." })).toThrow("{ideaCount}");
  expect(() => homeReader.validateHome({
    ...copy, weekendTest: { ...copy.weekendTest, closing: "Always 12 hours." },
  })).toThrow("{hours}");
});
