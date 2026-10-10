import fs from "node:fs/promises";
import path from "node:path";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { fetchQuery } from "convex/nextjs";
import { DollarSign } from "lucide-react";

import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import { JsonLd } from "@/components/primitives/JsonLd";
import { NavExternalLink } from "@/components/primitives/NavExternalLink";
import { Mdx, listMdxSlugs, readMdxFile } from "@/lib/mdx";
import { isEngineDraftSlug } from "@/lib/engine-drafts";
import { chooseIdeaBody } from "@/lib/canonical-idea-body";
import {
  SITE,
  articleSchema,
  breadcrumbSchema,
  buildGraph,
  howToSchema,
  personSchema,
  softwareApplicationSchema,
} from "@/lib/seo";
import { EmailGate } from "@/components/ideas/EmailGate";
import {
  IdeaPublicHeader,
  IdeaPublicSummary,
} from "@/components/ideas/IdeaPublicSummary";
import { currentIdeaMemberToken } from "@/lib/ideas/member-session";
import { buildPublicIdeaPreview } from "@/lib/ideas/public-preview";
import { manifestIdeas } from "@/lib/public/library";
import { IdeaBackLink } from "@/components/ideas/IdeaBackLink";
import { IdeaBreadcrumbs } from "@/components/ideas/IdeaBreadcrumbs";
import { IdeaSidebar } from "@/components/ideas/IdeaSidebar";
import { RelatedIdeas } from "@/components/ideas/RelatedIdeas";
import { SaveIdeaButton } from "@/components/ideas/SaveIdeaButton";
import { SafeEditorialBody } from "@/components/ideas/SafeEditorialBody";
import { ideaMdxComponents } from "@/components/ideas/mdx-light";
import {
  CATEGORY_META,
  audienceName,
  categoryName,
  normalizeCategorySlug,
  revenueName,
  tocFromMarkdown,
  toolName,
} from "@/components/ideas/idea-meta";
import {
  COLLECTION_SLUGS,
  getCollectionMeta,
  renderCollection,
} from "./collection";
import { excerpt, firstParagraph, howItWorksSteps, sectionBody } from "./schema-text";

const CONTENT_DIR = "content/ideas";
const DEFAULT_OG = "/image/og-image.png";

// The visibility decision must finish before any shell streams, so a removed
// idea has a genuine 404 and no cached RSC/body bytes.
export const instant = false;

type IdeaDoc = Doc<"ideas">;

type ResolvedIdea = {
  source: "mdx" | "convex" | "editorial";
  title: string;
  description: string;
  content: string;
  /** Convex metadata row; null when Convex is unavailable (e.g. at build). */
  idea: IdeaDoc | null;
  /** Site-relative OG path — per-idea when the file exists, else default. */
  ogImage: string;
  artifactHash?: string;
};

/* ------------------------------------------------------------------ */
/* Display helpers (the markdown helpers live in ./schema-text)        */
/* ------------------------------------------------------------------ */

const AUTHOR_NAME = "John Iseghohi";

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

async function fetchIdeaRow(slug: string, token?: string | null): Promise<IdeaDoc | null> {
  if (token) return fetchQuery(api.ideas.bySlugForMember, { slug }, { token });
  try {
    return await fetchQuery(api.ideas.bySlug, { slug });
  } catch {
    return null;
  }
}

async function ideaOgImage(slug: string): Promise<string> {
  try {
    await fs.access(
      path.join(process.cwd(), "public", "image", "og", "idea", `${slug}.png`),
    );
    return `/image/og/idea/${slug}.png`;
  } catch {
    return DEFAULT_OG;
  }
}

/** Manifest description when Convex is down and MDX frontmatter has none. */
function manifestMeta(slug: string) {
  const row = manifestIdeas().find((idea) => idea.slug === slug);
  if (!row) return null;
  return {
    description: row.description?.trim() || null,
    audiences: row.audiences,
    buildTime: row.buildTime,
    tools: row.tools,
  };
}

