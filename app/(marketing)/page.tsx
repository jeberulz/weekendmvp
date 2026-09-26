import type { Metadata } from "next";

import { FAQS } from "@/components/home/content";
import { HomeMotion } from "@/components/home/motion/HomeMotion";
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
import { newsreaderEditorial } from "@/lib/fonts";
import { getHomeData } from "@/lib/home/data";
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

function homeTitle(ideaCount: number) {
  return `Weekend MVP | ${ideaCount} Startup Ideas You Can Build in a Weekend`;
}

function homeDescription(ideaCount: number) {
  return `${ideaCount} researched startup ideas sized for one weekend — each with copy-paste prompts for Cursor, Claude, and Lovable. Keep your job. Ship by Sunday.`;
}

export async function generateMetadata(): Promise<Metadata> {
  const { totals } = await getHomeData();
  const title = homeTitle(totals.ideas);
  const description = homeDescription(totals.ideas);
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
  const data = await getHomeData();
  const title = homeTitle(data.totals.ideas);
  const description = homeDescription(data.totals.ideas);
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
          faqPageSchema(FAQS, { id: `${SITE}/#faq` }),
          itemListSchema(
            data.newest.map((row) => ({ slug: row.slug, title: row.title })),
            { id: `${SITE}/#idea-index`, name: "Newest startup ideas on Weekend MVP" },
          ),
        )}
      />
      <Hero idea={data.hero} total={data.totals.ideas} />
      <WhatIs />
      <IdeaLibrary total={data.totals.ideas} categories={data.totals.categories} rows={data.newest} />
      <IdeaOfTheWeek idea={data.spotlight} weekLabel={data.week.label} total={data.totals.ideas} />
      <WeekendTest averageHours={data.totals.averageHours} />
      <BuildWithAI toolCounts={data.totals.tools} idea={data.spotlight} />
      <InsideEveryIdea idea={data.inside} weekLabel={data.week.label} />
      <YourWeekend total={data.totals.ideas} />
      <StarterKit />
      <FounderNote />
      <FinalCall total={data.totals.ideas} strip={data.strip} />
      <HomeMotion />
    </main>
  );
}
