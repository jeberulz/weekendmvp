// Data only, no value imports: `npm run audit:guide` loads this file under plain Node.
import type { GuideSpec } from "../_shared/types";

const TITLE = "Mastering Claude Code";
const HEADLINE = "Claude Code builds what you can specify. Checking it is still your job.";
const DESCRIPTION =
  "A plain routine for building with Claude Code: write the rules, plan first, build in small checked steps, and review before you ship. A free guide for solo builders.";

/** Data for the Claude Code guide. Prose lives in `guideCopy.ts`, layout in `../_shared`. */
export const guideSpec: GuideSpec = {
  slug: "claude-code-mastery",
  path: "/guides/claude-code-mastery",
  title: TITLE,
  headline: HEADLINE,
  description: DESCRIPTION,
  metaTitle: `${TITLE} — A Plain Routine for Solo Builders | WeekendMVP`,
  ogImagePath: "/image/claude-code-mastery-og.png",
  lang: "en-GB",
  authorName: "John Iseghohi",
  utmCampaign: "claude-code-mastery",
  checklistKey: "claude-code-mastery-checklist",
  promptFileName: "CLAUDE.md",
  sections: [
    { id: "s01", title: "The Shift", summary: "Typing is no longer the bottleneck. Specifying and checking are." },
    { id: "s02", title: "The Ladder", summary: "Five rungs: rules, plan, small steps, tools, review." },
    { id: "s03", title: "The 6 Skills", summary: "Each ends with a test you can run." },
    { id: "s04", title: "The Catch", summary: "Where Claude Code goes wrong, and what stays your job." },
    { id: "s05", title: "Where You're Starting From", summary: "Non-technical founder, designer, developer, ops and marketing." },
    { id: "s06", title: "The 30-Day Plan", summary: "Four weeks, each ending with a shipped proof." },
    { id: "s07", title: "What I Built", summary: "The product this routine was run on." },
    { id: "s08", title: "Self-Check", summary: "A checklist that saves on your device." },
    { id: "s09", title: "The Starter Rules File", summary: "A CLAUDE.md you can copy and fill in." },
    { id: "s10", title: "FAQ", summary: "Five common questions." },
  ],
  hero: {
    eyebrow: "Free guide · WeekendMVP",
    lede: "A plain routine for building with Claude Code: rules, a plan, small steps and checks.",
    meta: [
      ["Free", "guide"],
      ["5 rungs", "to a routine"],
      ["6 skills", "with tests"],
      ["30 days", ""],
    ],
    metaLabel: "Free guide · 5 rungs to a routine · 6 skills with tests · 30 days",
    ctaLabel: "Start reading",
    lockedNote: "Section 1 is open. One email opens the rest.",
    subscribedNote: "The whole guide is open on this device.",
    image: {
      src: "/image/john-portrait.webp",
      alt: "John Iseghohi, founder of WeekendMVP, working at his desk",
      width: 1000,
      height: 1250,
      sizes: "(min-width: 1024px) 458px, 100vw",
      assetStatus: "approved",
    },
  },
  contents: { heading: "Ten sections. One routine you can run." },
  gate: {
    mode: "after-section-1",
    stubEyebrow: "Free · Sections 02–10",
    stubNote: "One email · No download",
    heading: "The rest of the guide is free. One email opens it.",
    body: "It opens right here, on this page.",
    unlocks: ["The Ladder", "The 6 Skills", "The Catch", "30-Day Plan", "What I Built", "Self-Check", "The rules file"],
    nextHref: "#s02",
    nextLabel: "Start with 02 · The Ladder ↓",
    finePrintSlot: "Gate · Fine print",
  },
  steps: ["Set the rules", "Plan before you build", "Build in small checked steps", "Give it tools and skills", "Ship and review"],
  stepPullQuotes: { "Build in small checked steps": "A result you did not check is a guess." },
  skills: [
    "Write a rules file that sticks",
    "Turn a goal into a written plan",
    "Slice work into reviewable steps",
    "Verify, don't trust",
    "Build one reusable skill",
    "Keep each session focused",
  ],
  roles: {
    names: ["Non-technical founder", "Designer", "Developer", "Ops & marketing"],
    labels: ["Head start", "Gap", "Lean on"],
  },
  weeks: [
    [1, "Rules and one small fix."],
    [2, "One planned feature, end to end."],
    [3, "Your first skill and a check loop."],
    [4, "Ship and review."],
  ],
  faq: [
    "Do I need to code?",
    "How is it different from Claude Projects?",
    "Claude Code, Cursor or Lovable?",
    "Is it safe to point it at my repo?",
    "What if it gets stuck?",
  ],
  // A gated guide must list an offer. The Build-Along is the closest fit and is switched off, so its card stays hidden.
  upsells: [{ offer: "build-along", placement: "close" }],
  founderName: "John Iseghohi",
};
