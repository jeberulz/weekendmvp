/**
 * Types for the shared guide blocks (WP103-S1).
 * Types only. The zod schema and audits arrive in WP103-S2.
 */

/** A copy deck: slot name to prose. Slots are named by convention, see `blocks.tsx`. */
export type GuideDeck = Readonly<Record<string, string>>;

export type GuideSectionDef = {
  id: string;
  title: string;
  summary: string | ((ideaCount: number) => string);
};

/** The serialisable slice of a section that client components receive. */
export type GuideNavSection = { id: string; title: string };

export type GuideGateConfig = {
  stubEyebrow: string;
  stubNote: string;
  heading: string;
  body: string;
  unlocks: readonly string[];
  nextHref: string;
  nextLabel: string;
  /** Deck slot that holds the fine print under the form. */
  finePrintSlot: string;
};

export type GuideSpec = {
  slug: string;
  path: string;
  title: string;
  headline: string;
  description: string;
  /** Full `<title>` text. */
  metaTitle: string;
  ogImagePath: string;
  lang: string;
  authorName: string;
  utmCampaign: string;
  checklistKey: string;
  promptFileName: string;
  sections: readonly GuideSectionDef[];
  hero: {
    eyebrow: string;
    lede: string;
    meta: readonly (readonly [string, string])[];
    metaLabel: string;
    ctaLabel: string;
    lockedNote: string;
    subscribedNote: string;
    image: { src: string; alt: string; width: number; height: number; sizes: string };
  };
  contents: { heading: string };
  /** "none" means no gate, so no paywall markup either. */
  gate: GuideGateConfig & { mode: "none" | "after-section-1" };
  steps: readonly string[];
  /** Pull quote shown after a step, keyed by step name. */
  stepPullQuotes: Readonly<Record<string, string>>;
  skills: readonly string[];
  roles: { names: readonly string[]; labels: readonly string[] };
  weeks: readonly (readonly [number, string])[];
  faq: readonly string[];
  founderName: string;
};
