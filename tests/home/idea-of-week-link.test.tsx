import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";

import { IdeaOfTheWeekLink } from "../../components/home/client/IdeaOfTheWeekLink";
import { IDEA_OF_WEEK_CTA_LOCATION, HERO_CTA_LOCATION, heroCta } from "../../lib/home/hero-cta";

describe("idea of the week link", () => {
  // Server markup is the visitor's: the session hint is read on the client after hydration.
  const html = renderToStaticMarkup(<IdeaOfTheWeekLink slug="example-idea" title="Example Idea" className="w-full" />);

  test("goes to the idea page, which shows a member the research and anyone else the gate", () => {
    expect(html).toMatch(/<a [^>]*href="\/ideas\/example-idea"/);
  });

  test("first paint words it for a visitor, and names the idea for screen readers", () => {
    expect(html).toContain(`${heroCta(false).label}<span class="sr-only"> for Example Idea</span>`);
    expect(html).not.toContain(heroCta(true).label);
  });

  test("reports from its own location, apart from the hero", () => {
    expect(IDEA_OF_WEEK_CTA_LOCATION).toBe("home-idea-of-the-week");
    expect(IDEA_OF_WEEK_CTA_LOCATION).not.toBe(HERO_CTA_LOCATION);
  });
});
