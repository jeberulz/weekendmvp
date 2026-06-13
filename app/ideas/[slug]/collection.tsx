import type { ReactNode } from "react";
import Link from "next/link";
import { cacheLife, cacheTag } from "next/cache";
import {
  Boxes,
  Clock,
  DollarSign,
  LayoutGrid,
  Lightbulb,
  Rocket,
  Sparkles,
  Target,
  TrendingUp,
  Wallet,
  Zap,
} from "lucide-react";

import { JsonLd } from "@/components/primitives/JsonLd";
import {
  HubBreadcrumb,
  HubChip,
  HubCountChip,
  HubDarkSection,
  HubHero,
} from "@/components/hubs/HubShell";
import { HubCta } from "@/components/hubs/HubCta";
import { HubIdeasGrid, ideasItemList } from "@/components/hubs/HubIdeasGrid";
import { COLOR_STYLES, type HubColor } from "@/components/hubs/hub-theme";
import {
  fetchAllIdeas,
  fetchIdeasByCategory,
  fetchIdeasByRevenueGoal,
} from "@/components/hubs/hub-data";
import {
  breadcrumbSchema,
  buildGraph,
  collectionPageSchema,
  personSchema,
  websiteSchema,
} from "@/lib/seo";

const SITE = "https://weekendmvp.app";

type CollectionKind = "category" | "revenue" | "buildTime";

type CollectionDef = {
  slug: string;
  kind: CollectionKind;
  title: string;
  description: string;
  color: HubColor;
  icon: typeof Sparkles;
  /** For buildTime collections, the manifest buildTime values that qualify. */
  buildTimeValues?: string[];
};

/* ------------------------------------------------------------------ */
/* Collection map — every slug here corresponds to a legacy            */
/* ideas/{slug}/index.html hub. Hubs missing from this map fall        */
/* through to notFound() so unknown idea slugs still 404 correctly.    */
/* ------------------------------------------------------------------ */

