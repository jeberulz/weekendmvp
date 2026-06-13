/**
 * JSON-LD schema builders. Pure functions, no React, no side effects.
 * Replaces inline @graph blocks duplicated across ~13 page files.
 *
 * Pages compose schemas via buildGraph() and render with <JsonLd schema={...} />.
 */

const SITE =
  process.env.NEXT_PUBLIC_BASE_URL?.replace(/\/$/, "") ??
  "https://www.weekendmvp.app";

const PERSON_ID = `${SITE}/#person`;
const WEBSITE_ID = `${SITE}/#website`;

// ---------- Singletons ----------

export function personSchema() {
  return {
    "@type": "Person",
    "@id": PERSON_ID,
    name: "John Iseghohi",
    jobTitle: "Product Builder & MVP Specialist",
    url: "https://cal.com/switchtoux",
  } as const;
}

export function websiteSchema() {
  return {
    "@type": "WebSite",
    "@id": WEBSITE_ID,
    url: `${SITE}/`,
    name: "Weekend MVP",
    publisher: { "@id": PERSON_ID },
  } as const;
}

export function organizationSchema() {
  return {
    "@type": "Organization",
    name: "Weekend MVP",
    url: SITE,
  } as const;
}

// ---------- Breadcrumb ----------

export type BreadcrumbItem = {
  label: string;
  /** Omit on the trailing entry. */
  href?: string;
};

export function breadcrumbSchema(items: BreadcrumbItem[]) {
  return {
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => {
      const entry: Record<string, unknown> = {
        "@type": "ListItem",
        position: i + 1,
        name: item.label,
      };
      // Schema.org convention: omit `item` on the final crumb.
      if (item.href !== undefined) {
        entry.item = item.href.startsWith("http")
          ? item.href
          : `${SITE}${item.href.startsWith("/") ? item.href : `/${item.href}`}`;
      }
      return entry;
    }),
  } as const;
}

// ---------- Article ----------

export type ArticleSchemaInput = {
  title: string;
  description: string;
  slug: string;
  /** Unix ms or ISO string. */
  datePublished?: number | string;
  /** Defaults to datePublished. */
  dateModified?: number | string;
  image?: string;
  /** Defaults to /articles/{slug}. */
  pathPrefix?: string;
  authorRef?: boolean;
  publisherRef?: boolean;
};

export function articleSchema(input: ArticleSchemaInput) {
  const path = input.pathPrefix ?? "/articles";
  const url = `${SITE}${path}/${input.slug}`;
  const published = toIsoDate(input.datePublished);
  const modified = toIsoDate(input.dateModified ?? input.datePublished);

  const author = input.authorRef
    ? { "@id": PERSON_ID }
    : {
        "@type": "Person",
        name: "John Iseghohi",
        url: "https://cal.com/switchtoux",
      };

  const publisher = input.publisherRef
    ? { "@id": PERSON_ID }
    : organizationSchema();

  const schema: Record<string, unknown> = {
    "@type": "Article",
    headline: input.title,
    description: input.description,
    author,
    publisher,
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
  };
  if (published) schema.datePublished = published;
  if (modified) schema.dateModified = modified;
  if (input.image)
    schema.image = input.image.startsWith("http")
      ? input.image
      : `${SITE}${input.image.startsWith("/") ? input.image : `/${input.image}`}`;

  return schema;
}

// ---------- CollectionPage + ItemList ----------

export type CollectionPageInput = {
  title: string;
  description: string;
  url: string;
  audienceType?: string;
  items?: Array<{ slug: string; title: string; pathPrefix?: string }>;
};

export function collectionPageSchema(input: CollectionPageInput) {
  const schema: Record<string, unknown> = {
    "@type": "CollectionPage",
    name: input.title,
    description: input.description,
    url: input.url.startsWith("http") ? input.url : `${SITE}${input.url}`,
    isPartOf: { "@id": WEBSITE_ID },
    author: { "@id": PERSON_ID },
  };
  if (input.audienceType) {
    schema.audience = { "@type": "Audience", audienceType: input.audienceType };
  }
  if (input.items && input.items.length > 0) {
    schema.mainEntity = itemListSchema(input.items);
  }
  return schema;
}

