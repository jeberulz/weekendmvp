import { cacheLife, cacheTag } from "next/cache";
import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import { LIVE_EVENT_KEY, SEATS_TOTAL, seatsSoldOverride } from "@/lib/live/config";
import { seatsFromSold, type SeatsInfo } from "@/lib/live/seats";
import { LIVE_SEATS_CACHE_TAG } from "@/lib/live/stripe-catalog";

/**
 * Cached public seats-left read. Tag-invalidated by the workshop webhook /
 * reconcile. No client useQuery / polling — keeps Convex Free I/O lean.
 *
 * Override via LIVE_SEATS_SOLD when a live count isn't feasible.
 */
export async function loadSeatsInfo(): Promise<SeatsInfo> {
  const override = seatsSoldOverride(process.env);
  if (override !== null) return seatsFromSold(override);

  return await loadSeatsInfoCached();
}

async function loadSeatsInfoCached(): Promise<SeatsInfo> {
  "use cache";
  cacheTag(LIVE_SEATS_CACHE_TAG);
  cacheLife("minutes");

  try {
    const row = await fetchQuery(api.live.workshopQueries.seatCount, {
      eventKey: LIVE_EVENT_KEY,
    });
    // No counter row yet (seats not seeded) → copy reads "20 seats only."
    if (!row) return seatsFromSold(null);
    // Available to buy = free seats (reserved holds reduce the shown left).
    const left = Math.max(0, Math.min(SEATS_TOTAL, row.free));
    return seatsFromSold(SEATS_TOTAL - left);
  } catch {
    return seatsFromSold(null);
  }
}
