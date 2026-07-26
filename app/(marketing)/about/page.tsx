import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { AuraBackground } from "@/components/marketing/AuraBackground";
import { JsonLd } from "@/components/primitives/JsonLd";
import {
  SITE,
  breadcrumbSchema,
  buildGraph,
  ORG_ID,
  organizationSchema,
  PERSON_PATH,
  personSchema,
} from "@/lib/seo";

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

export default function AboutPage() {
  return (
    <div className="relative min-h-screen overflow-x-hidden pt-24 selection:bg-white/20 selection:text-white">
      <JsonLd schema={SCHEMA} />
      <AuraBackground />
      <div className="fixed inset-0 pointer-events-none z-0 grid-lines" />
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-full max-w-3xl h-96 bg-white/5 blur-[120px] rounded-full pointer-events-none -z-10 mix-blend-screen" />

      <main className="relative z-10 max-w-3xl mx-auto px-6 py-32 mb-24">
        <p className="text-neutral-500 text-xs font-medium uppercase tracking-wider mb-4">
          About
        </p>
        <h1 className="text-4xl md:text-5xl font-medium text-white tracking-tight mb-6">
          Weekend MVP
        </h1>
        <p className="text-lg md:text-xl text-neutral-400 font-light leading-relaxed mb-16">
          A site for busy people who want to ship a real product in a weekend —
          even if they&apos;ve never written code. Pick a validated idea, follow
          a tight build plan, and leave Sunday with a live link and a waitlist.
        </p>

        <section className="mb-16" aria-labelledby="what-it-is">
          <h2
            id="what-it-is"
            className="text-white font-medium text-xl mb-4 tracking-tight"
          >
            What it is
          </h2>
          <p className="text-neutral-400 leading-relaxed mb-4">
            Weekend MVP is not another idea dump. Every idea is broken down into
            the problem, who pays, how to build it with AI tools, and what to
            ship first. Programmatic hubs group ideas by audience, tool, and
            problem so you can start from where you already are.
          </p>
          <p className="text-neutral-400 leading-relaxed">
            The free{" "}
            <Link
              href="/starter-kit"
              className="text-neutral-200 hover:text-white underline underline-offset-2"
            >
              Starter Kit
            </Link>{" "}
            is the operating system: scorecard, one-page spec, 48-hour plan, and
            copy-paste prompts.
          </p>
        </section>

        <section className="mb-16" aria-labelledby="who-for">
          <h2
            id="who-for"
            className="text-white font-medium text-xl mb-4 tracking-tight"
          >
            Who it&apos;s for
          </h2>
          <p className="text-neutral-400 leading-relaxed">
            Non-technical founders, designers, freelancers, and side-project
            builders who are tired of endless tutorials and want one concrete
            thing live by Monday. If you can follow a checklist and talk to
            customers, you can use this.
          </p>
        </section>

        <section className="mb-16" aria-labelledby="what-youll-find">
          <h2
            id="what-youll-find"
            className="text-white font-medium text-xl mb-6 tracking-tight"
          >
            What you&apos;ll find
          </h2>
          <ul className="space-y-6">
            {FINDS.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="group block focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white/40 rounded-sm"
                >
                  <span className="text-white font-medium group-hover:text-neutral-200 transition-colors inline-flex items-center gap-2">
                    {item.title}
                    <ArrowRight
                      className="w-4 h-4 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all"
                      aria-hidden="true"
                    />
                  </span>
                  <span className="block text-sm text-neutral-500 mt-1 leading-relaxed">
                    {item.body}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section
          className="mb-16 border-t border-white/10 pt-12"
          aria-labelledby="built-by"
        >
          <h2
            id="built-by"
            className="text-white font-medium text-xl mb-4 tracking-tight"
          >
            Built by John Iseghohi
          </h2>
          <p className="text-neutral-400 leading-relaxed mb-6">
            John runs Weekend MVP and a community of 400+ weekend builders. He
            publishes idea breakdowns, workshops, and the starter kit so more
            people ship instead of spiral.
          </p>
          <Link
            href={PERSON_PATH}
            className="inline-flex items-center gap-2 text-white font-medium hover:text-neutral-200 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white/40 rounded-sm"
          >
            About John
            <ArrowRight className="w-4 h-4" aria-hidden="true" />
          </Link>
        </section>

        <section
          className="rounded-2xl border border-white/10 bg-white/[0.02] p-8"
          aria-labelledby="about-cta"
        >
          <h2
            id="about-cta"
            className="text-white font-medium text-lg mb-2 tracking-tight"
          >
            Start this weekend
          </h2>
          <p className="text-neutral-400 text-sm leading-relaxed mb-6">
            Grab the free kit, pick an idea, or skim a guide — then ship
            something small enough to learn from.
          </p>
          <div className="flex flex-wrap gap-4">
            <Link
              href="/starter-kit"
              className="inline-flex items-center justify-center px-5 py-2.5 rounded-full bg-white text-black text-sm font-medium hover:bg-neutral-200 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              Get the Starter Kit
            </Link>
            <Link
              href="/startup-ideas"
              className="inline-flex items-center justify-center px-5 py-2.5 rounded-full border border-white/15 text-white text-sm font-medium hover:bg-white/5 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              Browse ideas
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
