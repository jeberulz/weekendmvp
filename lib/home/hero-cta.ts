/**
 * The hero build window's link to the idea (WP60).
 *
 * One destination for everyone: `/ideas/{slug}` decides on the server what
 * the visitor sees. A verified member gets the full research. Anyone else gets
 * the teaser with the embedded create-account and log-in card, which returns
 * to the same URL after verification (WP57). So the hero never routes by
 * audience. It only words the link for the audience and tracks it.
 *
 * Pure and dependency-free, so the client window and the tests share it.
 */

export type HeroCtaAudience = "visitor" | "member";

export type HeroCta = { audience: HeroCtaAudience; label: string; note: string };

const VISITOR: HeroCta = {
  audience: "visitor",
  label: "Unlock the full research",
  note: "Prompt 1 is free. A free account unlocks the other prompts and the full research.",
};

const MEMBER: HeroCta = {
  audience: "member",
  label: "Read the full research",
  note: "The other prompts, the market research and the build plan are on the full page.",
};

/** The link's wording for a visitor, or for someone the session hint says is signed in. */
export function heroCta(signedIn: boolean): HeroCta {
  return signedIn ? MEMBER : VISITOR;
}

export function heroIdeaHref(slug: string): string {
  return `/ideas/${encodeURIComponent(slug)}`;
}

/** Where the click is reported from, so the funnel can be read per surface. */
export const HERO_CTA_LOCATION = "home-hero-idea";
