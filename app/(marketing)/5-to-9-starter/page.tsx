import { Suspense } from "react";
import type { Metadata } from "next";

import { JsonLd } from "@/components/primitives/JsonLd";
import { liveIdeas } from "@/lib/home/library";
import {
  SITE,
  breadcrumbSchema,
  buildGraph,
  organizationSchema,
  PERSON_ID,
  personSchema,
} from "@/lib/seo";
import manifestJson from "@/ideas/manifest.json";

import { GuideSubscribedModal } from "./GuideSubscribedModal";
import {
  FinalCapture,
  FiveDays,
  FounderNoteSection,
  GuideFaq,
  GuideHero,
  WhoItIsFor,
} from "./_sections";

const TITLE = "The 5-to-9 Starter | Turn your 9-to-5 expertise into a 5-to-9 income";
const DESCRIPTION =
  "Turn your 9-to-5 expertise into a 5-to-9 income — in 5 days. One short email a day. One action a day. By Friday, you'll have a tested idea, not just a notebook full of them.";
const OG_DESCRIPTION =
  "Turn your 9-to-5 expertise into a 5-to-9 income — in 5 days. One short email a day, one action a day, one tested idea by Friday.";

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  authors: [{ name: "John Iseghohi" }],
  alternates: { canonical: "/5-to-9-starter" },
  openGraph: {
    type: "website",
    url: `${SITE}/5-to-9-starter`,
    title: TITLE,
    description: OG_DESCRIPTION,
    images: [
      {
        url: `${SITE}/image/og-image.png`,
        alt: "Weekend MVP — the 5-to-9 Starter, a free 5-day guide",
        type: "image/png",
        width: 1200,
        height: 630,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: OG_DESCRIPTION,
    images: [`${SITE}/image/og-image.png`],
  },
};

const FIVE_TO_NINE_STARTER_SCHEMA = buildGraph(
  personSchema(),
  organizationSchema(),
  breadcrumbSchema([
    { label: "Home", href: `${SITE}/` },
    { label: "5-to-9 Starter", href: `${SITE}/5-to-9-starter` },
  ]),
  {
    "@type": "WebPage",
    "@id": `${SITE}/5-to-9-starter`,
    url: `${SITE}/5-to-9-starter`,
    name: "The 5-to-9 Starter",
    description: DESCRIPTION,
    isPartOf: { "@id": `${SITE}/#website` },
    about: { "@id": PERSON_ID },
    author: { "@id": PERSON_ID },
  },
);

/** Live idea count, same rule as the homepage (retired + engine drafts excluded). */
function liveIdeaCount(): number {
  const ideas = (manifestJson as { ideas?: unknown[] }).ideas ?? [];
  return liveIdeas(ideas as Parameters<typeof liveIdeas>[0]).length;
}

export default function FiveToNineStarterPage() {
  const total = liveIdeaCount();
  return (
    <div className="bg-home-paper text-home-ink min-h-screen selection:bg-black/10 selection:text-black">
      <JsonLd schema={FIVE_TO_NINE_STARTER_SCHEMA} />

      <Suspense fallback={null}>
        <GuideSubscribedModal />
      </Suspense>

      <GuideHero total={total} />
      <FiveDays />
      <FounderNoteSection />
      <WhoItIsFor />
      <GuideFaq />
      <FinalCapture />
    </div>
  );
}
