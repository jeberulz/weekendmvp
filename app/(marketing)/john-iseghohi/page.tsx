import type { Metadata } from "next";
import Link from "next/link";
import { cacheLife, cacheTag } from "next/cache";

import { Icon } from "@/components/home/icons";
import { Container, Em, buttonClass } from "@/components/home/ui";
import { JsonLd } from "@/components/primitives/JsonLd";
import { NavExternalLink } from "@/components/primitives/NavExternalLink";
import { PageHeader } from "@/components/public/PageHeader";
import { newsreaderEditorial } from "@/lib/fonts";
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
import { cn } from "@/lib/utils";

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

const FOCUS =
  "focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-home-orange-ink";

/** A ruled row: mono label in the left column, content on the right. */
function Row({
  id,
  label,
  children,
}: {
  id: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <section
      aria-labelledby={id}
      className="grid grid-cols-1 gap-4 border-t border-home-rule py-10 lg:grid-cols-[260px_minmax(0,1fr)] lg:gap-12"
    >
      <h2
        id={id}
        className="font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-home-ink-3 md:text-xs"
      >
        {label}
      </h2>
      <div>{children}</div>
    </section>
  );
}

export default async function AuthorPage() {
  const works = await getRecentArticles();

  const schema = buildGraph(
    {
      "@type": "ProfilePage",
      // Distinct from PERSON_ID — Google rich results FAIL when ProfilePage
      // @id equals mainEntity @id ("Invalid duplicate ID").
      "@id": `${SITE}${PERSON_PATH}#profilepage`,
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
      { label: "John Iseghohi" },
    ]),
  );

  return (
    <div
      className={cn(
        newsreaderEditorial.variable,
        "theme-desk relative min-h-screen overflow-x-clip bg-home-paper font-sans text-home-ink selection:bg-home-orange-light/40",
      )}
    >
      <JsonLd schema={schema} />

      <main id="main">
        <PageHeader
          eyebrow="Founder, Weekend MVP"
          title="John Iseghohi"
          description="Helping non-technical founders ship a real MVP in a weekend — ideas, checklists, and live build sessions."
          className="pb-12 lg:pb-14"
          aside={
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src="/image/john-portrait.webp"
              alt="John Iseghohi, founder of Weekend MVP"
              width={160}
              height={160}
              className="size-32 shrink-0 rounded-2xl border border-home-rule object-cover md:size-40"
            />
          }
        />

        <Container className="pb-20 lg:pb-28">
          <Row id="bio" label="Bio">
            <div className="flex max-w-[680px] flex-col gap-4 text-lg leading-[1.65] text-home-ink-2">
              <p>
                John Iseghohi founded{" "}
                <Link
                  href="/about"
                  className={cn(
                    "text-home-orange-ink underline underline-offset-4 transition-colors hover:text-home-ink motion-reduce:transition-none",
                    FOCUS,
                  )}
                >
                  Weekend MVP
                </Link>{" "}
                to close the gap between “I have an idea” and “here’s a live
                URL.” The site publishes research-backed startup idea
                breakdowns, practical build guides, and a free 48-hour starter
                kit aimed at people who ship on nights and weekends.
              </p>
              <p>
                He runs a community of 400+ weekend builders and hosts live
                workshops where attendees leave with a deployed MVP and a
                locked build plan — not another slide deck.
              </p>
            </div>
          </Row>

          {works.length > 0 ? (
            <Row id="writing" label="Recent writing">
              <ul>
                {works.map((item, i) => (
                  <li
                    key={item.slug}
                    className={cn("border-home-rule", i > 0 && "border-t")}
                  >
                    <Link
                      href={`/articles/${item.slug}`}
                      className={cn(
                        "group flex flex-col gap-1.5 py-5",
                        i === 0 && "pt-0",
                        FOCUS,
                      )}
                    >
                      <span className="flex items-center justify-between gap-4 font-editorial text-[22px] leading-[1.2] text-home-ink md:text-[24px]">
                        {item.title}
                        <Icon
                          name="arrow"
                          size={20}
                          strokeWidth={1.75}
                          color="var(--color-home-orange-ink)"
                          className="transition-transform duration-200 ease-[cubic-bezier(0.25,1,0.5,1)] group-hover:translate-x-0.5 motion-reduce:transition-none"
                        />
                      </span>
                      <span className="line-clamp-2 max-w-[680px] text-[15px] leading-[1.55] text-home-ink-2">
                        {item.description}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
              <p className="mt-4">
                <Link
                  href="/articles"
                  className={cn(
                    "inline-flex min-h-11 items-center text-[15px] font-medium text-home-orange-ink underline underline-offset-4 transition-colors hover:text-home-ink motion-reduce:transition-none",
                    FOCUS,
                  )}
                >
                  All articles
                </Link>
              </p>
            </Row>
          ) : null}

          <section
            aria-labelledby="contact"
            className="mt-6 flex flex-col gap-7 rounded-[22px] bg-home-ink p-7 text-home-d1 md:p-12 lg:flex-row lg:items-end lg:justify-between"
          >
            <div className="flex max-w-[640px] flex-col gap-3">
              <h2
                id="contact"
                className="font-editorial text-[32px] font-normal leading-[1.08] tracking-[-0.02em] text-balance md:text-[40px]"
              >
                Work with <Em dark>John</Em>
              </h2>
              <p className="text-base leading-[1.55] text-home-d2 md:text-[17px]">
                Book a call for MVP sprints, idea pressure-testing, or workshop
                seats. Or start free with the starter kit.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
              <NavExternalLink
                href={CAL_URL}
                className={buttonClass(
                  "dark",
                  "focus-visible:outline-home-orange-light",
                )}
              >
                Book a call
              </NavExternalLink>
              <Link
                href="/about"
                className={buttonClass(
                  "ghost-dark",
                  "focus-visible:outline-home-orange-light",
                )}
              >
                About Weekend MVP
              </Link>
              <NavExternalLink
                href="https://twitter.com/weekendmvp"
                className="inline-flex min-h-11 items-center px-2 text-[15px] font-medium text-home-d1 underline underline-offset-4 transition-colors hover:text-home-orange-light focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-home-orange-light motion-reduce:transition-none"
              >
                Follow on X
              </NavExternalLink>
            </div>
          </section>
        </Container>
      </main>
    </div>
  );
}
