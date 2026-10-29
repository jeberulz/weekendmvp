import type { ReactNode } from "react";

import { LocalTime } from "@/components/live/LocalTime";
import type { LiveFaqItem } from "@/components/live/LiveFaq";
import {
  BUILD_ALONG,
  FREE_WEBINAR,
  freeWebinarTitlePlain,
  LIVE_ASSETS,
  NEXT_BUILD_ALONG,
  STARTUP_IDEAS_HREF,
} from "@/lib/live/config";
import type { LivePrice } from "@/lib/live/pricing";
import type {
  BuildAlongPhase,
  FreeWebinarPhase,
} from "@/lib/live/schedule";
import type { SeatsInfo } from "@/lib/live/seats";
import { seatsLine } from "@/lib/live/seats";

export const LIVE_HUB_PATH = "/live";
export const FREE_HUB_HREF = "/live/48-hours";
export const PAID_HUB_HREF = "/live/build-along";
export const STARTER_KIT_HREF = "/starter-kit";

export const HUB_META = {
  title: "Weekend MVP Live — free webinar & build-along",
  description:
    "Free and paid live sessions where we take one idea from a page to a live link. Free webinar Sat 31 Oct, build-along Sat 14 Nov. Times in GMT.",
} as const;

/** Host blurb — evenings sentence only when confirmed. */
export function hostBody(): string {
  if (LIVE_ASSETS.hostEveningsConfirmed) {
    return "I build Weekend MVP around a full-time job, on evenings and Saturdays. I started it to close the gap between “I have an idea” and “here's a live URL”.";
  }
  return "I started it to close the gap between “I have an idea” and “here's a live URL”.";
}

export function hubFaqItems(): LiveFaqItem[] {
  return [
    {
      question: "Are the sessions really live?",
      answer:
        "Yes. The free webinar streams on YouTube Live, and the link is public during the live hour, so anyone can watch. The build-along runs on Zoom so we can actually work together.",
    },
    {
      question: "Do I need to register for the free webinar?",
      answer:
        "Not to watch live. Registering gets you reminders and the replay for 7 days.",
    },
    {
      question: "What's the difference between the free and paid sessions?",
      answer:
        "In the free webinar you watch: I explain the weekend test and take one idea to its first screen. In the build-along you build: two hours, your own idea, with me building one too.",
    },
    {
      question: "Can I watch the free webinar later?",
      answer:
        "Yes. Registrants get the replay for 7 days after the session. After that, an edited version goes up publicly on YouTube.",
    },
    {
      question: "Do I have to do the free one before the paid one?",
      answer:
        "No, but it helps. The build-along moves fast and assumes you've seen the weekend test once. If you can't make 31 Oct live, the replay works.",
    },
    {
      question: "What time is that for me?",
      answer: (
        <>
          <p>
            Every time on this page is GMT. The free webinar is Sat 31 Oct at
            16:00 GMT (12:00 New York, 09:00 Los Angeles). The build-along is Sat
            14 Nov, 15:00–17:00 GMT (10:00–12:00 New York, 07:00–09:00 Los
            Angeles).
          </p>
          <LocalTime
            startMs={FREE_WEBINAR.startAt}
            className="mt-2 font-mono text-xs text-[#6B6457]"
          />
          <LocalTime
            startMs={BUILD_ALONG.startAt}
            endMs={BUILD_ALONG.endAt}
            className="font-mono text-xs text-[#6B6457]"
          />
        </>
      ),
    },
    {
      question: "Do I need to code?",
      answer:
        "No. Every session uses AI tools and copy-paste prompts. Knowing some code helps, but you don't need it.",
    },
    {
      question: "Will there be more sessions?",
      answer: `Yes. The next build-along is ${NEXT_BUILD_ALONG.label}. New free webinar dates will be listed here and sent to the newsletter once they're set.`,
    },
  ];
}

