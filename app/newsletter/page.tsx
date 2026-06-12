import type { Metadata } from "next";
import Link from "next/link";
import { cacheLife, cacheTag } from "next/cache";
import { fetchQuery } from "convex/nextjs";
import { ArrowRight, Rocket } from "lucide-react";

import { api } from "@/convex/_generated/api";
import { JsonLd } from "@/components/primitives/JsonLd";
import { MegaNav } from "@/components/layout/MegaNav";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { NewsletterSignupForm } from "@/components/newsletter/NewsletterSignupForm";
import { listMdxSlugs, readMdxFile } from "@/lib/mdx";

const SITE = "https://weekendmvp.app";
const CONTENT_DIR = "content/newsletter-pages";
const TITLE = "The Weekend MVP Newsletter | Daily Ideas for Weekend Builders";
const DESCRIPTION =
  "Twice-daily newsletter for weekend builders. Fresh startup ideas every morning, deeper build guides every afternoon. Free. Unsubscribe anytime.";

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  authors: [{ name: "John Iseghohi" }],
  alternates: { canonical: "/newsletter" },
  openGraph: {
    type: "website",
    url: `${SITE}/newsletter`,
    title: TITLE,
    description:
      "Twice-daily newsletter for weekend builders. Fresh startup ideas every morning, deeper build guides every afternoon.",
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
    title: "The Weekend MVP Newsletter",
    description: "Twice-daily newsletter for weekend builders. Free.",
    images: [`${SITE}/image/og-image.png`],
  },
};

type IssueCard = {
  slug: string;
  title: string;
  description?: string;
  edition: "am" | "pm";
  publishedAt?: number;
  /** Preformatted "May 22, 2026" (server-side, deterministic). */
  displayDate?: string;
  /** YYYY-MM-DD for <time datetime> */
  isoDate?: string;
};

