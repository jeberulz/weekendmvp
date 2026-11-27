import { join } from "node:path";
import { createReader } from "@keystatic/core/reader";
import { landingContentDirectory, landingEditorConfig } from "@/keystatic.config";

function starterReader(root: string) {
  return createReader(join(root, landingContentDirectory), landingEditorConfig("local")).singletons["starter-5-to-9"];
}

export type StarterEntry = Awaited<ReturnType<ReturnType<typeof starterReader>["readOrThrow"]>>;
type Section = StarterEntry["sections"][number];
export type StarterBlock<Kind extends Section["discriminant"]> = Extract<Section, { discriminant: Kind }>["value"];

function validatePriceLabel(label: string) {
  if (label.split("{buildAlongPrice}").length !== 2 || /[$£€]\s*\d/.test(label)) {
    throw new Error("Starter Build-Along links require exactly one {buildAlongPrice} token and no hardcoded price");
  }
}

export function validateStarter(entry: StarterEntry) {
  const kinds = entry.sections.map(({ discriminant }) => discriminant);
  if (kinds.length !== 4 || new Set(kinds).size !== 4) {
    throw new Error("Starter requires one of each page section");
  }
  for (const section of entry.sections) {
    if (section.discriminant === "fiveDays") validatePriceLabel(section.value.buildAlongLabel);
    if (section.discriminant !== "faq") continue;
    for (const question of section.value.questions) {
      if (question.discriminant === "nextSteps") validatePriceLabel(question.value.buildAlongLabel);
    }
  }
  return entry;
}

export async function readStarter(root = process.cwd()) {
  return validateStarter(await starterReader(root).readOrThrow());
}
