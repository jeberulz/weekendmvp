import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cacheLife, cacheTag } from "next/cache";
import { connection } from "next/server";

export const instant = false;
import {
  Calendar,
  CheckCircle2,
  FileText,
  Headphones,
  Library,
  PenLine,
  Receipt,
  Target,
  Wrench,
} from "lucide-react";

import { Container, Em } from "@/components/home/ui";
import { categoryName } from "@/components/ideas/idea-meta";
import { JsonLd } from "@/components/primitives/JsonLd";
import { HubCta } from "@/components/hubs/HubCta";
import { fetchAllIdeas } from "@/components/hubs/hub-data";
import { IdeaBrowser } from "@/components/public/IdeaBrowser";
import { PageHeader } from "@/components/public/PageHeader";
import { PublicShell } from "@/components/public/PublicShell";
import { InkBand, KeepBrowsing, SectionHeading } from "@/components/public/Sections";
import { toPublicIdeas } from "@/lib/public/ideas";
import { cn } from "@/lib/utils";
import {
  SITE,
  breadcrumbSchema,
  buildGraph,
  howToSchema,
  organizationSchema,
  personSchema,
  websiteSchema,
} from "@/lib/seo";

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
  "lead-generation": {
    slug: "lead-generation",
    shortTitle: "Automate Lead Generation",
    metaTitle: "How to Automate Lead Generation | Weekend MVP",
    metaDescription:
      "How to automate lead generation with startup ideas for AI prospecting tools you can validate and build this weekend.",
    title: "How to Automate Lead Generation",
    description:
      "Turn scattered prospect lists into a repeatable pipeline. Build AI-powered lead research, scoring, and outreach workflows that help founders find buyers faster.",
    icon: Target,
    problemIntro:
      "Lead generation breaks when founders rely on cold spreadsheets, generic lists, and one-off outreach bursts. The hard part is not finding more names — it is spotting high-intent buyers, personalizing the first message, and following up without losing context. AI can turn research, qualification, and reminders into a weekend build that creates pipeline while you focus on sales calls.",
    problemStats: [
      { stat: "Most B2B teams need 8+ touches before a prospect replies, but founders rarely follow up consistently." },
      { stat: "Generic lead lists waste 30%+ of outreach on poor-fit accounts before qualification." },
      { stat: "Personalized prospect research can take 10-15 minutes per lead, making manual outbound hard to scale." },
    ],
    steps: [
      { name: "Choose a narrow ICP", text: "Define the buyer role, company size, trigger event, and pain point your lead generation tool should target first." },
      { name: "Collect and enrich signals", text: "Pull prospect data from public profiles, directories, forms, or CRM records and enrich it with AI-generated context." },
      { name: "Score and personalize", text: "Rank leads by fit and intent, then generate short outreach angles tied to each prospect's likely problem." },
      { name: "Automate follow-up loops", text: "Send reminders, route warm replies, and update your CRM so every qualified lead gets the next best action." },
    ],
    categoryMatches: ["saas", "ai-tools", "automation", "b2b"],
  },
  "content-creation": {
    slug: "content-creation",
    shortTitle: "Automate Content Creation",
    metaTitle: "How to Automate Content Creation | Weekend MVP",
    metaDescription:
      "How to automate content creation with AI content creation tools, startup ideas, and weekend MVP workflows for publishing faster.",
    title: "How to Automate Content Creation",
    description:
      "Move from blank page to publish-ready assets faster. Build AI tools that turn raw expertise into briefs, drafts, repurposed posts, and reusable content workflows.",
    icon: PenLine,
    problemIntro:
      "Content creation slows down when every post starts from a blank page and every channel needs a different format. Founders and creators have ideas, calls, notes, and customer questions, but turning that raw material into consistent publishing takes hours. AI content creation tools can capture inputs, shape drafts, and repurpose assets so a weekend MVP becomes a repeatable content engine.",
    problemStats: [
      { stat: "A single long-form asset can become 10+ short posts, emails, or scripts when repurposing is automated." },
      { stat: "Creators often spend 50%+ of content time on editing, formatting, and channel-specific rewrites." },
      { stat: "Teams that publish weekly need 4-8 reusable briefs or outlines every month to keep momentum." },
    ],
    steps: [
      { name: "Capture source material", text: "Collect calls, notes, transcripts, customer questions, and product updates that already contain useful content ideas." },
      { name: "Generate briefs and angles", text: "Use AI to turn raw inputs into titles, audience hooks, outlines, and channel-specific content angles." },
      { name: "Draft reusable assets", text: "Create first drafts for posts, newsletters, scripts, or landing sections while preserving your voice and proof points." },
      { name: "Repurpose and schedule", text: "Break each approved asset into smaller formats, add review steps, and queue the content for publishing." },
    ],
    categoryMatches: ["creator-tools", "ai-tools", "saas", "productivity"],
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
    organizationSchema(),
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
  await connection();
  return <CachedSolveHub slug={problem} />;
}

