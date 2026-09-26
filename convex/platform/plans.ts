/**
 * WP44 plans (rulings R1, R2, R9). The one place the plan names, the price,
 * what each plan includes and its limits live, so a rename or a price change
 * never touches stored data. Pure: `entitlements.ts` (S10) and the client
 * both import it.
 *
 * The paid plan id is `builders_hub`. Never `builder`: the parked credit pack
 * catalog (`billing/catalog.ts`) already uses that id.
 */

export type PlanId = "free" | "builders_hub";

export const PLANS = {
  free: {
    id: "free",
    name: "Free",
    priceLabel: "Free",
    /** Only what ships today. */
    includes: [
      "Every idea, score, source and prompt",
      "Search and filter the whole library",
      "Home with the idea of the week and ideas picked for you",
      "Unlimited saved ideas in one list",
      "1 active weekend plan, with the prompts for each day",
    ],
  },
  builders_hub: {
    id: "builders_hub",
    name: "Builder’s Hub",
    priceMonthlyUsd: 29,
    priceLabel: "$29 a month, billed monthly",
    adds: [
      "Collections and a private note on each idea",
      "Unlimited weekend plans, with history",
      "Prompt pack export for your AI tool",
      "Compare up to 4 ideas side by side",
    ],
  },
} as const;

/** The features a plan can gate (PRD 6.5). Same names as the analytics events. */
export type GatedFeature = "weekend_plan" | "collections" | "prompt_pack" | "compare";

export type PlanLimits = {
  /** Weekend plans running at once. Null means no limit. */
  activeWeekendPlans: number | null;
  collections: boolean;
  promptPack: boolean;
  /** How many ideas fit side by side. 0 means compare is off. */
  compareMax: number;
};

/** Ruling R2 for Free. Builder's Hub lifts each one. */
export const PLAN_LIMITS: Record<PlanId, PlanLimits> = {
  free: { activeWeekendPlans: 1, collections: false, promptPack: false, compareMax: 0 },
  builders_hub: { activeWeekendPlans: null, collections: true, promptPack: true, compareMax: 4 },
};

/** The error code every gated mutation throws. The UI opens the upgrade sheet. */
export const UPGRADE_REQUIRED = "UPGRADE_REQUIRED";

/** Free against Builder's Hub, one row per gated feature (PRD 7.4). */
export const PLAN_COMPARISON: readonly { feature: GatedFeature; free: string; hub: string }[] = [
  { feature: "weekend_plan", free: "1 active weekend plan", hub: "Unlimited weekend plans" },
  { feature: "collections", free: "One saved list", hub: "Collections and notes" },
  { feature: "prompt_pack", free: "Copy prompts", hub: "Prompt pack export" },
  { feature: "compare", free: "One idea at a time", hub: "Compare up to 4 ideas" },
];

/** Plan and billing's table: what each plan includes, row by row (PRD 6.5, member columns). */
export const BILLING_COMPARISON: readonly { label: string; free: string; hub: string }[] = [
  { label: "Ideas, scores, sources and prompts", free: "Every idea", hub: "Every idea" },
  { label: "Search and filter", free: "Whole library, plus For you", hub: "Whole library, plus For you" },
  { label: "Saved ideas", free: "Unlimited, in one list", hub: "Unlimited, plus collections and notes" },
  { label: "Weekend plans", free: "1 active plan", hub: "Unlimited, with history" },
  { label: "Prompts", free: "Copy any prompt", hub: "Copy, plus prompt pack export" },
  { label: "Compare ideas", free: "Not included", hub: "Up to 4 side by side" },
  { label: "Price", free: PLANS.free.priceLabel, hub: PLANS.builders_hub.priceLabel },
];

/** The upgrade button's label, from the plan constant. */
export const UPGRADE_LABEL = `Upgrade to ${PLANS.builders_hub.name} · $${PLANS.builders_hub.priceMonthlyUsd}/mo`;

/**
 * Every Builder's Hub surface stays hidden until the owner turns this on
 * (WP44-S10). Off unless NEXT_PUBLIC_BUILDERS_HUB is exactly "on".
 */
export function buildersHubUiEnabled(flag: string | undefined): boolean {
  return flag === "on";
}

/** Nothing sells in a member's first day (PRD 6.6), except the sheet they ask for. */
export const QUIET_PERIOD_MS = 24 * 60 * 60 * 1000;

/**
 * Whether the Plan card, tags and the Plan and billing upsell may show. Never
 * for a Builder's Hub member, never with the flag off, never in the first day.
 */
export function upsellVisible({
  flagOn,
  plan,
  joinedAt,
  now,
}: {
  flagOn: boolean;
  plan: PlanId;
  joinedAt: number;
  now: number;
}): boolean {
  return flagOn && plan === "free" && now - joinedAt >= QUIET_PERIOD_MS;
}

/** Whether a gated action opens the upgrade sheet. The member asked, so no quiet period. */
export function upgradeSheetAllowed({ flagOn, plan }: { flagOn: boolean; plan: PlanId }): boolean {
  return flagOn && plan === "free";
}
