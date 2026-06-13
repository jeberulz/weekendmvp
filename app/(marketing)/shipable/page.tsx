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

import { ShipableSeat } from "./ShipableSeat";
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
  TEACHER_PICTURE,
  TEACHER_BODY,
  ShipableHero,
  ShipableDeliverableTeaser,
  ShipableProblemBody,
  ShipableProof,
} from "./shipable-data";

/* Checkout: live Stripe Payment Link wired in ShipableCheckoutForm.tsx.
   The form does a fire-and-forget Beehiiv subscribe, then redirects to
   Stripe with prefilled_email. Stripe redirects back to /shipable?paid=1
   on success which swaps the form for a confirmation block (ShipableSeat). */

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

export default function ShipablePage() {
  return (
    <div
      className={`${newsreader.variable} theme-cream overflow-x-hidden bg-[#fcfaf7] text-[#1a1a1a]`}
      style={{ colorScheme: "light" }}
    >
      <JsonLd schema={SCHEMA} />
      <MotionEffects effects={["reveal", "smooth-anchor"]} />

      <main>
        <ShipableHero />

        <WorkshopCountdownCard
          deadline={WORKSHOP_DEADLINE}
          eyebrow="Workshop starts in"
          timezone="BST"
          dateLabel="Sat, Jun 27"
          timeLabel="12:00 PM"
          italicClass="text-[#e9a06a]"
          meta="90 minutes live · Q&A after"
        />

        <ShipableDeliverableTeaser />

        <WorkshopStats
          eyebrow="Why listen to me"
          italicClass="text-[#e9a06a]"
          items={STATS}
        />

        <WorkshopProblem
          headingColorClass="text-[#0a0a0a]"
          heading={
            <>
              Your idea&apos;s still in your head…{" "}
              <span className="accent-italic text-[#CC5500] font-normal">
                and that&apos;s exactly why it&apos;s worth nothing.
              </span>
            </>
          }
        >
          <ShipableProblemBody />
        </WorkshopProblem>

        <WorkshopTldr
          headingColorClass="text-[#0a0a0a]"
          checkColorClass="text-[#CC5500]"
          heading={
            <>
              Everything you need to know,{" "}
              <span className="accent-italic text-[#CC5500] font-normal">
                in ten seconds.
              </span>
            </>
          }
          items={TLDR_ITEMS}
        />

        <WorkshopMoves
          headingColorClass="text-[#0a0a0a]"
          moveHeadingColorClass="text-[#0a0a0a]"
          heading={
            <>
              Three moves.{" "}
              <span className="accent-italic text-[#CC5500] font-normal">
                Shipped on the call.
              </span>
            </>
          }
          items={MOVES}
        />

        <WorkshopValueStack
          eyebrow="What's included"
          eyebrowColorClass="text-neutral-700"
          headingColorClass="text-[#0a0a0a]"
          heading={
            <>
              Six things in your seat.{" "}
              <span className="accent-italic text-[#CC5500] font-normal">
                $738 of value.
              </span>
            </>
          }
          items={VALUE_STACK}
          totalValue="$738"
          payValue={
            <>
              <span className="text-[#e9a06a]">$</span>9
            </>
          }
          bonusPillClass="border-[#A03D00]/40 text-[#A03D00]"
          strikeDecorationClass="decoration-[#CC5500]/70"
          ctaHref="#seat"
          ctaLabel="Save my seat · $9"
        />

        <ShipableProof />

        <WorkshopTicket
          eyebrow="Here's your ticket"
          eyebrowColorClass="text-neutral-700"
          headingColorClass="text-[#0a0a0a]"
          heading={
            <>
              90 minutes.{" "}
              <span className="accent-italic text-[#CC5500] font-normal">
                $9.
              </span>{" "}
              Walk out shipped.
            </>
          }
          stubLabel="Admission · Workshop №01"
          stubCode="WMVP·26·S0001"
          brandDisplay={
            <>
              ship<span className="text-[#CC5500]">·</span>able
              <span className="text-[#CC5500]">.</span>
            </>
          }
          brandSub={
            <>
              A 90-minute working session with John Iseghohi.{" "}
              <span className="accent-italic text-[#A03D00]">
                Build your MVP, live.
              </span>
            </>
          }
          brandSubColorClass="text-neutral-700"
          details={TICKET_DETAILS}
          detailLabelColorClass="text-neutral-700"
          detailValueColorClass="text-[#1a1a1a]"
          includedEyebrowColorClass="text-neutral-700"
          includedLines={TICKET_LINES}
          includedListColorClass="text-[#1a1a1a]"
          footerPrice={
            <>
              <span className="text-[#e9a06a]">$</span>9
            </>
          }
          footerValueLabel={
            <>
              <span className="line-through">$738</span> value · 2 bonuses (live)
            </>
          }
          ctaHref="#seat"
          ctaLabel="Save my seat · $9"
          fineprint="WMVP·26·S0001 · Bring to Zoom"
        />

        <WorkshopTimezones
          headingColorClass="text-[#0a0a0a]"
          timeValueColorClass="text-[#0a0a0a]"
          cityColorClass="text-[#A03D00]"
          dateColorClass="text-neutral-700"
          introColorClass="text-neutral-700"
          heading={
            <>
              Here&apos;s when it lands{" "}
              <span className="accent-italic text-[#CC5500] font-normal">
                where you are.
              </span>
            </>
          }
          intro={
            <>
              Workshop runs{" "}
              <strong className="font-semibold text-[#1a1a1a]">
                12:00 PM BST
              </strong>{" "}
              on Sat, Jun 27. Set a reminder for your local time below.
            </>
          }
          rows={TIMEZONES}
        />

        <WorkshopTeacher
          nameColorClass="text-[#0a0a0a]"
          name="John Iseghohi."
          role="Founder · Weekend MVP"
          roleColorClass="text-[#A03D00]"
          bodyColorClass="text-neutral-800"
          chipColorClass="text-neutral-700"
          chips={TEACHER_CHIPS}
          pictureSlot={TEACHER_PICTURE}
        >
          {TEACHER_BODY}
        </WorkshopTeacher>

        <ShipableSeat />
      </main>

      <WorkshopStickyBar
        deadline={WORKSHOP_DEADLINE}
        ctaHref="#seat"
        ctaLabel="Save my seat · $9"
        ctaBgClass="bg-[#e9a06a] text-[#1a1a1a]"
        ctaHoverClass="hover:bg-[#f0b380]"
      />
    </div>
  );
}
