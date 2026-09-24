/** Static homepage copy. Live numbers come from `getHomeData()`. */
import type { IconName } from "./icons";

export const WEEKEND_TEST: { icon: IconName; title: string; body: (avgHours: number) => string }[] = [
  { icon: "target", title: "One core feature", body: () => "One job, done well. Everything else waits for version two." },
  { icon: "screens", title: "Three screens", body: () => "A landing page, an input, and an output. That is the whole MVP." },
  { icon: "plug", title: "Built on existing tools", body: () => "Stripe, Supabase, Gmail, and AI APIs do the heavy lifting." },
  { icon: "buyer", title: "A buyer you can name", body: () => "Freelancers, music teachers, Shopify owners. Not everyone." },
  { icon: "prompt", title: "Prompts included", body: () => "Paste them into Cursor, Claude, or Bolt and start building." },
  { icon: "clock", title: "About {hours} hours", body: (h) => `The average idea is estimated at ${h} hours. That is one weekend.` },
];

export const WEEKEND_PLAN: { icon: IconName; day: string; hours: number; title: string; body: string }[] = [
  { icon: "moon", day: "FRIDAY NIGHT", hours: 2, title: "Pick and plan", body: "Pick an idea and read the research. Cut the scope to one core feature." },
  { icon: "sun", day: "SATURDAY", hours: 6, title: "Build the core", body: "Paste the setup prompt. Build the one screen that does the job." },
  { icon: "flag", day: "SUNDAY", hours: 4, title: "Launch it", body: "Add a landing page and a waitlist. Share the link with ten people." },
  { icon: "briefcase", day: "MONDAY", hours: 0, title: "Back at work", body: "With a live product, real feedback, and your job intact." },
];

export const KIT_CONTENTS: { icon: IconName; label: string }[] = [
  { icon: "stopwatch", label: "The 15-second demo test" },
  { icon: "screens", label: "3-screen MVP template" },
  { icon: "target", label: "MVP idea scorecard" },
  { icon: "weekend", label: "48-hour weekend plan" },
  { icon: "kit", label: "Scope-cutting checklist" },
  { icon: "prompt", label: "Copy-paste AI prompts" },
];

export const TICKET_META: [string, string][] = [
  ["FROM", "An idea"],
  ["TO", "A live link"],
  ["DEPARTS", "Friday night"],
  ["ARRIVES", "Sunday"],
  ["INCLUDES", "6 tools"],
];

export const FAQS = [
  {
    question: "Do I need to code?",
    answer: "No. Every idea includes prompts for AI tools like Cursor, Claude, and Lovable.",
  },
  {
    question: "Do I have to quit my job?",
    answer: "No. Most ideas are estimated at 8 to 12 hours. That fits one weekend.",
  },
  {
    question: "Are the ideas free?",
    answer: "Yes. Some pages ask for your email to unlock the full research.",
  },
];

/**
 * Draft founder letter, written from John's public bio (WP42 design review).
 * John is to rewrite it in his own words before this ships.
 */
export const FOUNDER_LETTER = [
  "I started Weekend MVP to close the gap between “I have an idea” and “here’s a live URL.” Most people with a day job don’t lack ideas or talent. They lack a small enough place to start.",
  "So every idea here is researched, sized for a weekend, and paired with prompts for the AI tools you already use. Pick one. Build it on Saturday. Show someone on Sunday.",
];
