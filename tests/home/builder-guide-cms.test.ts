import { join } from "node:path";
import { createReader } from "@keystatic/core/reader";
import { expect, test } from "vitest";
import { landingContentDirectory, landingEditorConfig } from "@/keystatic.config";
import { mapBuilderGuide, readBuilderGuide } from "@/lib/landing/read-builder-guide";
import { buildGuideSchema } from "@/app/(marketing)/guides/_shared/seo";
import legacy from "./fixtures/wp104-guide/legacy-inputs.json";
import jsonLd from "./fixtures/wp104-guide/raw-jsonld-scripts.json";

const reader = createReader(join(process.cwd(), landingContentDirectory), landingEditorConfig("local"));
const readEntry = () => reader.singletons["guide-5-to-9-builder"].readOrThrow();

test("Keystatic reader preserves the original guide inputs and structured data", async () => {
  const guide = await readBuilderGuide();
  const sections = guide.spec.sections.map(({ summary, ...section }) => ({
    ...section,
    summary: typeof summary === "function" ? summary(824).replace("824", "{ideaCount}") : summary,
  }));
  expect({ ...guide.spec, sections }).toEqual(legacy.spec);
  expect(guide.deck).toEqual(legacy.deck);
  expect(guide.selfCheckItems).toEqual(legacy.selfCheckItems);
  expect(buildGuideSchema(guide.spec)).toEqual(JSON.parse(jsonLd[0]));
});

test("moving and renaming blocks preserves anchors, the gate, associated prose and the locked quote", async () => {
  const entry = await readEntry();
  const [method, ...rest] = entry.sections;
  if (method.discriminant !== "method") throw new Error("Expected the original method position");
  const moved = mapBuilderGuide({
    ...entry,
    sections: [
      ...rest,
      {
        ...method,
        value: {
          ...method.value,
          steps: method.value.steps.map((step) => step.discriminant === "prove"
            ? { ...step, value: { ...step.value, name: "Test demand" } }
            : step),
        },
      },
    ],
  }, false);
  expect(moved.spec.sections.map(({ id }) => id)).toEqual([
    "s01", "s03", "s04", "s05", "s06", "s07", "s08", "s09", "s10", "s11", "s02",
  ]);
  expect(moved.spec.gate).toMatchObject({ mode: "after-section-1", nextHref: "#s03", nextLabel: "Start with 02 · The 6 Skills ↓" });
  expect(moved.deck["The Shift · Honest catch"]).toContain("Section 3");
  expect(moved.deck["Test demand · Worked example"]).toBe(legacy.deck["Prove it · Worked example"]);
  expect(moved.spec.stepPullQuotes["Test demand"]).toBe("Ten minutes of proof beats ten weeks of building.");
});

test("rejects duplicate sections and keeps configuration-controlled values out of the editor", async () => {
  const entry = await readEntry();
  expect(() => mapBuilderGuide({ ...entry, sections: [...entry.sections.slice(1), entry.sections[1]] })).toThrow("unique gated sections");
  expect(entry.gate).toEqual({
    heading: legacy.spec.gate.heading, body: legacy.spec.gate.body, finePrint: legacy.deck["Gate · Fine print"],
  });
  expect(entry.hero).not.toHaveProperty("image");
  expect(entry.cards.mid).not.toHaveProperty("url");
  expect(entry.cards.mid).not.toHaveProperty("price");
  expect(entry.cards.mid.promise).toContain("{price}");
  expect(mapBuilderGuide(entry, true).deck["Founder note · Body"]).toContain("[here](/live/build-along). Either way,");
  expect(mapBuilderGuide(entry, false).deck["Founder note · Body"]).toBe(legacy.deck["Founder note · Body"]);
});
