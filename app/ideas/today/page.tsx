import type { Metadata } from "next";
import Link from "next/link";
import { cacheLife, cacheTag } from "next/cache";
import { fetchQuery } from "convex/nextjs";
import { ArrowRight, Clock, Sun } from "lucide-react";

import ideasManifest from "@/ideas/manifest.json";
import { api } from "@/convex/_generated/api";
import { JsonLd } from "@/components/primitives/JsonLd";
import { MegaNav } from "@/components/layout/MegaNav";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { NewsletterSignupForm } from "@/components/newsletter/NewsletterSignupForm";
import { IdeaCard } from "@/components/primitives/IdeaCard";
import { categoryName, revenueName } from "@/components/ideas/idea-meta";
import { breadcrumbSchema, buildGraph, personSchema, websiteSchema } from "@/lib/seo";

/**
 * /ideas/today — Idea of the Day.
 *
 * Previously a 302 to the latest idea (the URL is used in welcome emails —
 * it must keep resolving). Now a real page: the most recently published
 * idea with its research scores, a CTA into the full breakdown, the
 * newsletter capture, and a strip of recent ideas linking to the
 * /ideas/previous archive. Convex-first with a bundled-manifest fallback,
 * cached under the `ideas` tag so each publish revalidates it.
 */

const SITE = "https://www.weekendmvp.app";
const TITLE = "Today's Startup Idea | Weekend MVP";
const DESCRIPTION =
  "One research-backed startup idea you can build this weekend — refreshed with every new publish. Scores, market research, business model, and AI build prompts included.";

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  authors: [{ name: "John Iseghohi" }],
  alternates: { canonical: "/ideas/today" },
  openGraph: {
    type: "website",
    url: `${SITE}/ideas/today`,
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

type TodayIdea = {
  slug: string;
  title: string;
  description: string;
  category: string;
  buildTime: string;
  revenueGoal: string;
  publishedAt?: string;
  scores?: {
    opportunity: number;
    pain: number;
    timing: number;
    builder_confidence: number;
  } | null;
};

const SCORE_LABELS = [
  { key: "opportunity", label: "Opportunity" },
  { key: "pain", label: "Pain" },
  { key: "timing", label: "Timing" },
  { key: "builder_confidence", label: "Confidence" },
] as const;

/** "2026-06-09" or ms epoch → "June 9, 2026" (deterministic, UTC). */
function formatDate(value: string | number | undefined): string | undefined {
  if (value === undefined) return undefined;
  const date =
    typeof value === "number" ? new Date(value) : new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

function manifestIdeas(): TodayIdea[] {
  return [...(ideasManifest.ideas as TodayIdea[])].sort((a, b) =>
    (b.publishedAt ?? "").localeCompare(a.publishedAt ?? ""),
  );
}

/** Latest ideas, newest first: Convex when reachable, else the manifest. */
async function loadLatestIdeas(count: number): Promise<TodayIdea[]> {
  try {
    const result = await fetchQuery(api.ideas.list, { limit: count });
    if (result.page.length > 0) {
      return result.page.map((idea) => ({
        slug: idea.slug,
        title: idea.title,
        description: idea.description,
        category: idea.category,
        buildTime: idea.buildTime,
        revenueGoal: idea.revenueGoal,
        publishedAt: new Date(idea.publishedAt).toISOString().slice(0, 10),
        scores: idea.scores ?? null,
      }));
    }
  } catch {
    /* Convex unavailable — fall through to the manifest */
  }
  return manifestIdeas().slice(0, count);
}

export default function IdeaOfTheDayPage() {
  return (
    <>
      <MegaNav variant="dark" />
      <CachedIdeaOfTheDay />
      <SiteFooter />
    </>
  );
}

async function CachedIdeaOfTheDay() {
  "use cache";
  cacheTag("ideas");
  cacheLife("hours");

  const [today, ...recent] = await loadLatestIdeas(7);

  const schema = buildGraph(
    personSchema(),
    websiteSchema(),
    breadcrumbSchema([
      { label: "Home", href: "/" },
      { label: "Startup Ideas", href: "/startup-ideas" },
      { label: "Idea of the Day", href: "/ideas/today" },
    ]),
  );

  return (
    <main className="relative z-10">
      <JsonLd schema={schema} />

      <section className="pt-32 pb-16 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-neutral-500 mb-6">
            <Sun size={14} aria-hidden="true" />
            <span>Idea of the Day</span>
            {today?.publishedAt ? (
              <>
                <span aria-hidden="true">·</span>
                <time dateTime={today.publishedAt} className="text-neutral-400">
                  {formatDate(today.publishedAt)}
                </time>
              </>
            ) : null}
          </div>

          {today ? (
            <>
              <h1 className="text-4xl md:text-6xl font-medium text-white tracking-tight mb-6">
                {today.title}
              </h1>
              <p className="text-lg md:text-xl text-neutral-400 font-light max-w-2xl mb-8">
                {today.description}
              </p>

              <div className="flex flex-wrap items-center gap-3 mb-8 text-sm text-neutral-400">
                <span className="px-3 py-1 bg-white/5 border border-white/10 rounded-full text-xs font-medium">
                  {categoryName(today.category)}
                </span>
                <span className="inline-flex items-center gap-1.5 text-xs">
                  <Clock size={14} aria-hidden="true" />~{today.buildTime} hours
                  to build
                </span>
                <span aria-hidden="true" className="text-neutral-600">
                  ·
                </span>
                <span className="text-xs">
                  {revenueName(today.revenueGoal)} goal
                </span>
              </div>

              {today.scores ? (
                <ul
                  className="flex flex-wrap gap-2 mb-10"
                  aria-label="Idea research scores"
                >
                  {SCORE_LABELS.map(({ key, label }) => (
                    <li
                      key={key}
                      className="px-3 py-1.5 bg-white/5 border border-white/10 rounded-full text-xs font-medium text-neutral-300"
                    >
                      {label} {today.scores?.[key]}/10
                    </li>
                  ))}
                </ul>
              ) : null}

              <Link
                href={`/ideas/${today.slug}`}
                className="inline-flex items-center gap-2 px-8 py-4 bg-white text-black rounded-full text-sm font-semibold tracking-tight hover:bg-neutral-200 transition-all"
              >
                <span>Read the full breakdown</span>
                <ArrowRight size={16} aria-hidden="true" />
              </Link>
              <p className="mt-4 text-xs text-neutral-500">
                Market research, competitors, business model, tech stack, and
                AI build prompts — all on the idea page.
              </p>
            </>
          ) : (
            <>
              <h1 className="text-4xl md:text-6xl font-medium text-white tracking-tight mb-6">
                Today&apos;s idea is loading
              </h1>
              <p className="text-lg text-neutral-400 font-light mb-8">
                Browse the full library while we fetch it.
              </p>
              <Link
                href="/startup-ideas"
                className="inline-flex items-center gap-2 px-8 py-4 bg-white text-black rounded-full text-sm font-semibold tracking-tight hover:bg-neutral-200 transition-all"
              >
                <span>Browse startup ideas</span>
                <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </>
          )}
        </div>
      </section>

      {/* Newsletter capture */}
      <section className="py-16 px-6 border-t border-white/5">
        <div className="max-w-xl mx-auto text-center">
          <h2 className="text-2xl font-medium text-white tracking-tight mb-3">
            Get tomorrow&apos;s idea in your inbox
          </h2>
          <p className="text-sm text-neutral-400 mb-8">
            A fresh, researched startup idea every morning, plus a build guide
            every afternoon.
          </p>
          <NewsletterSignupForm utmCampaign="newsletter" />
        </div>
      </section>

      {/* Recent ideas */}
      {recent.length > 0 ? (
        <section className="py-16 px-6 border-t border-white/5">
          <div className="max-w-6xl mx-auto">
            <header className="flex items-end justify-between gap-4 mb-8">
              <h2 className="text-2xl font-medium text-white tracking-tight">
                Previous ideas of the day
              </h2>
              <Link
                href="/ideas/previous"
                className="inline-flex items-center gap-1.5 text-sm text-neutral-400 hover:text-white transition-colors"
              >
                <span>View the archive</span>
                <ArrowRight size={14} aria-hidden="true" />
              </Link>
            </header>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {recent.map((idea) => (
                <IdeaCard
                  key={idea.slug}
                  surface="elevated"
                  idea={{
                    slug: idea.slug,
                    title: idea.title,
                    description: idea.description,
                    category: idea.category,
                    categoryLabel: categoryName(idea.category),
                    buildTime: idea.buildTime,
                  }}
                />
              ))}
            </div>
          </div>
        </section>
      ) : null}
    </main>
  );
}
