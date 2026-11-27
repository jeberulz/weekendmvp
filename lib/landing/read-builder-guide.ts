import { join } from "node:path";
import { createReader } from "@keystatic/core/reader";
import { landingContentDirectory, landingEditorConfig } from "@/keystatic.config";
import { isOfferEnabled } from "@/lib/guides/offer-live";
import { offerById, type Offer } from "@/lib/guides/offers";
import { slotName } from "@/lib/guides/slots";
import { guideSpecSchema, type GuideSpec } from "@/lib/guides/spec-schema";
import { BUILDER_DATE_MODIFIED, BUILDER_DATE_PUBLISHED } from "@/app/(marketing)/guides/5-to-9-builder/dates";
import { guideRuntime } from "@/app/(marketing)/guides/5-to-9-builder/guide.spec";

const singletonName = "guide-5-to-9-builder";

function reader(root: string) {
  return createReader(join(root, landingContentDirectory), landingEditorConfig("local")).singletons[singletonName];
}

type BuilderEntry = Awaited<ReturnType<ReturnType<typeof reader>["readOrThrow"]>>;
type SectionBlock = BuilderEntry["sections"][number];
export type SectionKind = SectionBlock["discriminant"];
export type OfferCopy = Pick<Offer, "title" | "eyebrow" | "promise" | "linkLabel">;

const anchors: Record<SectionKind, string> = {
  method: "s02", skills: "s03", catch: "s04", roles: "s05", plan: "s06",
  ideaBank: "s07", firstSale: "s08", selfCheck: "s09", prompt: "s10", faq: "s11",
};

function assertUnique(values: readonly string[], name: string) {
  if (new Set(values.map((value) => value.trim())).size !== values.length) {
    throw new Error(`Builder guide requires unique ${name}`);
  }
}

function requireToken(value: string, token: string) {
  if (value.split(token).length !== 2) throw new Error(`Builder guide requires ${token} exactly once in its field`);
}

