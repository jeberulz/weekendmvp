import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cacheLife, cacheTag } from "next/cache";
import {
  Calendar,
  CheckCircle2,
  FileText,
  Headphones,
  Library,
  Receipt,
  Wrench,
} from "lucide-react";

import { JsonLd } from "@/components/primitives/JsonLd";
import { HubRelatedTiles } from "@/components/hubs/HubRelatedTiles";
import {
  HubBreadcrumb,
  HubHero,
  HubShell,
} from "@/components/hubs/HubShell";
import { HubCta } from "@/components/hubs/HubCta";
import { HubIdeasGrid } from "@/components/hubs/HubIdeasGrid";
import { COLOR_STYLES, type HubColor } from "@/components/hubs/hub-theme";
import { fetchAllIdeas } from "@/components/hubs/hub-data";
import {
  breadcrumbSchema,
  buildGraph,
  howToSchema,
  personSchema,
  websiteSchema,
} from "@/lib/seo";

const SITE = "https://www.weekendmvp.app";
const OG_IMAGE = `${SITE}/image/og-image.png`;

/* ------------------------------------------------------------------ */
/* Solve hub content — ported from solve/{slug}/index.html.            */
/* Each hub is editorial: problem framing + HowTo steps + curated      */
/* solution idea pool (filtered from Convex by category match).        */
/* ------------------------------------------------------------------ */

type SolveStep = { name: string; text: string };
type SolveStat = { stat: string };

type SolvePage = {
  slug: string;
  shortTitle: string;
  metaTitle: string;
  metaDescription: string;
  title: string; // page hero h1 — "How to Automate X" pattern
  description: string;
  color: HubColor;
  icon: typeof CheckCircle2;
  problemIntro: string;
  problemStats: SolveStat[];
  steps: SolveStep[];
  /** Convex idea categories that match this problem space. */
  categoryMatches: string[];
};

