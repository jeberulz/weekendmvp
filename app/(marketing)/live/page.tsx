import type { Metadata } from "next";
import { connection } from "next/server";
import Link from "next/link";

import { DateTile } from "@/components/live/DateTile";
import { HostBlock } from "@/components/live/HostBlock";
import { LiveButton } from "@/components/live/LiveButton";
import { LiveFaq } from "@/components/live/LiveFaq";
import { LocalTime } from "@/components/live/LocalTime";
import { live } from "@/components/live/tokens";
import { newsreaderEditorial } from "@/lib/fonts";
import { STARTUP_IDEAS_HREF, liveUrls } from "@/lib/live/config";
import { livePriceAt } from "@/lib/live/pricing";
import {
  buildAlongPhase,
  freeWebinarPhase,
  salesOpen,
} from "@/lib/live/schedule";
import { loadSeatsInfo } from "@/lib/live/seats-server";
import { readLiveClockMs } from "@/lib/live/now";
import { SITE } from "@/lib/seo";
import { cn } from "@/lib/utils";

import {
  FREE_HUB_HREF,
  HUB_META,
  LIVE_HUB_PATH,
  PAID_HUB_HREF,
  STARTER_KIT_HREF,
  type ChipTone,
  type HubChip,
  type HubSessionCard,
  hostBody,
  hubFaqItems,
  upcomingCards,
} from "./live-hub-data";

export const instant = false;

export const metadata: Metadata = {
  title: { absolute: HUB_META.title },
  description: HUB_META.description,
  alternates: { canonical: LIVE_HUB_PATH },
  openGraph: {
    type: "website",
    siteName: "Weekend MVP",
    locale: "en_GB",
    url: LIVE_HUB_PATH,
    title: HUB_META.title,
    description: HUB_META.description,
    images: [
      {
        url: `${SITE}/image/og-image.png`,
        alt: "Weekend MVP Live",
        type: "image/png",
        width: 1200,
        height: 630,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    site: "@weekendmvp",
    title: HUB_META.title,
    description: HUB_META.description,
    images: [
      {
        url: `${SITE}/image/og-image.png`,
        alt: "Weekend MVP Live",
      },
    ],
  },
};

const CHIP_STYLES: Record<ChipTone, string> = {
  default:
    "border-home-rule bg-home-card text-[#4A453C]",
  live: "border-home-ink bg-home-ink text-white before:mr-1.5 before:inline-block before:size-1.5 before:rounded-full before:bg-home-orange-light",
  ok: "border-[#c5d3bc] bg-[#DCE6D5] text-[#2f4a2a]",
  warn: "border-[#e0cc9a] bg-[#F2E1B8] text-[#5c4511]",
  off: "border-home-rule bg-home-sunk text-[#6B6457]",
};

function StatusChip({ chip }: { chip: HubChip }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-1 font-mono text-[11px] tracking-[0.08em] uppercase",
        CHIP_STYLES[chip.tone],
        chip.tone === "live" && "before:content-['']",
      )}
    >
      {chip.label}
    </span>
  );
}

