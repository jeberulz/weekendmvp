import type { Metadata } from "next";
import { cacheLife, cacheTag } from "next/cache";
import { fetchQuery } from "convex/nextjs";
import { Calendar } from "lucide-react";

import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import { JsonLd } from "@/components/primitives/JsonLd";
import { NavExternalLink } from "@/components/primitives/NavExternalLink";
import { listMdxSlugs, readMdxFile } from "@/lib/mdx";
import { CATEGORY_META, humanizeSlug } from "@/components/ideas/idea-meta";
import { StartupIdeasGate } from "./StartupIdeasGate";
import {
  IdeasExplorer,
  type CategoryFilter,
  type IdeaCardData,
} from "./IdeasExplorer";

const SITE = "https://weekendmvp.app";
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

type StartupIdeasData = {
  /** Which path produced the grid: Convex (full metadata) or MDX fallback. */
  source: "convex" | "mdx";
  ideas: IdeaCardData[];
  filters: CategoryFilter[];
  /** Per-idea applicationCategory for the ItemList schema (Convex only). */
  applicationCategories: Record<string, string>;
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
 */
async function buildFilters(ideas: IdeaDoc[]): Promise<CategoryFilter[]> {
  const counts = new Map<string, number>();
  for (const idea of ideas) {
    counts.set(idea.category, (counts.get(idea.category) ?? 0) + 1);
  }

  let order: string[] = [];
  const names: Record<string, string> = {};
  try {
    const refs = await fetchQuery(api.referenceTables.all, {});
    for (const cat of refs.categories) {
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

/** MDX-only fallback: slug + frontmatter title + first-paragraph excerpt. */
async function loadFromMdx(): Promise<StartupIdeasData> {
  const slugs = await listMdxSlugs(CONTENT_DIR);
  const ideas: IdeaCardData[] = await Promise.all(
    slugs.map(async (slug) => {
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
      };
    }),
  );
  return { source: "mdx", ideas, filters: [], applicationCategories: {} };
}

/**
 * Convex is the real source (category/research/buildTime metadata lives
 * only there); when it is unreachable — e.g. a build without a deployment —
 * the page degrades to a server-rendered MDX grid with the filter UI hidden.
 */
async function loadStartupIdeas(): Promise<StartupIdeasData> {
  let rows: IdeaDoc[];
  try {
    rows = await fetchAllIdeas();
  } catch {
    return loadFromMdx();
  }
  if (rows.length === 0) return loadFromMdx();

  const filters = await buildFilters(rows);
  const applicationCategories: Record<string, string> = {};
  const ideas: IdeaCardData[] = rows.map((idea) => {
    applicationCategories[idea.slug] = idea.applicationCategory;
    return {
      slug: idea.slug,
      title: idea.title,
      description: idea.description,
      category: idea.category,
      // Legacy card badge label: naive word-capitalized slug ("Ai Tools").
      categoryLabel: humanizeSlug(idea.category),
      researchLevel: idea.researchLevel ?? "quick",
      buildTime: idea.buildTime,
    };
  });
  return { source: "convex", ideas, filters, applicationCategories };
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
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Person",
        "@id": `${SITE}/#person`,
        name: "John Iseghohi",
        jobTitle: "Product Builder & MVP Specialist",
        url: "https://cal.com/switchtoux",
      },
      {
        "@type": "WebSite",
        "@id": `${SITE}/#website`,
        url: `${SITE}/`,
        name: "Weekend MVP",
        publisher: { "@id": `${SITE}/#person` },
      },
      {
        "@type": "CollectionPage",
        name: "Startup Ideas You Can Build This Weekend",
        description:
          "Research-backed startup ideas for busy professionals who want to ship something real without quitting their day job.",
        url: `${SITE}/startup-ideas`,
        isPartOf: { "@id": `${SITE}/#website` },
        author: { "@id": `${SITE}/#person` },
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
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: `${SITE}/` },
          {
            "@type": "ListItem",
            position: 2,
            name: "Startup Ideas",
            item: `${SITE}/startup-ideas`,
          },
        ],
      },
      {
        "@type": "FAQPage",
        mainEntity: FAQ.map(({ question, answer }) => ({
          "@type": "Question",
          name: question,
          acceptedAnswer: { "@type": "Answer", text: answer },
        })),
      },
    ],
  };
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function StartupIdeasPage() {
  return <CachedStartupIdeasPage />;
}

/** Data + render cached together; Convex mutations revalidate tag `ideas`. */
async function CachedStartupIdeasPage() {
  "use cache";
  cacheTag("ideas");
  cacheLife("hours");

  const data = await loadStartupIdeas();
  const schema = buildSchema(data);

  return (
    <>
      <JsonLd schema={schema} />

      {/* Ideas content is server-rendered visible by default (SEO); the
          gate swap happens client-side after hydration, like gate.js. */}
      <StartupIdeasGate>
        <section className="relative z-10">
          <div className="pt-32 pb-16 px-6">
            <div className="max-w-6xl mx-auto">
              <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-12">
                <div>
                  <h1 className="text-3xl md:text-5xl font-medium text-white tracking-tight mb-4">
                    Startup Ideas
                  </h1>
                  <p className="text-lg text-neutral-400 font-light max-w-xl">
                    Research-backed ideas you can build this weekend. Click any
                    idea to see the full breakdown.
                  </p>
                </div>
                <NavExternalLink
                  href="https://cal.com/switchtoux/mvp-sprint"
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white text-sm font-medium hover:bg-white/10 transition-colors"
                >
                  <Calendar size={16} aria-hidden="true" />
                  Want me to build one?
                </NavExternalLink>
              </div>

              <IdeasExplorer
                ideas={data.ideas}
                filters={data.filters}
                showFilters={data.source === "convex"}
              />
            </div>
          </div>

          {/* CTA Section */}
          <section className="py-24 border-t border-white/5 mt-16">
            <div className="max-w-4xl mx-auto px-6 text-center">
              <h2 className="text-3xl md:text-4xl font-medium text-white tracking-tight mb-4">
                Want me to build one of these for you?
              </h2>
              <p className="text-lg text-neutral-400 font-light mb-8 max-w-xl mx-auto">
                Book a consult and let&apos;s turn one of these ideas into your
                MVP.
              </p>
              <NavExternalLink
                href="https://cal.com/switchtoux/mvp-sprint"
                className="inline-flex items-center gap-2 px-8 py-4 bg-white text-black rounded-full text-sm font-semibold tracking-tight hover:bg-neutral-200 transition-all"
              >
                <span>Book a Consult</span>
              </NavExternalLink>
            </div>
          </section>
        </section>
      </StartupIdeasGate>
    </>
  );
}
