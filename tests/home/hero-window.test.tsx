import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";

import { HeroBuildWindow } from "../../components/home/client/HeroBuildWindow";
import { heroCta } from "../../lib/home/hero-cta";
import { HERO_TOOL_NOTES } from "../../lib/home/hero-prompt";
import type { HeroIdea } from "../../lib/home/types";

const idea: HeroIdea = {
  slug: "example-idea",
  title: "Example Idea",
  libraryNo: 7,
  category: "saas",
  categoryName: "SaaS",
  buildTime: 12,
  promptTitles: ["Project Setup", "Core Feature", "Landing Page"],
  firstPrompt: Array.from({ length: 9 }, (_, i) => `prompt line ${i + 1}`),
};

describe("hero build window, first paint", () => {
  const html = renderToStaticMarkup(<HeroBuildWindow idea={idea} total={225} />);

  test("opens on Cursor with its lead line as row 1 and the idea's prompt after it", () => {
    expect(html).toContain(HERO_TOOL_NOTES.cursor);
    expect(html.indexOf(HERO_TOOL_NOTES.cursor)).toBeLessThan(html.indexOf("prompt line 1"));
    expect(html).toContain("PASTE INTO CURSOR");
  });

  test("names the tool in the copy button, and keeps Copy at the start of the name", () => {
    expect(html).toContain('aria-label="Copy prompt 1 for Cursor: Project Setup"');
  });

  test("renders all seven tabs and shows no other tool's lead line", () => {
    expect(html.match(/role="tab"/g)).toHaveLength(7);
    expect(html).not.toContain(HERO_TOOL_NOTES.claude);
    expect(html).not.toContain(HERO_TOOL_NOTES.lovable);
  });
});

describe("hero build window, idea link", () => {
  // Server markup is the visitor's: the session hint is read on the client after hydration.
  const html = renderToStaticMarkup(<HeroBuildWindow idea={idea} total={225} />);

  test("links to the idea page, which shows a visitor the gate and a member the research", () => {
    expect(html).toMatch(/<a [^>]*href="\/ideas\/example-idea"/);
    expect(html.match(/href="\/ideas\//g)).toHaveLength(1);
  });

  test("first paint words it for a visitor", () => {
    expect(html).toContain(heroCta(false).label);
    expect(html).toContain(heroCta(false).note);
    expect(html).not.toContain(heroCta(true).label);
  });

  test("the link's name carries the idea, so it is not a bare 'Unlock the full research'", () => {
    expect(html).toContain(`${heroCta(false).label}<span class="sr-only"> for Example Idea</span>`);
  });

  test("the link follows the Copy button in reading order", () => {
    expect(html.indexOf('aria-label="Copy prompt 1 for Cursor')).toBeLessThan(html.indexOf('href="/ideas/example-idea"'));
  });
});
