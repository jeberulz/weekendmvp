import type { Metadata } from "next";

import { SITE, breadcrumbSchema, buildGraph, organizationSchema, PERSON_ID, personSchema } from "@/lib/seo";

import type { GuideSpec } from "./types";

export function buildGuideMetadata(spec: GuideSpec): Metadata {
  const url = `${SITE}${spec.path}`;
  const ogImage = `${SITE}${spec.ogImagePath}`;
  return {
    title: { absolute: spec.metaTitle },
    description: spec.description,
    authors: [{ name: spec.authorName }],
    alternates: { canonical: spec.path },
    openGraph: {
      type: "article",
      siteName: "Weekend MVP",
      url,
      title: spec.metaTitle,
      description: spec.description,
      ...(spec.datePublished ? { publishedTime: spec.datePublished } : {}),
      ...(spec.dateModified ? { modifiedTime: spec.dateModified } : {}),
      images: [{ url: ogImage, alt: `${spec.title}: ${spec.headline}`, width: 1200, height: 630, type: "image/png" }],
    },
    twitter: { card: "summary_large_image", site: "@weekendmvp", title: spec.metaTitle, description: spec.description, images: [ogImage] },
  };
}

export function buildGuideSchema(spec: GuideSpec) {
  const url = `${SITE}${spec.path}`;
  const ogImage = `${SITE}${spec.ogImagePath}`;
  const gated = spec.gate.mode !== "none";
  return buildGraph(
    personSchema(),
    organizationSchema(),
    breadcrumbSchema([{ label: "Home", href: `${SITE}/` }, { label: spec.title, href: url }]),
    {
      "@type": "Article",
      "@id": url,
      url,
      headline: spec.headline,
      description: spec.description,
      ...(spec.datePublished ? { datePublished: spec.datePublished } : {}),
      ...(spec.dateModified ? { dateModified: spec.dateModified } : {}),
      image: ogImage,
      inLanguage: spec.lang,
      isPartOf: { "@id": `${SITE}/#website` },
      author: { "@id": PERSON_ID },
      isAccessibleForFree: !gated,
      ...(gated ? { hasPart: { "@type": "WebPageElement", isAccessibleForFree: false, cssSelector: ".guide-rest" } } : {}),
    },
  );
}