const COLLECTIONS: Record<string, CollectionDef> = {
  // Category hubs (matches Convex idea.category values)
  saas: {
    slug: "saas",
    kind: "category",
    title: "SaaS Startup Ideas",
    description:
      "Recurring-revenue software businesses you can ship this weekend. Each one is scoped to launch, validate, and start charging customers within 8–12 hours.",
    color: "blue",
    icon: Boxes,
  },
  "ai-tools": {
    slug: "ai-tools",
    kind: "category",
    title: "AI Tool Startup Ideas",
    description:
      "AI-powered products with clear value props and obvious build paths. The kind of ideas you can prompt-engineer your way to MVP in a weekend.",
    color: "purple",
    icon: Sparkles,
  },
  automation: {
    slug: "automation",
    kind: "category",
    title: "Automation Startup Ideas",
    description:
      "Workflow automation tools that eliminate manual work. Glue products, integration tools, and AI agents that replace expensive human steps.",
    color: "emerald",
    icon: Zap,
  },
  "developer-tools": {
    slug: "developer-tools",
    kind: "category",
    title: "Developer Tool Startup Ideas",
    description:
      "Tools developers pay for because they live the problem daily. Highest builder confidence, smallest distribution gap.",
    color: "emerald",
    icon: Target,
  },
  productivity: {
    slug: "productivity",
    kind: "category",
    title: "Productivity Startup Ideas",
    description:
      "Apps that give knowledge workers their hours back. Note-takers, scheduling tools, calendar layers, focus aids — clear willingness to pay.",
    color: "amber",
    icon: Lightbulb,
  },

  // Revenue goal hubs
  "1k-month": {
    slug: "1k-month",
    kind: "revenue",
    title: "Startup Ideas That Can Make $1k/Month",
    description:
      "Tight-scope ideas with realistic paths to $1,000 MRR. Perfect first targets for solo builders proving they can charge for software.",
    color: "emerald",
    icon: Wallet,
  },
  "5k-month": {
    slug: "5k-month",
    kind: "revenue",
    title: "Startup Ideas That Can Make $5k/Month",
    description:
      "Ideas with real unit economics targeting $5,000 MRR — replacement-income level for most solo founders.",
    color: "amber",
    icon: DollarSign,
  },
  "10k-month": {
    slug: "10k-month",
    kind: "revenue",
    title: "Startup Ideas That Can Make $10k/Month",
    description:
      "Ambitious ideas with paths to $10,000 MRR or beyond. These are real businesses — quit-your-job money built on a weekend foundation.",
    color: "purple",
    icon: TrendingUp,
  },
  "passive-income": {
    slug: "passive-income",
    kind: "revenue",
    title: "Passive Income Startup Ideas",
    description:
      "Low-maintenance products that earn while you sleep. Automation-first, async delivery, minimal customer support burden.",
    color: "blue",
    icon: Wallet,
  },
  "quick-wins": {
    slug: "quick-wins",
    kind: "revenue",
    title: "Quick-Win Startup Ideas",
    description:
      "Ideas with the shortest path from build to first paying customer. Tight scope, obvious value, fast feedback.",
    color: "orange",
    icon: Rocket,
  },

  // Build time hubs (matches buildTime hour values from ideas/manifest.json)
  "build-in-weekend": {
    slug: "build-in-weekend",
    kind: "buildTime",
    title: "Startup Ideas You Can Build in a Weekend",
    description:
      "Friday-night-to-Sunday-launch ideas. Tight scope, no infrastructure rabbit holes, ready to validate Monday morning.",
    color: "orange",
    icon: Rocket,
    buildTimeValues: ["8", "10", "12"],
  },
  "build-in-8-hours": {
    slug: "build-in-8-hours",
    kind: "buildTime",
    title: "Startup Ideas You Can Build in 8 Hours",
    description:
      "Tightest scope possible. Single-day sprints that prove the idea works before you invest the full weekend.",
    color: "rose",
    icon: Clock,
    buildTimeValues: ["8"],
  },
  "build-in-1-week": {
    slug: "build-in-1-week",
    kind: "buildTime",
    title: "Startup Ideas You Can Build in a Week",
    description:
      "Ideas needing more than a weekend but still shippable in a week of focused work. Slightly more complex backends, real auth, multi-step flows.",
    color: "purple",
    icon: Clock,
    buildTimeValues: ["20", "24", "30", "40"],
  },
};

export const COLLECTION_SLUGS = Object.keys(COLLECTIONS);

/* ------------------------------------------------------------------ */
/* Collection metadata (consumed by app/ideas/[slug]/page.tsx          */
/* generateMetadata fallback when the idea resolution returns null)    */
/* ------------------------------------------------------------------ */

export function getCollectionMeta(slug: string): {
  title: string;
  description: string;
} | null {
  const def = COLLECTIONS[slug];
  if (!def) return null;
  return { title: def.title, description: def.description };
}

/* ------------------------------------------------------------------ */
/* renderCollection — called from app/ideas/[slug]/page.tsx as the     */
/* third resolution path (MDX → Convex body → renderCollection)        */
/* ------------------------------------------------------------------ */

export async function renderCollection(
  slug: string,
): Promise<ReactNode | null> {
  const def = COLLECTIONS[slug];
  if (!def) return null;
  return <CachedCollectionHub slug={slug} />;
}

