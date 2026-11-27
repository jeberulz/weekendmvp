import type { Metadata } from "next";
import { Fragment } from "react";
import { readDare, type DareSection } from "@/lib/landing/read-dare";
import { PRICE_USD, STACK_VALUE_USD, WORKSHOP_DEADLINE, dareText, usd } from "@/lib/landing/dare-offer";

import { JsonLd } from "@/components/primitives/JsonLd";
import { MotionEffects } from "@/components/marketing/MotionEffects";
import { newsreader } from "@/lib/fonts";

import { WorkshopCountdownCard } from "@/components/marketing/workshop/WorkshopCountdownCard";
import { WorkshopStats } from "@/components/marketing/workshop/WorkshopStats";
import { WorkshopProblem } from "@/components/marketing/workshop/WorkshopProblem";
import { WorkshopTldr } from "@/components/marketing/workshop/WorkshopTldr";
import { WorkshopMoves } from "@/components/marketing/workshop/WorkshopMoves";
import { WorkshopValueStack } from "@/components/marketing/workshop/WorkshopValueStack";
import { WorkshopTicket } from "@/components/marketing/workshop/WorkshopTicket";
import { WorkshopTimezones } from "@/components/marketing/workshop/WorkshopTimezones";
import { WorkshopTeacher } from "@/components/marketing/workshop/WorkshopTeacher";
import { WorkshopStickyBar } from "@/components/marketing/workshop/WorkshopStickyBar";

import { DareSeatForm } from "./DareSeatForm";
import {
  SCHEMA,
  TIMEZONES,
  TEACHER_PICTURE_DARE,
  DareHeading,
  DareHero,
  dareMoves,
  dareStats,
  dareSummary,
  dareTicketDetails,
  dareTicketLines,
  dareValueStack,
  DareDeliverableTeaser,
  DareProblemBody,
  DareProof,
  DareSeatSection,
} from "./dare-data";
import { SITE } from "@/lib/seo";

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

async function getDare() {
  "use cache";
  return readDare();
}

