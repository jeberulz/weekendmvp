import type { Metadata } from "next";
import { connection } from "next/server";
import Link from "next/link";

import { DateTile } from "@/components/live/DateTile";
import { HostBlock } from "@/components/live/HostBlock";
import { LiveButton } from "@/components/live/LiveButton";
import { LiveFaq } from "@/components/live/LiveFaq";
import { LocalTime } from "@/components/live/LocalTime";
import { LumaRegisterLink } from "@/components/live/LumaRegisterLink";
import { PersistLiveAttrib } from "@/components/live/PersistLiveAttrib";
import { Em } from "@/components/home/ui";
import { JsonLd } from "@/components/primitives/JsonLd";
import { newsreaderEditorial } from "@/lib/fonts";
import { FREE_WEBINAR, LIVE_ASSETS, STARTUP_IDEAS_HREF, liveUrls } from "@/lib/live/config";
import { freeWebinarPhase } from "@/lib/live/schedule";
import { readLiveClockMs } from "@/lib/live/now";
import {
  SITE,
  breadcrumbSchema,
  buildGraph,
  organizationSchema,
  personSchema,
} from "@/lib/seo";

import {
  FREE_AGENDA,
  FREE_FOR_YOU,
  FREE_LEAVE_WITH,
  FREE_NOT_FOR_YOU,
  HYDROTRAIL,
  HYDROTRAIL_OUTPUTS,
  HYDROTRAIL_RULES,
  HYDROTRAIL_SCREENS,
  WEEKEND_TEST_CHIPS,
  freeFaqItemsVisible,
} from "./free-data";
import { HikeScreenMock, ScreenSketch } from "./hydrotrail-sketches";

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

const EYEBROW = "font-mono text-[11px] tracking-[0.08em] uppercase";
const H2 =
  "font-editorial mt-3 text-[34px] leading-[1.06] font-medium tracking-[-0.015em] sm:text-5xl";

function RegisterCta({
  lumaUrl,
  className,
}: {
  lumaUrl: string;
  className?: string;
}) {
  return (
    <div className={className}>
      {lumaUrl ? (
        <LumaRegisterLink href={lumaUrl}>Save my free seat</LumaRegisterLink>
      ) : (
        <LiveButton disabled>Registration link coming soon</LiveButton>
      )}
      <p className="mt-2.5 text-sm text-[#6B6457]">
        Register on Luma for reminders and the 7-day replay.
      </p>
    </div>
  );
}

