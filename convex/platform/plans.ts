/**
 * WP44 plans (rulings R1, R2, R9). The one place the plan names, the price
 * and what each plan includes live, so a rename or a price change never
 * touches stored data. Pure: the Convex entitlements resolver (S10) and the
 * client both import it.
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

/**
 * Every Builder's Hub surface stays hidden until the owner turns this on
 * (WP44-S10). Off unless NEXT_PUBLIC_BUILDERS_HUB is exactly "on".
 */
export function buildersHubUiEnabled(flag: string | undefined): boolean {
  return flag === "on";
}
