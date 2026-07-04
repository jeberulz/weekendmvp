import type { Metadata } from "next";
import Link from "next/link";
import { cacheLife, cacheTag } from "next/cache";
import { ArrowLeft, ArrowRight, Trophy } from "lucide-react";

import ideasManifest from "@/ideas/manifest.json";
import { JsonLd } from "@/components/primitives/JsonLd";
import { fetchAllIdeas } from "@/components/hubs/hub-data";
import { categoryName } from "@/components/ideas/idea-meta";
import {
  breadcrumbSchema,
  buildGraph,
  collectionPageSchema,
  itemListSchema,
  personSchema,
  websiteSchema,
} from "@/lib/seo";

/**
 * /startup-ideas/top — the ideas leaderboard, ranked by our own research
 * scores (opportunity + pain + timing + builder confidence, /40). A citable,
 * data-backed ranking page: primary-source ranked lists are what search and
 * answer engines quote, and every idea already carries the four scores.
 *
 * Data: Convex first (revalidated via the `ideas` tag), falling back to the
 * bundled ideas/manifest.json (the seed source of truth) when Convex is
 * unreachable — the ranking never renders empty.
 */

const SITE = "https://www.weekendmvp.app";
const TITLE = "Top Startup Ideas, Ranked by Research Score | Weekend MVP";
const DESCRIPTION =
  "The highest-scored weekend-buildable startup ideas, ranked by our 4-dimension research score: opportunity, pain, timing, and builder confidence.";
