import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cacheLife, cacheTag } from "next/cache";
import type { LucideIcon } from "lucide-react";
import {
  Blocks,
  Brain,
  Database,
  ExternalLink,
  GitBranch,
  Heart,
  Layers,
  Lightbulb,
  MousePointer2,
  Plug,
  Sparkles,
  Terminal,
  Triangle,
  Wind,
  Zap,
} from "lucide-react";

import { JsonLd } from "@/components/primitives/JsonLd";
import { NavExternalLink } from "@/components/primitives/NavExternalLink";
import {
  HubBreadcrumb,
  HubChip,
  HubHero,
  HubShell,
} from "@/components/hubs/HubShell";
import { HubCta } from "@/components/hubs/HubCta";
import { HubIdeasGrid, ideasItemList } from "@/components/hubs/HubIdeasGrid";
import { HubPromptCard } from "@/components/hubs/HubPromptCard";
import { HubTracker } from "@/components/hubs/HubTracker";
import { COLOR_STYLES, type HubColor } from "@/components/hubs/hub-theme";
import {
  fetchIdeasByTool,
  fetchRefTables,
  type IdeaDoc,
} from "@/components/hubs/hub-data";
import {
  breadcrumbSchema,
  buildGraph,
  howToSchema,
  personSchema,
  softwareApplicationSchema,
  websiteSchema,
} from "@/lib/seo";

const SITE = "https://www.weekendmvp.app";
const OG_IMAGE = `${SITE}/image/og-image.png`;

/* ------------------------------------------------------------------ */
/* Static tool content — hero theme, titles, and starter prompts come  */
/* from the legacy build-with/{slug}/index.html pages (the generators  */
/* only managed the grid + ItemList; this copy was bespoke). The       */
/* description/strengths/gettingStarted columns are the Convex tools   */
/* table at render time, with this map as the build-time fallback.     */
/* ------------------------------------------------------------------ */

type ToolPrompt = { label: string; prompt: string };

type ToolPage = {
  slug: string;
  name: string;
  h1: string;
  /** `{count}` is replaced with the live idea count when available. */
  titlePattern: string;
  /** Legacy count baked into the published title — Convex-down fallback. */
  legacyCount: number;
  metaDescription: string;
  description: string;
  url: string;
  icon: LucideIcon;
  color: HubColor;
  /** Hero logo box gradient (literal Tailwind classes). */
  gradient: string;
  operatingSystem: string;
  schemaDescription: string;
  strengths: string[];
  gettingStarted: string[];
  prompts: ToolPrompt[];
};

