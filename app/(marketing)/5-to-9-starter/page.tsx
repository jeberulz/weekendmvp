import { Suspense } from "react";
import type { Metadata } from "next";

import { JsonLd } from "@/components/primitives/JsonLd";
import { newsreaderEditorial } from "@/lib/fonts";
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
import { STARTER_DATE_MODIFIED, STARTER_DATE_PUBLISHED } from "./dates";
import {
  FinalCapture,
  FiveDays,
  FounderNoteSection,
  GuideFaq,
  GuideHero,
  WhoItIsFor,
} from "./_sections";

import styles from "./starter.module.css";

const TITLE = "The 5-to-9 Starter: a free 5-day email guide | Weekend MVP";
const DESCRIPTION =
  "A free 5-day email guide for people with day jobs. One short email and one 10-minute action each evening, ending Friday with a tested idea.";

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  authors: [{ name: "John Iseghohi" }],
  alternates: { canonical: "/5-to-9-starter" },
  openGraph: {
    type: "website",
    siteName: "Weekend MVP",
    url: `${SITE}/5-to-9-starter`,
    title: TITLE,
    description: DESCRIPTION,
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
    site: "@weekendmvp",
    title: TITLE,
    description: DESCRIPTION,
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
    datePublished: STARTER_DATE_PUBLISHED,
    dateModified: STARTER_DATE_MODIFIED,
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
    <main
      id="starter-content"
      tabIndex={-1}
      className={`${newsreaderEditorial.variable} ${styles.page} min-h-screen bg-home-paper text-home-ink selection:bg-home-orange/18`}
    >
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
    </main>
  );
}
