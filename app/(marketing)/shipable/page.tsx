import type { Metadata } from "next";
import { Fragment } from "react";
import { JsonLd } from "@/components/primitives/JsonLd";
import { MotionEffects } from "@/components/marketing/MotionEffects";
import { WorkshopStats } from "@/components/marketing/workshop/WorkshopStats";
import { WorkshopProblem } from "@/components/marketing/workshop/WorkshopProblem";
import { WorkshopTldr } from "@/components/marketing/workshop/WorkshopTldr";
import { WorkshopMoves } from "@/components/marketing/workshop/WorkshopMoves";
import { WorkshopValueStack } from "@/components/marketing/workshop/WorkshopValueStack";
import { WorkshopTicket } from "@/components/marketing/workshop/WorkshopTicket";
import { WorkshopTimezones } from "@/components/marketing/workshop/WorkshopTimezones";
import { WorkshopTeacher } from "@/components/marketing/workshop/WorkshopTeacher";
import { WorkshopStickyBar } from "@/components/marketing/workshop/WorkshopStickyBar";
import { newsreader } from "@/lib/fonts";
import { readShipable, type ShipableSection } from "@/lib/landing/read-shipable";
import {
  NEXT_DATE_STATUS,
  PRICE_USD,
  STACK_VALUE_USD,
  WORKSHOP_DEADLINE,
  shipableText,
  usd,
} from "@/lib/landing/shipable-offer";
import { SITE } from "@/lib/seo";
import { ShipableSeat } from "./ShipableSeat";
import {
  TIMEZONES,
  TEACHER_PICTURE,
  ShipableHero,
  ShipableNextDateCard,
  ShipableDeliverableTeaser,
  ShipableProblemBody,
  ShipableProof,
  shipableMoves,
  shipableSchema,
  shipableStats,
  shipableSummary,
  shipableTicketDetails,
  shipableTicketLines,
  shipableValueStack,
} from "./shipable-data";

async function getShipable() {
  "use cache";
  return readShipable();
}

export async function generateMetadata(): Promise<Metadata> {
  const { copy } = await getShipable();
  return {
    title: { absolute: shipableText(copy.seoTitle) },
    description: shipableText(copy.seoDescription),
    keywords: shipableText(copy.seoKeywords),
    authors: [{ name: "John Iseghohi" }],
    alternates: { canonical: "/shipable" },
    openGraph: {
      type: "website",
      siteName: "Weekend MVP",
      locale: "en_GB",
      url: "/shipable",
      title: shipableText(copy.socialTitle),
      description: shipableText(copy.socialDescription),
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
      title: shipableText(copy.socialTitle),
      description: shipableText(copy.twitterDescription),
      images: [
        {
          url: `${SITE}/image/og-image.png`,
          alt: "ship·able, a Weekend MVP workshop",
        },
      ],
    },
  };
}

function ShipableHeading({ title, accent }: { title: string; accent: string }) {
  return (
    <>
      {shipableText(title)}{" "}
      <span className="accent-italic text-[#CC5500] font-normal">{shipableText(accent)}</span>
    </>
  );
}

const price = <><span className="text-[#e9a06a]">$</span>{PRICE_USD}</>;

function renderSection(section: ShipableSection) {
  const { discriminant, value } = section;
  switch (discriminant) {
    case "deliverableTeaser":
      return <ShipableDeliverableTeaser copy={value} />;
    case "stats":
      return <WorkshopStats eyebrow={value.eyebrow} italicClass="text-[#e9a06a]" items={shipableStats(value)} />;
    case "problem":
      return (
        <WorkshopProblem
          headingColorClass="text-[#0a0a0a]"
          heading={<ShipableHeading title={value.title} accent={value.accent} />}
        >
          <ShipableProblemBody copy={value} />
        </WorkshopProblem>
      );
    case "tldr":
      return (
        <WorkshopTldr
          headingColorClass="text-[#0a0a0a]"
          checkColorClass="text-[#CC5500]"
          heading={<ShipableHeading title={value.title} accent={value.accent} />}
          items={shipableSummary(value)}
        />
      );
    case "moves":
      return (
        <WorkshopMoves
          headingColorClass="text-[#0a0a0a]"
          moveHeadingColorClass="text-[#0a0a0a]"
          heading={<ShipableHeading title={value.title} accent={value.accent} />}
          items={shipableMoves(value)}
        />
      );
    case "valueStack":
      return (
        <WorkshopValueStack
          eyebrow={value.eyebrow}
          eyebrowColorClass="text-neutral-700"
          headingColorClass="text-[#0a0a0a]"
          heading={<ShipableHeading title={value.title} accent={value.accent} />}
          items={shipableValueStack(value)}
          totalValue={usd(STACK_VALUE_USD)}
          payValue={price}
          bonusPillClass="border-[#A03D00]/40 text-[#A03D00]"
          strikeDecorationClass="decoration-[#CC5500]/70"
          ctaHref="#seat"
          ctaLabel={value.cta}
        />
      );
    case "proof":
      return <ShipableProof copy={value} />;
  }
}

