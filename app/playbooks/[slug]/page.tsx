import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { JsonLd } from "@/components/primitives/JsonLd";
import {
  INNER,
  SHELL,
  PlaybookCtaCard,
  PlaybookFanOut,
  PlaybookLayerStack,
  PlaybookLoops,
  PlaybookPromptFile,
  PlaybookSectionHeading,
  PlaybookStats,
  playbookTokens as t,
} from "@/components/playbooks/PlaybookSections";
import {
  PlaybookCapture,
  PlaybookCtaLink,
  PlaybookPack,
} from "@/components/playbooks/PlaybookForms";
import {
  articleSchema,
  breadcrumbSchema,
  buildGraph,
  faqPageSchema,
  howToSchema,
  organizationSchema,
  personSchema,
  SITE,
  websiteSchema,
} from "@/lib/seo";
import { cn } from "@/lib/utils";

import { getPlaybook, PLAYBOOK_SLUGS } from "../_playbooks";

export function generateStaticParams() {
  return PLAYBOOK_SLUGS.map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const playbook = getPlaybook(slug);
  if (!playbook) return {};

  const url = `${SITE}/playbooks/${playbook.slug}`;
  // No dedicated OG surface for playbooks yet — reuse the shared card, as
  // /starter-kit, /shipable and /links all do.
  const image = `${SITE}/image/og-image.png`;

  return {
    title: { absolute: playbook.meta.title },
    description: playbook.meta.description,
    keywords: playbook.meta.keywords,
    authors: [{ name: "John Iseghohi" }],
    alternates: { canonical: `/playbooks/${playbook.slug}` },
    openGraph: {
      type: "article",
      siteName: "Weekend MVP",
      locale: "en_GB",
      url,
      title: playbook.meta.title,
      description: playbook.meta.description,
      images: [
        {
          url: image,
          alt: `${playbook.name} — Weekend MVP`,
          type: "image/png",
          width: 1200,
          height: 630,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: playbook.meta.title,
      description: playbook.meta.description,
      images: [image],
    },
  };
}

export default async function PlaybookPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const playbook = getPlaybook(slug);
  if (!playbook) notFound();

  const { hero, problem, layers, outcomes, prompts, pack, cta } = playbook;

  const schema = buildGraph(
    websiteSchema(),
    organizationSchema(),
    personSchema(),
    // Two crumbs only: there is no /playbooks index page yet, and a
    // breadcrumb pointing at a 404 is worse than a shorter trail.
    breadcrumbSchema([
      { label: "Home", href: "/" },
      { label: playbook.name, href: `/playbooks/${playbook.slug}` },
    ]),
    articleSchema({
      title: playbook.meta.title,
      description: playbook.meta.description,
      slug: playbook.slug,
      pathPrefix: "/playbooks",
      authorRef: true,
      publisherRef: true,
      image: `${SITE}/image/og-image.png`,
    }),
    howToSchema({
      name: playbook.howTo.name,
      description: playbook.howTo.description,
      totalTime: playbook.howTo.totalTime,
      steps: layers.items.map((layer) => ({
        name: layer.title,
        text: layer.body,
      })),
    }),
    faqPageSchema(playbook.faqs),
  );

  return (
    <>
      <JsonLd schema={schema} />

      {/* Hero */}
      <section className={cn(SHELL, "pt-12 md:pt-20 pb-4")}>
        <div className={INNER}>
          <p
            className={cn(
              "font-mono-eyebrow text-[11px] font-semibold uppercase",
              "text-[#A03D00]",
            )}
          >
            {hero.eyebrow}
          </p>
          <h1
            className={cn(
              "mt-5 text-4xl md:text-5xl font-medium tracking-tight leading-[1.1]",
              t.textPrimary,
            )}
          >
            {hero.claim}
          </h1>
          <p className={cn("mt-6 text-lg leading-relaxed", t.textSecondary)}>
            {hero.body}
          </p>

          <PlaybookCapture
            slug={playbook.slug}
            heading={hero.captureHeading}
            body={hero.captureBody}
            buttonLabel={hero.buttonLabel}
            footnote={hero.footnote}
          />
        </div>
      </section>

      {/* The reframe */}
      <section
        aria-labelledby="playbook-problem"
        className={cn(SHELL, "py-14 md:py-20")}
      >
        <div className={INNER}>
          <PlaybookSectionHeading
            id="playbook-problem"
            heading={problem.heading}
            body={problem.body}
          />
          <PlaybookLoops
            headingId="playbook-problem"
            brokenLabel={problem.brokenLabel}
            brokenSteps={problem.brokenSteps}
            workingLabel={problem.workingLabel}
            workingSteps={problem.workingSteps}
            feedback={problem.feedback}
            caption={problem.caption}
          />
        </div>
      </section>

      {/* The stack */}
      <section
        aria-labelledby="playbook-layers"
        className={cn(SHELL, "py-14 md:py-20")}
      >
        <div className={INNER}>
          <PlaybookSectionHeading
            id="playbook-layers"
            heading={layers.heading}
            body={layers.body}
          />
          <PlaybookLayerStack
            headingId="playbook-layers"
            items={layers.items}
            caption={layers.caption}
          />
        </div>
      </section>

      {/* The payoff */}
      <section
        aria-labelledby="playbook-outcomes"
        className={cn(SHELL, "py-14 md:py-20")}
      >
        <div className={INNER}>
          <PlaybookSectionHeading
            id="playbook-outcomes"
            heading={outcomes.heading}
            body={outcomes.body}
          />
          <PlaybookFanOut
            headingId="playbook-outcomes"
            inputLabel={outcomes.inputLabel}
            inputSub={outcomes.inputSub}
            outputs={outcomes.outputs}
          />
          <PlaybookStats items={outcomes.stats} />
        </div>
      </section>

      {/* The give */}
      <section
        aria-labelledby="playbook-prompts"
        className={cn(SHELL, "py-14 md:py-20")}
      >
        <div className={INNER}>
          <PlaybookSectionHeading
            id="playbook-prompts"
            heading={prompts.heading}
            body={prompts.body}
          />
          <div className="mt-10 space-y-6">
            {prompts.items.map((prompt) => (
              <PlaybookPromptFile key={prompt.filename} {...prompt} />
            ))}
          </div>
        </div>
      </section>

      {/* The gated pack */}
      <PlaybookPack
        slug={playbook.slug}
        eyebrow={pack.eyebrow}
        heading={pack.heading}
        body={pack.body}
        items={pack.items}
        buttonLabel={pack.buttonLabel}
        footnote={pack.footnote}
        unlockedHeading={pack.unlockedHeading}
        unlockedBody={pack.unlockedBody}
        unlockedHref={pack.unlockedHref}
        unlockedHrefLabel={pack.unlockedHrefLabel}
      />

      {/* FAQ — server-rendered so it can be lifted into AI answers. */}
      <section
        aria-labelledby="playbook-faq"
        className={cn(SHELL, "py-14 md:py-20")}
      >
        <div className={INNER}>
          <h2
            id="playbook-faq"
            className={cn(
              "text-3xl md:text-4xl font-medium tracking-tight",
              t.textPrimary,
            )}
          >
            Questions
          </h2>
          <dl className="mt-8 space-y-8">
            {playbook.faqs.map((faq) => (
              <div key={faq.question}>
                <dt className={cn("text-lg font-semibold", t.textPrimary)}>
                  {faq.question}
                </dt>
                <dd className={cn("mt-2 leading-relaxed", t.textSecondary)}>
                  {faq.answer}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* The offer */}
      <PlaybookCtaCard
        headingId="playbook-cta"
        heading={cta.heading}
        body={cta.body}
      >
        <PlaybookCtaLink
          slug={playbook.slug}
          href={cta.href}
          label={cta.buttonLabel}
        />
      </PlaybookCtaCard>
    </>
  );
}