export function itemListSchema(
  items: Array<{ slug: string; title: string; pathPrefix?: string }>,
) {
  return {
    "@type": "ItemList",
    numberOfItems: items.length,
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: `${SITE}${item.pathPrefix ?? "/ideas"}/${item.slug}`,
      name: item.title,
    })),
  } as const;
}

// ---------- HowTo ----------

export type HowToStep = { name?: string; text: string };

export function howToSchema(input: {
  name: string;
  description: string;
  steps: HowToStep[];
  totalTime?: string;
}) {
  const schema: Record<string, unknown> = {
    "@type": "HowTo",
    name: input.name,
    description: input.description,
    step: input.steps.map((s, i) => {
      const entry: Record<string, unknown> = {
        "@type": "HowToStep",
        position: i + 1,
      };
      if (s.name !== undefined) entry.name = s.name;
      entry.text = s.text;
      return entry;
    }),
  };
  if (input.totalTime) schema.totalTime = input.totalTime;
  return schema;
}

// ---------- SoftwareApplication ----------

export function softwareApplicationSchema(input: {
  name: string;
  description: string;
  applicationCategory: string;
  operatingSystem?: string;
  url?: string;
  offers?: { price?: string; priceCurrency?: string };
}) {
  const schema: Record<string, unknown> = {
    "@type": "SoftwareApplication",
    name: input.name,
    description: input.description,
    applicationCategory: input.applicationCategory,
    operatingSystem: input.operatingSystem ?? "Web",
  };
  if (input.url) schema.url = input.url;
  if (input.offers) {
    schema.offers = {
      "@type": "Offer",
      ...(input.offers.price ? { price: input.offers.price } : {}),
      ...(input.offers.priceCurrency
        ? { priceCurrency: input.offers.priceCurrency }
        : {}),
    };
  }
  return schema;
}

// ---------- FAQPage ----------

export type FaqEntry = { question: string; answer: string };

export function faqPageSchema(items: FaqEntry[]) {
  return {
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  } as const;
}

// ---------- Event (workshops) ----------

export function eventSchema(input: {
  name: string;
  description: string;
  startDate: string;
  endDate?: string;
  url: string;
  /** Defaults to OnlineEventAttendanceMode. */
  attendanceMode?: "Online" | "Offline" | "Mixed";
  location?: { name: string; url?: string };
  offers?: { price: string; priceCurrency: string; availability?: string };
}) {
  const url = input.url.startsWith("http") ? input.url : `${SITE}${input.url}`;
  const schema: Record<string, unknown> = {
    "@type": "Event",
    name: input.name,
    description: input.description,
    startDate: input.startDate,
    eventAttendanceMode: `https://schema.org/${
      input.attendanceMode ?? "Online"
    }EventAttendanceMode`,
    eventStatus: "https://schema.org/EventScheduled",
    organizer: { "@id": PERSON_ID },
    url,
  };
  if (input.endDate) schema.endDate = input.endDate;
  if (input.location) {
    schema.location = {
      "@type": "VirtualLocation",
      name: input.location.name,
      ...(input.location.url ? { url: input.location.url } : {}),
    };
  }
  if (input.offers) {
    schema.offers = {
      "@type": "Offer",
      price: input.offers.price,
      priceCurrency: input.offers.priceCurrency,
      availability:
        input.offers.availability ?? "https://schema.org/InStock",
      url,
    };
  }
  return schema;
}

// ---------- Graph wrapper ----------

export function buildGraph(...schemas: Array<Record<string, unknown> | null | undefined>) {
  return {
    "@context": "https://schema.org",
    "@graph": schemas.filter(
      (s): s is Record<string, unknown> => s != null,
    ),
  };
}

// ---------- helpers ----------

function toIsoDate(value: number | string | undefined): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value === "string") {
    // Preserve legacy YYYY-MM-DD strings verbatim (the format used by
    // article/newsletter frontmatter and idea publishedAt slices).
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) return new Date(parsed).toISOString();
    return undefined;
  }
  if (Number.isFinite(value)) return new Date(value).toISOString();
  return undefined;
}
