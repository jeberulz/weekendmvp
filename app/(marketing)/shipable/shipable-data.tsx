import { ArrowRight } from "lucide-react";
import {
  breadcrumbSchema,
  buildGraph,
  faqPageSchema,
  organizationSchema,
  personSchema,
} from "@/lib/seo";
import {
  BONUS_VALUE_USD,
  BUILDERS,
  DURATION_MINUTES,
  IDEAS,
  NEXT_DATE_STATUS,
  includes,
  shipableText,
  usd,
} from "@/lib/landing/shipable-offer";
import type { ShipableBlock, ShipableCopy } from "@/lib/landing/read-shipable";
import type { WorkshopStatItem } from "@/components/marketing/workshop/WorkshopStats";
import type { WorkshopTldrItem } from "@/components/marketing/workshop/WorkshopTldr";
import type { WorkshopMoveItem } from "@/components/marketing/workshop/WorkshopMoves";
import type { WorkshopValueItem } from "@/components/marketing/workshop/WorkshopValueStack";
import type {
  WorkshopTicketDetail,
  WorkshopTicketLine,
} from "@/components/marketing/workshop/WorkshopTicket";
import type { WorkshopTimezoneRow } from "@/components/marketing/workshop/WorkshopTimezones";

// Seats are paused, so the graph has no Event or Offer.
export function shipableSchema(faq: ShipableCopy["faq"]) {
  return buildGraph(
    personSchema(),
    organizationSchema(),
    faqPageSchema(faq.map(({ question, answer }) => ({
      question: shipableText(question),
      answer: shipableText(answer),
    }))),
    breadcrumbSchema([
      { label: "Home", href: "/" },
      { label: "ship·able Workshop", href: "/shipable" },
    ]),
  );
}

export function shipableStats(copy: ShipableBlock<"stats">): WorkshopStatItem[] {
  return [
    { value: "10", suffix: " shipped", label: copy.shipped },
    { value: String(BUILDERS), suffix: "+", label: copy.builders },
    { value: "8", suffix: " hrs", label: copy.speed },
    { value: String(IDEAS), suffix: " ideas", label: copy.ideas },
  ];
}

export function shipableSummary(copy: ShipableBlock<"tldr">): WorkshopTldrItem[] {
  return [
    ...copy.points.map(({ lead, body }) => ({ lead: shipableText(lead), rest: shipableText(body) })),
    {
      lead: copy.bonusLead,
      rest: (
        <>
          {copy.bonusBody}{" "}
          <strong className="font-semibold text-[#1a1a1a]">{usd(BONUS_VALUE_USD)}</strong>.
        </>
      ),
    },
  ];
}

export function shipableMoves(copy: ShipableBlock<"moves">): WorkshopMoveItem[] {
  return ([
    [copy.sharpest, "01", "~25 min"],
    [copy.weekend, "02", "~30 min"],
    [copy.live, "03", "~35 min"],
  ] as const).map(([move, glyph, time]) => ({
    glyph,
    glyphColorClass: "text-neutral-200",
    heading: (
      <>
        Your{" "}
        <span className="accent-italic text-[#CC5500] font-normal">{move.emphasis}</span>{" "}
        {move.ending}
      </>
    ),
    body: move.body,
    time,
    timeColorClass: "text-neutral-700",
  }));
}

export function shipableValueStack(copy: ShipableBlock<"valueStack">): WorkshopValueItem[] {
  return includes.map(({ key, usd: amount, bonus }, index) => {
    const { title, body, emphasis } = copy[key];
    return {
      number: String(index + 1).padStart(2, "0"),
      title: (
        <h3 className="text-lg font-semibold text-[#0a0a0a]">
          {shipableText(title)}
          {emphasis && (
            <>
              {" "}
              <span className="accent-italic text-neutral-700 font-normal">{emphasis}</span>
            </>
          )}
        </h3>
      ),
      body: shipableText(body),
      value: `${usd(amount)} value`,
      bonus,
      creamRow: bonus,
      border: index < includes.length - 1,
    };
  });
}

