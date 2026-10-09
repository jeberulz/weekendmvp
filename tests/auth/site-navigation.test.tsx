import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { load } from "cheerio";
import { describe, expect, test, vi } from "vitest";
import { MegaNav } from "../../components/layout/MegaNav";
import { IdeaPageNav } from "../../components/ideas/IdeaPageNav";

vi.mock("next/navigation", () => ({ usePathname: () => "/startup-ideas" }));
vi.mock("../../lib/fonts", () => ({ newsreaderEditorial: { variable: "editorial" } }));

describe("shared public navigation", () => {
  test("anonymous idea readers receive the same destinations and dropdowns as public pages", () => {
    const publicNav = load(renderToStaticMarkup(<MegaNav variant="cream" />));
    const ideaNav = load(renderToStaticMarkup(<IdeaPageNav />));
    const destinations = (dom: ReturnType<typeof load>) =>
      dom('nav[aria-label="Primary"] a').map((_, link) => dom(link).attr("href")).get();

    expect(destinations(ideaNav)).toEqual(destinations(publicNav));
    expect(destinations(ideaNav)).toEqual(expect.arrayContaining([
      "/", "/startup-ideas", "/build-with/cursor", "/ideas-for/solo-founders", "/login", "/signup",
    ]));
    expect(ideaNav("#idea-site-header nav")).toHaveLength(1);
    expect(ideaNav('nav[aria-label="Explore Weekend MVP"]')).toHaveLength(0);
    expect(ideaNav('button[aria-controls]')).toHaveLength(3);
  });

  test("dropdown disclosures control existing panels and mark the current library destination", () => {
    const dom = load(renderToStaticMarkup(<MegaNav variant="cream" />));
    dom('nav[aria-label="Primary"] button[aria-controls]').each((_, button) => {
      const controlledId = dom(button).attr("aria-controls");
      expect(dom("[id]").toArray().some((panel) => dom(panel).attr("id") === controlledId)).toBe(true);
      expect(dom(button).attr("aria-expanded")).toBe("false");
    });
    expect(dom('a[href="/startup-ideas"][aria-current="page"]')).toHaveLength(2);
  });
});
