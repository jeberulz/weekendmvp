import type { Metadata } from "next";
import Link from "next/link";
import { cacheLife, cacheTag } from "next/cache";
import { ArrowRight, Sun } from "lucide-react";

import ideasManifest from "@/ideas/manifest.json";
import { JsonLd } from "@/components/primitives/JsonLd";
import { MegaNav } from "@/components/layout/MegaNav";
import { SiteFooter } from "@/components/layout/SiteFooter";
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
 * /ideas/previous — the Idea of the Day archive: every published idea,
 * newest first, with publish dates. The compounding-index counterpart to
 * /ideas/today. Convex-first with a bundled-manifest fallback.
 */

const SITE = "https://www.weekendmvp.app";
const TITLE = "Previous Ideas of the Day | Weekend MVP";
const DESCRIPTION =
  "The full Idea of the Day archive — every research-backed, weekend-buildable startup idea we've published, newest first.";

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  authors: [{ name: "John Iseghohi" }],
  alternates: { canonical: "/ideas/previous" },
  openGraph: {
    type: "website",
    url: `${SITE}/ideas/previous`,
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

type ArchiveIdea = {
  slug: string;
  title: string;
  description: string;
  category: string;
  buildTime: string;
  publishedAt?: string;
};

/** "2026-06-09" → "Jun 9, 2026" (deterministic, UTC). */
function formatDate(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

async function loadArchive(): Promise<ArchiveIdea[]> {
  const rows = await fetchAllIdeas();
  if (rows.length > 0) {
    return rows.map((idea) => ({
      slug: idea.slug,
      title: idea.title,
      description: idea.description,
      category: idea.category,
      buildTime: idea.buildTime,
      publishedAt: new Date(idea.publishedAt).toISOString().slice(0, 10),
    }));
  }
  return [...(ideasManifest.ideas as ArchiveIdea[])].sort((a, b) =>
    (b.publishedAt ?? "").localeCompare(a.publishedAt ?? ""),
  );
}

export default function PreviousIdeasPage() {
  return (
    <>
      <MegaNav variant="dark" />
      <CachedPreviousIdeas />
      <SiteFooter />
    </>
  );
}

async function CachedPreviousIdeas() {
  "use cache";
  cacheTag("ideas");
  cacheLife("hours");

  const ideas = await loadArchive();

  const schema = buildGraph(
    personSchema(),
    websiteSchema(),
    {
      ...collectionPageSchema({
        title: "Previous Ideas of the Day",
        description: DESCRIPTION,
        url: `${SITE}/ideas/previous`,
      }),
      mainEntity: itemListSchema(
        ideas.map((idea) => ({ slug: idea.slug, title: idea.title })),
      ),
    },
    breadcrumbSchema([
      { label: "Home", href: "/" },
      { label: "Startup Ideas", href: "/startup-ideas" },
      { label: "Previous Ideas", href: "/ideas/previous" },
    ]),
  );

  return (
    <main className="relative z-10">
      <JsonLd schema={schema} />

      <section className="pt-32 pb-16 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-neutral-500 mb-6">
            <Sun size={14} aria-hidden="true" />
            <span>Idea of the Day · Archive</span>
          </div>
          <h1 className="text-3xl md:text-5xl font-medium text-white tracking-tight mb-4">
            Previous Ideas of the Day
          </h1>
          <p className="text-lg text-neutral-400 font-light max-w-2xl mb-4">
            Every idea we&apos;ve published, newest first — each with the full
            research: market size, competitors, business model, and AI build
            prompts.
          </p>
          <p className="text-sm text-neutral-500 mb-12">
            <Link
              href="/ideas/today"
              className="text-neutral-300 underline underline-offset-4 hover:text-white transition-colors"
            >
              See today&apos;s idea
            </Link>{" "}
            or{" "}
            <Link
              href="/startup-ideas"
              className="text-neutral-300 underline underline-offset-4 hover:text-white transition-colors"
            >
              filter the full library
            </Link>
            .
          </p>

          <ol className="space-y-4" aria-label="Published ideas, newest first">
            {ideas.map((idea) => (
              <li key={idea.slug}>
                <Link
                  href={`/ideas/${idea.slug}`}
                  className="group flex flex-col md:flex-row md:items-center gap-3 md:gap-6 p-6 bg-[#0A0A0A] border border-white/5 rounded-2xl hover:border-white/10 transition-all"
                >
                  <time
                    dateTime={idea.publishedAt}
                    className="shrink-0 w-28 text-xs font-mono text-neutral-500"
                  >
                    {formatDate(idea.publishedAt) ?? "—"}
                  </time>
                  <div className="flex-1 min-w-0">
                    <h2 className="text-base font-medium text-white group-hover:text-neutral-200 transition-colors mb-1">
                      {idea.title}
                    </h2>
                    <p className="text-sm text-neutral-500 line-clamp-2">
                      {idea.description}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0 text-xs text-neutral-600">
                    <span>{categoryName(idea.category)}</span>
                    <span aria-hidden="true">·</span>
                    <span>~{idea.buildTime}h</span>
                    <ArrowRight
                      size={16}
                      className="text-neutral-600 group-hover:text-white group-hover:translate-x-1 transition-all"
                      aria-hidden="true"
                    />
                  </div>
                </Link>
              </li>
            ))}
          </ol>
        </div>
      </section>
    </main>
  );
}
