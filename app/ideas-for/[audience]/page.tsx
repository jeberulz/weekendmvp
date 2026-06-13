import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cacheLife, cacheTag } from "next/cache";
import type { LucideIcon } from "lucide-react";
import {
  Briefcase,
  Calendar,
  Clock,
  Code2,
  HeartHandshake,
  LayoutGrid,
  Lightbulb,
  MessageCircle,
  Palette,
  Rocket,
  ShieldCheck,
  Sparkles,
  Target,
  Terminal,
  TrendingUp,
  User,
  Zap,
} from "lucide-react";

import { JsonLd } from "@/components/primitives/JsonLd";
import { NavExternalLink } from "@/components/primitives/NavExternalLink";
import {
  HubBreadcrumb,
  HubChip,
  HubCountChip,
  HubHero,
  HubShell,
} from "@/components/hubs/HubShell";
import { HubCta } from "@/components/hubs/HubCta";
import { HubIdeasGrid, ideasItemList } from "@/components/hubs/HubIdeasGrid";
import { HubTracker } from "@/components/hubs/HubTracker";
import { COLOR_STYLES, type HubColor } from "@/components/hubs/hub-theme";
import {
  fetchIdeasByAudience,
  fetchRefTables,
} from "@/components/hubs/hub-data";
import {
  breadcrumbSchema,
  buildGraph,
  collectionPageSchema,
  personSchema,
  websiteSchema,
} from "@/lib/seo";

const SITE = "https://weekendmvp.app";
const OG_IMAGE = `${SITE}/image/og-image.png`;

/* ------------------------------------------------------------------ */
/* Static audience content — ported from the legacy                    */
/* ideas-for/{slug}/index.html pages (hero copy, "Why X" positioning,  */
/* advantage cards, chips). Convex audiences rows override the          */
/* description/resources at render time when reachable.                */
/* ------------------------------------------------------------------ */

type Advantage = { icon: LucideIcon; title: string; description: string };
type Resource = { title: string; url: string; description: string };

type AudiencePage = {
  slug: string;
  name: string;
  title: string;
  metaDescription: string;
  description: string;
  color: HubColor;
  icon: LucideIcon;
  skillChip: string;
  timeChip: string;
  positioning: string;
  /** When true, advantage icons use the audience accent (hand-built pages). */
  accentAdvantages: boolean;
  advantages: Advantage[];
  resources: Resource[];
};

const GENERATED_ADVANTAGE_ICONS: LucideIcon[] = [Sparkles, Target, TrendingUp];

function traitsToAdvantages(traits: string[]): Advantage[] {
  return traits.slice(0, 3).map((trait, i) => ({
    icon: GENERATED_ADVANTAGE_ICONS[i] ?? Sparkles,
    title: trait.split(" ").slice(0, 4).join(" "),
    description: trait,
  }));
}

