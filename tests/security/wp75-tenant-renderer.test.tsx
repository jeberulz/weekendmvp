import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";

import { fontMockModule, kitFor, specWith } from "../platform/tenant-site-helpers";

vi.mock("next/font/google", async () => (await import("../platform/tenant-site-helpers")).fontMockModule([]));

import { PLATFORM_TEXT, TenantSite } from "@/components/tenant-site";
import type { BrandKit, LandingSpec } from "@/lib/workspace/contracts/artifacts";
import { DEFAULT_PROOF_SLOTS } from "@/lib/workspace/contracts/artifacts";

void fontMockModule;

/**
 * WP75-S5a. The tenant renderer draws a model's LandingSpec and BrandKit on a public page, so this is the WP28
 * escaping matrix for the new surface: hostile text, hostile links, hostile colours, and platform-owned text that a
 * model cannot reach. Callers pass schema-parsed values (the renderer does not re-parse); hostile cases that the
 * schemas would refuse are built by cast to prove the renderer's own guards (links, hex, closed lists) hold anyway.
 */
const HOSTILE = [
  "</style><script>window.__pwned = 1</script>",
  '"><script>alert(1)</script>',
  "<img src=x onerror=\"alert(1)\">",
  "javascript:alert(1)",
  "<svg/onload=alert(1)>",
  "}</style><style>body{display:none}</style>",
  "a;}body{background:url(https://evil.example/x)}",
];
const platform = { year: 2026 };
const render = (spec: LandingSpec, kit: BrandKit) => renderToStaticMarkup(<TenantSite spec={spec} kit={kit} platform={platform} themeDocument />);

function hostileSpec(text: string): LandingSpec {
  const base = specWith("warm_utility");
  const cta = { label: text, target: "#waitlist" };
  return {
    ...base,
    nav: { brandName: text, links: [cta], cta },
    hero: {
      ...base.hero,
      headline: { text, emphasis: text },
      subhead: text,
      primaryCta: cta,
      secondaryCta: cta,
      reassurance: text,
      image: { description: text, alt: text },
      productMoment: { title: text, body: text, caption: text },
    },
    promises: { layout: "list", items: base.promises?.items.map((item) => ({ ...item, title: text, body: text })) as never },
    how_it_works: { layout: "numbered_steps", heading: text, steps: base.how_it_works?.steps.map(() => ({ title: text, body: text })) as never },
    app_preview: base.app_preview && { ...base.app_preview, heading: text, body: text, cta, screen: { description: text, alt: text } },
    waitlist: { ...base.waitlist, heading: text, body: text, emailLabel: text, buttonLabel: text, successMessage: text },
    footer: { ...base.footer, closingLine: text, cta, copyrightName: text },
  };
}

describe.each(HOSTILE)("hostile model text %s", (payload) => {
  const html = render(hostileSpec(payload), kitFor("warm_utility"));
  test("never opens a tag, script, style or event handler", () => {
    expect(html).not.toContain("<script");
    expect(html).not.toContain("<img");
    expect(html).not.toContain("<svg/");
    // Attribute values are quoted and escaped, so ` onerror=` inside one is inert text (the WP27 false-positive
    // family); only an attribute *name* on a tag would matter, so values are removed first.
    const bare = html.replace(/="[^"]*"/g, '=""');
    expect(bare).not.toMatch(/<[a-z]+[^>]*\son[a-z]+=/i);
    expect(html.match(/<style/g)?.length).toBe(1);
    expect(html).not.toContain("dangerouslySetInnerHTML");
    expect(html).not.toMatch(/\sstyle=/);
  });
  test("the payload survives as escaped visible text", () => {
    if (payload.includes("<")) expect(html).toContain("&lt;");
    else expect(html).toContain(payload.replace(/&/g, "&amp;"));
  });
});

