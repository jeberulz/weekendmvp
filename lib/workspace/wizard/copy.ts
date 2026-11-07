/**
 * L1 UI fidelity: the wizard's step heads (the question as the h1, with an
 * italic tail, plus a sub line), the short progress labels, the persona voice
 * examples and the partner-name hints. Pure copy, shared by the `/start` UI
 * and its tests. D10: eight steps, no SMS.
 */
import type { PartnerNamePreset, PartnerPersonality, WizardStep } from "../contracts/wizard";

export type StepHead = {
  /** Text before the italic tail (keeps its trailing space). */
  readonly before: string;
  /** The italic key word or phrase. */
  readonly italic: string;
  /** Text after the italic tail (punctuation). */
  readonly after: string;
  /** The sub line under the h1. */
  readonly sub: string;
};

export const STEP_HEADS = {
  idea: {
    before: "What are we ",
    italic: "building",
    after: "?",
    sub: "One sentence is plenty. I'll suggest everything else.",
  },
  blueprint: {
    before: "Here's how I'd ",
    italic: "build",
    after: " it.",
    sub: "Skim it. If something's off, tell me and I'll rework it right here.",
  },
  platform: {
    before: "Where should it ",
    italic: "live",
    after: " first?",
    sub: "Pick what you can ship this weekend. Native apps can come later.",
  },
  commercial_model: {
    before: "How will it ",
    italic: "make money",
    after: "?",
    sub: "Free for now keeps checkout out of launch weekend. Switch anytime.",
  },
  goal: {
    before: "What's the ",
    italic: "first",
    after: " win?",
    sub: "One number every launch task aims at.",
  },
  name: {
    before: "What do we ",
    italic: "call",
    after: " it?",
    sub: "A name is pre-selected. Alternatives are there if you want them.",
  },
  partner_personality: {
    before: "How should your co-founder ",
    italic: "work",
    after: "?",
    sub: "This sets the tone and how often I nudge you.",
  },
  partner_name: {
    before: "Name your ",
    italic: "co-founder",
    after: ".",
    sub: "Pick one or type your own.",
  },
} as const satisfies Record<WizardStep, StepHead>;

/** The step's question as plain text (the h1's text content). */
export function stepHeadText(step: WizardStep): string {
  const head = STEP_HEADS[step];
  return `${head.before}${head.italic}${head.after}`;
}

/** Short labels under the eight progress segments. */
export const STEP_SHORT_LABELS = {
  idea: "Idea",
  blueprint: "Blueprint",
  platform: "Platform",
  commercial_model: "Model",
  goal: "Goal",
  name: "Name",
  partner_personality: "Personality",
  partner_name: "Lead name",
} as const satisfies Record<WizardStep, string>;

/**
 * "How I'll sound · example": generic lines, labelled as examples. They name
 * no business, number or date, so nothing here can be mistaken for a fact.
 */
export const PERSONA_SAMPLES = {
  hustler: "Your brand kit is ready. Approve it tonight and I'll get the emails moving.",
  strategist: "Today's one priority: approve the brand kit, so your emails and posts can use it.",
  creative: "I drafted a few hero lines. Want to pick the voice together?",
  operator: "Next up: brand kit approval. Then the emails, then the posts.",
} as const satisfies Record<PartnerPersonality, string>;

export const PARTNER_NAME_HINTS = {
  Wren: "Small bird, big range.",
  Juno: "Steady and direct.",
  Ridge: "Grounded and calm.",
} as const satisfies Record<PartnerNamePreset, string>;

export const RENAME_RISK_HEADLINE = "Renaming later costs links.";
export const RENAME_RISK_BODY = "Pick now; the site, email and brand kit use it.";
export const WEB_ADDRESS_NOTE = "Your web address is confirmed when you publish.";