export type ChipTone = "default" | "live" | "ok" | "warn" | "off";

export type HubChip = { label: string; tone: ChipTone };

export type SessionSideCta =
  | {
      kind: "link";
      href: string;
      label: string;
      variant: "primary" | "secondary" | "ghost";
      external?: boolean;
      hint?: string;
      secondaryLink?: { href: string; label: string };
    }
  | {
      kind: "disabled";
      label: string;
      reminderHref?: string;
      reminderLabel?: string;
      hint?: string;
    };

export type HubSessionCard = {
  id: string;
  featured: boolean;
  month: string;
  day: string;
  weekday: string;
  chips: HubChip[];
  title: string;
  subline?: string;
  dateLine: string;
  cityLine: string;
  startMs: number;
  endMs?: number;
  /** Skip visitor-local time (e.g. TBD coming-soon card). */
  showLocalTime?: boolean;
  oneLine: string;
  replayLine?: string;
  seatsLine?: string;
  sidePrice: ReactNode;
  sideExtra?: ReactNode;
  cta: SessionSideCta;
};

export function freeSeatsHubLine(
  salesAreOpen: boolean,
  seats: SeatsInfo,
): string {
  if (!salesAreOpen || seats.sold === null) return "20 seats only.";
  return seatsLine(seats);
}

function freeCard(
  phase: FreeWebinarPhase,
  urls: { youtubeLiveUrl: string; youtubeReplayUrl: string },
): HubSessionCard | null {
  const base = {
    id: "free",
    month: "OCT",
    day: "31",
    weekday: "SAT",
    // Plain title — chips / sidePrice already say Free.
    title: freeWebinarTitlePlain(),
    dateLine: "Sat 31 Oct 2026 · 16:00 GMT · 60 min",
    cityLine: "12:00 New York · 09:00 Los Angeles",
    startMs: FREE_WEBINAR.startAt,
    oneLine:
      "The weekend test, one real idea taken to its first screen live, and the 48-hour plan.",
  } as const;

  if (phase === "open") {
    return {
      ...base,
      featured: true,
      chips: [
        { label: "Free webinar · YouTube Live", tone: "live" },
        { label: "Registration open", tone: "ok" },
      ],
      replayLine:
        "Free to watch live on YouTube, no sign-up needed. Register for reminders and the 7-day replay. After that, an edited version goes up on YouTube.",
      sidePrice: "Free",
      cta: {
        kind: "link",
        href: FREE_HUB_HREF,
        label: "Save my free seat",
        variant: "primary",
        hint: "Goes to the webinar page; registration is on Luma",
      },
    };
  }

  if (phase === "live") {
    const watchHref = urls.youtubeLiveUrl || FREE_HUB_HREF;
    return {
      ...base,
      featured: true,
      chips: [
        { label: "LIVE NOW", tone: "live" },
        { label: "YouTube Live", tone: "ok" },
      ],
      replayLine:
        "The YouTube link is public during the live hour. Register for the 7-day replay.",
      sidePrice: "Free",
      cta: {
        kind: "link",
        href: watchHref,
        label: urls.youtubeLiveUrl
          ? "Watch live on YouTube"
          : "Save my free seat",
        variant: "primary",
        external: Boolean(urls.youtubeLiveUrl),
        secondaryLink: {
          href: FREE_HUB_HREF,
          label: "Register for the 7-day replay",
        },
      },
    };
  }

  if (phase === "replay") {
    return {
      ...base,
      featured: false,
      chips: [
        { label: "Free webinar · YouTube Live", tone: "default" },
        { label: "Replay for registrants", tone: "ok" },
      ],
      replayLine:
        "Replay available to registrants for 7 days. After that, an edited version goes up on YouTube.",
      sidePrice: "Ended",
      cta: {
        kind: "disabled",
        label: "Replay for registrants",
        hint: "Check your email if you registered",
      },
    };
  }

  // ended
  if (urls.youtubeReplayUrl) {
    return {
      ...base,
      featured: false,
      chips: [
        { label: "Free webinar", tone: "off" },
        { label: "Public replay", tone: "ok" },
      ],
      replayLine: "An edited replay is on YouTube.",
      sidePrice: "Replay",
      cta: {
        kind: "link",
        href: urls.youtubeReplayUrl,
        label: "Watch the replay on YouTube",
        variant: "secondary",
        external: true,
      },
    };
  }

  return {
    ...base,
    featured: false,
    chips: [
      { label: "Free webinar", tone: "off" },
      { label: "Ended", tone: "off" },
    ],
    replayLine:
      "This session has ended. An edited replay is coming to YouTube.",
    sidePrice: "Ended",
    cta: {
      kind: "link",
      href: STARTUP_IDEAS_HREF,
      label: "Browse free ideas",
      variant: "secondary",
    },
  };
}