describe("links", () => {
  test("no href is built from model text, and an unsafe target is not a link", () => {
    const spec = hostileSpec("x");
    const bad = ["javascript:alert(1)", "data:text/html,<script>1</script>", "//evil.example", "http://insecure.example", "#missing", "https://user:pw@evil.example/", "https://evil.example/‮"];
    for (const target of bad) {
      const html = render({ ...spec, hero: { ...spec.hero, primaryCta: { label: "Go", target } } }, kitFor("warm_utility"));
      expect(html).not.toMatch(/href="(javascript|data):/);
      expect(html).not.toContain('href="//evil');
      expect(html).not.toContain('href="http://');
      expect(html).not.toContain(`href="${target}"`);
      expect(html).toContain(">Go</span>");
    }
  });
  test("an https target is an external, new-tab link with the hint", () => {
    const spec = hostileSpec("x");
    const html = render({ ...spec, hero: { ...spec.hero, primaryCta: { label: "Docs", target: "https://example.com/a" } } }, kitFor("warm_utility"));
    expect(html).toMatch(/<a [^>]*href="https:\/\/example\.com\/a"[^>]*target="_blank"[^>]*rel="noopener noreferrer"[^>]*>Docs<span[^>]*> \(opens in new tab\)<\/span><\/a>/);
  });
});

describe("hostile brand kit values cannot leave a CSS declaration", () => {
  const kit = kitFor("editorial");
  const evil = "#ffffff;}</style><script>alert(1)</script><style>";
  const hostile = {
    ...kit,
    palette: Object.fromEntries(Object.entries(kit.palette).map(([role, c]) => [role, { ...c, hex: evil }])),
    visualSystem: { ...kit.visualSystem, direction: "x\" onfocus=\"alert(1)", shape: "} body{", density: "<script>" },
    type: { ...kit.type, pair: "evil_pair" },
  } as unknown as BrandKit;
  const html = render(specWith("editorial"), hostile);
  const css = /<style>([\s\S]*?)<\/style>/.exec(html)?.[1] ?? "";
  test("the stylesheet holds only safe characters and neutral colours", () => {
    expect(css.length).toBeGreaterThan(50);
    expect(css).toMatch(/^[#a-zA-Z0-9{}:;(),.\-\s]*$/);
    expect(html).not.toContain("<script");
    expect(html.match(/<style/g)?.length).toBe(1);
    expect(css).not.toContain("alert");
  });
  test("direction, shape, density and pair fall back to closed-list values", () => {
    expect(html).toContain('data-direction="warm_utility"');
    expect(html).toContain('data-shape="soft"');
    expect(html).toContain('data-density="balanced"');
  });
});

describe("a layout the direction does not allow is drawn as its first allowed one", () => {
  test("bold_geometric with a split_media hero requested as product_frame", () => {
    const html = render(specWith("bold_geometric", { hero: "product_frame", footer: "minimal" }), kitFor("bold_geometric"));
    expect(html).toContain('data-layout="type_led"');
    expect(html).not.toContain('data-layout="product_frame"');
    expect(html).not.toContain('data-layout="minimal"');
  });
});

describe("proof slots are never rendered", () => {
  test("placeholder slots on the stored spec stay out of the page", () => {
    const spec: LandingSpec = { ...specWith("warm_utility"), proofSlots: [...DEFAULT_PROOF_SLOTS] };
    const html = render(spec, kitFor("warm_utility"));
    for (const text of ["[Quote from an early user]", "[Name, role]", "[N]", "people on the waitlist", "[Partner or community name]", "logo"]) {
      expect(html, text).not.toContain(text);
    }
    expect(html).toBe(render(specWith("warm_utility"), kitFor("warm_utility")));
  });
});

describe("platform text is not model-controlled", () => {
  const PLATFORM = [PLATFORM_TEXT.skipLink, PLATFORM_TEXT.promisesHeading, PLATFORM_TEXT.waitlistPrivacy, PLATFORM_TEXT.waitlistPrivacyLink, PLATFORM_TEXT.badge, PLATFORM_TEXT.opensInNewTab.trim()];
  const escape = (text: string) => text.replace(/&/g, "&amp;");

  test.each(["Privacy: we sell your data", "Made with Evil Corp", "Skip nothing", "© 1999 Somebody"])("model text %s changes none of it", (text) => {
    const html = render(hostileSpec(text), kitFor("warm_utility"));
    for (const line of PLATFORM) expect(html, line).toContain(escape(line));
    expect(html.split(`href="${PLATFORM_TEXT.badgeHref}"`).length - 1).toBe(1);
    expect(html.split(`href="${PLATFORM_TEXT.waitlistPrivacyHref}"`).length - 1).toBe(1);
  });
  test("the year is the platform's, the name the founder's", () => {
    const spec = specWith("warm_utility");
    const html = renderToStaticMarkup(<TenantSite spec={{ ...spec, footer: { ...spec.footer, copyrightName: "2001 Acme" } }} kit={kitFor("warm_utility")} platform={{ year: 2031 }} />);
    expect(html).toContain("© 2031 2001 Acme");
  });
  test("no platform string is read from the spec: a spec with every text field emptied renders the same platform text", () => {
    const html = render(hostileSpec(""), kitFor("warm_utility"));
    for (const line of PLATFORM) expect(html, line).toContain(escape(line));
  });
});
