/**
 * Shape of a playbook config.
 *
 * A playbook is a single-page framework microsite: one named, numbered idea
 * presented as a diagram sequence, a couple of copy-paste prompts, and one
 * offer. Everything on the page is data — adding a playbook means adding a
 * config to `app/playbooks/_playbooks/`, never a new page build.
 *
 * Mirrors the hardcoded-TS-config convention already used by the programmatic
 * hubs (`app/solve`, `app/build-with`, `app/ideas-for`).
 */

import type { FaqEntry } from "@/lib/seo";

/** One node in a loop diagram. */
export type LoopStep = {
  label: string;
  /** Renders inverted — the one node the whole framework turns on. */
  emphasis?: boolean;
};

/** One layer of the stack, rendered bottom-up and numbered from 1. */
export type PlaybookLayer = {
  /** Short name (e.g. "Person"). Doubles as the HowTo step name. */
  title: string;
  body: string;
};

export type PlaybookStat = {
  /** Headline value, e.g. "160" or "8–10 hrs". */
  value: string;
  label: string;
  /**
   * Where the number comes from in this repo. Never rendered — it exists so
   * a reviewer can verify no metric was invented.
   */
  source: string;
};

/** A copy-paste prompt, presented as a named file. */
export type PlaybookPrompt = {
  /** e.g. "weekend-cut.txt" — the filename shown in the card header. */
  filename: string;
  body: string;
};

export type PlaybookPackItem = {
  title: string;
  body: string;
};

export type Playbook = {
  slug: string;
  /** Framework name, e.g. "The Decision Stack". */
  name: string;

  meta: {
    title: string;
    description: string;
    keywords: string;
  };

  hero: {
    eyebrow: string;
    /** The big contrarian claim. */
    claim: string;
    body: string;
    captureHeading: string;
    captureBody: string;
    buttonLabel: string;
    footnote: string;
  };

  problem: {
    heading: string;
    body: string;
    brokenLabel: string;
    brokenSteps: string[];
    workingLabel: string;
    workingSteps: LoopStep[];
    /** The dashed return arrow — what closes the working loop. */
    feedback: string;
    caption: string;
  };

  layers: {
    heading: string;
    body: string;
    /** Ordered bottom-up: items[0] is layer 1, the foundation. */
    items: PlaybookLayer[];
    caption: string;
  };

  outcomes: {
    heading: string;
    body: string;
    inputLabel: string;
    inputSub: string;
    outputs: string[];
    stats: PlaybookStat[];
  };

  prompts: {
    heading: string;
    body: string;
    items: PlaybookPrompt[];
  };

  pack: {
    eyebrow: string;
    heading: string;
    body: string;
    items: PlaybookPackItem[];
    buttonLabel: string;
    footnote: string;
    unlockedHeading: string;
    unlockedBody: string;
    /** Shown once unlocked — where the pack actually lands. */
    unlockedHref: string;
    unlockedHrefLabel: string;
  };

  cta: {
    heading: string;
    body: string;
    buttonLabel: string;
    href: string;
  };

  /** Drives `howToSchema` from lib/seo.ts. */
  howTo: {
    name: string;
    description: string;
    totalTime: string;
  };

  faqs: FaqEntry[];
};
