/**
 * Static data for /shipable (page.tsx hoists this so the page file stays
 * slim and is primarily section composition). Pure data and JSX fragments
 * only — no client state, no hooks.
 */

import * as React from "react";
import { ArrowRight } from "lucide-react";

import {
  eventSchema,
  faqPageSchema,
  breadcrumbSchema,
  buildGraph,
  type FaqEntry,
} from "@/lib/seo";

import type { WorkshopStatItem } from "@/components/marketing/workshop/WorkshopStats";
import type { WorkshopTldrItem } from "@/components/marketing/workshop/WorkshopTldr";
import type { WorkshopMoveItem } from "@/components/marketing/workshop/WorkshopMoves";
import type { WorkshopValueItem } from "@/components/marketing/workshop/WorkshopValueStack";
import type {
  WorkshopTicketDetail,
  WorkshopTicketLine,
} from "@/components/marketing/workshop/WorkshopTicket";
import type { WorkshopTimezoneRow } from "@/components/marketing/workshop/WorkshopTimezones";

export const WORKSHOP_DEADLINE = "2026-06-27T12:00:00+01:00";

/* JSON-LD: Person + Organization + Event + FAQPage + Breadcrumb (SEO + AEO).
   Person/Organization carry workshop-specific fields (jobTitle "Founder,
   Weekend MVP", sameAs arrays, logos, portrait image) so we hand-build
   those two members and compose them with the seo.ts helpers for
   Event/FAQ/Breadcrumb. */

const SHIPABLE_PERSON = {
  "@type": "Person" as const,
  "@id": "https://weekendmvp.app/#person",
  name: "John Iseghohi",
  jobTitle: "Founder, Weekend MVP",
  url: "https://cal.com/switchtoux",
  image: "https://weekendmvp.app/image/john-portrait.jpg",
  sameAs: ["https://twitter.com/weekendmvp", "https://cal.com/switchtoux"],
};

const SHIPABLE_ORG = {
  "@type": "Organization" as const,
  "@id": "https://weekendmvp.app/#org",
  name: "Weekend MVP",
  url: "https://weekendmvp.app/",
  logo: "https://weekendmvp.app/image/weekendmvp-logo.svg",
  founder: { "@id": "https://weekendmvp.app/#person" },
  sameAs: ["https://twitter.com/weekendmvp"],
};

export const FAQS: FaqEntry[] = [
  {
    question: "What is the ship·able workshop?",
    answer:
      "ship·able is a 90-minute live workshop where you turn the idea you've been sitting on into a real, deployed MVP with a live URL by the end of the call. $9, live on Zoom, full replay included.",
  },
  {
    question: "When is the ship·able workshop?",
    answer:
      "Saturday June 27, 2026 at 12:00 PM BST (7:00 AM EDT, 4:00 AM PDT, 12:00 PM WAT). Live on Zoom. If you can't make it live, you get the full lifetime replay.",
  },
  {
    question: "How much does the workshop cost?",
    answer:
      "$9 one-time. Includes the 90-minute live build, lifetime replay, the Ship Sheet worksheet, the 48-Hour Build Plan, and (live-only) the AI MVP Builder plus the Weekend MVP Starter Kit. Total stack value: $738.",
  },
  {
    question: "Do I need to know how to code to attend?",
    answer:
      "No. The workshop is built for non-technical founders. We use AI tools to build and deploy the MVP live on the call, so you walk out with a real shareable URL even if you've never written code.",
  },
  {
    question: "What do I walk away with at the end?",
    answer:
      "A live, shareable URL for your MVP, a finished 48-hour build plan you can complete that weekend, and a way to capture your first users. Past attendees have shipped MVPs in 90 minutes and gotten paying users within days.",
  },
  {
    question: "What if I can't attend live on Zoom?",
    answer:
      "You get the full lifetime replay. Note: the two bonuses (AI MVP Builder and Weekend MVP Starter Kit) are live-only, so attending live is recommended.",
  },
  {
    question: "Who is hosting the workshop?",
    answer:
      "John Iseghohi, founder of Weekend MVP. He runs a community of 400+ weekend builders and has broken down 78 startup ideas on weekendmvp.app.",
  },
];

