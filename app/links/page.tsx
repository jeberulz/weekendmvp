import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { connection } from "next/server";
import { ArrowUpRight } from "lucide-react";

import { Logo } from "@/components/primitives/Logo";
import { getVideoLinkForDate, type VideoLink } from "./_data";

const SITE = "https://www.weekendmvp.app";
const CAMPAIGN_TIME_ZONE = "Europe/London";

export const metadata: Metadata = {
  title: "Today's Startup Idea",
  description:
    "Today's Weekend MVP video and the complete startup idea behind it.",
  alternates: { canonical: "/links" },
  openGraph: {
    type: "website",
    url: `${SITE}/links`,
    title: "Today's Startup Idea | Weekend MVP",
    description:
      "Watch today's short idea, then open the full research, business model, and build plan.",
    images: [`${SITE}/image/og-image.png`],
  },
  twitter: {
    card: "summary_large_image",
    title: "Today's Startup Idea | Weekend MVP",
    description:
      "Watch today's short idea, then open the full research, business model, and build plan.",
    images: [`${SITE}/image/og-image.png`],
  },
};

function formatLabel(value: string): string {
  const acronyms: Record<string, string> = {
    ai: "AI",
    mvp: "MVP",
    pov: "POV",
  };
  const lowercase = new Set(["and", "for", "of", "the"]);

  return value
    .split("-")
    .map((word, index) => {
      if (acronyms[word]) return acronyms[word];
      if (index > 0 && lowercase.has(word)) return word;
      return `${word.charAt(0).toUpperCase()}${word.slice(1)}`;
    })
    .join(" ");
}

function dateInTimeZone(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";

  return `${value("year")}-${value("month")}-${value("day")}`;
}

function VideoCard({ link }: { link: VideoLink }) {
  const destination = link.kind === "idea" ? "Read full idea" : "Read article";

  return (
    <Link
      href={link.href}
      className="group grid min-h-32 grid-cols-[7.5rem_1fr] overflow-hidden rounded-2xl border border-white/10 bg-white/[0.035] transition-[border-color,background-color,transform] duration-200 hover:-translate-y-0.5 hover:border-[#cc5500]/70 hover:bg-white/[0.055] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#cc5500] focus-visible:ring-offset-2 focus-visible:ring-offset-[#050505] active:translate-y-0 motion-reduce:transform-none motion-reduce:transition-none sm:grid-cols-[9rem_1fr]"
      aria-label={`${destination}: ${link.title}`}
    >
      <div className="relative m-2 mr-0 min-h-28 overflow-hidden rounded-2xl bg-neutral-900">
        <Image
          src={link.image}
          alt=""
          fill
          sizes="(max-width: 640px) 120px, 144px"
          className="object-cover transition-transform duration-300 group-hover:scale-[1.025] motion-reduce:transform-none motion-reduce:transition-none"
        />
      </div>

      <div className="flex min-w-0 flex-col justify-between gap-3 p-4 sm:p-5">
        <div>
          <p className="mb-2 text-xs font-medium text-neutral-500">
            {link.day}, {link.date}
          </p>
          <h3 className="text-base font-medium leading-snug tracking-tight text-neutral-100 sm:text-lg">
            {link.title}
          </h3>
        </div>

        <div className="flex items-center justify-between gap-3 text-xs">
          <span className="truncate text-neutral-500">
            {formatLabel(link.format)}
          </span>
          <span className="flex shrink-0 items-center gap-1.5 font-medium text-[#e2782f]">
            {destination}
            <ArrowUpRight
              size={14}
              strokeWidth={1.75}
              aria-hidden="true"
              className="transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 motion-reduce:transform-none motion-reduce:transition-none"
            />
          </span>
        </div>
      </div>
    </Link>
  );
}

