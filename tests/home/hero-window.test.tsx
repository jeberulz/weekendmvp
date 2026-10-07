import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";

import { HeroBuildWindow } from "../../components/home/client/HeroBuildWindow";
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