function paidCard(
  phase: BuildAlongPhase,
  price: LivePrice,
  seats: SeatsInfo,
  salesAreOpen: boolean,
): HubSessionCard | null {
  const seatsText = freeSeatsHubLine(salesAreOpen, seats);
  const priceNode =
    price.earlyBird ? (
      <>
        {price.amountLabel}{" "}
        <span className="font-sans text-sm font-normal text-[#6B6457]">
          {price.untilLine}
        </span>
      </>
    ) : (
      price.amountLabel
    );

  const base = {
    id: "paid",
    month: "NOV",
    day: "14",
    weekday: "SAT",
    title: BUILD_ALONG.title,
    subline: BUILD_ALONG.subline,
    dateLine: "Sat 14 Nov 2026 · 15:00–17:00 GMT · 2 hours",
    cityLine: "10:00–12:00 New York · 07:00–09:00 Los Angeles",
    startMs: BUILD_ALONG.startAt,
    endMs: BUILD_ALONG.endAt,
    oneLine:
      "Bring an idea (or pick one from the library). We scope it and build it together, live, and you build yours alongside me.",
    replayLine: "Replay included, yours to keep.",
    seatsLine: seatsText,
    sideExtra: (
      <>
        <p className="text-center text-xs text-[#6B6457]">
          Price shown in USD. Any tax is shown at checkout.
        </p>
      </>
    ),
  };

  if (phase === "ended") {
    return {
      ...base,
      featured: false,
      chips: [
        { label: "Paid build-along · Zoom", tone: "off" },
        { label: "Ended", tone: "off" },
      ],
      sidePrice: price.amountLabel,
      oneLine:
        "This build-along has ended. Ticket holders: your replay is in your email.",
      cta: {
        kind: "link",
        href: STARTUP_IDEAS_HREF,
        label: "Browse free ideas",
        variant: "secondary",
        secondaryLink: {
          href: STARTER_KIT_HREF,
          label: "Get the free Starter Kit",
        },
      },
    };
  }

  if (phase === "pre_sale") {
    return {
      ...base,
      featured: false,
      chips: [
        { label: "Paid build-along · Zoom", tone: "default" },
        { label: "Tickets open Sun 1 Nov", tone: "warn" },
      ],
      sidePrice: priceNode,
      cta: {
        kind: "disabled",
        label: "Tickets open Sun 1 Nov",
        reminderHref: FREE_HUB_HREF,
        reminderLabel: "Get a reminder",
      },
    };
  }

  if (seats.soldOut) {
    return {
      ...base,
      featured: true,
      chips: [
        { label: "Paid build-along · Zoom", tone: "default" },
        { label: "Sold out", tone: "off" },
      ],
      sidePrice: priceNode,
      seatsLine: "Sold out",
      oneLine: `All 20 seats are taken. The next build-along is ${NEXT_BUILD_ALONG.label}. Same 2 hours, same price rules, 20 seats.`,
      cta: {
        kind: "disabled",
        label: "Sold out",
        hint: `Next: ${NEXT_BUILD_ALONG.shortLabel}`,
      },
    };
  }

  if (phase === "live") {
    return {
      ...base,
      featured: true,
      chips: [
        { label: "Paid build-along · Zoom", tone: "live" },
        { label: "Live now", tone: "live" },
      ],
      sidePrice: priceNode,
      cta: {
        kind: "link",
        href: PAID_HUB_HREF,
        label: "See the build-along",
        variant: "primary",
      },
    };
  }

  // on_sale
  return {
    ...base,
    featured: true,
    chips: [
      { label: "Paid build-along · Zoom", tone: "default" },
      { label: "On sale", tone: "ok" },
    ],
    sidePrice: priceNode,
    cta: {
      kind: "link",
      href: PAID_HUB_HREF,
      label: "See the build-along",
      variant: "primary",
    },
  };
}

