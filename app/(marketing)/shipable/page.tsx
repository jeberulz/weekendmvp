import type { Metadata } from "next";
import { ArrowRight, Check } from "lucide-react";
import { JsonLd } from "@/components/primitives/JsonLd";
import {
  CountdownGrid,
  StickyCountdownLabel,
} from "@/components/marketing/Countdown";
import { ScrollRevealInit } from "@/components/marketing/ScrollReveal";
import { newsreader } from "@/lib/fonts";
import { ShipableSeat } from "./ShipableSeat";

/* Checkout: live Stripe Payment Link wired in ShipableCheckoutForm.tsx.
   The form does a fire-and-forget Beehiiv subscribe, then redirects to
   Stripe with prefilled_email. Stripe redirects back to /shipable?paid=1
   on success which swaps the form for a confirmation block (ShipableSeat). */

// Countdown: edit the deadline (ISO 8601 with timezone offset)
const WORKSHOP_DEADLINE = "2026-06-27T12:00:00+01:00";

export const metadata: Metadata = {
  title: {
    absolute:
      "ship·able | Build & Ship Your MVP Live in 90 Minutes ($9 Workshop)",
  },
  description:
    "Build and ship a real MVP in 90 minutes. Live $9 workshop with John Iseghohi for non-technical founders using AI tools. Walk out with a deployed URL, a 48-hour build plan, and your first users. Sat Jun 27, 2026 · Live on Zoom · Lifetime replay.",
  keywords:
    "MVP workshop, build MVP in a weekend, non-technical founder MVP, ship MVP live, AI MVP builder, 90 minute MVP, weekend MVP workshop",
  authors: [{ name: "John Iseghohi" }],
  alternates: { canonical: "/shipable" },
  openGraph: {
    type: "website",
    siteName: "Weekend MVP",
    locale: "en_GB",
    url: "/shipable",
    title: "ship·able · Build your MVP live in 90 minutes for $9",
    description:
      "Turn the idea you've been sitting on into a real, live MVP. 90 minutes, live on Zoom. Sat Jun 27, 2026 at 12 PM BST. Replay included.",
    images: [
      {
        url: "https://weekendmvp.app/image/og-image.png",
        alt: "ship·able, a Weekend MVP workshop",
        type: "image/png",
        width: 1200,
        height: 630,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    site: "@weekendmvp",
    title: "ship·able · Build your MVP live in 90 minutes for $9",
    description:
      "Live $9 workshop. Turn an idea you've been sitting on into a deployed MVP in 90 minutes. Sat Jun 27, 2026 · 12 PM BST.",
    images: [
      {
        url: "https://weekendmvp.app/image/og-image.png",
        alt: "ship·able, a Weekend MVP workshop",
      },
    ],
  },
};

/* JSON-LD: Person + Organization + Event + FAQPage + Breadcrumb (SEO + AEO) */
const SCHEMA = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Person",
      "@id": "https://weekendmvp.app/#person",
      name: "John Iseghohi",
      jobTitle: "Founder, Weekend MVP",
      url: "https://cal.com/switchtoux",
      image: "https://weekendmvp.app/image/john-portrait.jpg",
      sameAs: ["https://twitter.com/weekendmvp", "https://cal.com/switchtoux"],
    },
    {
      "@type": "Organization",
      "@id": "https://weekendmvp.app/#org",
      name: "Weekend MVP",
      url: "https://weekendmvp.app/",
      logo: "https://weekendmvp.app/image/weekendmvp-logo.svg",
      founder: { "@id": "https://weekendmvp.app/#person" },
      sameAs: ["https://twitter.com/weekendmvp"],
    },
    {
      "@type": "Event",
      "@id": "https://weekendmvp.app/shipable#event",
      name: "ship·able · Build your MVP live in 90 minutes",
      description:
        "A 90-minute live workshop where you turn the idea you've been sitting on into a real, deployed MVP with a live URL. Non-technical welcome, built with AI tools. Includes the Ship Sheet, 48-hour build plan, AI MVP Builder, and the Weekend MVP Starter Kit.",
      image: [
        "https://weekendmvp.app/image/hero-cover-desktop.jpg",
        "https://weekendmvp.app/image/og-image.png",
      ],
      eventAttendanceMode: "https://schema.org/OnlineEventAttendanceMode",
      eventStatus: "https://schema.org/EventScheduled",
      startDate: "2026-06-27T12:00:00+01:00",
      endDate: "2026-06-27T14:00:00+01:00",
      inLanguage: "en",
      isAccessibleForFree: false,
      maximumAttendeeCapacity: 100,
      organizer: { "@id": "https://weekendmvp.app/#org" },
      performer: { "@id": "https://weekendmvp.app/#person" },
      location: {
        "@type": "VirtualLocation",
        url: "https://weekendmvp.app/shipable",
      },
      offers: {
        "@type": "Offer",
        name: "ship·able seat",
        price: "9",
        priceCurrency: "USD",
        availability: "https://schema.org/InStock",
        validFrom: "2026-06-12T00:00:00+01:00",
        url: "https://weekendmvp.app/shipable#seat",
        category: "Workshop",
      },
    },
    {
      "@type": "FAQPage",
      mainEntity: [
        {
          "@type": "Question",
          name: "What is the ship·able workshop?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "ship·able is a 90-minute live workshop where you turn the idea you've been sitting on into a real, deployed MVP with a live URL by the end of the call. $9, live on Zoom, full replay included.",
          },
        },
        {
          "@type": "Question",
          name: "When is the ship·able workshop?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Saturday June 27, 2026 at 12:00 PM BST (7:00 AM EDT, 4:00 AM PDT, 12:00 PM WAT). Live on Zoom. If you can't make it live, you get the full lifetime replay.",
          },
        },
        {
          "@type": "Question",
          name: "How much does the workshop cost?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "$9 one-time. Includes the 90-minute live build, lifetime replay, the Ship Sheet worksheet, the 48-Hour Build Plan, and (live-only) the AI MVP Builder plus the Weekend MVP Starter Kit. Total stack value: $738.",
          },
        },
        {
          "@type": "Question",
          name: "Do I need to know how to code to attend?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "No. The workshop is built for non-technical founders. We use AI tools to build and deploy the MVP live on the call, so you walk out with a real shareable URL even if you've never written code.",
          },
        },
        {
          "@type": "Question",
          name: "What do I walk away with at the end?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "A live, shareable URL for your MVP, a finished 48-hour build plan you can complete that weekend, and a way to capture your first users. Past attendees have shipped MVPs in 90 minutes and gotten paying users within days.",
          },
        },
        {
          "@type": "Question",
          name: "What if I can't attend live on Zoom?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "You get the full lifetime replay. Note: the two bonuses (AI MVP Builder and Weekend MVP Starter Kit) are live-only, so attending live is recommended.",
          },
        },
        {
          "@type": "Question",
          name: "Who is hosting the workshop?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "John Iseghohi, founder of Weekend MVP. He runs a community of 400+ weekend builders and has broken down 78 startup ideas on weekendmvp.app.",
          },
        },
      ],
    },
    {
      "@type": "BreadcrumbList",
      itemListElement: [
        {
          "@type": "ListItem",
          position: 1,
          name: "Home",
          item: "https://weekendmvp.app/",
        },
        {
          "@type": "ListItem",
          position: 2,
          name: "ship·able Workshop",
          item: "https://weekendmvp.app/shipable",
        },
      ],
    },
  ],
};

