/// <reference types="vite/client" />

import { renderToStaticMarkup } from "react-dom/server";
import type { FunctionReference } from "convex/server";
import { afterEach, describe, expect, test, vi } from "vitest";
import { QUIET_PERIOD_MS } from "../../convex/platform/plans";
import {
  FOUNDING_OFFER_ID,
  OFFER_IDS,
  STARTER_KIT_OFFER,
  chooseOffer,
  foundingOffer,
  type FoundingInput,
  type Promo,
} from "../../lib/dashboard/offers";
import { checkoutMessage } from "../../components/platform/plan/checkout";
import { TermPicker, lifetimeState, type Seats } from "../../components/platform/plan/TermPicker";
import { OfferCard } from "../../components/platform/home/OfferCard";
import offerRulesSource from "../../convex/platform/membership/offer.ts?raw";
import cohortsSource from "../../convex/platform/membership/cohorts.ts?raw";
import dashboardSource from "../../convex/platform/dashboard.ts?raw";

// WP63-S7. The founding offer on Home and in the ladder, with a fixed clock.

const convex = vi.hoisted(() => ({ queries: new Map<string, unknown>(), args: [] as unknown[] }));
vi.mock("convex/react", async () => {
  const { getFunctionName } = await import("convex/server");
  return {
    useQuery: (query: FunctionReference<"query">, args?: unknown) => {
      convex.args.push(args);
      return args === "skip" ? undefined : convex.queries.get(getFunctionName(query));
    },
    useMutation: () => vi.fn(() => Promise.resolve(null)),
  };
});
vi.mock("../../components/platform/plan/flag", () => ({ BUILDERS_HUB_UI: true, UPGRADE_HREF: "/dashboard/billing#builders-hub" }));

const NOW = Date.UTC(2026, 10, 4, 12);
const OLD = NOW - 2 * QUIET_PERIOD_MS;
const OPEN: FoundingInput = { eligibleFrom: NOW - 1, seatsLeft: 34, nextSeatAmountMinor: 34_900 };
const PROMO: Promo = {
  id: "webinar",
  kind: "promo",
  eyebrow: "Webinar",
  title: "Live webinar",
  body: "Join us.",
  items: [],
  cta: { label: "Register", href: "https://example.test/webinar" },
  startsAt: NOW - 10,
  endsAt: NOW + 10,
};
const base = { now: NOW, joinedAt: OLD, plan: "free" as const, kitClaimed: false, dismissed: [] as string[], promos: [] as Promo[] };

afterEach(() => {
  convex.queries.clear();
  convex.args = [];
});

describe("WP63-S7 the Home card rule (fixed clock)", () => {
  test("the founding offer wins over a promo and the Starter Kit while it is open", () => {
    expect(chooseOffer({ ...base, promos: [PROMO], founding: OPEN })?.id).toBe(FOUNDING_OFFER_ID);
    expect(chooseOffer({ ...base, founding: OPEN })?.id).toBe(FOUNDING_OFFER_ID);
    expect(chooseOffer({ ...base, promos: [PROMO], founding: null })?.id).toBe("webinar");
    expect(chooseOffer({ ...base, founding: null })?.id).toBe(STARTER_KIT_OFFER.id);
  });

  test("never on day one, before the window, without a dated window, sold out, or once dismissed", () => {
    const fallback = STARTER_KIT_OFFER.id;
    expect(chooseOffer({ ...base, joinedAt: NOW - 1000, founding: OPEN })?.id).toBe(fallback);
    expect(chooseOffer({ ...base, founding: { ...OPEN, eligibleFrom: NOW + 1 } })?.id).toBe(fallback);
    expect(chooseOffer({ ...base, founding: { ...OPEN, eligibleFrom: NOW } })?.id).toBe(FOUNDING_OFFER_ID);
    expect(chooseOffer({ ...base, founding: { ...OPEN, eligibleFrom: null } })?.id).toBe(fallback);
    expect(chooseOffer({ ...base, founding: { ...OPEN, seatsLeft: 0, nextSeatAmountMinor: null } })?.id).toBe(fallback);
    expect(chooseOffer({ ...base, founding: { ...OPEN, nextSeatAmountMinor: null } })?.id).toBe(fallback);
    expect(chooseOffer({ ...base, dismissed: [FOUNDING_OFFER_ID], founding: OPEN })?.id).toBe(fallback);
  });

  test("never for a Builder's Hub member, even if the input slipped through", () => {
    expect(chooseOffer({ ...base, plan: "builders_hub", founding: OPEN })).toBeNull();
  });

  test("the card says only what is true now, and can be dismissed", () => {
    const card = foundingOffer({ seatsLeft: 1, nextSeatAmountMinor: 34_900 });
    expect(card.eyebrow).toBe("Founding Lifetime · 1 of 50 seats left");
    expect(card.body).toBe("$349 once. No renewal. Full refund within 30 days of your first payment.");
    expect(JSON.stringify(card)).not.toMatch(/hurry|almost|last chance|ends in|countdown|limited time|only \d+ left|today only|% off/i);
    expect(OFFER_IDS.has(FOUNDING_OFFER_ID)).toBe(true);
  });
});