function SessionCard({ card }: { card: HubSessionCard }) {
  return (
    <article
      className={cn(
        "grid grid-cols-[68px_1fr] items-start gap-4 rounded-2xl border bg-home-card p-5 sm:gap-7 sm:p-7 lg:grid-cols-[68px_1fr_300px]",
        card.featured
          ? "border-[#e6b48c] shadow-[0_1px_0_#e6b48c,0_24px_48px_-28px_rgba(168,74,0,0.35)]"
          : "border-home-rule",
        "max-sm:[&_[data-side]]:col-span-2",
      )}
    >
      <DateTile month={card.month} day={card.day} weekday={card.weekday} />
      <div className="min-w-0">
        <div className="flex flex-wrap gap-2">
          {card.chips.map((c) => (
            <StatusChip key={c.label} chip={c} />
          ))}
        </div>
        <h3 className="font-editorial mt-2.5 text-[26px] leading-tight font-medium tracking-[-0.015em] sm:text-3xl">
          {card.title}
        </h3>
        {card.subline ? (
          <p className="font-editorial mt-1 text-xl text-home-orange italic">
            {card.subline}
          </p>
        ) : null}
        <div className="mt-2 flex flex-col gap-1.5 text-[15px] text-[#4A453C]">
          <p>
            <span className="font-semibold text-home-ink">{card.dateLine}</span>
          </p>
          {card.cityLine ? (
            <p className="font-mono text-xs text-[#6B6457]">
              {card.cityLine}
            </p>
          ) : null}
          {card.showLocalTime !== false ? (
            <LocalTime startMs={card.startMs} endMs={card.endMs} />
          ) : null}
          <p>{card.oneLine}</p>
          {card.replayLine ? (
            <p className="text-sm text-[#6B6457]">{card.replayLine}</p>
          ) : null}
          {card.seatsLine ? (
            <p className="text-sm">
              <span className="font-semibold">{card.seatsLine}</span>
            </p>
          ) : null}
        </div>
      </div>
      <div
        data-side
        className="flex flex-col items-stretch gap-2.5 lg:items-stretch"
      >
        <div className="font-editorial text-[34px] leading-none">
          {card.sidePrice}
        </div>
        {card.sideExtra}
        {card.cta.kind === "link" ? (
          <>
            <LiveButton
              href={card.cta.href}
              variant={card.cta.variant}
              external={card.cta.external}
            >
              {card.cta.label}
            </LiveButton>
            {card.cta.hint ? (
              <p className="text-center text-xs text-[#6B6457]">{card.cta.hint}</p>
            ) : null}
            {card.cta.secondaryLink ? (
              <Link
                href={card.cta.secondaryLink.href}
                className="text-center text-sm text-home-orange-ink underline underline-offset-2"
              >
                {card.cta.secondaryLink.label}
              </Link>
            ) : null}
          </>
        ) : (
          <>
            <LiveButton disabled>{card.cta.label}</LiveButton>
            {card.cta.reminderHref ? (
              <Link
                href={card.cta.reminderHref}
                className="text-center text-sm text-home-orange-ink underline underline-offset-2"
              >
                {card.cta.reminderLabel ?? "Get a reminder"}
              </Link>
            ) : null}
            {card.cta.hint ? (
              <p className="text-center text-xs text-[#6B6457]">{card.cta.hint}</p>
            ) : null}
          </>
        )}
      </div>
    </article>
  );
}