const VALUE_STACK = [
  {
    number: "01",
    title: (
      <h3 className="text-lg font-semibold text-[#0a0a0a]">
        90-minute live build workshop
      </h3>
    ),
    body: "Working session with John on Zoom. Bring your laptop and the Ship Sheet.",
    value: "$97 value",
    bonus: false,
    creamRow: false,
    border: true,
  },
  {
    number: "02",
    title: (
      <h3 className="text-lg font-semibold text-[#0a0a0a]">
        Ship Sheet{" "}
        <span className="accent-italic text-neutral-700 font-normal">
          worksheet
        </span>
      </h3>
    ),
    body: "Fill it in live. By the end of the 90 minutes you walk out with a finished build plan.",
    value: "$47 value",
    bonus: false,
    creamRow: false,
    border: true,
  },
  {
    number: "03",
    title: (
      <h3 className="text-lg font-semibold text-[#0a0a0a]">Lifetime replay</h3>
    ),
    body: "Can't make it live? Full recording, yours forever. Rewatch the parts you need.",
    value: "$47 value",
    bonus: false,
    creamRow: false,
    border: true,
  },
  {
    number: "04",
    title: (
      <h3 className="text-lg font-semibold text-[#0a0a0a]">
        48-Hour Build Plan
      </h3>
    ),
    body: "Your exact idea, scoped and sequenced to ship by Sunday night.",
    value: "$199 value",
    bonus: false,
    creamRow: false,
    border: true,
  },
  {
    number: "05",
    title: (
      <h3 className="text-lg font-semibold text-[#0a0a0a]">
        AI{" "}
        <span className="accent-italic text-neutral-700 font-normal">
          MVP Builder
        </span>
      </h3>
    ),
    body: "Drop in your idea. The prompt pack scaffolds your build instantly, so you've got a v1 to refine.",
    value: "$199 value",
    bonus: true,
    creamRow: true,
    border: true,
  },
  {
    number: "06",
    title: (
      <h3 className="text-lg font-semibold text-[#0a0a0a]">
        Weekend MVP{" "}
        <span className="accent-italic text-neutral-700 font-normal">
          Starter Kit
        </span>
      </h3>
    ),
    body: "The full 48-hour plan, templates & AI prompts. A worked playbook, not a blank page.",
    value: "$149 value",
    bonus: true,
    creamRow: true,
    border: false,
  },
];

