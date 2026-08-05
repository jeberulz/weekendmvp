import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { cacheLife, cacheTag } from "next/cache";

import { AuraBackground } from "@/components/marketing/AuraBackground";
import { JsonLd } from "@/components/primitives/JsonLd";
import { NavExternalLink } from "@/components/primitives/NavExternalLink";
import { listMdxSlugs, readMdxFile } from "@/lib/mdx";
import {
  SITE,
  breadcrumbSchema,
  buildGraph,
  faqPageSchema,
  organizationSchema,
  PERSON_ID,
  PERSON_PATH,
  personSchema,
} from "@/lib/seo";

const TITLE = "John Iseghohi";
const DESCRIPTION =
  "John Iseghohi is the founder of Weekend MVP. He helps non-technical founders ship MVPs in a weekend — with 400+ builders in the community and dozens of research-backed startup ideas broken down on weekendmvp.app.";
const CAL_URL = "https://cal.com/switchtoux";
const ARTICLES_DIR = "content/articles";
const WORKS_LIMIT = 6;

export const metadata: Metadata = {
  title: { absolute: `${TITLE} | Founder of Weekend MVP` },
  description: DESCRIPTION,
  authors: [{ name: TITLE, url: PERSON_PATH }],
  alternates: { canonical: PERSON_PATH },
  openGraph: {
    type: "profile",
    url: `${SITE}${PERSON_PATH}`,
    title: `${TITLE} | Founder of Weekend MVP`,
    description: DESCRIPTION,
    images: [
      {
        url: `${SITE}/image/john-portrait.jpg`,
        width: 800,
        height: 800,
        alt: "John Iseghohi, founder of Weekend MVP",
        type: "image/jpeg",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: `${TITLE} | Founder of Weekend MVP`,
    description: DESCRIPTION,
    images: [`${SITE}/image/john-portrait.jpg`],
  },
};

type WorkItem = { slug: string; title: string; description: string };

async function getRecentArticles(): Promise<WorkItem[]> {
  "use cache";
  cacheTag("articles");
  cacheLife("hours");

  const slugs = await listMdxSlugs(ARTICLES_DIR);
  const files = await Promise.all(
    slugs.map((slug) => readMdxFile(ARTICLES_DIR, slug)),
  );

  const items: Array<WorkItem & { publishedAt?: number }> = [];
  for (const file of files) {
    if (!file) continue;
    const fm = file.frontmatter as {
      slug?: string;
      title?: string;
      description?: string;
      publishedAt?: string;
    };
    if (!fm.title || !fm.description) continue;
    const ts = fm.publishedAt
      ? Date.parse(`${fm.publishedAt}T00:00:00Z`)
      : undefined;
    items.push({
      slug: fm.slug ?? file.slug,
      title: fm.title,
      description: fm.description,
      publishedAt: Number.isNaN(ts) ? undefined : ts,
    });
  }
  items.sort((a, b) => (b.publishedAt ?? 0) - (a.publishedAt ?? 0));
  return items.slice(0, WORKS_LIMIT).map(({ slug, title, description }) => ({
    slug,
    title,
    description,
  }));
}

export default async function AuthorPage() {
  const works = await getRecentArticles();

  const schema = buildGraph(
    {
      "@type": "ProfilePage",
      "@id": `${SITE}${PERSON_PATH}`,
      name: TITLE,
      description: DESCRIPTION,
      url: `${SITE}${PERSON_PATH}`,
      mainEntity: { "@id": PERSON_ID },
      isPartOf: { "@id": `${SITE}/#website` },
    },
    personSchema(),
    organizationSchema(),
    faqPageSchema([
      {
        question: "Who is John Iseghohi?",
        answer:
          "John Iseghohi is the founder of Weekend MVP. He runs a community of 400+ weekend builders and publishes research-backed startup idea breakdowns, guides, and live workshops so non-technical founders can ship an MVP in a weekend.",
      },
      {
        question: "What is Weekend MVP?",
        answer:
          "Weekend MVP is a site and starter kit for shipping a real product in 48 hours — validated ideas, build guides, AI prompts, and workshops. Learn more at weekendmvp.app/about.",
      },
    ]),
    breadcrumbSchema([
      { label: "Home", href: "/" },
      { label: "John Iseghohi", href: PERSON_PATH },
    ]),
  );

  return (
    <div className="relative min-h-screen overflow-x-hidden pt-24 selection:bg-white/20 selection:text-white">
      <JsonLd schema={schema} />
      <AuraBackground />
      <div className="fixed inset-0 pointer-events-none z-0 grid-lines" />
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-full max-w-3xl h-96 bg-white/5 blur-[120px] rounded-full pointer-events-none -z-10 mix-blend-screen" />

      <main className="relative z-10 max-w-3xl mx-auto px-6 py-32 mb-24">
        <header className="mb-16 flex flex-col sm:flex-row sm:items-end gap-8">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/image/john-portrait.webp"
            alt="John Iseghohi, founder of Weekend MVP"
            width={160}
            height={160}
            className="w-32 h-32 md:w-40 md:h-40 rounded-2xl object-cover border border-white/10 shrink-0"
          />
          <div>
            <p className="text-neutral-500 text-xs font-medium uppercase tracking-wider mb-3">
              Founder, Weekend MVP
            </p>
            <h1 className="text-4xl md:text-5xl font-medium text-white tracking-tight mb-3">
              John Iseghohi
            </h1>
            <p className="text-neutral-400 leading-relaxed max-w-xl">
              Helping non-technical founders ship a real MVP in a weekend —
              ideas, checklists, and live build sessions.
            </p>
          </div>
        </header>

        <section className="mb-16" aria-labelledby="bio">
          <h2
            id="bio"
            className="text-white font-medium text-xl mb-4 tracking-tight"
          >
            Bio
          </h2>
          <div className="space-y-4 text-neutral-400 leading-relaxed">
            <p>
              John Iseghohi founded{" "}
              <Link
                href="/about"
                className="text-neutral-200 hover:text-white underline underline-offset-2"
              >
                Weekend MVP
              </Link>{" "}
              to close the gap between “I have an idea” and “here’s a live URL.”
              The site publishes research-backed startup idea breakdowns,
              practical build guides, and a free 48-hour starter kit aimed at
              people who ship on nights and weekends.
            </p>
            <p>
              He runs a community of 400+ weekend builders and hosts live
              workshops where attendees leave with a deployed MVP and a locked
              build plan — not another slide deck.
            </p>
          </div>
        </section>

        {works.length > 0 ? (
          <section className="mb-16" aria-labelledby="writing">
            <h2
              id="writing"
              className="text-white font-medium text-xl mb-6 tracking-tight"
            >
              Recent writing
            </h2>
            <ul className="space-y-5">
              {works.map((item) => (
                <li key={item.slug}>
                  <Link
                    href={`/articles/${item.slug}`}
                    className="group block focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white/40 rounded-sm"
                  >
                    <span className="text-white font-medium group-hover:text-neutral-200 transition-colors inline-flex items-center gap-2">
                      {item.title}
                      <ArrowRight
                        className="w-4 h-4 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all"
                        aria-hidden="true"
                      />
                    </span>
                    <span className="block text-sm text-neutral-500 mt-1 leading-relaxed line-clamp-2">
                      {item.description}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
            <p className="mt-6">
              <Link
                href="/articles"
                className="text-sm text-neutral-400 hover:text-white transition-colors underline underline-offset-2"
              >
                All articles
              </Link>
            </p>
          </section>
        ) : null}

        <section
          className="rounded-2xl border border-white/10 bg-white/[0.02] p-8"
          aria-labelledby="contact"
        >
          <h2
            id="contact"
            className="text-white font-medium text-lg mb-2 tracking-tight"
          >
            Work with John
          </h2>
          <p className="text-neutral-400 text-sm leading-relaxed mb-6">
            Book a call for MVP sprints, idea pressure-testing, or workshop
            seats. Or start free with the starter kit.
          </p>
          <div className="flex flex-wrap gap-4">
            <NavExternalLink
              href={CAL_URL}
              className="inline-flex items-center justify-center px-5 py-2.5 rounded-full bg-white text-black text-sm font-medium hover:bg-neutral-200 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              Book a call
            </NavExternalLink>
            <Link
              href="/about"
              className="inline-flex items-center justify-center px-5 py-2.5 rounded-full border border-white/15 text-white text-sm font-medium hover:bg-white/5 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              About Weekend MVP
            </Link>
            <NavExternalLink
              href="https://twitter.com/weekendmvp"
              className="inline-flex items-center justify-center px-5 py-2.5 text-sm text-neutral-400 hover:text-white transition-colors"
            >
              Follow on X
            </NavExternalLink>
          </div>
        </section>
      </main>
    </div>
  );
}
