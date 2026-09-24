import type { Metadata } from "next";

import { FAQS } from "@/components/home/content";
import { BuildWithAI } from "@/components/home/sections/BuildWithAI";
import { FinalCall } from "@/components/home/sections/FinalCall";
import { FounderNote } from "@/components/home/sections/FounderNote";
import { Hero } from "@/components/home/sections/Hero";
import { IdeaLibrary } from "@/components/home/sections/IdeaLibrary";
import { IdeaOfTheWeek } from "@/components/home/sections/IdeaOfTheWeek";
import { InsideEveryIdea } from "@/components/home/sections/InsideEveryIdea";
import { StarterKit } from "@/components/home/sections/StarterKit";
import { WeekendTest } from "@/components/home/sections/WeekendTest";
import { YourWeekend } from "@/components/home/sections/YourWeekend";
import { JsonLd } from "@/components/primitives/JsonLd";
import { newsreaderEditorial } from "@/lib/fonts";
import { getHomeData } from "@/lib/home/data";
import {
  SITE,
  buildGraph,
  faqPageSchema,
  organizationSchema,
  personSchema,
  softwareApplicationSchema,
  websiteSchema,
} from "@/lib/seo";

const TITLE = "Weekend MVP | Startup ideas you can build in a weekend";

export async function generateMetadata(): Promise<Metadata> {
  const { totals } = await getHomeData();
  const description = `${totals.ideas} researched startup ideas sized for one weekend, each with copy-paste prompts for Cursor, Claude, and Lovable. Keep your job and ship by Sunday.`;
  return {
    title: { absolute: TITLE },
    description,
    authors: [{ name: "John Iseghohi" }],
    alternates: { canonical: "/" },
    openGraph: {
      type: "website",
      url: `${SITE}/`,
      title: TITLE,
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
      title: TITLE,
      description,
      images: [`${SITE}/image/og-image.png`],
    },
    verification: {
      google: "google-site-verification=HCdXKcfa0MioAEpD-uVIkfFOjcb3CodPcmdc7yxAuRM",
    },
  };
}

export default async function HomePage() {
  const data = await getHomeData();
  return (
    <main className={`${newsreaderEditorial.variable} bg-home-paper font-sans text-home-ink selection:bg-home-orange-light/40`}>
      <JsonLd
        schema={buildGraph(
          personSchema(),
          organizationSchema(),
          websiteSchema(),
          softwareApplicationSchema({
            name: "Weekend MVP Starter Kit",
            applicationCategory: "DeveloperApplication",
            description:
              "The checklist, templates, and prompts to build a 3-screen MVP and launch a waitlist in one weekend.",
            offers: { price: "0", priceCurrency: "USD" },
          }),
          faqPageSchema(FAQS),
        )}
      />
      <Hero idea={data.hero} total={data.totals.ideas} />
      <IdeaLibrary total={data.totals.ideas} categories={data.totals.categories} rows={data.newest} />
      <IdeaOfTheWeek idea={data.spotlight} weekLabel={data.week.label} total={data.totals.ideas} />
      <WeekendTest averageHours={data.totals.averageHours} />
      <BuildWithAI toolCounts={data.totals.tools} idea={data.spotlight} />
      <InsideEveryIdea idea={data.inside} weekLabel={data.week.label} />
      <YourWeekend total={data.totals.ideas} />
      <StarterKit />
      <FounderNote />
      <FinalCall total={data.totals.ideas} strip={data.strip} />
    </main>
  );
}
