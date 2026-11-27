import seed from "@/content/landing-pages/home/index.json";
import type { HomeCopy } from "@/lib/landing/read-home";

// The first-party destinations, icon choices and plan timing stay tied to their slots.
const START_HERE_DESTINATIONS = [
  { key: "browse", href: "/startup-ideas" },
  { key: "dmarc", href: "/ideas/dmarc-monitor-agencies-small-business" },
  { key: "prompts", href: "/ideas/prompt-regression-tests-indie-ai-builders" },
  { key: "kit", href: "/starter-kit" },
  { key: "starter", href: "/5-to-9-starter" },
  { key: "builder", href: "/guides/5-to-9-builder" },
  { key: "audience", href: "/ideas-for/non-technical" },
] as const;

export function startHereLinks(labels: HomeCopy["whatIs"]["startHere"]) {
  return START_HERE_DESTINATIONS.map(({ key, href }) => ({ href, label: labels[key] }));
}

export const WEEKEND_TEST = [
  { key: "feature", icon: "target" },
  { key: "screens", icon: "screens" },
  { key: "tools", icon: "plug" },
  { key: "buyer", icon: "buyer" },
  { key: "prompts", icon: "prompt" },
  { key: "estimate", icon: "clock" },
] as const;

export const WEEKEND_PLAN_SLOTS = [
  { key: "friday", icon: "moon", hours: 2 },
  { key: "saturday", icon: "sun", hours: 6 },
  { key: "sunday", icon: "flag", hours: 4 },
  { key: "monday", icon: "briefcase", hours: 0 },
] as const;

export const KIT_CONTENTS = [
  { key: "demo", icon: "stopwatch" },
  { key: "template", icon: "screens" },
  { key: "scorecard", icon: "target" },
  { key: "plan", icon: "weekend" },
  { key: "checklist", icon: "kit" },
  { key: "prompts", icon: "prompt" },
] as const;

// The project planner uses the same published default without a request-time CMS dependency.
export const WEEKEND_PLAN = WEEKEND_PLAN_SLOTS.map(({ key, icon, hours }) => ({
  icon,
  day: seed.yourWeekend.plan[key].day,
  hours,
  title: seed.yourWeekend.plan[key].title,
  body: seed.yourWeekend.plan[key].body,
}));

// Retain the data exports for callers that consume the published seed directly.
export const FAQS = seed.finalCall.faqs;
export const WHAT_IS = seed.whatIs.intro;
export const START_HERE = startHereLinks(seed.whatIs.startHere);
