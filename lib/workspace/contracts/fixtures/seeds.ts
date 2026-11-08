/**
 * WP90 fixture seed drafts: what `crew-idea-seed@2` returns, for tests, the
 * fixture batch responder and the local walkthrough. Two shapes:
 * - HydroTrail: a consumer app whose loop needs the phone (offline,
 *   push notifications), so the platform rule suggests native.
 * - A neighbourhood bakery pre-order idea: a `local_business` that sells
 *   goods, needs no phone capability, so the rule suggests web.
 *
 * Every text here is free of market numbers (the seed contract rejects them).
 * Quotes are verbatim in the matching fixture source (`seedSource` tests).
 */
import type { IdeaSeedDraft } from "../seeds";
import { hydrotrailBlueprint } from "./hydrotrail";

function draftBlueprint(blueprint: typeof hydrotrailBlueprint): IdeaSeedDraft["blueprint"] {
  if (blueprint.source !== "library") throw new Error("HydroTrail is a library idea");
  return {
    pitch: blueprint.pitch,
    oneUser: blueprint.oneUser,
    oneLoop: blueprint.oneLoop,
    features: [...blueprint.features],
    profile: { ...blueprint.profile },
    ...(blueprint.market === undefined ? {} : { market: blueprint.market }),
    scopeCuts: [...blueprint.scopeCuts],
  };
}

export const hydrotrailSeedDraft: IdeaSeedDraft = {
  blueprint: draftBlueprint(hydrotrailBlueprint),
  wizardHints: {
    platform: { deviceNeeds: ["offline", "push_notifications"], confidence: "high" },
    commercialModel: {
      value: "freemium",
      reason: "Planning one route is free; saved routes and reminders are what hikers would pay for.",
      confidence: "low",
    },
    goal: {
      kind: "waitlist",
      timeframe: "weekend",
      reason: "Hikers plan ahead, so a waitlist before the hot months tests demand fastest.",
      confidence: "high",
    },
    names: ["HydroTrail", "SipLine", "Trailwater"],
  },
  brandSeeds: {
    positioning: "The hydration plan for the route you are actually hiking, not a generic daily target.",
    voiceCues: ["Calm and practical", "Trail-wise", "Safety without fear"],
    avoid: ["Fitness-influencer hype", "Medical claims"],
    imagery: "Dry, sunlit trails, a full bottle and a simple route line.",
  },
  landingSeeds: {
    heroAngle: "Know how much water to carry before you leave the car park.",
    painLines: [
      "Rules of thumb leave you short on the hot, exposed stretch.",
      "Generic water apps know nothing about heat, climb or the next source.",
    ],
    howItWorks: ["Enter your route", "Get litres to carry and sip times", "Log what you drank"],
    differentiator: "Plans from the route, the heat and the climb, not a fixed daily goal.",
    buyerWords: [{ quote: "I always run dry on the last climb.", attribution: "A solo hiker on a hiking forum" }],
  },
  emailAngles: [
    { angle: "Welcome", hook: "You're on the list. Here is how HydroTrail plans your water." },
    { angle: "The last climb", hook: "Why most hikers run short on the final stretch, and how to avoid it." },
    { angle: "Early access", hook: "Your invite is close: plan your first route this weekend." },
  ],
  socialAngles: [
    { angle: "Myth", hook: "A litre an hour is a rule of thumb, not a plan.", channel: "Instagram" },
    { angle: "Story", hook: "The day I ran out of water two kilometres from the car.", channel: "Reddit" },
    { angle: "How it works", hook: "Route in, litres out: hydration planning in one tap.", channel: "TikTok" },
  ],
  buildPackSeeds: {
    stack: "Next.js, Supabase (database and Supabase Auth), Vercel",
    coreFeature:
      "Route planner: distance, heat and climb in; litres to carry and sip times out. Empty state: a sample route.",
    screens: ["Plan a route", "Sip schedule", "Drink log"],
    doNotBuild: ["Billing", "Live GPS tracking", "Wearables"],
  },
  roleBriefs: {
    outbound: { buyerTitles: [], channels: [] },
    seo: { searchTerms: ["how much water to carry hiking", "hiking hydration plan", "water for a day hike"] },
  },
};

export const BAKERY_SLUG = "neighbourhood-bakery-preorder";

export const bakerySeedDraft: IdeaSeedDraft = {
  blueprint: {
    pitch: "Pre-order bread and pastries from your local bakery and pick them up warm, no queue.",
    oneUser: "A regular who wants their Saturday loaf without queueing or finding it sold out.",
    oneLoop: "Browse tomorrow's bake, pre-order, pick up at the counter, order again next week.",
    features: [
      "Tomorrow's bake list with a pre-order cut-off",
      "Pick-up time slots",
      "Order ready message at the counter",
      "Repeat last week's order in one tap",
    ],
    profile: {
      ideaKind: "local_business",
      buyer: "consumer",
      deliveryFormat: "one_to_one",
      audiencePlural: "regulars",
      sellsGoods: true,
    },
    market: {
      summary: "Regulars rely on queueing or phoning ahead; marketplace apps take a large cut and bury small bakeries.",
      competitors: [{ name: "Food delivery marketplaces", note: "Built for delivery, not counter pick-up." }],
    },
    scopeCuts: ["No delivery this weekend", "No loyalty points"],
  },
  wizardHints: {
    platform: { deviceNeeds: [], confidence: "high" },
    commercialModel: {
      value: "one_time",
      reason: "Customers pay per order; there is nothing to subscribe to yet.",
      confidence: "high",
    },
    goal: {
      kind: "first_sale",
      timeframe: "2w",
      reason: "A bakery proves it with real pre-orders, not sign-ups.",
      confidence: "high",
    },
    names: ["Loaf Ahead", "Counter Ready"],
  },
  brandSeeds: {
    positioning: "Your bakery's pre-order counter, open the night before.",
    voiceCues: ["Warm", "Neighbourly", "Plain-spoken"],
    avoid: ["Tech jargon"],
    imagery: "Fresh loaves on a wooden counter in morning light.",
  },
  landingSeeds: {
    heroAngle: "Your Saturday loaf, saved for you.",
    painLines: ["The best bakes sell out before you get there.", "Phoning ahead means calling during the morning rush."],
    howItWorks: ["See tomorrow's bake", "Pre-order and pick a time", "Collect it warm"],
    buyerWords: [],
  },
  emailAngles: [
    { angle: "Welcome", hook: "You're on the list for pre-orders." },
    { angle: "First bake", hook: "Tomorrow's bake is up: order by eight tonight." },
  ],
  socialAngles: [
    { angle: "Behind the counter", hook: "What a four a.m. start looks like.", channel: "Instagram" },
    { angle: "Sold out", hook: "Never miss the sourdough again.", channel: "Facebook" },
    { angle: "Neighbours", hook: "Meet the regulars who pre-order every Friday.", channel: "Instagram" },
  ],
  buildPackSeeds: {
    stack: "Next.js, Supabase (database and Supabase Auth), Vercel",
    coreFeature: "Pre-order: pick items from tomorrow's bake and a pick-up slot; the bakery sees a list for the morning.",
    screens: ["Tomorrow's bake", "Pick-up slot", "Morning order list"],
    doNotBuild: ["Delivery", "Loyalty points"],
  },
  roleBriefs: {
    outbound: { buyerTitles: [], channels: [] },
    seo: { searchTerms: ["bakery pre order near me", "order bread for pick up"] },
  },
};