export async function generateMetadata(): Promise<Metadata> {
  const { copy } = await getDare();
  return {
    title: { absolute: dareText(copy.seoTitle) },
    description: dareText(copy.seoDescription),
    authors: [{ name: "John Iseghohi" }],
    robots: { index: false, follow: false },
    alternates: { canonical: "/dare" },
    openGraph: {
      type: "website",
      url: "/dare",
      title: dareText(copy.socialTitle),
      description: dareText(copy.socialDescription),
      images: [
        {
          url: `${SITE}/image/og-image.png`,
          alt: "DARE Live, a workshop for designers becoming AI-native founders",
          type: "image/png",
          width: 1200,
          height: 630,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: dareText(copy.socialTitle),
      description: dareText(copy.socialDescription),
      images: [`${SITE}/image/og-image.png`],
    },
  };
}

const priceDisplay = <><span className="text-[#A7C0F2]">$</span>{PRICE_USD}</>;

function renderSection(section: DareSection) {
  const { discriminant, value } = section;
  switch (discriminant) {
    case "deliverableTeaser":
      return <DareDeliverableTeaser copy={value} />;
    case "stats":
      return <WorkshopStats eyebrow={value.eyebrow} italicClass="text-[#A7C0F2]" items={dareStats(value)} />;
    case "problem":
      return (
        <WorkshopProblem
          revealClass="reveal-fade"
          headingWeight="semibold"
          bodyClass="text-lg text-neutral-700"
          heading={<DareHeading title={value.title} accent={value.accent} />}
        >
          <DareProblemBody copy={value} />
        </WorkshopProblem>
      );
    case "tldr":
      return (
        <WorkshopTldr
          headingWeight="semibold"
          textColorClass="text-neutral-700"
          checkColorClass="text-[#1D4ED8]"
          heading={<DareHeading title={value.title} accent={value.accent} />}
          items={dareSummary(value)}
        />
      );
    case "moves":
      return (
        <WorkshopMoves
          headingWeight="semibold"
          bodyTextClass="text-lg text-neutral-600"
          revealClass="reveal-fade"
          heading={<DareHeading title={value.title} accent={value.accent} />}
          items={dareMoves(value)}
        />
      );
    case "valueStack":
      return (
        <WorkshopValueStack
          eyebrow={value.eyebrow}
          eyebrowColorClass="text-neutral-600"
          headingWeight="semibold"
          itemBodyColorClass="text-neutral-600"
          valueChipColorClass="text-neutral-500"
          heading={<DareHeading title={value.title} accent={value.accent} />}
          items={dareValueStack(value)}
          totalValue={usd(STACK_VALUE_USD)}
          payValue={priceDisplay}
          bonusPillClass="border-[#1E40AF]/40 text-[#1E40AF]"
          strikeDecorationClass="decoration-[#1D4ED8]/70"
          ctaHref="#seat"
          ctaLabel="Save my seat · $29"
          totalPreamble={value.preamble}
        />
      );
    case "proof":
      return <DareProof copy={value} />;
  }
}

export default async function DarePage() {
  const { copy, sections, stack } = await getDare();
  const { countdownCard, ticket, timezones, teacher } = copy;
  return (
    <div
      className={`${newsreader.variable} theme-cream overflow-x-hidden bg-[#fcfaf7] text-[#1a1a1a]`}
      style={{ colorScheme: "light" }}
    >
      <JsonLd schema={SCHEMA} />
      <MotionEffects effects={["reveal", "smooth-anchor"]} />

      <main>
        <DareHero copy={copy.hero} />

        <WorkshopCountdownCard
          deadline={WORKSHOP_DEADLINE}
          eyebrow={countdownCard.eyebrow}
          timezone="[[TZ]]"
          dateLabel="[[DATE]]"
          timeLabel="[[TIME]]"
          italicClass="text-[#A7C0F2]"
          meta={dareText(countdownCard.meta)}
          footnote={countdownCard.footnote}
          sectionClass="px-5 pb-16 md:pb-20 max-w-5xl mx-auto"
        />

        {sections.map((section) => <Fragment key={section.discriminant}>{renderSection(section)}</Fragment>)}

        <WorkshopTicket
          eyebrow={ticket.eyebrow}
          eyebrowColorClass="text-neutral-600"
          headingWeight="semibold"
          heading={
            <>
              <DareHeading title={ticket.title} accent={ticket.accent} />{" "}
              {ticket.ending}
            </>
          }
          stubLabel="Admission · DARE Live №01"
          stubCode="DARE·26·S0001"
          brandDisplay={
            <>
              D<span className="text-[#1D4ED8]">·</span>A
              <span className="text-[#1D4ED8]">·</span>R
              <span className="text-[#1D4ED8]">·</span>E
              <span className="text-[#1D4ED8]">.</span>
            </>
          }
          brandSub={
            <>
              {ticket.intro}{" "}
              <span className="accent-italic text-[#1E40AF]">
                {ticket.introAccent}
              </span>
            </>
          }
          brandSubColorClass="text-neutral-600"
          details={dareTicketDetails(ticket)}
          detailLabelColorClass="text-neutral-500"
          includedEyebrowColorClass="text-neutral-500"
          includedLines={dareTicketLines(stack)}
          footerPrice={priceDisplay}
          footerValueLabel={
            <>
              <span className="line-through">{usd(STACK_VALUE_USD)}</span> value · 2 bonuses (live)
            </>
          }
          footerNote={ticket.note}
          ctaHref="#seat"
          ctaLabel="Save my seat · $29"
          fineprint="DARE·26·S0001 · Bring one idea"
        />

        <WorkshopTimezones
          headingWeight="semibold"
          revealClass="reveal-fade"
          cityColorClass="text-[#1E40AF]"
          dateColorClass="text-neutral-500"
          introColorClass="text-neutral-600"
          heading={<DareHeading title={timezones.title} accent={timezones.accent} />}
          intro={
            <>
              {timezones.intro}{" "}
              <strong className="font-semibold text-[#1a1a1a]">
                [[TIME]] [[TZ]]
              </strong>{" "}
              {timezones.remainder}
            </>
          }
          rows={TIMEZONES}
        />

        <WorkshopTeacher
          nameWeight="semibold"
          name={teacher.name}
          role={teacher.role}
          roleColorClass="text-[#1E40AF]"
          bodyColorClass="text-neutral-700"
          chipColorClass="text-neutral-600"
          chips={[teacher.yearsChip, teacher.shippedChip, teacher.frameworkChip]}
          pictureSlot={TEACHER_PICTURE_DARE}
        >
          {teacher.paragraphs.map((paragraph, index) => <p key={index}>{dareText(paragraph)}</p>)}
        </WorkshopTeacher>

        <DareSeatSection copy={copy.seatSection} formSlot={<DareSeatForm />} />
      </main>

      <WorkshopStickyBar
        deadline={WORKSHOP_DEADLINE}
        ctaHref="#seat"
        ctaLabel="Save my seat · $29"
        ctaBgClass="bg-[#A7C0F2] text-[#1a1a1a]"
        ctaHoverClass="hover:bg-[#bdd0f6]"
        labelHiddenSm
      />
    </div>
  );
}