const SHIPABLE_EVENT = {
  ...eventSchema({
    name: "ship·able · Build your MVP live in 90 minutes",
    description:
      "A 90-minute live workshop where you turn the idea you've been sitting on into a real, deployed MVP with a live URL. Non-technical welcome, built with AI tools. Includes the Ship Sheet, 48-hour build plan, AI MVP Builder, and the Weekend MVP Starter Kit.",
    startDate: "2026-06-27T12:00:00+01:00",
    endDate: "2026-06-27T14:00:00+01:00",
    url: "/shipable",
    location: {
      name: "Zoom",
      url: "https://weekendmvp.app/shipable",
    },
    offers: {
      price: "9",
      priceCurrency: "USD",
      availability: "https://schema.org/InStock",
    },
  }),
  "@id": "https://weekendmvp.app/shipable#event",
  image: [
    "https://weekendmvp.app/image/hero-cover-desktop.jpg",
    "https://weekendmvp.app/image/og-image.png",
  ],
  inLanguage: "en",
  isAccessibleForFree: false,
  maximumAttendeeCapacity: 100,
  organizer: { "@id": "https://weekendmvp.app/#org" },
  performer: { "@id": "https://weekendmvp.app/#person" },
};

export const SCHEMA = buildGraph(
  SHIPABLE_PERSON,
  SHIPABLE_ORG,
  SHIPABLE_EVENT,
  faqPageSchema(FAQS),
  breadcrumbSchema([
    { label: "Home", href: "/" },
    { label: "ship·able Workshop", href: "/shipable" },
  ]),
);

export const STATS: WorkshopStatItem[] = [
  { value: "10", suffix: " shipped", label: "MVPs launched by builders" },
  { value: "400", suffix: "+", label: "Weekend builders" },
  { value: "8", suffix: " hrs", label: "Average idea → live" },
  { value: "78", suffix: " ideas", label: "Broken down on the site" },
];

export const TLDR_ITEMS: WorkshopTldrItem[] = [
  {
    lead: <>It&apos;s $9.</>,
    rest: (
      <>
        One-time. Less than your weekend coffee run, and you walk out with a live
        MVP.
      </>
    ),
  },
  {
    lead: <>It&apos;s a 90-minute live workshop</>,
    rest: (
      <>
        on Sat, Jun 27, 12:00 PM BST, on Zoom. Can&apos;t make it live? You get
        the full replay.
      </>
    ),
  },
  {
    lead: <>It&apos;s for anyone with an idea they haven&apos;t shipped.</>,
    rest: (
      <>Non-technical totally welcome. We build with AI tools, no code required.</>
    ),
  },
  {
    lead: <>You walk out with a live, shareable URL</>,
    rest: <>plus a locked 48-hour build plan you can finish this weekend.</>,
  },
  {
    lead: <>It works for any idea:</>,
    rest: (
      <>
        SaaS, a tool, a marketplace, a side project. We&apos;ve broken down 78 of
        them.
      </>
    ),
  },
  {
    lead: <>Live attendees get 2 bonuses:</>,
    rest: (
      <>
        the AI MVP Builder + the Weekend MVP Starter Kit. Combined value{" "}
        <strong className="font-semibold text-[#1a1a1a]">$348</strong>.
      </>
    ),
  },
];

export const MOVES: WorkshopMoveItem[] = [
  {
    glyph: "01",
    glyphColorClass: "text-neutral-200",
    heading: (
      <>
        Your{" "}
        <span className="accent-italic text-[#CC5500] font-normal">sharpest</span>{" "}
        idea
      </>
    ),
    body: (
      <>
        One buyer, one painful problem. We cut your idea down from &quot;cool
        concept&quot; to the one specific thing one specific person will use on
        day one.
      </>
    ),
    time: "~25 min",
    timeColorClass: "text-neutral-700",
  },
  {
    glyph: "02",
    glyphColorClass: "text-neutral-200",
    heading: (
      <>
        Your{" "}
        <span className="accent-italic text-[#CC5500] font-normal">weekend</span>{" "}
        cut
      </>
    ),
    body: (
      <>
        The smallest version you can actually ship by Sunday. Not the dream app.
        The one screen that proves it. We scope it so it fits in a weekend, not
        a quarter.
      </>
    ),
    time: "~30 min",
    timeColorClass: "text-neutral-700",
  },
  {
    glyph: "03",
    glyphColorClass: "text-neutral-200",
    heading: (
      <>
        Your{" "}
        <span className="accent-italic text-[#CC5500] font-normal">live</span>{" "}
        launch page
      </>
    ),
    body: (
      <>
        Built live with AI: a deployed page with a real URL and a way to capture
        your first users, so you&apos;re validating demand before you sink a
        weekend into building.
      </>
    ),
    time: "~35 min",
    timeColorClass: "text-neutral-700",
  },
];

