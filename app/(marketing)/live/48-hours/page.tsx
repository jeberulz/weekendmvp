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
import {
  BUILD_ALONG,
  FREE_WEBINAR,
  LIVE_ASSETS,
  STARTUP_IDEAS_HREF,
  liveUrls,
} from "@/lib/live/config";
import { freeWebinarPhase, salesOpen } from "@/lib/live/schedule";
import { readLiveClockMs } from "@/lib/live/now";
import {
  SITE,
  breadcrumbSchema,
  buildGraph,
  organizationSchema,
  personSchema,
} from "@/lib/seo";
import { categoryName, normalizeCategorySlug } from "@/components/ideas/idea-meta";
import { liveIdeas } from "@/lib/home/library";
import type { ManifestIdea } from "@/lib/home/types";
import manifestJson from "@/ideas/manifest.json";

import {
  FREE_AGENDA,
  FREE_FOR_YOU,
  FREE_LEAVE_WITH,
  FREE_NOT_FOR_YOU,
  WEEKEND_TEST_CHIPS,
  freeFaqItemsVisible,
} from "./free-data";

const TITLE = "Ship a Weekend MVP in 48 Hours — Free Live Webinar";
const DESCRIPTION =
  "Free 60-minute live webinar on Sat 31 Oct 2026, 16:00 GMT. One real idea, HydroTrail, taken from its page to its first working screen with Prompt 1. Register for reminders and the 7-day replay.";

const DEMO_IDEA_HREF = LIVE_ASSETS.demoIdeaSlug
  ? `/ideas/${LIVE_ASSETS.demoIdeaSlug}`
  : null;

