// @vitest-environment jsdom

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";

import { GuideCopy, slotText } from "@/app/(marketing)/guides/_shared/copy";
import { navSections } from "@/app/(marketing)/guides/_shared/GuideLayout";
import { buildGuideMetadata, buildGuideSchema } from "@/app/(marketing)/guides/_shared/seo";
import { guideSpec } from "@/app/(marketing)/guides/5-to-9-builder/guide.spec";

vi.mock("@/lib/fonts", () => ({ newsreaderEditorial: { variable: "test-newsreader" } }));

describe("shared guide blocks", () => {
  test("a missing copy slot throws, so a bad guide fails the build", () => {
    expect(() => slotText({ a: "text" }, "b")).toThrow(/missing from the deck: "b"/);
    expect(() => renderToStaticMarkup(createElement(GuideCopy, { deck: {}, slot: "Nope · Lede" }))).toThrow(/Nope · Lede/);
  });

  test("a present slot renders with its data-copy-slot marker and the idea count", () => {
    const html = renderToStaticMarkup(createElement(GuideCopy, { deck: { "X · Lede": "Browse {ideaCount} ideas." }, slot: "X · Lede", ideaCount: 7 }));
    expect(html).toContain('data-copy-slot="X · Lede"');
    expect(html).toContain("Browse 7 ideas.");
    expect(html).toContain('class="guide-lede"');
  });

  test("client components only receive serialisable section data", () => {
    const sections = navSections(guideSpec);
    expect(sections).toHaveLength(guideSpec.sections.length);
    for (const section of sections) expect(Object.keys(section).sort()).toEqual(["id", "title"]);
  });

  test("a gated spec emits paywall markup and an ungated spec does not", () => {
    const article = (spec: typeof guideSpec) =>
      (buildGuideSchema(spec) as { "@graph": Record<string, unknown>[] })["@graph"].find((node) => node["@type"] === "Article")!;
    expect(article(guideSpec)).toMatchObject({ isAccessibleForFree: false, hasPart: { cssSelector: ".guide-rest" } });
    const open = article({ ...guideSpec, gate: { ...guideSpec.gate, mode: "none" } });
    expect(open.isAccessibleForFree).toBe(true);
    expect(open).not.toHaveProperty("hasPart");
  });

  test("metadata comes from the spec", () => {
    const meta = buildGuideMetadata(guideSpec);
    expect(meta.alternates?.canonical).toBe(guideSpec.path);
    expect(meta.title).toEqual({ absolute: guideSpec.metaTitle });
  });
});
