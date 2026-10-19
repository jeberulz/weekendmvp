"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  BUILD_ALONG,
  FREE_WEBINAR,
  liveBuildAlongHref,
  liveFreeHref,
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

const WEBINAR_DATETIME = "2026-10-31T16:00:00Z";
const WEBINAR_SR =
  " for Ship a Weekend MVP in 48 Hours, Saturday 31 October, 16:00 GMT";

export type LiveBannerHeroCopy = {
  headline: string;
  body: string;
  cta: string;
};

type BannerContent = {
  eyebrow: string;
  line: string;
  body: string | null;
  label: string | null;
  ctaLabel: string;
  ctaHref: string | null;
  ctaExternal?: boolean;
  ctaSr?: string | null;
  dateTime?: string | null;
};

function contentAt(
  now: number,
  src: string,
  copy: LiveBannerHeroCopy | undefined,
): BannerContent | null {
  const phase = bannerPhase(now);
  if (phase === "hidden") return null;

  const urls = liveUrls();
  const day = bannerDayLabel(now);
  const price = livePriceAt(now);

  if (phase === "live_now") {
    return {
      eyebrow: "Live now",
      line: `${FREE_WEBINAR.title} — on YouTube.`,
      body: null,
      label: day,
      ctaLabel: "Watch on YouTube",
      ctaHref: urls.youtubeLiveUrl || null,
      ctaExternal: true,
      ctaSr: null,
      dateTime: WEBINAR_DATETIME,
    };
  }

  if (phase === "free_promo") {
    if (copy) {
      return {
        eyebrow: "Live · Free",
        line: copy.headline,
        body: copy.body,
        label: day,
        ctaLabel: copy.cta,
        ctaHref: liveFreeHref({ src, placement: "hero" }),
        ctaSr: WEBINAR_SR,
        dateTime: WEBINAR_DATETIME,
      };
    }
    return {
      eyebrow: "Live · Free",
      line: `${FREE_WEBINAR.title}. Sat 31 Oct, 16:00 GMT.`,
      body: null,
      label: day,
      ctaLabel: "Save my seat",
      ctaHref: liveFreeHref({ src, placement: "hero" }),
      ctaSr: WEBINAR_SR,
      dateTime: WEBINAR_DATETIME,
    };
  }

  if (phase === "paid_early") {
    const open = salesOpen(now);
    return {
      eyebrow: "Weekend MVP Build-Along",
      line: `${BUILD_ALONG.subline} Live on Zoom, Sat 14 Nov, 15:00 GMT.`,
      body: null,
      label: `${price.priceLine} · 20 seats`,
      ctaLabel: open ? "See the build-along" : "Tickets open Sun 1 Nov",
      ctaHref: open
        ? liveBuildAlongHref({ src, placement: "hero" })
        : null,
      ctaSr: null,
      dateTime: "2026-11-14T15:00:00Z",
    };
  }

  return {
    eyebrow: "Weekend MVP Build-Along",
    line: "2 hours. Your idea. Built live on Sat 14 Nov, 15:00 GMT.",
    body: null,
    label: `$${BUILD_ALONG.standardUsd} · Replay included`,
    ctaLabel: "Get my ticket",
    ctaHref: liveBuildAlongHref({ src, placement: "hero" }),
    ctaSr: null,
    dateTime: "2026-11-14T15:00:00Z",
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

const linkClass =
  "inline-flex min-h-11 shrink-0 items-center gap-1 text-sm font-semibold text-[#A84A00] underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#A84A00]";

const DATE_MARKERS: Array<{ needle: string; dateTime: string }> = [
  { needle: "Sat 31 Oct, 16:00 GMT", dateTime: WEBINAR_DATETIME },
  { needle: "Sat 14 Nov, 15:00 GMT", dateTime: "2026-11-14T15:00:00Z" },
];

function BannerText({
  text,
  dateTime,
}: {
  text: string;
  dateTime?: string | null;
}) {
  const marker = DATE_MARKERS.find((m) => text.includes(m.needle));
  if (!marker) return <>{text}</>;
  const [before, ...rest] = text.split(marker.needle);
  const after = rest.join(marker.needle);
  return (
    <>
      {before}
      <time dateTime={dateTime || marker.dateTime}>{marker.needle}</time>
      {after}
    </>
  );
}

/**
 * Dismissible banner after the header on /build-with/* and /ideas-for/non-technical.
 * Auto-hides after the build-along starts (14 Nov 15:00 GMT).
 * Pass `copy` for per-tool free_promo headlines on the top hubs.
 */
export function LiveBanner({
  src = "hub",
  copy,
}: {
  /** utm_source, e.g. bw-claude */
  src?: string;
  /** Per-tool free_promo copy. Omit → generic free line. */
  copy?: LiveBannerHeroCopy;
}) {
  // Fresh Date.now() on mount + every minute so phase/auto-hide tracks wall
  // clock even when CachedToolHub HTML is still cached for days.
  const [now, setNow] = useState(() => Date.now());
  // Start false so SSR + first client paint can show the banner; honor
  // localStorage dismiss after mount (brief flash for dismissed visitors).
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    setNow(Date.now());
    if (readDismissed()) setDismissed(true);
    const id = window.setInterval(() => setNow(Date.now()), 60_000);
    function onStorage() {
      if (readDismissed()) setDismissed(true);
    }
    window.addEventListener("storage", onStorage);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  if (dismissed) return null;
  const content = contentAt(now, src, copy);
  if (!content) return null;

  function dismiss() {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now() + DISMISS_MS));
    } catch {
      /* ignore */
    }
    setDismissed(true);
  }

  const ctaInner = (
    <>
      {content.ctaLabel}
      {content.ctaExternal ? (
        <span aria-hidden="true">↗</span>
      ) : (
        <span aria-hidden="true">→</span>
      )}
      {content.ctaExternal ? (
        <span className="sr-only">(opens in a new tab)</span>
      ) : null}
      {content.ctaSr ? <span className="sr-only">{content.ctaSr}</span> : null}
    </>
  );

  const cta = content.ctaHref ? (
    content.ctaExternal ? (
      <a
        href={content.ctaHref}
        target="_blank"
        rel="noopener noreferrer"
        className={linkClass}
      >
        {ctaInner}
      </a>
    ) : (
      <Link href={content.ctaHref} className={linkClass}>
        {ctaInner}
      </Link>
    )
  ) : (
    <span className="inline-flex min-h-11 shrink-0 items-center text-sm text-[#6B6457]">
      {content.ctaLabel}
    </span>
  );

  const pillShape = content.body
    ? "rounded-2xl sm:rounded-2xl"
    : "rounded-full";

  return (
    <div className="px-4 pb-0 pt-3 sm:px-6">
      <div
        role="region"
        aria-label="Free live webinar"
        className={`mx-auto flex max-w-[896px] flex-wrap items-center gap-x-4 gap-y-2 border border-home-rule bg-[#FCFAF7]/90 px-4 py-2.5 shadow-sm backdrop-blur-md sm:px-5 ${pillShape}`}
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
          <p className="text-sm text-home-ink">
            <BannerText text={content.line} dateTime={content.dateTime} />
          </p>
          {content.body ? (
            <p className="mt-0.5 hidden text-xs text-[#6B6457] sm:block">
              <BannerText text={content.body} dateTime={WEBINAR_DATETIME} />
            </p>
          ) : null}
        </div>
        <div className="flex items-center gap-3">
          {cta}
          <button
            type="button"
            onClick={dismiss}
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full p-1.5 text-[#6B6457] hover:bg-home-sunk hover:text-home-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-home-ink"
            aria-label="Dismiss live banner for 7 days"
          >
            <span aria-hidden="true">✕</span>
          </button>
        </div>
      </div>
    </div>
  );
}
