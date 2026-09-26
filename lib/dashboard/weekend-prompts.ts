/**
 * WP44-S9. Which of an idea's prompts belong to which day of the weekend.
 * Saturday builds (setup, core feature, scaffolds). Sunday launches
 * (landing page, branding). Friday and Monday have no prompts.
 */
export type PlanPrompt = { title: string; lines: string[] };

const LAUNCH = /landing|branding|launch|waitlist/i;

export function stagePrompts(prompts: readonly PlanPrompt[]) {
  return {
    sat: prompts.filter((prompt) => !LAUNCH.test(prompt.title)),
    sun: prompts.filter((prompt) => LAUNCH.test(prompt.title)),
  };
}

/** The prompt Home shows for the current stage, if that stage has one. */
export function promptForStage(prompts: readonly PlanPrompt[], stage: string): PlanPrompt | null {
  const byStage = stagePrompts(prompts);
  if (stage === "sat") return byStage.sat[0] ?? null;
  if (stage === "sun") return byStage.sun[0] ?? null;
  return null;
}
