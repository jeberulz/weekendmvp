import type { Metadata } from "next";
import { connection } from "next/server";

export const instant = false;
import { readFileSync } from "node:fs";
import path from "node:path";
import { fetchQuery } from "convex/nextjs";
import { Calendar } from "lucide-react";

import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import { Container, Em, buttonClass } from "@/components/home/ui";
import { JsonLd } from "@/components/primitives/JsonLd";
import { NavExternalLink } from "@/components/primitives/NavExternalLink";
import { Breadcrumbs } from "@/components/public/PageHeader";
import { InkBand, SectionHeading } from "@/components/public/Sections";
import type { PublicIdea } from "@/components/public/types";
import { listMdxSlugs, readMdxFile } from "@/lib/mdx";
import { onlyPublicIdeas } from "@/lib/public/library";
import { hasOgArt, liveIdeas, ogArtPath, publishOrder } from "@/lib/home/library";
import type { ManifestIdea as HomeManifestIdea } from "@/lib/home/types";
import { toPublicIdea } from "@/lib/public/ideas";
import { cn } from "@/lib/utils";
import {
  CATEGORY_META,
  categoryName,
  humanizeSlug,
  normalizeCategorySlug,
  toolName,
} from "@/components/ideas/idea-meta";
import {
  SITE,
  breadcrumbSchema,
  buildGraph,
  collectionPageSchema,
  faqPageSchema,
  organizationSchema,
  personSchema,
  websiteSchema,
} from "@/lib/seo";
import { StartupIdeasGate } from "./StartupIdeasGate";
import {
  IdeasExplorer,
  type CategoryFilter,
  type ExplorerIdea,
} from "./IdeasExplorer";

const CONTENT_DIR = "content/ideas";
const TITLE = "Startup Ideas | Weekend MVP";
const DESCRIPTION =
  "Research-backed startup ideas you can build this weekend. Get the breakdown, prompts, and everything you need to ship.";

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  authors: [{ name: "John Iseghohi" }],
  alternates: { canonical: "/startup-ideas" },
  openGraph: {
    type: "website",
    url: `${SITE}/startup-ideas`,
    title: TITLE,
    description: DESCRIPTION,
    images: [
      {
        url: `${SITE}/image/og-image.png`,
        alt: "Weekend MVP — ship your product in 48 hours",
        type: "image/png",
        width: 1200,
        height: 630,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
    images: [`${SITE}/image/og-image.png`],
  },
};

/* ------------------------------------------------------------------ */
/* Data                                                                */
/* ------------------------------------------------------------------ */

type IdeaDoc = Doc<"ideas">;

/** One idea as the loaders resolve it (also the ItemList schema source). */
type IdeaCardData = {
  slug: string;
  title: string;
  description: string;
  /** null on the MDX build-time fallback path (no Convex metadata). */
  category: string | null;
  /** Legacy humanized label, e.g. "Developer Tools", "Ai Tools". */
  categoryLabel: string | null;
  /** "deep" → Deep Research, anything else → Quick Idea. */
  researchLevel: string | null;
  buildTime: string | null;
  /** Publish timestamp (ms) — drives the newest/oldest sort. 0 on the MDX
   *  fallback, where the sort control is hidden anyway. */
  publishedAt: number;
};

type StartupIdeasData = {
  /** Which path produced the grid: Convex (full metadata) or MDX fallback. */
  source: "convex" | "mdx";
  ideas: IdeaCardData[];
  filters: CategoryFilter[];
  /** Per-idea applicationCategory for the ItemList schema (Convex only). */
  applicationCategories: Record<string, string>;
  /** Convex rows behind the list (scores, tools, art); empty on the MDX path. */
  docs: IdeaDoc[];
};

function stripMd(text: string): string {
  return text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[*_`]/g, "")
    .trim();
}

/** First body paragraph of the markdown — card copy on the MDX fallback. */
function excerpt(markdown: string, max = 200): string {
  for (const raw of markdown.split("\n")) {
    const line = raw.trim();
    if (
      !line ||
      line.startsWith("#") ||
      line.startsWith("```") ||
      line.startsWith("---")
    ) {
      continue;
    }
    const plain = stripMd(line);
    if (plain.length <= max) return plain;
    return `${plain.slice(0, max - 1).trimEnd()}…`;
  }
  return "";
}

