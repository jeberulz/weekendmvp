/// <reference types="vite/client" />

import { describe, expect, test } from "vitest";
import offerCardSource from "../../components/platform/home/OfferCard.tsx?raw";
import dismissStateSource from "../../components/platform/home/dismiss-state.ts?raw";
import offersSource from "../../lib/dashboard/offers.ts?raw";
import dashboardSource from "../../convex/platform/dashboard.ts?raw";
import preferencesSource from "../../convex/platform/preferences.ts?raw";

describe("WP44-S12 offer card", () => {
  test("a labelled region with a real Dismiss button", () => {
    expect(offerCardSource).toContain('<section\n      aria-labelledby="rail-offer-heading"');
    expect(offerCardSource).toContain('<h2 id="rail-offer-heading"');
    expect(offerCardSource).toContain('aria-label="Dismiss"');
    expect(offerCardSource).toContain('type="button"');
    // Focus lands on the rail, not on <body>, when the card goes.
    expect(offerCardSource).toContain("onDismissed();");
  });

  test("events carry the offer id and kind only", () => {
    for (const name of ["offer_viewed", "offer_clicked", "offer_dismissed"]) {
      expect(offerCardSource).toContain(`name: "${name}"`);
    }
    expect(offerCardSource).toContain("const props = { offer_id: shown.id, kind: shown.kind };");
    expect(offerCardSource).not.toMatch(/email/i);
  });

  test("the choice runs on the server, with the clock passed in", () => {
    // WP63-S7 adds the browser's Builder's Hub flag for the founding card.
    expect(offerCardSource).toContain("useQuery(api.platform.dashboard.offer, { now, foundingOffer: BUILDERS_HUB_UI })");
    expect(offerCardSource).toContain("const [now] = useState(() => Date.now());");
    const handler = dashboardSource.slice(dashboardSource.indexOf("export const offer = query"));
    expect(handler).toContain("args: { now: v.number(), foundingOffer: v.optional(v.boolean()) }");
    expect(handler).not.toContain("Date.now()");
    // Response privacy is exercised against the real query in wp44Offers.test.ts.
    expect(handler).toContain("returns: v.union(offerValidator, v.null())");
  });

  test("dismissals live on the member; the old browser key only migrates", () => {
    expect(preferencesSource).toContain("export const dismissOffer = mutation");
    expect(preferencesSource).toContain('if (!OFFER_IDS.has(args.offerId)) throw new ConvexError({ code: "INVALID_OFFER" });');
    expect(dismissStateSource).not.toContain("setItem(");
    expect(offerCardSource).toContain(".then(() => clearLegacyDismissal(offer.id))");
  });

  test("external promo links say they open a new tab", () => {
    expect(offerCardSource).toContain('rel="noopener noreferrer"');
    expect(offerCardSource).toContain("(opens in a new tab)");
  });

  test("promos are dated, and nothing about Builder's Hub rides on them", () => {
    expect(offersSource).toContain("export type Promo = Offer & { kind: \"promo\"; startsAt: number; endsAt: number };");
    expect(offersSource).toContain("if (now - joinedAt < QUIET_PERIOD_MS) return kit;");
  });
});