export const VALUE_STACK: WorkshopValueItem[] = [
  {
    number: "01",
    title: (
      <h3 className="text-lg font-semibold text-[#0a0a0a]">
        90-minute live build workshop
      </h3>
    ),
    body: "Working session with John on Zoom. Bring your laptop and the Ship Sheet.",
    value: "$97 value",
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
    border: true,
  },
  {
    number: "03",
    title: <h3 className="text-lg font-semibold text-[#0a0a0a]">Lifetime replay</h3>,
    body: "Can't make it live? Full recording, yours forever. Rewatch the parts you need.",
    value: "$47 value",
    border: true,
  },
  {
    number: "04",
    title: (
      <h3 className="text-lg font-semibold text-[#0a0a0a]">48-Hour Build Plan</h3>
    ),
    body: "Your exact idea, scoped and sequenced to ship by Sunday night.",
    value: "$199 value",
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

export const TICKET_DETAILS: WorkshopTicketDetail[] = [
  { label: "Date", value: "Sat, Jun 27" },
  {
    label: "Start",
    value: (
      <>
        12:00 PM <span className="accent-italic text-neutral-700">BST</span>
      </>
    ),
  },
  { label: "Length", value: <>90 min + Q&amp;A</> },
  { label: "Format", value: "Live on Zoom" },
];

export const TICKET_LINES: WorkshopTicketLine[] = [
  { label: "Live workshop", value: "$97" },
  { label: "Ship Sheet worksheet", value: "$47" },
  { label: "Lifetime replay", value: "$47" },
  { label: "48-Hour Build Plan", value: "$199" },
  {
    label: "Bonus · AI MVP Builder",
    value: "$199",
    rowColorClass: "text-[#A03D00]",
  },
  {
    label: "Bonus · Starter Kit",
    value: "$149",
    rowColorClass: "text-[#A03D00]",
  },
];

export const TIMEZONES: WorkshopTimezoneRow[] = [
  { city: "New York", date: "Sat Jun 27 · EDT", time: "7:00 AM" },
  { city: "London", date: "Sat Jun 27 · BST", time: "12:00 PM" },
  { city: "Lagos", date: "Sat Jun 27 · WAT", time: "12:00 PM" },
  { city: "Los Angeles", date: "Sat Jun 27 · PDT", time: "4:00 AM" },
];

export const TEACHER_CHIPS: React.ReactNode[] = [
  "400+ builders",
  "78 ideas broken down",
  "New ideas daily at weekendmvp.app",
];

/* ============================================================
 * Page-specific section JSX (hero, deliverable teaser, proof,
 * teacher portrait). Kept here so the page composition file
 * stays focused on section ordering, not raw markup.
 * ============================================================ */

export function ShipableHero() {
  return (
    <section className="relative overflow-hidden isolate bg-[#0a0a0a]">
      <picture>
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
            In this 90-minute live workshop you&apos;ll turn the idea you&apos;ve
            been sitting on into{" "}
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
              <span className="h-5 w-px bg-[#1a1a1a]/20" aria-hidden="true"></span>
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
  );
}

export function ShipableDeliverableTeaser() {
  return (
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
            It becomes your finished 48-hour build plan, plus a live URL, by the
            end of the call.
          </p>
        </div>
      </div>
    </section>
  );
}

export function ShipableProblemBody() {
  return (
    <>
      <p>
        I&apos;ve watched thousands of would-be builders, and the #1 thing
        keeping them stuck isn&apos;t talent or time. It&apos;s that they never
        ship.
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
            they keep researching, tweaking, and talking about, but never build.
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
            rotting in a folder because they scoped it way too big to ever
            finish.
          </span>
        </li>
      </ul>
      <p className="text-neutral-700">
        Either way, real people have never touched it.
      </p>
      <p>
        All you need to change that is{" "}
        <span className="accent-italic text-[#1a1a1a]">
          one small thing, live, that someone can actually use this weekend.
        </span>{" "}
        That&apos;s what we build in ship·able.
      </p>
    </>
  );
}

export function ShipableProof() {
  return (
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
          Walked in with a vague idea and walked out with a live URL. By Monday
          morning I had 14 real signups from people who actually wanted what
          I&apos;d been describing to friends for almost a year.
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
            &quot;The Ship Sheet did what every productivity book hadn&apos;t. I
            stopped polishing and just shipped the one screen that mattered.&quot;
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
            &quot;Scoped down to one tiny thing I could actually finish. Posted
            the URL on Sunday, first paying user emailed by Wednesday.&quot;
          </p>
          <footer className="mt-4 font-mono-eyebrow text-[10px] uppercase text-neutral-700">
            Priya Shah
          </footer>
        </blockquote>
      </div>
    </section>
  );
}

export const TEACHER_PICTURE = (
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
);

export const TEACHER_BODY = (
  <>
    <p>
      I&apos;ve watched people who were sure they needed more time, a
      co-founder, or to &quot;learn to code first&quot; come in, change almost
      nothing, scope one tiny version of what they already had, and ship it in a
      weekend. Then get their first real users for the first time ever.
    </p>
    <p>The workshop is the 90-minute version of how we start that.</p>
  </>
);