const TOP_N = 25;

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  authors: [{ name: "John Iseghohi" }],
  alternates: { canonical: "/startup-ideas/top" },
  openGraph: {
    type: "website",
    url: `${SITE}/startup-ideas/top`,
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

type Scores = {
  opportunity: number;
  pain: number;
  timing: number;
  builder_confidence: number;
};

type RankedIdea = {
  slug: string;
  title: string;
  description: string;
  category: string;
  buildTime: string;
  scores: Scores;
  total: number;
};

const SCORE_COLUMNS: Array<{ key: keyof Scores; label: string }> = [
  { key: "opportunity", label: "Opportunity" },
  { key: "pain", label: "Pain" },
  { key: "timing", label: "Timing" },
  { key: "builder_confidence", label: "Confidence" },
];

function rank(
  rows: Array<{
    slug: string;
    title: string;
    description: string;
    category: string;
    buildTime: string;
    scores?: Scores | null;
  }>,
): RankedIdea[] {
  return rows
    .flatMap((row) => {
      if (!row.scores) return [];
      const total =
        row.scores.opportunity +
        row.scores.pain +
        row.scores.timing +
        row.scores.builder_confidence;
      return [{ ...row, scores: row.scores, total }];
    })
    .sort(
      (a, b) =>
        b.total - a.total ||
        b.scores.builder_confidence - a.scores.builder_confidence ||
        a.title.localeCompare(b.title),
    )
    .slice(0, TOP_N);
}

async function loadTopIdeas(): Promise<RankedIdea[]> {
  const convexRows = await fetchAllIdeas();
  if (convexRows.length > 0) return rank(convexRows);
  return rank(
    ideasManifest.ideas as Array<{
      slug: string;
      title: string;
      description: string;
      category: string;
      buildTime: string;
      scores?: Scores;
    }>,
  );
}

export default function TopIdeasPage() {
  return <CachedTopIdeasPage />;
}

async function CachedTopIdeasPage() {
  "use cache";
  cacheTag("ideas");
  cacheLife("hours");

  const ideas = await loadTopIdeas();

  const schema = buildGraph(
    personSchema(),
    websiteSchema(),
    {
      ...collectionPageSchema({
        title: "Top Startup Ideas, Ranked by Research Score",
        description: DESCRIPTION,
        url: `${SITE}/startup-ideas/top`,
      }),
      mainEntity: itemListSchema(
        ideas.map((idea) => ({ slug: idea.slug, title: idea.title })),
      ),
    },
    breadcrumbSchema([
      { label: "Home", href: "/" },
      { label: "Startup Ideas", href: "/startup-ideas" },
      { label: "Top Ideas", href: "/startup-ideas/top" },
    ]),
  );

  return (
    <>
      <JsonLd schema={schema} />

      <section className="relative z-10">
        <div className="pt-32 pb-16 px-6">
          <div className="max-w-4xl mx-auto">
            <nav className="mb-8 text-xs text-neutral-500" aria-label="Breadcrumb">
              <Link href="/" className="hover:text-white transition-colors">
                Home
              </Link>
              <span className="mx-2">/</span>
              <Link
                href="/startup-ideas"
                className="hover:text-white transition-colors"
              >
                Startup Ideas
              </Link>
              <span className="mx-2">/</span>
              <span className="text-neutral-300">Top Ideas</span>
            </nav>

            <div className="flex items-center gap-3 mb-4">
              <Trophy size={28} className="text-white/40" aria-hidden="true" />
              <h1 className="text-3xl md:text-5xl font-medium text-white tracking-tight">
                Top Startup Ideas
              </h1>
            </div>
            <p className="text-lg text-neutral-400 font-light max-w-2xl mb-4">
              Every idea we publish is scored on four dimensions during
              research — <strong className="text-neutral-200">opportunity</strong>,{" "}
              <strong className="text-neutral-200">pain</strong>,{" "}
              <strong className="text-neutral-200">timing</strong>, and{" "}
              <strong className="text-neutral-200">builder confidence</strong>{" "}
              — each out of 10. This is the current top {ideas.length}, ranked
              by combined score out of 40.
            </p>
            <p className="text-sm text-neutral-500 mb-12">
              Updated as new ideas are published.{" "}
              <Link
                href="/startup-ideas"
                className="text-neutral-300 underline underline-offset-4 hover:text-white transition-colors"
              >
                Browse the full library
              </Link>
              .
            </p>

            <ol className="space-y-4" aria-label="Top-scored startup ideas">
              {ideas.map((idea, index) => (
                <li key={idea.slug}>
                  <Link
                    href={`/ideas/${idea.slug}`}
                    className="group flex flex-col md:flex-row md:items-center gap-4 p-6 bg-[#0A0A0A] border border-white/5 rounded-2xl hover:border-white/10 transition-all"
                  >
                    <span
                      className="text-2xl font-mono text-neutral-600 w-10 shrink-0 tabular-nums"
                      aria-hidden="true"
                    >
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span className="sr-only">Rank {index + 1}:</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <h2 className="text-lg font-medium text-white group-hover:text-neutral-200 transition-colors">
                          {idea.title}
                        </h2>
                      </div>
                      <p className="text-sm text-neutral-500 line-clamp-2 mb-2">
                        {idea.description}
                      </p>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-600">
                        <span>{categoryName(idea.category)}</span>
                        <span aria-hidden="true">·</span>
                        <span>~{idea.buildTime} hours to build</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 shrink-0">
                      <dl className="hidden lg:flex items-center gap-3">
                        {SCORE_COLUMNS.map(({ key, label }) => (
                          <div key={key} className="text-center">
                            <dt className="text-[10px] uppercase tracking-wider text-neutral-600">
                              {label}
                            </dt>
                            <dd className="text-sm text-neutral-300 tabular-nums">
                              {idea.scores[key]}
                            </dd>
                          </div>
                        ))}
                      </dl>
                      <div className="px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-center">
                        <span className="block text-lg font-semibold text-white tabular-nums">
                          {idea.total}
                        </span>
                        <span className="block text-[10px] uppercase tracking-wider text-neutral-500">
                          / 40
                        </span>
                      </div>
                      <ArrowRight
                        size={18}
                        className="text-neutral-600 group-hover:text-white group-hover:translate-x-1 transition-all"
                        aria-hidden="true"
                      />
                    </div>
                  </Link>
                </li>
              ))}
            </ol>

            <div className="mt-12 text-center">
              <Link
                href="/startup-ideas"
                className="inline-flex items-center gap-2 text-neutral-500 text-sm hover:text-white transition-colors"
              >
                <ArrowLeft size={16} aria-hidden="true" />
                See all startup ideas
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
