import type { ReactNode } from "react";
import { cacheLife, cacheTag } from "next/cache";

import { Em } from "@/components/home/ui";
import { JsonLd } from "@/components/primitives/JsonLd";
import { ideasItemList } from "@/components/hubs/HubIdeasGrid";
import { IdeaBrowser } from "@/components/public/IdeaBrowser";
import { LinkTabs, type TabGroup } from "@/components/public/LinkTabs";
import { PageHeader } from "@/components/public/PageHeader";
import { PublicShell } from "@/components/public/PublicShell";
import { FeaturedIdeas, InkBand, KeepBrowsing, SectionHeading } from "@/components/public/Sections";
import { ButtonLink } from "@/components/home/ui";
import { IDEA_COLLECTION_SLUGS, isIdeaCollectionSlug, type IdeaCollectionSlug } from "@/lib/idea-collection-slugs";
import {
  fetchAllIdeas,
  fetchIdeasByCategory,
  fetchIdeasByRevenueGoal,
  publicCategoryCounts,
  type IdeaDoc,
} from "@/components/hubs/hub-data";
import { toPublicIdeas } from "@/lib/public/ideas";
import {
  SITE,
  breadcrumbSchema,
  buildGraph,
  collectionPageSchema,
  organizationSchema,
  personSchema,
  websiteSchema,
} from "@/lib/seo";

type CollectionKind = "category" | "revenue" | "buildTime";

type CollectionDef = {
  slug: string;
  kind: CollectionKind;
  title: string;
  description: string;
  /** Short label for tabs and crumbs (defaults to the title minus "Startup Ideas"). */
  tab: string;
  /** For buildTime collections, the manifest buildTime values that qualify. */
  buildTimeValues?: string[];
};

/* ------------------------------------------------------------------ */
/* Collection map — every slug here corresponds to a legacy            */
/* ideas/{slug}/index.html hub. Hubs missing from this map fall        */
/* through to notFound() so unknown idea slugs still 404 correctly.    */
/* ------------------------------------------------------------------ */

