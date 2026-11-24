/**
 * WP74 wizard copy and answer summaries, shared by the `/start` UI and the
 * Convex wizard (founder-signal `before` / `after` strings and the
 * `answers.signals` notes). Pure: no Convex or React imports, relative imports
 * only so the Convex bundler can load it.
 */
import type { CommercialModel, GoalKind } from "../contracts/roster";
import {
  WIZARD_LIMITS,
  type GoalTimeframe,
  type PartnerPersonality,
  type PlatformKind,
  type WizardAnswersProgress,
  type WizardStep,
} from "../contracts/wizard";

export const STEP_TITLES = {
  idea: "Your idea",
  blueprint: "Blueprint",
  platform: "Platform",
  commercial_model: "Commercial model",
  goal: "Goal",
  name: "Name",
  partner_personality: "Partner personality",
  partner_name: "Partner name",
} as const satisfies Record<WizardStep, string>;

/** Lower-case nouns for the signal notes ("Changed goal: …"). */
const STEP_NOUNS = {
  idea: "idea",
  blueprint: "blueprint",
  platform: "platform",
  commercial_model: "commercial model",
  goal: "goal",
  name: "name",
  partner_personality: "partner personality",
  partner_name: "partner name",
} as const satisfies Record<WizardStep, string>;

export const PLATFORM_OPTIONS = {
  native: { label: "iOS and Android app", hint: "App-store apps. Review queues add days, not hours." },
  web: { label: "Mobile web, installable", hint: "Works on any phone and adds to the home screen. Ships this weekend." },
  custom: { label: "Something else", hint: "Desktop tool, browser extension, API. Tell me." },
} as const satisfies Record<PlatformKind, { label: string; hint: string }>;

export const COMMERCIAL_MODEL_OPTIONS = {
  free: { label: "Free for now", hint: "Grow a waitlist and real users first. No payments to set up." },
  freemium: { label: "Freemium", hint: "A free core, with paid extras." },
  subscription: { label: "Subscription", hint: "A monthly plan from day one. Adds checkout to the launch." },
  one_time: { label: "One-time price", hint: "People pay once." },
} as const satisfies Record<CommercialModel, { label: string; hint: string }>;

/**
 * Step 5 options. Each hint says what the crew builds for that goal, in the
 * roster's terms (`landingReason` / `emailReason` in `convex/crew/roles.ts`).
 */
export const GOAL_KIND_OPTIONS = {
  waitlist: { label: "First 50 signups", hint: "A site and a waitlist. People ask to hear when it's live." },
  first_sale: { label: "First sale", hint: "A sales page that takes a real order or pre-order." },
  mrr_500: { label: "$500 a month", hint: "A sales page and launch emails, aimed at $500 a month." },
  replace_income: { label: "Replace my income", hint: "A sales page and launch emails, with no set number yet." },
  just_testing: { label: "Test the idea", hint: "A site and a short welcome email. No target." },
} as const satisfies Record<GoalKind, { label: string; hint: string }>;

/**
 * The first wins Step 5 offers (owner decision 1A, 2026-11-24). `mrr_500` and
 * `replace_income` stay valid answers: the step still shows one when it is
 * the suggested or saved answer, so a seed or an earlier answer never vanishes.
 */
export const FIRST_WIN_GOALS = ["waitlist", "first_sale", "just_testing"] as const satisfies readonly GoalKind[];

/** The goals Step 5 lists: the first wins, plus a suggested or saved goal outside them, in `kinds` order. */
export function goalKindsToOffer(kinds: readonly GoalKind[], ...keep: readonly (GoalKind | undefined)[]): GoalKind[] {
  return kinds.filter((kind) => (FIRST_WIN_GOALS as readonly GoalKind[]).includes(kind) || keep.includes(kind));
}

export const GOAL_TIMEFRAME_OPTIONS = {
  weekend: { label: "This weekend" },
  "2w": { label: "In two weeks" },
  "30d": { label: "In 30 days" },
  none: { label: "No deadline" },
} as const satisfies Record<GoalTimeframe, { label: string }>;

export const PARTNER_PERSONALITY_OPTIONS = {
  hustler: { label: "Hustler", hint: "Fast, pushes for the next share and the next signup." },
  strategist: { label: "Strategist", hint: "Calm, explains the why, one priority at a time." },
  creative: { label: "Creative", hint: "Leads with brand, story and content ideas." },
  operator: { label: "Operator", hint: "Checklists, deadlines, nothing slips." },
} as const satisfies Record<PartnerPersonality, { label: string; hint: string }>;

/** Why a name can't be used: it would make a weekendmvp.app address that looks like ours. Shown on Step 6 and at Create. */
export const NAME_RESERVED_MESSAGE = "That name is kept for Weekend MVP's own addresses. Choose a different name.";

/** The optional paid test offered on the goal step (founder's own money, D8). */
export const PAID_PUSH_DAILY_USD = 7;

