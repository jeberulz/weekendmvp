import fs from "node:fs/promises";
import path from "node:path";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cacheLife, cacheTag } from "next/cache";
import { fetchQuery } from "convex/nextjs";
import { ArrowLeft, DollarSign } from "lucide-react";

import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import { JsonLd } from "@/components/primitives/JsonLd";
import { NavExternalLink } from "@/components/primitives/NavExternalLink";
import { Mdx, listMdxSlugs, readMdxFile } from "@/lib/mdx";
import {
  articleSchema,
  breadcrumbSchema,
  buildGraph,
  howToSchema,
  personSchema,
  softwareApplicationSchema,
} from "@/lib/seo";
import { EmailGate } from "@/components/ideas/EmailGate";
import { IdeaSidebar } from "@/components/ideas/IdeaSidebar";
import { RelatedIdeas } from "@/components/ideas/RelatedIdeas";
import { ideaMdxComponents } from "@/components/ideas/mdx-light";
import {
  CATEGORY_META,
  audienceName,
  categoryName,
  revenueName,
  tocFromMarkdown,
  toolName,
} from "@/components/ideas/idea-meta";
import {
  COLLECTION_SLUGS,
  getCollectionMeta,
  renderCollection,
} from "./collection";

const CONTENT_DIR = "content/ideas";
const SITE = "https://weekendmvp.app";
const DEFAULT_OG = "/image/og-image.png";

type IdeaDoc = Doc<"ideas">;

type ResolvedIdea = {
  source: "mdx" | "convex";
  title: string;
  description: string;
  content: string;
  /** Convex metadata row; null when Convex is unavailable (e.g. at build). */
  idea: IdeaDoc | null;
  /** Site-relative OG path — per-idea when the file exists, else default. */
  ogImage: string;
};

/* ------------------------------------------------------------------ */
/* Markdown helpers (deterministic string parsing, cached scope only)  */
/* ------------------------------------------------------------------ */

