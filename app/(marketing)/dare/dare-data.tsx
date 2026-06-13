/**
 * Static data for /dare (page.tsx hoists this so the page file stays
 * slim and is primarily section composition). Pure data and JSX
 * fragments only — no client state, no hooks.
 *
 * Draft pages ship a literal "[[WORKSHOP_DATE_ISO]]" deadline and other
 * [[PLACEHOLDER]] strings; those are preserved verbatim until the
 * workshop is launch-ready. See the orchestrator-owned page.tsx note.
 */

import * as React from "react";
import { ArrowRight } from "lucide-react";

import { eventSchema, breadcrumbSchema, buildGraph } from "@/lib/seo";

import type { WorkshopStatItem } from "@/components/marketing/workshop/WorkshopStats";
import type { WorkshopTldrItem } from "@/components/marketing/workshop/WorkshopTldr";
import type { WorkshopMoveItem } from "@/components/marketing/workshop/WorkshopMoves";
import type { WorkshopValueItem } from "@/components/marketing/workshop/WorkshopValueStack";
import type {
  WorkshopTicketDetail,
  WorkshopTicketLine,
} from "@/components/marketing/workshop/WorkshopTicket";
import type { WorkshopTimezoneRow } from "@/components/marketing/workshop/WorkshopTimezones";

export const WORKSHOP_DEADLINE = "[[WORKSHOP_DATE_ISO]]";

/* JSON-LD: Person + Event + Breadcrumb. The dare Person uses
   jobTitle "Founder, Weekend MVP" (different from the homepage's
   "Product Builder & MVP Specialist"), so we hand-build the Person
   member and compose it with the seo.ts helpers for Event + Breadcrumb. */

const DARE_PERSON = {
  "@type": "Person" as const,
  "@id": "https://www.weekendmvp.app/#person",
  name: "John Iseghohi",
  jobTitle: "Founder, Weekend MVP",
  url: "https://cal.com/switchtoux",
};

const DARE_EVENT = eventSchema({
  name: "DARE Live · Choose your AI product direction in 90 minutes",
  description:
    "A 90-minute live working session for experienced designers. Choose one concrete AI/agentic product or AI-powered service and leave with a 4-week plan to move it into the real world.",
  startDate: "[[WORKSHOP_DATE_ISO]]",
  url: "/dare",
  location: { name: "Zoom", url: "https://www.weekendmvp.app/dare" },
  offers: {
    price: "29",
    priceCurrency: "USD",
    availability: "https://schema.org/InStock",
  },
});

export const SCHEMA = buildGraph(
  DARE_PERSON,
  DARE_EVENT,
  breadcrumbSchema([
    { label: "Home", href: "/" },
    { label: "DARE Live Workshop", href: "/dare" },
  ]),
);

export const STATS: WorkshopStatItem[] = [
  {
    value: "[[STAT_YEARS]]",
    suffix: " yrs",
    label: "Designing products professionally",
    revealClass: "reveal-fade",
  },
  {
    value: "[[STAT_SHIPPED]]",
    suffix: " shipped",
    label: <>AI-native products &amp; agentic workflows, built solo</>,
    revealClass: "reveal-fade",
  },
  {
    value: "78",
    suffix: " broken down",
    label: <>AI &amp; SaaS ideas analyzed at weekendmvp.app</>,
    revealClass: "reveal-fade",
  },
  {
    value: "1",
    suffix: " framework",
    label: "DARE, taught live · more coming",
    revealClass: "reveal-fade",
  },
];

export const TLDR_ITEMS: WorkshopTldrItem[] = [
  {
    lead: <>It&apos;s $29, one-time.</>,
    rest: <>A working session, not a course.</>,
  },
  {
    lead: <>It&apos;s 90 minutes live</>,
    rest: <>on [[DATE]], [[TIME]] [[TZ]], on Zoom — with Q&amp;A after.</>,
  },
  {
    lead: <>It&apos;s for experienced designers,</>,
    rest: <>design-leaning PMs, and semi-technical builders. No engineering required.</>,
  },
  {
    lead: <>You leave with one direction and a 4-week plan</>,
    rest: (
      <>
        — a tiny agentic SaaS or an AI-powered productized service, chosen and
        mapped.
      </>
    ),
  },
  {
    lead: <>Can&apos;t make it live? Replay included,</>,
    rest: <>same day, yours forever.</>,
  },
  {
    lead: <>It&apos;s the front door, not the whole house.</>,
    rest: (
      <>
        DARE Live stands alone — and live attendees get first access when the
        deeper DARE program opens.
      </>
    ),
  },
];

