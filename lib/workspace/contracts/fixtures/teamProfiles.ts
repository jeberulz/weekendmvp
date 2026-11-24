/**
 * Roster per idea, Part C (WP91). Fixture team profiles: what the fixture
 * Claude client answers for the blueprint's `profile` and `team` blocks, so a
 * local fixture run gives different ideas different teams with zero AI spend.
 * Everything else in a fixture blueprint stays HydroTrail (or the own-idea
 * light blueprint).
 *
 * `fixtureTeamProfileFor` reads the idea's own words with keywords only.
 * It is pure: no env, network, clock or randomness. An idea no keyword
 * matches is a consumer app, the most common kind in the library.
 */
import type { BlueprintTeamEntry } from "../artifacts";
import type { OptionalRoleKey, RosterProfile } from "../roster";

export const FIXTURE_TEAM_PROFILE_KEYS = [
  "consumer_app",
  "b2b_software",
  "course",
  "physical_product",
  "local_service",
] as const;
export type FixtureTeamProfileKey = (typeof FIXTURE_TEAM_PROFILE_KEYS)[number];

export type FixtureTeamProfile = {
  readonly profile: RosterProfile;
  /** One decision per optional role, in `OPTIONAL_ROLE_KEYS` order. */
  readonly team: readonly (BlueprintTeamEntry & { readonly roleKey: OptionalRoleKey })[];
};

const hire = (roleKey: OptionalRoleKey, reason: string) => ({ roleKey, hire: true, reason });
const skip = (roleKey: OptionalRoleKey, reason: string) => ({ roleKey, hire: false, reason });

export const FIXTURE_TEAM_PROFILES: Readonly<Record<FixtureTeamProfileKey, FixtureTeamProfile>> = Object.freeze({
  consumer_app: {
    profile: { ideaKind: "app", buyer: "consumer", deliveryFormat: "self_serve", audiencePlural: "early users" },
    team: [
      hire("landing", "A simple site and waitlist is how people first try it"),
      hire("seo", "People search for this problem before they look for an app"),
      hire("marketing", "Someone has to own the first goal and the plan to reach it"),
      hire("engineering", "The product is an app, so it needs a scoped build"),
      skip("ads", "No paid test until the waitlist shows interest"),
      skip("curriculum", "Nothing to teach; the app does the work"),
      skip("community", "Too early to run a community before the first users"),
      skip("merch", "An app; nothing physical to sell"),
      skip("outbound", "Individuals sign up themselves; no business buyers to contact"),
    ],
  },
  b2b_software: {
    profile: { ideaKind: "b2b_software", buyer: "business", deliveryFormat: "self_serve", audiencePlural: "small businesses" },
    team: [
      hire("landing", "Business buyers want a clear page that explains the tool"),
      hire("seo", "Owners search for a fix when the problem costs them time"),
      hire("marketing", "Someone has to own the first goal and the plan to reach it"),
      hire("engineering", "The product is software, so it needs a scoped build"),
      skip("ads", "Direct conversations come before a paid test"),
      skip("curriculum", "No course; the tool is the product"),
      skip("community", "Business buyers want answers, not a community, at first"),
      skip("merch", "Software; nothing physical to sell"),
      hire("outbound", "The first customers are businesses worth contacting directly"),
    ],
  },
  course: {
    profile: { ideaKind: "course", buyer: "consumer", deliveryFormat: "cohort", audiencePlural: "learners" },
    team: [
      hire("landing", "A sales page with the dates and an early-bird list"),
      skip("seo", "The first cohort fills from the founder's own network"),
      hire("marketing", "Someone has to own filling the first cohort"),
      hire("engineering", "Checkout and course hosting only; no product build"),
      skip("ads", "The first cohort fills without a paid test"),
      hire("curriculum", "The lessons and materials are the product"),
      hire("community", "A cohort learns together, so it needs a space to meet"),
      skip("merch", "Nothing physical to sell"),
      skip("outbound", "Learners sign up themselves; no business buyers"),
    ],
  },
  physical_product: {
    profile: { ideaKind: "physical_product", buyer: "consumer", deliveryFormat: "self_serve", audiencePlural: "shoppers" },
    team: [
      hire("landing", "A product page and a pre-order list"),
      skip("seo", "Early buyers come from social posts, not search"),
      hire("marketing", "Someone has to own the first sales and the plan"),
      hire("engineering", "Checkout and storefront setup only; no product build"),
      skip("ads", "No paid test until the first batch sells"),
      skip("curriculum", "Nothing to teach"),
      skip("community", "Too early for a community before the first orders"),
      hire("merch", "Listings, a supplier and shipping are the core work"),
      skip("outbound", "Shoppers buy for themselves; no business buyers"),
    ],
  },
  local_service: {
    profile: { ideaKind: "service", buyer: "consumer", deliveryFormat: "one_to_one", audiencePlural: "local customers" },
    team: [
      hire("landing", "A page with the service, the area and a booking link"),
      hire("seo", "Local customers search for this service near them"),
      hire("marketing", "Someone has to own the first bookings and the plan"),
      hire("engineering", "Booking and checkout setup only; no product build"),
      skip("ads", "Word of mouth and search come before a paid test"),
      skip("curriculum", "A service, not a course"),
      skip("community", "One-to-one work needs no community yet"),
      skip("merch", "A service; nothing physical to sell"),
      skip("outbound", "Customers book for themselves; no business buyers"),
    ],
  },
});

const KEYWORDS: readonly (readonly [FixtureTeamProfileKey, RegExp])[] = [
  ["course", /\b(courses?|cohorts?|bootcamps?|workshops?|lessons?|classes|curriculum|teach\w*|tutorials?)\b/iu],
  [
    "b2b_software",
    /\b(b2b|saas|teams|businesses|business owners|small business\w*|compan(?:y|ies)|agenc(?:y|ies)|clinics?|restaurants?|receptionists?|crm|invoic\w*|employees|enterprises?|startups?|salons?|practices)\b/iu,
  ],
  ["physical_product", /\b(kits?|boxes|bottles?|printed|prints|merch|apparel|candles?|hardware|devices?|jars?|soaps?|stickers?|t-shirts?|mugs?)\b/iu],
  ["local_service", /\b(cleaning|dog walk\w*|grooming|repairs?|handyman|tutoring|coaching|local service|in-home|mobile service|appointments?)\b/iu],
];

/** The fixture profile for an idea, from its own words (title, description, summary or the founder's sentence). */
export function fixtureTeamProfileFor(ideaText: string): FixtureTeamProfileKey {
  for (const [key, pattern] of KEYWORDS) if (pattern.test(ideaText)) return key;
  return "consumer_app";
}