function CheckList({
  items,
  variant = "check",
}: {
  items: readonly string[];
  variant?: "check" | "x";
}) {
  return (
    <ul className="mt-3 space-y-3">
      {items.map((item) => (
        <li key={item} className="flex gap-3 text-[15px] leading-relaxed text-home-ink">
          <span
            aria-hidden="true"
            className={
              variant === "check"
                ? "mt-0.5 font-mono text-home-orange"
                : "mt-0.5 font-mono text-[#6B6457]"
            }
          >
            {variant === "check" ? "✓" : "×"}
          </span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

export default async function FreeWebinarPage() {
  await connection();
  const now = readLiveClockMs();
  const phase = freeWebinarPhase(now);
  const urls = liveUrls();
  const proof = LIVE_ASSETS.freeProofQuotes;
  const hostBody = (
    <>
      {LIVE_ASSETS.hostEveningsConfirmed
        ? "I build Weekend MVP around a full-time job, on evenings and Saturdays. "
        : null}
      Every idea on the site is researched, sized for a weekend and paired with prompts for
      the AI tools you already use. On Saturday I take one of them, HydroTrail, and build it
      in front of you.
    </>
  );

  return (
    <div
      className={`${newsreaderEditorial.variable} theme-desk overflow-x-clip bg-home-paper font-sans text-home-ink`}
    >
      <PersistLiveAttrib />
      <JsonLd schema={SCHEMA} />

      <main>
        {/* Hero / state banners */}
        {phase === "live" ? (
          <section className="mx-auto max-w-[1120px] px-5 pt-28 pb-14 sm:px-10 sm:pt-36 sm:pb-20">
            <p className={`${EYEBROW} text-home-orange`}>Free live build</p>
            <h1 className="font-editorial mt-4 text-[46px] leading-[1.02] font-medium tracking-[-0.02em] sm:text-[76px]">
              We&apos;re <Em>live.</Em>
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-[#4A453C]">
              HydroTrail, a hydration coach for hikers, is being built right now from an empty
              folder. The stream is public, so you don&apos;t need to sign up to watch. Want
              the replay for 7 days? Register on Luma. It takes a few seconds.
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
                  className="inline-flex h-[52px] items-center text-sm font-medium text-home-ink underline decoration-home-rule underline-offset-4"
                >
                  Register for the replay
                </LumaRegisterLink>
              ) : null}
            </div>
          </section>
        ) : phase === "replay" ? (
          <section className="mx-auto max-w-[1120px] px-5 pt-28 pb-14 sm:px-10 sm:pt-36 sm:pb-20">
            <h1 className="font-editorial text-[46px] leading-[1.02] font-medium tracking-[-0.02em] sm:text-[64px]">
              This session has <Em>ended.</Em>
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-[#4A453C]">
              Registrants: the replay is in your email, for 7 days after the session. After
              that, an edited version goes up on YouTube. Missed it? Start with the free
              library and the Starter Kit.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <LiveButton href={STARTUP_IDEAS_HREF} variant="primary">
                Browse free ideas
              </LiveButton>
              <Link
                href="/live/build-along"
                className="text-sm font-medium text-home-ink underline decoration-home-rule underline-offset-4"
              >
                See the build-along on Sat 14 Nov →
              </Link>
            </div>
          </section>
        ) : phase === "ended" ? (
          <section className="mx-auto max-w-[1120px] px-5 pt-28 pb-14 sm:px-10 sm:pt-36 sm:pb-20">
            <h1 className="font-editorial text-[46px] leading-[1.02] font-medium tracking-[-0.02em] sm:text-[64px]">
              This session has <Em>ended.</Em>
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-[#4A453C]">
              {urls.youtubeReplayUrl
                ? "An edited replay is on YouTube."
                : "An edited replay is coming to YouTube."}{" "}
              Next free webinar coming soon.
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
                className="text-sm font-medium text-home-ink underline decoration-home-rule underline-offset-4"
              >
                Get the free Starter Kit
              </Link>
            </div>
          </section>
        ) : (
          <section className="mx-auto grid max-w-[1120px] items-center gap-12 px-5 pt-24 pb-14 sm:px-10 sm:pt-36 sm:pb-20 lg:grid-cols-[1.2fr_0.8fr] lg:gap-16">
            <div>
              <p className={`${EYEBROW} text-home-orange-ink`}>
                Free live build · Sat 31 Oct · 16:00 GMT
              </p>
              <h1 className="font-editorial mt-3 text-[34px] leading-[1.05] font-medium tracking-[-0.02em] sm:mt-4 sm:text-[52px]">
                Build a real app live in <Em>one hour</Em> (free)
              </h1>

              <div className="mt-5 border-l-2 border-home-orange pl-4 sm:mt-8 sm:pl-6">
                <p className={`${EYEBROW} text-[#6B6457]`}>On Saturday I build</p>
                <p className="font-editorial mt-1 text-[44px] leading-none font-medium tracking-[-0.025em] sm:text-[72px]">
                  {HYDROTRAIL.name}
                </p>
                <p className="mt-1.5 text-lg font-medium text-[#4A453C] sm:text-xl">
                  {HYDROTRAIL.oneLiner}
                </p>
                <p className="font-editorial mt-3 text-xl leading-snug text-home-orange-ink italic sm:text-2xl">
                  &ldquo;{HYDROTRAIL.hook}&rdquo;
                </p>
              </div>

              <p className="mt-5 max-w-lg text-base leading-relaxed text-[#4A453C] sm:mt-7 sm:text-lg">
                Live on YouTube, from an empty folder to its first working screen with Claude
                Code. Free to watch.
              </p>

              <RegisterCta lumaUrl={urls.lumaEventUrl} className="mt-6 sm:mt-8" />
            </div>

            <div className="flex flex-col items-center gap-6">
              <HikeScreenMock />
              <div className="flex w-full max-w-[320px] items-center gap-3.5 rounded-2xl border border-home-rule bg-home-card p-4">
                <DateTile month="OCT" day="31" weekday="SAT" />
                <div className="min-w-0">
                  <div className="font-semibold">16:00–17:00 GMT</div>
                  <div className="mt-0.5 font-mono text-xs text-[#6B6457]">
                    12:00 New York · 09:00 Los Angeles
                  </div>
                  <LocalTime
                    startMs={FREE_WEBINAR.startAt}
                    endMs={FREE_WEBINAR.endAt}
                    className="mt-0.5 font-mono text-xs text-[#6B6457]"
                  />
                </div>
              </div>
            </div>
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

        {/* What we're building */}
        <section
          aria-labelledby="building-heading"
          className="mx-auto max-w-[1120px] px-5 py-14 sm:px-10 sm:py-20"
        >
          <div className="grid gap-10 lg:grid-cols-[1fr_1fr] lg:gap-16">
            <div>
              <p className={`${EYEBROW} text-home-orange-ink`}>What we&apos;re building</p>
              <h2 id="building-heading" className={H2}>
                HydroTrail, <Em>a hydration coach for hikers</Em>
              </h2>
              <div className="mt-5 max-w-xl space-y-4 text-[17px] leading-relaxed text-[#4A453C]">
                <p>
                  Day-hikers plan to sip every 20 minutes. Then the heat and the climbs break
                  the plan.
                </p>
                <p>
                  Apple Health, Garmin and kitchen water apps fire on a wall clock. They
                  don&apos;t know you just gained 1,800 ft in the heat.
                </p>
                <p>
                  HydroTrail is trail-first, not a kitchen water tracker. It turns your body
                  stats, the packets you carry, heat, altitude and pace into three things:
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-4">
              <ol className="divide-y divide-home-rule rounded-2xl border border-home-rule bg-home-card">
                {HYDROTRAIL_OUTPUTS.map((item, i) => (
                  <li key={item.title} className="flex gap-4 p-5">
                    <span
                      aria-hidden="true"
                      className="font-mono text-xs leading-7 text-home-orange-ink"
                    >
                      0{i + 1}
                    </span>
                    <div>
                      <h3 className="font-editorial text-[22px] font-medium">{item.title}</h3>
                      <p className="mt-0.5 text-[15px] leading-relaxed text-[#4A453C]">
                        {item.body}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>

              <div className="rounded-2xl bg-home-panel p-5 text-[#d6cdbd]">
                <p className={`${EYEBROW} text-[#c9bfae]`}>The engine</p>
                <p className="mt-2 text-[15px] leading-relaxed text-white">
                  A plain TypeScript rule, not AI on every step.
                </p>
                <ul className="mt-3 space-y-1.5 font-mono text-[13px]">
                  {HYDROTRAIL_RULES.map((rule) => (
                    <li key={rule.when} className="flex flex-wrap gap-x-2">
                      <span className="text-home-orange-light">{rule.when}</span>
                      <span aria-hidden="true" className="text-[#8a8274]">
                        →
                      </span>
                      <span>{rule.then}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          <div className="mt-10 flex flex-col gap-4 border-t border-home-rule pt-6 sm:flex-row sm:items-start sm:justify-between sm:gap-10">
            <p className="max-w-2xl text-sm leading-relaxed text-[#6B6457]">
              Smart hydration was a USD 2.7B market in 2025, projected to reach USD 8.4B by
              2033 at a 15.1% CAGR (HTF Market Insights). The closest software peer, MyHydrate,
              has no altitude or outdoor context.
            </p>
            <Link
              href={DEMO_IDEA_HREF}
              className="flex-none text-[15px] font-semibold text-home-orange-ink underline decoration-home-rule underline-offset-4 hover:decoration-home-orange-ink"
            >
              Read the full idea →
            </Link>
          </div>
        </section>

        {/* The four screens */}
        <section
          aria-labelledby="screens-heading"
          className="mx-auto max-w-[1120px] px-5 py-14 sm:px-10 sm:py-20"
        >
          <p className={`${EYEBROW} text-[#6B6457]`}>The build</p>
          <h2 id="screens-heading" className={H2}>
            The four screens, <Em>in order</Em>
          </h2>
          <p className="mt-3 max-w-2xl text-[#6B6457]">
            This is what it looks like to build a hydration app with AI. One screen at a time,
            in the order we build them on stream.
          </p>
          <ol className="mt-10 grid grid-cols-2 gap-x-4 gap-y-8 lg:grid-cols-4 lg:gap-6">
            {HYDROTRAIL_SCREENS.map((screen) => (
              <li key={screen.key} className="flex flex-col">
                <div className="mx-auto w-full max-w-[200px]">
                  <ScreenSketch kind={screen.key} />
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <span aria-hidden="true" className="font-mono text-xs text-home-orange-ink">
                    {screen.n}
                  </span>
                  <h3 className="font-editorial text-[22px] leading-tight font-medium">
                    {screen.title}
                  </h3>
                  {screen.badge ? (
                    <span
                      className={
                        screen.key === "landing"
                          ? "rounded-full bg-home-orange-ink px-2 py-0.5 font-mono text-[10px] tracking-[0.06em] text-white uppercase"
                          : "rounded-full border border-home-rule px-2 py-0.5 font-mono text-[10px] tracking-[0.06em] text-[#6B6457] uppercase"
                      }
                    >
                      {screen.badge}
                    </span>
                  ) : null}
                </div>
                <p className="mt-1.5 text-sm leading-relaxed text-[#4A453C]">{screen.body}</p>
              </li>
            ))}
          </ol>
          <p className="mt-8 max-w-2xl text-sm leading-relaxed text-[#6B6457]">
            Stack: Next.js, Tailwind and shadcn, built with Claude Code. On stream, storage
            stays on the device. Adding Supabase sign-in is your Saturday afternoon.
          </p>
        </section>

        {/* How the hour runs */}
        <section
          aria-labelledby="agenda-heading"
          className="mx-auto max-w-[1120px] px-5 py-14 sm:px-10 sm:py-20"
        >
          <p className={`${EYEBROW} text-[#6B6457]`}>Sat 31 Oct · GMT</p>
          <h2 id="agenda-heading" className={`${H2} mb-8`}>
            How the hour <Em>runs</Em>
          </h2>
          <ol className="relative border-l border-home-rule">
            {FREE_AGENDA.map((row) => (
              <li
                key={row.clock}
                className="relative grid gap-1 pb-7 pl-6 last:pb-0 sm:grid-cols-[140px_1fr] sm:gap-8 sm:pl-8"
              >
                <span
                  aria-hidden="true"
                  className={
                    row.tag
                      ? "absolute top-1 -left-[7px] h-3.5 w-3.5 rounded-full border-2 border-home-paper bg-home-orange-ink"
                      : "absolute top-1.5 -left-[5px] h-2.5 w-2.5 rounded-full bg-home-rule"
                  }
                />
                <span className="font-mono text-[13px] font-semibold text-home-orange-ink tabular-nums">
                  {row.clock}
                </span>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-editorial text-xl font-medium">{row.title}</h3>
                    {row.tag ? (
                      <span className="rounded-full border border-home-orange-ink px-2 py-0.5 font-mono text-[10px] tracking-[0.06em] text-home-orange-ink uppercase">
                        {row.tag}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 max-w-2xl text-[15px] leading-relaxed text-[#4A453C]">
                    {row.body}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        {/* The promise */}
        <section className="mx-auto max-w-[1120px] px-5 py-10 sm:px-10 sm:py-14">
          <div className="rounded-[22px] bg-home-panel px-7 py-12 sm:px-14 sm:py-14">
            <p className={`${EYEBROW} text-[#c9bfae]`}>What I promise, and what I don&apos;t</p>
            <h2 className="font-editorial mt-3.5 text-[34px] leading-[1.06] font-medium tracking-[-0.015em] text-white sm:text-5xl">
              One idea. One build. <Em dark>Start to finish.</Em>
            </h2>
            <dl className="mt-8 grid gap-6 text-[15px] leading-relaxed sm:grid-cols-3 sm:gap-8">
              <div>
                <dt className="font-semibold text-white">The promise</dt>
                <dd className="mt-1 text-[#d6cdbd]">
                  HydroTrail&apos;s first working screen, built live from an empty folder.
                </dd>
              </div>
              <div>
                <dt className="font-semibold text-white">The plan</dt>
                <dd className="mt-1 text-[#d6cdbd]">
                  The full loop: setup, live hike and recap.
                </dd>
              </div>
              <div>
                <dt className="font-semibold text-white">The bonus</dt>
                <dd className="mt-1 text-[#d6cdbd]">
                  If it holds, it goes live on a public link before the hour&apos;s up.
                </dd>
              </div>
            </dl>
            <p className="mt-8 text-[#d6cdbd]">If something breaks, you&apos;ll see me fix it.</p>
          </div>
        </section>

        {/* Weekend test */}
        <section
          aria-labelledby="test-heading"
          className="mx-auto max-w-[1120px] px-5 py-14 sm:px-10 sm:py-20"
        >
          <p className={`${EYEBROW} text-home-orange-ink`}>The method</p>
          <h2 id="test-heading" className={H2}>
            Why HydroTrail passes <Em>the weekend test</Em>
          </h2>
          <p className="mt-3 max-w-2xl text-[#6B6457]">
            Six checks. If an idea passes all six, you can ship a first version in one weekend.
            We&apos;ll run two ideas from the chat through it live too.
          </p>
          <ul className="mt-8 flex flex-wrap gap-2.5">
            {WEEKEND_TEST_CHIPS.map((chip) => (
              <li
                key={chip.n}
                className="flex w-full items-baseline gap-2.5 rounded-2xl border border-home-rule bg-home-card px-4 py-3 text-[15px] leading-snug sm:w-auto sm:rounded-full sm:py-2.5"
              >
                <span aria-hidden="true" className="font-mono text-home-orange-ink">
                  ✓
                </span>
                <span>
                  <span className="font-semibold">{chip.title}</span>
                  <span className="text-[#6B6457]"> · {chip.body}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>

        {/* You'll leave with */}
        <section
          aria-labelledby="leave-heading"
          className="mx-auto grid max-w-[1120px] gap-10 px-5 py-14 sm:grid-cols-2 sm:px-10 sm:py-20"
        >
          <div>
            <p className={`${EYEBROW} text-[#6B6457]`}>You&apos;ll leave with</p>
            <h2 id="leave-heading" className={H2}>
              In one hour, <Em>you&apos;ll leave with:</Em>
            </h2>
          </div>
          <ul className="divide-y divide-home-rule border-y border-home-rule">
            {FREE_LEAVE_WITH.map((item) => (
              <li
                key={item.title}
                className="relative py-3.5 pl-8 text-[15px] leading-relaxed text-home-ink"
              >
                <span
                  aria-hidden="true"
                  className="absolute top-4 left-0 font-mono text-home-orange"
                >
                  ✓
                </span>
                <strong>{item.title}</strong>, {item.body}
              </li>
            ))}
          </ul>
        </section>

        {/* For / not for */}
        <section className="mx-auto grid max-w-[1120px] gap-4 px-5 py-10 sm:grid-cols-2 sm:px-10 sm:py-16">
          <div className="rounded-2xl border border-home-rule bg-home-card p-7">
            <p className={`${EYEBROW} text-home-orange-ink`}>This is for you if</p>
            <CheckList items={FREE_FOR_YOU} />
          </div>
          <div className="rounded-2xl border border-home-rule bg-home-sunk p-7">
            <p className={`${EYEBROW} text-[#6B6457]`}>It&apos;s not for you if</p>
            <CheckList items={FREE_NOT_FOR_YOU} variant="x" />
          </div>
        </section>

        {/* Host */}
        <section className="py-14 sm:py-20">
          <HostBlock eyebrow="Your host" body={hostBody} />
        </section>

        {/* Proof — hidden until quotes exist */}
        {proof.length >= 2 ? (
          <section className="mx-auto max-w-[1120px] px-5 py-14 sm:px-10 sm:py-20">
            <h2 className="font-editorial text-[34px] font-medium tracking-[-0.015em] sm:text-5xl">
              From people who came
            </h2>
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

        <LiveFaq items={freeFaqItemsVisible()} />

        {/* Final CTA — only useful while registration is open */}
        {phase === "open" ? (
          <section className="mx-auto max-w-[1120px] px-5 pb-24 sm:px-10">
            <div className="rounded-2xl border border-home-rule bg-home-card px-6 py-14 text-center sm:px-14">
              <h2 className="font-editorial text-[34px] leading-[1.06] font-medium tracking-[-0.015em] sm:text-5xl">
                Watch HydroTrail <Em>get built.</Em>
              </h2>
              <p className="mt-4 font-mono text-xs tracking-[0.06em] text-[#6B6457] uppercase">
                Sat 31 Oct 2026 · 16:00 GMT · YouTube Live · Free
              </p>
              <RegisterCta
                lumaUrl={urls.lumaEventUrl}
                className="mx-auto mt-6 flex max-w-sm flex-col items-center"
              />
            </div>
          </section>
        ) : null}
      </main>

      {/* Pinned to the viewport bottom: the fixed MegaNav owns the top edge. */}
      <div className="sticky bottom-0 z-40 border-t border-[#2e2a24] bg-[#1A1814] pb-[env(safe-area-inset-bottom)] text-[#F7F3EC]">
        <div className="mx-auto flex max-w-[1120px] flex-wrap items-center justify-center gap-x-3 gap-y-1 px-5 py-2.5 font-mono text-[11px] tracking-[0.06em] uppercase sm:px-10 sm:text-xs">
          {phase === "live" ? (
            <>
              <span className="rounded-full border border-[#5a544a] px-2 py-0.5 text-[10px]">
                Live now
              </span>
              <span className="hidden sm:inline">{TITLE}</span>
              <span className="text-[#5a544a]" aria-hidden="true">
                ·
              </span>
              <span>on YouTube</span>
            </>
          ) : (
            <>
              <span className="rounded-full border border-[#5a544a] px-2 py-0.5 text-[10px]">
                Live
              </span>
              <span>Sat 31 Oct 2026</span>
              <span className="text-[#5a544a]" aria-hidden="true">
                ·
              </span>
              <span>16:00 GMT</span>
              <span className="hidden text-[#c9bfae] sm:inline">
                · 12:00 New York · 09:00 Los Angeles
              </span>
              <span className="hidden text-[#5a544a] sm:inline" aria-hidden="true">
                ·
              </span>
              <span className="hidden sm:inline">60 min</span>
              <span className="text-[#5a544a]" aria-hidden="true">
                ·
              </span>
              <span>Free</span>
              <span className="hidden text-[#5a544a] sm:inline" aria-hidden="true">
                ·
              </span>
              <span className="hidden sm:inline">YouTube Live</span>
            </>
          )}
        </div>
        <div className="mx-auto max-w-[1120px] px-5 pb-2 text-center sm:px-10">
          <LocalTime
            startMs={FREE_WEBINAR.startAt}
            endMs={FREE_WEBINAR.endAt}
            className="font-mono text-[11px] text-[#c9bfae]"
          />
        </div>
      </div>
    </div>
  );
}
