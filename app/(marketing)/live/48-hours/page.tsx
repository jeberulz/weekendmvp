import type { Metadata } from "next";
import { connection } from "next/server";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, Check } from "lucide-react";

import { LiveButton } from "@/components/live/LiveButton";
import { LiveFaq } from "@/components/live/LiveFaq";
import { LocalTime } from "@/components/live/LocalTime";
import { LumaRegisterLink } from "@/components/live/LumaRegisterLink";
import { PersistLiveAttrib } from "@/components/live/PersistLiveAttrib";
import { Em } from "@/components/home/ui";
import { JsonLd } from "@/components/primitives/JsonLd";
import { newsreaderEditorial } from "@/lib/fonts";
import { FREE_WEBINAR, LIVE_ASSETS, STARTUP_IDEAS_HREF, liveUrls } from "@/lib/live/config";
import { readFreeWebinar } from "@/lib/landing/read-free-webinar";
import { freeWebinarPhase } from "@/lib/live/schedule";
import { readLiveClockMs } from "@/lib/live/now";
import { cn } from "@/lib/utils";
import {
  SITE,
  breadcrumbSchema,
  buildGraph,
  organizationSchema,
  personSchema,
} from "@/lib/seo";

import { AGENDA, PRODUCT_NAME, SCREENS, freeFaqItemsVisible, freeWebinarText } from "./free-data";
import { HikeScreenMock, ScreenSketch } from "./hydrotrail-sketches";
import { RegisterBar } from "./RegisterBar";

const TITLE = FREE_WEBINAR.title;
const DESCRIPTION =
  "Free 60-minute live build on Sat 31 Oct 2026, 16:00 GMT. Watch HydroTrail, a hydration coach for hikers, go from an empty folder to its first working screen with Claude Code. Register for reminders and the 7-day replay.";

const DEMO_IDEA_HREF = `/ideas/${LIVE_ASSETS.demoIdeaSlug || "hydration-app-for-hikers"}`;

