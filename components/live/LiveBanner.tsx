"use client";

import Link from "next/link";
import { useSyncExternalStore, useState } from "react";
import {
  BUILD_ALONG,
  FREE_WEBINAR,
  UTM,
  liveUrls,
} from "@/lib/live/config";
import { livePriceAt } from "@/lib/live/pricing";
import {
  bannerDayLabel,
  bannerPhase,
  salesOpen,
} from "@/lib/live/schedule";

const DISMISS_KEY = "wmvp-live-banner-dismissed";
const DISMISS_MS = 7 * 24 * 60 * 60 * 1000;

type BannerContent = {
  eyebrow: string;
  line: string;
  label: string | null;
  ctaLabel: string;
  ctaHref: string | null;
  ctaExternal?: boolean;
};

function contentAt(now: number): BannerContent | null {
  const phase = bannerPhase(now);
  if (phase === "hidden") return null;

  const urls = liveUrls();
  const day = bannerDayLabel(now);
  const price = livePriceAt(now);

  if (phase === "live_now") {
    return {
      eyebrow: "Live now",
      line: `${FREE_WEBINAR.title} — on YouTube.`,
      label: day,
      ctaLabel: "Watch on YouTube",
      ctaHref: urls.youtubeLiveUrl || null,
      ctaExternal: true,
    };
  }

  if (phase === "free_promo") {
    return {
      eyebrow: "Live · Free",
      line: `${FREE_WEBINAR.title}. Sat 31 Oct, 16:00 GMT.`,
      label: day,
      ctaLabel: "Save my seat",
      ctaHref: `/live/48-hours?utm_source=${UTM.hubBanner}&utm_campaign=${UTM.free}`,
    };
  }

  if (phase === "paid_early") {
    const open = salesOpen(now);
    return {
      eyebrow: "Weekend MVP Build-Along",
      line: `${BUILD_ALONG.subline} Live on Zoom, Sat 14 Nov, 15:00 GMT.`,
      label: `${price.priceLine} · 20 seats`,
      ctaLabel: open ? "See the build-along" : "Tickets open Sun 1 Nov",
      ctaHref: open
        ? `/live/build-along?utm_source=${UTM.hubBanner}&utm_campaign=${UTM.paid}`
        : null,
    };
  }

  return {
    eyebrow: "Weekend MVP Build-Along",
    line: "2 hours. Your idea. Built live on Sat 14 Nov, 15:00 GMT.",
    label: `$${BUILD_ALONG.standardUsd} · Replay included`,
    ctaLabel: "Get my ticket",
    ctaHref: `/live/build-along?utm_source=${UTM.hubBanner}&utm_campaign=${UTM.paid}`,
  };
}

function readDismissed(): boolean {
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    if (!raw) return false;
    const until = Number.parseInt(raw, 10);
    return Number.isFinite(until) && Date.now() < until;
  } catch {
    return false;
  }
}

function subscribeDismiss(onStoreChange: () => void): () => void {
  window.addEventListener("storage", onStoreChange);
  return () => window.removeEventListener("storage", onStoreChange);
}

/**
 * Dismissible banner under the nav on /build-with/* and /ideas-for/non-technical.
 * Auto-hides after the build-along starts (14 Nov 15:00 GMT).
 */
export function LiveBanner() {
  const [now] = useState(() => Date.now());
  const dismissed = useSyncExternalStore(subscribeDismiss, readDismissed, () => true);
  const [, bump] = useState(0);

  if (dismissed) return null;
  const content = contentAt(now);
  if (!content) return null;

  function dismiss() {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now() + DISMISS_MS));
    } catch {
      /* ignore */
    }
    bump((n) => n + 1);
  }

  // Re-read after local dismiss (same-tab storage events don't fire).
  if (readDismissed()) return null;

  const cta = content.ctaHref ? (
    content.ctaExternal ? (
      <a
        href={content.ctaHref}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-[#A84A00] underline-offset-2 hover:underline"
      >
        {content.ctaLabel}
        <span aria-hidden="true">↗</span>
        <span className="sr-only">(opens in a new tab)</span>
      </a>
    ) : (
      <Link
        href={content.ctaHref}
        className="inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-[#A84A00] underline-offset-2 hover:underline"
      >
        {content.ctaLabel}
        <span aria-hidden="true">→</span>
      </Link>
    )
  ) : (
    <span className="shrink-0 text-sm text-[#6B6457]">{content.ctaLabel}</span>
  );

  return (
    <div className="px-4 pb-0 pt-3 sm:px-6">
      <div
        role="region"
        aria-label="Live session"
        className="mx-auto flex max-w-[896px] flex-wrap items-center gap-x-4 gap-y-2 rounded-full border border-home-rule bg-[#FCFAF7]/90 px-4 py-2.5 shadow-sm backdrop-blur-md sm:px-5"
      >
        <div className="min-w-0 flex-1">
          <div className="font-mono text-[10px] tracking-[0.08em] text-home-orange uppercase">
            {content.eyebrow}
            {content.label ? (
              <span className="ml-2 text-[#6B6457] normal-case tracking-normal">
                · {content.label}
              </span>
            ) : null}
          </div>
          <p className="truncate text-sm text-home-ink sm:whitespace-normal">
            {content.line}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {cta}
          <button
            type="button"
            onClick={dismiss}
            className="rounded-full p-1.5 text-[#6B6457] hover:bg-home-sunk hover:text-home-ink"
            aria-label="Dismiss live banner for 7 days"
          >
            <span aria-hidden="true">✕</span>
          </button>
        </div>
      </div>
    </div>
  );
}