export function shipableTicketDetails(copy: ShipableCopy["ticket"]): WorkshopTicketDetail[] {
  return [
    { label: copy.dateLabel, value: "Coming soon" },
    {
      label: copy.startLabel,
      value: <>TBA <span className="accent-italic text-neutral-700">timezone</span></>,
    },
    { label: copy.lengthLabel, value: `${DURATION_MINUTES} min + Q&A` },
    { label: copy.formatLabel, value: "Live on Zoom" },
  ];
}

export function shipableTicketLines(copy: ShipableBlock<"valueStack">): WorkshopTicketLine[] {
  return includes.map(({ key, usd: amount, bonus }) => ({
    label: copy[key].ticketLabel,
    value: usd(amount),
    rowColorClass: bonus ? "text-[#A03D00]" : undefined,
  }));
}

export const TIMEZONES: WorkshopTimezoneRow[] = [
  { city: "New York", date: "Next date · EDT", time: "TBA" },
  { city: "London", date: "Next date · BST", time: "TBA" },
  { city: "Lagos", date: "Next date · WAT", time: "TBA" },
  { city: "Los Angeles", date: "Next date · PDT", time: "TBA" },
];

export function ShipableHero({ copy }: { copy: ShipableCopy["hero"] }) {
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
              className="w-1.5 h-1.5 rounded-full bg-[#e9a06a]"
              aria-hidden="true"
            ></span>
            <span className="font-mono-eyebrow text-[11px] uppercase text-white/80">
              {NEXT_DATE_STATUS}
            </span>
          </div>

          <h1 className="text-[15vw] leading-[0.9] md:text-[7rem] font-semibold tracking-tight text-white drop-shadow-[0_2px_24px_rgba(0,0,0,0.45)]">
            ship<span className="text-[#e9a06a]">·</span>able
            <span className="text-[#e9a06a]">.</span>
          </h1>

          <p className="mt-8 max-w-xl text-xl md:text-2xl leading-snug text-white/85">
            {shipableText(copy.intro)}{" "}
            <span className="accent-italic text-[#e9a06a]">
              {copy.emphasis}
            </span>{" "}
            {copy.ending}
          </p>

          <div className="mt-10 flex flex-col sm:flex-row items-start sm:items-center gap-5">
            <p className="text-base font-medium text-white/80">
              {NEXT_DATE_STATUS}
            </p>
            <a
              href="#seat"
              className="group inline-flex items-center gap-3 rounded-2xl bg-white pl-7 pr-5 py-4 text-base font-semibold text-[#1a1a1a] hover:bg-neutral-100 transition-all focus:outline-none focus:ring-2 focus:ring-white/60 focus:ring-offset-2 focus:ring-offset-[#0a0a0a] active:scale-[0.98] shadow-2xl"
            >
              <span>{copy.cta}</span>
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

export function ShipableNextDateCard({ copy }: { copy: ShipableCopy["nextDateCard"] }) {
  return (
    <section className="px-5 pt-12 pb-16 md:pt-16 md:pb-20 max-w-5xl mx-auto">
      <div className="rounded-3xl bg-[#1a1a1a] text-white p-8 md:p-10 max-w-2xl">
        <div className="flex items-center justify-between mb-6">
          <span className="font-mono-eyebrow text-[10px] uppercase text-neutral-300">
            {copy.eyebrow}
          </span>
          <span className="font-mono-eyebrow text-[10px] uppercase text-neutral-300">
            TBA
          </span>
        </div>
        <p className="text-3xl md:text-4xl font-semibold tracking-tight">
          Next date{" "}
          <span className="accent-italic text-[#e9a06a]">coming soon</span>
        </p>
        <p className="mt-2 text-sm text-neutral-300">
          {shipableText(copy.intro)}
        </p>
        <p className="mt-6 text-sm text-neutral-400">
          {copy.body}
        </p>
        <a
          href="#seat"
          className="mt-8 inline-flex items-center gap-2 rounded-xl bg-[#e9a06a] text-[#1a1a1a] px-5 py-3 text-sm font-semibold hover:bg-[#f0b380] transition-all focus:outline-none focus:ring-2 focus:ring-white/40"
        >
          {copy.cta}
          <ArrowRight size={16} aria-hidden="true" />
        </a>
      </div>
    </section>
  );
}

export function ShipableDeliverableTeaser({ copy }: { copy: ShipableBlock<"deliverableTeaser"> }) {
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
            {copy.eyebrow}
          </span>
          <h2 className="mt-3 text-3xl md:text-4xl font-bold tracking-tight text-[#0a0a0a]">
            {copy.title}
          </h2>
          <p className="mt-3 text-lg text-neutral-700 max-w-xl">
            {copy.body}
          </p>
        </div>
      </div>
    </section>
  );
}