async function CachedCollectionHub({ slug }: { slug: string }) {
  "use cache";
  cacheTag("ideas", `collection:${slug}`);
  cacheLife("hours");

  const def = COLLECTIONS[slug];
  const ideas = await fetchIdeasForCollection(def);
  const color = COLOR_STYLES[def.color];
  const Icon = def.icon;
  const schema = buildCollectionSchema(def, ideas);

  return (
    <HubDarkSection>
      <JsonLd schema={schema} />

      <HubBreadcrumb
        items={[
          { label: "Home", href: "/" },
          { label: "Ideas", href: "/startup-ideas" },
          { label: def.title.replace(" Startup Ideas", "").trim() },
        ]}
      />

      <HubHero
        icon={<Icon size={28} className={color.text} aria-hidden="true" />}
        iconBoxClassName={color.bg10}
        title={def.title}
        description={def.description}
        chips={
          ideas.length > 0 ? (
            <>
              <HubCountChip>{ideas.length} curated ideas</HubCountChip>
              <HubChip>
                <Zap size={14} aria-hidden="true" />
                Sorted by builder confidence
              </HubChip>
            </>
          ) : undefined
        }
      />

      {/* Ideas grid */}
      {ideas.length > 0 ? (
        <section aria-labelledby="ideas-heading">
          <h2 id="ideas-heading" className="sr-only">
            Ideas in this collection
          </h2>
          <HubIdeasGrid ideas={ideas} />
        </section>
      ) : (
        <p className="text-neutral-500 italic">
          Ideas in this collection will appear once the live data source is
          reachable. Refresh in a moment.
        </p>
      )}

      {/* Browse other collections */}
      <section className="mt-24" aria-labelledby="other-collections-heading">
        <h2
          id="other-collections-heading"
          className="text-2xl font-medium text-white mb-8"
        >
          Browse other collections
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {COLLECTION_SLUGS.filter((s) => s !== slug)
            .slice(0, 7)
            .map((other) => {
              const OtherIcon = COLLECTIONS[other].icon;
              return (
                <Link
                  key={other}
                  href={`/ideas/${other}`}
                  className="group p-4 bg-white/5 border border-white/10 rounded-xl hover:border-white/20 hover:bg-white/[0.07] transition-all"
                >
                  <OtherIcon
                    size={20}
                    className="text-neutral-400 mb-2"
                    aria-hidden="true"
                  />
                  <p className="text-white text-sm font-medium group-hover:text-neutral-200 transition-colors">
                    {COLLECTIONS[other].title.replace(" Startup Ideas", "")}
                  </p>
                </Link>
              );
            })}
          <Link
            href="/startup-ideas"
            className="group p-4 bg-white/5 border border-white/10 rounded-xl hover:border-white/20 hover:bg-white/[0.07] transition-all"
          >
            <LayoutGrid
              size={20}
              className="text-neutral-400 mb-2"
              aria-hidden="true"
            />
            <p className="text-white text-sm font-medium group-hover:text-neutral-200 transition-colors">
              All Ideas
            </p>
          </Link>
        </div>
      </section>

      <HubCta
        heading="Ready to ship?"
        body="The Weekend MVP Starter Kit has the prompts, templates, and 48-hour plan that turn any of these ideas into a live product."
      />
    </HubDarkSection>
  );
}

async function fetchIdeasForCollection(def: CollectionDef) {
  if (def.kind === "category") {
    const list = await fetchIdeasByCategory(def.slug);
    return list.sort(
      (a, b) =>
        (b.scores?.builder_confidence ?? 0) -
        (a.scores?.builder_confidence ?? 0),
    );
  }
  if (def.kind === "revenue") {
    const list = await fetchIdeasByRevenueGoal(def.slug);
    return list.sort(
      (a, b) =>
        (b.scores?.builder_confidence ?? 0) -
        (a.scores?.builder_confidence ?? 0),
    );
  }
  // buildTime: no dedicated index — scan + filter (≤57 rows).
  const all = await fetchAllIdeas();
  const values = def.buildTimeValues ?? [];
  return all
    .filter((idea) => values.includes(idea.buildTime))
    .sort(
      (a, b) =>
        (b.scores?.builder_confidence ?? 0) -
        (a.scores?.builder_confidence ?? 0),
    );
}

function buildCollectionSchema(
  def: CollectionDef,
  ideas: Awaited<ReturnType<typeof fetchAllIdeas>>,
) {
  const url = `${SITE}/ideas/${def.slug}`;
  return buildGraph(
    personSchema(),
    websiteSchema(),
    {
      ...collectionPageSchema({
        title: def.title,
        description: def.description,
        url,
      }),
      mainEntity: ideasItemList(ideas),
    },
    breadcrumbSchema([
      { label: "Home", href: "/" },
      { label: "Ideas", href: "/startup-ideas" },
      {
        label: def.title.replace(" Startup Ideas", "").trim(),
        href: url,
      },
    ]),
  );
}
