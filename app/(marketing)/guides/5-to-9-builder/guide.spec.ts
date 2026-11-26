import { BUILD_ALONG } from "@/lib/live/config";

import type { GuideSpec } from "../_shared/types";

/** Display price for the sprint cards. Tied to the live standard ticket, not a one-off string. */
export const BUILD_ALONG_PRICE = `$${BUILD_ALONG.standardUsd}`;

const TITLE = "The 5-to-9 Builder";
const HEADLINE = "AI made building free. Knowing what to build is the job now.";
const DESCRIPTION =
  "AI made building free. Knowing what to build is the job now. A free guide for 9-to-5ers: find an idea worth your evenings and prove someone will pay for it before you build it.";

/** Data for the 5-to-9 Builder guide. Prose lives in `guideCopy.ts`, layout in `../_shared`. */
export const guideSpec: GuideSpec = {
  slug: "5-to-9-builder",
  path: "/guides/5-to-9-builder",
  title: TITLE,
  headline: HEADLINE,
  description: DESCRIPTION,
  metaTitle: `${TITLE} — Turn Your 9-to-5 Expertise Into a Tested Side Income | WeekendMVP`,
  ogImagePath: "/image/5-to-9-builder-og.png",
  lang: "en-GB",
  authorName: "John Iseghohi",
  utmCampaign: "5-to-9-builder",
  checklistKey: "5-to-9-builder-checklist",
  promptFileName: "validate-my-idea.txt",
  sections: [
    { id: "s01", title: "The Shift", summary: "Building is free now; validation is the scarce skill." },
    { id: "s02", title: "The Method", summary: "The 5 steps: Find it, Who pays?, Pick it, Prove it, Sell it." },
    { id: "s03", title: "The 6 Skills", summary: "Each ends with a “You're ready when…” test." },
    { id: "s04", title: "The Catch", summary: "Most ideas won't work. Time is the real constraint." },
    { id: "s05", title: "Where You're Starting From", summary: "Designer, developer, ops & marketing, non-technical." },
    { id: "s06", title: "The 30-Day Plan", summary: "Four weeks, each ending with a shipped proof." },
    { id: "s07", title: "The Idea Bank", summary: (count: number) => `How to use ${count} researched ideas, with one worked validation.` },
    { id: "s08", title: "The First Sale", summary: "The offer, the price, the ask. Scripts included." },
    { id: "s09", title: "Self-Check", summary: "A 15–20 item checklist that saves on your device." },
    { id: "s10", title: "The Prompt", summary: "A “validate my idea” prompt for Claude or Grok." },
    { id: "s11", title: "FAQ", summary: "Five common questions." },
  ],
  hero: {
    eyebrow: "Free guide · WeekendMVP",
    lede: "Turn your 9-to-5 expertise into a tested side income: one tested idea, then one first sale.",
    meta: [
      ["Free", "guide"],
      ["5 steps", "to a tested idea"],
      ["1", "first sale"],
      ["30 days", ""],
    ],
    metaLabel: "Free guide · 5 steps to a tested idea · 1 first sale · 30 days",
    ctaLabel: "Start reading",
    lockedNote: "Section 1 is open. One email opens the rest.",
    subscribedNote: "The whole guide is open on this device.",
    image: {
      src: "/image/john-portrait.webp",
      alt: "John Iseghohi, founder of WeekendMVP, working at his desk",
      width: 1000,
      height: 1250,
      sizes: "(min-width: 1024px) 458px, 100vw",
    },
  },
  contents: { heading: "Eleven sections. One tested idea at the end." },
  gate: {
    mode: "after-section-1",
    stubEyebrow: "Free · Sections 02–11",
    stubNote: "One email · No download",
    heading: "The rest of the guide is free. One email opens it.",
    body: "It opens right here, on this page. The same email starts the 5-to-9 Starter: five daily emails, one action a day.",
    unlocks: ["The Method", "The 6 Skills", "The Catch", "30-Day Plan", "Idea Bank", "First Sale", "Self-Check", "The prompt"],
    nextHref: "#s02",
    nextLabel: "Start with 02 · The Method ↓",
    finePrintSlot: "Gate · Fine print",
  },
  steps: ["Find it", "Who pays?", "Pick it", "Prove it", "Sell it"],
  stepPullQuotes: { "Prove it": "Ten minutes of proof beats ten weeks of building." },
  skills: [
    "Spot problems in your own week",
    "The 3-person test",
    "The 10-minute scorecard",
    "The proof test",
    "The first offer",
    "Pricing and the honest catch",
  ],
  roles: {
    names: ["Designer", "Developer", "Ops & marketing", "Non-technical"],
    labels: ["Head start", "Gap", "Lean on"],
  },
  weeks: [
    [1, "Find it, test it on 3 people."],
    [2, "Scorecard, pick one."],
    [3, "Proof test."],
    [4, "First offer, first sale."],
  ],
  faq: [
    "Who is this for?",
    "I have no idea yet. Where do I start?",
    "Do I need to code?",
    "What if nobody buys?",
    "What does the 5-day email add?",
  ],
  founderName: "John Iseghohi",
};