const TOOL_PAGES: Record<string, ToolPage> = {
  cursor: {
    slug: "cursor",
    name: "Cursor",
    h1: "What to Build with Cursor",
    titlePattern: "What to Build with Cursor: {count} Project Ideas",
    legacyCount: 30,
    metaDescription:
      "Find the best projects to build with Cursor. Ideas with ready-to-use prompts, from MVPs to full products. AI-powered code editor for full-stack development.",
    description:
      "Build full-stack applications with AI pair programming. Cursor understands your codebase and helps you write, refactor, and debug code faster.",
    url: "https://cursor.sh",
    icon: MousePointer2,
    color: "violet",
    gradient: "bg-gradient-to-br from-violet-500/20 to-blue-500/20",
    operatingSystem: "Windows, macOS, Linux",
    schemaDescription:
      "AI-powered code editor that helps you build full-stack applications with AI pair programming",
    strengths: [
      "Full-stack applications",
      "Complex business logic",
      "Code refactoring",
      "Database integration",
      "API development",
    ],
    gettingStarted: [
      "Download Cursor from cursor.sh",
      "Open your project folder or create a new one",
      "Press Cmd+K (Mac) or Ctrl+K (Windows) to start AI chat",
      "Describe what you want to build in natural language",
      "Use Cmd+L to chat about your entire codebase",
    ],
    prompts: [
      {
        label: "Full-Stack SaaS Starter",
        prompt:
          "Create a Next.js 14 app with TypeScript, Tailwind CSS, and Supabase. Set up authentication with magic links, a protected dashboard page, and a landing page with pricing. Use the App Router and Server Actions.",
      },
      {
        label: "API Integration",
        prompt:
          "Add an API route that connects to OpenAI's API. Accept a POST request with a prompt, call the API, and return the response as streaming text. Include proper error handling and rate limiting.",
      },
      {
        label: "Database Schema",
        prompt:
          "Create a Supabase schema for a [YOUR APP TYPE] with tables for users, [main entity], and [related entity]. Include proper foreign keys, indexes, and RLS policies. Generate the SQL migrations.",
      },
    ],
  },
  claude: {
    slug: "claude",
    name: "Claude",
    h1: "Claude Project Ideas",
    titlePattern:
      "Claude Project Ideas: {count} Things to Build with Claude (+ Prompts)",
    legacyCount: 30,
    metaDescription:
      "Claude project ideas with ready-to-use prompts — the best apps to build with Claude, plus Claude Code projects for developers. From MVPs to full products.",
    description:
      "Claude excels at understanding complex requirements, writing clean code, and explaining technical concepts. Great for planning, debugging, and code review.",
    url: "https://claude.ai",
    icon: Sparkles,
    color: "orange",
    gradient: "bg-gradient-to-br from-orange-500/20 to-amber-500/20",
    operatingSystem: "Web",
    schemaDescription:
      "Anthropic's AI assistant for planning, writing, and reviewing code",
    strengths: [
      "Code explanation and review",
      "Complex problem solving",
      "Technical writing",
      "System design",
      "Debugging assistance",
    ],
    gettingStarted: [
      "Go to claude.ai and create an account",
      "Start a new conversation with your project idea",
      "Ask Claude to help plan your architecture",
      "Use Claude to generate code snippets",
      "Copy code to your IDE and iterate",
    ],
    prompts: [
      {
        label: "Architecture Planning",
        prompt:
          "I want to build [YOUR IDEA]. Help me plan the architecture. What tech stack would you recommend? What are the main components I need? Create a simple diagram of how data flows through the system.",
      },
      {
        label: "Code Review",
        prompt:
          "Review this code for bugs, security issues, and performance improvements. Explain any problems you find and suggest better approaches. [PASTE YOUR CODE]",
      },
      {
        label: "Debug Helper",
        prompt:
          "I'm getting this error: [ERROR MESSAGE]. Here's the relevant code: [CODE]. What's causing this and how do I fix it? Walk me through your debugging process.",
      },
    ],
  },
  bolt: {
    slug: "bolt",
    name: "Bolt.new",
    h1: "What to Build with Bolt.new",
    titlePattern: "What to Build with Bolt.new: {count} Project Ideas",
    legacyCount: 28,
    metaDescription:
      "Find the best projects to build with Bolt.new. Ideas with ready-to-use prompts. Build and deploy full-stack web applications directly in your browser.",
    description:
      "Build and deploy full-stack web applications directly in your browser. Great for rapid prototyping and simple applications.",
    url: "https://bolt.new",
    icon: Zap,
    color: "yellow",
    gradient: "bg-gradient-to-br from-yellow-500/20 to-orange-500/20",
    operatingSystem: "Web",
    schemaDescription:
      "AI-powered full-stack builder that builds and deploys web apps in the browser",
    strengths: [
      "Rapid prototyping",
      "Simple web apps",
      "Landing pages",
      "Form-based applications",
      "Quick deployments",
    ],
    gettingStarted: [
      "Go to bolt.new in your browser",
      "Describe your application idea",
      "Watch Bolt generate the code",
      "Iterate by describing changes",
      "Deploy directly from Bolt",
    ],
    prompts: [
      {
        label: "Simple Web App",
        prompt:
          "Build a [YOUR APP TYPE] web app with: a landing page explaining what it does, a main page where users can [MAIN ACTION], and a results/output page. Use a modern dark theme with smooth animations.",
      },
      {
        label: "Landing Page",
        prompt:
          "Create a landing page for [YOUR PRODUCT]. Include: hero section with headline and CTA, features section with 3-4 benefits, social proof section, pricing, and email capture form. Make it look professional and modern.",
      },
      {
        label: "Form-Based Tool",
        prompt:
          'Build a tool where users fill out a form with [INPUTS], click submit, and get [OUTPUT]. Add input validation, a loading state while processing, and a nice way to display the results. Include a "copy results" button.',
      },
    ],
  },
  lovable: {
    slug: "lovable",
    name: "Lovable",
    h1: "What to Build with Lovable",
    titlePattern: "What to Build with Lovable: {count} Project Ideas",
    legacyCount: 30,
    metaDescription:
      "Find the best projects to build with Lovable. Ideas with ready-to-use prompts, from MVPs to full products. AI software engineer for non-technical founders.",
    description:
      "Build full applications with natural language. Lovable handles the entire stack and deploys your app automatically.",
    url: "https://lovable.dev",
    icon: Heart,
    color: "pink",
    gradient: "bg-gradient-to-br from-pink-500/20 to-rose-500/20",
    operatingSystem: "Web",
    schemaDescription:
      "AI software engineer that builds and deploys full applications from natural language",
    strengths: [
      "Full application building",
      "Automatic deployment",
      "Database setup",
      "Authentication",
      "No coding required",
    ],
    gettingStarted: [
      "Sign up at lovable.dev",
      "Describe your application",
      "Let Lovable build the app",
      "Test and iterate with feedback",
      "Deploy when ready",
    ],
    prompts: [
      {
        label: "SaaS Dashboard",
        prompt:
          "Build a SaaS dashboard with user authentication, a settings page, and a main dashboard showing stats and recent activity. Include dark mode and responsive design. Use Supabase for the backend.",
      },
      {
        label: "Waitlist Landing Page",
        prompt:
          "Create a beautiful landing page with an email waitlist signup form. Include a hero section, feature highlights, social proof section, and footer. Store signups in a database with referral tracking.",
      },
      {
        label: "Personal Finance App",
        prompt:
          "Build a personal finance tracker where users can add expenses, categorize them, and see spending breakdowns with charts. Include recurring expense tracking and budget goals.",
      },
    ],
  },
  "no-code": {
    slug: "no-code",
    name: "No-Code Tools",
    h1: "No-Code App Ideas",
    titlePattern: "No-Code App Ideas: Build Without Coding",
    legacyCount: 8,
    metaDescription:
      "Build apps without coding using Bubble, Webflow, Softr, and Glide. Project ideas with visual builders perfect for non-technical founders and rapid MVPs.",
    description:
      "A collection of no-code tools including Bubble, Webflow, Softr, and Glide that let you build apps without writing code.",
    url: "https://bubble.io",
    icon: Blocks,
    color: "pink",
    gradient: "bg-gradient-to-br from-pink-500/20 to-purple-500/20",
    operatingSystem: "Web",
    schemaDescription:
      "Visual no-code builders (Bubble, Webflow, Softr, Glide) for building apps without code",
    strengths: [
      "No coding required",
      "Visual builders",
      "Quick prototyping",
      "Template libraries",
      "Integrations",
    ],
    gettingStarted: [
      "Choose a no-code platform (Bubble, Webflow, Softr)",
      "Start with a template if available",
      "Use drag-and-drop builders",
      "Connect data sources",
      "Launch and iterate",
    ],
    prompts: [],
  },
  replit: {
    slug: "replit",
    name: "Replit",
    h1: "What to Build with Replit",
    titlePattern: "What to Build with Replit: {count} Project Ideas",
    legacyCount: 30,
    metaDescription:
      "Find the best projects to build with Replit. Ideas with ready-to-use prompts, from MVPs to full products. Cloud-based IDE for collaborative development.",
    description:
      "Code, create, and learn together with a powerful, simple, and collaborative IDE, compiler, and interpreter.",
    url: "https://replit.com",
    icon: Terminal,
    color: "orange",
    gradient: "bg-gradient-to-br from-orange-500/20 to-red-500/20",
    operatingSystem: "Web",
    schemaDescription:
      "Collaborative browser IDE with instant hosting and AI assistance",
    strengths: [
      "Collaborative coding",
      "Multiple language support",
      "Instant deployment",
      "AI assistance",
      "Learning environment",
    ],
    gettingStarted: [
      "Create account at replit.com",
      "Start a new Repl in your language",
      "Use Replit AI for assistance",
      "Code directly in browser",
      "Deploy with one click",
    ],
    prompts: [
      {
        label: "Quick Web App",
        prompt:
          "Create a simple Flask web app with a landing page, a form to collect user emails, and store them in Replit's built-in database. Include basic styling with Tailwind CSS.",
      },
      {
        label: "API Integration",
        prompt:
          "Build a Node.js Express API that fetches data from an external API, processes it, and returns formatted JSON. Include proper error handling and environment variable support for API keys.",
      },
      {
        label: "Discord Bot",
        prompt:
          "Create a Python Discord bot that responds to commands, can send scheduled messages, and stores user preferences. Use discord.py and include a keep-alive server for 24/7 hosting.",
      },
    ],
  },
  v0: {
    slug: "v0",
    name: "v0",
    h1: "What to Build with v0",
    titlePattern: "What to Build with v0: {count} Project Ideas",
    legacyCount: 30,
    metaDescription:
      "Find the best projects to build with v0. Ideas with ready-to-use prompts, from MVPs to full products. Vercel's AI-powered UI generator for React components.",
    description:
      "Generate React components and UI designs from text descriptions. Perfect for quickly building beautiful interfaces.",
    url: "https://v0.dev",
    icon: Triangle,
    color: "white",
    gradient: "bg-gradient-to-br from-white/20 to-neutral-500/20",
    operatingSystem: "Web",
    schemaDescription:
      "Vercel's AI-powered UI generator for React and Tailwind components",
    strengths: [
      "UI component generation",
      "React/Next.js code",
      "Tailwind CSS styling",
      "Responsive design",
      "Component variations",
    ],
    gettingStarted: [
      "Go to v0.dev",
      "Describe the UI component you need",
      "Select from generated variations",
      "Copy the React/Tailwind code",
      "Integrate into your project",
    ],
    prompts: [
      {
        label: "Dashboard Layout",
        prompt:
          "Create a modern SaaS dashboard with a sidebar navigation, header with user menu, and a main content area showing stats cards, a line chart, and a recent activity table. Use a dark theme with subtle gradients.",
      },
      {
        label: "Landing Page Hero",
        prompt:
          "Design a landing page hero section with a headline, subheadline, email capture form, and social proof badges. Include an animated gradient background and floating UI mockups. Make it responsive for mobile.",
      },
      {
        label: "Pricing Cards",
        prompt:
          "Create a pricing section with 3 plan cards (Free, Pro, Enterprise). Include feature lists, price displays, and CTA buttons. Highlight the Pro plan as recommended. Add a monthly/annual toggle.",
      },
    ],
  },
  windsurf: {
    slug: "windsurf",
    name: "Windsurf",
    h1: "What to Build with Windsurf",
    titlePattern: "What to Build with Windsurf: {count} Project Ideas",
    legacyCount: 30,
    metaDescription:
      "Find the best projects to build with Windsurf. Ideas with ready-to-use prompts, from MVPs to full products. Codeium's AI-powered IDE for agentic coding.",
    description:
      "The first agentic IDE. Windsurf combines AI assistance with deep codebase understanding for faster development.",
    url: "https://codeium.com/windsurf",
    icon: Wind,
    color: "cyan",
    gradient: "bg-gradient-to-br from-cyan-500/20 to-blue-500/20",
    operatingSystem: "Windows, macOS, Linux",
    schemaDescription:
      "Codeium's agentic AI IDE with deep codebase understanding",
    strengths: [
      "Agentic coding",
      "Codebase understanding",
      "Multi-file editing",
      "Code completion",
      "Refactoring",
    ],
    gettingStarted: [
      "Download Windsurf from Codeium",
      "Open your project",
      "Use Cascade for AI assistance",
      "Let Windsurf understand your codebase",
      "Code with AI pair programming",
    ],
    prompts: [
      {
        label: "Full-Stack Refactor",
        prompt:
          "Analyze this codebase and refactor the authentication system to use JWT tokens instead of sessions. Update all affected files including API routes, middleware, and frontend components. Maintain backward compatibility.",
      },
      {
        label: "API Development",
        prompt:
          "Create a RESTful API for [YOUR FEATURE] with proper error handling, validation, rate limiting, and authentication. Follow the existing patterns in this codebase for consistency. Include tests.",
      },
      {
        label: "Code Review",
        prompt:
          "Review this codebase for security vulnerabilities, performance issues, and code quality problems. Provide specific recommendations with code examples for each issue found.",
      },
    ],
  },
};

