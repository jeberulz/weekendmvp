/**
 * Copy slot naming convention for guides (WP103). One source of truth, used by the shared
 * blocks (`app/(marketing)/guides/_shared/blocks.tsx`) and by the audit (`audit.ts`).
 *
 * No imports, so plain Node can load it (`audit:guide` runs with type stripping and no `@/` alias).
 */

export const slotName = {
  lede: (section: string) => `${section} · Lede`,
  honestCatch: (section: string) => `${section} · Honest catch`,
  stepReasoning: (step: string) => `${step} · Reasoning`,
  stepMistakes: (step: string) => `${step} · Common mistakes`,
  stepExample: (step: string) => `${step} · Worked example`,
  skillExplanation: (skill: string) => `${skill} · Explanation`,
  skillReadiness: (skill: string) => `${skill} · Readiness test`,
  role: (role: string, label: string) => `${role} · ${label}`,
  weekProof: (week: number) => `Week ${week} · Shipped proof`,
  faq: (question: string) => `FAQ · ${question}`,
  founderBody: "Founder note · Body",
  selfCheckItem: (item: number) => `Self-Check · Item ${item}`,
} as const;

export type SlotSource = {
  steps: readonly string[];
  skills: readonly string[];
  roles: { names: readonly string[]; labels: readonly string[] };
  weeks: readonly (readonly [number, string])[];
  faq: readonly string[];
  gate: { finePrintSlot: string };
};

/** Every slot the shared blocks will read for this spec. Guide-specific sections add their own. */
export function requiredSlots(spec: SlotSource): string[] {
  const slots: string[] = [];
  for (const step of spec.steps) {
    slots.push(slotName.stepReasoning(step), slotName.stepMistakes(step), slotName.stepExample(step));
  }
  for (const skill of spec.skills) {
    slots.push(slotName.skillExplanation(skill), slotName.skillReadiness(skill));
  }
  for (const role of spec.roles.names) {
    for (const label of spec.roles.labels) slots.push(slotName.role(role, label));
  }
  for (const [week] of spec.weeks) slots.push(slotName.weekProof(week));
  for (const question of spec.faq) slots.push(slotName.faq(question));
  slots.push(slotName.founderBody, spec.gate.finePrintSlot);
  return slots;
}