/** All ideas from Convex, newest first (drains api.ideas.list pagination). */
async function fetchAllIdeas(): Promise<IdeaDoc[]> {
  const ideas: IdeaDoc[] = [];
  let cursor: string | null = null;
  do {
    const result: {
      page: IdeaDoc[];
      isDone: boolean;
      continueCursor: string;
    } = await fetchQuery(api.ideas.list, { limit: 200, cursor });
    ideas.push(...result.page);
    cursor = result.isDone ? null : result.continueCursor;
  } while (cursor);
  return ideas;
}

/**
 * Filter chips: legacy update-startup-ideas.js emitted one button per
 * manifest category that has ideas, labeled "{name} ({count})", in manifest
 * order. Convex `categories` (seeded from the manifest) is the live
 * equivalent; CATEGORY_META covers a missing/unreachable reference table.
 *
 * Counts use normalizeCategorySlug so legacy "SaaS" / "Creator" values
 * collapse onto the canonical chip instead of spawning orphan filters.
 */
async function buildFilters(ideas: IdeaCardData[]): Promise<CategoryFilter[]> {
  const counts = new Map<string, number>();
  for (const idea of ideas) {
    const cat = idea.category ? normalizeCategorySlug(idea.category) : "";
    if (!cat) continue;
    counts.set(cat, (counts.get(cat) ?? 0) + 1);
  }

  let order: string[] = [];
  const names: Record<string, string> = {};
  try {
    const categories = await fetchQuery(api.referenceTables.allCategories, {});
    for (const cat of categories) {
      order.push(cat.slug);
      const name = cat.name ?? cat.displayName;
      if (name) names[cat.slug] = name;
    }
  } catch {
    /* reference tables unavailable — fall back to the static map */
  }
  if (order.length === 0) order = Object.keys(CATEGORY_META);
  for (const slug of counts.keys()) {
    if (!order.includes(slug)) order.push(slug);
  }

  return order
    .filter((slug) => (counts.get(slug) ?? 0) > 0)
    .map((slug) => ({
      slug,
      label: names[slug] ?? CATEGORY_META[slug]?.name ?? humanizeSlug(slug),
      count: counts.get(slug)!,
    }));
}

type ManifestIdea = HomeManifestIdea & {
  researchLevel?: string;
  applicationCategory?: string;
};

/** Manifest metadata — fills Convex gaps so newly published MDX ideas
 * appear in the grid/search before `seed:convex --prod` lands. */
function readManifestIdeas(): ManifestIdea[] {
  try {
    const raw = readFileSync(
      path.join(process.cwd(), "ideas/manifest.json"),
      "utf8",
    );
    const data = JSON.parse(raw) as { ideas?: ManifestIdea[] };
    return Array.isArray(data.ideas) ? data.ideas : [];
  } catch {
    return [];
  }
}

function cardFromManifest(idea: ManifestIdea): IdeaCardData {
  const category = idea.category
    ? normalizeCategorySlug(idea.category)
    : null;
  return {
    slug: idea.slug,
    title: idea.title,
    description: idea.description ?? "",
    category,
    categoryLabel: category ? categoryName(category) : null,
    researchLevel: idea.researchLevel ?? "quick",
    buildTime: idea.buildTime ?? null,
    publishedAt: Date.parse(idea.publishedAt ?? "") || 0,
  };
}

/** MDX-only fallback: slug + frontmatter title + first-paragraph excerpt. */
type PublicOverlay = Awaited<ReturnType<typeof fetchQuery<typeof api.editorial.public.listing>>>;

function applyPublicOverlay(ideas: IdeaCardData[], publications: PublicOverlay): IdeaCardData[] {
  const bySlug = new Map(ideas.map((idea) => [idea.slug, idea]));
  for (const row of publications) {
    if (row.state === "removed") {
      bySlug.delete(row.slug);
    } else if (row.metadata && row.title) {
      const category = normalizeCategorySlug(row.metadata.category);
      bySlug.set(row.slug, {
        slug: row.slug,
        title: row.title,
        description: row.metadata.description,
        category,
        categoryLabel: categoryName(category),
        researchLevel: bySlug.get(row.slug)?.researchLevel ?? "deep",
        buildTime: row.metadata.buildTime,
        publishedAt: Date.parse(row.firstPublishedAt ?? "") || Date.parse(row.updatedAt),
      });
    }
  }
  return [...bySlug.values()];
}