export const TOOL_SLUGS = Object.keys(TOOL_PAGES);

/** Legacy "Explore Other Tools" tiles. */
const TOOL_TILES: Array<{
  slug: string;
  label: string;
  sub: string;
  icon: LucideIcon;
  iconClass: string;
}> = [
  { slug: "cursor", label: "Cursor", sub: "AI Code Editor", icon: MousePointer2, iconClass: "text-violet-400" },
  { slug: "claude", label: "Claude", sub: "AI Assistant", icon: Sparkles, iconClass: "text-orange-400" },
  { slug: "bolt", label: "Bolt.new", sub: "Full-Stack Builder", icon: Zap, iconClass: "text-yellow-400" },
  { slug: "no-code", label: "No-Code", sub: "Visual Builders", icon: Blocks, iconClass: "text-pink-400" },
];

const STRENGTH_ICONS: LucideIcon[] = [Layers, Brain, GitBranch, Database, Plug];

/* ------------------------------------------------------------------ */
/* Cached data (shared by metadata + page render)                      */
/* ------------------------------------------------------------------ */

type ToolData = {
  ideas: IdeaDoc[];
  description: string;
  url: string;
  strengths: string[];
  gettingStarted: string[];
};

async function getToolData(slug: string): Promise<ToolData> {
  "use cache";
  cacheTag("ideas", "ref-tables", `tool:${slug}`);
  cacheLife("hours");

  const page = TOOL_PAGES[slug];
  const [ideas, refTables] = await Promise.all([
    fetchIdeasByTool(slug),
    fetchRefTables(),
  ]);
  const row = refTables?.tools.find((t) => t.slug === slug) ?? null;
  return {
    ideas,
    description: row?.description ?? page.description,
    url: row?.url ?? page.url,
    strengths: row?.strengths ?? page.strengths,
    gettingStarted: row?.gettingStarted ?? page.gettingStarted,
  };
}