function nextBuildAlongCard(): HubSessionCard {
  return {
    id: "next-paid",
    featured: true,
    month: "DEC",
    day: "5",
    weekday: "SAT",
    chips: [
      { label: "Paid build-along · Zoom", tone: "default" },
      { label: "Next session", tone: "ok" },
    ],
    title: "Next build-along",
    subline: BUILD_ALONG.subline,
    dateLine: `${NEXT_BUILD_ALONG.label} · 2 hours`,
    cityLine: "",
    startMs: NEXT_BUILD_ALONG.startAt,
    endMs: NEXT_BUILD_ALONG.endAt,
    oneLine: `Next build-along: ${NEXT_BUILD_ALONG.label}. Same 2 hours, same price rules, 20 seats.`,
    seatsLine: "20 seats only.",
    sidePrice: "Soon",
    cta: {
      kind: "link",
      href: STARTUP_IDEAS_HREF,
      label: "Browse free ideas",
      variant: "secondary",
      secondaryLink: {
        href: STARTER_KIT_HREF,
        label: "Get the free Starter Kit",
      },
    },
  };
}

function nextFreeComingSoonCard(): HubSessionCard {
  return {
    id: "next-free",
    featured: false,
    month: "—",
    day: "·",
    weekday: "TBD",
    chips: [
      { label: "Free webinar", tone: "off" },
      { label: "Coming soon", tone: "warn" },
    ],
    title: "Next free webinar coming soon",
    dateLine: "Date to be announced",
    cityLine: "",
    startMs: FREE_WEBINAR.startAt,
    showLocalTime: false,
    oneLine:
      "New free webinar dates will be listed here and sent to the newsletter once they're set.",
    sidePrice: "Free",
    cta: {
      kind: "link",
      href: STARTUP_IDEAS_HREF,
      label: "Browse free ideas",
      variant: "ghost",
    },
  };
}

/**
 * Upcoming cards in display order. After the free session ends, paid moves
 * first. After paid ends, show next build-along + coming-soon free.
 */
export function upcomingCards(opts: {
  nowMs: number;
  freePhase: FreeWebinarPhase;
  paidPhase: BuildAlongPhase;
  price: LivePrice;
  seats: SeatsInfo;
  salesAreOpen: boolean;
  urls: { youtubeLiveUrl: string; youtubeReplayUrl: string };
}): HubSessionCard[] {
  const { freePhase, paidPhase, price, seats, salesAreOpen, urls } = opts;

  if (paidPhase === "ended") {
    return [nextBuildAlongCard(), nextFreeComingSoonCard()];
  }

  const free = freeCard(freePhase, urls);
  const paid = paidCard(paidPhase, price, seats, salesAreOpen);
  const cards = [free, paid].filter(Boolean) as HubSessionCard[];

  // After free ends (replay/ended), paid first.
  if (freePhase === "replay" || freePhase === "ended") {
    cards.sort((a, b) => (a.id === "paid" ? -1 : b.id === "paid" ? 1 : 0));
  }

  return cards;
}
