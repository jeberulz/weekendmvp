import type { Metadata } from "next";

import { JsonLd } from "@/components/primitives/JsonLd";
import { newsreaderEditorial } from "@/lib/fonts";
import { SITE, breadcrumbSchema, buildGraph, organizationSchema, PERSON_ID, personSchema } from "@/lib/seo";

import { GuideClose, GuideHero, GuideLessons, GuideOpening, GuideContents } from "./_sections";
import { GuideGate, GuideNavigation } from "./GuideInteractions";
import { GUIDE_BOOTSTRAP, GUIDE_DESCRIPTION, GUIDE_HEADLINE, GUIDE_PATH, GUIDE_TITLE } from "./guideContent";
import { guideLiveIdeaCount } from "./ideaCount";
import "./guide.css";

const title = `${GUIDE_TITLE} — Turn Your 9-to-5 Expertise Into a Tested Side Income | WeekendMVP`;
const url = `${SITE}${GUIDE_PATH}`;
const ogImage = `${SITE}/image/5-to-9-builder-og.png`;

export const metadata: Metadata = {
  title: { absolute: title },
  description: GUIDE_DESCRIPTION,
  authors: [{ name: "John Iseghohi" }],
  alternates: { canonical: GUIDE_PATH },
  robots: { index: false, follow: false },
  openGraph: {
    type: "article",
    url,
    title,
    description: GUIDE_DESCRIPTION,
    images: [{ url: ogImage, alt: `${GUIDE_TITLE}: ${GUIDE_HEADLINE}`, width: 1200, height: 630, type: "image/png" }],
  },
  twitter: { card: "summary_large_image", title, description: GUIDE_DESCRIPTION, images: [ogImage] },
};

const schema = buildGraph(
  personSchema(),
  organizationSchema(),
  breadcrumbSchema([{ label: "Home", href: `${SITE}/` }, { label: GUIDE_TITLE, href: url }]),
  {
    "@type": "Article",
    "@id": url,
    url,
    headline: GUIDE_HEADLINE,
    description: GUIDE_DESCRIPTION,
    image: ogImage,
    inLanguage: "en-GB",
    isPartOf: { "@id": `${SITE}/#website` },
    author: { "@id": PERSON_ID },
    isAccessibleForFree: false,
    hasPart: { "@type": "WebPageElement", isAccessibleForFree: false, cssSelector: ".guide-rest" },
  },
);

export default function FiveToNineBuilderGuidePage() {
  const ideaCount = guideLiveIdeaCount();
  return (
    <div lang="en-GB" className={`builder-guide bg-home-paper text-home-ink ${newsreaderEditorial.variable}`} suppressHydrationWarning>
      {/* Parser-blocking and before all visible guide markup. The flag belongs
          to this wrapper so client navigation cannot affect other routes. */}
      <script id="builder-guide-bootstrap" dangerouslySetInnerHTML={{ __html: GUIDE_BOOTSTRAP }} />
      <JsonLd schema={schema} />
      <a href="#builder-main" className="sr-only focus:not-sr-only guide-skip">Skip to content</a>
      <GuideNavigation />
      <main id="builder-main">
        <GuideHero />
        <div className="guide-measure">
          <GuideContents ideaCount={ideaCount} />
          <GuideOpening />
        </div>
        <GuideGate />
        <div className="guide-rest">
          <GuideLessons ideaCount={ideaCount} />
          <GuideClose ideaCount={ideaCount} />
        </div>
        <span id="builder-guide-end" aria-hidden="true" />
      </main>
    </div>
  );
}
