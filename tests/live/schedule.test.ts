import { describe, expect, test } from "vitest";
import {
  BUILD_ALONG,
  EARLY_BIRD_ENDS_AT,
  FREE_WEBINAR,
  SALES_OPEN_AT,
} from "@/lib/live/config";
import { livePriceAt } from "@/lib/live/pricing";
import {
  bannerPhase,
  buildAlongPhase,
  freeWebinarPhase,
  priceTierAt,
  salesOpen,
} from "@/lib/live/schedule";
import { seatsFromSold, seatsLine } from "@/lib/live/seats";

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
    expect(bannerPhase(BUILD_ALONG.startAt)).toBe("hidden");
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