/** ms-epoch or "2026-05-22" → "May 22, 2026" (cached scope only). */
function formatDate(value: number | string | undefined): string | undefined {
  if (value === undefined || value === null) return undefined;
  const date =
    typeof value === "number" ? new Date(value) : new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

const toIso = (ts: number | undefined) =>
  ts === undefined ? undefined : new Date(ts).toISOString().slice(0, 10);

/** Frontmatter listing from the committed issue MDX files. */
async function listFromFilesystem(): Promise<IssueCard[]> {
  const slugs = await listMdxSlugs(CONTENT_DIR);
  const files = await Promise.all(
    slugs.map((slug) => readMdxFile(CONTENT_DIR, slug)),
  );
  const items: IssueCard[] = [];
  for (const file of files) {
    if (!file) continue;
    const fm = file.frontmatter as {
      slug: string;
      title: string;
      description?: string;
      publishedAt?: string;
      edition?: "am" | "pm";
    };
    const ts = fm.publishedAt
      ? Date.parse(`${fm.publishedAt}T00:00:00Z`)
      : undefined;
    items.push({
      slug: fm.slug ?? file.slug,
      title: fm.title,
      description: fm.description,
      edition: fm.edition === "am" ? "am" : "pm",
      publishedAt: Number.isNaN(ts) ? undefined : ts,
      displayDate: formatDate(fm.publishedAt),
      isoDate: fm.publishedAt,
    });
  }
  // Newest first; AM/PM of the same day ordered PM before AM (legacy order).
  items.sort(
    (a, b) =>
      (b.publishedAt ?? 0) - (a.publishedAt ?? 0) ||
      b.slug.localeCompare(a.slug),
  );
  return items;
}

/**
 * Convex is the listing source (revalidated via the `newsletter` tag from
 * convex/newsletter.upsertBySlug); the MDX frontmatter on disk is the
 * build-time fallback when Convex is unreachable.
 */
async function getIssues(): Promise<IssueCard[]> {
  "use cache";
  cacheTag("newsletter");
  cacheLife("hours");

  const fsItems = await listFromFilesystem();
  try {
    const url = process.env.NEXT_PUBLIC_CONVEX_URL;
    if (!url) throw new Error("NEXT_PUBLIC_CONVEX_URL is not set");
    const docs = await fetchQuery(api.newsletter.list, {}, { url });
    if (!docs.length) throw new Error("newsletter_issues table is empty");
    const items = docs.map((doc) => ({
      slug: doc.slug,
      title: doc.title,
      description: doc.description,
      edition: doc.edition,
      publishedAt: doc.publishedAt,
      displayDate: formatDate(doc.publishedAt),
      isoDate: toIso(doc.publishedAt),
    }));
    items.sort(
      (a, b) =>
        (b.publishedAt ?? 0) - (a.publishedAt ?? 0) ||
        b.slug.localeCompare(a.slug),
    );
    return items;
  } catch {
    // Convex unavailable (e.g. at build time) — serve frontmatter listing.
    return fsItems;
  }
}

/** Archive card ported from the legacy newsletter-cards grid markup. */
function IssueCardLink({ issue }: { issue: IssueCard }) {
  const am = issue.edition === "am";
  return (
    <Link
      href={`/newsletter/${issue.slug}`}
      data-nl-card
      data-nl-slot={issue.edition}
      data-nl-date={issue.isoDate}
      className="nl-card group block p-6 bg-[#0A0A0A] border border-white/[0.06] rounded-2xl hover:border-white/20 transition-all"
    >
      <div className="flex items-center justify-between gap-3 mb-4">
        <span
          className={`px-2 py-1 rounded-md text-[10px] font-semibold uppercase tracking-wider border ${
            am
              ? "bg-[#CC5500]/10 border-[#CC5500]/30 text-[#CC5500]"
              : "bg-white/5 border-white/10 text-neutral-300"
          }`}
        >
          {am ? "AM · Idea of the Day" : "PM · Builder Brief"}
        </span>
        <time
          className="text-[11px] font-mono text-neutral-500"
          dateTime={issue.isoDate}
        >
          {issue.displayDate}
        </time>
      </div>
      <h3 className="text-lg font-medium text-white mb-2 leading-snug group-hover:text-[#CC5500] transition-colors">
        {issue.title}
      </h3>
      <p className="text-sm text-neutral-500 leading-relaxed line-clamp-2">
        {issue.description}
      </p>
      <div className="mt-4 flex items-center gap-2 text-xs text-neutral-600 group-hover:text-[#CC5500] transition-colors">
        <span>Read</span>
        <ArrowRight size={14} aria-hidden="true" />
      </div>
    </Link>
  );
}

export default async function NewsletterPage() {
  return (
    <>
      <MegaNav variant="dark" />
      <CachedNewsletterPage />
      <SiteFooter />
    </>
  );
}

async function CachedNewsletterPage() {
  "use cache";
  cacheTag("newsletter");
  cacheLife("hours");

  const issues = await getIssues();

  // CollectionPage + ItemList ported from the newsletter.html JSON-LD
  // (extensionless URLs).
  const schema = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "CollectionPage",
        name: "The Weekend MVP Newsletter",
        description:
          "Twice-daily newsletter for weekend builders. Fresh startup ideas every morning, deeper build guides every afternoon.",
        url: `${SITE}/newsletter`,
        mainEntity: {
          "@type": "ItemList",
          numberOfItems: issues.length,
          itemListElement: issues.map((issue, index) => ({
            "@type": "ListItem",
            position: index + 1,
            item: {
              "@type": "Article",
              name: issue.title,
              url: `${SITE}/newsletter/${issue.slug}`,
              ...(issue.isoDate ? { datePublished: issue.isoDate } : {}),
            },
          })),
        },
      },
    ],
  };

  return (
    <main className="relative z-10">
      <JsonLd schema={schema} />

      {/* Hero Section */}
      <section className="relative min-h-[60vh] flex items-center justify-center pt-32 pb-16 px-6 overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-[#CC5500]/5 blur-[120px] rounded-full pointer-events-none" />

        <div className="relative z-10 max-w-3xl mx-auto w-full text-center">
          {/* Terminal header */}
          <div className="animate-enter mb-8 flex justify-center">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.06] font-mono text-xs text-neutral-500">
              <span
                className="w-2 h-2 rounded-full bg-[#CC5500]/60 badge-pulse"
                aria-hidden="true"
              />
              <span className="sr-only">Status:</span>
              <span>~/newsletter</span>
            </div>
          </div>

          {/* Main heading */}
          <div className="animate-enter stagger-1">
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-semibold text-white tracking-tight leading-[1.05] mb-6">
              The Weekend&nbsp;MVP
              <br />
              Newsletter
            </h1>
            <p className="text-lg md:text-xl text-neutral-400 font-light leading-relaxed max-w-xl mx-auto mb-10">
              Twice-daily ideas for weekend builders. Morning: a fresh idea to
              ship this weekend. Afternoon: how to actually build it.
            </p>
          </div>

          {/* Subscribe form */}
          <div className="animate-enter stagger-2 max-w-md mx-auto">
            <NewsletterSignupForm utmCampaign="newsletter" />
          </div>

          {/* Stats bar */}
          <div className="animate-enter stagger-3 mt-10 flex items-center justify-center gap-6 text-xs font-mono text-neutral-500">
            <span>
              <span className="text-white">{issues.length}</span> sends
            </span>
            <span
              className="w-1 h-1 rounded-full bg-neutral-700"
              aria-hidden="true"
            />
            <span>AM + PM daily</span>
            <span
              className="w-1 h-1 rounded-full bg-neutral-700"
              aria-hidden="true"
            />
            <span>Free forever</span>
          </div>
        </div>
      </section>

      {/* Accent Line */}
      <div className="accent-line max-w-4xl mx-auto" />

      {/* Archive / Feed */}
      <section className="py-16 px-6">
        <div className="max-w-4xl mx-auto">
          <header className="mb-12">
            <h2 className="text-2xl md:text-3xl font-medium text-white tracking-tight mb-2">
              Past sends
            </h2>
            <p className="text-neutral-500 text-sm">
              Every newsletter we&apos;ve ever sent, archived for reading and
              sharing.
            </p>
          </header>

          <div
            id="newsletter-grid"
            className="grid grid-cols-1 md:grid-cols-2 gap-5"
          >
            {issues.map((issue) => (
              <IssueCardLink key={issue.slug} issue={issue} />
            ))}
          </div>
        </div>
      </section>

      {/* Mid CTA */}
      <section className="py-16 px-6 border-t border-white/5">
        <div className="max-w-3xl mx-auto text-center">
          <p className="text-neutral-400 text-sm mb-4">
            Want to build one of the ideas we feature?
          </p>
          <Link
            href="/startup-ideas"
            className="inline-flex items-center gap-2 px-6 py-3 bg-white/[0.03] border border-white/10 text-white rounded-full text-sm font-medium hover:bg-white/[0.06] hover:border-white/20 transition-all"
          >
            <span>Browse 45+ startup ideas</span>
            <ArrowRight size={14} aria-hidden="true" />
          </Link>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="py-24 border-t border-white/5 bg-gradient-to-b from-[#050505] to-[#0A0A0A]">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#CC5500]/10 border border-[#CC5500]/20 font-mono text-xs text-[#CC5500] mb-8">
            <Rocket size={14} aria-hidden="true" />
            Ready to ship?
          </div>
          <h2 className="text-3xl md:text-4xl font-semibold text-white tracking-tight mb-4">
            Stop reading. Start building.
          </h2>
          <p className="text-lg text-neutral-400 font-light mb-10 max-w-xl mx-auto">
            Get the Weekend MVP Starter Kit and turn your idea into something
            real this weekend.
          </p>
          <Link
            href="/starter-kit"
            className="inline-flex items-center gap-2 px-8 py-4 bg-white text-black rounded-full text-sm font-semibold tracking-tight hover:bg-neutral-200 transition-all shadow-[0_0_40px_-10px_rgba(255,255,255,0.3)]"
          >
            <span>Get the Starter Kit</span>
            <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </div>
      </section>
    </main>
  );
}
