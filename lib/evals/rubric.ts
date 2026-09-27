/**
 * WP41-S4. The judge rubric: six dimensions, each on an anchored 1-5 scale.
 *
 * evals/rubric.md is the human-readable copy. Change both together and bump
 * RUBRIC_VERSION: it is part of every judge cache key, so a rubric change
 * re-scores every page instead of serving stale scores.
 */

export const RUBRIC_VERSION = "rubric-v1";
/** Marker the fixture transport uses to route judge calls. */
export const JUDGE_MARKER = "TASK: JUDGE_PAGE";

export const DIMENSIONS = [
  "specificity",
  "slop",
  "verbosity",
  "fake_data",
  "consistency",
  "actionability",
] as const;
export type Dimension = (typeof DIMENSIONS)[number];

type Anchors = { question: string; 1: string; 3: string; 5: string };

export const RUBRIC: Record<Dimension, Anchors> = {
  specificity: {
    question: "Does the page name real things (competitors, prices, tools, audiences, numbers, steps), or speak in generalities?",
    1: "Generic throughout: 'many businesses struggle', 'various tools exist', no names, no numbers.",
    3: "Some named competitors or figures, but key sections (market, business model) stay vague.",
    5: "Named competitors with prices, named communities and tools, concrete numbers and steps in every section.",
  },
  slop: {
    question: "Does it read like a person who knows the market wrote it, or like stock AI output?",
    1: "Stock AI phrasing ('in today's fast-paced world', 'unlock', 'game-changer'), empty superlatives, listicle rhythm, every paragraph the same shape.",
    3: "Mostly plain, with several stock phrases or padded transitions.",
    5: "Plain, direct, specific voice. No filler phrases, no hype.",
  },
  verbosity: {
    question: "Does every paragraph earn its place, or could the page be cut hard with nothing lost?",
    1: "Could lose 40% or more with no loss: repeated points, restated headings, throat-clearing intros.",
    3: "Some repetition or padding; could lose 15-25%.",
    5: "Tight. Every paragraph adds a new fact, argument or step.",
  },
  fake_data: {
    question: "Do the figures look real and honestly sourced, or invented?",
    1: "Suspiciously precise or round figures with no attribution, invented quotes or testimonials, guesses stated as fact.",
    3: "Most figures attributed or plausible, but some unattributed precise numbers or 'inferred' values presented as data.",
    5: "Figures are attributed to named sources, estimates are labelled as estimates, nothing looks made up.",
  },
  consistency: {
    question: "Do the numbers agree with each other across sections (prices, market size, MRR math, unit economics)?",
    1: "Figures contradict each other: a price in one section differs in another, MRR math does not add up.",
    3: "Minor mismatches or math that is loose but not wrong.",
    5: "Every repeated figure matches and the arithmetic checks out.",
  },
  actionability: {
    question: "Could a builder act on this page this weekend?",
    1: "No clear first step, stack or customer; reads like an essay.",
    3: "Clear idea and stack, but vague on the first customers or first build steps.",
    5: "Clear customer, wedge, stack, pricing and first steps a builder can start on now.",
  },
};

export function renderRubric(): string {
  return DIMENSIONS.map((d) => {
    const r = RUBRIC[d];
    return `${d}: ${r.question}\n  1 = ${r[1]}\n  3 = ${r[3]}\n  5 = ${r[5]}`;
  }).join("\n\n");
}
