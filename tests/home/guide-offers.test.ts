// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, test, vi } from "vitest";

import { UpsellCard } from "@/app/(marketing)/guides/_shared/blocks";
import { guideSpec } from "@/app/(marketing)/guides/5-to-9-builder/guide.spec";
import { BUILD_ALONG, NEXT_BUILD_ALONG } from "@/lib/live/config";
import { effectiveStatus, formatPrice, resolvablePriceKeys, resolvePrice } from "@/lib/guides/offer-live";
import { PRICE_CONFIG_KEYS, STATUS_RESOLVER_KEYS, offerById, offerSchema, offers, rankOffers, type Offer } from "@/lib/guides/offers";
import { appRouteExists } from "@/lib/guides/routes";
import { trackEvent } from "@/lib/track";

vi.mock("@/lib/track", () => ({ trackEvent: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

afterEach(() => cleanup());

const real = offers[0];
const waitlist: Offer = {
  id: "next-cohort",
  kind: "waitlist",
  status: "waitlist",
  title: "Join the next cohort",
  eyebrow: "Waitlist",
  ariaLabel: "Next cohort waitlist",
  promise: "A fixture waitlist offer.",
  linkLabel: "Join the waitlist",
  url: "https://waitlist.test/join",
  topics: ["claude-code"],
  audiences: ["builder"],
  fit: "Fixture for tests.",
};

describe("offers registry", () => {
  test("the real registry validates and the build-along offer is paid, derived and tied to config", () => {
    expect(offers.map((offer) => offer.id)).toEqual(["build-along"]);
    expect(offerSchema.safeParse(real).success).toBe(true);
    expect(real).toMatchObject({ kind: "paid", status: "derived", statusResolver: "build-along", price: { configKey: "BUILD_ALONG.standardUsd" } });
    expect(offerById("build-along")).toBe(real);
    expect(() => offerById("nope")).toThrow(/Unknown offer "nope"/);
  });

  test("no offer carries a typed price, and every price key and status resolver has an implementation", () => {
    expect(JSON.stringify(offers)).not.toMatch(/\$\d/);
    expect([...resolvablePriceKeys].sort()).toEqual([...PRICE_CONFIG_KEYS].sort());
    for (const key of PRICE_CONFIG_KEYS) expect(resolvePrice(key)).toBeGreaterThan(0);
    for (const key of STATUS_RESOLVER_KEYS) {
      expect(effectiveStatus({ ...real, statusResolver: key }, Date.now())).toHaveProperty("status");
    }
  });

  test("a paid offer's price comes from config", () => {
    expect(resolvePrice("BUILD_ALONG.standardUsd")).toBe(BUILD_ALONG.standardUsd);
    expect(formatPrice(resolvePrice("BUILD_ALONG.standardUsd"))).toBe("$29");
  });

  test("the schema refuses a paid offer without a price, and a free or waitlist offer with one", () => {
    const { price, ...noPrice } = real;
    void price;
    expect(offerSchema.safeParse(noPrice).success).toBe(false);
    expect(offerSchema.safeParse({ ...waitlist, price: { configKey: "BUILD_ALONG.standardUsd" } }).success).toBe(false);
    expect(offerSchema.safeParse({ ...waitlist, promise: "Only {price} today" }).success).toBe(false);
    expect(offerSchema.safeParse({ ...real, bullets: ["a", "b", "c", "d"] }).success).toBe(false);
    expect(offerSchema.safeParse({ ...real, urgency: { text: "Seats are going", source: "" } }).success).toBe(false);
  });
});

describe("offer status from config", () => {
  const during = BUILD_ALONG.startAt - 24 * 3600 * 1000;
  const after = BUILD_ALONG.endAt + 24 * 3600 * 1000;

  test("open before the session ends", () => {
    expect(effectiveStatus(real, during).status).toBe("open");
  });

  test("closed after the session ends while next-session checkout is off, and the reason names the switch", () => {
    const result = effectiveStatus(real, after);
    expect(result.status).toBe("closed");
    expect(result.reason).toContain("NEXT_SESSION_CHECKOUT_ENABLED");
    expect(after).toBeLessThan(NEXT_BUILD_ALONG.endAt);
  });

  test("a declared status is returned as declared", () => {
    expect(effectiveStatus(waitlist, after)).toMatchObject({ status: "waitlist" });
  });
});

describe("rankOffers", () => {
  const second: Offer = { ...waitlist, id: "claude-code-cohort", topics: ["claude-code", "validation"], audiences: ["builder"] };

  test("ranks by overlap, topics counting double, and drops offers with no overlap", () => {
    const ranked = rankOffers({ topics: ["validation", "first-sale"], audiences: ["9-to-5"] }, [real, second]);
    expect(ranked.map((match) => match.offer.id)).toEqual(["build-along", "claude-code-cohort"]);
    expect(ranked[0]).toMatchObject({ score: 5, matchedTopics: ["validation", "first-sale"], matchedAudiences: ["9-to-5"] });
    expect(rankOffers({ topics: ["gardening"], audiences: [] }, [real, second])).toEqual([]);
  });

  test("matching ignores case, ties break by id, and declared-closed offers are left out", () => {
    const a: Offer = { ...second, id: "a-offer", topics: ["x"], audiences: ["y"] };
    const b: Offer = { ...second, id: "b-offer", topics: ["x"], audiences: ["y"] };
    expect(rankOffers({ topics: ["X"], audiences: ["Y"] }, [b, a]).map((m) => m.offer.id)).toEqual(["a-offer", "b-offer"]);
    expect(rankOffers({ topics: ["x"], audiences: [] }, [{ ...a, status: "closed" }])).toEqual([]);
  });
});

describe("app route check", () => {
  const appDir = path.join(process.cwd(), "app");

  test("finds pages through route groups and dynamic segments, and rejects missing ones", () => {
    expect(appRouteExists(appDir, "/live/build-along")).toBe(true);
    expect(appRouteExists(appDir, "/guides/5-to-9-builder")).toBe(true);
    expect(appRouteExists(appDir, "/ideas/any-idea-slug")).toBe(true);
    expect(appRouteExists(appDir, "/live/build-along?ref=guide#top")).toBe(true);
    expect(appRouteExists(appDir, "/live/no-such-page")).toBe(false);
    expect(appRouteExists(appDir, "live/build-along")).toBe(false);
  });
});

describe("UpsellCard", () => {
  const html = (placement: "mid" | "close", list?: readonly Offer[], spec = guideSpec) =>
    renderToStaticMarkup(createElement(UpsellCard, { spec, placement, offers: list }));

  test("renders the Build-Along card as before: price from config, strong only in the mid card", () => {
    const mid = html("mid");
    expect(mid).toContain('aria-label="Build-Along sprint"');
    expect(mid).toContain("Paid · Live");
    expect(mid).toContain("Do this live with John");
    expect(mid).toContain('The <strong class="text-2xl font-medium text-home-orange">$29</strong> Build-Along sprint. Two hours, live.');
    expect(mid).toContain("guide-mid-card");
    const close = html("close");
    expect(close).toContain("The <strong>$29</strong> Build-Along sprint.");
    expect(close).not.toContain("guide-mid-card");
    expect(close).toContain('href="/live/build-along"');
  });

  test("a waitlist offer shows no price and no strong tag", () => {
    const spec = { ...guideSpec, upsells: [{ offer: "next-cohort", placement: "close" as const }] };
    const card = html("close", [waitlist], spec);
    expect(card).toContain("A fixture waitlist offer.");
    expect(card).toContain('href="https://waitlist.test/join"');
    expect(card).not.toContain("<strong");
    expect(card).not.toContain("$");
  });

  test("bullets and the not-for line render only when the offer has them", () => {
    const rich = { ...real, bullets: ["Live build", "Q and A", "Recording"], notFor: "people who want a course" };
    const card = html("mid", [rich]);
    expect(card).toContain('<ul class="guide-offer-bullets">');
    expect(card).toContain("<li>Live build</li>");
    expect(card).toContain("Not for: people who want a course");
    expect(html("mid")).not.toContain("guide-offer-bullets");
  });

  test("a missing placement or an unknown offer throws, so the build fails", () => {
    expect(() => html("mid", undefined, { ...guideSpec, upsells: [{ offer: "build-along", placement: "close" }] })).toThrow(/no upsell for the "mid" placement/);
    expect(() => html("mid", [waitlist])).toThrow(/Unknown offer "build-along"/);
  });

  test("clicking the link tracks the original event name with placement, guide and offer id", () => {
    render(createElement(UpsellCard, { spec: guideSpec, placement: "close" }));
    const link = screen.getByRole("link", { name: "See the Build-Along" });
    link.addEventListener("click", (event) => event.preventDefault()); // jsdom cannot navigate
    fireEvent.click(link);
    expect(trackEvent).toHaveBeenCalledWith("guide_sprint_click", { placement: "close", guide: "5-to-9-builder", offerId: "build-along" });
  });
});
