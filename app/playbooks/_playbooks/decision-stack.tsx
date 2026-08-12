/**
 * The Decision Stack — the first playbook.
 *
 * The reframe is Weekend MVP's own, from the ship·able launch sequence
 * (`shipable-launch/03-marketing-content.md`, E3): "The hard part was never
 * the building… The hard part is deciding." The six layers mirror the moves
 * in `shipable-launch/02-ship-sheet-cheatsheet.md`.
 *
 * Voice: direct, builder-to-builder, no hype, slightly contrarian. Promise
 * the deliverable, never an outcome — no income or user-count claims.
 *
 * Every stat carries a `source` naming where the number comes from in this
 * repo. Nothing here is estimated or rounded up for effect.
 */

import type { Playbook } from "@/components/playbooks/types";

export const decisionStack: Playbook = {
  slug: "decision-stack",
  name: "The Decision Stack",

  meta: {
    title:
      "The Decision Stack | The 6 Decisions Between Your Idea and a Live URL",
    description:
      "You don't have a building problem. You have a deciding problem. The Decision Stack is the six-layer framework that takes an idea you've been sitting on and turns it into a URL a stranger can open — in one weekend.",
    keywords:
      "MVP framework, how to scope an MVP, weekend MVP, stop overthinking startup ideas, ship an MVP, idea to live URL, solo founder framework",
  },

  hero: {
    eyebrow: "A Weekend MVP playbook",
    claim: "You don't have a building problem. You have a deciding problem.",
    body: "AI made building cheap. You can describe an app and watch it appear. So why is the idea still in your head? Because nothing in your week forces the six decisions that stand between an idea and a URL someone can open. This is those six decisions, in order.",
    captureHeading: "Get the pack that goes with this",
    captureBody:
      "The full prompt pack, the one-page spec, and the 48-hour checklist — plus a buildable idea in your inbox every morning.",
    buttonLabel: "Send me the pack",
    footnote: "Free. 2 emails a day. Unsubscribe in one click.",
  },

  problem: {
    heading: "Why the idea never leaves your head",
    body: "Most people run the loop on the left. Every step feels like progress, and none of it produces anything a stranger can open. The loop on the right is shorter, and it turns on one node: the decision you keep deferring.",
    brokenLabel: "The stalling loop",
    brokenSteps: [
      "An idea you like",
      "Research it some more",
      "Watch another tutorial",
      "A better idea appears",
      "A half-built folder",
      "Nothing anyone can open",
    ],
    workingLabel: "The shipping loop",
    workingSteps: [
      { label: "An idea you like" },
      { label: "Decide: one person, one screen, one action", emphasis: true },
      { label: "Build it (this is the easy part now)" },
      { label: "A URL a stranger can open" },
      { label: "Send it to 5 people" },
    ],
    feedback: "What they say becomes the next decision",
    caption:
      "Building used to be the bottleneck. Now deciding is — and no tool will do it for you.",
  },

  layers: {
    heading: "The six decisions",
    body: "Think of it as a stack. Each decision rests on the one below it, and skipping one makes everything above it guesswork — which is exactly what a stalled project feels like.",
    items: [
      {
        title: "Person",
        body: "One named type of human. Not \"small businesses\", not \"creators\" — the specific person you could describe to a friend in a sentence. \"For everyone\" is the decision you're avoiding, wearing a disguise.",
      },
      {
        title: "Pain",
        body: "The one annoying thing they do today, and the clumsy way they do it now. If the current workaround is a spreadsheet, a group chat, or forty minutes on a Sunday, you've found it.",
      },
      {
        title: "Proof",
        body: "The single screen that proves someone wants this. Not the dashboard, not the settings page, not accounts. One screen, one action, one output they'd screenshot.",
      },
      {
        title: "Prompt",
        body: "The spec that builds it: who it's for, the one flow, what the screen shows when it's empty and when it's wrong. Vague prompts are what produce four hundred files that don't run.",
      },
      {
        title: "Publish",
        body: "A URL a stranger can open on their phone. Not localhost, not a screenshot, not \"nearly done\". Deployed is a decision, not a milestone you drift into.",
      },
      {
        title: "People",
        body: "The five you send it to within 24 hours, by name, before you polish anything. This is the layer everyone skips, and it's the only one that tells you whether the other five were right.",
      },
    ],
    caption: "Builds from the bottom up. Skip one and the rest is guesswork.",
  },

  outcomes: {
    heading: "What one weekend actually gets you",
    body: "Not a company. Not revenue. Something better than either at this stage: a real answer, and something to point at.",
    inputLabel: "One weekend",
    inputSub: "and one decided idea",
    outputs: [
      "A live URL you can text to someone",
      "A landing page collecting emails",
      "Five people who have actually used it",
      "A real yes or no, instead of a maybe in your head",
      "Something in your portfolio that isn't a mockup",
      "A reason to open the laptop again next weekend",
    ],
    stats: [
      {
        value: "160",
        label: "validated, weekend-scoped ideas in the free library — if the decision you're stuck on is which idea, start there",
        source: "ideas/manifest.json — 160 entries",
      },
      {
        value: "8–10 hrs",
        label: "the build time nearly every one of those ideas is scoped to",
        source:
          "ideas/manifest.json buildTime — 8–10 (61), 10 (50), 8 (25) of 160",
      },
      {
        value: "3",
        label: "screens in a shippable MVP: landing, input, output",
        source:
          "app/(marketing)/starter-kit/_sections.tsx — the 3-screen MVP rule",
      },
      {
        value: "400+",
        label: "builders working through this the same way",
        source:
          "app/(marketing)/about/page.tsx — \"a community of 400+ weekend builders\"",
      },
    ],
  },

  prompts: {
    heading: "Two prompts to run today",
    body: "The stack in miniature. Paste these into whatever you build with — Claude, Cursor, Bolt, Lovable — and you'll feel the difference between a decided idea and a described one.",
    items: [
      {
        filename: "weekend-cut.txt",
        body: `Here is an idea I've been sitting on:
[describe it in a few sentences]

Act as a blunt product editor. Do not encourage me. Do not
suggest features. Cut it down until it fits one weekend:

1. The one person this is for — a specific type, never
   "everyone". If my idea implies several, pick the one who
   feels the pain most often and tell me why.
2. The one painful thing they do today, and the clumsy way
   they do it now.
3. The ONE screen that would prove someone wants this, and
   the single action a user takes on it.
4. The 5 things I clearly want to build that I must NOT
   build this weekend. Name them, so I can't smuggle them
   back in.
5. My one-liner, in this shape:
   "____ that helps ____ do ____ without ____."

End with the single biggest reason this still might not be
worth a weekend.`,
      },
      {
        filename: "three-screen-spec.txt",
        body: `Turn the decided idea below into a build spec I can paste
into an AI builder.

Idea: [paste your one-liner from weekend-cut.txt]
Building with: [Claude Code / Cursor / Bolt / Lovable / v0]

Give me, in this order:

1. ROLE & STACK — one paragraph telling the builder what it
   is building and what to build it with. No alternatives.
2. THE 3 SCREENS — landing (the promise + email capture),
   input (the one action), output (the result). For each:
   what's on it, and nothing else.
3. STATES — what each screen shows while loading, when
   empty, and when the input is wrong. Be specific; this is
   where AI builders invent things.
4. DATA — the smallest shape that supports the one flow.
   No accounts, no payments, no admin.
5. DONE — a numbered checklist I can run through to decide
   the thing is finished and deployable.

Explicitly list what you are NOT building.`,
      },
    ],
  },

  pack: {
    eyebrow: "The pack",
    heading: "Everything above, in a form you can work through",
    body: "The page is the framework. The pack is the version you actually fill in on a Friday night — free, and it lands in your inbox with the confirmation.",
    items: [
      {
        title: "The full prompt pack",
        body: "Ten copy-paste prompts covering all six layers, not just the two on this page — including the ones for unblocking a build that's gone sideways.",
      },
      {
        title: "The one-page spec",
        body: "The template that turns a decided idea into something an AI builder can execute without inventing features you didn't ask for.",
      },
      {
        title: "The 48-hour checklist",
        body: "Friday night to Sunday night, hour by hour — including what to cut when you're running behind, which you will be.",
      },
      {
        title: "The idea scorecard",
        body: "Score an idea against real constraints in ten minutes, so layer one stops being the thing you avoid.",
      },
    ],
    buttonLabel: "Send me the pack",
    footnote: "Free. 2 emails a day. Unsubscribe in one click.",
    unlockedHeading: "You already have access",
    unlockedBody:
      "You're on the list, so the pack is open — it's the Weekend MVP Starter Kit, and it's sitting here waiting for you.",
    unlockedHref: "/starter-kit",
    unlockedHrefLabel: "Open the Starter Kit",
  },

  cta: {
    heading: "The hard part is deciding for your idea",
    body: "Reading the stack is the easy part. The work is applying it to the specific idea you've been carrying around — your person, your one screen, your cut. That's what a Weekend MVP Sprint is: we sit down with your idea, make the six decisions out loud, and you leave with a build plan scoped to a weekend you'll actually finish.",
    buttonLabel: "Book a Weekend MVP Sprint",
    href: "https://cal.com/switchtoux/mvp-sprint",
  },

  howTo: {
    name: "The Decision Stack: from an idea to a live URL in one weekend",
    description:
      "Six decisions that turn an idea you've been sitting on into a deployed MVP a stranger can open — person, pain, proof, prompt, publish, people.",
    totalTime: "P2D",
  },

  faqs: [
    {
      question: "Do I need to be able to code to use the Decision Stack?",
      answer:
        "No. The stack is about decisions, not syntax. Layers four and five assume you're building with an AI tool — Claude, Cursor, Bolt, Lovable or v0 — which is how most Weekend MVP builds happen. If you can write a clear spec and follow a checklist, you can run all six layers.",
    },
    {
      question: "Why only one screen? My idea needs more than that.",
      answer:
        "Almost every idea needs more than one screen eventually. It doesn't need more than one to find out whether anyone wants it. The single screen is the proof, not the product — the second and third screens are a decision you get to make after five real people have used the first one.",
    },
    {
      question: "What if I don't have an idea yet?",
      answer:
        "Then layer one is where you start, and you don't have to start from a blank page. Weekend MVP publishes a library of 160 validated, weekend-scoped ideas with the buyer and build path already worked out. Pick one and run the stack on it.",
    },
    {
      question: "How is this different from just prompting an AI to build my app?",
      answer:
        "Prompting is layer four. It works well when layers one to three are decided and badly when they aren't — a vague prompt is what produces a project that generates for ten minutes and then doesn't run. The stack exists to make the prompt worth writing.",
    },
    {
      question: "Is the pack really free?",
      answer:
        "Yes. The pack is the Weekend MVP Starter Kit, and it's free — the scorecard, the one-page spec, the 48-hour plan, and the prompts. The only thing it costs is an email address.",
    },
  ],
};
