import type { Metadata } from "next";
import Link from "next/link";

import { Icon } from "@/components/home/icons";
import { ButtonLink, Container, Em } from "@/components/home/ui";
import { JsonLd } from "@/components/primitives/JsonLd";
import { PageHeader } from "@/components/public/PageHeader";
import { newsreaderEditorial } from "@/lib/fonts";
import {
  SITE,
  breadcrumbSchema,
  buildGraph,
  ORG_ID,
  organizationSchema,
  PERSON_PATH,
  personSchema,
} from "@/lib/seo";
import { cn } from "@/lib/utils";

const TITLE = "About Weekend MVP";
const DESCRIPTION =
  "Weekend MVP helps non-technical founders pick a validated idea, build a 3-screen MVP, and launch a waitlist in a weekend — with research-backed ideas, guides, and a free starter kit.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  authors: [{ name: "John Iseghohi", url: PERSON_PATH }],
  alternates: { canonical: "/about" },
  openGraph: {
    type: "website",
    url: `${SITE}/about`,
    title: `${TITLE} | Weekend MVP`,
    description: DESCRIPTION,
    images: [
      {
        url: `${SITE}/image/og-image.png`,
        width: 1200,
        height: 630,
        alt: "Weekend MVP — ship your product in 48 hours",
        type: "image/png",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: `${TITLE} | Weekend MVP`,
    description: DESCRIPTION,
    images: [`${SITE}/image/og-image.png`],
  },
};

const SCHEMA = buildGraph(
  {
    "@type": "AboutPage",
    "@id": `${SITE}/about`,
    name: TITLE,
    description: DESCRIPTION,
    url: `${SITE}/about`,
    isPartOf: { "@id": `${SITE}/#website` },
    about: { "@id": ORG_ID },
    mainEntity: { "@id": ORG_ID },
  },
  organizationSchema(),
  personSchema(),
  breadcrumbSchema([
    { label: "Home", href: "/" },
    { label: "About", href: "/about" },
  ]),
);

const FINDS = [
  {
    href: "/startup-ideas",
    title: "Startup ideas library",
    body: "Research-backed ideas with problem, solution, build path, and prompts — ready for a weekend ship.",
  },
  {
    href: "/articles",
    title: "Guides & frameworks",
    body: "Practical articles on validation, vibe coding, auth, costs, and customer interviews.",
  },
  {
    href: "/starter-kit",
    title: "48-hour starter kit",
    body: "The exact checklist, templates, and AI prompts to go from idea to live link + waitlist.",
  },
  {
    href: "/shipable",
    title: "Live workshops",
    body: "Working sessions where you leave with a deployed URL and a locked build plan.",
  },
] as const;

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

export default function AboutPage() {
  return (
    <div
      className={cn(
        newsreaderEditorial.variable,
        "theme-desk relative min-h-screen overflow-x-clip bg-home-paper font-sans text-home-ink selection:bg-home-orange-light/40",
      )}
    >
      <JsonLd schema={SCHEMA} />

      <main id="main">
        <PageHeader eyebrow="About" title="Weekend MVP" className="pb-12 lg:pb-14">
          <p className="max-w-[760px] font-editorial text-[26px] leading-[1.25] tracking-[-0.01em] text-home-ink text-pretty md:text-[32px]">
            A site for busy people who want to ship a real product in a weekend —
            even if they&apos;ve never written code. Pick a validated idea, follow
            a tight build plan, and{" "}
            <Em>leave Sunday with a live link and a waitlist.</Em>
          </p>
        </PageHeader>

        <Container className="pb-20 lg:pb-28">
          <Row id="what-it-is" label="What it is">
            <div className="flex max-w-[680px] flex-col gap-4">
              <p className="text-lg leading-[1.65] text-home-ink">
                Weekend MVP is not another idea dump. Every idea is broken down
                into the problem, who pays, how to build it with AI tools, and
                what to ship first. Programmatic hubs group ideas by audience,
                tool, and problem so you can start from where you already are.
              </p>
              <p className="text-lg leading-[1.65] text-home-ink-2">
                The free{" "}
                <Link
                  href="/starter-kit"
                  className={cn(
                    "text-home-orange-ink underline underline-offset-4 transition-colors hover:text-home-ink motion-reduce:transition-none",
                    FOCUS,
                  )}
                >
                  Starter Kit
                </Link>{" "}
                is the operating system: scorecard, one-page spec, 48-hour plan,
                and copy-paste prompts.
              </p>
            </div>
          </Row>

          <Row id="who-for" label="Who it's for">
            <p className="max-w-[680px] text-lg leading-[1.65] text-home-ink">
              Non-technical founders, designers, freelancers, and side-project
              builders who are tired of endless tutorials and want one concrete
              thing live by Monday. If you can follow a checklist and talk to
              customers, you can use this.
            </p>
          </Row>

          <Row id="what-youll-find" label="What you'll find">
            <ul className="grid grid-cols-1 gap-x-10 md:grid-cols-2">
              {FINDS.map((item, i) => (
                <li
                  key={item.href}
                  className={cn(
                    "border-t border-home-rule first:border-t-0 md:[&:nth-child(2)]:border-t-0",
                    i > 1 ? "md:pt-7" : "",
                  )}
                >
                  <Link
                    href={item.href}
                    className={cn("group flex flex-col gap-2 py-6 md:py-0 md:pb-7", FOCUS)}
                  >
                    <span className="flex items-center justify-between gap-4 font-editorial text-[24px] leading-[1.15] text-home-ink md:text-[28px]">
                      {item.title}
                      <Icon
                        name="arrow"
                        size={20}
                        strokeWidth={1.75}
                        color="var(--color-home-orange-ink)"
                        className="transition-transform duration-200 ease-[cubic-bezier(0.25,1,0.5,1)] group-hover:translate-x-0.5 motion-reduce:transition-none"
                      />
                    </span>
                    <span className="text-[15px] leading-[1.55] text-home-ink-2">
                      {item.body}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </Row>

          <Row id="built-by" label="Built by John Iseghohi">
            <div className="flex max-w-[680px] flex-col items-start gap-5">
              <p className="text-lg leading-[1.65] text-home-ink-2">
                John runs Weekend MVP and a community of 400+ weekend builders.
                He publishes idea breakdowns, workshops, and the starter kit so
                more people ship instead of spiral.
              </p>
              <ButtonLink href={PERSON_PATH} tone="secondary">
                About John
              </ButtonLink>
            </div>
          </Row>

          <section
            aria-labelledby="about-cta"
            className="mt-6 flex flex-col gap-7 rounded-[22px] bg-home-ink p-7 text-home-d1 md:p-12 lg:flex-row lg:items-end lg:justify-between"
          >
            <div className="flex max-w-[640px] flex-col gap-3">
              <h2
                id="about-cta"
                className="font-editorial text-[32px] font-normal leading-[1.08] tracking-[-0.02em] text-balance md:text-[40px]"
              >
                Start <Em dark>this weekend</Em>
              </h2>
              <p className="text-base leading-[1.55] text-home-d2 md:text-[17px]">
                Grab the free kit, pick an idea, or skim a guide — then ship
                something small enough to learn from.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <ButtonLink href="/starter-kit" tone="dark" className="focus-visible:outline-home-orange-light">
                Get the Starter Kit
              </ButtonLink>
              <ButtonLink
                href="/startup-ideas"
                tone="ghost-dark"
                arrow={false}
                className="focus-visible:outline-home-orange-light"
              >
                Browse ideas
              </ButtonLink>
            </div>
          </section>
        </Container>
      </main>
    </div>
  );
}