async function resolveIdea(slug: string, token?: string | null): Promise<ResolvedIdea | null> {
  // Engine spot-check drafts never render, even if a Convex row exists.
  if (isEngineDraftSlug(slug)) return null;

  // This request-time gate precedes every filesystem fallback and cached
  // public render. A backend outage fails closed rather than resurrecting a
  // removed legacy MDX page.
  const publication = token
    ? await fetchQuery(api.editorial.public.bySlugForMember, { slug }, { token })
    : await fetchQuery(api.editorial.public.bySlug, { slug });
  if (publication.state === "removed") return null;
  if (publication.state === "released") {
    const idea = await fetchIdeaRow(slug, token);
    return {
      source: "editorial",
      title: publication.title,
      description: publication.metadata.description,
      content: token && "markdown" in publication && typeof publication.markdown === "string" ? publication.markdown : "",
      idea,
      // The static legacy OG file may describe an earlier revision. An E6
      // release uses the generic art until a versioned OG asset is verified.
      ogImage: DEFAULT_OG,
      artifactHash: publication.artifactHash,
    };
  }

  const [file, idea, ogImage] = await Promise.all([
    readMdxFile(CONTENT_DIR, slug),
    fetchIdeaRow(slug, token),
    ideaOgImage(slug),
  ]);

  const body = chooseIdeaBody(file, idea);
  if (!body && !idea) return null;
  const fmTitle = file?.frontmatter.title;
  const fmDescription = file?.frontmatter.description;
  const fromManifest = manifestMeta(slug);
  // Prefer MDX frontmatter when present so git-deployed SEO title/meta
  // wins over a stale Convex row until the next seed. Fall back to the
  // manifest before excerpting body prose so anonymous SEO never uses a
  // Problem-paragraph stub when a real description exists.
  return {
    source: body?.source ?? "convex",
    content: token ? body?.content ?? "" : "",
    title:
      (typeof fmTitle === "string" && fmTitle.trim() ? fmTitle : null) ??
      idea?.title ??
      slug,
    description:
      (typeof fmDescription === "string" && fmDescription.trim()
        ? fmDescription
        : null) ??
      idea?.description ??
      fromManifest?.description ??
      excerpt(body?.content ?? ""),
    idea,
    ogImage,
  };
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
  await connection();
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
  // Public preview builder clamps to SERP budgets and prefers the description
  // lead when the H1 title is a short product stub.
  const preview = buildPublicIdeaPreview({ title, description, markdown: "" });
  const fullTitle = preview.documentTitle;
  const metaDescription = preview.metaDescription;
  return {
    title: { absolute: fullTitle },
    description: metaDescription,
    authors: [{ name: "John Iseghohi" }],
    alternates: { canonical: `/ideas/${slug}` },
    openGraph: {
      type: "article",
      url,
      title: fullTitle,
      description: metaDescription,
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
      title: fullTitle,
      description: metaDescription,
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

/**
 * Anonymous JSON-LD: Article + BreadcrumbList from public fields only.
 * No HowTo / SoftwareApplication (those need gated body), and no
 * isAccessibleForFree / paywall markup (gated body is not in the HTML).
 */
function buildPublicSchema(slug: string, resolved: ResolvedIdea) {
  const { title, description, idea, ogImage } = resolved;
  const url = `${SITE}/ideas/${slug}`;
  const ogImageAbs = `${SITE}${ogImage}`;
  const datePublished = idea
    ? new Date(idea.publishedAt).toISOString().slice(0, 10)
    : undefined;
  const preview = buildPublicIdeaPreview({
    title,
    description,
    markdown: "",
  });

  return buildGraph(
    articleSchema({
      title,
      description: preview.metaDescription,
      slug,
      pathPrefix: "/ideas",
      datePublished,
      image: ogImageAbs,
      authorRef: true,
    }),
    breadcrumbSchema([
      { label: "Home", href: "/" },
      { label: "Startup Ideas", href: "/startup-ideas" },
      { label: title, href: url },
    ]),
  );
}

/** Checked-in MDX used only to extract public teasers/prompts — never the gated body path. */
async function loadPublicMarkdown(slug: string): Promise<string> {
  const file = await readMdxFile(CONTENT_DIR, slug);
  return file?.content ?? "";
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
  await connection();
  const token = await currentIdeaMemberToken();
  const resolved = await resolveIdea(slug, token);
  if (!resolved) {
    // Not an idea — maybe a collection hub slug (U11 extension point).
    const collection = await renderCollection(slug);
    if (collection) return collection;
    notFound();
  }
  if (!token) {
    const markdown = await loadPublicMarkdown(slug);
    const fromManifest = manifestMeta(slug);
    const preview = buildPublicIdeaPreview({
      title: resolved.title,
      description: resolved.description,
      markdown,
      audiences: resolved.idea?.audiences ?? fromManifest?.audiences,
      buildTime: resolved.idea?.buildTime ?? fromManifest?.buildTime,
      tools: resolved.idea?.tools ?? fromManifest?.tools,
    });
    return (
      <>
        <JsonLd schema={buildPublicSchema(slug, resolved)} />
        <EmailGate
          slug={slug}
          intro={
            <IdeaPublicHeader
              title={resolved.title}
              description={resolved.description}
            />
          }
        >
          <IdeaPublicSummary preview={preview} />
        </EmailGate>
      </>
    );
  }
  return <IdeaContent slug={slug} resolved={resolved} />;
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

/** The gate and the selected body must be from the same request. */
function IdeaContent({ slug, resolved }: { slug: string; resolved: ResolvedIdea }) {
  const { title, description, content, idea } = resolved;
  const toc = tocFromMarkdown(content);
  const schema = buildSchema(slug, resolved);
  const CategoryIcon = idea
    ? CATEGORY_META[normalizeCategorySlug(idea.category)]?.icon
    : undefined;

  return (
    <>
      <JsonLd schema={schema} />

      <>
        <div className="max-w-6xl mx-auto px-6 lg:px-8">
          <div className="flex flex-col lg:flex-row gap-8 lg:gap-12 pt-24 sm:pt-[7.5rem] pb-16">
            <IdeaSidebar sections={toc}>
              {idea ? <IdeaMetaCard idea={idea} /> : null}
            </IdeaSidebar>

            {/* Main Content */}
            <main className="flex-1 max-w-2xl min-w-0 break-words" data-editorial-artifact-hash={resolved.artifactHash}>
              {/* Breadcrumb — member crumbs swap client-side via session hint */}
              <IdeaBreadcrumbs title={title} />

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
                {idea ? (
                  // No visible publish date: it makes evergreen ideas look
                  // stale. datePublished stays in the JSON-LD.
                  <p className="mt-5 text-sm text-neutral-500">
                    By{" "}
                    <span className="font-medium text-neutral-700">
                      {AUTHOR_NAME}
                    </span>
                  </p>
                ) : null}
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
                {/* WP44-S6 Save island. Empty in the server HTML. The fixed
                    height keeps the layout still when it appears. */}
                <div className="mt-6 flex min-h-10 flex-wrap items-center gap-x-3 gap-y-2">
                  <SaveIdeaButton slug={slug} title={title} />
                </div>
              </header>

              {/* Body — server-rendered MDX (or Convex-stored markdown) */}
              {resolved.source === "editorial" ? (
                <SafeEditorialBody markdown={content} />
              ) : (
                <Mdx source={content} components={ideaMdxComponents} codeTheme="github-light" />
              )}

              {/* R5: the landing page preview CTA is parked for v1.1.
                  `PreviewIdeaCta` and `/build/{slug}` stay in the codebase. */}

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

              {/* Return control — members get Back to Home/Explore/Builds */}
              <div className="mt-12 text-center">
                <IdeaBackLink
                  anonymousLabel="See all startup ideas"
                  className="inline-flex items-center gap-2 text-sm text-neutral-500 transition-colors hover:text-black"
                />
              </div>
            </main>
          </div>
        </div>
      </>
    </>
  );
}