const COLLECTIONS: Record<IdeaCollectionSlug, CollectionDef> = {
  // Category hubs (matches Convex idea.category values)
  saas: {
    slug: "saas",
    tab: "SaaS",
    kind: "category",
    title: "SaaS Startup Ideas",
    description:
      "Recurring-revenue software businesses you can ship this weekend. Each one is scoped to launch, validate, and start charging customers within 8–12 hours.",
  },
  "ai-tools": {
    slug: "ai-tools",
    tab: "AI tools",
    kind: "category",
    title: "AI Tool Startup Ideas",
    description:
      "AI-powered products with clear value props and obvious build paths. The kind of ideas you can prompt-engineer your way to MVP in a weekend.",
  },
  automation: {
    slug: "automation",
    tab: "Automation",
    kind: "category",
    title: "Automation Startup Ideas",
    description:
      "Workflow automation tools that eliminate manual work. Glue products, integration tools, and AI agents that replace expensive human steps.",
  },
  "developer-tools": {
    slug: "developer-tools",
    tab: "Developer tools",
    kind: "category",
    title: "Developer Tool Startup Ideas",
    description:
      "Tools developers pay for because they live the problem daily. Highest builder confidence, smallest distribution gap.",
  },
  productivity: {
    slug: "productivity",
    tab: "Productivity",
    kind: "category",
    title: "Productivity Startup Ideas",
    description:
      "Apps that give knowledge workers their hours back. Note-takers, scheduling tools, calendar layers, focus aids — clear willingness to pay.",
  },
  marketplace: {
    slug: "marketplace",
    tab: "Marketplace",
    kind: "category",
    title: "Marketplace Startup Ideas",
    description:
      "Two-sided marketplace ideas scoped to a weekend MVP. Start with one tight niche, seed the first listings by hand, and take a cut of every transaction.",
  },
  education: {
    slug: "education",
    tab: "Education",
    kind: "category",
    title: "Education Startup Ideas",
    description:
      "EdTech and learning products you can ship in a weekend. Study tools, course layers, and tutoring helpers with clear demand and willing-to-pay learners.",
  },
  health: {
    slug: "health",
    tab: "Health",
    kind: "category",
    title: "Health & Wellness Startup Ideas",
    description:
      "Health, fitness, and wellness products with obvious value and recurring engagement. Trackers, coaching layers, and habit tools you can launch this weekend.",
  },
  b2b: {
    slug: "b2b",
    tab: "B2B",
    kind: "category",
    title: "B2B Startup Ideas",
    description:
      "Business-to-business tools companies happily expense. Niche workflow products with short sales cycles and strong willingness to pay.",
  },
  "creator-tools": {
    slug: "creator-tools",
    tab: "Creator tools",
    kind: "category",
    title: "Creator Tool Startup Ideas",
    description:
      "Products that help creators make, publish, and monetize faster. Tight-scope tools for an audience that already pays for its stack.",
  },
  fintech: {
    slug: "fintech",
    tab: "Fintech",
    kind: "category",
    title: "Fintech Startup Ideas",
    description:
      "Money tools with clear utility and high willingness to pay. Budgeting layers, invoicing, and finance automations scoped to a weekend build.",
  },
  ecommerce: {
    slug: "ecommerce",
    tab: "E-commerce",
    kind: "category",
    title: "E-commerce Startup Ideas",
    description:
      "Tools and storefronts for online sellers. Conversion helpers, store add-ons, and niche shops you can stand up in a weekend.",
  },

  // Revenue goal hubs
  "1k-month": {
    slug: "1k-month",
    tab: "$1K/mo",
    kind: "revenue",
    title: "Startup Ideas That Can Make $1k/Month",
    description:
      "Tight-scope ideas with realistic paths to $1,000 MRR. Perfect first targets for solo builders proving they can charge for software.",
  },
  "5k-month": {
    slug: "5k-month",
    tab: "$5K/mo",
    kind: "revenue",
    title: "Startup Ideas That Can Make $5k/Month",
    description:
      "Ideas with real unit economics targeting $5,000 MRR — replacement-income level for most solo founders.",
  },
  "10k-month": {
    slug: "10k-month",
    tab: "$10K/mo",
    kind: "revenue",
    title: "Startup Ideas That Can Make $10k/Month",
    description:
      "Ambitious ideas with paths to $10,000 MRR or beyond. These are real businesses — quit-your-job money built on a weekend foundation.",
  },
  "passive-income": {
    slug: "passive-income",
    tab: "Passive income",
    kind: "revenue",
    title: "Passive Income Startup Ideas",
    description:
      "Low-maintenance products that earn while you sleep. Automation-first, async delivery, minimal customer support burden.",
  },
  "quick-wins": {
    slug: "quick-wins",
    tab: "Quick wins",
    kind: "revenue",
    title: "Quick-Win Startup Ideas",
    description:
      "Ideas with the shortest path from build to first paying customer. Tight scope, obvious value, fast feedback.",
  },

  // Build time hubs (matches buildTime hour values from ideas/manifest.json)
  "build-in-weekend": {
    slug: "build-in-weekend",
    tab: "A weekend",
    kind: "buildTime",
    title: "Build in a Weekend: Startup Ideas You Can Ship Friday–Sunday",
    description:
      "Build-in-a-weekend startup ideas scoped for Friday night to Sunday launch — tight MVPs, no infra rabbit holes, ready to validate Monday morning.",
    buildTimeValues: ["8", "10", "12"],
  },
  "build-in-8-hours": {
    slug: "build-in-8-hours",
    tab: "8 hours",
    kind: "buildTime",
    title: "Startup Ideas You Can Build in 8 Hours",
    description:
      "Tightest scope possible. Single-day sprints that prove the idea works before you invest the full weekend.",
    buildTimeValues: ["8"],
  },
  "build-in-1-week": {
    slug: "build-in-1-week",
    tab: "1 week",
    kind: "buildTime",
    title: "Startup Ideas You Can Build in a Week",
    description:
      "Ideas needing more than a weekend but still shippable in a week of focused work. Slightly more complex backends, real auth, multi-step flows.",
    buildTimeValues: ["20", "24", "30", "40"],
  },
};

