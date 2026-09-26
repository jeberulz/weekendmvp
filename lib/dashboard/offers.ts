/**
 * WP44-S12 offer card (PRD 6.2, rulings R6 and R8). The catalog and the one
 * rule that picks at most one card for the Home rail. Pure: the Convex query
 * runs it with the clock the client passes in, and tests run it with a fixed
 * clock. Relative imports on purpose: Convex and the test runner load this.
 */
import { QUIET_PERIOD_MS, type PlanId } from "../../convex/platform/plans";

export type OfferKind = "starter_kit" | "promo";

export type Offer = {
  /** Stable id: analytics and dismissals use it. Never reuse one. */
  id: string;
  kind: OfferKind;
  eyebrow: string;
  title: string;
  body: string;
  items: string[];
  /** A site path, or an https link for a product on another site. */
  cta: { label: string; href: string };
};

/** A dated promo for another Weekend MVP product, such as a webinar (R8). */
export type Promo = Offer & { kind: "promo"; startsAt: number; endsAt: number };

export const STARTER_KIT_OFFER: Offer = {
  id: "starter-kit",
  kind: "starter_kit",
  eyebrow: "Free · Starter Kit",
  title: "Everything for your first weekend build",
  body: "From an idea to a live link.",
  items: ["The 15-second demo test", "3-screen MVP template", "48-hour weekend plan", "Copy-paste AI prompts"],
  cta: { label: "Get the free kit", href: "/starter-kit" },
};

/**
 * Running promos. Add one with its start and end, and it shows on Home in
 * that window, one at a time, earliest end first. Nothing is running now.
 */
export const PROMOS: readonly Promo[] = [];

export const OFFER_IDS: ReadonlySet<string> = new Set([STARTER_KIT_OFFER.id, ...PROMOS.map((promo) => promo.id)]);

/**
 * The Starter Kit counts as claimed once the member's email went through
 * `/api/subscribe`, which enrolls people in the kit's welcome automation by
 * default. The workshop waitlist routes elsewhere, so it does not count.
 */
export function isKitClaim(row: { source: string; utm?: { campaign?: string } }): boolean {
  return row.source === "subscribe" && row.utm?.campaign !== "shipable-workshop";
}

export type OfferInput = {
  now: number;
  joinedAt: number;
  plan: PlanId;
  kitClaimed: boolean;
  dismissed: readonly string[];
  promos?: readonly Promo[];
};

/**
 * PRD 6.2: in the first day, only the Starter Kit (until claimed). After
 * that, a running promo wins, else the Starter Kit while unclaimed, else
 * nothing. The kit is for free members (R6); promos are for everyone.
 */
export function chooseOffer({ now, joinedAt, plan, kitClaimed, dismissed, promos = PROMOS }: OfferInput): Offer | null {
  const kit = plan === "free" && !kitClaimed && !dismissed.includes(STARTER_KIT_OFFER.id) ? STARTER_KIT_OFFER : null;
  if (now - joinedAt < QUIET_PERIOD_MS) return kit;
  const running = promos
    .filter((promo) => promo.startsAt <= now && now < promo.endsAt && !dismissed.includes(promo.id))
    .sort((a, b) => a.endsAt - b.endsAt);
  if (running.length > 0) {
    // The card needs the offer, not its window.
    const { id, kind, eyebrow, title, body, items, cta } = running[0];
    return { id, kind, eyebrow, title, body, items, cta };
  }
  return kit;
}

/** Newest last, deduplicated, at most `cap` ids (PRD 9.2: capped at 50). */
export function withDismissed(dismissed: readonly string[], id: string, cap = 50): string[] {
  return [...dismissed.filter((existing) => existing !== id), id].slice(-cap);
}
