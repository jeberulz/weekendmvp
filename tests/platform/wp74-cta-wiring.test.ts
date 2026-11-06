import { describe, expect, test } from "vitest";

import homeSource from "../../app/(marketing)/page.tsx?raw";
import ideaSource from "../../app/ideas/[slug]/page.tsx?raw";

describe("WP74-S5 wiring", () => {
  test("the homepage reads the flag after connection() and passes it to both sections", () => {
    expect(homeSource.indexOf("await connection()")).toBeLessThan(homeSource.indexOf("buildCtaVisible()"));
    expect(homeSource).toMatch(/<Hero [^>]*buildCta=\{buildCta\}/);
    expect(homeSource).toMatch(/<IdeaOfTheWeek [^>]*buildCta=\{buildCta\}/);
  });

  test("the idea page starts the flag read before the idea lookup, for non-draft slugs only, and uses it for a resolved idea", () => {
    expect(ideaSource.indexOf("isBuildCtaSlug(slug) ? buildCtaVisible()")).toBeLessThan(ideaSource.indexOf("await resolveIdea(slug, token)"));
    expect(ideaSource).toContain("isBuildCtaSlug(slug) ? buildCtaVisible()");
    expect(ideaSource).toMatch(/resolved \? await ctaLookup : false/);
    expect(ideaSource).toContain("buildFirst={buildCta}");
  });

  test("signed-in members get no CTA on the idea page", () => {
    expect(ideaSource).not.toContain("BuildIdeaCta");
  });

  test("primary content stays server-rendered: the CTA is never the only way to the research", () => {
    expect(ideaSource).not.toMatch(/buildCta\s*\?\s*null/);
  });
});
