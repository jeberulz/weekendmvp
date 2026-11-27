import type { ReactNode } from "react";
import { ArrowRight } from "lucide-react";
import { SITE, breadcrumbSchema, buildGraph, eventSchema, organizationSchema, personSchema } from "@/lib/seo";
import { DURATION_MINUTES, IDEAS, PRICE_USD, WORKSHOP_DEADLINE, dareText, includes, usd } from "@/lib/landing/dare-offer";
import type { DareBlock, DareCopy } from "@/lib/landing/read-dare";
import type { WorkshopStatItem } from "@/components/marketing/workshop/WorkshopStats";
import type { WorkshopTldrItem } from "@/components/marketing/workshop/WorkshopTldr";
import type { WorkshopMoveItem } from "@/components/marketing/workshop/WorkshopMoves";
import type { WorkshopValueItem } from "@/components/marketing/workshop/WorkshopValueStack";
import type {
  WorkshopTicketDetail,
  WorkshopTicketLine,
} from "@/components/marketing/workshop/WorkshopTicket";
import type { WorkshopTimezoneRow } from "@/components/marketing/workshop/WorkshopTimezones";

const DARE_EVENT = eventSchema({
  name: "DARE Live · Choose your AI product direction in 90 minutes",
  description:
    "A 90-minute live working session for experienced designers. Choose one concrete AI/agentic product or AI-powered service and leave with a 4-week plan to move it into the real world.",
  startDate: WORKSHOP_DEADLINE,
  url: "/dare",
  location: { name: "Zoom", url: `${SITE}/dare` },
  offers: {
    price: String(PRICE_USD),
    priceCurrency: "USD",
    availability: "https://schema.org/InStock",
  },
});

export const SCHEMA = buildGraph(
  personSchema(),
  organizationSchema(),
  DARE_EVENT,
  breadcrumbSchema([
    { label: "Home", href: "/" },
    { label: "DARE Live Workshop", href: "/dare" },
  ]),
);

export function dareStats(copy: DareBlock<"stats">): WorkshopStatItem[] {
  return [
    { value: "[[STAT_YEARS]]", suffix: " yrs", label: copy.years },
    { value: "[[STAT_SHIPPED]]", suffix: " shipped", label: copy.shipped },
    { value: String(IDEAS), suffix: " broken down", label: copy.ideas },
    { value: "1", suffix: " framework", label: copy.framework },
  ].map((item) => ({ ...item, revealClass: "reveal-fade" }));
}

export function dareSummary(copy: DareBlock<"tldr">): WorkshopTldrItem[] {
  return copy.points.map(({ lead, body }) => ({ lead: dareText(lead), rest: dareText(body) }));
}

export function dareMoves(copy: DareBlock<"moves">): WorkshopMoveItem[] {
  return ([
    [copy.discover, "D", "~25 min"],
    [copy.architect, "A", "~35 min"],
    [copy.runEarn, "R+E", "~30 min"],
  ] as const).map(([move, glyph, time]) => ({
    glyph,
    glyphColorClass: "text-[#C9D8F7]",
    glyphAriaHidden: true,
    glyphExtraClass: "w-24",
    heading: <DareHeading title={move.title} accent={move.accent} />,
    body: move.body,
    time,
    timeColorClass: "text-neutral-500",
  }));
}

export function DareHeading({ title, accent }: { title: string; accent: string }) {
  return (
    <>
      {dareText(title)}{" "}
      <span className="accent-italic text-[#1D4ED8] font-normal">{dareText(accent)}</span>
    </>
  );
}

export function dareValueStack(copy: DareBlock<"valueStack">): WorkshopValueItem[] {
  return includes.map(({ key, amount, bonus }, index) => {
    const { title, accent, body } = copy[key];
    return {
      number: String(index + 1).padStart(2, "0"),
      title: (
        <h3 className="text-lg font-semibold">
          {title}
          {accent ? (
            <>
              {" "}
              <span className="accent-italic text-neutral-500 font-normal">{accent}</span>
            </>
          ) : null}
        </h3>
      ),
      body: dareText(body),
      value: amount === null ? undefined : `${usd(amount)} value`,
      bonus,
      creamRow: bonus,
      border: index < includes.length - 1,
    };
  });
}

export function dareTicketDetails(copy: DareCopy["ticket"]): WorkshopTicketDetail[] {
  return [
    { label: copy.dateLabel, value: "[[DATE]]" },
    {
      label: copy.startLabel,
      value: <>[[TIME]] <span className="accent-italic text-neutral-500">[[TZ]]</span></>,
    },
    { label: copy.lengthLabel, value: `${DURATION_MINUTES} min + Q&A` },
    { label: copy.formatLabel, value: "Live on Zoom" },
  ];
}

export function dareTicketLines(copy: DareBlock<"valueStack">): WorkshopTicketLine[] {
  return includes.map(({ key, amount, bonus }) => ({
    label: copy[key].ticketLabel,
    value: amount === null ? "—" : usd(amount),
    rowColorClass: bonus ? "text-[#1E40AF]" : undefined,
  }));
}

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