const AUDIENCE_PAGES: Record<string, AudiencePage> = {
  developers: {
    slug: "developers",
    name: "Developers",
    title: "Startup Ideas for Developers",
    metaDescription:
      "Curated startup ideas perfect for developers. Build technical products, developer tools, and complex applications that leverage your coding skills.",
    description:
      "Ideas that leverage your coding skills. Build technical products, developer tools, and complex applications that non-technical founders can't easily replicate.",
    color: "emerald",
    icon: Terminal,
    skillChip: "Advanced skill level",
    timeChip: "8-12 hours build time",
    positioning:
      "As a developer, you have a massive unfair advantage: you can build your own products. While others need to hire developers, raise capital, or use limited no-code tools, you can turn ideas into reality in a weekend. Your technical skills let you build complex backends, integrate APIs, and create products with real moats.",
    accentAdvantages: true,
    advantages: [
      {
        icon: Code2,
        title: "Build Complex Backends",
        description:
          "Create APIs, databases, and infrastructure that no-code tools can't replicate.",
      },
      {
        icon: Rocket,
        title: "Iterate Quickly",
        description:
          "Ship features fast without dependency on others. Your feedback loop is incredibly tight.",
      },
      {
        icon: Lightbulb,
        title: "Understand Dev Pain Points",
        description:
          "You know what developers need because you live it daily. Build tools you'd actually use.",
      },
    ],
    resources: [
      {
        title: "Indie Hackers",
        url: "https://indiehackers.com",
        description:
          "Community of developers building profitable products. Share progress, get feedback, and learn from others.",
      },
      {
        title: "Hacker News",
        url: "https://news.ycombinator.com",
        description:
          "Tech community for product discovery and feedback. Great for Show HN launches and getting early users.",
      },
    ],
  },
  designers: {
    slug: "designers",
    name: "Designers",
    title: "Startup Ideas for Designers",
    metaDescription:
      "Curated startup ideas perfect for designers. Filter by build time, revenue potential, and tech stack.",
    description:
      "Ideas that put your design skills front and center. Ship polished products, tools for creatives, and interfaces people pay for.",
    color: "rose",
    icon: Palette,
    skillChip: "Intermediate skill level",
    timeChip: "Flexible build time",
    positioning:
      "Designers win when UX is the product. These ideas let you ship polished interfaces fast, sell to creative professionals, or build tools other designers pay for daily.",
    accentAdvantages: false,
    advantages: traitsToAdvantages([
      "Strong visual and UX skills",
      "Understand user psychology",
      "Can create compelling landing pages",
    ]),
    resources: [
      {
        title: "Dribbble",
        url: "https://dribbble.com",
        description: "Design community for inspiration and exposure",
      },
      {
        title: "Designer Fund",
        url: "https://designerfund.com",
        description: "Resources for design founders",
      },
    ],
  },
  "non-technical": {
    slug: "non-technical",
    name: "Non-Technical Founders",
    title: "Startup Ideas for Non-Technical Founders",
    metaDescription:
      "Curated startup ideas perfect for non-technical founders. Build without coding using no-code tools, AI builders, or hire developers for specific components.",
    description:
      "Ideas you can build without coding. Use no-code tools, AI builders, or hire developers for specific components.",
    color: "amber",
    icon: Lightbulb,
    skillChip: "Beginner-friendly",
    timeChip: "8-12 hours with no-code",
    positioning:
      "Being non-technical isn't a weakness—it's a different kind of strength. You have deep domain expertise, strong customer empathy, and sales skills that many technical founders lack. With modern no-code tools and AI builders, you can now build functional products without writing a single line of code. Your advantage is understanding the business problem deeply while technical execution becomes a commodity.",
    accentAdvantages: true,
    advantages: [
      {
        icon: Target,
        title: "Business & Domain Expertise",
        description:
          "You understand the market, the pain points, and what customers actually need.",
      },
      {
        icon: MessageCircle,
        title: "Strong Communication Skills",
        description:
          "You can sell, pitch, and build relationships—skills that close deals.",
      },
      {
        icon: HeartHandshake,
        title: "Customer-First Thinking",
        description:
          "You validate through conversations, not code. That's often the faster path to product-market fit.",
      },
    ],
    resources: [
      {
        title: "MakerPad",
        url: "https://makerpad.zapier.com",
        description: "Learn to build with no-code tools",
      },
      {
        title: "No Code MBA",
        url: "https://nocode.mba",
        description: "No-code courses and tutorials for founders",
      },
    ],
  },
  "solo-founders": {
    slug: "solo-founders",
    name: "Solo Founders",
    title: "Startup Ideas for Solo Founders",
    metaDescription:
      "Curated startup ideas optimized for one person to build and run. Low operational complexity, scalable, and manageable without a team.",
    description:
      "Ideas optimized for one person to build and run. Low operational complexity, scalable, and manageable without a team.",
    color: "blue",
    icon: User,
    skillChip: "Mixed skill levels",
    timeChip: "8-12 hours build time",
    positioning:
      "Going solo isn't a limitation—it's a superpower. You can move faster than any team, make decisions without meetings, and pivot on a dime. The best solo founder businesses are ones that leverage automation, have low customer support needs, and can scale without adding headcount. These ideas are specifically chosen because one person can build, launch, and grow them to meaningful revenue.",
    accentAdvantages: true,
    advantages: [
      {
        icon: Rocket,
        title: "Move Fast, Decide Faster",
        description:
          "No consensus needed, no meetings. Ship in hours what teams ship in weeks.",
      },
      {
        icon: ShieldCheck,
        title: "Full Control, Full Ownership",
        description:
          "No investors, no co-founder conflicts. Build exactly what you want.",
      },
      {
        icon: TrendingUp,
        title: "Profit From Day One",
        description:
          "No salaries to pay, no burn rate to manage. Every dollar of revenue is yours.",
      },
    ],
    resources: [
      {
        title: "Indie Hackers",
        url: "https://indiehackers.com",
        description: "Community of solo founders building profitable products",
      },
      {
        title: "MicroConf",
        url: "https://microconf.com",
        description: "Community and events for bootstrapped founders",
      },
    ],
  },
  "weekend-builders": {
    slug: "weekend-builders",
    name: "Weekend Builders",
    title: "Startup Ideas for Weekend Builders",
    metaDescription:
      "Curated startup ideas perfect for weekend builders. Filter by build time, revenue potential, and tech stack.",
    description:
      "Tight-scope ideas you can take from Friday night to Sunday launch. Built for momentum, not perfection.",
    color: "orange",
    icon: Calendar,
    skillChip: "Mixed skill level",
    timeChip: "8-10 hours build time",
    positioning:
      "Weekend builders trade perfection for momentum. These ideas have tight scope, obvious value props, and a realistic path from Friday night to Sunday launch.",
    accentAdvantages: false,
    advantages: traitsToAdvantages([
      "Limited time availability",
      "Value shipping over perfection",
      "Comfortable with MVPs",
    ]),
    resources: [
      {
        title: "Ship 30 for 30",
        url: "https://marclou.beehiiv.com",
        description: "Build and launch fast, repeatedly",
      },
      {
        title: "Weekend MVP",
        url: "https://weekendmvp.app",
        description: "Templates and prompts to ship by Sunday",
      },
    ],
  },
  "side-hustlers": {
    slug: "side-hustlers",
    name: "Side Hustlers",
    title: "Startup Ideas for Side Hustlers",
    metaDescription:
      "Curated startup ideas perfect for side hustlers. Filter by build time, revenue potential, and tech stack.",
    description:
      "Low-maintenance ideas that earn while you keep your day job. Automation-first products with clear ROI for busy buyers.",
    color: "purple",
    icon: Briefcase,
    skillChip: "Mixed skill level",
    timeChip: "Flexible build time",
    positioning:
      "Side hustlers need low-maintenance products that earn while you keep your day job. These ideas prioritize automation, async delivery, and clear ROI for busy buyers.",
    accentAdvantages: false,
    advantages: traitsToAdvantages([
      "Time-constrained but consistent",
      "Looking for supplemental income",
      "Risk-averse, keeping job security",
    ]),
    resources: [
      {
        title: "Side Project Stack",
        url: "https://sideprojectstack.com",
        description: "Tool stacks for shipping side projects",
      },
      {
        title: "r/SideProject",
        url: "https://www.reddit.com/r/SideProject/",
        description: "Community for launching and sharing side projects",
      },
    ],
  },
};