export const PROBLEM_PAGES: Record<string, SolvePage> = {
  "customer-support": {
    slug: "customer-support",
    shortTitle: "Automate Customer Support",
    metaTitle: "How to Automate Customer Support | Weekend MVP",
    metaDescription:
      "Discover startup ideas that solve customer support challenges. Build AI-powered tools to handle support tickets, reduce response times, and scale without hiring.",
    title: "How to Automate Customer Support",
    description:
      "Handle more support tickets without hiring more people. Build AI-powered tools that answer common questions, triage issues, and escalate when needed.",
    color: "blue",
    icon: Headphones,
    problemIntro:
      'Customer support doesn\'t scale linearly. As your product grows, so does the volume of support requests—but most of them are asking the same 20 questions. Small teams get overwhelmed, response times suffer, and founder time gets eaten up answering "how do I reset my password?" for the hundredth time. Meanwhile, customers expect instant responses, 24/7.',
    problemStats: [
      { stat: "70%+ of support tickets ask the same questions that have documented answers." },
      { stat: "Customers expect sub-hour responses but teams can't staff 24/7." },
      { stat: "Hiring support agents is expensive and doesn't solve the root problem." },
    ],
    steps: [
      { name: "Build a knowledge base", text: "Collect and organize your FAQs, documentation, and common support solutions." },
      { name: "Train an AI chatbot", text: "Use your knowledge base to power an AI assistant that answers common questions." },
      { name: "Add smart routing", text: "Build logic to escalate complex issues to humans while AI handles routine questions." },
      { name: "Monitor and improve", text: "Track resolution rates and customer satisfaction to continuously improve responses." },
    ],
    categoryMatches: ["ai-tools", "saas", "automation", "productivity"],
  },
  invoicing: {
    slug: "invoicing",
    shortTitle: "Automate Invoicing",
    metaTitle: "How to Automate Invoicing | Weekend MVP",
    metaDescription:
      "Discover startup ideas that solve invoicing and payment collection problems. Get AI build prompts, market validation, and guides to automate payment reminders.",
    title: "How to Automate Invoicing",
    description:
      "Stop chasing late invoices manually. Build automated reminder systems, payment tracking, and collection workflows that recover cash without awkward conversations.",
    color: "emerald",
    icon: Receipt,
    problemIntro:
      "Cash flow is the #1 killer of small businesses, and late invoices are the #1 cause of cash flow problems. Manually chasing payments is awkward, time-consuming, and inconsistent — most freelancers and small teams give up after one or two reminders, leaving thousands on the table every quarter.",
    problemStats: [
      { stat: "30%+ of B2B invoices are paid late, costing freelancers $50k+/year on average." },
      { stat: "Most service providers stop chasing after 2 reminders — but persistent automation recovers 80%+ of overdue invoices." },
      { stat: "Founder time spent on collections is time not spent on revenue-generating work." },
    ],
    steps: [
      { name: "Connect your invoicing system", text: "Link your Stripe, FreshBooks, or other invoicing tool to sync invoice data automatically." },
      { name: "Set up reminder sequences", text: "Configure escalating reminder emails: friendly at 3 days overdue, firm at 7 days, final notice at 14+ days." },
      { name: "Customize your templates", text: "Personalize reminder emails with your branding and tone to maintain client relationships." },
      { name: "Monitor and track", text: "Get notifications when invoices are paid and track your collection rate over time." },
    ],
    categoryMatches: ["saas", "automation", "fintech", "productivity"],
  },
  "knowledge-transfer": {
    slug: "knowledge-transfer",
    shortTitle: "Automate Knowledge Transfer",
    metaTitle: "How to Automate Knowledge Transfer | Weekend MVP",
    metaDescription:
      "Discover startup ideas that solve knowledge transfer and documentation problems. Build AI tools to capture, organize, and share institutional knowledge.",
    title: "How to Automate Knowledge Transfer",
    description:
      "Stop losing institutional knowledge when people leave or move teams. Build AI-powered tools that capture, organize, and surface knowledge when it's needed.",
    color: "amber",
    icon: Library,
    problemIntro:
      "Every team has critical knowledge trapped in someone's head, an old Slack thread, or a doc nobody can find. When that person leaves — or just goes on vacation — the team grinds to a halt rediscovering what should be obvious. Manual documentation rarely keeps up, and traditional wikis go stale within months.",
    problemStats: [
      { stat: "Knowledge workers spend 20%+ of their time searching for information that already exists somewhere." },
      { stat: "Most documentation is out of date within 6 months of being written." },
      { stat: "Replacing institutional knowledge after a key person leaves costs 3–6 months of productivity." },
    ],
    steps: [
      { name: "Identify knowledge sources", text: "Map where critical knowledge lives: documents, Slack, meetings, individual experts." },
      { name: "Build capture mechanisms", text: "Create systems to automatically capture knowledge from meetings, chats, and documentation." },
      { name: "Organize and index", text: "Use AI to categorize, tag, and make knowledge searchable across formats." },
      { name: "Enable retrieval", text: "Build interfaces that let team members quickly find and apply captured knowledge." },
    ],
    categoryMatches: ["ai-tools", "saas", "productivity"],
  },
  "meeting-notes": {
    slug: "meeting-notes",
    shortTitle: "Automate Meeting Notes",
    metaTitle: "How to Automate Meeting Notes | Weekend MVP",
    metaDescription:
      "Discover startup ideas that solve messy meeting notes. Get AI build prompts, market validation, and step-by-step guides to automate meeting notes cleanup.",
    title: "How to Automate Meeting Notes",
    description:
      "Stop ending meetings with messy transcripts and no follow-through. Build AI tools that turn raw meeting audio into clean summaries, action items, and decisions.",
    color: "purple",
    icon: FileText,
    problemIntro:
      "Most teams already record meetings, but the raw transcripts are unusable. Action items get lost, decisions get re-litigated, and the person who took the notes spends an hour cleaning them up after every call. AI can extract structure from the noise — the opportunity is the workflow around it.",
    problemStats: [
      { stat: "Average knowledge worker spends 5+ hours/week on meetings — and another 2 hours cleaning up notes." },
      { stat: "70% of action items decided in meetings are forgotten within a week." },
      { stat: "Raw AI transcripts are technically free but practically useless without summarization and action extraction." },
    ],
    steps: [
      { name: "Choose an AI meeting notes solution", text: "Select a tool that fits your workflow - either a standalone cleaner or an integrated solution." },
      { name: "Connect your meeting source", text: "Link your Zoom, Google Meet, or other transcription service to automatically capture raw transcripts." },
      { name: "Process and extract", text: "Let AI extract summaries, action items, decisions, and follow-ups from your transcripts." },
      { name: "Share and track", text: "Distribute clean notes to your team and track action item completion." },
    ],
    categoryMatches: ["ai-tools", "productivity", "saas"],
  },
  scheduling: {
    slug: "scheduling",
    shortTitle: "Automate Scheduling",
    metaTitle: "How to Automate Scheduling | Weekend MVP",
    metaDescription:
      "Discover startup ideas that solve scheduling and calendar management problems. Build tools to eliminate the back-and-forth of booking meetings.",
    title: "How to Automate Scheduling",
    description:
      "Kill the back-and-forth of finding a meeting time. Build tools that share availability, handle timezones, and book directly into calendars — for use cases Calendly doesn't cover.",
    color: "rose",
    icon: Calendar,
    problemIntro:
      "Calendly nailed the 1-on-1 booking link, but most scheduling pain is more complex than that: rotating availability across a team, coordinating across timezones, booking conditional on prep steps, or handling rescheduling cascades. Every vertical (interviews, healthcare, consulting, group classes) has its own quirks generic tools don't solve.",
    problemStats: [
      { stat: "Average meeting takes 8 emails to schedule across timezones — most of which could be automated away." },
      { stat: "Calendly owns the simple case; vertical-specific scheduling is a still-open market." },
      { stat: "No-show rates drop 60%+ when automated reminders and easy reschedule flows are built in." },
    ],
    steps: [
      { name: "Connect calendars", text: "Integrate with Google Calendar, Outlook, or iCal to access real-time availability." },
      { name: "Define availability rules", text: "Set buffer times, working hours, and meeting preferences to optimize your schedule." },
      { name: "Share booking links", text: "Let others book time directly without the back-and-forth." },
      { name: "Automate confirmations", text: "Send automatic confirmations, reminders, and follow-ups." },
    ],
    categoryMatches: ["saas", "productivity", "automation"],
  },
};