export default async function ShipablePage() {
  const { copy, sections, stack } = await getShipable();
  const { ticket, timezones, teacher } = copy;
  return (
    <div
      className={`${newsreader.variable} theme-cream overflow-x-hidden bg-[#fcfaf7] text-[#1a1a1a]`}
      style={{ colorScheme: "light" }}
    >
      <JsonLd schema={shipableSchema(copy.faq)} />
      <MotionEffects effects={["reveal", "smooth-anchor"]} />

      <main>
        <ShipableHero copy={copy.hero} />
        <ShipableNextDateCard copy={copy.nextDateCard} />
        {sections.map((section) => <Fragment key={section.discriminant}>{renderSection(section)}</Fragment>)}

        <WorkshopTicket
          eyebrow={ticket.eyebrow}
          eyebrowColorClass="text-neutral-700"
          headingColorClass="text-[#0a0a0a]"
          heading={
            <>
              <ShipableHeading title={ticket.title} accent={ticket.accent} />{" "}
              {ticket.ending}
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
              {shipableText(ticket.intro)}{" "}
              <span className="accent-italic text-[#A03D00]">{ticket.introAccent}</span>
            </>
          }
          brandSubColorClass="text-neutral-700"
          details={shipableTicketDetails(ticket)}
          detailLabelColorClass="text-neutral-700"
          detailValueColorClass="text-[#1a1a1a]"
          includedEyebrowColorClass="text-neutral-700"
          includedLines={shipableTicketLines(stack)}
          includedListColorClass="text-[#1a1a1a]"
          footerPrice={price}
          footerValueLabel={
            <>
              <span className="line-through">{usd(STACK_VALUE_USD)}</span> value · seats paused
            </>
          }
          ctaHref="#seat"
          ctaLabel={ticket.cta}
          fineprint="WMVP·26·S0001 · Next session TBA"
        />

        <WorkshopTimezones
          headingColorClass="text-[#0a0a0a]"
          timeValueColorClass="text-[#0a0a0a]"
          cityColorClass="text-[#A03D00]"
          dateColorClass="text-neutral-700"
          introColorClass="text-neutral-700"
          heading={<ShipableHeading title={timezones.title} accent={timezones.accent} />}
          intro={timezones.intro}
          rows={TIMEZONES}
        />

        <WorkshopTeacher
          nameColorClass="text-[#0a0a0a]"
          name={teacher.name}
          role={teacher.role}
          roleColorClass="text-[#A03D00]"
          bodyColorClass="text-neutral-800"
          chipColorClass="text-neutral-700"
          chips={[shipableText(teacher.buildersChip), shipableText(teacher.ideasChip), teacher.siteChip]}
          pictureSlot={TEACHER_PICTURE}
        >
          {teacher.paragraphs.map((paragraph, index) => <p key={index}>{shipableText(paragraph)}</p>)}
        </WorkshopTeacher>

        <ShipableSeat copy={copy.seat} />
      </main>

      <WorkshopStickyBar
        deadline={WORKSHOP_DEADLINE}
        statusLabel={NEXT_DATE_STATUS}
        ctaHref="#seat"
        ctaLabel={copy.stickyBar.cta}
        ctaBgClass="bg-[#e9a06a] text-[#1a1a1a]"
        ctaHoverClass="hover:bg-[#f0b380]"
      />
    </div>
  );
}
