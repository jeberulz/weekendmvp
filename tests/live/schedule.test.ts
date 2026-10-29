import { describe, expect, test } from "vitest";
import {
  BUILD_ALONG,
  EARLY_BIRD_ENDS_AT,
  FREE_WEBINAR,
  SALES_OPEN_AT,
  freeWebinarTitlePlain,
  liveBuildAlongHref,
  liveFreeHref,
} from "@/lib/live/config";
import { livePriceAt } from "@/lib/live/pricing";
import {
  bannerDayLabel,
  bannerPhase,
  buildAlongPhase,
  freeWebinarPhase,
  priceTierAt,
  salesOpen,
} from "@/lib/live/schedule";
import { seatsFromSold, seatsLine } from "@/lib/live/seats";

describe("free webinar title", () => {
  test("canonical title and Free-badged plain form", () => {
    expect(FREE_WEBINAR.title).toBe("Build a real app live in one hour (free)");
    expect(freeWebinarTitlePlain()).toBe("Build a real app live in one hour");
  });
});

describe("live schedule", () => {
  test("early-bird inclusive through 23:59:59 GMT Sun 8 Nov 2026", () => {
    expect(priceTierAt(EARLY_BIRD_ENDS_AT - 1)).toBe("early_bird");
    expect(priceTierAt(EARLY_BIRD_ENDS_AT)).toBe("early_bird");
    expect(priceTierAt(EARLY_BIRD_ENDS_AT + 1)).toBe("standard");
    expect(livePriceAt(EARLY_BIRD_ENDS_AT).amountUsd).toBe(19);
    expect(livePriceAt(EARLY_BIRD_ENDS_AT + 1).amountUsd).toBe(29);
  });

  test("sales open Sun 1 Nov", () => {
    expect(salesOpen(SALES_OPEN_AT - 1)).toBe(false);
    expect(salesOpen(SALES_OPEN_AT)).toBe(true);
    expect(buildAlongPhase(SALES_OPEN_AT - 1)).toBe("pre_sale");
    expect(buildAlongPhase(SALES_OPEN_AT)).toBe("on_sale");
  });

  test("free webinar live hour and banner auto-hide", () => {
    expect(freeWebinarPhase(FREE_WEBINAR.startAt - 1)).toBe("open");
    expect(freeWebinarPhase(FREE_WEBINAR.startAt)).toBe("live");
    expect(freeWebinarPhase(FREE_WEBINAR.endAt)).toBe("replay");
    expect(bannerPhase(FREE_WEBINAR.startAt)).toBe("live_now");
    expect(bannerPhase(FREE_WEBINAR.endAt)).toBe("paid_early");
    expect(bannerPhase(BUILD_ALONG.startAt)).toBe("hidden");
  });

  test("banner day labels use GMT calendar days (never 0/negative)", () => {
    expect(bannerDayLabel(Date.parse("2026-10-28T12:00:00.000Z"))).toBe(
      "Starts in 3 days",
    );
    expect(bannerDayLabel(Date.parse("2026-10-30T12:00:00.000Z"))).toBe(
      "Starts tomorrow",
    );
    expect(bannerDayLabel(Date.parse("2026-10-31T10:00:00.000Z"))).toBe(
      "Today, 16:00 GMT",
    );
    expect(bannerDayLabel(FREE_WEBINAR.startAt - 60_000)).toBe(
      "Today, 16:00 GMT",
    );
    expect(bannerDayLabel(FREE_WEBINAR.startAt)).toBe("Live now");
  });
});

describe("live href helpers", () => {
  test("liveFreeHref tags source + placement", () => {
    expect(liveFreeHref({ src: "bw-claude", placement: "hero" })).toBe(
      "/live/48-hours?utm_source=bw-claude&utm_medium=site&utm_campaign=live-w1&utm_content=hero",
    );
    expect(liveFreeHref({ src: "bw-lovable", placement: "end" })).toContain(
      "utm_content=end",
    );
  });

  test("liveBuildAlongHref uses paid campaign", () => {
    expect(liveBuildAlongHref({ src: "bw-cursor", placement: "hero" })).toBe(
      "/live/build-along?utm_source=bw-cursor&utm_medium=site&utm_campaign=live-p1&utm_content=hero",
    );
  });
});

describe("live seats copy", () => {
  test("follows the design table", () => {
    expect(seatsLine(seatsFromSold(null))).toBe("20 seats only.");
    expect(seatsLine(seatsFromSold(0))).toBe("20 seats. 20 left.");
    expect(seatsLine(seatsFromSold(14))).toBe("20 seats. 6 left.");
    expect(seatsLine(seatsFromSold(15))).toBe("Only 5 seats left.");
    expect(seatsLine(seatsFromSold(16))).toBe("Only 4 seats left.");
    expect(seatsLine(seatsFromSold(19))).toBe("Last seat.");
    expect(seatsFromSold(20).soldOut).toBe(true);
  });
});