function pageTitle(page: ToolPage, ideaCount: number): string {
  const count = ideaCount > 0 ? ideaCount : page.legacyCount;
  return page.titlePattern.replace("{count}", String(count));
}

/* ------------------------------------------------------------------ */
/* Params + metadata                                                   */
/* ------------------------------------------------------------------ */

export async function generateStaticParams() {
  // Hardcoded — stable SEO URLs; Convex may be down at build time.
  return TOOL_SLUGS.map((tool) => ({ tool }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ tool: string }>;
}): Promise<Metadata> {
  const { tool } = await params;
  const page = TOOL_PAGES[tool];
  if (!page) return {};
  const { ideas } = await getToolData(tool);
  const title = pageTitle(page, ideas.length);
  const url = `${SITE}/build-with/${page.slug}`;
  return {
    title: { absolute: `${title} | Weekend MVP` },
    description: page.metaDescription,
    authors: [{ name: "John Iseghohi" }],
    alternates: { canonical: `/build-with/${page.slug}` },
    openGraph: {
      type: "website",
      url,
      title: `${title} | Weekend MVP`,
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
      title: `${title} | Weekend MVP`,
      description: page.metaDescription,
      images: [OG_IMAGE],
    },
  };
}

/* ------------------------------------------------------------------ */
/* JSON-LD — Person, WebSite, SoftwareApplication, HowTo, ItemList,    */
/* BreadcrumbList (ported from the legacy build-with pages)            */
/* ------------------------------------------------------------------ */