describe("WP63-S7 the ladder before a member's window", () => {
  const seats: Seats = { open: true, seatsTotal: 50, seatsLeft: 40, seatsHeld: 0, nextSeatAmountMinor: 34_900, eligibleFrom: NOW };

  test("not open yet: visible, unselectable, and says when it opens", () => {
    expect(lifetimeState(seats, NOW - 1)).toMatchObject({ shown: true, selectable: false, opensAt: NOW, soldOut: false });
    const html = renderToStaticMarkup(<TermPicker name="t" value="monthly" onChange={() => {}} seats={seats} now={NOW - 1} />);
    expect(html).toMatch(/<input(?=[^>]*disabled="")(?=[^>]*value="lifetime")[^>]*>/);
    expect(html).toContain(" · Not open yet");
    expect(html).toContain("Opens for you on November 4, 2026 at");
    expect(html).toContain("40 of 50 founding seats left.");
  });

  test("open from the exact start", () => {
    expect(lifetimeState(seats, NOW)).toMatchObject({ shown: true, selectable: true, opensAt: null });
    const html = renderToStaticMarkup(<TermPicker name="t" value="monthly" onChange={() => {}} seats={seats} now={NOW} />);
    expect(html).not.toMatch(/<input(?=[^>]*disabled="")(?=[^>]*value="lifetime")[^>]*>/);
    expect(html).not.toContain("Opens for you");
  });

  test("hidden while no window is dated for this member", () => {
    expect(lifetimeState({ ...seats, eligibleFrom: null }, NOW).shown).toBe(false);
    const html = renderToStaticMarkup(
      <TermPicker name="t" value="monthly" onChange={() => {}} seats={{ ...seats, eligibleFrom: null }} now={NOW} />,
    );
    expect(html).not.toContain("Founding Lifetime");
  });

  test("a refused checkout names the opening date and time", () => {
    expect(checkoutMessage("NOT_YET_ELIGIBLE", NOW)).toMatch(/^Founding Lifetime opens for you on November 4, 2026 at .+\. Nothing was charged\.$/);
  });
});

describe("WP63-S7 the Home card", () => {
  test("renders the founding card from the server, and asks for it only with the flag on", () => {
    convex.queries.set("platform/dashboard:offer", foundingOffer({ seatsLeft: 12, nextSeatAmountMinor: 34_900 }));
    const html = renderToStaticMarkup(<OfferCard onDismissed={() => {}} />);
    expect(html).toContain("Founding Lifetime · 12 of 50 seats left");
    expect(html).toContain("Become a founding member of Builder’s Hub");
    expect(html).toContain('href="/dashboard/billing#builders-hub"');
    expect(html).toContain('aria-label="Dismiss"');
    expect(convex.args).toContainEqual(expect.objectContaining({ foundingOffer: true }));
  });
});

describe("WP63-S7 source pins", () => {
  test("eligibility never reads the publicly writable legacy tables", () => {
    for (const source of [offerRulesSource, cohortsSource]) {
      expect(source).not.toMatch(/["']stripe_events["']|["']subscriptions["']|payments/);
    }
    expect(offerRulesSource).toContain('.query("offer_cohorts")');
    expect(offerRulesSource).toContain("user.emailVerificationTime === undefined");
  });

  test("the offer query asks for the founding input only with the flag on, for free members", () => {
    expect(dashboardSource).toContain(
      'const founding = args.foundingOffer === true && plan === "free" ? await readFoundingInput(ctx, user) : null;',
    );
  });
});
