import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CheckCircle2 } from "lucide-react";

import { JsonLd } from "@/components/primitives/JsonLd";
import { BeehiivSubscribeForm } from "@/components/forms/BeehiivSubscribeForm";
import {
  breadcrumbSchema,
  buildGraph,
  howToSchema,
  personSchema,
  websiteSchema,
} from "@/lib/seo";

/**
 * /validation-checklist — the 48-Hour Validation Checklist.
 *
 * A standalone, server-rendered (indexable) checklist page that doubles as
 * the content upgrade offered at the bottom of every idea page (see
 * components/ideas/ChecklistCta.tsx). Checklist steps are also emitted as
 * HowTo JSON-LD.
 */

const SITE = "https://www.weekendmvp.app";
const TITLE = "The 48-Hour Startup Idea Validation Checklist | Weekend MVP";
const DESCRIPTION =
  "A 17-point checklist to validate a startup idea in one weekend — before you build. Demand checks, a smoke test, and the signals that tell you to build, pivot, or drop it.";

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  authors: [{ name: "John Iseghohi" }],
  alternates: { canonical: "/validation-checklist" },
  openGraph: {
    type: "article",
    url: `${SITE}/validation-checklist`,
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

type Phase = {
  eyebrow: string;
  title: string;
  intro: string;
  items: string[];
};

const PHASES: Phase[] = [
  {
    eyebrow: "Friday evening · ~2 hours",
    title: "Check demand before you touch code",
    intro:
      "Kill weak ideas in one evening. If the idea fails three or more of these, pick another — the whole point of a weekend MVP is that the next idea costs you only a week.",
    items: [
      "Write the problem as one sentence a stranger would nod at (\"X people waste Y hours on Z every week\"). If you can't, the idea isn't specific enough yet.",
      "Find 5 people complaining about this problem in public — Reddit threads, X posts, community forums, app-store reviews. Copy the exact quotes.",
      "Search the problem phrasing (not your solution) in Google. Note what ranks: if nothing addresses it, verify people search for it at all before assuming you found a gap.",
      "Name 3 existing alternatives (including spreadsheets and \"do nothing\") and write one sentence on why each is losing.",
      "Confirm someone already charges money in this space. Existing revenue is evidence of a market, not a blocker.",
      "Write down who pays, how much, and for what outcome — one sentence. If the payer and the user are different people, know which one you're building for.",
    ],
  },
  {
    eyebrow: "Saturday–Sunday · the build",
    title: "Ship the smallest thing that creates proof",
    intro:
      "One user type, one core action, one clear output. The MVP's job is to be demoable in 15 seconds and to start collecting real emails.",
    items: [
      "Scope to 3 screens: a landing page that states the promise, one input, one output. Cut auth, payments, and dashboards from v1.",
      "Put a waitlist/email capture on the landing page before anything else — the email list is the real deliverable of the weekend.",
      "Build the core action end-to-end with AI tools instead of polishing UI. Ugly-but-working beats pretty-but-fake.",
      "Deploy to a real URL (Vercel or similar) the same weekend. A localhost demo converts nobody.",
      "Record a 30-second screen capture of the core action working — your proof asset for every conversation next week.",
    ],
  },
  {
    eyebrow: "The next 5 days",
    title: "Get 10 real reactions, then decide",
    intro:
      "Validation isn't the build — it's what strangers do when they see it. Give it five days of honest signal before you invest another weekend.",
    items: [
      "Send the URL to 10 people who match the target user (not friends being nice). DM the people you found complaining on Friday.",
      "Post it where the complainers hang out — the same threads and communities, as a \"built this because of this thread\" reply, not an ad.",
      "Track two numbers only: visitors → email signups (aim for 10%+ from warm traffic), and how many people use the core action twice.",
      "Ask every signup one question: \"What were you hoping this would do?\" The gap between their answer and your build is your roadmap.",
      "Offer 3 users a paid tier before it exists (\"$9/mo when it launches — want in?\"). Verbal yeses are weak signal; card-on-file is strong.",
      "Decide with a rule, not a mood: 10+ signups or 1 pre-order → keep going; crickets after 100 real visitors → pivot the audience or drop it and take the next idea.",
    ],
  },
];

export default function ValidationChecklistPage() {
  const schema = buildGraph(
    personSchema(),
    websiteSchema(),
    howToSchema({
      name: "Validate a startup idea in 48 hours",
      description: DESCRIPTION,
      totalTime: "PT48H",
      steps: PHASES.flatMap((phase) =>
        phase.items.map((text) => ({ name: phase.title, text })),
      ),
    }),
    breadcrumbSchema([
      { label: "Home", href: "/" },
      { label: "Validation Checklist", href: "/validation-checklist" },
    ]),
  );

  return (
    <main className="relative z-10">
      <JsonLd schema={schema} />

      {/* Hero */}
      <section className="pt-32 pb-12 px-6">
        <div className="max-w-3xl mx-auto">
          <p className="text-xs font-mono uppercase tracking-widest text-neutral-500 mb-4">
            Free checklist · 17 checks · One weekend
          </p>
          <h1 className="text-4xl md:text-6xl font-medium text-white tracking-tight mb-6">
            The 48-Hour Validation Checklist
          </h1>
          <p className="text-lg text-neutral-400 font-light max-w-2xl">
            Most ideas die from silence, not from being wrong. This checklist
            compresses validation into one weekend: an evening of demand
            checks, a two-day smoke-test build, and five days of real signal —
            with a clear build / pivot / drop rule at the end.
          </p>
        </div>
      </section>

      {/* Phases */}
      <section className="pb-16 px-6">
        <div className="max-w-3xl mx-auto space-y-12">
          {PHASES.map((phase, phaseIndex) => (
            <div
              key={phase.title}
              className="p-8 bg-[#0A0A0A] border border-white/5 rounded-3xl"
            >
              <p className="text-xs font-mono uppercase tracking-widest text-neutral-500 mb-2">
                Phase {phaseIndex + 1} · {phase.eyebrow}
              </p>
              <h2 className="text-2xl font-medium text-white tracking-tight mb-3">
                {phase.title}
              </h2>
              <p className="text-sm text-neutral-400 mb-6">{phase.intro}</p>
              <ul className="space-y-4">
                {phase.items.map((item) => (
                  <li key={item} className="flex gap-3">
                    <CheckCircle2
                      size={18}
                      className="mt-0.5 shrink-0 text-neutral-600"
                      aria-hidden="true"
                    />
                    <span className="text-sm text-neutral-300 leading-relaxed">
                      {item}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* Email capture */}
      <section className="pb-16 px-6">
        <div className="max-w-3xl mx-auto p-8 md:p-12 bg-white/5 border border-white/10 rounded-3xl text-center">
          <h2 className="text-2xl font-medium text-white tracking-tight mb-3">
            Get the checklist in your inbox
          </h2>
          <p className="text-sm text-neutral-400 mb-8 max-w-md mx-auto">
            We&apos;ll email you this checklist plus a fresh, researched
            startup idea every morning. Free, unsubscribe anytime.
          </p>
          <div className="max-w-md mx-auto">
            <BeehiivSubscribeForm
              utmCampaign="validation-checklist"
              successHref={null}
              showFirstName={false}
              submitLabel="Email me the checklist"
            />
          </div>
        </div>
      </section>

      {/* Next-step CTA */}
      <section className="py-16 px-6 border-t border-white/5">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-2xl font-medium text-white tracking-tight mb-3">
            Need an idea worth validating?
          </h2>
          <p className="text-sm text-neutral-400 mb-8">
            Every idea in the library ships with the research already done —
            market size, competitors, business model, and AI build prompts.
          </p>
          <Link
            href="/startup-ideas"
            className="inline-flex items-center gap-2 px-8 py-4 bg-white text-black rounded-full text-sm font-semibold tracking-tight hover:bg-neutral-200 transition-all"
          >
            <span>Browse startup ideas</span>
            <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </div>
      </section>
    </main>
  );
}