async function loadFromMdx(publications: PublicOverlay): Promise<StartupIdeasData> {
  const manifestBySlug = new Map(
    readManifestIdeas().map((idea) => [idea.slug, idea]),
  );
  const slugs = await listMdxSlugs(CONTENT_DIR);
  const ideas: IdeaCardData[] = await Promise.all(
    slugs.map(async (slug) => {
      const fromManifest = manifestBySlug.get(slug);
      if (fromManifest) return cardFromManifest(fromManifest);
      const file = await readMdxFile(CONTENT_DIR, slug);
      const fmTitle = file?.frontmatter.title;
      return {
        slug,
        title: typeof fmTitle === "string" ? fmTitle : humanizeSlug(slug),
        description: file ? excerpt(file.content) : "",
        category: null,
        categoryLabel: null,
        researchLevel: null,
        buildTime: null,
        publishedAt: 0,
      };
    }),
  );
  // WP56: list only the public library (homepage rule), never stale Convex rows.
  const visible = await onlyPublicIdeas(applyPublicOverlay(ideas, publications));
  const filters = await buildFilters(visible);
  const applicationCategories: Record<string, string> = {};
  for (const idea of readManifestIdeas()) {
    if (idea.applicationCategory) {
      applicationCategories[idea.slug] = idea.applicationCategory;
    }
  }
  return {
    source: "mdx",
    ideas: visible,
    filters,
    applicationCategories,
    docs: [],
  };
}

/**
 * Convex is the primary source; merge any manifest/MDX ideas missing from
 * Convex (e.g. published but not yet prod-seeded) so search/filters stay
 * complete. Categories are normalized so legacy casing collapses.
 */
async function loadStartupIdeas(publications: PublicOverlay): Promise<StartupIdeasData> {
  let rows: IdeaDoc[];
  try {
    rows = await fetchAllIdeas();
  } catch {
    return loadFromMdx(publications);
  }
  if (rows.length === 0) return loadFromMdx(publications);

  const applicationCategories: Record<string, string> = {};
  const ideas: IdeaCardData[] = rows.map((idea) => {
    applicationCategories[idea.slug] = idea.applicationCategory;
    const category = normalizeCategorySlug(idea.category);
    return {
      slug: idea.slug,
      title: idea.title,
      description: idea.description,
      category,
      categoryLabel: categoryName(category),
      researchLevel: idea.researchLevel ?? "quick",
      buildTime: idea.buildTime,
      publishedAt: idea.publishedAt,
    };
  });

  const seen = new Set(ideas.map((idea) => idea.slug));
  const mdxSlugs = new Set(await listMdxSlugs(CONTENT_DIR));
  const missing = readManifestIdeas()
    .filter((idea) => !seen.has(idea.slug) && mdxSlugs.has(idea.slug))
    .sort((a, b) => {
      const aMs = Date.parse(a.publishedAt ?? "") || 0;
      const bMs = Date.parse(b.publishedAt ?? "") || 0;
      return bMs - aMs;
    });

  for (const idea of missing) {
    ideas.unshift(cardFromManifest(idea));
    if (idea.applicationCategory) {
      applicationCategories[idea.slug] = idea.applicationCategory;
    }
  }

  // WP56: list only the public library (homepage rule), never stale Convex rows.
  const visible = await onlyPublicIdeas(applyPublicOverlay(ideas, publications));
  const filters = await buildFilters(visible);
  return { source: "convex", ideas: visible, filters, applicationCategories, docs: rows };
}

/* ------------------------------------------------------------------ */
/* Public list shape (WP56 kit)                                        */
/* ------------------------------------------------------------------ */

type ManifestPublic = { idea: HomeManifestIdea; no: number };

/** N° + art for ideas Convex doesn't have yet, numbered the way
 *  lib/public/ideas.ts numbers them (live manifest, publish order). */
