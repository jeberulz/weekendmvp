import type { Metadata } from "next";
import { connection } from "next/server";

export const instant = false;

import { readHome } from "@/lib/landing/read-home";
import { HomeMotion } from "@/components/home/motion/HomeMotion";
import { AdditionalHomeSections } from "@/components/home/sections/AdditionalHomeSections";
import { BuildWithAI } from "@/components/home/sections/BuildWithAI";
import { FinalCall } from "@/components/home/sections/FinalCall";
import { FounderNote } from "@/components/home/sections/FounderNote";
import { Hero } from "@/components/home/sections/Hero";
import { IdeaLibrary } from "@/components/home/sections/IdeaLibrary";
import { IdeaOfTheWeek } from "@/components/home/sections/IdeaOfTheWeek";
import { InsideEveryIdea } from "@/components/home/sections/InsideEveryIdea";
import { StarterKit } from "@/components/home/sections/StarterKit";
import { WeekendTest } from "@/components/home/sections/WeekendTest";
import { WhatIs } from "@/components/home/sections/WhatIs";
import { YourWeekend } from "@/components/home/sections/YourWeekend";
import { JsonLd } from "@/components/primitives/JsonLd";
import { IdeaRequestWidget } from "@/components/idea-requests/IdeaRequestWidget";
import { WhenConvexReady } from "@/components/platform/client-gates";
import { newsreaderEditorial } from "@/lib/fonts";
import { getHomeData } from "@/lib/home/data";
import { buildCtaVisible } from "@/lib/workspace/build-cta-access";
import {
  SITE,
  buildGraph,
  faqPageSchema,
  itemListSchema,
  organizationSchema,
  personSchema,
  softwareApplicationSchema,
  webPageSchema,
  websiteSchema,
} from "@/lib/seo";

async function getHomeCopy() {
  "use cache";
  return readHome();
}

export async function generateMetadata(): Promise<Metadata> {
  await connection();
  const [{ totals }, copy] = await Promise.all([getHomeData(), getHomeCopy()]);
  const title = copy.seoTitle.replaceAll("{ideaCount}", String(totals.ideas));
  const description = copy.seoDescription.replaceAll("{ideaCount}", String(totals.ideas));
  return {
    title: { absolute: title },
    description,
    authors: [{ name: "John Iseghohi" }],
    alternates: { canonical: "/" },
    openGraph: {
      type: "website",
      url: `${SITE}/`,
      title,
      description,
      images: [
        {
          url: `${SITE}/image/og-image.png`,
          alt: "Weekend MVP: startup ideas you can build in a weekend",
          type: "image/png",
          width: 1200,
          height: 630,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [`${SITE}/image/og-image.png`],
    },
    verification: {
      google: "HCdXKcfa0MioAEpD-uVIkfFOjcb3CodPcmdc7yxAuRM",
    },
  };
}

export default async function HomePage() {
  await connection();
  // WP74-S5: the flag read runs beside the home data, not after it.
  const [data, buildCta, copy] = await Promise.all([getHomeData(), buildCtaVisible(), getHomeCopy()]);
  const title = copy.seoTitle.replaceAll("{ideaCount}", String(data.totals.ideas));
  const description = copy.seoDescription.replaceAll("{ideaCount}", String(data.totals.ideas));
  const pageUrl = `${SITE}/`;

  return (
    <main className={`${newsreaderEditorial.variable} bg-home-paper font-sans text-home-ink selection:bg-home-orange-light/40`}>
      <JsonLd
        schema={buildGraph(
          personSchema(),
          organizationSchema(),
          websiteSchema(),
          webPageSchema({
            name: title,
            description,
            url: pageUrl,
            id: pageUrl,
            speakableCssSelectors: ["#home-hero-title", "#home-what-is"],
          }),
          softwareApplicationSchema({
            id: `${SITE}/#starter-kit`,
            name: "Weekend MVP Starter Kit",
            applicationCategory: "DeveloperApplication",
            url: `${SITE}/starter-kit`,
            description:
              "The checklist, templates, and prompts to build a 3-screen MVP and launch a waitlist in one weekend.",
            offers: { price: "0", priceCurrency: "USD" },
          }),
          faqPageSchema([...copy.finalCall.faqs], { id: `${SITE}/#faq` }),
          itemListSchema(
            data.newest.map((row) => ({ slug: row.slug, title: row.title })),
            { id: `${SITE}/#idea-index`, name: "Newest startup ideas on Weekend MVP" },
          ),
        )}
      />
      <Hero copy={copy.hero} idea={data.hero} total={data.totals.ideas} buildCta={buildCta} />
      <WhatIs copy={copy.whatIs} />
      <IdeaLibrary copy={copy.ideaLibrary} total={data.totals.ideas} categories={data.totals.categories} rows={data.newest} />
      {data.spotlight && <IdeaOfTheWeek copy={copy.ideaOfTheWeek} idea={data.spotlight} weekLabel={data.week.label} total={data.totals.ideas} buildCta={buildCta} />}
      <WeekendTest copy={copy.weekendTest} averageHours={data.totals.averageHours} />
      <BuildWithAI copy={copy.buildWithAi} toolCounts={data.totals.tools} idea={data.spotlight} />
      {data.inside && <InsideEveryIdea copy={copy.insideEveryIdea} idea={data.inside} weekLabel={data.week.label} />}
      <YourWeekend copy={copy.yourWeekend} total={data.totals.ideas} />
      <StarterKit copy={copy.starterKit} />
      <FounderNote copy={copy.founderNote} />
      <AdditionalHomeSections sections={copy.additionalSections} />
      <FinalCall copy={copy.finalCall} total={data.totals.ideas} strip={data.strip} buildCta={buildCta} />
      <HomeMotion />
      {/* Idea 4: floating request/vote widget, same backend as /ideas/requests. */}
      <WhenConvexReady>
        <IdeaRequestWidget />
      </WhenConvexReady>
    </main>
  );
}
