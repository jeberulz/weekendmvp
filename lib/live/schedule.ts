import {
  BUILD_ALONG,
  EARLY_BIRD_ENDS_AT,
  FREE_WEBINAR,
  SALES_OPEN_AT,
} from "@/lib/live/config";

/** Hub / free / paid / banner phases driven by one clock. */

export type PriceTier = "early_bird" | "standard";

export function priceTierAt(nowMs: number): PriceTier {
  // Inclusive of the cut-off second (lookup key switches after 23:59:59Z).
  return nowMs <= EARLY_BIRD_ENDS_AT ? "early_bird" : "standard";
}

export function salesOpen(nowMs: number): boolean {
  return nowMs >= SALES_OPEN_AT;
}

export type FreeWebinarPhase =
  | "open"
  | "live"
  | "replay"
  | "ended";

export function freeWebinarPhase(nowMs: number): FreeWebinarPhase {
  if (nowMs < FREE_WEBINAR.startAt) return "open";
  if (nowMs < FREE_WEBINAR.endAt) return "live";
  if (nowMs < FREE_WEBINAR.replayEndsAt) return "replay";
  return "ended";
}

export type BuildAlongPhase =
  | "pre_sale"
  | "on_sale"
  | "live"
  | "ended";

export function buildAlongPhase(nowMs: number): BuildAlongPhase {
  if (nowMs < SALES_OPEN_AT) return "pre_sale";
  if (nowMs < BUILD_ALONG.startAt) return "on_sale";
  if (nowMs < BUILD_ALONG.endAt) return "live";
  return "ended";
}

/**
 * Banner phases (spec d). Auto-hides from Sat 14 Nov 15:00 GMT
 * (build-along start) — no phase-4 Starter Kit banner.
 */
export type BannerPhase =
  | "free_promo"
  | "live_now"
  | "paid_early"
  | "paid_standard"
  | "hidden";

export function bannerPhase(nowMs: number): BannerPhase {
  if (nowMs >= BUILD_ALONG.startAt) return "hidden";
  if (nowMs >= FREE_WEBINAR.startAt && nowMs < FREE_WEBINAR.endAt) return "live_now";
  if (nowMs < FREE_WEBINAR.endAt) return "free_promo";
  if (nowMs <= EARLY_BIRD_ENDS_AT) return "paid_early";
  return "paid_standard";
}

/** Days until an instant, for banner labels. Null if not useful. */
export function daysUntil(targetMs: number, nowMs: number): number | null {
  const ms = targetMs - nowMs;
  if (ms <= 0) return null;
  const days = Math.ceil(ms / (24 * 60 * 60 * 1000));
  if (days <= 0) return null;
  return days;
}

export function bannerDayLabel(nowMs: number): string | null {
  const phase = bannerPhase(nowMs);
  if (phase === "live_now") return "Live now";
  if (phase === "free_promo") {
    const start = FREE_WEBINAR.startAt;
    const days = daysUntil(start, nowMs);
    if (days === null) {
      const sameDay =
        new Date(nowMs).toISOString().slice(0, 10) ===
        new Date(start).toISOString().slice(0, 10);
      return sameDay ? "Today, 16:00 GMT" : null;
    }
    if (days === 1) return "Starts tomorrow";
    return `Starts in ${days} days`;
  }
  if (phase === "paid_early" || phase === "paid_standard") {
    const start = BUILD_ALONG.startAt;
    const days = daysUntil(start, nowMs);
    if (days === null) {
      const sameDay =
        new Date(nowMs).toISOString().slice(0, 10) ===
        new Date(start).toISOString().slice(0, 10);
      return sameDay ? "Today, 15:00 GMT" : null;
    }
  }
  return null;
}
