import type { Metadata } from "next";
import { Fragment } from "react";
import { connection } from "next/server";
import Link from "next/link";

import { DateTile } from "@/components/live/DateTile";
import { HostBlock } from "@/components/live/HostBlock";
import { LiveButton } from "@/components/live/LiveButton";
import { LiveFaq } from "@/components/live/LiveFaq";
import { LocalTime } from "@/components/live/LocalTime";
import { PersistLiveAttrib } from "@/components/live/PersistLiveAttrib";
import { live } from "@/components/live/tokens";
import { newsreaderEditorial } from "@/lib/fonts";
import { BUILD_ALONG, STARTUP_IDEAS_HREF, liveUrls } from "@/lib/live/config";
import { readLiveHub, type LiveHubSection } from "@/lib/landing/read-live-hub";
import { hubSchedule, liveHubText } from "@/lib/landing/live-hub-schedule";
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

async function getLiveHub() {
  "use cache";
  return readLiveHub();
}

export async function generateMetadata(): Promise<Metadata> {
  const copy = await getLiveHub();
  const title = liveHubText(copy.seoTitle);
  const description = liveHubText(copy.seoDescription);
  return {
    title: { absolute: title },
    description,
    alternates: { canonical: LIVE_HUB_PATH },
    openGraph: {
      type: "website",
      siteName: "Weekend MVP",
      locale: "en_GB",
      url: LIVE_HUB_PATH,
      title,
      description,
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
      title,
      description,
      images: [
        {
          url: `${SITE}/image/og-image.png`,
          alt: "Weekend MVP Live",
        },
      ],
    },
  };
}

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