function stripMd(text: string): string {
  return text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[*_`]/g, "")
    .trim();
}

/** First body paragraph of the markdown — metadata stub when Convex is down. */
function excerpt(markdown: string, max = 160): string {
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

/** Raw markdown of one `## {heading}` section. */
function sectionBody(markdown: string, heading: string): string {
  const re = new RegExp(
    `^##\\s+${heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*$`,
    "mi",
  );
  const match = re.exec(markdown);
  if (!match) return "";
  const rest = markdown.slice(match.index + match[0].length);
  const next = rest.search(/^##\s+/m);
  return (next === -1 ? rest : rest.slice(0, next)).trim();
}

function firstParagraph(block: string): string {
  for (const para of block.split(/\n\s*\n/)) {
    const text = para.trim();
    if (!text || text.startsWith("#") || text.startsWith("```")) continue;
    return stripMd(text.replace(/\n/g, " "));
  }
  return "";
}

/**
 * The 3 numbered items under "**How it works:**" in The Solution —
 * the source of the legacy HowTo schema's step texts.
 */
function howItWorksSteps(markdown: string): string[] {
  const steps: string[] = [];
  const start = markdown.search(/\*\*How it works:?\*\*/i);
  if (start === -1) return steps;
  for (const line of markdown.slice(start).split("\n")) {
    const match = /^\s*\d+\.\s+(.+)$/.exec(line);
    if (match) steps.push(stripMd(match[1]));
    if (steps.length >= 3) break;
  }
  return steps;
}

/* ------------------------------------------------------------------ */
/* Data resolution (R4-critical: everything is server-side)            */
/*                                                                     */
/* Order: (a) content/ideas/{slug}.mdx on disk → MDX body;             */
/*        (b) Convex row with bodyMode 'convex' + body → Convex body;  */
/*        (c) neither → null (page falls through to renderCollection). */
/*                                                                     */
/* Convex metadata is fetched with a try/catch: at build time the      */
/* deployment may be unreachable, in which case the page renders from  */
/* MDX frontmatter + a derived-excerpt metadata stub and skips the     */
/* Convex-only sections (meta chips, Explore More, Related Ideas).     */
/* ------------------------------------------------------------------ */

async function fetchIdeaRow(slug: string): Promise<IdeaDoc | null> {
  try {
    return await fetchQuery(api.ideas.bySlug, { slug });
  } catch {
    return null;
  }
}

async function ideaOgImage(slug: string): Promise<string> {
  try {
    await fs.access(
      path.join(process.cwd(), "image", "og", "idea", `${slug}.png`),
    );
    return `/image/og/idea/${slug}.png`;
  } catch {
    return DEFAULT_OG;
  }
}

async function resolveIdea(slug: string): Promise<ResolvedIdea | null> {
  "use cache";
  cacheTag(`idea:${slug}`, "ideas");
  cacheLife("hours");

  const [file, idea, ogImage] = await Promise.all([
    readMdxFile(CONTENT_DIR, slug),
    fetchIdeaRow(slug),
    ideaOgImage(slug),
  ]);

  if (file) {
    const fmTitle = file.frontmatter.title;
    return {
      source: "mdx",
      title:
        idea?.title ?? (typeof fmTitle === "string" ? fmTitle : slug),
      description: idea?.description ?? excerpt(file.content),
      content: file.content,
      idea,
      ogImage,
    };
  }

  if (idea && idea.bodyMode === "convex" && idea.body) {
    return {
      source: "convex",
      title: idea.title,
      description: idea.description,
      content: idea.body,
      idea,
      ogImage,
    };
  }

  return null;
}

/* ------------------------------------------------------------------ */
/* Static params + metadata                                            */
/* ------------------------------------------------------------------ */

export async function generateStaticParams() {
  // Filesystem only — Convex may be unavailable at build time. listMdxSlugs
  // skips _-prefixed entries, which excludes content/ideas/_quarantine.
  const slugs = await listMdxSlugs(CONTENT_DIR);
  return [...slugs, ...COLLECTION_SLUGS].map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const resolved = await resolveIdea(slug);
  if (!resolved) {
    // Collection hub fallback (U11): use the collection's own copy.
    const collection = getCollectionMeta(slug);
    if (collection) {
      const collectionUrl = `${SITE}/ideas/${slug}`;
      return {
        title: { absolute: `${collection.title} | Weekend MVP` },
        description: collection.description,
        alternates: { canonical: `/ideas/${slug}` },
        openGraph: {
          type: "website",
          url: collectionUrl,
          title: `${collection.title} | Weekend MVP`,
          description: collection.description,
          images: [`${SITE}/image/og-image.png`],
        },
        twitter: {
          card: "summary_large_image",
          title: `${collection.title} | Weekend MVP`,
          description: collection.description,
          images: [`${SITE}/image/og-image.png`],
        },
      };
    }
    return {}; // 404 path
  }
  const { title, description, ogImage } = resolved;
  const url = `${SITE}/ideas/${slug}`;
  const ogImageAbs = `${SITE}${ogImage}`;
  // Legacy published <title> pattern: "{title} | Startup Ideas | Weekend MVP"
  const fullTitle = `${title} | Startup Ideas | Weekend MVP`;
  return {
    title: { absolute: fullTitle },
    description,
    authors: [{ name: "John Iseghohi" }],
    alternates: { canonical: `/ideas/${slug}` },
    openGraph: {
      type: "article",
      url,
      title: `${title} | Startup Ideas`,
      description,
      images: [
        {
          url: ogImageAbs,
          alt: "Weekend MVP — ship your product in 48 hours",
          type: "image/png",
          width: 1200,
          height: 630,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: `${title} | Startup Ideas`,
      description,
      images: [ogImageAbs],
    },
  };
}

/* ------------------------------------------------------------------ */
/* JSON-LD @graph — Person, Article, SoftwareApplication, HowTo,       */
/* BreadcrumbList (extensionless URLs)                                 */
/* ------------------------------------------------------------------ */

const HOWTO_STEP_NAMES = ["Project Setup", "Core Feature", "Landing Page"];

function buildSchema(slug: string, resolved: ResolvedIdea) {
  const { title, description, content, idea, ogImage } = resolved;
  const url = `${SITE}/ideas/${slug}`;
  const ogImageAbs = `${SITE}${ogImage}`;
  const solutionDescription =
    firstParagraph(sectionBody(content, "The Solution")) || description;
  const parsedSteps = howItWorksSteps(content);
  const stepTexts =
    parsedSteps.length === 3
      ? parsedSteps
      : HOWTO_STEP_NAMES.map(() => solutionDescription);
  const steps = HOWTO_STEP_NAMES.map((name, i) => ({
    name,
    text: stepTexts[i],
  }));

  const datePublished = idea
    ? new Date(idea.publishedAt).toISOString().slice(0, 10)
    : undefined;
  const buildHours =
    idea && /^\d+$/.test(idea.buildTime) ? idea.buildTime : undefined;

  return buildGraph(
    personSchema(),
    articleSchema({
      title,
      description,
      slug,
      pathPrefix: "/ideas",
      datePublished,
      image: ogImageAbs,
      authorRef: true,
    }),
    softwareApplicationSchema({
      name: title,
      applicationCategory: idea?.applicationCategory ?? "BusinessApplication",
      description: solutionDescription,
    }),
    howToSchema({
      name: `Build ${title} MVP`,
      description: `Step-by-step guide to building ${title} in a weekend.`,
      steps,
      totalTime: buildHours ? `PT${buildHours}H` : undefined,
    }),
    breadcrumbSchema([
      { label: "Home", href: "/" },
      { label: "Startup Ideas", href: "/startup-ideas" },
      { label: title, href: url },
    ]),
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default async function IdeaPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const resolved = await resolveIdea(slug);
  if (!resolved) {
    // Not an idea — maybe a collection hub slug (U11 extension point).
    const collection = await renderCollection(slug);
    if (collection) return collection;
    notFound();
  }
  return <CachedIdeaPage slug={slug} />;
}

const SCORE_LABELS: Array<{
  key: "opportunity" | "pain" | "timing" | "builder_confidence";
  label: string;
}> = [
  { key: "opportunity", label: "Opportunity" },
  { key: "pain", label: "Pain" },
  { key: "timing", label: "Timing" },
  { key: "builder_confidence", label: "Confidence" },
];

function IdeaMetaCard({ idea }: { idea: IdeaDoc }) {
  return (
    <div className="p-4 bg-neutral-100 border border-neutral-200 rounded-2xl text-sm">
      <dl className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <dt className="text-neutral-500 text-xs">Category</dt>
          <dd className="text-neutral-900 text-xs font-medium">
            {categoryName(idea.category)}
          </dd>
        </div>
        <div className="flex items-center justify-between gap-2">
          <dt className="text-neutral-500 text-xs">Build time</dt>
          <dd className="text-neutral-900 text-xs font-medium">
            ~{idea.buildTime} hours
          </dd>
        </div>
        <div className="flex items-center justify-between gap-2">
          <dt className="text-neutral-500 text-xs">Revenue goal</dt>
          <dd className="text-neutral-900 text-xs font-medium">
            {revenueName(idea.revenueGoal)}
          </dd>
        </div>
        {idea.scores
          ? SCORE_LABELS.map(({ key, label }) => (
              <div
                key={key}
                className="flex items-center justify-between gap-2"
              >
                <dt className="text-neutral-500 text-xs">{label}</dt>
                <dd className="text-neutral-900 text-xs font-medium">
                  {idea.scores?.[key]}/10
                </dd>
              </div>
            ))
          : null}
      </dl>
    </div>
  );
}

/** Data + render cached together; revalidated via `idea:<slug>` / `ideas`. */
async function CachedIdeaPage({ slug }: { slug: string }) {
  "use cache";
  cacheTag(`idea:${slug}`, "ideas");
  cacheLife("hours");

  const resolved = await resolveIdea(slug);
  if (!resolved) notFound();
  const { title, description, content, idea } = resolved;
  const toc = tocFromMarkdown(content);
  const schema = buildSchema(slug, resolved);
  const CategoryIcon = idea ? CATEGORY_META[idea.category]?.icon : undefined;

  return (
    <>
      <JsonLd schema={schema} />

      {/* R4: the idea body below is in the server HTML, visible by default.
          EmailGate is a client overlay applied only after hydration. */}
      <EmailGate slug={slug} title={title} description={description}>
        <div className="max-w-6xl mx-auto px-6 lg:px-8">
          <div className="flex flex-col lg:flex-row gap-8 lg:gap-12 pt-[7.5rem] pb-16">
            <IdeaSidebar sections={toc}>
              {idea ? <IdeaMetaCard idea={idea} /> : null}
            </IdeaSidebar>

            {/* Main Content */}
            <main className="flex-1 max-w-2xl min-w-0">
              {/* Breadcrumb */}
              <nav
                className="mb-8 text-xs text-neutral-400"
                aria-label="Breadcrumb"
              >
                <Link href="/" className="hover:text-black transition-colors">
                  Home
                </Link>
                <span className="mx-2">/</span>
                <Link
                  href="/startup-ideas"
                  className="hover:text-black transition-colors"
                >
                  Startup Ideas
                </Link>
                <span className="mx-2">/</span>
                <span className="text-neutral-600">{title}</span>
              </nav>

              {/* Header */}
              <header className="mb-12">
                <div className="flex flex-wrap items-center gap-3 mb-4">
                  {idea ? (
                    <>
                      <span className="px-3 py-1 bg-black text-white text-[10px] font-bold uppercase tracking-widest rounded-full">
                        {categoryName(idea.category)}
                      </span>
                      <span className="text-neutral-400 text-xs">
                        ~{idea.buildTime} hours to build
                      </span>
                      <span
                        className="text-neutral-300 text-xs"
                        aria-hidden="true"
                      >
                        ·
                      </span>
                      <span className="text-neutral-400 text-xs">
                        {revenueName(idea.revenueGoal)} goal
                      </span>
                    </>
                  ) : null}
                </div>
                <h1 className="text-4xl md:text-5xl font-medium text-black tracking-tight mb-4">
                  {title}
                </h1>
                <p className="text-xl text-neutral-500 font-light">
                  {description}
                </p>
                {idea?.scores ? (
                  <ul className="flex flex-wrap gap-2 mt-6" aria-label="Idea scores">
                    {SCORE_LABELS.map(({ key, label }) => (
                      <li
                        key={key}
                        className="px-3 py-1.5 bg-neutral-100 border border-neutral-200 rounded-full text-xs font-medium text-neutral-600"
                      >
                        {label} {idea.scores?.[key]}/10
                      </li>
                    ))}
                  </ul>
                ) : null}
              </header>

              {/* Body — server-rendered MDX (or Convex-stored markdown) */}
              <Mdx
                source={content}
                components={ideaMdxComponents}
                codeTheme="github-light"
              />

              {/* Explore More (cross-linking) */}
              {idea ? (
                <div
                  id="section-explore"
                  className="mt-12 mb-12 scroll-mt-[7.5rem]"
                >
                  <h2 className="text-2xl font-medium mb-6 text-black tracking-tight">
                    Explore More
                  </h2>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                    <Link
                      href={`/ideas/${idea.category}`}
                      className="group flex items-center gap-4 p-4 bg-neutral-100 border border-neutral-200 rounded-2xl hover:bg-neutral-200/50 hover:border-neutral-300 transition-all"
                    >
                      <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm">
                        {CategoryIcon ? (
                          <CategoryIcon
                            size={20}
                            className="text-neutral-600"
                            aria-hidden="true"
                          />
                        ) : null}
                      </div>
                      <div>
                        <span className="text-sm font-medium text-neutral-900 group-hover:text-black transition-colors">
                          More {categoryName(idea.category)} Ideas
                        </span>
                        <p className="text-xs text-neutral-500">
                          Browse similar ideas
                        </p>
                      </div>
                    </Link>

                    <Link
                      href={`/ideas/${idea.revenueGoal}`}
                      className="group flex items-center gap-4 p-4 bg-neutral-100 border border-neutral-200 rounded-2xl hover:bg-neutral-200/50 hover:border-neutral-300 transition-all"
                    >
                      <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm">
                        <DollarSign
                          size={20}
                          className="text-neutral-600"
                          aria-hidden="true"
                        />
                      </div>
                      <div>
                        <span className="text-sm font-medium text-neutral-900 group-hover:text-black transition-colors">
                          {revenueName(idea.revenueGoal)} Ideas
                        </span>
                        <p className="text-xs text-neutral-500">
                          By revenue potential
                        </p>
                      </div>
                    </Link>
                  </div>

                  {idea.tools.length > 0 ? (
                    <div className="mb-6">
                      <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-3">
                        Build with
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {idea.tools.map((tool) => (
                          <Link
                            key={tool}
                            href={`/build-with/${tool}`}
                            className="px-3 py-1.5 bg-neutral-100 border border-neutral-200 rounded-full text-xs font-medium text-neutral-600 hover:text-black hover:border-neutral-300 transition-all"
                          >
                            {toolName(tool)}
                          </Link>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {idea.audiences.length > 0 ? (
                    <div className="mb-6">
                      <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-3">
                        Perfect for
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {idea.audiences.map((audience) => (
                          <Link
                            key={audience}
                            href={`/ideas-for/${audience}`}
                            className="px-3 py-1.5 bg-neutral-100 border border-neutral-200 rounded-full text-xs font-medium text-neutral-600 hover:text-black hover:border-neutral-300 transition-all"
                          >
                            {audienceName(audience)}
                          </Link>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  <RelatedIdeas slug={slug} />
                </div>
              ) : null}

              {/* CTA */}
              <div className="p-12 bg-black rounded-[3rem] text-center mt-12">
                <h2 className="text-2xl font-medium text-white tracking-tight mb-4">
                  Want me to build this for you?
                </h2>
                <p className="text-neutral-400 mb-8">
                  Book a consult and let&apos;s turn this idea into your MVP.
                </p>
                <NavExternalLink
                  href="https://cal.com/switchtoux/mvp-sprint"
                  className="inline-flex items-center gap-2 px-10 py-4 bg-white text-black rounded-full text-sm font-semibold hover:bg-neutral-200 transition-all"
                >
                  <span>Book a Consult</span>
                </NavExternalLink>
              </div>

              {/* Back to all ideas */}
              <div className="mt-12 text-center">
                <Link
                  href="/startup-ideas"
                  className="inline-flex items-center gap-2 text-neutral-500 text-sm hover:text-black transition-colors"
                >
                  <ArrowLeft size={16} aria-hidden="true" />
                  See all startup ideas
                </Link>
              </div>
            </main>
          </div>
        </div>
      </EmailGate>
    </>
  );
}