export const MOVES: WorkshopMoveItem[] = [
  {
    glyph: "D",
    glyphColorClass: "text-[#C9D8F7]",
    glyphAriaHidden: true,
    glyphExtraClass: "w-24",
    heading: (
      <>
        Discover.{" "}
        <span className="accent-italic text-[#1D4ED8] font-normal">
          One buyer, one painful workflow.
        </span>
      </>
    ),
    body: (
      <>
        You already know how to find the real problem under a vague brief —
        you&apos;ve done it in every discovery call of your career. We aim that
        skill at the AI landscape and cut your idea cloud down to one specific
        person, one workflow, one why-now. Written down.
      </>
    ),
    time: "~25 min",
    timeColorClass: "text-neutral-500",
  },
  {
    glyph: "A",
    glyphColorClass: "text-[#C9D8F7]",
    glyphAriaHidden: true,
    glyphExtraClass: "w-24",
    heading: (
      <>
        Architect.{" "}
        <span className="accent-italic text-[#1D4ED8] font-normal">
          This is where designers win.
        </span>
      </>
    ),
    body: (
      <>
        Anyone can call an API. Almost nobody can design where the agent acts,
        where the human stays in control, and why anyone would trust it —
        that&apos;s interaction design, and it&apos;s the scarcest skill in AI
        products right now. You&apos;ll map your workflow into an Agent
        Blueprint: a simple agentic flow a real person would love to use.
      </>
    ),
    time: "~35 min",
    timeColorClass: "text-neutral-500",
  },
  {
    glyph: "R+E",
    glyphColorClass: "text-[#C9D8F7]",
    glyphAriaHidden: true,
    glyphExtraClass: "w-24",
    heading: (
      <>
        Run + Earn.{" "}
        <span className="accent-italic text-[#1D4ED8] font-normal">
          The scrappy v1, and the honest ask.
        </span>
      </>
    ),
    body: (
      <>
        We scope the smallest real version — live prototype, tiny SaaS, or
        repeatable service workflow — then turn it into a concrete offer with a
        price and the exact words to ask for money without cringing. Both land
        in your 4-week plan: run in weeks 1–3, earn in week 4.
      </>
    ),
    time: "~30 min",
    timeColorClass: "text-neutral-500",
  },
];

export const VALUE_STACK: WorkshopValueItem[] = [
  {
    number: "01",
    title: <h3 className="text-lg font-semibold">DARE Live Workshop</h3>,
    body: (
      <>
        90-minute working session with John on Zoom. Bring one idea — or none.
        Discover handles that.
      </>
    ),
    value: "$97 value",
    border: true,
  },
  {
    number: "02",
    title: (
      <h3 className="text-lg font-semibold">
        DARE{" "}
        <span className="accent-italic text-neutral-500 font-normal">
          Opportunity Canvas
        </span>
      </h3>
    ),
    body: (
      <>
        The Discover worksheet: buyer, workflow, pain, why-now. You fill it in
        live.
      </>
    ),
    value: "$47 value",
    border: true,
  },
  {
    number: "03",
    title: (
      <h3 className="text-lg font-semibold">
        Agent{" "}
        <span className="accent-italic text-neutral-500 font-normal">
          Blueprint Worksheet
        </span>
      </h3>
    ),
    body: (
      <>
        The Architect tool: map the flow, place the agent, design the
        human-in-the-loop guardrails.
      </>
    ),
    value: "$67 value",
    border: true,
  },
  {
    number: "04",
    title: <h3 className="text-lg font-semibold">4-Week DARE Plan template</h3>,
    body: (
      <>
        Your direction, sequenced one concrete move per week — from blueprint to
        first revenue or real market signal.
      </>
    ),
    value: "$147 value",
    border: true,
  },
  {
    number: "05",
    title: <h3 className="text-lg font-semibold">Lifetime replay</h3>,
    body: <>Full recording, yours forever. Rewatch the move you&apos;re on.</>,
    value: "$47 value",
    border: true,
  },
  {
    number: "06",
    title: (
      <h3 className="text-lg font-semibold">
        Agentic Founder{" "}
        <span className="accent-italic text-neutral-500 font-normal">
          Prompt Pack
        </span>
      </h3>
    ),
    body: (
      <>
        The prompts that take your Agent Blueprint to a working v1 with
        today&apos;s tools — no engineering detour.
      </>
    ),
    value: "$97 value",
    bonus: true,
    creamRow: true,
    border: true,
  },
  {
    number: "07",
    title: (
      <h3 className="text-lg font-semibold">
        Founding Member{" "}
        <span className="accent-italic text-neutral-500 font-normal">
          Invite
        </span>
      </h3>
    ),
    body: <>First access and founding pricing when the full DARE program opens.</>,
    bonus: true,
    creamRow: true,
    border: false,
  },
];

