import type { Metadata } from "next";
import { ArrowRight, Check } from "lucide-react";
import { JsonLd } from "@/components/primitives/JsonLd";
import {
  CountdownGrid,
  StickyCountdownLabel,
} from "@/components/marketing/Countdown";
import { ScrollRevealInit } from "@/components/marketing/ScrollReveal";
import { newsreader } from "@/lib/fonts";
import { DareSeatForm } from "./DareSeatForm";

/* DRAFT: page still contains [[PLACEHOLDERS]] and an unscheduled date.
   Remove the noindex robots metadata AND add a sitemap entry once
   placeholders (date, stats, proof, checkout) are filled and the workshop
   is launch-ready.

   ============================================================
   PLACEHOLDERS TO REPLACE BEFORE LAUNCH (search for [[ ):
    [[WORKSHOP_DATE_ISO]]  deadline passed to the countdown
    [[DATE]] [[TIME]] [[TZ]]  human-readable schedule
    [[STAT_YEARS]] [[STAT_SHIPPED]]  credibility numbers
    [[CHECKOUT_URL]]  payment link (currently captures seat
      via Beehiiv /api/subscribe waitlist — see DareSeatForm)
    [[TZ_*]]  local-time conversions
   ============================================================ */

// Countdown: edit the deadline (ISO 8601 with timezone offset)
const WORKSHOP_DEADLINE = "[[WORKSHOP_DATE_ISO]]";

export const metadata: Metadata = {
  title: {
    absolute:
      "DARE | Choose your AI product direction in 90 minutes · Live workshop for designers",
  },
  description:
    "DARE Live: a 90-minute live working session for experienced designers. Choose one concrete AI/agentic product or AI-powered service and leave with a 4-week plan to move it into the real world. $29. Live on Zoom. Replay included.",
  authors: [{ name: "John Iseghohi" }],
  robots: { index: false, follow: false },
  alternates: { canonical: "/dare" },
  openGraph: {
    type: "website",
    url: "/dare",
    title: "DARE | Choose your AI product direction in 90 minutes",
    description:
      "A 90-minute live working session for experienced designers. Choose one concrete AI product or AI-powered service and leave with a 4-week plan. $29. Replay included.",
    images: [
      {
        url: "https://weekendmvp.app/image/og-image.png",
        alt: "DARE Live, a workshop for designers becoming AI-native founders",
        type: "image/png",
        width: 1200,
        height: 630,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "DARE | Choose your AI product direction in 90 minutes",
    description:
      "A 90-minute live working session for experienced designers. Choose one concrete AI product or AI-powered service and leave with a 4-week plan. $29. Replay included.",
    images: ["https://weekendmvp.app/image/og-image.png"],
  },
};

/* JSON-LD: Event + Breadcrumb for SEO/AEO */
const SCHEMA = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Person",
      "@id": "https://weekendmvp.app/#person",
      name: "John Iseghohi",
      jobTitle: "Founder, Weekend MVP",
      url: "https://cal.com/switchtoux",
    },
    {
      "@type": "Event",
      name: "DARE Live · Choose your AI product direction in 90 minutes",
      description:
        "A 90-minute live working session for experienced designers. Choose one concrete AI/agentic product or AI-powered service and leave with a 4-week plan to move it into the real world.",
      eventAttendanceMode: "https://schema.org/OnlineEventAttendanceMode",
      eventStatus: "https://schema.org/EventScheduled",
      startDate: "[[WORKSHOP_DATE_ISO]]",
      organizer: { "@id": "https://weekendmvp.app/#person" },
      location: {
        "@type": "VirtualLocation",
        url: "https://weekendmvp.app/dare",
      },
      offers: {
        "@type": "Offer",
        price: "29",
        priceCurrency: "USD",
        availability: "https://schema.org/InStock",
        url: "https://weekendmvp.app/dare",
      },
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
          name: "DARE Live Workshop",
          item: "https://weekendmvp.app/dare",
        },
      ],
    },
  ],
};