function renderSection(section: LiveHubSection) {
  const { discriminant, value } = section;
  switch (discriminant) {
    case "howTheyFit":
      return (
        <section className="mx-auto max-w-[1120px] px-5 py-14 sm:px-10 sm:py-24">
          <p className={cn(live.mono, "text-[#6B6457]")}>
            {value.eyebrow}
          </p>
          <h2 className="font-editorial mt-3 max-w-[820px] text-[34px] leading-[1.06] font-medium tracking-[-0.015em] sm:text-5xl">
            {value.title}{" "}
            <em className="font-normal text-home-orange italic">{value.accent}</em>
          </h2>
          <div className="mt-5 max-w-[720px] space-y-4 text-[15px] leading-relaxed text-[#6B6457] sm:text-base">
            {value.paragraphs.map((paragraph, index) => <p key={index}>{liveHubText(paragraph)}</p>)}
          </div>
          <div className="mt-8 grid gap-5 sm:grid-cols-3">
            <div className="rounded-2xl border border-home-rule bg-home-card p-6">
              <p className="font-mono text-xs tracking-[0.08em] text-home-orange uppercase">
                {`01 · ${hubSchedule.freeDate} · ${hubSchedule.freeTime} GMT`}
              </p>
              <h3 className="font-editorial mt-2 text-2xl font-medium">
                Free webinar
              </h3>
              <p className="mt-1.5 text-sm text-[#6B6457]">
                {value.free}
              </p>
            </div>
            <div className="rounded-2xl border border-home-rule bg-home-card p-6">
              <p className="font-mono text-xs tracking-[0.08em] text-home-orange uppercase">
                {`02 · ${hubSchedule.paidDate} · ${hubSchedule.paidTime} GMT`}
              </p>
              <h3 className="font-editorial mt-2 text-2xl font-medium">
                {BUILD_ALONG.title}
              </h3>
              <p className="mt-1.5 text-sm text-[#6B6457]">{value.paid}</p>
            </div>
            <div className="rounded-2xl border border-home-rule bg-home-card p-6">
              <p className="font-mono text-xs tracking-[0.08em] text-home-orange uppercase">
                03 · Any weekend
              </p>
              <h3 className="font-editorial mt-2 text-2xl font-medium">
                {value.weekend.title}
              </h3>
              <p className="mt-1.5 text-sm text-[#6B6457]">
                {value.weekend.body}
              </p>
            </div>
          </div>
        </section>
      );
    case "replays":
      return (
        <section className="mx-auto max-w-[1120px] px-5 pb-14 sm:px-10 sm:pb-24">
          <h3 className="font-editorial mb-4 text-[28px] font-medium tracking-tight sm:text-3xl">
            {value.title}
          </h3>
          <div className="grid overflow-hidden rounded-2xl border border-home-rule bg-home-card sm:grid-cols-2">
            <div className="border-home-rule p-5 sm:border-r sm:p-6">
              <p className="font-mono text-[11px] tracking-[0.08em] text-[#6B6457] uppercase">
                {value.free.label}
              </p>
              <p className="font-editorial mt-1.5 text-[22px]">{liveHubText(value.free.title)}</p>
              <p className="mt-2 text-sm text-[#6B6457]">
                {liveHubText(value.free.body)}
              </p>
            </div>
            <div className="border-t border-home-rule p-5 sm:border-t-0 sm:p-6">
              <p className="font-mono text-[11px] tracking-[0.08em] text-[#6B6457] uppercase">
                {value.paid.label}
              </p>
              <p className="font-editorial mt-1.5 text-[22px]">{value.paid.title}</p>
              <p className="mt-2 text-sm text-[#6B6457]">
                {value.paid.body}
              </p>
            </div>
          </div>
          <p className="mt-3 text-sm text-[#6B6457]">
            {value.note}
          </p>
        </section>
      );
    case "forNotFor":
      return (
        <section className="mx-auto grid max-w-[1120px] gap-6 px-5 pb-14 sm:grid-cols-2 sm:px-10 sm:pb-24">
          <div className="rounded-2xl border border-home-rule bg-home-card p-7">
            <p className={cn(live.mono, "text-home-orange")}>{value.forYou.title}</p>
            <ul className="mt-3 space-y-2.5 text-[15px] leading-relaxed text-home-ink">
              {value.forYou.items.map((line, index) => (
                <li key={index} className="relative pl-7">
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
            <p className={cn(live.mono, "text-[#6B6457]")}>{value.notForYou.title}</p>
            <ul className="mt-3 space-y-2.5 text-[15px] leading-relaxed text-home-ink">
              {value.notForYou.items.map((line, index) => (
                <li key={index} className="relative pl-7">
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
      );
    case "host":
      return (
        <section className="pb-14 sm:pb-24">
          <HostBlock body={hostBody(value.body)} />
        </section>
      );
    case "pastSessions":
      return (
        <section className="mx-auto max-w-[1120px] px-5 pb-14 sm:px-10 sm:pb-24">
          <p className={cn(live.mono, "mb-4 text-[#6B6457]")}>{value.eyebrow}</p>
          <div className="rounded-2xl border border-dashed border-[#cdbfa8] bg-[repeating-linear-gradient(135deg,transparent_0_10px,rgba(221,212,196,0.25)_10px_20px)] px-6 py-9 text-center text-sm text-[#6B6457]">
            {value.emptyMessage}
          </div>
        </section>
      );
    case "freeRightNow":
      return (
        <section className="mx-auto max-w-[1120px] px-5 pb-14 sm:px-10 sm:pb-24">
          <div
            className={cn(
              live.panel,
              "flex flex-wrap items-center justify-between gap-8 p-8 sm:p-12",
            )}
          >
            <div className="max-w-[560px]">
              <p className={cn(live.mono, "text-[#c9bfae]")}>{value.eyebrow}</p>
              <h3 className="font-editorial mt-2.5 text-[28px] leading-tight font-medium text-white sm:text-3xl">
                {value.title}{" "}
                <em className="font-normal text-home-orange-light italic">
                  {value.accent}
                </em>
              </h3>
              <p className="mt-2.5 text-sm text-[#c9bfae]">
                {value.body}
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
      );
    case "faq":
      return <LiveFaq heading={value.title} items={hubFaqItems(value)} />;
  }
}

export default async function LiveHubPage() {
  await connection();
  const nowMs = readLiveClockMs();
  const freePhase = freeWebinarPhase(nowMs);
  const paidPhase = buildAlongPhase(nowMs);
  const price = livePriceAt(nowMs);
  const [seats, copy] = await Promise.all([loadSeatsInfo(), getLiveHub()]);
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
      <PersistLiveAttrib />
      <main>
        {/* a-1 Hero */}
        <header className="mx-auto max-w-[1120px] px-5 pt-12 pb-10 sm:px-10 sm:pt-[88px] sm:pb-10">
          <p className={cn(live.mono, "text-home-orange")}>{copy.hero.eyebrow}</p>
          <h1 className="font-editorial mt-4 max-w-[880px] text-[46px] leading-[1.02] font-medium tracking-[-0.02em] sm:text-[76px]">
            {copy.hero.title + " "}<em className="font-normal text-home-orange italic">{copy.hero.accent}</em>
          </h1>
          <p className="mt-5 max-w-[680px] text-lg leading-relaxed text-[#4A453C] sm:text-xl">
            {copy.hero.intro}
          </p>
          {copy.hero.paragraphs.map((paragraph, index) => (
            <p
              key={index}
              className={cn(index === 0 ? "mt-4" : "mt-3", "max-w-[640px] text-[15px] leading-relaxed text-[#4A453C] sm:text-base")}
            >
              {liveHubText(paragraph)}
            </p>
          ))}
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
            {copy.upcoming.eyebrow}
          </p>
          <div className="flex flex-col gap-5">
            {sessions.map((card) => (
              <SessionCard key={card.id} card={card} />
            ))}
          </div>
        </section>

        {copy.sections.map((section) => <Fragment key={section.discriminant}>{renderSection(section)}</Fragment>)}

        {/* a-9 Final CTA */}
        <section className="mx-auto max-w-[1120px] px-5 pt-4 pb-24 text-center sm:px-10 sm:pb-28">
          <h2 className="font-editorial text-[34px] leading-[1.06] font-medium tracking-[-0.015em] sm:text-5xl">
            {copy.finalCta.title + " "}<em className="font-normal text-home-orange italic">{copy.finalCta.accent}</em>
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
            {`Free webinar ${hubSchedule.freeDate}, ${hubSchedule.freeTime} GMT · Build-along ${hubSchedule.paidDate}, ${hubSchedule.paidTime} GMT`}
          </p>
        </section>
      </main>
    </div>
  );
}