export const TICKET_DETAILS: WorkshopTicketDetail[] = [
  { label: "Date", value: "[[DATE]]" },
  {
    label: "Start",
    value: (
      <>
        [[TIME]] <span className="accent-italic text-neutral-500">[[TZ]]</span>
      </>
    ),
  },
  { label: "Length", value: <>90 min + Q&amp;A</> },
  { label: "Format", value: "Live on Zoom" },
];

export const TICKET_LINES: WorkshopTicketLine[] = [
  { label: "DARE Live Workshop", value: "$97" },
  { label: "DARE Opportunity Canvas", value: "$47" },
  { label: "Agent Blueprint Worksheet", value: "$67" },
  { label: "4-Week DARE Plan template", value: "$147" },
  { label: "Lifetime replay", value: "$47" },
  {
    label: "Bonus · Agentic Founder Prompt Pack",
    value: "$97",
    rowColorClass: "text-[#1E40AF]",
  },
  {
    label: "Bonus · Founding Member Invite",
    value: "—",
    rowColorClass: "text-[#1E40AF]",
  },
];

export const TIMEZONES: WorkshopTimezoneRow[] = [
  { city: "New York", date: "[[TZ_NYC_DATE]] · EDT", time: "[[TZ_NYC_TIME]]" },
  { city: "London", date: "[[TZ_LON_DATE]] · BST", time: "[[TZ_LON_TIME]]" },
  { city: "Lagos", date: "[[TZ_LAG_DATE]] · WAT", time: "[[TZ_LAG_TIME]]" },
  {
    city: "Los Angeles",
    date: "[[TZ_LA_DATE]] · PDT",
    time: "[[TZ_LA_TIME]]",
  },
];

export const TEACHER_CHIPS: React.ReactNode[] = [
  "[[STAT_YEARS]] yrs designing products",
  "[[STAT_SHIPPED]] AI-native products shipped solo",
  "Frameworks: DARE — more coming",
];

/* ============================================================
 * Page-specific JSX (hero, deliverable teaser, proof, seat capture).
 * ============================================================ */

export function DareHero() {
  return (
    // DARE accent system: ink blue. #1D4ED8 large/accent text · #1E40AF
    // small text (WCAG AA on cream) · #A7C0F2 on dark
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
        A 90-minute live working session for experienced designers. You&apos;ll
        choose{" "}
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
          Live on Zoom · Replay included · No engineering background required.
        </p>
      </div>
    </section>
  );
}

export function DareDeliverableTeaser() {
  return (
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
            During the session you&apos;ll fill in the DARE worksheets live. By
            the end, they become your 4-Week DARE Plan: one product or one
            service, one clear path — your chosen direction broken into one
            concrete move per week.
          </p>
        </div>
      </div>
    </section>
  );
}