export default function ShipablePage() {
  return (
    <div
      className={`${newsreader.variable} theme-cream overflow-x-hidden bg-[#fcfaf7] text-[#1a1a1a]`}
      style={{ colorScheme: "light" }}
    >
      <JsonLd schema={SCHEMA} />
      <ScrollRevealInit />

      <main>
        {/* ===================== HERO ===================== */}
        <section className="relative overflow-hidden isolate bg-[#0a0a0a]">
          <picture>
            {/* Mobile portrait crop (1200×1600), WebP preferred */}
            <source
              media="(max-width: 767px)"
              type="image/webp"
              srcSet="/image/hero-cover-mobile.webp"
            />
            <source
              media="(max-width: 767px)"
              type="image/jpeg"
              srcSet="/image/hero-cover-mobile.jpg"
            />
            {/* Desktop 16:9 crop (2400×1350), WebP preferred */}
            <source
              media="(min-width: 768px)"
              type="image/webp"
              srcSet="/image/hero-cover-desktop.webp"
            />
            <source
              media="(min-width: 768px)"
              type="image/jpeg"
              srcSet="/image/hero-cover-desktop.jpg"
            />
            <img
              id="hero-cover"
              src="/image/hero-cover-desktop.jpg"
              alt=""
              aria-hidden="true"
              fetchPriority="high"
              decoding="async"
              className="absolute inset-0 -z-20 w-full h-full object-cover object-center"
            />
          </picture>
          {/* Scrim: bottom-up on mobile (text at bottom), right-to-left on desktop (text on right, subject visible on left) */}
          <div
            className="absolute inset-0 -z-10 bg-gradient-to-t from-[#0a0a0a] via-[#0a0a0a]/75 to-[#0a0a0a]/35 md:bg-gradient-to-l md:from-[#0a0a0a] md:via-[#0a0a0a]/80 md:to-[#0a0a0a]/15"
            aria-hidden="true"
          ></div>

          <div className="relative max-w-6xl mx-auto px-5 pt-32 pb-16 md:pt-40 md:pb-28 min-h-[640px] md:min-h-[760px] flex flex-col justify-end md:justify-center">
            <div className="md:ml-auto md:max-w-xl">
              <div className="inline-flex items-center gap-2 mb-8">
                <span
                  className="w-1.5 h-1.5 rounded-full bg-[#e9a06a] animate-pulse"
                  aria-hidden="true"
                ></span>
                <span className="sr-only">Live:</span>
                <span className="font-mono-eyebrow text-[11px] uppercase text-white/80">
                  Live Workshop
                </span>
              </div>

              <h1 className="text-[15vw] leading-[0.9] md:text-[7rem] font-semibold tracking-tight text-white drop-shadow-[0_2px_24px_rgba(0,0,0,0.45)]">
                ship<span className="text-[#e9a06a]">·</span>able
                <span className="text-[#e9a06a]">.</span>
              </h1>

              <p className="mt-8 max-w-xl text-xl md:text-2xl leading-snug text-white/85">
                In this 90-minute live workshop you&apos;ll turn the idea
                you&apos;ve been sitting on into{" "}
                <span className="accent-italic text-[#e9a06a]">
                  a real MVP people can actually use,
                </span>{" "}
                before the weekend&apos;s over.
              </p>

              <div className="mt-10 flex flex-col sm:flex-row items-start sm:items-center gap-5">
                <a
                  href="#seat"
                  className="group inline-flex items-center gap-3 rounded-2xl bg-white pl-7 pr-5 py-4 text-base font-semibold text-[#1a1a1a] hover:bg-neutral-100 transition-all focus:outline-none focus:ring-2 focus:ring-white/60 focus:ring-offset-2 focus:ring-offset-[#0a0a0a] active:scale-[0.98] shadow-2xl"
                >
                  <span>Save my seat</span>
                  <span
                    className="h-5 w-px bg-[#1a1a1a]/20"
                    aria-hidden="true"
                  ></span>
                  <span className="text-[#A03D00]">$9</span>
                  <ArrowRight
                    size={18}
                    className="transition-transform group-hover:translate-x-0.5"
                    aria-hidden="true"
                  />
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* ===================== DATE / COUNTDOWN ===================== */}
        <section className="px-5 pt-12 pb-16 md:pt-16 md:pb-20 max-w-5xl mx-auto">
          <div className="rounded-3xl bg-[#1a1a1a] text-white p-8 md:p-10 max-w-2xl">
            <div className="flex items-center justify-between mb-6">
              <span className="font-mono-eyebrow text-[10px] uppercase text-neutral-300">
                Workshop starts in
              </span>
              <span className="font-mono-eyebrow text-[10px] uppercase text-neutral-300">
                BST
              </span>
            </div>
            <p className="text-3xl md:text-4xl font-semibold tracking-tight">
              Sat, Jun 27{" "}
              <span className="accent-italic text-[#e9a06a]">12:00 PM</span>
            </p>
            <p className="mt-2 text-sm text-neutral-300">
              90 minutes live · Q&amp;A after
            </p>
            <CountdownGrid deadline={WORKSHOP_DEADLINE} />
          </div>
        </section>

        {/* ===================== DELIVERABLE TEASER ===================== */}
        <section className="px-5 py-12 max-w-5xl mx-auto reveal">
          <div className="rounded-3xl border border-black/10 bg-white p-8 md:p-10 flex flex-col md:flex-row items-start gap-8">
            <div
              className="shrink-0 w-28 h-36 rounded-xl bg-[#f5f2ed] border border-black/10 p-3 flex flex-col gap-2"
              aria-hidden="true"
            >
              <div className="h-2 w-10 rounded-full bg-[#CC5500]/70"></div>
              <div className="h-1.5 w-full rounded-full bg-neutral-200"></div>
              <div className="h-1.5 w-full rounded-full bg-neutral-200"></div>
              <div className="h-1.5 w-3/4 rounded-full bg-neutral-200"></div>
              <div className="h-1.5 w-full rounded-full bg-neutral-200"></div>
              <div className="h-1.5 w-2/3 rounded-full bg-neutral-200"></div>
            </div>
            <div>
              <span className="font-mono-eyebrow text-[11px] uppercase text-[#A03D00]">
                The Ship Sheet
              </span>
              <h2 className="mt-3 text-3xl md:text-4xl font-bold tracking-tight text-[#0a0a0a]">
                You fill it in live.
              </h2>
              <p className="mt-3 text-lg text-neutral-700 max-w-xl">
                It becomes your finished 48-hour build plan, plus a live URL,
                by the end of the call.
              </p>
            </div>
          </div>
        </section>

        {/* ===================== WHY LISTEN (stats) ===================== */}
        <section className="px-5 py-16 md:py-24 bg-[#1a1a1a] text-white">
          <div className="max-w-5xl mx-auto">
            <div className="inline-flex items-center rounded-full border border-white/15 px-4 py-1.5 mb-12">
              <span className="font-mono-eyebrow text-[11px] uppercase text-neutral-300">
                Why listen to me
              </span>
            </div>
            <dl className="divide-y divide-white/10">
              <div className="flex items-baseline justify-between py-6 reveal">
                <dt className="text-4xl md:text-5xl font-semibold tracking-tight">
                  10
                  <span className="accent-italic text-[#e9a06a] text-3xl">
                    {" "}
                    shipped
                  </span>
                </dt>
                <dd className="font-mono-eyebrow text-[10px] md:text-xs uppercase text-neutral-300 text-right">
                  MVPs launched by builders
                </dd>
              </div>
              <div className="flex items-baseline justify-between py-6 reveal">
                <dt className="text-4xl md:text-5xl font-semibold tracking-tight">
                  400
                  <span className="accent-italic text-[#e9a06a] text-3xl">
                    +
                  </span>
                </dt>
                <dd className="font-mono-eyebrow text-[10px] md:text-xs uppercase text-neutral-300 text-right">
                  Weekend builders
                </dd>
              </div>
              <div className="flex items-baseline justify-between py-6 reveal">
                <dt className="text-4xl md:text-5xl font-semibold tracking-tight">
                  8
                  <span className="accent-italic text-[#e9a06a] text-3xl">
                    {" "}
                    hrs
                  </span>
                </dt>
                <dd className="font-mono-eyebrow text-[10px] md:text-xs uppercase text-neutral-300 text-right">
                  Average idea → live
                </dd>
              </div>
              <div className="flex items-baseline justify-between py-6 reveal">
                <dt className="text-4xl md:text-5xl font-semibold tracking-tight">
                  78
                  <span className="accent-italic text-[#e9a06a] text-3xl">
                    {" "}
                    ideas
                  </span>
                </dt>
                <dd className="font-mono-eyebrow text-[10px] md:text-xs uppercase text-neutral-300 text-right">
                  Broken down on the site
                </dd>
              </div>
            </dl>
          </div>
        </section>

        {/* ===================== THE REAL PROBLEM ===================== */}
        <section className="px-5 py-20 md:py-28 max-w-3xl mx-auto reveal">
          <h2 className="text-4xl md:text-6xl font-bold tracking-tight leading-[1.02] text-[#0a0a0a]">
            Your idea&apos;s still in your head…{" "}
            <span className="accent-italic text-[#CC5500] font-normal">
              and that&apos;s exactly why it&apos;s worth nothing.
            </span>
          </h2>
          <div className="mt-10 space-y-6 text-lg text-neutral-800">
            <p>
              I&apos;ve watched thousands of would-be builders, and the #1
              thing keeping them stuck isn&apos;t talent or time. It&apos;s
              that they never ship.
            </p>
            <p>They usually fall into one of two camps:</p>
            <ul className="space-y-4">
              <li className="flex gap-4">
                <span
                  className="mt-3 h-px w-6 bg-[#CC5500] shrink-0"
                  aria-hidden="true"
                ></span>
                <span>
                  <strong className="font-semibold">
                    They&apos;ve got a &quot;someday&quot; idea
                  </strong>{" "}
                  they keep researching, tweaking, and talking about, but
                  never build.
                </span>
              </li>
              <li className="flex gap-4">
                <span
                  className="mt-3 h-px w-6 bg-[#CC5500] shrink-0"
                  aria-hidden="true"
                ></span>
                <span>
                  <strong className="font-semibold">
                    They&apos;ve got a half-built project
                  </strong>{" "}
                  rotting in a folder because they scoped it way too big to
                  ever finish.
                </span>
              </li>
            </ul>
            <p className="text-neutral-700">
              Either way, real people have never touched it.
            </p>
            <p>
              All you need to change that is{" "}
              <span className="accent-italic text-[#1a1a1a]">
                one small thing, live, that someone can actually use this
                weekend.
              </span>{" "}
              That&apos;s what we build in ship·able.
            </p>
          </div>
        </section>

        {/* ===================== TL;DR ===================== */}
        <section className="px-5 py-16 bg-[#f5f2ed]">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-10 text-[#0a0a0a]">
              Everything you need to know,{" "}
              <span className="accent-italic text-[#CC5500] font-normal">
                in ten seconds.
              </span>
            </h2>
            <ul className="space-y-6">
              <li className="flex gap-4">
                <Check
                  size={22}
                  className="text-[#CC5500] mt-0.5 shrink-0"
                  aria-hidden="true"
                />
                <p className="text-lg text-neutral-800">
                  <strong className="font-semibold text-[#1a1a1a]">
                    It&apos;s $9.
                  </strong>{" "}
                  One-time. Less than your weekend coffee run, and you walk
                  out with a live MVP.
                </p>
              </li>
              <li className="flex gap-4">
                <Check
                  size={22}
                  className="text-[#CC5500] mt-0.5 shrink-0"
                  aria-hidden="true"
                />
                <p className="text-lg text-neutral-800">
                  <strong className="font-semibold text-[#1a1a1a]">
                    It&apos;s a 90-minute live workshop
                  </strong>{" "}
                  on Sat, Jun 27, 12:00 PM BST, on Zoom. Can&apos;t make it
                  live? You get the full replay.
                </p>
              </li>
              <li className="flex gap-4">
                <Check
                  size={22}
                  className="text-[#CC5500] mt-0.5 shrink-0"
                  aria-hidden="true"
                />
                <p className="text-lg text-neutral-800">
                  <strong className="font-semibold text-[#1a1a1a]">
                    It&apos;s for anyone with an idea they haven&apos;t
                    shipped.
                  </strong>{" "}
                  Non-technical totally welcome. We build with AI tools, no
                  code required.
                </p>
              </li>
              <li className="flex gap-4">
                <Check
                  size={22}
                  className="text-[#CC5500] mt-0.5 shrink-0"
                  aria-hidden="true"
                />
                <p className="text-lg text-neutral-800">
                  <strong className="font-semibold text-[#1a1a1a]">
                    You walk out with a live, shareable URL
                  </strong>{" "}
                  plus a locked 48-hour build plan you can finish this
                  weekend.
                </p>
              </li>
              <li className="flex gap-4">
                <Check
                  size={22}
                  className="text-[#CC5500] mt-0.5 shrink-0"
                  aria-hidden="true"
                />
                <p className="text-lg text-neutral-800">
                  <strong className="font-semibold text-[#1a1a1a]">
                    It works for any idea:
                  </strong>{" "}
                  SaaS, a tool, a marketplace, a side project. We&apos;ve
                  broken down 78 of them.
                </p>
              </li>
              <li className="flex gap-4">
                <Check
                  size={22}
                  className="text-[#CC5500] mt-0.5 shrink-0"
                  aria-hidden="true"
                />
                <p className="text-lg text-neutral-800">
                  <strong className="font-semibold text-[#1a1a1a]">
                    Live attendees get 2 bonuses:
                  </strong>{" "}
                  the AI MVP Builder + the Weekend MVP Starter Kit. Combined
                  value{" "}
                  <strong className="font-semibold text-[#1a1a1a]">
                    $348
                  </strong>
                  .
                </p>
              </li>
            </ul>
          </div>
        </section>

        {/* ===================== WHAT WE'LL DO ===================== */}
        <section className="px-5 py-20 md:py-28 max-w-4xl mx-auto">
          <h2 className="text-4xl md:text-6xl font-bold tracking-tight leading-[1.02] mb-14 text-[#0a0a0a]">
            Three moves.{" "}
            <span className="accent-italic text-[#CC5500] font-normal">
              Shipped on the call.
            </span>
          </h2>

          <div className="border-t border-black/10">
            <article className="grid md:grid-cols-[auto_1fr] gap-x-8 gap-y-3 py-10 border-b border-black/10 reveal">
              <span className="text-6xl md:text-7xl font-semibold text-neutral-200 leading-none">
                01
              </span>
              <div>
                <h3 className="text-2xl md:text-3xl font-semibold tracking-tight text-[#0a0a0a]">
                  Your{" "}
                  <span className="accent-italic text-[#CC5500] font-normal">
                    sharpest
                  </span>{" "}
                  idea
                </h3>
                <p className="mt-3 text-lg text-neutral-700">
                  One buyer, one painful problem. We cut your idea down from
                  &quot;cool concept&quot; to the one specific thing one
                  specific person will use on day one.
                </p>
                <span className="mt-4 inline-block rounded-full bg-[#f5f2ed] px-3 py-1 font-mono-eyebrow text-[10px] uppercase text-neutral-700">
                  ~25 min
                </span>
              </div>
            </article>
            <article className="grid md:grid-cols-[auto_1fr] gap-x-8 gap-y-3 py-10 border-b border-black/10 reveal">
              <span className="text-6xl md:text-7xl font-semibold text-neutral-200 leading-none">
                02
              </span>
              <div>
                <h3 className="text-2xl md:text-3xl font-semibold tracking-tight text-[#0a0a0a]">
                  Your{" "}
                  <span className="accent-italic text-[#CC5500] font-normal">
                    weekend
                  </span>{" "}
                  cut
                </h3>
                <p className="mt-3 text-lg text-neutral-700">
                  The smallest version you can actually ship by Sunday. Not
                  the dream app. The one screen that proves it. We scope it so
                  it fits in a weekend, not a quarter.
                </p>
                <span className="mt-4 inline-block rounded-full bg-[#f5f2ed] px-3 py-1 font-mono-eyebrow text-[10px] uppercase text-neutral-700">
                  ~30 min
                </span>
              </div>
            </article>
            <article className="grid md:grid-cols-[auto_1fr] gap-x-8 gap-y-3 py-10 border-b border-black/10 reveal">
              <span className="text-6xl md:text-7xl font-semibold text-neutral-200 leading-none">
                03
              </span>
              <div>
                <h3 className="text-2xl md:text-3xl font-semibold tracking-tight text-[#0a0a0a]">
                  Your{" "}
                  <span className="accent-italic text-[#CC5500] font-normal">
                    live
                  </span>{" "}
                  launch page
                </h3>
                <p className="mt-3 text-lg text-neutral-700">
                  Built live with AI: a deployed page with a real URL and a
                  way to capture your first users, so you&apos;re validating
                  demand before you sink a weekend into building.
                </p>
                <span className="mt-4 inline-block rounded-full bg-[#f5f2ed] px-3 py-1 font-mono-eyebrow text-[10px] uppercase text-neutral-700">
                  ~35 min
                </span>
              </div>
            </article>
          </div>
        </section>

        {/* ===================== WHAT'S INCLUDED (value stack) ===================== */}
        <section className="px-5 py-20 md:py-28 bg-[#f5f2ed]">
          <div className="max-w-4xl mx-auto">
            <div className="inline-flex items-center rounded-full border border-black/10 px-4 py-1.5 mb-8">
              <span className="font-mono-eyebrow text-[11px] uppercase text-neutral-700">
                What&apos;s included
              </span>
            </div>
            <h2 className="text-4xl md:text-6xl font-bold tracking-tight leading-[1.02] mb-12 text-[#0a0a0a]">
              Six things in your seat.{" "}
              <span className="accent-italic text-[#CC5500] font-normal">
                $738 of value.
              </span>
            </h2>

            <div className="rounded-3xl bg-white border border-black/10 overflow-hidden">
              {VALUE_STACK.map((item) => (
                <div
                  key={item.number}
                  className={`flex items-start gap-5 p-6 md:p-8${
                    item.border ? " border-b border-black/10" : ""
                  }${item.creamRow ? " bg-[#fcfaf7]" : ""}`}
                >
                  <span className="text-3xl font-semibold text-neutral-200 leading-none">
                    {item.number}
                  </span>
                  <div className="flex-1">
                    {item.bonus ? (
                      <div className="flex items-center gap-3 flex-wrap">
                        {item.title}
                        <span className="rounded-full border border-[#A03D00]/40 text-[#A03D00] px-2.5 py-0.5 font-mono-eyebrow text-[9px] uppercase">
                          Bonus · Live only
                        </span>
                      </div>
                    ) : (
                      item.title
                    )}
                    <p className="mt-1 text-neutral-700">{item.body}</p>
                    <span className="mt-3 inline-block rounded-full bg-[#f5f2ed] px-3 py-1 font-mono-eyebrow text-[10px] uppercase text-neutral-700">
                      {item.value}
                    </span>
                  </div>
                </div>
              ))}

              {/* Total */}
              <div className="bg-[#1a1a1a] text-white p-8 md:p-10">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <span className="font-mono-eyebrow text-[10px] uppercase text-neutral-300 block mb-1">
                      Total value
                    </span>
                    <span className="text-3xl font-semibold text-neutral-400 line-through decoration-[#CC5500]/70">
                      $738
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="font-mono-eyebrow text-[10px] uppercase text-neutral-300 block mb-1">
                      You pay today
                    </span>
                    <span className="text-4xl font-semibold">
                      <span className="text-[#e9a06a]">$</span>9
                    </span>
                  </div>
                </div>
                <a
                  href="#seat"
                  className="group flex items-center justify-center gap-2 w-full rounded-xl bg-white text-[#1a1a1a] px-6 py-4 text-base font-semibold hover:bg-neutral-200 transition-all focus:outline-none focus:ring-2 focus:ring-white/40 active:scale-[0.99]"
                >
                  <span>Save my seat · $9</span>
                  <ArrowRight
                    size={18}
                    className="transition-transform group-hover:translate-x-0.5"
                    aria-hidden="true"
                  />
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* ===================== PROOF ===================== */}
        <section className="px-5 py-20 md:py-28 max-w-4xl mx-auto">
          <h2 className="text-4xl md:text-6xl font-bold tracking-tight leading-[1.02] mb-12 text-[#0a0a0a]">
            Different ideas.{" "}
            <span className="accent-italic text-[#CC5500] font-normal">
              Different builders.
            </span>{" "}
            Same result.
          </h2>

          <div className="rounded-3xl bg-[#1a1a1a] text-white p-8 md:p-10 mb-6 reveal">
            <span className="font-mono-eyebrow text-[10px] uppercase text-neutral-300">
              Featured win
            </span>
            <p className="mt-4 text-5xl md:text-6xl font-semibold tracking-tight">
              14 signups in 48 hours
            </p>
            <p className="accent-italic text-[#e9a06a] text-xl mt-1">
              from a Notes-app idea I&apos;d sat on for 9 months.
            </p>
            <p className="mt-6 text-neutral-300 leading-relaxed max-w-2xl">
              Walked in with a vague idea and walked out with a live URL. By
              Monday morning I had 14 real signups from people who actually
              wanted what I&apos;d been describing to friends for almost a
              year.
            </p>
            <div className="mt-8 flex items-center gap-3 pt-6 border-t border-white/10">
              <div
                className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-sm font-semibold text-white/70"
                aria-hidden="true"
              >
                HR
              </div>
              <p className="font-semibold text-sm">Hannah Reyes</p>
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-6">
            <blockquote className="rounded-3xl bg-white border border-black/10 p-8 reveal">
              <p className="text-3xl font-semibold tracking-tight text-[#0a0a0a]">
                Shipped in 90 minutes
              </p>
              <p className="accent-italic text-[#A03D00] mb-4">
                after 3 months of overthinking.
              </p>
              <p className="text-neutral-700 italic">
                &quot;The Ship Sheet did what every productivity book
                hadn&apos;t. I stopped polishing and just shipped the one
                screen that mattered.&quot;
              </p>
              <footer className="mt-4 font-mono-eyebrow text-[10px] uppercase text-neutral-700">
                Marcus Hale
              </footer>
            </blockquote>
            <blockquote className="rounded-3xl bg-white border border-black/10 p-8 reveal">
              <p className="text-3xl font-semibold tracking-tight text-[#0a0a0a]">
                First paying user in 6 days
              </p>
              <p className="accent-italic text-[#A03D00] mb-4">
                from a tool I almost didn&apos;t build.
              </p>
              <p className="text-neutral-700 italic">
                &quot;Scoped down to one tiny thing I could actually finish.
                Posted the URL on Sunday, first paying user emailed by
                Wednesday.&quot;
              </p>
              <footer className="mt-4 font-mono-eyebrow text-[10px] uppercase text-neutral-700">
                Priya Shah
              </footer>
            </blockquote>
          </div>
        </section>

        {/* ===================== TICKET ===================== */}
        <section className="px-5 py-20 md:py-28 bg-[#f5f2ed]">
          <div className="max-w-2xl mx-auto">
            <div className="inline-flex items-center rounded-full border border-black/10 px-4 py-1.5 mb-8">
              <span className="font-mono-eyebrow text-[11px] uppercase text-neutral-700">
                Here&apos;s your ticket
              </span>
            </div>
            <h2 className="text-4xl md:text-6xl font-bold tracking-tight leading-[1.02] mb-12 text-[#0a0a0a]">
              90 minutes.{" "}
              <span className="accent-italic text-[#CC5500] font-normal">
                $9.
              </span>{" "}
              Walk out shipped.
            </h2>

            <div className="rounded-3xl overflow-hidden border border-black/10 shadow-sm">
              {/* Stub header */}
              <div className="bg-[#1a1a1a] text-white px-6 md:px-8 py-4 flex items-center justify-between">
                <span className="font-mono-eyebrow text-[10px] uppercase text-neutral-300">
                  Admission · Workshop №01
                </span>
                <span className="font-mono-eyebrow text-[10px] uppercase text-neutral-300">
                  WMVP·26·S0001
                </span>
              </div>
              {/* Body */}
              <div className="bg-white px-6 md:px-8 py-8">
                <p className="text-4xl font-semibold tracking-tight text-[#0a0a0a]">
                  ship<span className="text-[#CC5500]">·</span>able
                  <span className="text-[#CC5500]">.</span>
                </p>
                <p className="mt-2 text-neutral-700">
                  A 90-minute working session with John Iseghohi.{" "}
                  <span className="accent-italic text-[#A03D00]">
                    Build your MVP, live.
                  </span>
                </p>

                <dl className="grid grid-cols-2 gap-y-6 mt-8 pt-8 border-t border-black/10">
                  <div>
                    <dt className="font-mono-eyebrow text-[10px] uppercase text-neutral-700">
                      Date
                    </dt>
                    <dd className="mt-1 font-semibold text-[#1a1a1a]">
                      Sat, Jun 27
                    </dd>
                  </div>
                  <div>
                    <dt className="font-mono-eyebrow text-[10px] uppercase text-neutral-700">
                      Start
                    </dt>
                    <dd className="mt-1 font-semibold text-[#1a1a1a]">
                      12:00 PM{" "}
                      <span className="accent-italic text-neutral-700">
                        BST
                      </span>
                    </dd>
                  </div>
                  <div>
                    <dt className="font-mono-eyebrow text-[10px] uppercase text-neutral-700">
                      Length
                    </dt>
                    <dd className="mt-1 font-semibold text-[#1a1a1a]">
                      90 min + Q&amp;A
                    </dd>
                  </div>
                  <div>
                    <dt className="font-mono-eyebrow text-[10px] uppercase text-neutral-700">
                      Format
                    </dt>
                    <dd className="mt-1 font-semibold text-[#1a1a1a]">
                      Live on Zoom
                    </dd>
                  </div>
                </dl>

                <div className="ticket-perf my-8"></div>

                <div className="flex items-center justify-between text-sm">
                  <span className="font-mono-eyebrow text-[10px] uppercase text-neutral-700">
                    What&apos;s included
                  </span>
                  <span className="font-mono-eyebrow text-[10px] uppercase text-neutral-700">
                    Value
                  </span>
                </div>
                <ul className="mt-3 space-y-2 text-sm text-[#1a1a1a]">
                  <li className="flex justify-between">
                    <span>Live workshop</span>
                    <span className="font-semibold">$97</span>
                  </li>
                  <li className="flex justify-between">
                    <span>Ship Sheet worksheet</span>
                    <span className="font-semibold">$47</span>
                  </li>
                  <li className="flex justify-between">
                    <span>Lifetime replay</span>
                    <span className="font-semibold">$47</span>
                  </li>
                  <li className="flex justify-between">
                    <span>48-Hour Build Plan</span>
                    <span className="font-semibold">$199</span>
                  </li>
                  <li className="flex justify-between text-[#A03D00]">
                    <span>Bonus · AI MVP Builder</span>
                    <span className="font-semibold">$199</span>
                  </li>
                  <li className="flex justify-between text-[#A03D00]">
                    <span>Bonus · Starter Kit</span>
                    <span className="font-semibold">$149</span>
                  </li>
                </ul>
              </div>
              {/* Stub footer */}
              <div className="bg-[#1a1a1a] text-white px-6 md:px-8 py-8 text-center">
                <span className="font-mono-eyebrow text-[10px] uppercase text-neutral-300 block mb-2">
                  One-time · Seat
                </span>
                <p className="text-5xl font-semibold tracking-tight">
                  <span className="text-[#e9a06a]">$</span>9
                </p>
                <p className="font-mono-eyebrow text-[10px] uppercase text-neutral-300 mt-2 mb-6">
                  <span className="line-through">$738</span> value · 2 bonuses
                  (live)
                </p>
                <a
                  href="#seat"
                  className="group flex items-center justify-center gap-2 w-full rounded-xl bg-white text-[#1a1a1a] px-6 py-4 text-base font-semibold hover:bg-neutral-200 transition-all focus:outline-none focus:ring-2 focus:ring-white/40 active:scale-[0.99]"
                >
                  <span>Save my seat · $9</span>
                  <ArrowRight
                    size={18}
                    className="transition-transform group-hover:translate-x-0.5"
                    aria-hidden="true"
                  />
                </a>
                <p className="font-mono-eyebrow text-[9px] uppercase text-neutral-400 mt-5">
                  WMVP·26·S0001 · Bring to Zoom
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ===================== TIMEZONES ===================== */}
        <section className="px-5 py-20 md:py-24 max-w-3xl mx-auto reveal">
          <h2 className="text-4xl md:text-5xl font-bold tracking-tight leading-[1.04] mb-6 text-[#0a0a0a]">
            Here&apos;s when it lands{" "}
            <span className="accent-italic text-[#CC5500] font-normal">
              where you are.
            </span>
          </h2>
          <p className="text-lg text-neutral-700 mb-10">
            Workshop runs{" "}
            <strong className="font-semibold text-[#1a1a1a]">
              12:00 PM BST
            </strong>{" "}
            on Sat, Jun 27. Set a reminder for your local time below.
          </p>
          <div className="rounded-3xl border border-black/10 overflow-hidden divide-y divide-black/10">
            <div className="flex items-center justify-between px-6 py-5 bg-white">
              <div>
                <p className="font-mono-eyebrow text-[11px] uppercase text-[#A03D00]">
                  New York
                </p>
                <p className="font-mono-eyebrow text-[10px] uppercase text-neutral-700 mt-1">
                  Sat Jun 27 · EDT
                </p>
              </div>
              <p className="text-3xl font-semibold tracking-tight text-[#0a0a0a]">
                7:00 AM
              </p>
            </div>
            <div className="flex items-center justify-between px-6 py-5 bg-white">
              <div>
                <p className="font-mono-eyebrow text-[11px] uppercase text-[#A03D00]">
                  London
                </p>
                <p className="font-mono-eyebrow text-[10px] uppercase text-neutral-700 mt-1">
                  Sat Jun 27 · BST
                </p>
              </div>
              <p className="text-3xl font-semibold tracking-tight text-[#0a0a0a]">
                12:00 PM
              </p>
            </div>
            <div className="flex items-center justify-between px-6 py-5 bg-white">
              <div>
                <p className="font-mono-eyebrow text-[11px] uppercase text-[#A03D00]">
                  Lagos
                </p>
                <p className="font-mono-eyebrow text-[10px] uppercase text-neutral-700 mt-1">
                  Sat Jun 27 · WAT
                </p>
              </div>
              <p className="text-3xl font-semibold tracking-tight text-[#0a0a0a]">
                12:00 PM
              </p>
            </div>
            <div className="flex items-center justify-between px-6 py-5 bg-white">
              <div>
                <p className="font-mono-eyebrow text-[11px] uppercase text-[#A03D00]">
                  Los Angeles
                </p>
                <p className="font-mono-eyebrow text-[10px] uppercase text-neutral-700 mt-1">
                  Sat Jun 27 · PDT
                </p>
              </div>
              <p className="text-3xl font-semibold tracking-tight text-[#0a0a0a]">
                4:00 AM
              </p>
            </div>
          </div>
        </section>

        {/* ===================== MEET YOUR TEACHER ===================== */}
        <section className="px-5 py-20 md:py-28 max-w-3xl mx-auto">
          <picture>
            <source type="image/webp" srcSet="/image/john-portrait.webp" />
            <img
              src="/image/john-portrait.jpg"
              alt="John Iseghohi, founder of Weekend MVP"
              className="w-full rounded-3xl object-cover aspect-[4/5] bg-[#f5f2ed] mb-10"
              loading="lazy"
              decoding="async"
              width={1000}
              height={1250}
            />
          </picture>
          <h2 className="text-5xl font-bold tracking-tight text-[#0a0a0a]">
            John Iseghohi.
          </h2>
          <p className="font-mono-eyebrow text-[11px] uppercase text-[#A03D00] mt-2">
            Founder · Weekend MVP
          </p>
          <div className="mt-8 space-y-5 text-lg text-neutral-800">
            <p>
              I&apos;ve watched people who were sure they needed more time, a
              co-founder, or to &quot;learn to code first&quot; come in,
              change almost nothing, scope one tiny version of what they
              already had, and ship it in a weekend. Then get their first real
              users for the first time ever.
            </p>
            <p>The workshop is the 90-minute version of how we start that.</p>
          </div>
          <div className="mt-8 flex flex-wrap gap-3">
            <span className="rounded-full bg-[#f5f2ed] px-4 py-2 font-mono-eyebrow text-[10px] uppercase text-neutral-700">
              400+ builders
            </span>
            <span className="rounded-full bg-[#f5f2ed] px-4 py-2 font-mono-eyebrow text-[10px] uppercase text-neutral-700">
              78 ideas broken down
            </span>
            <span className="rounded-full bg-[#f5f2ed] px-4 py-2 font-mono-eyebrow text-[10px] uppercase text-neutral-700">
              New ideas daily at weekendmvp.app
            </span>
          </div>
        </section>

        {/* ===================== SEAT / EMAIL CAPTURE ===================== */}
        <ShipableSeat />
      </main>

      {/* ===================== STICKY CTA BAR ===================== */}
      <div className="fixed bottom-4 left-0 right-0 z-40 flex justify-center px-4 pointer-events-none">
        <div className="pointer-events-auto flex items-center justify-between gap-4 w-full max-w-2xl rounded-2xl bg-[#1a1a1a] text-white pl-5 pr-2 py-2 shadow-2xl border border-white/10">
          <div className="flex items-center gap-2 min-w-0">
            <StickyCountdownLabel
              deadline={WORKSHOP_DEADLINE}
              className="font-mono-eyebrow text-[10px] sm:text-[11px] uppercase text-neutral-300 truncate"
            />
          </div>
          <a
            href="#seat"
            className="inline-flex items-center gap-2 rounded-xl bg-[#e9a06a] text-[#1a1a1a] px-4 sm:px-5 py-3 text-xs sm:text-sm font-semibold hover:bg-[#f0b380] transition-all focus:outline-none focus:ring-2 focus:ring-white/40 active:scale-95 shrink-0 whitespace-nowrap"
          >
            Save my seat · $9
            <ArrowRight size={16} aria-hidden="true" />
          </a>
        </div>
      </div>
    </div>
  );
}