export default async function LiveHubPage() {
  await connection();
  const nowMs = readLiveClockMs();
  const freePhase = freeWebinarPhase(nowMs);
  const paidPhase = buildAlongPhase(nowMs);
  const price = livePriceAt(nowMs);
  const seats = await loadSeatsInfo();
  const urls = liveUrls();
  const salesAreOpen = salesOpen(nowMs);
  const sessions = upcomingCards({
    nowMs,
    freePhase,
    paidPhase,
    price,
    seats,
    salesAreOpen,
    urls,
  });

  return (
    <div
      className={`${newsreaderEditorial.variable} theme-cream min-h-screen overflow-x-hidden bg-home-paper text-home-ink`}
      style={{ colorScheme: "light" }}
    >
      <main>
        {/* a-1 Hero */}
        <header className="mx-auto max-w-[1120px] px-5 pt-12 pb-10 sm:px-10 sm:pt-[88px] sm:pb-10">
          <p className={cn(live.mono, "text-home-orange")}>Weekend MVP Live</p>
          <h1 className="font-editorial mt-4 max-w-[880px] text-[46px] leading-[1.02] font-medium tracking-[-0.02em] sm:text-[76px]">
            Weekend MVP <em className="font-normal text-home-orange italic">Live</em>
          </h1>
          <p className="mt-5 max-w-[680px] text-lg leading-relaxed text-[#4A453C] sm:text-xl">
            Free and paid live sessions where we take one idea from a page to a
            live link. Times in GMT.
          </p>
          <p className="mt-4 max-w-[640px] text-[15px] leading-relaxed text-[#4A453C] sm:text-base">
            Most ideas don&apos;t fail because they&apos;re bad. They fail
            because they&apos;re too big to start on a Saturday.
          </p>
          <p className="mt-3 max-w-[640px] text-[15px] leading-relaxed text-[#4A453C] sm:text-base">
            These live sessions are where I show you how to make one small
            enough, and then build it, start to finish, on screen.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <LiveButton href={FREE_HUB_HREF} variant="primary">
              Save my free seat
            </LiveButton>
            <LiveButton href={PAID_HUB_HREF} variant="ghost">
              See the build-along
            </LiveButton>
          </div>
          <p className="mt-3.5 font-mono text-xs text-[#6B6457]">
            All times are GMT.
          </p>
        </header>

        {/* a-2 Upcoming */}
        <section className="mx-auto max-w-[1120px] px-5 sm:px-10">
          <p className={cn(live.mono, "mb-4 text-[#6B6457]")}>
            Upcoming · in date order
          </p>
          <div className="flex flex-col gap-5">
            {sessions.map((card) => (
              <SessionCard key={card.id} card={card} />
            ))}
          </div>
        </section>

        {/* a-3 How they fit */}
        <section className="mx-auto max-w-[1120px] px-5 py-14 sm:px-10 sm:py-24">
          <p className={cn(live.mono, "text-[#6B6457]")}>
            How the two fit together
          </p>
          <h2 className="font-editorial mt-3 max-w-[820px] text-[34px] leading-[1.06] font-medium tracking-[-0.015em] sm:text-5xl">
            Start free. Pay only if you want to{" "}
            <em className="font-normal text-home-orange italic">build with me.</em>
          </h2>
          <div className="mt-5 max-w-[720px] space-y-4 text-[15px] leading-relaxed text-[#6B6457] sm:text-base">
            <p>
              The free webinar is complete on its own. You&apos;ll see the
              method, watch one idea go from page to first screen, and leave
              with a plan for your own weekend. You don&apos;t have to buy
              anything.
            </p>
            <p>
              The build-along is for people who&apos;d rather not do the build
              alone. It&apos;s two hours on Zoom where you build your own MVP
              while I build one too, and you can ask questions as you go.
            </p>
            <p>
              If you only come to one, come to the free one first. It&apos;ll
              tell you whether the paid one is for you.
            </p>
          </div>
          <div className="mt-8 grid gap-5 sm:grid-cols-3">
            <div className="rounded-2xl border border-home-rule bg-home-card p-6">
              <p className="font-mono text-xs tracking-[0.08em] text-home-orange uppercase">
                01 · Sat 31 Oct · 16:00 GMT
              </p>
              <h3 className="font-editorial mt-2 text-2xl font-medium">
                Free webinar
              </h3>
              <p className="mt-1.5 text-sm text-[#6B6457]">
                Learn the weekend test.
              </p>
            </div>
            <div className="rounded-2xl border border-home-rule bg-home-card p-6">
              <p className="font-mono text-xs tracking-[0.08em] text-home-orange uppercase">
                02 · Sat 14 Nov · 15:00 GMT
              </p>
              <h3 className="font-editorial mt-2 text-2xl font-medium">
                Weekend MVP Build-Along
              </h3>
              <p className="mt-1.5 text-sm text-[#6B6457]">Build yours, live.</p>
            </div>
            <div className="rounded-2xl border border-home-rule bg-home-card p-6">
              <p className="font-mono text-xs tracking-[0.08em] text-home-orange uppercase">
                03 · Any weekend
              </p>
              <h3 className="font-editorial mt-2 text-2xl font-medium">
                Your weekend
              </h3>
              <p className="mt-1.5 text-sm text-[#6B6457]">
                Pick an idea from the free library and keep going.
              </p>
            </div>
          </div>
        </section>

        {/* a-4 Replays */}
        <section className="mx-auto max-w-[1120px] px-5 pb-14 sm:px-10 sm:pb-24">
          <h3 className="font-editorial mb-4 text-[28px] font-medium tracking-tight sm:text-3xl">
            Can&apos;t make it live?
          </h3>
          <div className="grid overflow-hidden rounded-2xl border border-home-rule bg-home-card sm:grid-cols-2">
            <div className="border-home-rule p-5 sm:border-r sm:p-6">
              <p className="font-mono text-[11px] tracking-[0.08em] text-[#6B6457] uppercase">
                Free webinar
              </p>
              <p className="font-editorial mt-1.5 text-[22px]">Replay for 7 days</p>
              <p className="mt-2 text-sm text-[#6B6457]">
                Register and you&apos;ll get the replay for 7 days after the
                session. After that, an edited version goes up publicly on
                YouTube.
              </p>
            </div>
            <div className="border-t border-home-rule p-5 sm:border-t-0 sm:p-6">
              <p className="font-mono text-[11px] tracking-[0.08em] text-[#6B6457] uppercase">
                Build-along
              </p>
              <p className="font-editorial mt-1.5 text-[22px]">Yours to keep</p>
              <p className="mt-2 text-sm text-[#6B6457]">
                Your ticket includes the replay, and it doesn&apos;t expire.
              </p>
            </div>
          </div>
          <p className="mt-3 text-sm text-[#6B6457]">
            Both are on Saturdays, so they&apos;re meant to fit around a weekday
            job.
          </p>
        </section>

        {/* a-5 For / not for */}
        <section className="mx-auto grid max-w-[1120px] gap-6 px-5 pb-14 sm:grid-cols-2 sm:px-10 sm:pb-24">
          <div className="rounded-2xl border border-home-rule bg-home-card p-7">
            <p className={cn(live.mono, "text-home-orange")}>For you if</p>
            <ul className="mt-3 space-y-2.5 text-[15px] leading-relaxed text-home-ink">
              {[
                "You're a designer who wants to ship something real with AI, not just mock it up.",
                "You're a non-technical founder with a day job and an idea you keep putting off.",
                "You'd rather build one small thing than plan a big one.",
              ].map((line) => (
                <li key={line} className="relative pl-7">
                  <span
                    aria-hidden
                    className="absolute top-2 left-0 block h-2 w-3.5 rotate-[-45deg] border-b-2 border-l-2 border-home-orange"
                  />
                  {line}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-2xl border border-home-rule bg-home-sunk p-7">
            <p className={cn(live.mono, "text-[#6B6457]")}>Not for you if</p>
            <ul className="mt-3 space-y-2.5 text-[15px] leading-relaxed text-home-ink">
              {[
                "You want a coding course.",
                "You're looking for a six-month program.",
              ].map((line) => (
                <li key={line} className="relative pl-7">
                  <span
                    aria-hidden
                    className="absolute top-0 left-1 text-[22px] text-[#6B6457]"
                  >
                    ×
                  </span>
                  {line}
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* a-6 Host */}
        <section className="pb-14 sm:pb-24">
          <HostBlock body={hostBody()} />
        </section>

        {/* Past sessions */}
        <section className="mx-auto max-w-[1120px] px-5 pb-14 sm:px-10 sm:pb-24">
          <p className={cn(live.mono, "mb-4 text-[#6B6457]")}>Past sessions</p>
          <div className="rounded-2xl border border-dashed border-[#cdbfa8] bg-[repeating-linear-gradient(135deg,transparent_0_10px,rgba(221,212,196,0.25)_10px_20px)] px-6 py-9 text-center text-sm text-[#6B6457]">
            Nothing here yet…
          </div>
        </section>

        {/* a-7 Free right now */}
        <section className="mx-auto max-w-[1120px] px-5 pb-14 sm:px-10 sm:pb-24">
          <div
            className={cn(
              live.panel,
              "flex flex-wrap items-center justify-between gap-8 p-8 sm:p-12",
            )}
          >
            <div className="max-w-[560px]">
              <p className={cn(live.mono, "text-[#c9bfae]")}>Free right now</p>
              <h3 className="font-editorial mt-2.5 text-[28px] leading-tight font-medium text-white sm:text-3xl">
                Don&apos;t want to wait{" "}
                <em className="font-normal text-home-orange-light italic">
                  for a date?
                </em>
              </h3>
              <p className="mt-2.5 text-sm text-[#c9bfae]">
                The idea library is free to browse. Every idea is sized for one
                weekend and comes with copy-paste prompts.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <LiveButton href={STARTUP_IDEAS_HREF} variant="secondary">
                Browse free ideas
              </LiveButton>
              <Link
                href={STARTER_KIT_HREF}
                className="text-sm text-white underline underline-offset-2"
              >
                Get the free Starter Kit
              </Link>
            </div>
          </div>
        </section>

        {/* a-8 FAQ */}
        <LiveFaq items={hubFaqItems()} />

        {/* a-9 Final CTA */}
        <section className="mx-auto max-w-[1120px] px-5 pt-4 pb-24 text-center sm:px-10 sm:pb-28">
          <h2 className="font-editorial text-[34px] leading-[1.06] font-medium tracking-[-0.015em] sm:text-5xl">
            Pick your <em className="font-normal text-home-orange italic">Saturday.</em>
          </h2>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <LiveButton href={FREE_HUB_HREF} variant="primary">
              Save my free seat
            </LiveButton>
            <LiveButton href={PAID_HUB_HREF} variant="ghost">
              See the build-along
            </LiveButton>
          </div>
          <p className="mt-3 font-mono text-xs text-[#6B6457]">
            Free webinar Sat 31 Oct, 16:00 GMT · Build-along Sat 14 Nov, 15:00
            GMT
          </p>
        </section>
      </main>
    </div>
  );
}