export default function DarePage() {
  return (
    <div
      className={`${newsreader.variable} theme-cream overflow-x-hidden bg-[#fcfaf7] text-[#1a1a1a]`}
      style={{ colorScheme: "light" }}
    >
      <JsonLd schema={SCHEMA} />
      <ScrollRevealInit />

      <main>
        {/* ===================== HERO ===================== */}
        {/* DARE accent system: ink blue. #1D4ED8 large/accent text · #1E40AF small text (WCAG AA on cream) · #A7C0F2 on dark */}
        <section className="relative px-5 pt-32 pb-16 md:pt-40 md:pb-24 max-w-5xl mx-auto">
          <div className="inline-flex items-center gap-2 mb-8">
            <span
              className="w-1.5 h-1.5 rounded-full bg-[#1D4ED8] animate-pulse"
              aria-hidden="true"
            ></span>
            <span className="sr-only">Live:</span>
            <span className="font-mono-eyebrow text-[11px] uppercase text-neutral-600">
              Live Workshop · For Designers
            </span>
          </div>

          <h1 className="text-[17vw] leading-[0.9] md:text-[7.5rem] font-semibold tracking-tight text-[#1a1a1a]">
            D<span className="text-[#1D4ED8]">·</span>A
            <span className="text-[#1D4ED8]">·</span>R
            <span className="text-[#1D4ED8]">·</span>E
            <span className="text-[#1D4ED8]">.</span>
          </h1>
          <p className="mt-4 font-mono-eyebrow text-[10px] md:text-xs uppercase text-[#1E40AF]">
            Discover · Architect · Run · Earn
          </p>

          <p className="mt-8 max-w-2xl text-xl md:text-2xl leading-snug text-neutral-700">
            A 90-minute live working session for experienced designers.
            You&apos;ll choose{" "}
            <span className="accent-italic text-[#1D4ED8]">
              one concrete AI product or AI-powered service,
            </span>{" "}
            and leave with a 4-week plan to move it into the real world.
          </p>

          <div className="mt-10 flex flex-col sm:flex-row items-start sm:items-center gap-5">
            <a
              href="#seat"
              className="group inline-flex items-center gap-3 rounded-2xl bg-[#1a1a1a] pl-7 pr-5 py-4 text-base font-semibold text-white hover:bg-black transition-all focus:outline-none focus:ring-2 focus:ring-black/30 focus:ring-offset-2 focus:ring-offset-[#fcfaf7] active:scale-[0.98]"
            >
              <span>Save my seat</span>
              <span className="h-5 w-px bg-white/25" aria-hidden="true"></span>
              <span className="text-[#A7C0F2]">$29</span>
              <ArrowRight
                size={18}
                className="transition-transform group-hover:translate-x-0.5"
                aria-hidden="true"
              />
            </a>
            <p className="text-sm text-neutral-500">
              Live on Zoom · Replay included · No engineering background
              required.
            </p>
          </div>
        </section>

        {/* ===================== DATE / COUNTDOWN ===================== */}
        <section className="px-5 pb-16 md:pb-20 max-w-5xl mx-auto">
          <div className="rounded-3xl bg-[#1a1a1a] text-white p-8 md:p-10 max-w-2xl">
            <div className="flex items-center justify-between mb-6">
              <span className="font-mono-eyebrow text-[10px] uppercase text-neutral-300">
                DARE Live starts in
              </span>
              <span className="font-mono-eyebrow text-[10px] uppercase text-neutral-300">
                [[TZ]]
              </span>
            </div>
            <p className="text-3xl md:text-4xl font-semibold tracking-tight">
              [[DATE]]{" "}
              <span className="accent-italic text-[#A7C0F2]">[[TIME]]</span>
            </p>
            <p className="mt-2 text-sm text-neutral-300">
              90 minutes live · working session, not a lecture · Q&amp;A after
            </p>
            <CountdownGrid deadline={WORKSHOP_DEADLINE} />
            <p className="mt-6 text-sm text-neutral-400">
              One direction chosen. Four weeks mapped. In one sitting.
            </p>
          </div>
        </section>

        {/* ===================== DELIVERABLE TEASER ===================== */}
        <section className="px-5 py-12 max-w-5xl mx-auto reveal-fade">
          <div className="rounded-3xl border border-black/10 bg-white p-8 md:p-10 flex flex-col md:flex-row items-start gap-8">
            {/* 4-week calendar grid motif: one accent move per week */}
            <div
              className="shrink-0 w-40 rounded-xl bg-[#f0f3fa] border border-black/10 p-3"
              aria-hidden="true"
            >
              <div className="grid grid-cols-4 gap-1.5">
                <div className="font-mono-eyebrow text-[7px] uppercase text-neutral-400 text-center">
                  W1
                </div>
                <div className="font-mono-eyebrow text-[7px] uppercase text-neutral-400 text-center">
                  W2
                </div>
                <div className="font-mono-eyebrow text-[7px] uppercase text-neutral-400 text-center">
                  W3
                </div>
                <div className="font-mono-eyebrow text-[7px] uppercase text-neutral-400 text-center">
                  W4
                </div>
                <div className="h-7 rounded bg-[#1D4ED8]/80"></div>
                <div className="h-7 rounded bg-neutral-200"></div>
                <div className="h-7 rounded bg-neutral-200"></div>
                <div className="h-7 rounded bg-neutral-200"></div>
                <div className="h-7 rounded bg-neutral-200"></div>
                <div className="h-7 rounded bg-[#1D4ED8]/60"></div>
                <div className="h-7 rounded bg-neutral-200"></div>
                <div className="h-7 rounded bg-neutral-200"></div>
                <div className="h-7 rounded bg-neutral-200"></div>
                <div className="h-7 rounded bg-neutral-200"></div>
                <div className="h-7 rounded bg-[#1D4ED8]/40"></div>
                <div className="h-7 rounded bg-[#1D4ED8]"></div>
              </div>
            </div>
            <div>
              <span className="font-mono-eyebrow text-[11px] uppercase text-[#1E40AF]">
                Your 4-Week DARE Plan
              </span>
              <h2 className="mt-3 text-3xl md:text-4xl font-semibold tracking-tight">
                You leave with a decision, on paper.
              </h2>
              <p className="mt-3 text-lg text-neutral-600 max-w-xl">
                During the session you&apos;ll fill in the DARE worksheets
                live. By the end, they become your 4-Week DARE Plan: one
                product or one service, one clear path — your chosen direction
                broken into one concrete move per week.
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
              {/* [[STAT_*]] replace with real numbers */}
              <div className="flex items-baseline justify-between py-6 reveal-fade">
                <dt className="text-4xl md:text-5xl font-semibold tracking-tight">
                  [[STAT_YEARS]]
                  <span className="accent-italic text-[#A7C0F2] text-3xl">
                    {" "}
                    yrs
                  </span>
                </dt>
                <dd className="font-mono-eyebrow text-[10px] md:text-xs uppercase text-neutral-300 text-right">
                  Designing products professionally
                </dd>
              </div>
              <div className="flex items-baseline justify-between py-6 reveal-fade">
                <dt className="text-4xl md:text-5xl font-semibold tracking-tight">
                  [[STAT_SHIPPED]]
                  <span className="accent-italic text-[#A7C0F2] text-3xl">
                    {" "}
                    shipped
                  </span>
                </dt>
                <dd className="font-mono-eyebrow text-[10px] md:text-xs uppercase text-neutral-300 text-right">
                  AI-native products &amp; agentic workflows, built solo
                </dd>
              </div>
              <div className="flex items-baseline justify-between py-6 reveal-fade">
                <dt className="text-4xl md:text-5xl font-semibold tracking-tight">
                  78
                  <span className="accent-italic text-[#A7C0F2] text-3xl">
                    {" "}
                    broken down
                  </span>
                </dt>
                <dd className="font-mono-eyebrow text-[10px] md:text-xs uppercase text-neutral-300 text-right">
                  AI &amp; SaaS ideas analyzed at weekendmvp.app
                </dd>
              </div>
              <div className="flex items-baseline justify-between py-6 reveal-fade">
                <dt className="text-4xl md:text-5xl font-semibold tracking-tight">
                  1
                  <span className="accent-italic text-[#A7C0F2] text-3xl">
                    {" "}
                    framework
                  </span>
                </dt>
                <dd className="font-mono-eyebrow text-[10px] md:text-xs uppercase text-neutral-300 text-right">
                  DARE, taught live · more coming
                </dd>
              </div>
            </dl>
          </div>
        </section>

        {/* ===================== THE REAL PROBLEM ===================== */}
        <section className="px-5 py-20 md:py-28 max-w-3xl mx-auto reveal-fade">
          <h2 className="text-4xl md:text-6xl font-semibold tracking-tight leading-[1.02]">
            You&apos;re a strong designer with vague AI ideas…{" "}
            <span className="accent-italic text-[#1D4ED8] font-normal">
              and vague doesn&apos;t ship.
            </span>
          </h2>
          <div className="mt-10 space-y-6 text-lg text-neutral-700">
            <p>
              You&apos;ve been paying attention. You&apos;ve used the tools.
              You can see, more clearly than most engineers, where AI actually
              fits a real person&apos;s workflow.
            </p>
            <p>And yet nothing&apos;s moving. Three traps, usually:</p>
            <ul className="space-y-4">
              <li className="flex gap-4">
                <span
                  className="mt-3 h-px w-6 bg-[#1D4ED8] shrink-0"
                  aria-hidden="true"
                ></span>
                <span>
                  <strong className="font-semibold">
                    The engineer myth.
                  </strong>{" "}
                  &quot;I need to get technical first.&quot; So you collect
                  tutorials instead of making a decision.
                </span>
              </li>
              <li className="flex gap-4">
                <span
                  className="mt-3 h-px w-6 bg-[#1D4ED8] shrink-0"
                  aria-hidden="true"
                ></span>
                <span>
                  <strong className="font-semibold">
                    The big-idea trap.
                  </strong>{" "}
                  Every idea you take seriously feels like it needs a team and
                  a roadmap. So you take none of them seriously.
                </span>
              </li>
              <li className="flex gap-4">
                <span
                  className="mt-3 h-px w-6 bg-[#1D4ED8] shrink-0"
                  aria-hidden="true"
                ></span>
                <span>
                  <strong className="font-semibold">The model maze.</strong>{" "}
                  SaaS? Service? Agency? You&apos;re trying to pick the
                  perfect vehicle before you&apos;ve picked the problem.
                </span>
              </li>
            </ul>
            <p>
              <span className="accent-italic text-[#1a1a1a]">
                The hard part of AI products is design judgment — which you
                already have. What you&apos;re missing isn&apos;t knowledge.
                It&apos;s a path.
              </span>
            </p>
            <p>DARE is that path, walked in 90 minutes.</p>
          </div>
        </section>

        {/* ===================== TL;DR ===================== */}
        <section className="px-5 py-16 bg-[#f5f2ed]">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-4xl md:text-5xl font-semibold tracking-tight mb-10">
              Everything you need to know,{" "}
              <span className="accent-italic text-[#1D4ED8] font-normal">
                in ten seconds.
              </span>
            </h2>
            <ul className="space-y-6">
              <li className="flex gap-4">
                <Check
                  size={22}
                  className="text-[#1D4ED8] mt-0.5 shrink-0"
                  aria-hidden="true"
                />
                <p className="text-lg text-neutral-700">
                  <strong className="font-semibold text-[#1a1a1a]">
                    It&apos;s $29, one-time.
                  </strong>{" "}
                  A working session, not a course.
                </p>
              </li>
              <li className="flex gap-4">
                <Check
                  size={22}
                  className="text-[#1D4ED8] mt-0.5 shrink-0"
                  aria-hidden="true"
                />
                <p className="text-lg text-neutral-700">
                  <strong className="font-semibold text-[#1a1a1a]">
                    It&apos;s 90 minutes live
                  </strong>{" "}
                  on [[DATE]], [[TIME]] [[TZ]], on Zoom — with Q&amp;A after.
                </p>
              </li>
              <li className="flex gap-4">
                <Check
                  size={22}
                  className="text-[#1D4ED8] mt-0.5 shrink-0"
                  aria-hidden="true"
                />
                <p className="text-lg text-neutral-700">
                  <strong className="font-semibold text-[#1a1a1a]">
                    It&apos;s for experienced designers,
                  </strong>{" "}
                  design-leaning PMs, and semi-technical builders. No
                  engineering required.
                </p>
              </li>
              <li className="flex gap-4">
                <Check
                  size={22}
                  className="text-[#1D4ED8] mt-0.5 shrink-0"
                  aria-hidden="true"
                />
                <p className="text-lg text-neutral-700">
                  <strong className="font-semibold text-[#1a1a1a]">
                    You leave with one direction and a 4-week plan
                  </strong>{" "}
                  — a tiny agentic SaaS or an AI-powered productized service,
                  chosen and mapped.
                </p>
              </li>
              <li className="flex gap-4">
                <Check
                  size={22}
                  className="text-[#1D4ED8] mt-0.5 shrink-0"
                  aria-hidden="true"
                />
                <p className="text-lg text-neutral-700">
                  <strong className="font-semibold text-[#1a1a1a]">
                    Can&apos;t make it live? Replay included,
                  </strong>{" "}
                  same day, yours forever.
                </p>
              </li>
              <li className="flex gap-4">
                <Check
                  size={22}
                  className="text-[#1D4ED8] mt-0.5 shrink-0"
                  aria-hidden="true"
                />
                <p className="text-lg text-neutral-700">
                  <strong className="font-semibold text-[#1a1a1a]">
                    It&apos;s the front door, not the whole house.
                  </strong>{" "}
                  DARE Live stands alone — and live attendees get first access
                  when the deeper DARE program opens.
                </p>
              </li>
            </ul>
          </div>
        </section>

        {/* ===================== THREE MOVES (the framework) ===================== */}
        <section className="px-5 py-20 md:py-28 max-w-4xl mx-auto">
          <h2 className="text-4xl md:text-6xl font-semibold tracking-tight leading-[1.02] mb-14">
            Three moves.{" "}
            <span className="accent-italic text-[#1D4ED8] font-normal">
              One direction by the end.
            </span>
          </h2>

          <div className="border-t border-black/10">
            <article className="grid md:grid-cols-[auto_1fr] gap-x-8 gap-y-3 py-10 border-b border-black/10 reveal-fade">
              <span
                className="text-6xl md:text-7xl font-semibold text-[#C9D8F7] leading-none w-24"
                aria-hidden="true"
              >
                D
              </span>
              <div>
                <h3 className="text-2xl md:text-3xl font-semibold tracking-tight">
                  Discover.{" "}
                  <span className="accent-italic text-[#1D4ED8] font-normal">
                    One buyer, one painful workflow.
                  </span>
                </h3>
                <p className="mt-3 text-lg text-neutral-600">
                  You already know how to find the real problem under a vague
                  brief — you&apos;ve done it in every discovery call of your
                  career. We aim that skill at the AI landscape and cut your
                  idea cloud down to one specific person, one workflow, one
                  why-now. Written down.
                </p>
                <span className="mt-4 inline-block rounded-full bg-[#f5f2ed] px-3 py-1 font-mono-eyebrow text-[10px] uppercase text-neutral-500">
                  ~25 min
                </span>
              </div>
            </article>
            <article className="grid md:grid-cols-[auto_1fr] gap-x-8 gap-y-3 py-10 border-b border-black/10 reveal-fade">
              <span
                className="text-6xl md:text-7xl font-semibold text-[#C9D8F7] leading-none w-24"
                aria-hidden="true"
              >
                A
              </span>
              <div>
                <h3 className="text-2xl md:text-3xl font-semibold tracking-tight">
                  Architect.{" "}
                  <span className="accent-italic text-[#1D4ED8] font-normal">
                    This is where designers win.
                  </span>
                </h3>
                <p className="mt-3 text-lg text-neutral-600">
                  Anyone can call an API. Almost nobody can design where the
                  agent acts, where the human stays in control, and why anyone
                  would trust it — that&apos;s interaction design, and
                  it&apos;s the scarcest skill in AI products right now.
                  You&apos;ll map your workflow into an Agent Blueprint: a
                  simple agentic flow a real person would love to use.
                </p>
                <span className="mt-4 inline-block rounded-full bg-[#f5f2ed] px-3 py-1 font-mono-eyebrow text-[10px] uppercase text-neutral-500">
                  ~35 min
                </span>
              </div>
            </article>
            <article className="grid md:grid-cols-[auto_1fr] gap-x-8 gap-y-3 py-10 border-b border-black/10 reveal-fade">
              <span
                className="text-6xl md:text-7xl font-semibold text-[#C9D8F7] leading-none w-24"
                aria-hidden="true"
              >
                R+E
              </span>
              <div>
                <h3 className="text-2xl md:text-3xl font-semibold tracking-tight">
                  Run + Earn.{" "}
                  <span className="accent-italic text-[#1D4ED8] font-normal">
                    The scrappy v1, and the honest ask.
                  </span>
                </h3>
                <p className="mt-3 text-lg text-neutral-600">
                  We scope the smallest real version — live prototype, tiny
                  SaaS, or repeatable service workflow — then turn it into a
                  concrete offer with a price and the exact words to ask for
                  money without cringing. Both land in your 4-week plan: run
                  in weeks 1–3, earn in week 4.
                </p>
                <span className="mt-4 inline-block rounded-full bg-[#f5f2ed] px-3 py-1 font-mono-eyebrow text-[10px] uppercase text-neutral-500">
                  ~30 min
                </span>
              </div>
            </article>
          </div>
        </section>

        {/* ===================== WHAT'S INCLUDED (value stack) ===================== */}
        <section className="px-5 py-20 md:py-28 bg-[#f5f2ed]">
          <div className="max-w-4xl mx-auto">
            <div className="inline-flex items-center rounded-full border border-black/10 px-4 py-1.5 mb-8">
              <span className="font-mono-eyebrow text-[11px] uppercase text-neutral-600">
                What&apos;s included
              </span>
            </div>
            <h2 className="text-4xl md:text-6xl font-semibold tracking-tight leading-[1.02] mb-12">
              Six things in your seat.{" "}
              <span className="accent-italic text-[#1D4ED8] font-normal">
                ~$500 of value.
              </span>
            </h2>

            <div className="rounded-3xl bg-white border border-black/10 overflow-hidden">
              <div className="flex items-start gap-5 p-6 md:p-8 border-b border-black/10">
                <span className="text-3xl font-semibold text-neutral-200 leading-none">
                  01
                </span>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold">DARE Live Workshop</h3>
                  <p className="mt-1 text-neutral-600">
                    90-minute working session with John on Zoom. Bring one
                    idea — or none. Discover handles that.
                  </p>
                  <span className="mt-3 inline-block rounded-full bg-[#f5f2ed] px-3 py-1 font-mono-eyebrow text-[10px] uppercase text-neutral-500">
                    $97 value
                  </span>
                </div>
              </div>
              <div className="flex items-start gap-5 p-6 md:p-8 border-b border-black/10">
                <span className="text-3xl font-semibold text-neutral-200 leading-none">
                  02
                </span>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold">
                    DARE{" "}
                    <span className="accent-italic text-neutral-500 font-normal">
                      Opportunity Canvas
                    </span>
                  </h3>
                  <p className="mt-1 text-neutral-600">
                    The Discover worksheet: buyer, workflow, pain, why-now.
                    You fill it in live.
                  </p>
                  <span className="mt-3 inline-block rounded-full bg-[#f5f2ed] px-3 py-1 font-mono-eyebrow text-[10px] uppercase text-neutral-500">
                    $47 value
                  </span>
                </div>
              </div>
              <div className="flex items-start gap-5 p-6 md:p-8 border-b border-black/10">
                <span className="text-3xl font-semibold text-neutral-200 leading-none">
                  03
                </span>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold">
                    Agent{" "}
                    <span className="accent-italic text-neutral-500 font-normal">
                      Blueprint Worksheet
                    </span>
                  </h3>
                  <p className="mt-1 text-neutral-600">
                    The Architect tool: map the flow, place the agent, design
                    the human-in-the-loop guardrails.
                  </p>
                  <span className="mt-3 inline-block rounded-full bg-[#f5f2ed] px-3 py-1 font-mono-eyebrow text-[10px] uppercase text-neutral-500">
                    $67 value
                  </span>
                </div>
              </div>
              <div className="flex items-start gap-5 p-6 md:p-8 border-b border-black/10">
                <span className="text-3xl font-semibold text-neutral-200 leading-none">
                  04
                </span>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold">
                    4-Week DARE Plan template
                  </h3>
                  <p className="mt-1 text-neutral-600">
                    Your direction, sequenced one concrete move per week —
                    from blueprint to first revenue or real market signal.
                  </p>
                  <span className="mt-3 inline-block rounded-full bg-[#f5f2ed] px-3 py-1 font-mono-eyebrow text-[10px] uppercase text-neutral-500">
                    $147 value
                  </span>
                </div>
              </div>
              <div className="flex items-start gap-5 p-6 md:p-8 border-b border-black/10">
                <span className="text-3xl font-semibold text-neutral-200 leading-none">
                  05
                </span>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold">Lifetime replay</h3>
                  <p className="mt-1 text-neutral-600">
                    Full recording, yours forever. Rewatch the move
                    you&apos;re on.
                  </p>
                  <span className="mt-3 inline-block rounded-full bg-[#f5f2ed] px-3 py-1 font-mono-eyebrow text-[10px] uppercase text-neutral-500">
                    $47 value
                  </span>
                </div>
              </div>
              <div className="flex items-start gap-5 p-6 md:p-8 border-b border-black/10 bg-[#fcfaf7]">
                <span className="text-3xl font-semibold text-neutral-200 leading-none">
                  06
                </span>
                <div className="flex-1">
                  <div className="flex items-center gap-3 flex-wrap">
                    <h3 className="text-lg font-semibold">
                      Agentic Founder{" "}
                      <span className="accent-italic text-neutral-500 font-normal">
                        Prompt Pack
                      </span>
                    </h3>
                    <span className="rounded-full border border-[#1E40AF]/40 text-[#1E40AF] px-2.5 py-0.5 font-mono-eyebrow text-[9px] uppercase">
                      Bonus · Live only
                    </span>
                  </div>
                  <p className="mt-1 text-neutral-600">
                    The prompts that take your Agent Blueprint to a working v1
                    with today&apos;s tools — no engineering detour.
                  </p>
                  <span className="mt-3 inline-block rounded-full bg-[#f5f2ed] px-3 py-1 font-mono-eyebrow text-[10px] uppercase text-neutral-500">
                    $97 value
                  </span>
                </div>
              </div>
              <div className="flex items-start gap-5 p-6 md:p-8 bg-[#fcfaf7]">
                <span className="text-3xl font-semibold text-neutral-200 leading-none">
                  07
                </span>
                <div className="flex-1">
                  <div className="flex items-center gap-3 flex-wrap">
                    <h3 className="text-lg font-semibold">
                      Founding Member{" "}
                      <span className="accent-italic text-neutral-500 font-normal">
                        Invite
                      </span>
                    </h3>
                    <span className="rounded-full border border-[#1E40AF]/40 text-[#1E40AF] px-2.5 py-0.5 font-mono-eyebrow text-[9px] uppercase">
                      Bonus · Live only
                    </span>
                  </div>
                  <p className="mt-1 text-neutral-600">
                    First access and founding pricing when the full DARE
                    program opens.
                  </p>
                </div>
              </div>

              {/* Total */}
              <div className="bg-[#1a1a1a] text-white p-8 md:p-10">
                <p className="text-neutral-300 mb-6 max-w-xl">
                  Everything above exists for one outcome: you choose one
                  direction and leave with a 4-week plan to move it into the
                  real world.
                </p>
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <span className="font-mono-eyebrow text-[10px] uppercase text-neutral-300 block mb-1">
                      Total value
                    </span>
                    <span className="text-3xl font-semibold text-neutral-400 line-through decoration-[#1D4ED8]/70">
                      $502
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="font-mono-eyebrow text-[10px] uppercase text-neutral-300 block mb-1">
                      You pay today
                    </span>
                    <span className="text-4xl font-semibold">
                      <span className="text-[#A7C0F2]">$</span>29
                    </span>
                  </div>
                </div>
                <a
                  href="#seat"
                  className="group flex items-center justify-center gap-2 w-full rounded-xl bg-white text-[#1a1a1a] px-6 py-4 text-base font-semibold hover:bg-neutral-200 transition-all focus:outline-none focus:ring-2 focus:ring-white/40 active:scale-[0.99]"
                >
                  <span>Save my seat · $29</span>
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

        {/* ===================== PROOF (Before → After outcomes) ===================== */}
        <section className="px-5 py-20 md:py-28 max-w-4xl mx-auto">
          <h2 className="text-4xl md:text-6xl font-semibold tracking-tight leading-[1.02] mb-12">
            What changes{" "}
            <span className="accent-italic text-[#1D4ED8] font-normal">
              in 90 minutes.
            </span>
          </h2>

          {/* These are worked outcome EXAMPLES, clearly labeled — swap in real
              Before→After alumni quotes after the first session runs. */}
          <div className="rounded-3xl bg-[#1a1a1a] text-white p-8 md:p-10 mb-6 reveal-fade">
            <span className="font-mono-eyebrow text-[10px] uppercase text-neutral-300">
              Before → After · A DARE outcome
            </span>
            <p className="mt-6 text-xl md:text-2xl text-neutral-400 line-through decoration-white/30">
              &quot;I should do something with AI… maybe an assistant for
              freelancers?&quot;
            </p>
            <p className="mt-4 text-2xl md:text-3xl font-semibold tracking-tight">
              &quot;A done-for-you client-onboarding agent for B2B design
              studios —{" "}
              <span className="accent-italic text-[#A7C0F2] font-normal">
                sold as a productized service, first three conversations
                booked in week 4.
              </span>
              &quot;
            </p>
            <p className="mt-8 pt-6 border-t border-white/10 text-neutral-300 leading-relaxed max-w-2xl">
              That&apos;s the shape of the shift: from a category to a buyer,
              from a vibe to an offer, from someday to a dated plan.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 gap-6">
            <div className="rounded-3xl bg-white border border-black/10 p-8 reveal-fade">
              <span className="font-mono-eyebrow text-[10px] uppercase text-neutral-500">
                Before → After · Tiny SaaS
              </span>
              <p className="mt-4 text-neutral-400 line-through">
                &quot;Something with agents for research?&quot;
              </p>
              <p className="mt-2 text-lg font-semibold">
                &quot;A competitor-watch agent for boutique brand strategists
                — $19/mo, waitlist live in week 1.&quot;
              </p>
            </div>
            <div className="rounded-3xl bg-white border border-black/10 p-8 reveal-fade">
              <span className="font-mono-eyebrow text-[10px] uppercase text-neutral-500">
                Before → After · Productized service
              </span>
              <p className="mt-4 text-neutral-400 line-through">
                &quot;AI audits, maybe? For startups?&quot;
              </p>
              <p className="mt-2 text-lg font-semibold">
                &quot;A fixed-scope &apos;agent-ready UX audit&apos; for
                seed-stage SaaS teams — $1.5k flat, pitched to five founders
                in week 2.&quot;
              </p>
            </div>
          </div>
        </section>

        {/* ===================== TICKET ===================== */}
        <section className="px-5 py-20 md:py-28 bg-[#f5f2ed]">
          <div className="max-w-2xl mx-auto">
            <div className="inline-flex items-center rounded-full border border-black/10 px-4 py-1.5 mb-8">
              <span className="font-mono-eyebrow text-[11px] uppercase text-neutral-600">
                Here&apos;s your ticket
              </span>
            </div>
            <h2 className="text-4xl md:text-6xl font-semibold tracking-tight leading-[1.02] mb-12">
              90 minutes.{" "}
              <span className="accent-italic text-[#1D4ED8] font-normal">
                $29.
              </span>{" "}
              Walk out with a direction.
            </h2>

            <div className="rounded-3xl overflow-hidden border border-black/10 shadow-sm">
              {/* Stub header */}
              <div className="bg-[#1a1a1a] text-white px-6 md:px-8 py-4 flex items-center justify-between">
                <span className="font-mono-eyebrow text-[10px] uppercase text-neutral-300">
                  Admission · DARE Live №01
                </span>
                <span className="font-mono-eyebrow text-[10px] uppercase text-neutral-300">
                  DARE·26·S0001
                </span>
              </div>
              {/* Body */}
              <div className="bg-white px-6 md:px-8 py-8">
                <p className="text-4xl font-semibold tracking-tight">
                  D<span className="text-[#1D4ED8]">·</span>A
                  <span className="text-[#1D4ED8]">·</span>R
                  <span className="text-[#1D4ED8]">·</span>E
                  <span className="text-[#1D4ED8]">.</span>
                </p>
                <p className="mt-2 text-neutral-600">
                  A working session with John Iseghohi.{" "}
                  <span className="accent-italic text-[#1E40AF]">
                    Choose your direction. Map your four weeks.
                  </span>
                </p>

                <dl className="grid grid-cols-2 gap-y-6 mt-8 pt-8 border-t border-black/10">
                  <div>
                    <dt className="font-mono-eyebrow text-[10px] uppercase text-neutral-500">
                      Date
                    </dt>
                    <dd className="mt-1 font-semibold">[[DATE]]</dd>
                  </div>
                  <div>
                    <dt className="font-mono-eyebrow text-[10px] uppercase text-neutral-500">
                      Start
                    </dt>
                    <dd className="mt-1 font-semibold">
                      [[TIME]]{" "}
                      <span className="accent-italic text-neutral-500">
                        [[TZ]]
                      </span>
                    </dd>
                  </div>
                  <div>
                    <dt className="font-mono-eyebrow text-[10px] uppercase text-neutral-500">
                      Length
                    </dt>
                    <dd className="mt-1 font-semibold">90 min + Q&amp;A</dd>
                  </div>
                  <div>
                    <dt className="font-mono-eyebrow text-[10px] uppercase text-neutral-500">
                      Format
                    </dt>
                    <dd className="mt-1 font-semibold">Live on Zoom</dd>
                  </div>
                </dl>

                <div className="ticket-perf my-8"></div>

                <div className="flex items-center justify-between text-sm">
                  <span className="font-mono-eyebrow text-[10px] uppercase text-neutral-500">
                    What&apos;s included
                  </span>
                  <span className="font-mono-eyebrow text-[10px] uppercase text-neutral-500">
                    Value
                  </span>
                </div>
                <ul className="mt-3 space-y-2 text-sm">
                  <li className="flex justify-between">
                    <span>DARE Live Workshop</span>
                    <span className="font-semibold">$97</span>
                  </li>
                  <li className="flex justify-between">
                    <span>DARE Opportunity Canvas</span>
                    <span className="font-semibold">$47</span>
                  </li>
                  <li className="flex justify-between">
                    <span>Agent Blueprint Worksheet</span>
                    <span className="font-semibold">$67</span>
                  </li>
                  <li className="flex justify-between">
                    <span>4-Week DARE Plan template</span>
                    <span className="font-semibold">$147</span>
                  </li>
                  <li className="flex justify-between">
                    <span>Lifetime replay</span>
                    <span className="font-semibold">$47</span>
                  </li>
                  <li className="flex justify-between text-[#1E40AF]">
                    <span>Bonus · Agentic Founder Prompt Pack</span>
                    <span className="font-semibold">$97</span>
                  </li>
                  <li className="flex justify-between text-[#1E40AF]">
                    <span>Bonus · Founding Member Invite</span>
                    <span className="font-semibold">—</span>
                  </li>
                </ul>
              </div>
              {/* Stub footer */}
              <div className="bg-[#1a1a1a] text-white px-6 md:px-8 py-8 text-center">
                <span className="font-mono-eyebrow text-[10px] uppercase text-neutral-300 block mb-2">
                  One-time · Seat
                </span>
                <p className="text-5xl font-semibold tracking-tight">
                  <span className="text-[#A7C0F2]">$</span>29
                </p>
                <p className="font-mono-eyebrow text-[10px] uppercase text-neutral-300 mt-2">
                  <span className="line-through">$502</span> value · 2 bonuses
                  (live)
                </p>
                <p className="text-sm text-neutral-300 mt-3 mb-6">
                  One direction chosen live. A 4-week path to shipping and
                  earning from it.
                </p>
                <a
                  href="#seat"
                  className="group flex items-center justify-center gap-2 w-full rounded-xl bg-white text-[#1a1a1a] px-6 py-4 text-base font-semibold hover:bg-neutral-200 transition-all focus:outline-none focus:ring-2 focus:ring-white/40 active:scale-[0.99]"
                >
                  <span>Save my seat · $29</span>
                  <ArrowRight
                    size={18}
                    className="transition-transform group-hover:translate-x-0.5"
                    aria-hidden="true"
                  />
                </a>
                <p className="font-mono-eyebrow text-[9px] uppercase text-neutral-400 mt-5">
                  DARE·26·S0001 · Bring one idea
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ===================== TIMEZONES ===================== */}
        <section className="px-5 py-20 md:py-24 max-w-3xl mx-auto reveal-fade">
          <h2 className="text-4xl md:text-5xl font-semibold tracking-tight leading-[1.04] mb-6">
            Here&apos;s when it lands{" "}
            <span className="accent-italic text-[#1D4ED8] font-normal">
              where you are.
            </span>
          </h2>
          <p className="text-lg text-neutral-600 mb-10">
            DARE Live runs{" "}
            <strong className="font-semibold text-[#1a1a1a]">
              [[TIME]] [[TZ]]
            </strong>{" "}
            on [[DATE]]. Find your local time below. Can&apos;t make it live?
            The replay hits your inbox the same day.
          </p>
          {/* [[TZ_*]] swap in your audience's top regions (your newsletter analytics will tell you which) */}
          <div className="rounded-3xl border border-black/10 overflow-hidden divide-y divide-black/10">
            <div className="flex items-center justify-between px-6 py-5 bg-white">
              <div>
                <p className="font-mono-eyebrow text-[11px] uppercase text-[#1E40AF]">
                  New York
                </p>
                <p className="font-mono-eyebrow text-[10px] uppercase text-neutral-500 mt-1">
                  [[TZ_NYC_DATE]] · EDT
                </p>
              </div>
              <p className="text-3xl font-semibold tracking-tight">
                [[TZ_NYC_TIME]]
              </p>
            </div>
            <div className="flex items-center justify-between px-6 py-5 bg-white">
              <div>
                <p className="font-mono-eyebrow text-[11px] uppercase text-[#1E40AF]">
                  London
                </p>
                <p className="font-mono-eyebrow text-[10px] uppercase text-neutral-500 mt-1">
                  [[TZ_LON_DATE]] · BST
                </p>
              </div>
              <p className="text-3xl font-semibold tracking-tight">
                [[TZ_LON_TIME]]
              </p>
            </div>
            <div className="flex items-center justify-between px-6 py-5 bg-white">
              <div>
                <p className="font-mono-eyebrow text-[11px] uppercase text-[#1E40AF]">
                  Lagos
                </p>
                <p className="font-mono-eyebrow text-[10px] uppercase text-neutral-500 mt-1">
                  [[TZ_LAG_DATE]] · WAT
                </p>
              </div>
              <p className="text-3xl font-semibold tracking-tight">
                [[TZ_LAG_TIME]]
              </p>
            </div>
            <div className="flex items-center justify-between px-6 py-5 bg-white">
              <div>
                <p className="font-mono-eyebrow text-[11px] uppercase text-[#1E40AF]">
                  Los Angeles
                </p>
                <p className="font-mono-eyebrow text-[10px] uppercase text-neutral-500 mt-1">
                  [[TZ_LA_DATE]] · PDT
                </p>
              </div>
              <p className="text-3xl font-semibold tracking-tight">
                [[TZ_LA_TIME]]
              </p>
            </div>
          </div>
        </section>

        {/* ===================== MEET YOUR TEACHER ===================== */}
        <section className="px-5 py-20 md:py-28 max-w-3xl mx-auto">
          {/* Replace src with a real photo of John; alt describes him */}
          <img
            src="/image/og-image.png"
            alt="John Iseghohi, product designer and founder of Weekend MVP"
            className="w-full rounded-3xl object-cover aspect-[4/3] bg-[#f5f2ed] mb-10"
          />
          <h2 className="text-5xl font-semibold tracking-tight">
            John Iseghohi.
          </h2>
          <p className="font-mono-eyebrow text-[11px] uppercase text-[#1E40AF] mt-2">
            Product Designer · Founder, Weekend MVP
          </p>
          <div className="mt-8 space-y-5 text-lg text-neutral-700">
            <p>
              I&apos;m a product designer. For most of my career that meant
              making other people&apos;s products work — until I decided to
              find out whether design skill alone could carry a product of its
              own.
            </p>
            <p>
              It could. Without becoming an engineer, I&apos;ve built and
              shipped multiple AI-native products and agentic workflows solo —
              and broken down 78 more ideas in public at weekendmvp.app. Every
              one of them started the same way: one buyer, one workflow, one
              designed agentic flow.
            </p>
            <p>
              Watching other designers circle the same transition, I kept
              seeing the same three traps — and the same fix. Not more
              tutorials. A decision, made with a method. DARE is that method:
              the system I wish someone had handed me at the start, compressed
              into 90 minutes and applied to your idea, not a hypothetical
              one.
            </p>
            <p>
              And I&apos;m in this for the long haul: DARE is the first of
              several frameworks I&apos;m building for designers who want to
              become AI-native founders.
            </p>
          </div>
          <div className="mt-8 flex flex-wrap gap-3">
            <span className="rounded-full bg-[#f5f2ed] px-4 py-2 font-mono-eyebrow text-[10px] uppercase text-neutral-600">
              [[STAT_YEARS]] yrs designing products
            </span>
            <span className="rounded-full bg-[#f5f2ed] px-4 py-2 font-mono-eyebrow text-[10px] uppercase text-neutral-600">
              [[STAT_SHIPPED]] AI-native products shipped solo
            </span>
            <span className="rounded-full bg-[#f5f2ed] px-4 py-2 font-mono-eyebrow text-[10px] uppercase text-neutral-600">
              Frameworks: DARE — more coming
            </span>
          </div>
        </section>

        {/* ===================== SEAT / EMAIL CAPTURE ===================== */}
        <section
          id="seat"
          className="px-5 py-20 md:py-28 bg-[#1a1a1a] text-white scroll-mt-24"
        >
          <div className="max-w-xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 mb-6">
              <span
                className="w-1.5 h-1.5 rounded-full bg-[#1D4ED8] animate-pulse"
                aria-hidden="true"
              ></span>
              <span className="sr-only">Live:</span>
              <span className="font-mono-eyebrow text-[11px] uppercase text-neutral-300">
                Save your seat
              </span>
            </div>
            <h2 className="text-4xl md:text-5xl font-semibold tracking-tight">
              One workshop. One decision.{" "}
              <span className="accent-italic text-[#A7C0F2] font-normal">
                Four weeks of momentum.
              </span>
            </h2>
            <p className="mt-4 text-neutral-300">
              Grab your $29 seat. In 90 minutes you&apos;ll choose your
              direction and leave with your 4-week plan.
            </p>

            <DareSeatForm />
          </div>
        </section>
      </main>

      {/* ===================== STICKY CTA BAR ===================== */}
      <div className="fixed bottom-4 left-0 right-0 z-40 flex justify-center px-4 pointer-events-none">
        <div className="pointer-events-auto flex items-center justify-between gap-4 w-full max-w-2xl rounded-2xl bg-[#1a1a1a] text-white pl-5 pr-2 py-2 shadow-2xl border border-white/10">
          <div className="hidden sm:flex items-center gap-2 min-w-0">
            <StickyCountdownLabel
              deadline={WORKSHOP_DEADLINE}
              className="font-mono-eyebrow text-[11px] uppercase text-neutral-300 truncate"
            />
          </div>
          <a
            href="#seat"
            className="inline-flex items-center gap-2 rounded-xl bg-[#A7C0F2] text-[#1a1a1a] px-4 sm:px-5 py-3 text-xs sm:text-sm font-semibold hover:bg-[#bdd0f6] transition-all focus:outline-none focus:ring-2 focus:ring-white/40 active:scale-95 shrink-0 whitespace-nowrap"
          >
            Save my seat · $29
            <ArrowRight size={16} aria-hidden="true" />
          </a>
        </div>
      </div>
    </div>
  );
}
