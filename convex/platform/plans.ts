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

/**
 * WP63 price ladder (ruling "WP55 / price ladder", 2026-10-04). Minor units,
 * USD. The one place a Builder's Hub price lives: Checkout checks each Stripe
 * Price against it, and UI strings derive from it. The browser never sends an
 * amount. A lifetime seat's number picks its tranche, so a refunded seat goes
 * back to the pool at its own price.
 */
export const PRICING = {
  currency: "usd",
  monthly: { priceKey: "monthly", amountMinor: 2_900, interval: "month" },
  annual: { priceKey: "annual", amountMinor: 19_900, interval: "year" },
  lifetime: {
    seats: 50,
    tranches: [
      { priceKey: "lifetime_t1", firstSeat: 1, lastSeat: 15, amountMinor: 24_900 },
      { priceKey: "lifetime_t2", firstSeat: 16, lastSeat: 50, amountMinor: 34_900 },
    ],
  },
} as const;

export type PriceKey =
  | typeof PRICING.monthly.priceKey
  | typeof PRICING.annual.priceKey
  | (typeof PRICING.lifetime.tranches)[number]["priceKey"];

/** The lifetime tranche for a seat, or null outside 1 to 50. */
export function lifetimeTrancheForSeat(seatNumber: number) {
  if (!Number.isInteger(seatNumber)) return null;
  return (
    PRICING.lifetime.tranches.find(
      (tranche) => seatNumber >= tranche.firstSeat && seatNumber <= tranche.lastSeat,
    ) ?? null
  );
}

/** The amount for a Stripe Price key, in minor units. */
export function amountForPriceKey(priceKey: PriceKey): number {
  if (priceKey === "monthly") return PRICING.monthly.amountMinor;
  if (priceKey === "annual") return PRICING.annual.amountMinor;
  const tranche = PRICING.lifetime.tranches.find((candidate) => candidate.priceKey === priceKey);
  if (!tranche) throw new Error(`Unknown price key: ${priceKey}`);
  return tranche.amountMinor;
}

/** "$29", or "$29.50" when there are cents. USD only, like the ladder. */
export function formatUsd(amountMinor: number): string {
  const dollars = Math.floor(amountMinor / 100);
  const cents = amountMinor % 100;
  return cents === 0 ? `$${dollars}` : `$${dollars}.${String(cents).padStart(2, "0")}`;
}

/** Annual against twelve months of monthly, rounded to a whole percent (43). */
export const ANNUAL_SAVING_PERCENT = Math.round(
  (1 - PRICING.annual.amountMinor / (12 * PRICING.monthly.amountMinor)) * 100,
);

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
    priceMonthlyUsd: PRICING.monthly.amountMinor / 100,
    // WP63-S6: the ladder. Founding Lifetime is limited, so it is named where seats show.
    priceLabel: `${formatUsd(PRICING.monthly.amountMinor)} a month or ${formatUsd(PRICING.annual.amountMinor)} a year`,
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
  // WP57 gates research behind a free account. No plan ever paywalls it.
  { label: "Ideas, scores, sources and prompts", free: "Every idea, never paywalled", hub: "Every idea, never paywalled" },
  { label: "Search and filter", free: "Whole library, plus For you", hub: "Whole library, plus For you" },
  { label: "Saved ideas", free: "Unlimited, in one list", hub: "Unlimited, plus collections and notes" },
  { label: "Weekend plans", free: "1 active plan", hub: "Unlimited, with history" },
  { label: "Prompts", free: "Copy any prompt", hub: "Copy, plus prompt pack export" },
  { label: "Compare ideas", free: "Not included", hub: "Up to 4 side by side" },
  {
    label: "Price",
    free: PLANS.free.priceLabel,
    hub: `${PLANS.builders_hub.priceLabel}, or one Founding Lifetime payment`,
  },
];

/** How a member pays. Same values as the Checkout route contract and the schema. */
export type MembershipTerm = "monthly" | "annual" | "lifetime";

/** The first lifetime tranche's price, used when no seat count is known. */
const FIRST_LIFETIME_AMOUNT = PRICING.lifetime.tranches[0].amountMinor;

/**
 * WP63-S6. What each term costs and how it renews, in plain words. Every
 * amount comes from `PRICING`. A lifetime seat's price depends on the next
 * free seat, so the caller passes it.
 */
type TermCopy = {
  name: string;
  /** For a button: "$29/mo". */
  short: (lifetimeAmountMinor?: number) => string;
  /** Price, billing period and renewal: "$199 billed once a year. Renews until you cancel." */
  terms: (lifetimeAmountMinor?: number) => string;
};

export const TERM_COPY: Record<MembershipTerm, TermCopy> = {
  monthly: {
    name: "Monthly",
    short: () => `${formatUsd(PRICING.monthly.amountMinor)}/mo`,
    terms: () => `${formatUsd(PRICING.monthly.amountMinor)} billed every month. Renews until you cancel.`,
  },
  annual: {
    name: "Annual",
    short: () => `${formatUsd(PRICING.annual.amountMinor)}/yr`,
    terms: () => `${formatUsd(PRICING.annual.amountMinor)} billed once a year. Renews until you cancel.`,
  },
  lifetime: {
    name: "Founding Lifetime",
    short: (amount = FIRST_LIFETIME_AMOUNT) => `${formatUsd(amount)} once`,
    terms: (amount = FIRST_LIFETIME_AMOUNT) => `${formatUsd(amount)} once. No renewal.`,
  },
};

/** The real saving, stated against what it is measured from. No strike-through price. */
export const ANNUAL_SAVING_LINE = `Save ${ANNUAL_SAVING_PERCENT}% compared with 12 months of monthly`;

/** How the two lifetime prices work, from the tranches. */
export const LIFETIME_TRANCHE_LINE = PRICING.lifetime.tranches
  .map((tranche) => `${formatUsd(tranche.amountMinor)} for seats ${tranche.firstSeat} to ${tranche.lastSeat}`)
  .join(", then ");

/** Ruling "WP55 / refunds": 30 days from the first purchase, full refund. */
export const REFUND_LINE = "Full refund within 30 days of your first payment.";

/** Neutral until O1 picks the tax mechanism. True under either choice. */
export const TAX_LINE = "Prices in US dollars. Any tax is shown at checkout before you pay.";

/** WP63-S9 publishes these pages. Checkout stays closed (S12) until they exist and are reviewed. */
export const MEMBERSHIP_LEGAL_LINKS = [
  { label: "Terms", href: "/terms" },
  { label: "Refund policy", href: "/refund-policy" },
] as const;

/** The upgrade button's label for a term, from the plan constant. */
export function upgradeLabel(term: MembershipTerm, lifetimeAmountMinor?: number): string {
  return `Upgrade to ${PLANS.builders_hub.name} · ${TERM_COPY[term].short(lifetimeAmountMinor)}`;
}

/** The monthly label, as PRD 6.6 shows it. */
export const UPGRADE_LABEL = upgradeLabel("monthly");

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