function manifestPublicLookup(): Map<string, ManifestPublic> {
  return new Map(
    publishOrder(liveIdeas(readManifestIdeas())).map((idea, i) => [
      idea.slug,
      { idea, no: i + 1 },
    ]),
  );
}

function manifestScores(scores: HomeManifestIdea["scores"]): PublicIdea["scores"] {
  if (!scores) return null;
  const { opportunity, pain, timing, builder_confidence } = scores;
  if (
    opportunity === undefined ||
    pain === undefined ||
    timing === undefined ||
    builder_confidence === undefined
  ) {
    return null;
  }
  return { opportunity, pain, timing, builder_confidence };
}

/** Scores, tools, N° and art from the manifest entry (when there is one). */
function publicFromManifest(slug: string, entry: ManifestPublic | undefined): PublicIdea {
  const scores = manifestScores(entry?.idea.scores);
  return {
    slug,
    title: "",
    description: "",
    category: "",
    categoryName: "",
    buildTime: 0,
    revenueGoal: entry?.idea.revenueGoal ?? "",
    tools: (entry?.idea.tools ?? []).slice(0, 3).map(toolName),
    scores,
    score: scores
      ? Math.round(
          ((scores.opportunity + scores.pain + scores.timing + scores.builder_confidence) / 4) * 10,
        ) / 10
      : null,
    libraryNo: entry?.no ?? null,
    art: entry && hasOgArt(entry.idea) ? ogArtPath(slug) : null,
  };
}

/**
 * The resolved ideas as the kit's cards/rows draw them. Convex rows go
 * through toPublicIdea; the loaders' resolved title, description, category
 * and build time (publication overlay included) always win, so the list
 * shows exactly what the grid showed before.
 */
function toExplorerIdeas(data: StartupIdeasData): ExplorerIdea[] {
  const docs = new Map(data.docs.map((doc) => [doc.slug, doc]));
  const manifest = manifestPublicLookup();
  return data.ideas.map((card) => {
    const doc = docs.get(card.slug);
    const base = doc ? toPublicIdea(doc) : publicFromManifest(card.slug, manifest.get(card.slug));
    const category = card.category ?? "";
    return {
      ...base,
      title: card.title,
      description: card.description,
      category,
      categoryName: category ? categoryName(category) : "",
      buildTime: Number(card.buildTime) || 0,
      publishedAt: card.publishedAt,
    };
  });
}

/* ------------------------------------------------------------------ */
/* JSON-LD — Person, WebSite, CollectionPage + ItemList, BreadcrumbList,*/
/* FAQPage (Q&A ported verbatim from startup-ideas.html)                */
/* ------------------------------------------------------------------ */

const FAQ = [
  {
    question: "What are good startup ideas for a weekend project?",
    answer:
      "Good weekend startup ideas include AI tools like meeting notes cleaners, invoice reminder bots, nutrition planners, and wellness coaches. The key is focusing on one user type, one core action, and one clear output that can be demoed in 15 seconds. Look for problems that real people face daily and can be solved with a simple 3-screen app.",
  },
  {
    question: "How long does it take to build an MVP?",
    answer:
      "A well-scoped MVP can be built in 48 hours (one weekend). The key is following the 3-screen structure: landing page, input form, and output page. Avoid auth, payments, and complex dashboards for the first version. Focus on proving the core value proposition works.",
  },
  {
    question: "What is a Weekend MVP?",
    answer:
      "A Weekend MVP is the smallest version of a product that creates proof of concept. It includes a live demo, a landing page with waitlist capture, and typically takes 48 hours to build. The goal is momentum, feedback, and building an email list of interested users.",
  },
  {
    question: "What makes a good micro SaaS idea?",
    answer:
      "A good micro SaaS idea solves a specific problem for a specific audience, can be built by one person, has low operational overhead, and can generate recurring revenue. The best ideas come from scratching your own itch or solving problems you see others face repeatedly.",
  },
];