export const COLLECTION_SLUGS: readonly string[] = IDEA_COLLECTION_SLUGS;

/* ------------------------------------------------------------------ */
/* Collection metadata (consumed by app/ideas/[slug]/page.tsx          */
/* generateMetadata fallback when the idea resolution returns null)    */
/* ------------------------------------------------------------------ */

export function getCollectionMeta(slug: string): {
  title: string;
  description: string;
} | null {
  if (!isIdeaCollectionSlug(slug)) return null;
  const def = COLLECTIONS[slug];
  return { title: def.title, description: def.description };
}

/* ------------------------------------------------------------------ */
/* renderCollection — called from app/ideas/[slug]/page.tsx as the     */
/* third resolution path (MDX → Convex body → renderCollection)        */
/* ------------------------------------------------------------------ */

export async function renderCollection(
  slug: string,
): Promise<ReactNode | null> {
  if (!isIdeaCollectionSlug(slug)) return null;
  return <CachedCollectionHub slug={slug} />;
}

/** Italic tail appended to the H1 (WP56 ruling: the existing title stays verbatim first). */
const TAIL: Record<CollectionKind, string | null> = {
  category: "you can ship by Sunday.",
  revenue: "sized for a weekend.",
  buildTime: null,
};

const KIND_GROUPS: { kind: CollectionKind; label: string; ariaLabel: string }[] = [
  { kind: "category", label: "Category", ariaLabel: "Browse by category" },
  { kind: "revenue", label: "Revenue goal", ariaLabel: "Browse by revenue goal" },
  { kind: "buildTime", label: "Build time", ariaLabel: "Browse by build time" },
];

function collectionTabs(current: string, categoryCounts: Map<string, number>, total: number): TabGroup[] {
  return KIND_GROUPS.map(({ kind, label, ariaLabel }) => ({
    label,
    ariaLabel,
    links: [
      ...(kind === "category" ? [{ href: "/startup-ideas", label: "All", count: total }] : []),
      ...IDEA_COLLECTION_SLUGS.filter((s) => COLLECTIONS[s].kind === kind).map((s) => ({
        href: `/ideas/${s}`,
        label: COLLECTIONS[s].tab,
        count: kind === "category" ? categoryCounts.get(s) : undefined,
        current: s === current,
      })),
    ],
  }));
}

const RELATED_HUBS = [
  { href: "/build-with/cursor", label: "Build with Cursor" },
  { href: "/ideas-for/developers", label: "Ideas for developers" },
  { href: "/ideas-for/non-technical", label: "Ideas for non-technical founders" },
  { href: "/solve/customer-support", label: "Solve customer support" },
];

