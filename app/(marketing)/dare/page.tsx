import type { Metadata } from "next";

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
  WORKSHOP_DEADLINE,
  SCHEMA,
  STATS,
  TLDR_ITEMS,
  MOVES,
  VALUE_STACK,
  TICKET_DETAILS,
  TICKET_LINES,
  TIMEZONES,
  TEACHER_CHIPS,
  TEACHER_PICTURE_DARE,
  TEACHER_BODY_DARE,
  DareHero,
  DareDeliverableTeaser,
  DareProblemBody,
  DareProof,
  DareSeatSection,
} from "./dare-data";

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
        url: "https://www.weekendmvp.app/image/og-image.png",
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
    images: ["https://www.weekendmvp.app/image/og-image.png"],
  },
};

export default function DarePage() {
  return (
    <div
      className={`${newsreader.variable} theme-cream overflow-x-hidden bg-[#fcfaf7] text-[#1a1a1a]`}
      style={{ colorScheme: "light" }}
    >
      <JsonLd schema={SCHEMA} />
      <MotionEffects effects={["reveal", "smooth-anchor"]} />

      <main>
        <DareHero />

        <WorkshopCountdownCard
          deadline={WORKSHOP_DEADLINE}
          eyebrow="DARE Live starts in"
          timezone="[[TZ]]"
          dateLabel="[[DATE]]"
          timeLabel="[[TIME]]"
          italicClass="text-[#A7C0F2]"
          meta="90 minutes live · working session, not a lecture · Q&A after"
          footnote="One direction chosen. Four weeks mapped. In one sitting."
          sectionClass="px-5 pb-16 md:pb-20 max-w-5xl mx-auto"
        />

        <DareDeliverableTeaser />

        <WorkshopStats
          eyebrow="Why listen to me"
          italicClass="text-[#A7C0F2]"
          items={STATS}
        />

        <WorkshopProblem
          revealClass="reveal-fade"
          headingWeight="semibold"
          bodyClass="text-lg text-neutral-700"
          heading={
            <>
              You&apos;re a strong designer with vague AI ideas…{" "}
              <span className="accent-italic text-[#1D4ED8] font-normal">
                and vague doesn&apos;t ship.
              </span>
            </>
          }
        >
          <DareProblemBody />
        </WorkshopProblem>

        <WorkshopTldr
          headingWeight="semibold"
          textColorClass="text-neutral-700"
          checkColorClass="text-[#1D4ED8]"
          heading={
            <>
              Everything you need to know,{" "}
              <span className="accent-italic text-[#1D4ED8] font-normal">
                in ten seconds.
              </span>
            </>
          }
          items={TLDR_ITEMS}
        />

        <WorkshopMoves
          headingWeight="semibold"
          bodyTextClass="text-lg text-neutral-600"
          revealClass="reveal-fade"
          heading={
            <>
              Three moves.{" "}
              <span className="accent-italic text-[#1D4ED8] font-normal">
                One direction by the end.
              </span>
            </>
          }
          items={MOVES}
        />

        <WorkshopValueStack
          eyebrow="What's included"
          eyebrowColorClass="text-neutral-600"
          headingWeight="semibold"
          itemBodyColorClass="text-neutral-600"
          valueChipColorClass="text-neutral-500"
          heading={
            <>
              Six things in your seat.{" "}
              <span className="accent-italic text-[#1D4ED8] font-normal">
                ~$500 of value.
              </span>
            </>
          }
          items={VALUE_STACK}
          totalValue="$502"
          payValue={
            <>
              <span className="text-[#A7C0F2]">$</span>29
            </>
          }
          bonusPillClass="border-[#1E40AF]/40 text-[#1E40AF]"
          strikeDecorationClass="decoration-[#1D4ED8]/70"
          ctaHref="#seat"
          ctaLabel="Save my seat · $29"
          totalPreamble={
            <>
              Everything above exists for one outcome: you choose one direction
              and leave with a 4-week plan to move it into the real world.
            </>
          }
        />

        <DareProof />

        <WorkshopTicket
          eyebrow="Here's your ticket"
          eyebrowColorClass="text-neutral-600"
          headingWeight="semibold"
          heading={
            <>
              90 minutes.{" "}
              <span className="accent-italic text-[#1D4ED8] font-normal">
                $29.
              </span>{" "}
              Walk out with a direction.
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
              A working session with John Iseghohi.{" "}
              <span className="accent-italic text-[#1E40AF]">
                Choose your direction. Map your four weeks.
              </span>
            </>
          }
          brandSubColorClass="text-neutral-600"
          details={TICKET_DETAILS}
          detailLabelColorClass="text-neutral-500"
          includedEyebrowColorClass="text-neutral-500"
          includedLines={TICKET_LINES}
          footerPrice={
            <>
              <span className="text-[#A7C0F2]">$</span>29
            </>
          }
          footerValueLabel={
            <>
              <span className="line-through">$502</span> value · 2 bonuses (live)
            </>
          }
          footerNote={
            <>
              One direction chosen live. A 4-week path to shipping and earning
              from it.
            </>
          }
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
          heading={
            <>
              Here&apos;s when it lands{" "}
              <span className="accent-italic text-[#1D4ED8] font-normal">
                where you are.
              </span>
            </>
          }
          intro={
            <>
              DARE Live runs{" "}
              <strong className="font-semibold text-[#1a1a1a]">
                [[TIME]] [[TZ]]
              </strong>{" "}
              on [[DATE]]. Find your local time below. Can&apos;t make it live?
              The replay hits your inbox the same day.
            </>
          }
          rows={TIMEZONES}
        />

        <WorkshopTeacher
          nameWeight="semibold"
          name="John Iseghohi."
          role="Product Designer · Founder, Weekend MVP"
          roleColorClass="text-[#1E40AF]"
          bodyColorClass="text-neutral-700"
          chipColorClass="text-neutral-600"
          chips={TEACHER_CHIPS}
          pictureSlot={TEACHER_PICTURE_DARE}
        >
          {TEACHER_BODY_DARE}
        </WorkshopTeacher>

        <DareSeatSection formSlot={<DareSeatForm />} />
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
