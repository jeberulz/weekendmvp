import type { Metadata } from "next";

import { JsonLd } from "@/components/primitives/JsonLd";
import { MotionEffects } from "@/components/marketing/MotionEffects";
import { newsreader } from "@/lib/fonts";

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
  ShipableNextDateCard,
  ShipableDeliverableTeaser,
  ShipableProblemBody,
  ShipableProof,
} from "./shipable-data";
import { SITE } from "@/lib/seo";

/* Seats paused until a new workshop date is set. No Stripe checkout on
   this page — #seat is the free Starter Kit capture + "Next date coming soon". */

export const metadata: Metadata = {
  title: {
    absolute:
      "ship·able | Build & Ship Your MVP Live in 90 Minutes (Workshop)",
  },
  description:
    "Build and ship a real MVP in 90 minutes. Live workshop with John Iseghohi for non-technical founders using AI tools. Walk out with a deployed URL, a 48-hour build plan, and your first users. Next date coming soon · Live on Zoom · Lifetime replay.",
  keywords:
    "MVP workshop, build MVP in a weekend, non-technical founder MVP, ship MVP live, AI MVP builder, 90 minute MVP, weekend MVP workshop",
  authors: [{ name: "John Iseghohi" }],
  alternates: { canonical: "/shipable" },
  openGraph: {
    type: "website",
    siteName: "Weekend MVP",
    locale: "en_GB",
    url: "/shipable",
    title: "ship·able · Build your MVP live in 90 minutes",
    description:
      "Turn the idea you've been sitting on into a real, live MVP. 90 minutes, live on Zoom. Next date coming soon. Replay included.",
    images: [
      {
        url: `${SITE}/image/og-image.png`,
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
    title: "ship·able · Build your MVP live in 90 minutes",
    description:
      "Live workshop. Turn an idea you've been sitting on into a deployed MVP in 90 minutes. Next date coming soon.",
    images: [
      {
        url: `${SITE}/image/og-image.png`,
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

        <ShipableNextDateCard />

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
          ctaLabel="Next date coming soon"
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
                $9 when seats reopen.
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
              <span className="line-through">$738</span> value · seats paused
            </>
          }
          ctaHref="#seat"
          ctaLabel="Next date coming soon"
          fineprint="WMVP·26·S0001 · Next session TBA"
        />

        <WorkshopTimezones
          headingColorClass="text-[#0a0a0a]"
          timeValueColorClass="text-[#0a0a0a]"
          cityColorClass="text-[#A03D00]"
          dateColorClass="text-neutral-700"
          introColorClass="text-neutral-700"
          heading={
            <>
              Timezones when the next date{" "}
              <span className="accent-italic text-[#CC5500] font-normal">
                lands.
              </span>
            </>
          }
          intro={
            <>
              Next date coming soon. Local start times will be posted with the
              announcement — typical slots below for planning.
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
        statusLabel="Next date coming soon"
        ctaHref="#seat"
        ctaLabel="Get the free kit"
        ctaBgClass="bg-[#e9a06a] text-[#1a1a1a]"
        ctaHoverClass="hover:bg-[#f0b380]"
      />
    </div>
  );
}
