// @vitest-environment jsdom

import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeAll, describe, expect, test, vi } from "vitest";

vi.mock("next/image", async () => {
  const React = await import("react");
  return {
    default: ({ fill, ...props }: Record<string, unknown>) =>
      React.createElement("img", { ...props, "data-nimg": fill ? "fill" : "1" }),
  };
});

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/lib/fonts", () => ({
  newsreaderEditorial: { variable: "newsreader-test" },
}));

import manifestJson from "../../ideas/manifest.json";
import { BUILD_ALONG_PRICE } from "../../app/(marketing)/5-to-9-starter/_sections";
import FiveToNineStarterPage, { generateMetadata } from "../../app/(marketing)/5-to-9-starter/page";
import StarterKitPage from "../../app/(marketing)/starter-kit/page";
import { START_HERE } from "../../components/home/content";
import { GUIDE_AUTOMATION_ID, subscribeViaApi } from "../../lib/beehiiv-client";
import { liveIdeas } from "../../lib/home/library";
import * as starterReader from "../../lib/landing/read-starter";
import { type StarterEntry, validateStarter } from "../../lib/landing/read-starter";
import { withPublishedLanding } from "./fixtures/published-landing";
import published from "./fixtures/wp104-starter/published-page.json";
import type { ManifestIdea } from "../../lib/home/types";

let html: string;
let metadata: Awaited<ReturnType<typeof generateMetadata>>;
let current: StarterEntry;

beforeAll(async () => {
  const [page, pageMetadata, entry] = await Promise.all([FiveToNineStarterPage(), generateMetadata(), starterReader.readStarter()]);
  html = renderToStaticMarkup(page);
  metadata = pageMetadata;
  current = entry;
});

function renderPage() {
  return html;
}