export const instant = false;

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  keywords: [
    "build a hydration app with AI",
    "HydroTrail",
    "hydration app for hikers",
    "Claude Code live build",
    "free live workshop",
  ],
  authors: [{ name: "John Iseghohi" }],
  alternates: { canonical: "/live/48-hours" },
  openGraph: {
    type: "website",
    siteName: "Weekend MVP",
    locale: "en_GB",
    url: `${SITE}/live/48-hours`,
    title: TITLE,
    description: DESCRIPTION,
    images: [
      {
        url: `${SITE}/image/og-image.png`,
        alt: TITLE,
        type: "image/png",
        width: 1200,
        height: 630,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    site: "@weekendmvp",
    title: TITLE,
    description: DESCRIPTION,
    images: [`${SITE}/image/og-image.png`],
  },
};

const SCHEMA = buildGraph(
  personSchema(),
  organizationSchema(),
  breadcrumbSchema([
    { label: "Home", href: `${SITE}/` },
    { label: "Live", href: `${SITE}/live` },
    { label: "Live in one hour", href: `${SITE}/live/48-hours` },
  ]),
  {
    "@type": "EducationEvent",
    name: TITLE,
    description: DESCRIPTION,
    about: "Build a hydration app with AI: HydroTrail, a hydration coach for hikers",
    startDate: new Date(FREE_WEBINAR.startAt).toISOString(),
    endDate: new Date(FREE_WEBINAR.endAt).toISOString(),
    eventAttendanceMode: "https://schema.org/OnlineEventAttendanceMode",
    eventStatus: "https://schema.org/EventScheduled",
    isAccessibleForFree: true,
    location: {
      "@type": "VirtualLocation",
      url: `${SITE}/live/48-hours`,
    },
    organizer: { "@id": `${SITE}/#organization` },
  },
);

const SECTION = "mx-auto max-w-[1120px] px-5 py-14 sm:px-10 sm:py-20";
const H2 =
  "font-editorial text-[32px] leading-[1.08] font-medium tracking-[-0.015em] text-balance sm:text-[44px]";
const LEAD = "mt-4 max-w-[60ch] text-[17px] leading-relaxed text-[#4A453C]";
const FOCUS =
  "rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-home-orange-ink";
const BUTTON =
  "inline-flex h-[52px] w-full items-center justify-center gap-2.5 rounded-full bg-home-orange-ink px-[26px] text-base font-semibold whitespace-nowrap text-white transition-colors hover:bg-[#8F3F00] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-home-orange-ink sm:w-auto";

function SeatButton({ lumaUrl, className }: { lumaUrl: string; className?: string }) {
  if (!lumaUrl) return <LiveButton disabled>Registration link coming soon</LiveButton>;
  return (
    <LumaRegisterLink href={lumaUrl} variant="inline" className={cn(BUTTON, className)}>
      Save my free seat
      <ArrowUpRight aria-hidden="true" className="size-[18px]" strokeWidth={2.25} />
    </LumaRegisterLink>
  );
}

async function getFreeWebinarCopy() {
  "use cache";
  return readFreeWebinar();
}

export default async function FreeWebinarPage() {
  await connection();
  const now = readLiveClockMs();
  const phase = freeWebinarPhase(now);
  const urls = liveUrls();
  const proof = LIVE_ASSETS.freeProofQuotes;
  const { hero, whatItDoes, screens, agenda, promise, weekendTest, leaveWith, host, proofQuotes, finalCta, faq } = await getFreeWebinarCopy();

  return (
    <div
      className={`${newsreaderEditorial.variable} theme-desk overflow-x-clip bg-home-paper font-sans text-home-ink selection:bg-home-orange/20`}
    >
      <PersistLiveAttrib />
      <JsonLd schema={SCHEMA} />

      <main>
        {/* Hero / state banners */}
        {phase === "live" ? (
          <section className="mx-auto max-w-[1120px] px-5 pt-28 pb-14 sm:px-10 sm:pt-36 sm:pb-20">
            <h1 className="font-editorial text-[46px] leading-[1.02] font-medium tracking-[-0.02em] sm:text-[76px]">
              {hero.live.title + " "}<Em>{hero.live.accent}</Em>
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-[#4A453C]">
              {freeWebinarText(hero.live.body)}
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              {urls.youtubeLiveUrl ? (
                <LiveButton href={urls.youtubeLiveUrl} external variant="primary">
                  Watch live on YouTube
                </LiveButton>
              ) : (
                <LiveButton disabled>Stream link coming soon</LiveButton>
              )}
              {urls.lumaEventUrl ? (
                <LumaRegisterLink
                  href={urls.lumaEventUrl}
                  variant="inline"
                  className={`inline-flex h-[52px] items-center text-sm font-medium text-home-ink underline decoration-home-rule underline-offset-4 ${FOCUS}`}
                >
                  Register for the replay
                </LumaRegisterLink>
              ) : null}
            </div>
          </section>
        ) : phase === "replay" ? (
          <section className="mx-auto max-w-[1120px] px-5 pt-28 pb-14 sm:px-10 sm:pt-36 sm:pb-20">
            <h1 className="font-editorial text-[46px] leading-[1.02] font-medium tracking-[-0.02em] sm:text-[64px]">
              {hero.replay.title + " "}<Em>{hero.replay.accent}</Em>
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-[#4A453C]">
              {freeWebinarText(hero.replay.body)}
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <LiveButton href={STARTUP_IDEAS_HREF} variant="primary">
                Browse free ideas
              </LiveButton>
              <Link
                href="/live/build-along"
                className={`text-sm font-medium text-home-ink underline decoration-home-rule underline-offset-4 ${FOCUS}`}
              >
                See the build-along on Sat 14 Nov
              </Link>
            </div>
          </section>
        ) : phase === "ended" ? (
          <section className="mx-auto max-w-[1120px] px-5 pt-28 pb-14 sm:px-10 sm:pt-36 sm:pb-20">
            <h1 className="font-editorial text-[46px] leading-[1.02] font-medium tracking-[-0.02em] sm:text-[64px]">
              {hero.ended.title + " "}<Em>{hero.ended.accent}</Em>
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-[#4A453C]">
              {urls.youtubeReplayUrl ? hero.ended.replayReady : hero.ended.replayPending}{" "}
              {hero.ended.ending}
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              {urls.youtubeReplayUrl ? (
                <LiveButton href={urls.youtubeReplayUrl} external variant="primary">
                  Watch the replay on YouTube
                </LiveButton>
              ) : null}
              <LiveButton
                href={STARTUP_IDEAS_HREF}
                variant={urls.youtubeReplayUrl ? "ghost" : "primary"}
              >
                Browse free ideas
              </LiveButton>
              <Link
                href="/starter-kit"
                className={`text-sm font-medium text-home-ink underline decoration-home-rule underline-offset-4 ${FOCUS}`}
              >
                Get the free Starter Kit
              </Link>
            </div>
          </section>
        ) : (
          <section className="mx-auto grid max-w-[1120px] items-center gap-12 px-5 pt-28 pb-14 sm:px-10 sm:pt-36 sm:pb-20 lg:grid-cols-[1.15fr_0.85fr] lg:gap-16">
            <div>
              <h1 className="font-editorial text-[38px] leading-[1.04] font-medium tracking-[-0.022em] text-balance sm:text-[58px]">
                Build a real app live in <Em>one hour</Em> (free)
              </h1>
              <p className="font-editorial mt-5 text-[22px] leading-[1.32] text-balance sm:text-[26px]">
                {hero.open.intro}{" "}
                <span className="font-medium text-home-orange-ink">{PRODUCT_NAME}</span>,{" "}
                {hero.open.product}
              </p>
              <p className="font-editorial mt-3 text-[19px] leading-snug text-[#4A453C] italic sm:text-[21px]">
                &ldquo;{hero.open.hook}&rdquo;
              </p>
              <p className="mt-4 max-w-[46ch] leading-relaxed text-[#4A453C]">
                {freeWebinarText(hero.open.body)}
              </p>

              <div id="hero-register" className="mt-6 grid justify-items-start gap-2.5 sm:mt-7">
                <SeatButton lumaUrl={urls.lumaEventUrl} />
                <p className="max-w-[44ch] text-sm leading-relaxed text-[#6B6457]">
                  {freeWebinarText(hero.open.registrationNote)}
                </p>
              </div>
              <div className="mt-5 border-t border-home-rule pt-4 text-[15px] leading-relaxed text-[#4A453C]">
                <p>
                  <strong className="font-semibold text-home-ink">
                    Sat 31 Oct, 16:00–17:00 GMT
                  </strong>{" "}
                  (12:00 New York, 09:00 Los Angeles).
                </p>
                <LocalTime
                  startMs={FREE_WEBINAR.startAt}
                  endMs={FREE_WEBINAR.endAt}
                  className="text-[15px] text-[#4A453C]"
                />
              </div>
            </div>

            <HikeScreenMock />
          </section>
        )}

        {/* Video — hidden until recorded */}
        {LIVE_ASSETS.hostVideoUrl ? (
          <section className="mx-auto max-w-[800px] px-5 py-10 sm:px-10">
            <div className="aspect-video overflow-hidden rounded-2xl border border-home-rule bg-home-sunk">
              <iframe
                src={LIVE_ASSETS.hostVideoUrl}
                title={LIVE_ASSETS.hostVideoCaption}
                className="h-full w-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
            <p className="mt-3 text-center text-sm text-[#6B6457]">
              {LIVE_ASSETS.hostVideoCaption}
            </p>
          </section>
        ) : null}

        {/* What HydroTrail does */}
        <section aria-labelledby="does-heading" className={SECTION}>
          <div className="grid gap-10 lg:grid-cols-2 lg:gap-14">
            <div>
              <h2 id="does-heading" className={H2}>
                {whatItDoes.title}
              </h2>
              {whatItDoes.intro.map((paragraph, index) => <p key={index} className={LEAD}>{paragraph}</p>)}
            </div>

            <div>
              <dl className="divide-y divide-home-rule border-y border-home-rule">
                {whatItDoes.outputs.map((item, index) => (
                  <div key={index} className="py-4">
                    <dt className="font-editorial text-[21px] leading-tight">{item.title}</dt>
                    <dd className="mt-1 text-[15px] leading-relaxed text-[#4A453C]">
                      {item.body}
                    </dd>
                  </div>
                ))}
              </dl>
              <p className="mt-6 rounded-2xl bg-home-sunk px-5 py-4 text-[15px] leading-relaxed text-[#4A453C]">
                {whatItDoes.rulesIntro + " Heat over"}{" "}
                <code className="font-mono text-sm text-home-ink">24°C</code>, altitude over{" "}
                <code className="font-mono text-sm text-home-ink">2,500 m</code> or a grade over{" "}
                <code className="font-mono text-sm text-home-ink">8%</code> raises the target. It
                never goes past <code className="font-mono text-sm text-home-ink">1.2 L/h</code>{". " + whatItDoes.rulesEnding}
              </p>
              <Link
                href={DEMO_IDEA_HREF}
                className={`mt-6 inline-flex items-center gap-2 font-semibold text-home-orange-ink underline decoration-home-rule underline-offset-4 hover:decoration-home-orange-ink ${FOCUS}`}
              >
                {whatItDoes.ideaLink}
                <ArrowRight aria-hidden="true" className="size-[18px]" strokeWidth={2.25} />
              </Link>
            </div>
          </div>
        </section>

        {/* The four screens */}
        <section aria-labelledby="screens-heading" className={SECTION}>
          <h2 id="screens-heading" className={H2}>
            {screens.title}
          </h2>
          <p className={LEAD}>
            {screens.intro}
          </p>
          <ol className="mt-10 grid grid-cols-2 gap-x-4 gap-y-9 lg:grid-cols-4 lg:gap-6">
            {SCREENS.map((screen) => (
              <li key={screen.key} className="flex flex-col">
                <div className="mx-auto w-full max-w-[230px]">
                  <ScreenSketch kind={screen.key} />
                </div>
                <h3 className="font-editorial mt-4 text-xl leading-tight font-medium">
                  {screens[screen.key].title}
                </h3>
                <p
                  className={
                    screen.promised
                      ? "mt-0.5 text-sm font-semibold text-home-orange-ink"
                      : "mt-0.5 text-sm font-medium text-[#6B6457]"
                  }
                >
                  {screen.status}
                </p>
                <p className="mt-1 text-sm leading-relaxed text-[#4A453C]">{screens[screen.key].body}</p>
              </li>
            ))}
          </ol>
          <p className="mt-9 max-w-[64ch] text-[15px] leading-relaxed text-[#6B6457]">
            {screens.closing}
          </p>
        </section>

        {/* How the hour runs */}
        <section aria-labelledby="agenda-heading" className={SECTION}>
          <h2 id="agenda-heading" className={H2}>
            {agenda.title}
          </h2>
          <p className={LEAD}>{freeWebinarText(agenda.intro)}</p>
          <ol className="mt-8 divide-y divide-home-rule border-y border-home-rule">
            {AGENDA.map((slot) => {
              const row = agenda[slot.key];
              const body = "body" in row ? row.body : null;
              const mark = "mark" in row ? row.mark : null;
              return (
                <li
                  key={slot.key}
                  className="grid grid-cols-[96px_minmax(0,1fr)] gap-3 py-4 sm:grid-cols-[150px_minmax(0,1fr)] sm:gap-6"
                >
                  <span
                    className={
                      "milestone" in slot
                        ? "font-mono text-sm leading-7 text-home-orange-ink tabular-nums"
                        : "font-mono text-sm leading-7 text-[#4A453C] tabular-nums"
                    }
                  >
                    {"approx" in slot ? (
                      <>
                        <span aria-hidden="true">~</span>
                        <span className="sr-only">About </span>
                      </>
                    ) : null}
                    {slot.clock}
                  </span>
                  <div>
                    <h3 className="font-editorial text-[19px] leading-7 font-medium">{row.title}</h3>
                    {body ? (
                      <p className="mt-0.5 max-w-[56ch] text-[15px] leading-relaxed text-[#4A453C]">
                        {body}
                        {mark ? (
                          <>
                            {" "}
                            <strong className="font-semibold text-home-orange-ink">{mark}</strong>
                          </>
                        ) : null}
                      </p>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ol>
        </section>

        {/* What I promise */}
        <section aria-labelledby="promise-heading" className="mx-auto max-w-[1120px] px-5 py-4 sm:px-10">
          <div className="rounded-[22px] bg-home-panel px-6 py-10 text-[#d6cdbd] sm:px-14 sm:py-14">
            <h2 id="promise-heading" className={`${H2} text-white`}>
              {promise.title}
            </h2>
            <dl className="mt-7 grid gap-5 sm:grid-cols-3 sm:gap-8">
              {promise.items.map((item, index) => (
                <div key={index}>
                  <dt className="font-semibold text-white">{item.term}</dt>
                  <dd className="mt-1 leading-relaxed">{item.body}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-7 border-t border-home-panel-rule pt-5">
              {promise.closing}
            </p>
            {phase === "open" && urls.lumaEventUrl ? (
              <div className="mt-6">
                <SeatButton
                  lumaUrl={urls.lumaEventUrl}
                  className="bg-home-orange-light text-home-ink hover:bg-[#f39a55] focus-visible:outline-home-orange-light"
                />
              </div>
            ) : null}
          </div>
        </section>

        {/* Weekend test */}
        <section aria-labelledby="test-heading" className={SECTION}>
          <h2 id="test-heading" className={H2}>
            {weekendTest.title}
          </h2>
          <p className={LEAD}>
            {weekendTest.intro}
          </p>
          <dl className="mt-8 grid border-t border-home-rule sm:grid-cols-2 sm:gap-x-10">
            {weekendTest.checks.map((check, index) => (
              <div key={index} className="border-b border-home-rule py-3.5">
                <dt className="flex items-start gap-3 font-semibold">
                  <Check
                    aria-hidden="true"
                    className="mt-1 size-[18px] flex-none text-home-sage-ink"
                    strokeWidth={2.25}
                  />
                  {check.title}
                </dt>
                <dd className="pl-[30px] text-[15px] leading-relaxed text-[#4A453C]">
                  {check.body}
                </dd>
              </div>
            ))}
          </dl>
        </section>

        {/* What you leave with, who it's for, host */}
        <section className="mx-auto max-w-[1120px] px-5 pb-14 sm:px-10 sm:pb-20">
          <div className="grid gap-12 lg:grid-cols-2 lg:gap-14">
            <div>
              <h2 className={H2}>{leaveWith.title}</h2>
              <ul className="mt-5 space-y-3 text-[15px] leading-relaxed text-[#4A453C]">
                {leaveWith.outcomes.map((item, index) => (
                  <li key={index}>{item}</li>
                ))}
              </ul>
            </div>
            <div>
              <h2 className={H2}>{leaveWith.audienceTitle}</h2>
              <ul className="mt-5 space-y-3 text-[15px] leading-relaxed text-[#4A453C]">
                {leaveWith.audience.map((item, index) => (
                  <li key={index}>{item}</li>
                ))}
              </ul>
              <p className="mt-4 text-[15px] text-[#6B6457]">{leaveWith.notFor}</p>
            </div>
          </div>

          <div className="mt-12 flex flex-col gap-5 border-t border-home-rule pt-8 sm:flex-row sm:gap-7">
            {LIVE_ASSETS.hostHeadshotUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={LIVE_ASSETS.hostHeadshotUrl}
                alt="John Iseghohi"
                width={120}
                height={120}
                className="h-24 w-24 rounded-2xl object-cover sm:h-28 sm:w-28"
              />
            ) : null}
            <div>
              <h2 className="font-editorial text-[26px] leading-tight font-medium">
                {host.title}
              </h2>
              <p className="mt-2 max-w-[60ch] text-[15px] leading-relaxed text-[#4A453C]">
                {host.intro}{" "}
                {LIVE_ASSETS.hostEveningsConfirmed
                  ? "I build Weekend MVP around a full-time job, on evenings and Saturdays. "
                  : null}
                {host.body}
              </p>
            </div>
          </div>
        </section>

        {/* Proof — hidden until quotes exist */}
        {proof.length >= 2 ? (
          <section className={SECTION}>
            <h2 className={H2}>{proofQuotes.title}</h2>
            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              {proof.map((q) => (
                <blockquote
                  key={q.name + q.quote.slice(0, 24)}
                  className="rounded-2xl border border-home-rule bg-home-card p-6"
                >
                  <p className="font-editorial text-xl leading-snug">&ldquo;{q.quote}&rdquo;</p>
                  <footer className="mt-3 text-sm text-[#6B6457]">{q.name}</footer>
                </blockquote>
              ))}
            </div>
          </section>
        ) : null}

        <LiveFaq heading={faq.title} items={freeFaqItemsVisible(faq)} />

        {/* Final CTA — only useful while registration is open */}
        {phase === "open" ? (
          <section className="mx-auto max-w-[1120px] px-5 pb-24 sm:px-10">
            <div className="rounded-[20px] border border-home-rule bg-home-card px-6 py-12 text-center sm:px-14 sm:py-14">
              <h2 className={H2}>{finalCta.title}</h2>
              <p className="mt-3 text-[#4A453C]">
                Sat 31 Oct, 16:00–17:00 GMT, on YouTube Live. Free.
              </p>
              <div className="mt-6 grid justify-items-center gap-2.5">
                <SeatButton lumaUrl={urls.lumaEventUrl} />
                <p className="text-sm text-[#6B6457]">
                  {freeWebinarText(finalCta.note)}
                </p>
              </div>
            </div>
          </section>
        ) : null}
      </main>

      {phase === "open" && urls.lumaEventUrl ? (
        <RegisterBar afterId="hero-register">
          <p className="text-sm leading-tight">
            Sat 31 Oct, 16:00 GMT
            <span className="block text-[13px] text-[#c9bfae] sm:ml-2 sm:inline">
              Free on YouTube Live
            </span>
          </p>
          <LumaRegisterLink
            href={urls.lumaEventUrl}
            variant="inline"
            className="inline-flex h-10 items-center rounded-full bg-home-orange-light px-4 text-[15px] font-semibold whitespace-nowrap text-home-ink transition-colors hover:bg-[#f39a55] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-home-orange-light"
          >
            Save my free seat
          </LumaRegisterLink>
        </RegisterBar>
      ) : phase === "live" ? (
        <RegisterBar>
          <p className="text-sm font-semibold">Live now on YouTube</p>
          {urls.youtubeLiveUrl ? (
            <a
              href={urls.youtubeLiveUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-10 items-center rounded-full bg-home-orange-light px-4 text-[15px] font-semibold whitespace-nowrap text-home-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-home-orange-light"
            >
              Watch now<span className="sr-only"> (opens in a new tab)</span>
            </a>
          ) : null}
        </RegisterBar>
      ) : null}
    </div>
  );
}