export const PROBLEM_SLUGS = Object.keys(PROBLEM_PAGES);

/* ------------------------------------------------------------------ */
/* Params + metadata                                                   */
/* ------------------------------------------------------------------ */

export async function generateStaticParams() {
  return PROBLEM_SLUGS.map((problem) => ({ problem }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ problem: string }>;
}): Promise<Metadata> {
  const { problem } = await params;
  const page = PROBLEM_PAGES[problem];
  if (!page) return {};
  const url = `${SITE}/solve/${page.slug}`;
  return {
    title: { absolute: page.metaTitle },
    description: page.metaDescription,
    authors: [{ name: "John Iseghohi" }],
    alternates: { canonical: `/solve/${page.slug}` },
    openGraph: {
      type: "website",
      url,
      title: page.metaTitle,
      description: page.metaDescription,
      images: [
        {
          url: OG_IMAGE,
          alt: "Weekend MVP — ship your product in 48 hours",
          type: "image/png",
          width: 1200,
          height: 630,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: page.metaTitle,
      description: page.metaDescription,
      images: [OG_IMAGE],
    },
  };
}

function buildSchema(page: SolvePage) {
  const url = `${SITE}/solve/${page.slug}`;
  return buildGraph(
    personSchema(),
    websiteSchema(),
    howToSchema({
      name: page.title,
      description: page.description,
      steps: page.steps,
    }),
    breadcrumbSchema([
      { label: "Home", href: "/" },
      { label: "Solve", href: "/solve/" },
      { label: page.shortTitle, href: url },
    ]),
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default async function SolveHubPage({
  params,
}: {
  params: Promise<{ problem: string }>;
}) {
  const { problem } = await params;
  if (!PROBLEM_PAGES[problem]) notFound();
  return <CachedSolveHub slug={problem} />;
}

async function CachedSolveHub({ slug }: { slug: string }) {
  "use cache";
  cacheTag("ideas", "ref-tables", `problem:${slug}`);
  cacheLife("hours");

  const page = PROBLEM_PAGES[slug];
  const allIdeas = await fetchAllIdeas();
  // Curate up to 6 ideas whose category matches this problem space.
  const matched = allIdeas
    .filter((idea) => page.categoryMatches.includes(idea.category))
    .sort(
      (a, b) =>
        (b.scores?.builder_confidence ?? 0) -
        (a.scores?.builder_confidence ?? 0),
    )
    .slice(0, 6);

  const color = COLOR_STYLES[page.color];
  const Icon = page.icon;
  const schema = buildSchema(page);

  return (
    <HubShell>
      <JsonLd schema={schema} />

      <HubBreadcrumb
        items={[
          { label: "Home", href: "/" },
          { label: page.shortTitle },
        ]}
      />

      <HubHero
        icon={<Icon size={28} className={color.text} aria-hidden="true" />}
        iconBoxClassName={color.bg10}
        title={page.title}
        description={page.description}
      />

      {/* Problem framing */}
      <section className="mb-16" aria-labelledby="overview-heading">
        <h2
          id="overview-heading"
          className="text-2xl font-medium text-white mb-6"
        >
          The Problem
        </h2>
        <div className="p-8 bg-white/5 border border-white/10 rounded-3xl">
          <p className="text-neutral-300 leading-relaxed mb-8">
            {page.problemIntro}
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {page.problemStats.map((stat) => (
              <div
                key={stat.stat}
                className="p-5 bg-white/5 border border-white/10 rounded-2xl"
              >
                <p className="text-sm text-neutral-400">{stat.stat}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Solution Ideas — curated from Convex */}
      {matched.length > 0 ? (
        <section className="mb-16" aria-labelledby="solutions-heading">
          <h2
            id="solutions-heading"
            className="text-2xl font-medium text-white mb-8"
          >
            Solution Ideas
          </h2>
          <HubIdeasGrid ideas={matched} />
        </section>
      ) : null}

      {/* Quick Start Guide — HowTo steps */}
      <section className="mb-16" aria-labelledby="quickstart-heading">
        <h2
          id="quickstart-heading"
          className="text-2xl font-medium text-white mb-8"
        >
          Quick Start Guide
        </h2>
        <ol className="space-y-4">
          {page.steps.map((step, i) => (
            <li
              key={step.name}
              className="flex gap-4 p-6 bg-white/5 border border-white/10 rounded-2xl"
            >
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center font-medium text-sm flex-shrink-0 ${color.bg10} ${color.text}`}
              >
                {i + 1}
              </div>
              <div>
                <h3 className="text-white font-medium mb-1">{step.name}</h3>
                <p className="text-neutral-400 text-sm leading-relaxed">
                  {step.text}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* Related Problems */}
      <HubRelatedTiles
        title="Related Problems to Solve"
        headingId="related-heading"
        className="mt-0 mb-16"
        items={PROBLEM_SLUGS.filter((s) => s !== slug).map((other) => ({
          slug: other,
          label: PROBLEM_PAGES[other].shortTitle.replace("Automate ", ""),
          href: `/solve/${other}`,
          icon: PROBLEM_PAGES[other].icon,
          iconClassName: "text-neutral-400",
        }))}
        allHref="/startup-ideas"
        allLabel="All Ideas"
        columnsLgClassName="lg:grid-cols-5"
      />

      <HubCta
        heading={`Ready to solve ${page.shortTitle.replace("Automate ", "").toLowerCase()}?`}
        body="Get the Starter Kit and ship your first solution this weekend."
      />
    </HubShell>
  );
}

void Wrench; // intentionally imported for future hub variants
