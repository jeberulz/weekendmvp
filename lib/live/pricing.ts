import { BUILD_ALONG, EARLY_BIRD_ENDS_AT } from "@/lib/live/config";
import { priceTierAt, type PriceTier } from "@/lib/live/schedule";

export type LivePrice = {
  tier: PriceTier;
  amountUsd: number;
  /** Short label for CTAs: "$19" / "$29" */
  amountLabel: string;
  /**
   * Full early-bird line used everywhere until the cut-off.
   * After cut-off: just "$29".
   */
  priceLine: string;
  /** Hero/button microcopy variant. */
  untilLine: string | null;
  earlyBird: boolean;
};

export function livePriceAt(nowMs: number): LivePrice {
  const tier = priceTierAt(nowMs);
  if (tier === "early_bird") {
    return {
      tier,
      amountUsd: BUILD_ALONG.earlyBirdUsd,
      amountLabel: `$${BUILD_ALONG.earlyBirdUsd}`,
      priceLine: `$${BUILD_ALONG.earlyBirdUsd} until 23:59 GMT Sun 8 Nov, then $${BUILD_ALONG.standardUsd}`,
      untilLine: `until 23:59 GMT Sun 8 Nov, then $${BUILD_ALONG.standardUsd}`,
      earlyBird: true,
    };
  }
  return {
    tier,
    amountUsd: BUILD_ALONG.standardUsd,
    amountLabel: `$${BUILD_ALONG.standardUsd}`,
    priceLine: `$${BUILD_ALONG.standardUsd}`,
    untilLine: null,
    earlyBird: false,
  };
}

export { EARLY_BIRD_ENDS_AT, priceTierAt };
export type { PriceTier };
