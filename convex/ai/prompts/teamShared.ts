/**
 * Roster per idea (WP91). What both blueprint prompts (version 3) say about
 * the team: the optional roles, one line each, and how to decide them. The
 * text is fixed, so it stays in the stable system block and the prompt cache
 * keeps working.
 *
 * The role lines mirror `ROLE_CATALOGUE` in `convex/crew/roles.ts` (a test
 * checks they agree). They are written out here rather than imported, so a
 * change to the hiring rules does not force a prompt version bump.
 *
 * Any change to this file (comments included: the lock hashes module source)
 * needs a version bump of both blueprint prompts that import it.
 */

/** The roles the blueprint decides, with what each does. Keys are `OPTIONAL_ROLE_KEYS`. */
export const TEAM_ROLE_LINES = [
  "landing: Landing. Builds the site and the waitlist.",
  "seo: SEO. Targets the searches people make about the problem.",
  "marketing: Marketing. Owns the first goal and the plan to reach it.",
  "engineering: Engineering. Scopes the product and writes the build prompts, or sets up checkout.",
  "ads: Ads. Plans and runs the paid test.",
  "curriculum: Curriculum. Outlines the lessons and course materials.",
  "community: Community. Runs the cohort or community space.",
  "merch: Merch. Handles product listings, suppliers and fulfilment.",
  "outbound: Outbound. Finds and contacts business buyers directly.",
] as const;

/** The system lines both blueprint prompts add for the team block. */
export const TEAM_SYSTEM_RULES = [
  "team is your proposal, as the founder's Crew Lead, for who joins this business's crew. The Crew Lead, Brand, Email and Social are always on the team; do not list them.",
  `Decide each of these roles exactly once, as one team entry with roleKey, hire (true or false) and reason:\n${TEAM_ROLE_LINES.map((line) => `- ${line}`).join("\n")}`,
  "Hire the smallest team that fits this idea and the founder's goal. Hire a role only when this business needs that work now; skip the rest.",
  "Each reason is one plain line under 160 characters, specific to this business, that the founder understands: why this role is needed, or why not yet. No numbers about the market, no prices of other businesses, no claims about customers.",
  "A paid push in the founder's goal always hires Ads, and a course always hires Curriculum; still give a reason for them.",
] as const;