export function mapBuilderGuide(entry: BuilderEntry, sprintOn = isOfferEnabled(offerById("build-along"))) {
  const sectionOrder = entry.sections.map((block) => block.discriminant);
  assertUnique(sectionOrder, "gated sections");
  if (sectionOrder.length !== Object.keys(anchors).length) throw new Error("Builder guide requires all ten gated sections");

  function section<Kind extends SectionKind>(kind: Kind): Extract<SectionBlock, { discriminant: Kind }> {
    const block = entry.sections.find((item): item is Extract<SectionBlock, { discriminant: Kind }> => item.discriminant === kind);
    if (!block) throw new Error(`Builder guide section missing: ${kind}`);
    return block;
  }

  const steps = section("method").value.steps;
  assertUnique(steps.map((step) => step.discriminant), "step types");
  const prove = steps.find((step) => step.discriminant === "prove");
  if (!prove || steps.length !== 5) throw new Error("Builder guide requires all five steps");

  const skills = section("skills").value.skills;
  const topics = section("catch").value.topics;
  const { labels, roles } = section("roles").value;
  const weeks = section("plan").value.weeks;
  const selfCheck = section("selfCheck").value;
  const faq = section("faq").value;
  const ideaBank = section("ideaBank").value;
  const sale = section("firstSale").value;
  const prompt = section("prompt").value;
  const roleLabels = [labels.headStart, labels.gap, labels.leanOn];
  const selfCheckItems = Array.from({ length: 18 }, (_, index) => selfCheck.items[`item${index + 1}`]);
  assertUnique(steps.map((step) => step.value.name), "step names");
  assertUnique(skills.map((skill) => skill.name), "skill names");
  assertUnique(roles.map((role) => role.name), "role names");
  assertUnique(roleLabels, "role labels");
  assertUnique(topics.map((topic) => topic.name), "topic headings");
  assertUnique(faq.questions.map((item) => item.question), "FAQ questions");
  requireToken(ideaBank.summary, "{ideaCount}");
  requireToken(ideaBank.introduction, "{ideaCount}");
  if (!faq.questions.some(({ answer }) => answer.includes("{ideaCount}"))) {
    throw new Error("Builder guide requires the {ideaCount} token in a FAQ answer");
  }
  requireToken(prompt.founderBody, "{founderIntro}");
  requireToken(prompt.founderBody, "{founderLink}");
  for (const card of Object.values(entry.cards)) requireToken(card.promise, "{price}");

  const sectionDefs = [
    { id: "s01", title: entry.opening.title, summary: entry.opening.summary },
    ...entry.sections.map(({ discriminant, value }) => ({
      id: anchors[discriminant],
      title: value.title,
      summary: value.summary,
    })),
  ];
  assertUnique(sectionDefs.map((item) => item.title), "section titles");
  const first = sectionDefs[1];
  const spec: GuideSpec = guideSpecSchema.parse({
    ...guideRuntime,
    datePublished: BUILDER_DATE_PUBLISHED,
    dateModified: BUILDER_DATE_MODIFIED,
    metaTitle: entry.seoTitle,
    description: entry.seoDescription,
    sections: sectionDefs,
    hero: {
      ...entry.hero, image: guideRuntime.heroImage,
      meta: entry.hero.meta.map(({ value, label }) => [value, label]),
    },
    contents: { heading: entry.contentsHeading },
    gate: {
      ...guideRuntime.gate,
      heading: entry.gate.heading, body: entry.gate.body,
      nextHref: `#${first.id}`, nextLabel: `Start with 02 · ${first.title} ↓`,
    },
    steps: steps.map(({ value }) => value.name),
    stepPullQuotes: { [prove.value.name]: guideRuntime.proofQuote },
    skills: skills.map(({ name }) => name),
    roles: { names: roles.map(({ name }) => name), labels: roleLabels },
    weeks: weeks.map(({ summary }, index) => [index + 1, summary]),
    faq: faq.questions.map(({ question }) => question),
  });

  function resolveSectionReferences(text: string) {
    return text.replace(/\{section:([a-zA-Z]+)\}/g, (_, kind: string) => {
      const index = sectionOrder.findIndex((value) => value === kind);
      if (index < 0) throw new Error(`Builder guide has an unknown section reference: ${kind}`);
      return String(index + 2);
    });
  }

  // Fixed slot names are for this guide's section renderers. Shared blocks
  // keep their existing slot contract, with titles and their text mapped together.
  const deck: Record<string, string> = {
    "The Shift · Lede": entry.opening.lede,
    "The Shift · Validation paragraph": entry.opening.validation,
    "The Shift · Your expertise": entry.opening.expertise,
    "The Shift · Definition": entry.opening.definition,
    "The Shift · Honest catch": entry.opening.honestCatch,
    "The Method · Lede": section("method").value.lede,
    "The Method · Honest catch": section("method").value.honestCatch,
    "The 6 Skills · Lede": section("skills").value.lede,
    "The 6 Skills · Honest catch": section("skills").value.honestCatch,
    "The Catch · Lede": section("catch").value.lede,
    "Where You're Starting From · Lede": section("roles").value.lede,
    "Where You're Starting From · Honest catch": section("roles").value.honestCatch,
    "The 30-Day Plan · Lede": section("plan").value.lede,
    "The 30-Day Plan · Honest catch": section("plan").value.honestCatch,
    "The Idea Bank · How to use the library": ideaBank.introduction,
    "Repair Estimate Translator · Worked validation": ideaBank.workedValidation,
    "The Idea Bank · Honest catch": ideaBank.honestCatch,
    "The First Sale · Lede": sale.lede,
    "The offer": sale.offer,
    "The price": sale.price,
    "The ask": sale.ask,
    "First-sale scripts": sale.scripts,
    "The First Sale · When nobody buys": guideRuntime.noSaleLine + "\n\n" + sale.noSaleAdvice,
    "The First Sale · Honest catch": sale.honestCatch,
    "Self-Check · Lede": selfCheck.lede,
    "Self-Check · Honest catch": selfCheck.honestCatch,
    "The Prompt · Lede": prompt.lede,
    "The Prompt · Prompt text": prompt.prompt,
    "The Prompt · Honest catch": prompt.honestCatch,
    [slotName.founderBody]: prompt.founderBody
      .replace("{founderIntro}", sprintOn ? guideRuntime.sprintIntro : "")
      .replace("{founderLink}", sprintOn ? guideRuntime.sprintLink : ""),
    [guideRuntime.gate.finePrintSlot]: entry.gate.finePrint,
    "Sign-off · Follow destination": `Follow ${faq.followLabel} on Instagram: ${guideRuntime.followUrl}`,
  };
  function add(slot: string, value: string) {
    if (Object.hasOwn(deck, slot)) throw new Error(`Builder guide has conflicting copy slot: ${slot}`);
    deck[slot] = value;
  }

  for (const { value } of steps) {
    add(slotName.stepReasoning(value.name), value.reasoning);
    add(slotName.stepMistakes(value.name), value.mistakes);
    add(slotName.stepExample(value.name), value.example);
  }
  for (const skill of skills) {
    add(slotName.skillExplanation(skill.name), skill.explanation);
    add(slotName.skillReadiness(skill.name), skill.readiness);
  }
  for (const topic of topics) add(topic.name, topic.body);
  for (const role of roles) {
    add(slotName.role(role.name, labels.headStart), role.headStart);
    add(slotName.role(role.name, labels.gap), role.gap);
    add(slotName.role(role.name, labels.leanOn), role.leanOn);
  }
  weeks.forEach(({ proof }, index) => add(slotName.weekProof(index + 1), proof));
  selfCheckItems.forEach((item, index) => add(slotName.selfCheckItem(index + 1), item));
  for (const { question, answer } of faq.questions) add(slotName.faq(question), answer);

  for (const [slot, value] of Object.entries(deck)) deck[slot] = resolveSectionReferences(value);
  return { spec, deck, selfCheckItems, sectionOrder, catchTopics: topics.map(({ name }) => name), followLabel: faq.followLabel, cards: entry.cards };
}

export async function readBuilderGuide(root = process.cwd()) {
  return mapBuilderGuide(await reader(root).readOrThrow());
}

export type BuilderGuide = Awaited<ReturnType<typeof readBuilderGuide>>;