export function DareProblemBody() {
  return (
    <>
      <p>
        You&apos;ve been paying attention. You&apos;ve used the tools. You can
        see, more clearly than most engineers, where AI actually fits a real
        person&apos;s workflow.
      </p>
      <p>And yet nothing&apos;s moving. Three traps, usually:</p>
      <ul className="space-y-4">
        <li className="flex gap-4">
          <span
            className="mt-3 h-px w-6 bg-[#1D4ED8] shrink-0"
            aria-hidden="true"
          ></span>
          <span>
            <strong className="font-semibold">The engineer myth.</strong>{" "}
            &quot;I need to get technical first.&quot; So you collect tutorials
            instead of making a decision.
          </span>
        </li>
        <li className="flex gap-4">
          <span
            className="mt-3 h-px w-6 bg-[#1D4ED8] shrink-0"
            aria-hidden="true"
          ></span>
          <span>
            <strong className="font-semibold">The big-idea trap.</strong> Every
            idea you take seriously feels like it needs a team and a roadmap. So
            you take none of them seriously.
          </span>
        </li>
        <li className="flex gap-4">
          <span
            className="mt-3 h-px w-6 bg-[#1D4ED8] shrink-0"
            aria-hidden="true"
          ></span>
          <span>
            <strong className="font-semibold">The model maze.</strong> SaaS?
            Service? Agency? You&apos;re trying to pick the perfect vehicle
            before you&apos;ve picked the problem.
          </span>
        </li>
      </ul>
      <p>
        <span className="accent-italic text-[#1a1a1a]">
          The hard part of AI products is design judgment — which you already
          have. What you&apos;re missing isn&apos;t knowledge. It&apos;s a
          path.
        </span>
      </p>
      <p>DARE is that path, walked in 90 minutes.</p>
    </>
  );
}

export function DareProof() {
  return (
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
          &quot;A done-for-you client-onboarding agent for B2B design studios —{" "}
          <span className="accent-italic text-[#A7C0F2] font-normal">
            sold as a productized service, first three conversations booked in
            week 4.
          </span>
          &quot;
        </p>
        <p className="mt-8 pt-6 border-t border-white/10 text-neutral-300 leading-relaxed max-w-2xl">
          That&apos;s the shape of the shift: from a category to a buyer, from a
          vibe to an offer, from someday to a dated plan.
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
            &quot;A competitor-watch agent for boutique brand strategists —
            $19/mo, waitlist live in week 1.&quot;
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
            &quot;A fixed-scope &apos;agent-ready UX audit&apos; for seed-stage
            SaaS teams — $1.5k flat, pitched to five founders in week 2.&quot;
          </p>
        </div>
      </div>
    </section>
  );
}

export const TEACHER_PICTURE_DARE = (
  // Replace src with a real photo of John; alt describes him
  <img
    src="/image/og-image.png"
    alt="John Iseghohi, product designer and founder of Weekend MVP"
    className="w-full rounded-3xl object-cover aspect-[4/3] bg-[#f5f2ed] mb-10"
  />
);

export const TEACHER_BODY_DARE = (
  <>
    <p>
      I&apos;m a product designer. For most of my career that meant making other
      people&apos;s products work — until I decided to find out whether design
      skill alone could carry a product of its own.
    </p>
    <p>
      It could. Without becoming an engineer, I&apos;ve built and shipped
      multiple AI-native products and agentic workflows solo — and broken down
      78 more ideas in public at weekendmvp.app. Every one of them started the
      same way: one buyer, one workflow, one designed agentic flow.
    </p>
    <p>
      Watching other designers circle the same transition, I kept seeing the
      same three traps — and the same fix. Not more tutorials. A decision, made
      with a method. DARE is that method: the system I wish someone had handed
      me at the start, compressed into 90 minutes and applied to your idea, not
      a hypothetical one.
    </p>
    <p>
      And I&apos;m in this for the long haul: DARE is the first of several
      frameworks I&apos;m building for designers who want to become AI-native
      founders.
    </p>
  </>
);

export function DareSeatSection({ formSlot }: { formSlot: React.ReactNode }) {
  return (
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
          Grab your $29 seat. In 90 minutes you&apos;ll choose your direction
          and leave with your 4-week plan.
        </p>

        {formSlot}
      </div>
    </section>
  );
}