export const instant = false;

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
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
        alt: "Ship a Weekend MVP in 48 Hours",
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
    { label: "48 Hours", href: `${SITE}/live/48-hours` },
  ]),
  {
    "@type": "EducationEvent",
    name: FREE_WEBINAR.title,
    description: DESCRIPTION,
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

function loadIdeaCards(): { slug: string; title: string; category: string; hours: number }[] {
  const slugs = LIVE_ASSETS.freeNowIdeaSlugs;
  if (slugs.length === 0) return [];
  const ideas = liveIdeas((manifestJson as { ideas: ManifestIdea[] }).ideas ?? []);
  const bySlug = new Map(ideas.map((i) => [i.slug, i]));
  return slugs.flatMap((slug) => {
    const idea = bySlug.get(slug);
    if (!idea) return [];
    const cat = normalizeCategorySlug(idea.category);
    return [
      {
        slug: idea.slug,
        title: idea.title,
        category: cat ? categoryName(cat) : "",
        hours: Number(idea.buildTime) || 0,
      },
    ];
  });
}

function RegisterCta({
  lumaUrl,
  className,
}: {
  lumaUrl: string;
  className?: string;
}) {
  if (!lumaUrl) {
    return (
      <div className={className}>
        <LiveButton disabled>Registration link coming soon</LiveButton>
        <p className="mt-2 font-mono text-[11px] text-[#6B6457]">Register on Luma ↗</p>
      </div>
    );
  }
  return (
    <div className={className}>
      <LumaRegisterLink href={lumaUrl}>Save my free seat</LumaRegisterLink>
      <p className="mt-2 font-mono text-[11px] text-[#6B6457]">Register on Luma ↗</p>
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
  const ticketsOpen = salesOpen(now);
  const ideaCards = loadIdeaCards();
  const proof = LIVE_ASSETS.freeProofQuotes;
  const hostBody = (
    <>
      {LIVE_ASSETS.hostEveningsConfirmed
        ? "I build Weekend MVP around a full-time job, on evenings and Saturdays. "
        : null}
      Every idea on the site is researched, sized for a weekend and paired with prompts for
      the AI tools you already use. This session is that method, live.
    </>
  );

  return (
    <div
      className={`${newsreaderEditorial.variable} theme-desk overflow-x-clip bg-home-paper font-sans text-home-ink`}
    >
      <PersistLiveAttrib />
      <JsonLd schema={SCHEMA} />

      {/* Date bar */}
      <div className="bg-[#1A1814] text-[#F7F3EC]">
        <div className="mx-auto flex max-w-[1120px] flex-wrap items-center justify-center gap-x-3 gap-y-1 px-5 py-2.5 font-mono text-[11px] tracking-[0.06em] uppercase sm:px-10 sm:text-xs">
          {phase === "live" ? (
            <>
              <span className="rounded-full border border-[#5a544a] px-2 py-0.5 text-[10px]">
                Live now
              </span>
              <span className="hidden sm:inline">Ship a Weekend MVP in 48 Hours</span>
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

      <main>
        {/* Hero / state banners */}
        {phase === "live" ? (
          <section className="mx-auto max-w-[1120px] px-5 py-14 sm:px-10 sm:py-20">
            <p className="font-mono text-[11px] tracking-[0.08em] text-home-orange uppercase">
              Free live webinar
            </p>
            <h1 className="font-editorial mt-4 text-[46px] leading-[1.02] font-medium tracking-[-0.02em] sm:text-[76px]">
              We&apos;re <Em>live.</Em>
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-[#4A453C]">
              Come in. The stream is public, so you don&apos;t need to sign up to watch. Want
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
          <section className="mx-auto max-w-[1120px] px-5 py-14 sm:px-10 sm:py-20">
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
          <section className="mx-auto max-w-[1120px] px-5 py-14 sm:px-10 sm:py-20">
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
          <section className="mx-auto grid max-w-[1120px] items-center gap-10 px-5 py-14 sm:px-10 sm:py-20 lg:grid-cols-[1.25fr_0.9fr] lg:gap-14">
            <div>
              <p className="font-mono text-[11px] tracking-[0.08em] text-home-orange uppercase">
                Free live webinar
              </p>
              <h1 className="font-editorial mt-4 text-[46px] leading-[1.02] font-medium tracking-[-0.02em] sm:text-[76px]">
                Ship a Weekend MVP in <Em>48 Hours</Em>
              </h1>
              <p className="mt-5 max-w-xl text-lg leading-relaxed text-[#4A453C]">
                Live and free on Sat 31 Oct, 16:00 GMT. One real idea (
                {DEMO_IDEA_HREF ? (
                  <Link
                    href={DEMO_IDEA_HREF}
                    className="underline decoration-home-rule underline-offset-4 hover:text-home-orange-ink"
                  >
                    HydroTrail
                  </Link>
                ) : (
                  "HydroTrail"
                )}
                , a hydration coach for hikers), three screens, and Prompt 1 on screen.
              </p>
              <div className="mt-8">
                <div className="flex flex-wrap gap-3">
                  {urls.lumaEventUrl ? (
                    <LumaRegisterLink href={urls.lumaEventUrl}>
                      Save my free seat
                    </LumaRegisterLink>
                  ) : (
                    <LiveButton disabled>Registration link coming soon</LiveButton>
                  )}
                  <LiveButton href={STARTUP_IDEAS_HREF} variant="ghost">
                    Browse free ideas
                  </LiveButton>
                </div>
                <p className="mt-2 font-mono text-[11px] text-[#6B6457]">
                  Register on Luma ↗
                </p>
              </div>
              <p className="mt-4 max-w-lg text-sm text-[#6B6457]">
                Free. The YouTube link is public during the live hour, so you can just turn up.
                Register on Luma to get reminders and the 7-day replay.
              </p>
            </div>

            <aside className="rounded-2xl border border-home-rule bg-home-card p-6">
              <div className="flex gap-3.5">
                <DateTile month="OCT" day="31" weekday="SAT" />
                <div>
                  <div className="font-editorial text-[22px] leading-tight">
                    Saturday 31 October 2026
                  </div>
                  <div className="mt-1 font-semibold">16:00–17:00 GMT</div>
                  <div className="mt-1 font-mono text-xs text-[#6B6457]">
                    12:00 New York · 09:00 Los Angeles
                  </div>
                  <LocalTime
                    startMs={FREE_WEBINAR.startAt}
                    endMs={FREE_WEBINAR.endAt}
                    className="mt-1 font-mono text-xs text-[#6B6457]"
                  />
                </div>
              </div>
              <hr className="my-4 border-home-rule" />
              <ul className="space-y-3 text-sm">
                <li className="flex gap-3">
                  <span
                    aria-hidden="true"
                    className="flex h-9 w-9 flex-none items-center justify-center rounded-[10px] border border-home-rule bg-home-paper font-mono text-xs text-home-orange"
                  >
                    ▶
                  </span>
                  <div>
                    <div className="font-semibold">YouTube Live</div>
                    <div className="text-[#6B6457]">
                      The link comes in your Luma confirmation and reminders.
                    </div>
                  </div>
                </li>
                <li className="flex gap-3">
                  <span
                    aria-hidden="true"
                    className="flex h-9 w-9 flex-none items-center justify-center rounded-[10px] border border-home-rule bg-home-paper font-mono text-xs text-home-orange"
                  >
                    ↺
                  </span>
                  <div>
                    <div className="font-semibold">Replay for 7 days</div>
                    <div className="text-[#6B6457]">For registrants, after the session.</div>
                  </div>
                </li>
                <li className="flex gap-3">
                  <span
                    aria-hidden="true"
                    className="flex h-9 w-9 flex-none items-center justify-center rounded-[10px] border border-home-rule bg-home-paper font-mono text-[10px] text-home-orange"
                  >
                    JI
                  </span>
                  <div>
                    <div className="font-semibold">John Iseghohi</div>
                    <div className="text-[#6B6457]">
                      Staff product designer, founder of Weekend MVP
                    </div>
                  </div>
                </li>
              </ul>
              <div className="mt-5">
                <RegisterCta lumaUrl={urls.lumaEventUrl} className="text-center [&_a]:w-full [&_span]:w-full" />
              </div>
            </aside>
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

        {/* You'll leave with */}
        <section className="mx-auto grid max-w-[1120px] gap-10 px-5 py-14 sm:grid-cols-2 sm:px-10 sm:py-20">
          <div>
            <p className="font-mono text-[11px] tracking-[0.08em] text-[#6B6457] uppercase">
              You&apos;ll leave with
            </p>
            <h2 className="font-editorial mt-3 text-[34px] leading-[1.06] font-medium tracking-[-0.015em] sm:text-5xl">
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

        {/* Weekend test */}
        <section className="mx-auto max-w-[1120px] px-5 py-14 sm:px-10 sm:py-20">
          <p className="font-mono text-[11px] tracking-[0.08em] text-home-orange uppercase">
            The method
          </p>
          <h2 className="font-editorial mt-3 text-[34px] leading-[1.06] font-medium tracking-[-0.015em] sm:text-5xl">
            The weekend test
          </h2>
          <p className="mt-3 max-w-2xl text-[#6B6457]">
            Six checks. If an idea passes all six, you can ship a first version in one weekend.
          </p>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {WEEKEND_TEST_CHIPS.map((chip) => (
              <div
                key={chip.n}
                className="rounded-2xl border border-home-rule bg-home-card p-[22px]"
              >
                <div className="font-mono text-xs text-home-orange">{chip.n}</div>
                <h3 className="font-editorial mt-1.5 text-[22px] font-medium">{chip.title}</h3>
                <p className="mt-1 text-sm text-[#6B6457]">{chip.body}</p>
              </div>
            ))}
          </div>
          <p className="mt-4 text-sm text-[#6B6457]">
            We&apos;ll run two ideas from the chat through it live.
          </p>
        </section>

        {/* Agenda */}
        <section className="mx-auto max-w-[1120px] px-5 py-14 sm:px-10 sm:py-20">
          <p className="font-mono text-[11px] tracking-[0.08em] text-[#6B6457] uppercase">
            Agenda
          </p>
          <h2 className="font-editorial mt-3 mb-8 text-[34px] leading-[1.06] font-medium tracking-[-0.015em] sm:text-5xl">
            The hour, <Em>minute by minute</Em>
          </h2>
          <div className="divide-y divide-home-rule border-y border-home-rule">
            {FREE_AGENDA.map((row) => (
              <div
                key={row.range}
                className="grid gap-3 py-5 sm:grid-cols-[100px_1fr_auto] sm:items-start sm:gap-6"
              >
                <span className="font-mono text-[11px] tracking-[0.08em] text-home-orange uppercase">
                  {row.range}
                </span>
                <div>
                  <div className="font-editorial text-xl font-medium">{row.title}</div>
                  <p className="mt-1 text-[15px] leading-relaxed text-[#4A453C]">{row.body}</p>
                </div>
                <span className="font-mono text-xs text-[#6B6457] sm:pt-1">{row.clock}</span>
              </div>
            ))}
          </div>
        </section>

        {/* For / not for */}
        <section className="mx-auto grid max-w-[1120px] gap-4 px-5 py-10 sm:grid-cols-2 sm:px-10 sm:py-16">
          <div className="rounded-2xl border border-home-rule bg-home-card p-7">
            <p className="font-mono text-[11px] tracking-[0.08em] text-home-orange uppercase">
              This is for you if
            </p>
            <CheckList items={FREE_FOR_YOU} />
          </div>
          <div className="rounded-2xl border border-home-rule bg-home-sunk p-7">
            <p className="font-mono text-[11px] tracking-[0.08em] text-[#6B6457] uppercase">
              It&apos;s not for you if
            </p>
            <CheckList items={FREE_NOT_FOR_YOU} variant="x" />
          </div>
        </section>

        {/* Not a tool parade */}
        <section className="mx-auto max-w-[1120px] px-5 py-14 sm:px-10 sm:py-20">
          <div className="rounded-[22px] bg-[#24211C] px-8 py-14 text-center sm:px-16 sm:py-16">
            <p className="font-mono text-[11px] tracking-[0.08em] text-[#c9bfae] uppercase">
              Not a tool parade
            </p>
            <h2 className="font-editorial mt-3.5 text-[34px] leading-[1.06] font-medium tracking-[-0.015em] text-white sm:text-5xl">
              One idea. One build. <Em dark>Start to finish.</Em>
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-[#d6cdbd]">
              This isn&apos;t an hour of tool demos. We don&apos;t compare twelve AI apps or
              chase whatever launched this week. We take one idea
              {DEMO_IDEA_HREF ? (
                <>
                  ,{" "}
                  <Link
                    href={DEMO_IDEA_HREF}
                    className="underline decoration-[#5a544a] underline-offset-4 hover:text-white"
                  >
                    HydroTrail
                  </Link>
                  ,
                </>
              ) : (
                ", HydroTrail,"
              )}{" "}
              and go from its page to its first working screen, live, with the same prompts
              you can use tonight. If something breaks, you&apos;ll see me fix it.
            </p>
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

        {/* Free now */}
        <section className="mx-auto max-w-[1120px] px-5 py-14 sm:px-10 sm:py-20">
          <p className="font-mono text-[11px] tracking-[0.08em] text-[#6B6457] uppercase">
            Free now
          </p>
          <h2 className="font-editorial mt-3 text-[34px] leading-[1.06] font-medium tracking-[-0.015em] sm:text-5xl">
            Want to start <Em>before Saturday?</Em>
          </h2>
          <p className="mt-3 max-w-2xl text-[#6B6457]">
            You don&apos;t have to wait for the session. Every idea in the library is sized for
            a weekend and comes with copy-paste prompts.
          </p>
          {ideaCards.length > 0 ? (
            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              {ideaCards.map((idea) => (
                <Link
                  key={idea.slug}
                  href={`/ideas/${idea.slug}`}
                  className="flex min-h-[150px] flex-col gap-2 rounded-2xl border border-home-rule bg-home-card p-5 transition-colors hover:bg-home-sunk focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-home-orange"
                >
                  {idea.category ? (
                    <span className="w-fit rounded-full border border-home-rule px-2.5 py-0.5 font-mono text-[10px] tracking-[0.06em] text-[#6B6457] uppercase">
                      {idea.category}
                    </span>
                  ) : null}
                  <span className="font-editorial text-[22px] leading-snug">{idea.title}</span>
                  {idea.hours > 0 ? (
                    <span className="font-mono text-xs text-[#6B6457]">~{idea.hours} hours</span>
                  ) : null}
                  <span className="mt-auto text-sm text-[#A84A00]">Open idea →</span>
                </Link>
              ))}
            </div>
          ) : null}
          <div className="mt-6 flex flex-wrap items-center gap-4">
            <LiveButton href={STARTUP_IDEAS_HREF} variant="secondary">
              Create your free account
            </LiveButton>
            <Link
              href="/starter-kit"
              className="text-sm underline decoration-home-rule underline-offset-4"
            >
              Get the free Starter Kit
            </Link>
          </div>
        </section>

        {/* Free → paid bridge */}
        <section className="mx-auto max-w-[1120px] px-5 py-10 sm:px-10 sm:py-14">
          <div className="grid gap-8 rounded-2xl border border-home-rule bg-home-sunk p-7 sm:grid-cols-2 sm:gap-10 sm:p-9">
            <div>
              <p className="font-mono text-[11px] tracking-[0.08em] text-[#6B6457] uppercase">
                What comes after
              </p>
              <h3 className="font-editorial mt-2.5 text-3xl font-medium tracking-tight">
                If you want to build it with me
              </h3>
            </div>
            <div className="text-[15px] leading-relaxed text-[#4A453C]">
              <p>
                The webinar is free and it&apos;s complete. You can leave with the plan and do
                the rest on your own.
              </p>
              <p className="mt-3">
                If you&apos;d rather build with someone, there&apos;s the paid{" "}
                <strong>{BUILD_ALONG.title}</strong> (
                <em className="text-home-orange">{BUILD_ALONG.subline}</em>
                ): <strong>2 hours on Sat 14 Nov at 15:00 GMT</strong>, on Zoom. You bring an
                idea, or pick one from the library, and build it live while I build one too.
                The replay is yours to keep. Tickets open Sun 1 Nov.
              </p>
              <p className="mt-3">
                You don&apos;t need it to get value from the free session, and I won&apos;t
                hard-sell it. I&apos;ll mention it once at the end.
              </p>
              <p className="mt-4 text-sm text-[#6B6457]">
                {ticketsOpen ? (
                  <Link
                    href="/live/build-along"
                    className="font-medium text-home-ink underline decoration-home-rule underline-offset-4"
                  >
                    See the build-along →
                  </Link>
                ) : (
                  "Tickets open Sun 1 Nov"
                )}
              </p>
            </div>
          </div>
        </section>

        <LiveFaq items={freeFaqItemsVisible()} />

        {/* Final CTA — only useful while registration is open */}
        {phase === "open" ? (
          <section className="mx-auto max-w-[1120px] px-5 pb-24 sm:px-10">
            <div className="rounded-2xl border border-home-rule bg-home-card px-8 py-14 text-center sm:px-14">
              <h2 className="font-editorial text-[34px] leading-[1.06] font-medium tracking-[-0.015em] sm:text-5xl">
                Ship a Weekend MVP in <Em>48 Hours</Em>
              </h2>
              <p className="mt-4 font-mono text-xs tracking-[0.06em] text-[#6B6457] uppercase">
                Sat 31 Oct 2026 · 16:00 GMT · YouTube Live · Free
              </p>
              <div className="mt-6 flex justify-center">
                <RegisterCta lumaUrl={urls.lumaEventUrl} className="text-center" />
              </div>
              <p className="mt-3 text-sm text-[#6B6457]">
                Free to watch live. Register for reminders and the 7-day replay.
              </p>
            </div>
          </section>
        ) : null}
      </main>
    </div>
  );
}