async function CachedCollectionHub({ slug }: { slug: string }) {
  "use cache";
  cacheTag("ideas", `collection:${slug}`);
  // Tag revalidation on upsert keeps hubs fresh; hourly TTL was pure I/O.
  cacheLife("days");
  if (!isIdeaCollectionSlug(slug)) return null;
  const def = COLLECTIONS[slug];
  // Category/revenue use indexed queries. Tab counts come from the manifest
  // membership set (no Convex list). buildTime still shares the cached
  // fetchAllIdeas drain with other hubs.
  const [ideas, { counts: categoryCounts, total }] = await Promise.all([
    fetchIdeasForCollection(def),
    publicCategoryCounts(),
  ]);
  const schema = buildCollectionSchema(def, ideas);
  const list = toPublicIdeas(ideas);
  const tail = TAIL[def.kind];
  const more = IDEA_COLLECTION_SLUGS.filter((s) => s !== slug && COLLECTIONS[s].kind === def.kind)
    .slice(0, 2)
    .map((s) => ({ href: `/ideas/${s}`, label: COLLECTIONS[s].title }));

  return (
    <PublicShell>
      <JsonLd schema={schema} />

      <PageHeader
        crumbs={[
          { label: "Home", href: "/" },
          { label: "Ideas", href: "/startup-ideas" },
          { label: def.title.replace(" Startup Ideas", "").trim() },
        ]}
        title={
          <>
            {def.title}
            {tail && (
              <>
                {" "}
                <Em>{tail}</Em>
              </>
            )}
          </>
        }
        description={def.description}
        meta={
          list.length > 0
            ? [
                <>
                  <span className="font-medium text-home-ink">{list.length}</span> curated ideas
                </>,
                "Sorted by builder confidence",
                "Updated weekly",
              ]
            : undefined
        }
      />

      <LinkTabs groups={collectionTabs(slug, categoryCounts, total)} className="pt-10" />

      {list.length > 0 ? (
        <>
          <FeaturedIdeas
            id="start-here-heading"
            heading={
              <>
                Three to start with, <Em>highest builder confidence first.</Em>
              </>
            }
            ideas={list.slice(0, 3)}
          />
          <div className="mx-auto w-full max-w-[1200px] px-5 py-14 md:px-10 lg:py-20 xl:px-0">
            <IdeaBrowser ideas={list} heading={`All ${list.length} ideas`} headingId="ideas-heading" />
          </div>
        </>
      ) : (
        <p className="mx-auto w-full max-w-[1200px] px-5 py-14 text-home-ink-2 md:px-10 xl:px-0">
          Ideas in this collection will appear once the live data source is reachable. Refresh in a moment.
        </p>
      )}

      <InkBand labelledBy="ship-heading">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <SectionHeading
            id="ship-heading"
            eyebrow="The Weekend MVP Starter Kit"
            dark
            intro="The Weekend MVP Starter Kit has the prompts, templates, and 48-hour plan that turn any of these ideas into a live product."
          >
            Ready to <Em dark>ship?</Em>
          </SectionHeading>
          <ButtonLink href="/starter-kit" tone="dark" className="w-full shrink-0 lg:w-auto">
            Get the Starter Kit
          </ButtonLink>
        </div>
      </InkBand>

      <KeepBrowsing
        id="other-collections-heading"
        heading="Browse other collections"
        links={[...more, ...RELATED_HUBS, { href: "/startup-ideas", label: "All ideas" }]}
      />
    </PublicShell>
  );
}

function byBuilderConfidence(a: IdeaDoc, b: IdeaDoc) {
  return (b.scores?.builder_confidence ?? 0) - (a.scores?.builder_confidence ?? 0);
}

async function fetchIdeasForCollection(def: CollectionDef): Promise<IdeaDoc[]> {
  if (def.kind === "category") {
    return (await fetchIdeasByCategory(def.slug)).sort(byBuilderConfidence);
  }
  if (def.kind === "revenue") {
    return (await fetchIdeasByRevenueGoal(def.slug)).sort(byBuilderConfidence);
  }
  // buildTime: no dedicated index — shared cached catalogue drain + filter.
  const values = def.buildTimeValues ?? [];
  return (await fetchAllIdeas())
    .filter((idea) => values.includes(idea.buildTime))
    .sort(byBuilderConfidence);
}

function buildCollectionSchema(
  def: CollectionDef,
  ideas: IdeaDoc[],
) {
  const url = `${SITE}/ideas/${def.slug}`;
  return buildGraph(
    personSchema(),
    organizationSchema(),
    websiteSchema(),
    {
      ...collectionPageSchema({
        title: def.title,
        description: def.description,
        url,
      }),
      mainEntity: ideasItemList(ideas),
    },
    breadcrumbSchema([
      { label: "Home", href: "/" },
      { label: "Ideas", href: "/startup-ideas" },
      {
        label: def.title.replace(" Startup Ideas", "").trim(),
        href: url,
      },
    ]),
  );
}