export const AUDIENCE_SLUGS = Object.keys(AUDIENCE_PAGES);

/** Legacy "Ideas For Other Audiences" tile colors/icons. */
const AUDIENCE_TILES: Array<{
  slug: string;
  label: string;
  icon: LucideIcon;
  iconClass: string;
}> = [
  { slug: "developers", label: "Developers", icon: Terminal, iconClass: "text-emerald-400" },
  { slug: "designers", label: "Designers", icon: Palette, iconClass: "text-pink-400" },
  { slug: "non-technical", label: "Non-Technical", icon: Lightbulb, iconClass: "text-amber-400" },
  { slug: "solo-founders", label: "Solo Founders", icon: User, iconClass: "text-blue-400" },
  { slug: "weekend-builders", label: "Weekend Builders", icon: Calendar, iconClass: "text-purple-400" },
  { slug: "side-hustlers", label: "Side Hustlers", icon: Briefcase, iconClass: "text-cyan-400" },
];

/* ------------------------------------------------------------------ */
/* Params + metadata                                                   */
/* ------------------------------------------------------------------ */

export async function generateStaticParams() {
  // Hardcoded — these are stable SEO URLs; Convex may be down at build time.
  return AUDIENCE_SLUGS.map((audience) => ({ audience }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ audience: string }>;
}): Promise<Metadata> {
  const { audience } = await params;
  const page = AUDIENCE_PAGES[audience];
  if (!page) return {};
  const url = `${SITE}/ideas-for/${page.slug}`;
  return {
    title: { absolute: `${page.title} | Weekend MVP` },
    description: page.metaDescription,
    authors: [{ name: "John Iseghohi" }],
    alternates: { canonical: `/ideas-for/${page.slug}` },
    openGraph: {
      type: "website",
      url,
      title: `${page.title} | Weekend MVP`,
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
      title: `${page.title} | Weekend MVP`,
      description: page.metaDescription,
      images: [OG_IMAGE],
    },
  };
}