function buildSchema(page: ToolPage, data: ToolData) {
  const url = `${SITE}/build-with/${page.slug}`;
  return buildGraph(
    personSchema(),
    websiteSchema(),
    softwareApplicationSchema({
      name: page.name,
      applicationCategory: "DeveloperApplication",
      description: page.schemaDescription,
      operatingSystem: page.operatingSystem,
      url: data.url,
    }),
    howToSchema({
      name: `How to Get Started with ${page.name}`,
      description: `Quick guide to start building projects with ${page.name}`,
      steps: data.gettingStarted.map((text) => ({ text })),
    }),
    {
      ...ideasItemList(data.ideas),
      name: `Project Ideas for ${page.name}`,
    },
    breadcrumbSchema([
      { label: "Home", href: "/" },
      { label: "Build With", href: "/build-with/" },
      { label: page.name, href: url },
    ]),
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default async function ToolHubPage({
  params,
}: {
  params: Promise<{ tool: string }>;
}) {
  const { tool } = await params;
  if (!TOOL_PAGES[tool]) notFound();
  return <CachedToolHub slug={tool} />;
}

async function CachedToolHub({ slug }: { slug: string }) {
  "use cache";
  cacheTag("ideas", "ref-tables", `tool:${slug}`);
  cacheLife("hours");

  const page = TOOL_PAGES[slug];
  const data = await getToolData(slug);
  const color = COLOR_STYLES[page.color];
  const Icon = page.icon;
  const schema = buildSchema(page, data);
  const ideaCount = data.ideas.length > 0 ? data.ideas.length : page.legacyCount;

  return (
    <HubShell>
      <JsonLd schema={schema} />
      <HubTracker event="view_tool_page" props={{ tool_name: page.name }} />

      <HubBreadcrumb
        items={[
          { label: "Home", href: "/" },
          { label: `Build With ${page.name}` },
        ]}
      />

      <HubHero
        variant="tool"
        icon={<Icon size={40} className={color.text} aria-hidden="true" />}
        iconBoxClassName={page.gradient}
        title={page.h1}
        description={data.description}
        chips={
          <>
            <HubChip>
              <Lightbulb size={14} aria-hidden="true" />
              {ideaCount} project ideas
            </HubChip>
            <NavExternalLink
              href={data.url}
              className="inline-flex items-center gap-2 px-3 py-1.5 bg-white/5 border border-white/10 rounded-full text-sm text-neutral-400 hover:text-white hover:border-white/20 transition-colors"
            >
              <ExternalLink size={14} aria-hidden="true" />
              Visit {page.name}
            </NavExternalLink>
          </>
        }
      />

      {/* Tool Strengths */}
      {data.strengths.length > 0 ? (
        <section className="mb-16" aria-labelledby="strengths-heading">
          <h2
            id="strengths-heading"
            className="text-2xl font-medium text-white mb-6"
          >
            What {page.name} is Best For
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {data.strengths.slice(0, 5).map((strength, index) => {
              const StrengthIcon =
                STRENGTH_ICONS[index % STRENGTH_ICONS.length];
              return (
                <div
                  key={strength}
                  className="p-5 bg-white/5 border border-white/10 rounded-2xl"
                >
                  <StrengthIcon
                    size={24}
                    className={`${color.text} mb-3`}
                    aria-hidden="true"
                  />
                  <p className="text-white font-medium text-sm">{strength}</p>
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      {/* Project Ideas */}
      {data.ideas.length > 0 ? (
        <section aria-labelledby="ideas-heading">
          <h2
            id="ideas-heading"
            className="text-2xl font-medium text-white mb-8"
          >
            Project Ideas for {page.name}
          </h2>
          <HubIdeasGrid ideas={data.ideas} />
        </section>
      ) : null}

      {/* Getting Started */}
      {data.gettingStarted.length > 0 ? (
        <section className="mt-24" aria-labelledby="getting-started-heading">
          <h2
            id="getting-started-heading"
            className="text-2xl font-medium text-white mb-8"
          >
            Getting Started with {page.name}
          </h2>
          <div className="p-8 bg-white/5 border border-white/10 rounded-3xl">
            <ol className="space-y-6">
              {data.gettingStarted.map((step, index) => (
                <li key={step} className="flex gap-4">
                  <span
                    className={`flex-shrink-0 w-8 h-8 ${color.bg10} ${color.text} rounded-full flex items-center justify-center text-sm font-medium`}
                  >
                    {index + 1}
                  </span>
                  <div>
                    <p className="text-white font-medium">{step}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>
      ) : null}

      {/* Starter Prompts */}
      {page.prompts.length > 0 ? (
        <section className="mt-24" aria-labelledby="prompts-heading">
          <h2
            id="prompts-heading"
            className="text-2xl font-medium text-white mb-4"
          >
            {page.name} Starter Prompts
          </h2>
          <p className="text-neutral-400 mb-8">
            Copy and paste these prompts to kickstart your project.
          </p>
          <div className="space-y-4">
            {page.prompts.map((prompt) => (
              <HubPromptCard
                key={prompt.label}
                label={prompt.label}
                prompt={prompt.prompt}
              />
            ))}
          </div>
        </section>
      ) : null}

      {/* Other Tools */}
      <section className="mt-24" aria-labelledby="other-tools-heading">
        <h2
          id="other-tools-heading"
          className="text-2xl font-medium text-white mb-8"
        >
          Explore Other Tools
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {TOOL_TILES.filter((tile) => tile.slug !== slug)
            .slice(0, 3)
            .map((tile) => {
              const TileIcon = tile.icon;
              return (
                <Link
                  key={tile.slug}
                  href={`/build-with/${tile.slug}`}
                  className="group p-6 bg-white/5 border border-white/10 rounded-2xl hover:border-white/20 hover:bg-white/[0.07] transition-all text-center"
                >
                  <TileIcon
                    size={32}
                    className={`${tile.iconClass} mb-3 mx-auto`}
                    aria-hidden="true"
                  />
                  <p className="text-white font-medium text-sm">{tile.label}</p>
                  <p className="text-neutral-500 text-xs mt-1">{tile.sub}</p>
                </Link>
              );
            })}
          <Link
            href="/startup-ideas"
            className="group p-6 bg-white/5 border border-white/10 rounded-2xl hover:border-white/20 hover:bg-white/[0.07] transition-all text-center"
          >
            <Lightbulb
              size={32}
              className="text-emerald-400 mb-3 mx-auto"
              aria-hidden="true"
            />
            <p className="text-white font-medium text-sm">All Ideas</p>
            <p className="text-neutral-500 text-xs mt-1">Browse All</p>
          </Link>
        </div>
      </section>

      <HubCta
        heading={`Ready to build with ${page.name}?`}
        body={`Get the Weekend MVP Starter Kit with prompts optimized for ${page.name} and other AI tools.`}
      />
    </HubShell>
  );
}