function buildSchema(data: StartupIdeasData) {
  return buildGraph(
    personSchema(),
    organizationSchema(),
    websiteSchema(),
    {
      ...collectionPageSchema({
        title: "Startup Ideas You Can Build This Weekend",
        description:
          "Research-backed startup ideas for busy professionals who want to ship something real without quitting their day job.",
        url: `${SITE}/startup-ideas`,
      }),
      mainEntity: {
        "@type": "ItemList",
        numberOfItems: data.ideas.length,
        itemListElement: data.ideas.map((idea, index) => ({
          "@type": "ListItem",
          position: index + 1,
          item: {
            "@type": "SoftwareApplication",
            name: idea.title,
            applicationCategory:
              data.applicationCategories[idea.slug] ?? "BusinessApplication",
            description: idea.description,
            url: `${SITE}/ideas/${idea.slug}`,
          },
        })),
      },
    },
    breadcrumbSchema([
      { label: "Home", href: "/" },
      { label: "Startup Ideas", href: "/startup-ideas" },
    ]),
    faqPageSchema(FAQ),
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default async function StartupIdeasPage() {
  await connection();
  // This read is authoritative even when the public ideas projection is down.
  const publications = await fetchQuery(api.editorial.public.listing, {});
  return <StartupIdeasContent publications={publications} />;
}

const CONSULT_URL = "https://cal.com/switchtoux/mvp-sprint";

async function StartupIdeasContent({ publications }: { publications: PublicOverlay }) {
  const data = await loadStartupIdeas(publications);
  const schema = buildSchema(data);
  const ideas = toExplorerIdeas(data);
  const total = data.ideas.length;

  return (
    <>
      <JsonLd schema={schema} />

      {/* Ideas content is server-rendered visible by default (SEO); the
          gate swap happens client-side after hydration, like gate.js. */}
      <StartupIdeasGate>
        <header className="relative overflow-hidden">
          <div
            aria-hidden="true"
            className="home-dots absolute inset-0 opacity-60 [mask-image:linear-gradient(#000_40%,transparent)]"
          />
          <Container className="relative flex flex-col gap-7 pt-28 md:pt-36 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex max-w-[860px] flex-col gap-5">
              <Breadcrumbs
                items={[{ label: "Home", href: "/" }, { label: "Startup Ideas" }]}
              />
              <div className="flex flex-wrap items-end gap-x-8 gap-y-2">
                {/* The count, as the homepage library draws it. Decorative:
                    the result line below says it in words. */}
                {total > 0 ? (
                  <span
                    aria-hidden="true"
                    className="font-editorial text-[120px] font-normal leading-[0.8] tracking-[-0.04em] text-home-ink md:text-[200px]"
                  >
                    {total}
                  </span>
                ) : null}
                <h1 className="max-w-[520px] pb-2 font-editorial text-[40px] font-normal leading-[1.02] tracking-[-0.02em] text-balance text-home-ink md:text-[52px]">
                  Startup Ideas <Em>sized for a weekend.</Em>
                </h1>
              </div>
              <p className="max-w-[620px] text-pretty text-base leading-[1.55] text-home-ink-2 md:text-[19px]">
                Research-backed ideas you can build this weekend. Click any
                idea to see the full breakdown.
              </p>
            </div>
            <NavExternalLink
              href={CONSULT_URL}
              className={buttonClass(
                "secondary",
                "shrink-0 self-start bg-home-card font-medium duration-150 ease-out motion-reduce:transition-none lg:self-auto",
              )}
            >
              <Calendar size={18} strokeWidth={1.75} aria-hidden="true" />
              Want me to build one?
            </NavExternalLink>
          </Container>
        </header>

        <Container>
          <IdeasExplorer
            ideas={ideas}
            filters={data.filters}
            showFilters={data.filters.length > 0}
          />
        </Container>

        {/* CTA Section */}
        <InkBand inset labelledBy="build-one-heading" className="pt-0 pb-16 lg:pt-0 lg:pb-24">
          <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
            <SectionHeading
              id="build-one-heading"
              dark
              intro="Book a consult and let's turn one of these ideas into your MVP."
            >
              Want me to build <Em dark>one of these for you?</Em>
            </SectionHeading>
            <NavExternalLink
              href={CONSULT_URL}
              className={cn(
                buttonClass("dark", "w-full shrink-0 lg:w-auto"),
                "duration-150 ease-out focus-visible:outline-home-orange-light motion-reduce:transition-none",
              )}
            >
              Book a Consult
            </NavExternalLink>
          </div>
        </InkBand>
      </StartupIdeasGate>
    </>
  );
}