/** Italic tail appended to the H1 (WP56 ruling: the existing title stays verbatim first). */
const PROBLEM_TAIL: Record<string, string> = {
  "customer-support": "without hiring.",
  "lead-generation": "without the busywork.",
  "content-creation": "without starting from scratch.",
  invoicing: "without chasing payments.",
  "knowledge-transfer": "so it stays when people leave.",
  "meeting-notes": "without taking notes.",
  scheduling: "without the email ping-pong.",
};

/** "a, b & c" for the meta line. */
function joinNames(names: string[]): string {
  if (names.length < 2) return names.join("");
  return `${names.slice(0, -1).join(", ")} & ${names[names.length - 1]}`;
}

/** Splits a stat that opens with a percentage ("70%+ of …") so the number can be set large. */
function splitLeadingPercent(stat: string): { figure: string; plus: string; rest: string } | null {
  const match = /^(\d[\d,.]*%)(\+?)\s+(.+)$/.exec(stat);
  return match ? { figure: match[1], plus: match[2], rest: match[3] } : null;
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

  const schema = buildSchema(page);
  const list = toPublicIdeas(matched);
  const tail = PROBLEM_TAIL[slug];
  const lead = splitLeadingPercent(page.problemStats[0]?.stat ?? "");
  const stats = lead ? page.problemStats.slice(1) : page.problemStats;

  return (
    <PublicShell>
      <JsonLd schema={schema} />

      <PageHeader
        crumbs={[
          { label: "Home", href: "/" },
          { label: page.shortTitle },
        ]}
        title={
          <>
            {page.title}
            {tail && (
              <>
                {" "}
                <Em>{tail}</Em>
              </>
            )}
          </>
        }
        description={page.description}
        meta={[
          `${page.steps.length}-step quickstart`,
          `Ideas from ${joinNames(page.categoryMatches.map(categoryName))}`,
        ]}
      />

      {/* Problem framing: intro on the left, the stats as a ruled list on the right */}
      <section aria-labelledby="overview-heading" className="pt-14 lg:pt-20">
        <Container className="grid grid-cols-1 items-start gap-10 border-t border-home-ink pt-10 lg:grid-cols-2 lg:gap-16 lg:pt-12">
          <SectionHeading id="overview-heading" intro={page.problemIntro} className="gap-5">
            The Problem
          </SectionHeading>
          <div className="flex flex-col">
            {lead ? (
              <p className="mb-6 flex flex-col gap-2">
                <span className="font-editorial text-[72px] leading-[0.9] tracking-[-0.04em] text-home-ink md:text-[96px]">
                  {lead.figure}
                  {lead.plus ? <span className="text-home-orange">{lead.plus}</span> : null}
                </span>{" "}
                <span className="max-w-[440px] text-lg leading-[1.5] text-home-ink">{lead.rest}</span>
              </p>
            ) : null}
            <ul className="border-b border-home-rule">
              {stats.map((stat) => (
                <li
                  key={stat.stat}
                  className={cn(
                    "border-t py-4 text-base leading-[1.5] text-home-ink-2",
                    lead ? "border-home-rule" : "border-home-rule first:border-home-ink",
                  )}
                >
                  {stat.stat}
                </li>
              ))}
            </ul>
          </div>
        </Container>
      </section>

      {/* Solution Ideas — curated from Convex */}
      {list.length > 0 ? (
        <Container className="py-14 lg:py-20">
          <IdeaBrowser ideas={list} headingId="solutions-heading" heading="Solution Ideas" />
        </Container>
      ) : null}

      {/* Quick Start Guide — HowTo steps, full-bleed ink */}
      <InkBand labelledBy="quickstart-heading">
        <div className="flex flex-col gap-10 lg:gap-12">
          <SectionHeading id="quickstart-heading" dark>
            Quick Start <Em dark>Guide</Em>
          </SectionHeading>
          <ol className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {page.steps.map((step, i) => (
              <li key={step.name} className="flex flex-col gap-3 border-t border-home-dr pt-5">
                <span aria-hidden className="font-editorial text-[40px] italic leading-none text-home-orange-light">
                  {i + 1}
                </span>
                <h3 className="font-editorial text-2xl font-normal leading-[1.15] text-home-d1">{step.name}</h3>
                <p className="text-[15px] leading-[1.55] text-home-d2">{step.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </InkBand>

      {/* Related Problems */}
      <KeepBrowsing
        id="related-heading"
        heading="Related Problems to Solve"
        links={[
          ...PROBLEM_SLUGS.filter((s) => s !== slug).map((other) => ({
            href: `/solve/${other}`,
            label: PROBLEM_PAGES[other].shortTitle.replace("Automate ", ""),
          })),
          { href: "/startup-ideas", label: "All Ideas" },
        ]}
      />

      <HubCta
        heading={`Ready to solve ${page.shortTitle.replace("Automate ", "").toLowerCase()}?`}
        body="Get the Starter Kit and ship your first solution this weekend."
      />
    </PublicShell>
  );
}

void Wrench; // intentionally imported for future hub variants