export function ShipableProblemBody({ copy }: { copy: ShipableBlock<"problem"> }) {
  return (
    <>
      <p>
        {copy.intro}
      </p>
      <p>{copy.setup}</p>
      <ul className="space-y-4">
        {copy.examples.map(({ lead, body }, index) => (
          <li key={index} className="flex gap-4">
            <span
              className="mt-3 h-px w-6 bg-[#CC5500] shrink-0"
              aria-hidden="true"
            ></span>
            <span>
              <strong className="font-semibold">{lead}</strong>{" "}
              {body}
            </span>
          </li>
        ))}
      </ul>
      <p className="text-neutral-700">
        {copy.conclusion}
      </p>
      <p>
        {copy.pitchLead}{" "}
        <span className="accent-italic text-[#1a1a1a]">
          {copy.pitchAccent}
        </span>{" "}
        {copy.pitchEnd}
      </p>
    </>
  );
}

export function ShipableProof({ copy }: { copy: ShipableBlock<"proof"> }) {
  return (
    <section className="px-5 py-20 md:py-28 max-w-4xl mx-auto">
      <h2 className="text-4xl md:text-6xl font-bold tracking-tight leading-[1.02] mb-12 text-[#0a0a0a]">
        {copy.title}{" "}
        <span className="accent-italic text-[#CC5500] font-normal">
          {copy.accent}
        </span>{" "}
        {copy.ending}
      </h2>

      <div className="rounded-3xl bg-[#1a1a1a] text-white p-8 md:p-10 mb-6 reveal">
        <span className="font-mono-eyebrow text-[10px] uppercase text-neutral-300">
          {copy.featuredLabel}
        </span>
        <p className="mt-4 text-5xl md:text-6xl font-semibold tracking-tight">
          {copy.featured.result}
        </p>
        <p className="accent-italic text-[#e9a06a] text-xl mt-1">
          {copy.featured.context}
        </p>
        <p className="mt-6 text-neutral-300 leading-relaxed max-w-2xl">
          {copy.featured.quote}
        </p>
        <div className="mt-8 flex items-center gap-3 pt-6 border-t border-white/10">
          <div
            className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-sm font-semibold text-white/70"
            aria-hidden="true"
          >
            {copy.featured.name.trim().split(/\s+/).map((name) => name[0]).slice(0, 2).join("").toUpperCase()}
          </div>
          <p className="font-semibold text-sm">{copy.featured.name}</p>
        </div>
      </div>
      <div className="grid sm:grid-cols-2 gap-6">
        {[copy.second, copy.third].map(({ result, context, quote, name }, index) => (
          <blockquote key={index} className="rounded-3xl bg-white border border-black/10 p-8 reveal">
            <p className="text-3xl font-semibold tracking-tight text-[#0a0a0a]">{result}</p>
            <p className="accent-italic text-[#A03D00] mb-4">{context}</p>
            <p className="text-neutral-700 italic">{quote}</p>
            <footer className="mt-4 font-mono-eyebrow text-[10px] uppercase text-neutral-700">
              {name}
            </footer>
          </blockquote>
        ))}
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
