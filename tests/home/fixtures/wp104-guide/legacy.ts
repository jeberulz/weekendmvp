import { guideSpecSchema } from "@/lib/guides/spec-schema";
import legacy from "./legacy-inputs.json";

export const guideCopy = legacy.deck;
export const guideSpec = guideSpecSchema.parse({
  ...legacy.spec,
  sections: legacy.spec.sections.map((section) => section.id === "s07"
    ? { ...section, summary: (count: number) => section.summary.replace("{ideaCount}", String(count)) }
    : section),
});