export function DareHero({ copy }: { copy: DareCopy["hero"] }) {
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
          {copy.eyebrow}
        </span>
      </div>

      <h1 className="text-[17vw] leading-[0.9] md:text-[7.5rem] font-semibold tracking-tight text-[#1a1a1a]">
        D<span className="text-[#1D4ED8]">·</span>A
        <span className="text-[#1D4ED8]">·</span>R
        <span className="text-[#1D4ED8]">·</span>E
        <span className="text-[#1D4ED8]">.</span>
      </h1>
      <p className="mt-4 font-mono-eyebrow text-[10px] md:text-xs uppercase text-[#1E40AF]">
        {copy.tagline}
      </p>

      <p className="mt-8 max-w-2xl text-xl md:text-2xl leading-snug text-neutral-700">
        {dareText(copy.intro)}{" "}
        <span className="accent-italic text-[#1D4ED8]">
          {copy.accent}
        </span>{" "}
        {copy.ending}
      </p>

      <div className="mt-10 flex flex-col sm:flex-row items-start sm:items-center gap-5">
        <a
          href="#seat"
          className="group inline-flex items-center gap-3 rounded-2xl bg-[#1a1a1a] pl-7 pr-5 py-4 text-base font-semibold text-white hover:bg-black transition-all focus:outline-none focus:ring-2 focus:ring-black/30 focus:ring-offset-2 focus:ring-offset-[#fcfaf7] active:scale-[0.98]"
        >
          <span>Save my seat</span>
          <span className="h-5 w-px bg-white/25" aria-hidden="true"></span>
          <span className="text-[#A7C0F2]">{usd(PRICE_USD)}</span>
          <ArrowRight
            size={18}
            className="transition-transform group-hover:translate-x-0.5"
            aria-hidden="true"
          />
        </a>
        <p className="text-sm text-neutral-500">
          {copy.note}
        </p>
      </div>
    </section>
  );
}

export function DareDeliverableTeaser({ copy }: { copy: DareBlock<"deliverableTeaser"> }) {
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
            {copy.eyebrow}
          </span>
          <h2 className="mt-3 text-3xl md:text-4xl font-semibold tracking-tight">
            {copy.title}
          </h2>
          <p className="mt-3 text-lg text-neutral-600 max-w-xl">
            {copy.body}
          </p>
        </div>
      </div>
    </section>
  );
}

export function DareProblemBody({ copy }: { copy: DareBlock<"problem"> }) {
  return (
    <>
      <p>{copy.intro}</p>
      <p>{copy.setup}</p>
      <ul className="space-y-4">
        {copy.traps.map(({ lead, body }, index) => (
          <li key={index} className="flex gap-4">
            <span className="mt-3 h-px w-6 bg-[#1D4ED8] shrink-0" aria-hidden="true"></span>
            <span>
              <strong className="font-semibold">{lead}</strong>{" "}
              {body}
            </span>
          </li>
        ))}
      </ul>
      <p><span className="accent-italic text-[#1a1a1a]">{copy.pitch}</span></p>
      <p>{dareText(copy.ending)}</p>
    </>
  );
}

export function DareProof({ copy }: { copy: DareBlock<"proof"> }) {
  return (
    <section className="px-5 py-20 md:py-28 max-w-4xl mx-auto">
      <h2 className="text-4xl md:text-6xl font-semibold tracking-tight leading-[1.02] mb-12">
        {copy.title}{" "}
        <span className="accent-italic text-[#1D4ED8] font-normal">
          {dareText(copy.accent)}
        </span>
      </h2>

      {/* These are worked outcome EXAMPLES, clearly labeled — swap in real
          Before→After alumni quotes after the first session runs. */}
      <div className="rounded-3xl bg-[#1a1a1a] text-white p-8 md:p-10 mb-6 reveal-fade">
        <span className="font-mono-eyebrow text-[10px] uppercase text-neutral-300">
          {copy.featured.eyebrow}
        </span>
        <p className="mt-6 text-xl md:text-2xl text-neutral-400 line-through decoration-white/30">
          {copy.featured.before}
        </p>
        <p className="mt-4 text-2xl md:text-3xl font-semibold tracking-tight">
          {copy.featured.after}{" "}
          <span className="accent-italic text-[#A7C0F2] font-normal">
            {copy.featured.emphasis}
          </span>
          &quot;
        </p>
        <p className="mt-8 pt-6 border-t border-white/10 text-neutral-300 leading-relaxed max-w-2xl">
          {copy.featured.takeaway}
        </p>
      </div>
      <div className="grid sm:grid-cols-2 gap-6">
        {[copy.saas, copy.service].map(({ eyebrow, before, after }, index) => (
          <div key={index} className="rounded-3xl bg-white border border-black/10 p-8 reveal-fade">
            <span className="font-mono-eyebrow text-[10px] uppercase text-neutral-500">{eyebrow}</span>
            <p className="mt-4 text-neutral-400 line-through">{before}</p>
            <p className="mt-2 text-lg font-semibold">{after}</p>
          </div>
        ))}
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

export function DareSeatSection({ copy, formSlot }: {
  copy: DareCopy["seatSection"];
  formSlot: ReactNode;
}) {
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
            {copy.eyebrow}
          </span>
        </div>
        <h2 className="text-4xl md:text-5xl font-semibold tracking-tight">
          {copy.title}{" "}
          <span className="accent-italic text-[#A7C0F2] font-normal">
            {copy.accent}
          </span>
        </h2>
        <p className="mt-4 text-neutral-300">
          {dareText(copy.body)}
        </p>

        {formSlot}
      </div>
    </section>
  );
}
