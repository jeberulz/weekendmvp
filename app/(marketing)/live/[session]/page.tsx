import type { Metadata } from "next";
import { connection } from "next/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowUpRight } from "lucide-react";

import { Em } from "@/components/home/ui";
import { LiveButton } from "@/components/live/LiveButton";
import { LocalTime } from "@/components/live/LocalTime";
import { LumaRegisterLink } from "@/components/live/LumaRegisterLink";
import { NextSessionModule } from "@/components/live/NextSessionModule";
import { PersistLiveAttrib } from "@/components/live/PersistLiveAttrib";
import { PhaseRefresh } from "@/components/live/PhaseRefresh";
import { JsonLd } from "@/components/primitives/JsonLd";
import { newsreaderEditorial } from "@/lib/fonts";
import { STARTUP_IDEAS_HREF } from "@/lib/live/config";
import { readLiveClockMs } from "@/lib/live/now";
import {
  nextPhaseBoundaryMs,
  sessionPhase,
  type SessionPhase,
} from "@/lib/live/session-phase";
import { sessionJsonLd } from "@/lib/live/session-schema";
import {
  getSessionBySlug,
  publishedSessions,
  sessionDefaultDescription,
  sessionDefaultTitle,
  sessionEmbedUrl,
  sessionPath,
  type LiveSession,
} from "@/lib/live/sessions";
import { SITE } from "@/lib/seo";
import { cn } from "@/lib/utils";

export const instant = false;

type PageProps = {
  params: Promise<{ session: string }>;
};

export function generateStaticParams() {
  return publishedSessions().map((s) => ({ session: s.slug }));
}