/* ------------------------------------------------------------------ */
/* JSON-LD — ported from the legacy audience pages                     */
/* ------------------------------------------------------------------ */

function buildSchema(
  page: AudiencePage,
  description: string,
  ideas: Awaited<ReturnType<typeof fetchIdeasByAudience>>,
) {
  const url = `${SITE}/ideas-for/${page.slug}`;
  return buildGraph(
    personSchema(),
    websiteSchema(),
    {
      ...collectionPageSchema({
        title: page.title,
        description,
        url,
        audienceType: page.name,
      }),
      mainEntity: ideasItemList(ideas),
    },
    breadcrumbSchema([
      { label: "Home", href: "/" },
      { label: "Ideas For", href: "/ideas-for/" },
      { label: page.name, href: url },
    ]),
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default async function AudienceHubPage({
  params,
}: {
  params: Promise<{ audience: string }>;
}) {
  const { audience } = await params;
  if (!AUDIENCE_PAGES[audience]) notFound();
  return <CachedAudienceHub slug={audience} />;
}

async function CachedAudienceHub({ slug }: { slug: string }) {
  "use cache";
  cacheTag("ideas", "ref-tables", `audience:${slug}`);
  cacheLife("hours");

  const page = AUDIENCE_PAGES[slug];
  const [ideas, refTables] = await Promise.all([
    fetchIdeasByAudience(slug),
    fetchRefTables(),
  ]);
  const audienceRow = refTables?.audiences.find((a) => a.slug === slug) ?? null;

  // Reference-table copy drives the hero when Convex is reachable; the
  // static port (same manifest data) is the build-time fallback.
  const description = audienceRow?.description ?? page.description;
  const resources: Resource[] =
    (audienceRow?.resources as Resource[] | undefined)?.filter(
      (r) => r?.title && r?.url,
    ) ?? page.resources;

  const color = COLOR_STYLES[page.color];
  const Icon = page.icon;
  const schema = buildSchema(page, description, ideas);

  return (
    <HubShell>
      <JsonLd schema={schema} />
      <HubTracker
        event="view_audience_page"
        props={{ audience_name: page.name, idea_count: ideas.length }}
      />

      <HubBreadcrumb
        items={[
          { label: "Home", href: "/" },
          { label: `Ideas for ${page.name}` },
        ]}
      />

      <HubHero
        icon={<Icon size={28} className={color.text} aria-hidden="true" />}
        iconBoxClassName={color.bg10}
        title={page.title}
        description={description}
        chips={
          <>
            {ideas.length > 0 ? (
              <HubCountChip>{ideas.length} curated ideas</HubCountChip>
            ) : null}
            <HubChip>
              <Zap size={14} aria-hidden="true" />
              {page.skillChip}
            </HubChip>
            <HubChip>
              <Clock size={14} aria-hidden="true" />
              {page.timeChip}
            </HubChip>
          </>
        }
      />

      {/* Why This Audience */}
      <section className="mb-16" aria-labelledby="why-heading">
        <h2 id="why-heading" className="text-2xl font-medium text-white mb-6">
          Why {page.name} Are Uniquely Positioned
        </h2>
        <div className="p-8 bg-white/5 border border-white/10 rounded-3xl">
          <p className="text-neutral-300 leading-relaxed mb-6">
            {page.positioning}
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {page.advantages.map((advantage) => {
              const AdvIcon = advantage.icon;
              return (
                <div
                  key={advantage.title}
                  className="p-4 bg-white/5 rounded-2xl"
                >
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${
                      page.accentAdvantages ? color.bg10 : "bg-white/5"
                    }`}
                  >
                    <AdvIcon
                      size={20}
                      className={
                        page.accentAdvantages ? color.text : "text-white/70"
                      }
                      aria-hidden="true"
                    />
                  </div>
                  <h3 className="text-white font-medium mb-1">
                    {advantage.title}
                  </h3>
                  <p className="text-neutral-500 text-sm">
                    {advantage.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Ideas Grid */}
      {ideas.length > 0 ? (
        <section aria-labelledby="ideas-heading">
          <h2
            id="ideas-heading"
            className="text-2xl font-medium text-white mb-8"
          >
            Curated Ideas for {page.name}
          </h2>
          <HubIdeasGrid ideas={ideas} />
        </section>
      ) : null}

      {/* Resources */}
      {resources.length > 0 ? (
        <section className="mt-24" aria-labelledby="resources-heading">
          <h2
            id="resources-heading"
            className="text-2xl font-medium text-white mb-8"
          >
            Resources for {page.name}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {resources.map((resource) => (
              <NavExternalLink
                key={resource.url}
                href={resource.url}
                className="group block p-6 bg-white/5 border border-white/10 rounded-2xl hover:border-white/20 hover:bg-white/[0.07] transition-all"
              >
                <h3 className="text-white font-medium mb-2 group-hover:text-neutral-200 transition-colors">
                  {resource.title}
                </h3>
                <p className="text-neutral-500 text-sm">
                  {resource.description}
                </p>
              </NavExternalLink>
            ))}
          </div>
        </section>
      ) : null}

      {/* Other Audiences */}
      <section className="mt-24" aria-labelledby="other-audiences-heading">
        <h2
          id="other-audiences-heading"
          className="text-2xl font-medium text-white mb-8"
        >
          Ideas For Other Audiences
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {AUDIENCE_TILES.filter((tile) => tile.slug !== slug).map((tile) => {
            const TileIcon = tile.icon;
            return (
              <Link
                key={tile.slug}
                href={`/ideas-for/${tile.slug}`}
                className="group p-4 bg-white/5 border border-white/10 rounded-xl hover:border-white/20 hover:bg-white/[0.07] transition-all text-center"
              >
                <TileIcon
                  size={24}
                  className={`${tile.iconClass} mb-2 mx-auto`}
                  aria-hidden="true"
                />
                <p className="text-white text-sm font-medium group-hover:text-neutral-200 transition-colors">
                  {tile.label}
                </p>
              </Link>
            );
          })}
          <Link
            href="/startup-ideas"
            className="group p-4 bg-white/5 border border-white/10 rounded-xl hover:border-white/20 hover:bg-white/[0.07] transition-all text-center"
          >
            <LayoutGrid
              size={24}
              className="text-neutral-400 mb-2 mx-auto"
              aria-hidden="true"
            />
            <p className="text-white text-sm font-medium group-hover:text-neutral-200 transition-colors">
              All Ideas
            </p>
          </Link>
        </div>
      </section>

      <HubCta
        heading="Ready to start building?"
        body={`Get the Weekend MVP Starter Kit with templates optimized for ${page.name.toLowerCase()}.`}
      />
    </HubShell>
  );
}