export default async function LinksPage() {
  await connection();
  const scheduledDate = dateInTimeZone(new Date(), CAMPAIGN_TIME_ZONE);
  const link = await getVideoLinkForDate(scheduledDate);

  return (
    <main className="min-h-[100dvh] bg-[#050505] text-neutral-100 selection:bg-[#cc5500]/40 selection:text-white">
      <div className="mx-auto w-full max-w-5xl px-4 pb-20 pt-6 sm:px-6 sm:pt-8 lg:px-8">
        <header className="mb-14 sm:mb-20">
          <Link
            href="/"
            className="inline-flex rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#cc5500] focus-visible:ring-offset-4 focus-visible:ring-offset-[#050505]"
            aria-label="Weekend MVP home"
          >
            <Logo className="h-6 w-40 text-white" />
          </Link>

          <div className="mt-12 grid items-end gap-8 border-b border-white/10 pb-12 md:grid-cols-[minmax(0,1fr)_14rem] md:gap-14">
            <div className="max-w-2xl">
              <p className="mb-5 font-mono text-xs font-medium uppercase tracking-[0.18em] text-[#e2782f]">
                I&apos;d Build This Weekend
              </p>
              <h1 className="max-w-xl text-4xl font-semibold leading-[1.02] tracking-[-0.045em] text-white sm:text-5xl md:text-6xl">
                Today&apos;s idea, ready to explore.
              </h1>
              <p className="mt-6 max-w-lg text-base leading-relaxed text-neutral-400 sm:text-lg">
                Watch the short version, then open the research, business model,
                and build plan behind today&apos;s idea.
              </p>
            </div>

            <div className="flex items-center gap-4 md:block">
              <div className="relative size-20 shrink-0 overflow-hidden rounded-2xl bg-neutral-900 md:size-56">
                <Image
                  src="/image/john-portrait.webp"
                  alt="John Iseghohi, creator of Weekend MVP"
                  fill
                  priority
                  sizes="(max-width: 767px) 80px, 224px"
                  className="object-cover grayscale"
                />
              </div>
              <p className="max-w-52 text-sm leading-relaxed text-neutral-500 md:mt-4">
                Daily buildable startup ideas from John at Weekend MVP.
              </p>
            </div>
          </div>
        </header>

        {link ? (
          <section aria-labelledby="today-heading">
            <div className="mb-10 max-w-xl">
              <h2
                id="today-heading"
                className="text-2xl font-semibold tracking-tight text-white sm:text-3xl"
              >
                Today&apos;s startup idea
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-neutral-500 sm:text-base">
                A fresh, buildable concept every day. Open today&apos;s idea to read
                the complete breakdown after the email gate.
              </p>
            </div>

            <div className="max-w-2xl">
              <VideoCard link={link} />
            </div>
          </section>
        ) : (
          <section
            className="rounded-2xl border border-white/10 bg-white/[0.035] px-6 py-12 text-center"
            aria-labelledby="empty-heading"
          >
            <h2 id="empty-heading" className="text-xl font-semibold text-white">
              Today&apos;s idea is not live yet
            </h2>
            <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-neutral-500">
              There is no campaign idea scheduled for today. Check back tomorrow,
              or browse every published idea in the meantime.
            </p>
            <Link
              href="/startup-ideas"
              className="mt-6 inline-flex rounded-xl bg-white px-5 py-3 text-sm font-semibold text-neutral-950 transition-colors hover:bg-neutral-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#050505] active:translate-y-px motion-reduce:transition-none"
            >
              Browse ideas
            </Link>
          </section>
        )}

        <footer className="mt-20 border-t border-white/10 pt-8 sm:mt-28">
          <div className="flex flex-col gap-2 text-sm text-neutral-600 sm:flex-row sm:items-center sm:justify-between">
            <p>A new idea appears here each day.</p>
            <Link
              href="/"
              className="w-fit text-neutral-400 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#cc5500] motion-reduce:transition-none"
            >
              Weekend MVP
            </Link>
          </div>
        </footer>
      </div>
    </main>
  );
}