function seoKind(phase: SessionPhase): "before" | "after" {
  return phase === "upcoming" || phase === "live" ? "before" : "after";
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  await connection();
  const { session: slug } = await params;
  const session = getSessionBySlug(slug);
  if (!session || session.status === "draft") {
    return { title: "Session not found" };
  }
  const now = readLiveClockMs();
  const phase = sessionPhase(session, now);
  const kind = seoKind(phase);
  const title = sessionDefaultTitle(session, kind);
  const description = sessionDefaultDescription(session, kind);
  const path = sessionPath(session.slug);
  const keywords = [
    `build a ${session.category} app with AI`,
    session.ideaName,
    session.tool ? `${session.tool} build app from scratch` : "build mvp with AI",
    "how to build an app with ai step by step",
  ];

  return {
    title: { absolute: title },
    description,
    keywords,
    authors: [{ name: "John Iseghohi" }],
    alternates: { canonical: path },
    openGraph: {
      type: "website",
      siteName: "Weekend MVP",
      locale: "en_GB",
      url: `${SITE}${path}`,
      title,
      description,
      images: [
        {
          url: session.thumbnail
            ? session.thumbnail.startsWith("http")
              ? session.thumbnail
              : `${SITE}${session.thumbnail}`
            : `${SITE}/image/og-image.png`,
          alt: title,
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
        session.thumbnail
          ? session.thumbnail.startsWith("http")
            ? session.thumbnail
            : `${SITE}${session.thumbnail}`
          : `${SITE}/image/og-image.png`,
      ],
    },
  };
}

const SECTION = "mx-auto max-w-[1120px] px-5 py-14 sm:px-10 sm:py-20";
const H2 =
  "font-editorial text-[32px] leading-[1.08] font-medium tracking-[-0.015em] text-balance sm:text-[44px]";
const LEAD = "mt-4 max-w-[60ch] text-[17px] leading-relaxed text-[#4A453C]";
const FOCUS =
  "rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-home-orange-ink";
const BUTTON =
  "inline-flex h-[52px] w-full items-center justify-center gap-2.5 rounded-full bg-home-orange-ink px-[26px] text-base font-semibold whitespace-nowrap text-white transition-colors hover:bg-[#8F3F00] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-home-orange-ink sm:w-auto";

function titleCaseCategory(category: string): string {
  return category
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function SeatButton({ lumaUrl }: { lumaUrl: string }) {
  if (!lumaUrl) return <LiveButton disabled>Registration link coming soon</LiveButton>;
  return (
    <LumaRegisterLink href={lumaUrl} variant="inline" className={BUTTON}>
      Save my free seat
      <ArrowUpRight aria-hidden="true" className="size-[18px]" strokeWidth={2.25} />
    </LumaRegisterLink>
  );
}

function SessionHero({
  session,
  phase,
}: {
  session: LiveSession;
  phase: SessionPhase;
}) {
  const startMs = Date.parse(session.startsAt);
  const endMs = Date.parse(session.endsAt);
  const ideaHref = `/ideas/${session.ideaSlug}`;
  const categoryLabel = titleCaseCategory(session.category);
  const h1 = (
    <>
      Build {session.ideaName} live: a {session.category} app for hikers, with{" "}
      <Em>AI</Em>
    </>
  );
  // HydroTrail H1 from Demand; other sessions use the generic form.
  const heading =
    session.slug === "hydration-app-for-hikers" ? (
      h1
    ) : (
      <>
        Build {session.ideaName} live: a {categoryLabel.toLowerCase()} app with{" "}
        <Em>AI</Em>
      </>
    );

  if (phase === "live") {
    return (
      <section className="mx-auto max-w-[1120px] px-5 pt-28 pb-14 sm:px-10 sm:pt-36 sm:pb-20">
        <p className="font-mono text-[11px] tracking-[0.08em] text-home-orange uppercase">
          Live now
        </p>
        <h1 className="font-editorial mt-3 text-[46px] leading-[1.02] font-medium tracking-[-0.02em] sm:text-[64px]">
          We&apos;re <Em>live.</Em>
        </h1>
        <p className="mt-5 max-w-xl text-lg leading-relaxed text-[#4A453C]">
          {session.ideaName}, {session.oneLiner}, is being built right now.{" "}
          {session.youtubeLiveUrl
            ? "Watch on YouTube."
            : "Register on Luma for the stream link."}
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          {session.youtubeLiveUrl ? (
            <LiveButton href={session.youtubeLiveUrl} external variant="primary">
              Watch live
            </LiveButton>
          ) : (
            <SeatButton lumaUrl={session.lumaUrl} />
          )}
        </div>
      </section>
    );
  }

  if (phase === "upcoming") {
    return (
      <section className="mx-auto max-w-[1120px] px-5 pt-28 pb-14 sm:px-10 sm:pt-36 sm:pb-20">
        <p className="font-mono text-[11px] tracking-[0.08em] text-home-orange uppercase">
          Free · Live
        </p>
        <h1 className="font-editorial mt-3 text-[38px] leading-[1.04] font-medium tracking-[-0.022em] text-balance sm:text-[58px]">
          {heading}
        </h1>
        <p className="mt-5 max-w-[52ch] text-lg leading-relaxed text-[#4A453C]">
          Free 60-minute live build. Watch {session.ideaName} go from idea page
          to first working screen
          {session.tool ? ` with ${session.tool}` : " with AI"}.
        </p>
        <div id="hero-register" className="mt-7 grid justify-items-start gap-2.5">
          <SeatButton lumaUrl={session.lumaUrl} />
          <p className="max-w-[44ch] text-sm leading-relaxed text-[#6B6457]">
            Luma sends a reminder. The edited replay stays public on this page.
          </p>
        </div>
        <div className="mt-5 border-t border-home-rule pt-4 text-[15px] leading-relaxed text-[#4A453C]">
          <p>
            <strong className="font-semibold text-home-ink">
              {new Date(session.startsAt).toLocaleDateString("en-GB", {
                weekday: "short",
                day: "numeric",
                month: "short",
                year: "numeric",
                timeZone: "UTC",
              })}
              ,{" "}
              {new Date(session.startsAt).toLocaleTimeString("en-GB", {
                hour: "2-digit",
                minute: "2-digit",
                hour12: false,
                timeZone: "UTC",
              })}
              –
              {new Date(session.endsAt).toLocaleTimeString("en-GB", {
                hour: "2-digit",
                minute: "2-digit",
                hour12: false,
                timeZone: "UTC",
              })}{" "}
              GMT
            </strong>
          </p>
          <LocalTime startMs={startMs} endMs={endMs} className="text-[15px] text-[#4A453C]" />
        </div>
        <p className="mt-6 text-[15px]">
          <Link
            href={ideaHref}
            className={cn(
              "font-semibold text-[#A84A00] underline-offset-2 hover:underline",
              FOCUS,
            )}
          >
            {session.ideaName}: full research, market and prompts
          </Link>
        </p>
      </section>
    );
  }

  if (phase === "replay-pending") {
    return (
      <section className="mx-auto max-w-[1120px] px-5 pt-28 pb-14 sm:px-10 sm:pt-36 sm:pb-20">
        <p className="font-mono text-[11px] tracking-[0.08em] text-home-orange uppercase">
          Replay
        </p>
        <h1 className="font-editorial mt-3 text-[38px] leading-[1.04] font-medium tracking-[-0.022em] text-balance sm:text-[58px]">
          {heading}
        </h1>
        <p className="mt-5 max-w-xl text-lg leading-relaxed text-[#4A453C]">
          Replay coming soon. Registrants get it by email.
        </p>
        <p className="mt-3 max-w-[52ch] text-[15px] leading-relaxed text-[#4A453C]">
          The edited public replay will embed on this page. Until then, start
          from the idea page and the free Starter Kit.
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-4">
          <LiveButton href={ideaHref} variant="primary">
            {session.ideaName} idea page
          </LiveButton>
          <Link
            href="/starter-kit"
            className={cn(
              "text-sm font-medium text-home-ink underline decoration-home-rule underline-offset-4",
              FOCUS,
            )}
          >
            Get the free Starter Kit
          </Link>
        </div>
      </section>
    );
  }

  if (phase === "past" && session.youtubeId) {
    return (
      <section className="mx-auto max-w-[1120px] px-5 pt-28 pb-10 sm:px-10 sm:pt-36">
        <p className="font-mono text-[11px] tracking-[0.08em] text-home-orange uppercase">
          Replay
        </p>
        <h1 className="font-editorial mt-3 text-[38px] leading-[1.04] font-medium tracking-[-0.022em] text-balance sm:text-[58px]">
          {heading}
        </h1>
        <p className="mt-5 max-w-[52ch] text-lg leading-relaxed text-[#4A453C]">
          Full replay: {session.ideaName}, {session.oneLiner}, built live
          {session.tool ? ` with ${session.tool}` : " with AI"}.
        </p>
        <div className="mt-8 aspect-video overflow-hidden rounded-2xl border border-home-rule bg-home-sunk">
          <iframe
            src={sessionEmbedUrl(session.youtubeId)}
            title={`${session.ideaName} live build replay`}
            className="h-full w-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
        <p className="mt-6 text-[15px]">
          <Link
            href={ideaHref}
            className={cn(
              "font-semibold text-[#A84A00] underline-offset-2 hover:underline",
              FOCUS,
            )}
          >
            {session.ideaName}: full research, market and prompts
          </Link>
        </p>
      </section>
    );
  }

  // cancelled / postponed / draft fallback
  return (
    <section className="mx-auto max-w-[1120px] px-5 pt-28 pb-14 sm:px-10 sm:pt-36 sm:pb-20">
      <h1 className="font-editorial text-[46px] leading-[1.02] font-medium tracking-[-0.02em] sm:text-[64px]">
        This session is <Em>{phase}</Em>.
      </h1>
      <p className="mt-5 max-w-xl text-lg leading-relaxed text-[#4A453C]">
        Check the{" "}
        <Link href="/live" className="underline underline-offset-2">
          Live hub
        </Link>{" "}
        for the next free build.
      </p>
      <div className="mt-8">
        <LiveButton href={STARTUP_IDEAS_HREF} variant="primary">
          Browse free ideas
        </LiveButton>
      </div>
    </section>
  );
}

export default async function LiveSessionPage({ params }: PageProps) {
  await connection();
  const { session: slug } = await params;
  const session = getSessionBySlug(slug);
  if (!session || session.status === "draft") notFound();

  const now = readLiveClockMs();
  const phase = sessionPhase(session, now);
  const schema = sessionJsonLd(session, phase);
  const refreshAt = nextPhaseBoundaryMs(session, now);
  const showNext =
    phase === "past" ||
    phase === "replay-pending" ||
    phase === "cancelled" ||
    phase === "postponed";

  return (
    <div
      className={`${newsreaderEditorial.variable} theme-desk overflow-x-clip bg-home-paper font-sans text-home-ink selection:bg-home-orange/20`}
    >
      <PersistLiveAttrib />
      <PhaseRefresh atMs={refreshAt} />
      <JsonLd schema={schema} />

      <main>
        <SessionHero session={session} phase={phase} />

        {session.recap ? (
          <section aria-labelledby="recap-heading" className={SECTION}>
            <h2 id="recap-heading" className={H2}>
              What got built
            </h2>
            <p className={LEAD}>{session.recap}</p>
          </section>
        ) : null}

        {session.agenda && session.agenda.length > 0 ? (
          <section aria-labelledby="agenda-heading" className={SECTION}>
            <h2 id="agenda-heading" className={H2}>
              How the hour runs
            </h2>
            <p className={LEAD}>
              All times GMT
              {session.slug === "hydration-app-for-hikers"
                ? " on Saturday 31 October."
                : "."}
            </p>
            <ol className="mt-10 divide-y divide-home-rule border-y border-home-rule">
              {session.agenda.map((item) => (
                <li
                  key={`${item.clock}-${item.title}`}
                  className="grid gap-2 py-5 sm:grid-cols-[7rem_1fr] sm:gap-8"
                >
                  <span className="font-mono text-sm text-[#6B6457]">
                    {item.approx ? (
                      <>
                        <span className="sr-only">About </span>~{item.clock}
                      </>
                    ) : (
                      item.clock
                    )}
                  </span>
                  <div>
                    <p className="font-editorial text-[21px] leading-tight">
                      {item.title}
                    </p>
                    {item.body ? (
                      <p className="mt-1 text-[15px] leading-relaxed text-[#4A453C]">
                        {item.body}
                      </p>
                    ) : null}
                    {item.mark ? (
                      <p className="mt-2 text-sm font-medium text-home-orange-ink">
                        {item.mark}
                      </p>
                    ) : null}
                  </div>
                </li>
              ))}
            </ol>
          </section>
        ) : null}

        {showNext ? (
          <section className={SECTION}>
            <NextSessionModule nowMs={now} excludeId={session.id} />
          </section>
        ) : null}

        <section className={SECTION}>
          <p className="text-sm text-[#6B6457]">
            Part of{" "}
            <Link
              href="/live"
              className={cn(
                "font-medium text-home-ink underline decoration-home-rule underline-offset-4",
                FOCUS,
              )}
            >
              Weekend MVP Live
            </Link>
            .
          </p>
        </section>
      </main>
    </div>
  );
}