function snapshot(source: string) {
  const document = new DOMParser().parseFromString(source, "text/html");
  const text = (node: Element) => node.textContent.replace(/\s+/g, " ").trim();
  const main = document.querySelector("main#starter-content");
  if (!main) throw new Error("Starter main element missing");
  return {
    sections: Array.from(main.querySelectorAll(":scope > section"), (section) => ({
      id: section.getAttribute("aria-labelledby"),
      text: text(section),
      links: Array.from(section.querySelectorAll("a"), (link) => [link.getAttribute("href"), text(link)]),
    })),
    jsonLd: Array.from(main.querySelectorAll('script[type="application/ld+json"]'), (script) => script.textContent),
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("5-to-9 Starter landing page", () => {
  test("maps the frozen Keystatic entry to the published section tree and JSON-LD", async () => {
    await withPublishedLanding(starterReader.readStarter,
      (entry) => vi.spyOn(starterReader, "readStarter").mockResolvedValue(entry),
      async () => expect(snapshot(renderToStaticMarkup(await FiveToNineStarterPage()))).toEqual(published),
    );
  });

  test.runIf(process.env.CHECK_BUILT_GUIDE === "1")("renders the current tree and JSON-LD in the production build", () => {
    expect(snapshot(readFileSync(".next/server/app/5-to-9-starter.html", "utf8"))).toEqual(snapshot(html));
  });

  test("validates the section structure and resolves Build-Along pricing from code", async () => {
    const entry = current;
    const intro = entry.sections.find((section) => section.discriminant === "fiveDays");
    const otherSections = entry.sections.filter((section) => section !== intro);
    expect(entry.hero).not.toHaveProperty("ideaCount");
    expect(entry.hero.form).not.toHaveProperty("automationId");
    expect(entry.finalCapture.form).not.toHaveProperty("successHref");
    if (!intro) throw new Error("Expected the day sequence");
    expect(intro.value.buildAlongLabel).toContain("{buildAlongPrice}");
    expect(validateStarter({ ...entry, sections: [...otherSections, intro] }).sections.at(-1)).toBe(intro);
    expect(() => validateStarter({ ...entry, sections: [intro, intro, ...otherSections.slice(1)] })).toThrow("one of each page section");
    expect(() => validateStarter({
      ...entry,
      sections: [{ ...intro, value: { ...intro.value, buildAlongLabel: "Build-Along sprint ($29)" } }, ...otherSections],
    })).toThrow("require exactly one {buildAlongPrice}");
  });

  test("uses its canonical route and the current search and social copy", () => {
    expect(metadata.alternates?.canonical).toBe("/5-to-9-starter");
    expect(metadata.title).toEqual({ absolute: current.seoTitle });
    expect(metadata.description).toBe(current.seoDescription);
    expect(metadata.openGraph?.title).toBe(current.seoTitle);
    expect(metadata.openGraph?.siteName).toBe("Weekend MVP");
    expect(metadata.twitter?.site).toBe("@weekendmvp");
  });

  test("links to the Builder from the Starter FAQ", () => {
    expect(renderPage()).toContain('href="/guides/5-to-9-builder"');
  });

  test("links to both pages from the homepage, footer and Starter Kit", () => {
    const kit = renderToStaticMarkup(createElement(StarterKitPage));
    const footer = readFileSync("components/layout/SiteFooter.tsx", "utf8");
    const homepageHrefs = START_HERE.map(({ href }) => href);
    for (const href of ["/5-to-9-starter", "/guides/5-to-9-builder"]) {
      expect(homepageHrefs).toContain(href);
      expect(footer).toContain(`href="${href}"`);
      expect(kit).toContain(`href="${href}"`);
    }
  });

  test("lists the Starter in the sitemap with a content date", () => {
    expect(readFileSync("app/sitemap.ts", "utf8"))
      .toMatch(/entry\("\/5-to-9-starter", \{[^}]*lastModified: new Date\(STARTER_DATE_MODIFIED\)/);
  });

  test("shows the live idea count in the byline", () => {
    const total = liveIdeas((manifestJson as { ideas: ManifestIdea[] }).ideas).length;
    const document = new DOMParser().parseFromString(renderPage(), "text/html");
    const byline = [...document.querySelectorAll('section[aria-labelledby="guide-hero-title"] p')]
      .find((node) => node.firstChild?.textContent?.trim() === current.hero.bylineStart.trim() && node.querySelector("span"));
    expect(byline?.querySelector("span")?.textContent).toBe(String(total));
    expect(byline?.textContent?.trim()).toBe(`${current.hero.bylineStart} ${total} ${current.hero.bylineEnd}`.trim());
  });

  test("renders the code-owned workshop price in both links", () => {
    const document = new DOMParser().parseFromString(renderPage(), "text/html");
    const links = [...document.querySelectorAll('a[href="/live/build-along"]')];
    expect(links).toHaveLength(2);
    for (const link of links) expect(link.textContent).toContain(BUILD_ALONG_PRICE);
  });

  test("uses the Day 1 ink illustration and the existing founder portrait", () => {
    const html = renderPage();
    const document = new DOMParser().parseFromString(html, "text/html");
    const illustration = document.querySelector('img[src="/image/5-to-9/hero-day1-illustration.svg"]');
    expect(illustration?.getAttribute("alt")).toBe(current.hero.illustrationAlt);
    expect(html).not.toContain("data:image/");
    expect(html).toContain('alt="Portrait of John Iseghohi"');
    expect(html.match(/<details\b/g)).toHaveLength(5);
    expect(html.match(/<details open=""/g)).toHaveLength(1);
  });

  test("renders two forms with distinct labelled fields and live feedback", () => {
    const html = renderPage();
    const document = new DOMParser().parseFromString(html, "text/html");
    const forms = [...document.querySelectorAll("form")];
    expect(forms).toHaveLength(2);

    const fieldIds = forms.map((form, index) => {
      const label = form.querySelector("label");
      const field = form.querySelector<HTMLInputElement>('input[name="email"]');
      const status = form.querySelector('[aria-live="polite"]');
      expect(label?.textContent).toBe("Email address");
      expect(field?.id).toBe(label?.htmlFor);
      expect(field?.autocomplete).toBe("email");
      expect(status?.id).toBe(`${field?.id}-status`);
      expect(form.querySelector('button[type="submit"]')?.textContent)
        .toBe([current.hero.form, current.finalCapture.form][index].submitLabel);
      return field?.id;
    });
    expect(new Set(fieldIds).size).toBe(2);
  });

  test.each(["hero", "final"])("uses the existing subscribe endpoint for the %s form source", async (placement) => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("{}"));
    vi.stubGlobal("fetch", fetchMock);
    const source = `5-to-9-${placement}`;

    await expect(subscribeViaApi({
      email: "test@example.com",
      automationIds: [GUIDE_AUTOMATION_ID],
      utmCampaign: "5-to-9-starter",
      utmSource: source,
    })).resolves.toMatchObject({ ok: true });

    expect(fetchMock).toHaveBeenCalledWith("/api/subscribe", expect.objectContaining({
      method: "POST",
      body: JSON.stringify({
        email: "test@example.com",
        automation_ids: ["aut_ccd70ec4-dff3-4a10-8d26-290cb7fa9bc2"],
        utm_campaign: "5-to-9-starter",
        utm_source: source,
      }),
    }));
  });
});
