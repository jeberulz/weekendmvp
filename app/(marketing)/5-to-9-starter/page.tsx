import { Suspense } from "react";
import type { Metadata } from "next";

import { JsonLd } from "@/components/primitives/JsonLd";
import { newsreaderEditorial } from "@/lib/fonts";
import { readStarter, type StarterEntry } from "@/lib/landing/read-starter";
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

async function loadStarter() {
  "use cache";
  return readStarter();
}

export async function generateMetadata(): Promise<Metadata> {
  const { seoTitle, seoDescription } = await loadStarter();
  return {
    title: { absolute: seoTitle },
    description: seoDescription,
    authors: [{ name: "John Iseghohi" }],
    alternates: { canonical: "/5-to-9-starter" },
    openGraph: {
      type: "website",
      siteName: "Weekend MVP",
      url: `${SITE}/5-to-9-starter`,
      title: seoTitle,
      description: seoDescription,
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
      title: seoTitle,
      description: seoDescription,
      images: [`${SITE}/image/og-image.png`],
    },
  };
}

function buildStarterSchema(description: string) {
  return buildGraph(
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
      description,
      datePublished: STARTER_DATE_PUBLISHED,
      dateModified: STARTER_DATE_MODIFIED,
      isPartOf: { "@id": `${SITE}/#website` },
      about: { "@id": PERSON_ID },
      author: { "@id": PERSON_ID },
    },
  );
}

/** Live idea count, same rule as the homepage (retired + engine drafts excluded). */
function liveIdeaCount(): number {
  const ideas = (manifestJson as { ideas?: unknown[] }).ideas ?? [];
  return liveIdeas(ideas as Parameters<typeof liveIdeas>[0]).length;
}

function renderStarterSection(section: StarterEntry["sections"][number]) {
  switch (section.discriminant) {
    case "fiveDays": return <FiveDays key={section.discriminant} copy={section.value} />;
    case "founderNote": return <FounderNoteSection key={section.discriminant} copy={section.value} />;
    case "whoItIsFor": return <WhoItIsFor key={section.discriminant} copy={section.value} />;
    case "faq": return <GuideFaq key={section.discriminant} copy={section.value} />;
  }
}

export default async function FiveToNineStarterPage() {
  const copy = await loadStarter();
  const total = liveIdeaCount();
  return (
    <main
      id="starter-content"
      tabIndex={-1}
      className={`${newsreaderEditorial.variable} ${styles.page} min-h-screen bg-home-paper text-home-ink selection:bg-home-orange/18`}
    >
      <JsonLd schema={buildStarterSchema(copy.seoDescription)} />

      <Suspense fallback={null}>
        <GuideSubscribedModal />
      </Suspense>

      <GuideHero total={total} copy={copy.hero} />
      {copy.sections.map(renderStarterSection)}
      <FinalCapture copy={copy.finalCapture} />
    </main>
  );
}
