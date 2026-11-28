import { join } from "node:path";
import { createReader } from "@keystatic/core/reader";
import { expect, test } from "vitest";
import { landingEditorConfig } from "@/keystatic.config";
import { mapBuilderGuide, readBuilderGuide } from "@/lib/landing/read-builder-guide";
import { requiredSlots } from "@/lib/guides/slots";
import { buildGuideSchema } from "@/app/(marketing)/guides/_shared/seo";
import legacy from "./fixtures/wp104-guide/legacy-inputs.json";
import jsonLd from "./fixtures/wp104-guide/raw-jsonld-scripts.json";

const fixtureReader = createReader(join(process.cwd(), "tests/home/fixtures/wp104-guide/cms"), landingEditorConfig("local"));
const readFixtureEntry = () => fixtureReader.singletons["guide-5-to-9-builder"].readOrThrow();

test("the migration fixture preserves the original guide inputs and structured data", async () => {
  const guide = mapBuilderGuide(await readFixtureEntry(), false);
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
  const entry = await readFixtureEntry();
  const [method, ...rest] = entry.sections;
  if (method.discriminant !== "method") throw new Error("Expected the original method position");
  const moved = mapBuilderGuide({
    ...entry,
    sections: [
      ...rest.map((block) => block.discriminant === "selfCheck"
        ? { ...block, value: { ...block.value, items: { ...block.value.items, item1: "Read Section {section:method}." } } }
        : block),
      {
        ...method,
        value: {
          ...method.value,
          steps: method.value.steps.map((step) => step.discriminant === "prove"
            ? { ...step, value: { ...step.value, name: "  Test demand  " } }
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
  expect(moved.selfCheckItems[0]).toBe("Read Section 11.");
  expect(moved.deck["Self-Check · Item 1"]).toBe(moved.selfCheckItems[0]);
  expect(moved.deck["Test demand · Worked example"]).toBe(legacy.deck["Prove it · Worked example"]);
  expect(moved.spec.stepPullQuotes["Test demand"]).toBe("Ten minutes of proof beats ten weeks of building.");
});

test("rejects duplicate sections and keeps configuration-controlled values out of the editor", async () => {
  const entry = await readFixtureEntry();
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

test("live content supplies every shared slot and keeps the public opener outside the gate", async () => {
  const guide = await readBuilderGuide();
  expect(requiredSlots(guide.spec).filter((slot) => !guide.deck[slot]?.trim())).toEqual([]);
  expect(guide.spec.sections[0].id).toBe("s01");
  expect(guide.spec.gate).toMatchObject({ mode: "after-section-1", nextHref: `#${guide.spec.sections[1].id}` });
});

test("padded editable names resolve to the same copy slots and quote as their labels", async () => {
  const fixture = await readFixtureEntry();
  const pad = (value: string) => "  " + value + "  ";
  const sections = fixture.sections.map((section) => {
    const title = pad(section.value.title);
    switch (section.discriminant) {
      case "method":
        return { ...section, value: {
          ...section.value, title,
          steps: section.value.steps.map((step) => ({ ...step, value: { ...step.value, name: pad(step.value.name) } })),
        } };
      case "skills":
        return { ...section, value: {
          ...section.value, title,
          skills: section.value.skills.map((skill) => ({ ...skill, name: pad(skill.name) })),
        } };
      case "catch":
        return { ...section, value: {
          ...section.value, title,
          topics: section.value.topics.map((topic) => ({ ...topic, name: pad(topic.name) })),
        } };
      case "roles": {
        const { labels, roles } = section.value;
        return { ...section, value: {
          ...section.value, title,
          roles: roles.map((role) => ({ ...role, name: pad(role.name) })),
          labels: { headStart: pad(labels.headStart), gap: pad(labels.gap), leanOn: pad(labels.leanOn) },
        } };
      }
      case "faq":
        return { ...section, value: {
          ...section.value, title,
          questions: section.value.questions.map((item) => ({ ...item, question: pad(item.question) })),
        } };
      default:
        return section;
    }
  });
  expect(mapBuilderGuide({ ...fixture, sections }, false)).toEqual(mapBuilderGuide(fixture, false));
});
