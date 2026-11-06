// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { axe } from "vitest-axe";

import { fontMockModule, kitFor, MATRIX, specWith } from "./tenant-site-helpers";

vi.mock("next/font/google", () => fontMockModule([]));

import { TenantSite } from "@/components/tenant-site";
import type { LandingSpec } from "@/lib/workspace/contracts/artifacts";
import type { LandingIcon } from "@/lib/workspace/contracts/artifacts";
import { hydrotrailLandingSpec } from "@/lib/workspace/contracts/fixtures/hydrotrail";
import { checkLandingAgainstBrandKit } from "@/lib/workspace/contracts/artifacts";

afterEach(cleanup);
const platform = { year: 2026 };

describe("every direction x section layout renders with no axe violations", () => {
  // jsdom cannot paint, so colour contrast is asserted separately (wp75-tenant-theme.test.ts).
  test.each(MATRIX)("$name", async ({ direction, layouts }) => {
    const spec = specWith(direction, layouts);
    const kit = kitFor(direction);
    expect(checkLandingAgainstBrandKit(spec, kit)).toEqual([]);
    const { container } = render(<TenantSite spec={spec} kit={kit} platform={platform} />);
    const results = await axe(container, { rules: { "color-contrast": { enabled: false } } });
    expect(results.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
    expect(container.querySelector("main")).not.toBeNull();
  });
});

describe("structure", () => {
  const renderPage = () => render(<TenantSite spec={hydrotrailLandingSpec} kit={kitFor("warm_utility")} platform={platform} />).container;

  test("one h1 first, then h2 sections with only h3 under them", () => {
    const headings = [...renderPage().querySelectorAll("h1,h2,h3,h4,h5,h6")].map((h) => h.tagName);
    expect(headings.filter((h) => h === "H1").length).toBe(1);
    expect(headings[0]).toBe("H1");
    expect(headings.every((h) => ["H1", "H2", "H3"].includes(h))).toBe(true);
    expect(headings[1]).toBe("H2");
  });
  test("landmarks: banner, main, contentinfo, one labelled nav", () => {
    const page = renderPage();
    expect(page.querySelectorAll("header").length).toBe(1);
    expect(page.querySelectorAll("main").length).toBe(1);
    expect(page.querySelectorAll("footer").length).toBe(1);
    expect(page.querySelectorAll("nav[aria-label]").length).toBe(1);
  });
  test("icons are hidden and images carry alt text", () => {
    const page = renderPage();
    const icons = page.querySelectorAll("svg");
    expect(icons.length).toBeGreaterThan(0);
    icons.forEach((svg) => expect(svg.getAttribute("aria-hidden")).toBe("true"));
    const images = page.querySelectorAll("[role=img]");
    expect(images.length).toBeGreaterThan(0);
    images.forEach((img) => expect(img.getAttribute("aria-label")?.length).toBeGreaterThan(0));
  });
  test("external links open in a new tab and say so; anchors do not", () => {
    const page = renderPage();
    const external = page.querySelectorAll("a[href^='https://']");
    expect(external.length).toBeGreaterThan(0);
    for (const a of external) {
      expect(a.getAttribute("target")).toBe("_blank");
      expect(a.getAttribute("rel")).toContain("noopener");
      expect(a.textContent).toContain("(opens in new tab)");
    }
    const anchors = page.querySelectorAll("a[href^='#']");
    expect(anchors.length).toBeGreaterThan(3);
    for (const a of anchors) expect(a.getAttribute("target")).toBeNull();
  });
  test("the waitlist shell has no form and no way to post", () => {
    const page = renderPage();
    expect(page.querySelector("form")).toBeNull();
    expect(page.querySelector("[data-waitlist-slot=placeholder] input")?.hasAttribute("disabled")).toBe(true);
    expect(page.querySelector("[data-waitlist-slot=placeholder] button")?.hasAttribute("disabled")).toBe(true);
  });
  test("no emoji and no eyebrow element", () => {
    const page = renderPage();
    expect(page.textContent ?? "").not.toMatch(/\p{Emoji_Presentation}/u);
    expect(page.querySelector("[class*=eyebrow], [class*=kicker]")).toBeNull();
  });
});

describe("review fixes", () => {
  test("icon names that are object prototype keys render no icon and do not throw", () => {
    for (const name of ["constructor", "__proto__", "hasOwnProperty", "valueOf", "toString"]) {
      const spec = specWith("warm_utility");
      const items = spec.promises?.items.map((item) => ({ ...item, icon: name as LandingIcon }));
      const forged = { ...spec, promises: spec.promises && { ...spec.promises, items: items as NonNullable<LandingSpec["promises"]>["items"] } };
      const { container } = render(<TenantSite spec={forged} kit={kitFor("warm_utility")} platform={platform} />);
      expect(container.querySelectorAll("svg").length).toBe(0);
      cleanup();
    }
  });
  test("an unsafe CTA target is plain text, not a button-styled span", () => {
    const spec = specWith("warm_utility");
    const { container } = render(<TenantSite spec={{ ...spec, hero: { ...spec.hero, primaryCta: { label: "Go", target: "javascript:alert(1)" } } }} kit={kitFor("warm_utility")} platform={platform} />);
    const span = [...container.querySelectorAll("span")].find((el) => el.textContent === "Go");
    expect(span?.getAttribute("class")).toBeNull();
  });
  test("a forced low-contrast kit renders --t-link equal to --t-ink in the generated style", () => {
    const { container } = render(<TenantSite spec={hydrotrailLandingSpec} kit={kitFor("warm_utility", { primary: "#a9c4ce" })} platform={platform} />);
    const css = container.querySelector("style")?.textContent ?? "";
    const value = (name: string) => new RegExp(`${name}:(#[0-9a-f]{6})`).exec(css)?.[1];
    expect(value("--t-link")).toBeDefined();
    expect(value("--t-link")).toBe(value("--t-ink"));
  });
});