/**
 * Truncates to at most `max` UTF-16 units (what zod's `.max()` counts) without
 * splitting a surrogate pair, adding an ellipsis when it cuts.
 */
export function truncateText(text: string, max: number, ellipsis = "…"): string {
  if (text.length <= max) return text;
  let out = "";
  for (const point of text) {
    if (out.length + point.length > max - ellipsis.length) break;
    out += point;
  }
  return `${out.trimEnd()}${ellipsis}`;
}

/**
 * A short, single-line summary of one step's answer, or `undefined` when the
 * step is unanswered. Bounded to `WIZARD_LIMITS.signalNote`.
 */
export function summarizeStep(step: WizardStep, answers: WizardAnswersProgress): string | undefined {
  const summary = rawSummary(step, answers);
  return summary === undefined ? undefined : truncateText(summary, WIZARD_LIMITS.signalNote);
}

function rawSummary(step: WizardStep, answers: WizardAnswersProgress): string | undefined {
  switch (step) {
    case "idea": {
      const idea = answers.idea;
      if (!idea) return undefined;
      return idea.source === "library" ? `Library idea: ${idea.ideaSlug}` : `Own idea: ${idea.text}`;
    }
    case "blueprint": {
      const decision = answers.blueprintDecision;
      if (!decision) return undefined;
      if (decision.decision === "looks_good") return "Looks good";
      return decision.notes ? `Rework: ${decision.notes}` : "Rework";
    }
    case "platform": {
      const platform = answers.platform;
      if (!platform) return undefined;
      return platform.kind === "custom" ? `Custom: ${platform.description}` : PLATFORM_OPTIONS[platform.kind].label;
    }
    case "commercial_model":
      return answers.commercialModel ? COMMERCIAL_MODEL_OPTIONS[answers.commercialModel].label : undefined;
    case "goal": {
      const goal = answers.goal;
      if (!goal) return undefined;
      const paid = goal.paidPush ? `, $${goal.paidPush.dailyBudgetUsd}/day paid test` : "";
      return `${GOAL_KIND_OPTIONS[goal.kind].label}, ${GOAL_TIMEFRAME_OPTIONS[goal.timeframe].label.toLowerCase()}${paid}`;
    }
    case "name":
      return answers.name?.chosen;
    case "partner_personality":
      return answers.partnerPersonality ? PARTNER_PERSONALITY_OPTIONS[answers.partnerPersonality].label : undefined;
    case "partner_name":
      return answers.partnerName?.name;
  }
}

export type FounderSignalAction = "kept" | "changed" | "skipped" | "rewrote";

/** How a blueprint approved after rework notes is recorded, so the crew still reads the notes. */
export const BLUEPRINT_NOTES_PREFIX = "Approved blueprint with notes: ";

/** The `after` summary (and signal note) for a blueprint approved with the founder's notes. */
export function blueprintNotesSummary(notes: string): string {
  return truncateText(`${BLUEPRINT_NOTES_PREFIX}${notes}`, WIZARD_LIMITS.signalNote);
}

/**
 * The founder's rework notes this session still carries: the saved rework
 * decision's notes, else the notes an earlier "Looks good" already folded into
 * the blueprint signal (so Back and "Looks good" again keeps them). Null when
 * there are none.
 */
export function carriedBlueprintNotes(answers: Pick<WizardAnswersProgress, "blueprintDecision" | "signals">): string | null {
  const decision = answers.blueprintDecision;
  if (decision?.decision === "rework") {
    const notes = decision.notes?.trim();
    return notes ? notes : null;
  }
  const note = answers.signals?.blueprint?.note;
  if (note?.startsWith(BLUEPRINT_NOTES_PREFIX)) {
    const notes = note.slice(BLUEPRINT_NOTES_PREFIX.length).trim();
    return notes ? notes : null;
  }
  return null;
}

/**
 * The `answers.signals` note for one decision, in the canvas's words
 * ("Approved suggested platform: …", "Changed goal: A → B"). Single-line and
 * bounded to `WIZARD_LIMITS.signalNote`.
 */
export function signalNote(
  step: WizardStep,
  action: FounderSignalAction,
  before: string | undefined,
  after: string | undefined,
): string {
  // A blueprint approved with notes reads as itself: the notes are the point, not "Looks good → …".
  if (step === "blueprint" && after?.startsWith(BLUEPRINT_NOTES_PREFIX)) return truncateText(after, WIZARD_LIMITS.signalNote);
  const noun = STEP_NOUNS[step];
  const chosen = after ?? "no answer";
  const note =
    action === "kept"
      ? `Approved suggested ${noun}: ${chosen}`
      : action === "skipped"
        ? `Skipped; used the suggested ${noun}: ${chosen}`
        : `${action === "rewrote" ? "Rewrote" : "Changed"} ${noun}: ${before ?? "none"} → ${chosen}`;
  return truncateText(note, WIZARD_LIMITS.signalNote);
}
