import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cacheLife, cacheTag } from "next/cache";
import type { LucideIcon } from "lucide-react";
import {
  ArrowDown,
  Blocks,
  Brain,
  Code2,
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
import { HubEmailCapture } from "@/components/hubs/HubEmailCapture";
import {
  HubFeaturedIdeas,
} from "@/components/hubs/HubFeaturedIdeas";
import { HubIdeasGrid, ideasItemList } from "@/components/hubs/HubIdeasGrid";
import { HubPrimaryCta } from "@/components/hubs/HubPrimaryCta";
import { HubPromptCard } from "@/components/hubs/HubPromptCard";
import { HubTracker } from "@/components/hubs/HubTracker";
import { COLOR_STYLES, type HubColor } from "@/components/hubs/hub-theme";
import {
  fetchIdeasBySlugs,
  fetchIdeasByTool,
  fetchToolReference,
  type IdeaDoc,
} from "@/components/hubs/hub-data";
import {
  SITE,
  breadcrumbSchema,
  buildGraph,
  howToSchema,
  organizationSchema,
  personSchema,
  softwareApplicationSchema,
  websiteSchema,
} from "@/lib/seo";

const OG_IMAGE = `${SITE}/image/og-image.png`;

/* ------------------------------------------------------------------ */
/* Static tool content — hero theme, titles, and starter prompts come  */
/* from the legacy build-with/{slug}/index.html pages (the generators  */
/* only managed the grid + ItemList; this copy was bespoke). The       */
/* description/strengths/gettingStarted columns are the Convex tools   */
/* table at render time, with this map as the build-time fallback.     */
/* ------------------------------------------------------------------ */

type ToolPrompt = { label: string; prompt: string };

/**
 * Editorial "start here" block. The Convex tool tags are deliberately broad
 * (128 of 135 ideas are tagged `claude`), so the grid alone can't tell a
 * visitor where to begin. Slugs are hand-picked here — the same
 * hardcoded-TS-config pattern the other programmatic hubs use — and resolved
 * via indexed per-slug lookups so curation is independent of the hub query's
 * 30-idea cap. Missing or retagged slugs are dropped silently.
 */
type ToolFeatured = {
  slugs: string[];
  heading: string;
  intro: string;
};

/** Newsletter capture copy. Must describe the real newsletter, nothing else. */
type ToolEmailCapture = {
  eyebrow: string;
  heading: string;
  body: string;
  buttonLabel: string;
};

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
  /** Optional curated set rendered above the full ideas grid. */
  featured?: ToolFeatured;
  /** Optional tool-specific newsletter hook (falls back to generic copy). */
  emailCapture?: ToolEmailCapture;
  /**
   * Soft cross-link to a sibling hub (e.g. Claude → Claude Code). Rendered
   * under the hero so searchers with a more specific intent can branch.
   */
  relatedHub?: { href: string; label: string; body: string; cta: string };
  /**
   * Convex `ideas.tools` value used for the ideas grid. Defaults to `slug`.
   * Claude Code reuses the `claude` tag until a dedicated retag ships.
   */
  ideasTool?: string;
};

const TOOL_PAGES: Record<string, ToolPage> = {
  cursor: {
    slug: "cursor",
    name: "Cursor",
    h1: "Cursor Project Ideas & Examples",
    titlePattern:
      "Cursor Project Ideas: {count} Examples of What to Build with Cursor",
    legacyCount: 30,
    metaDescription:
      "Cursor project ideas and examples with ready-to-use prompts — MVPs and full-stack apps to build with Cursor's AI code editor this weekend.",
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
    featured: {
      slugs: [
        "tattoo-dm-booking-agent",
        "freelance-scope-creep-detector",
        "ai-coding-agent-dashboard",
        "college-retention-early-help-router",
        "contractor-osha-safety-grade",
        "shopify-ai-support-context",
        "ai-workflow-library-solopreneurs",
        "real-estate-workflow-automation",
        "on-device-privacy-ai",
        "ai-writing-coach-freelancers",
      ],
      heading: "Start here: Cursor projects worth shipping this weekend",
      intro:
        "These ideas lean on Cursor's strength — multi-file refactors, API work, and full-stack scaffolding — so you spend the weekend building product, not fighting the editor.",
    },
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
    featured: {
      // Hand-picked for what Claude is actually good at: reasoning over
      // messy input, code explanation, long-form writing, and analysis.
      // Ordered best-first, all builder_confidence 8-9. Resolved by indexed
      // slug lookup (fetchIdeasBySlugs), not by filtering the grid's own
      // set — `byTool` caps at 30, which would silently drop picks as more
      // high-confidence ideas ship.
      slugs: [
        "ai-agent-error-translator",
        "ai-code-coach-tutor",
        "inbox-zero-agent",
        "markdown-client-proposals",
        "conversational-analytics-digest",
        "ai-chief-of-staff-consultants",
        "freelance-scope-creep-detector",
        "ai-coding-agent-dashboard",
        "ai-coding-classroom-assistant",
        "markdown-publish-everywhere",
      ],
      heading: "Start here: the best Claude projects to build this weekend",
      intro:
        "Almost every idea on the site is tagged for Claude, which makes the tag a weak filter. These are the ones that lean on what Claude is genuinely best at — reasoning over messy input, explaining code, drafting long-form copy, and turning raw data into something readable.",
    },
    emailCapture: {
      eyebrow: "Free newsletter",
      heading: "You already have Claude. Get something to build with it.",
      body: "The Weekend MVP newsletter: a validated idea with the stack, the build plan, and prompts you can paste straight into Claude. No download, no course — just the next thing worth building.",
      buttonLabel: "Send me ideas",
    },
    relatedHub: {
      href: "/build-with/claude-code",
      label: "Looking for Claude Code projects?",
      body: "If you want agentic coding in the terminal — CLIs, APIs, and full apps with real diffs — start on the Claude Code hub instead.",
      cta: "Browse Claude Code projects",
    },
  },
  "claude-code": {
    slug: "claude-code",
    name: "Claude Code",
    h1: "Claude Code Projects & Things to Build",
    titlePattern:
      "Claude Code Projects: {count} Things to Build in the Terminal",
    legacyCount: 30,
    metaDescription:
      "Claude Code projects and things to build in your terminal. Agentic coding for CLIs, APIs, and full apps — copy a starter prompt and ship this weekend.",
    description:
      "Claude Code is Anthropic's agentic coding tool in the terminal. Point it at a repo (or an empty folder), describe the product, and it plans, edits files, runs commands, and iterates until the MVP works. Best when you want real code — not a chat draft — and you're comfortable reviewing diffs.",
    url: "https://claude.ai/code",
    icon: Code2,
    color: "orange",
    gradient: "bg-gradient-to-br from-orange-600/20 to-amber-500/20",
    operatingSystem: "macOS, Linux, Windows (WSL)",
    schemaDescription:
      "Anthropic's agentic coding tool for building projects in the terminal",
    strengths: [
      "Terminal-native agentic coding",
      "Multi-file refactors with diffs",
      "CLI tools and scripts",
      "APIs with real tests",
      "Greenfield MVPs in empty folders",
    ],
    gettingStarted: [
      "Install Claude Code and open a terminal in an empty folder (or an existing repo)",
      "Paste a starter prompt below — or describe your MVP in one paragraph",
      "Let Claude Code scaffold, run, and fix until the happy path works",
      "Review the diff, commit, and deploy (Vercel, Railway, Fly, or your host of choice)",
    ],
    prompts: [
      {
        label: "TypeScript CLI",
        prompt:
          "Scaffold a TypeScript CLI that [does X]. Include --help, tests, and a one-line install via npm. Prefer a simple file layout over heavy frameworks.",
      },
      {
        label: "Next.js MVP",
        prompt:
          "Build a Next.js MVP for [idea]: auth, one core workflow, and a README with run/deploy steps. Keep files simple and ship a working happy path first.",
      },
      {
        label: "Working API",
        prompt:
          "Turn this folder into a working API: REST endpoints for [resource], SQLite or Postgres, seed data, and a smoke-test script. Include basic error handling.",
      },
    ],
    featured: {
      slugs: [
        "ai-coding-agent-dashboard",
        "ai-code-coach-tutor",
        "ai-agent-error-translator",
        "voice-desktop-workflow-macros",
        "website-accessibility-ada-scanner",
        "ai-api-cost-optimizer-indie-builders",
        "markdown-publish-everywhere",
        "ai-coding-classroom-assistant",
        "freelance-scope-creep-detector",
        "inbox-zero-agent",
      ],
      heading: "Start here: Claude Code projects worth shipping this weekend",
      intro:
        "These lean on what Claude Code is for — agents that edit files, run commands, and leave you a reviewable diff. Chat-first Claude ideas live on the main Claude hub.",
    },
    relatedHub: {
      href: "/build-with/claude",
      label: "Prefer chat-first Claude ideas?",
      body: "Planning, debugging, and long-form drafting in claude.ai still live on the main Claude hub.",
      cta: "Browse Build with Claude",
    },
    ideasTool: "claude",
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
    h1: "Best Lovable Projects & App Ideas",
    titlePattern: "Best Lovable Projects & App Ideas ({count}) to Build This Weekend",
    legacyCount: 30,
    metaDescription:
      "Best Lovable projects and app ideas you can ship this weekend. AI builds the full stack from your description — pick a starter prompt and go live.",
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
    featured: {
      slugs: [
        "client-portal",
        "saas-financial-toolkit",
        "waitlist-manager",
        "user-onboarding-builder",
        "subscription-analytics-dashboard",
        "single-event-app-builder",
        "ai-travel-planner",
        "agent-storefront-platform",
        "sms-time-tracker",
        "feature-voting-board",
      ],
      heading: "Start here: the best Lovable projects to build this weekend",
      intro:
        "These ideas play to Lovable's strength — full-stack apps with auth, dashboards, and deployable UIs from a plain-English brief.",
    },
  },
  "no-code": {
    slug: "no-code",
    name: "No-Code Tools",
    h1: "No-Code MVP Ideas for Non-Technical Founders",
    titlePattern: "No-Code MVP Ideas — Best Tools to Validate Without Coding",
    legacyCount: 8,
    metaDescription:
      "No-code MVP ideas for non-technical founders. Use Bubble, Softr, or Glide to validate before you hire a developer. Pick an idea and ship this weekend.",
    description:
      "Looking for the best no-code tools for an MVP? Start here. Bubble for complex web apps, Softr for Airtable-powered sites, Glide for mobile apps from spreadsheets. If you can use a spreadsheet, you can ship a validating MVP without writing code — or hiring an engineer yet.",
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
      "Define the one job your MVP must prove (signup, booking, marketplace match, etc.)",
      "Pick a tool: Bubble (complex logic), Softr (Airtable sites), or Glide (mobile from sheets)",
      "Start from a template closest to your idea and connect your data source",
      "Ship a shareable link, put it in front of 10 real users, then decide what to build next",
    ],
    prompts: [
      {
        label: "Bubble MVP",
        prompt:
          "In Bubble: build an MVP where [users] can [core action]. Include signup, a simple dashboard, and one paid or gated step.",
      },
      {
        label: "Softr + Airtable Directory",
        prompt:
          "In Softr + Airtable: create a directory of [items] with search, filters, and a submit form so operators can add listings without code.",
      },
      {
        label: "Glide Mobile App",
        prompt:
          "In Glide: turn a Google Sheet of [data] into a mobile app with login, list/detail screens, and a way for users to update their row.",
      },
    ],
    featured: {
      slugs: [
        "client-portal",
        "saas-financial-toolkit",
        "nasm-trainer-marketplace",
        "mobile-brake-repair-marketplace",
        "expert-mentorship-marketplace",
        "meeting-scheduler",
        "user-onboarding-builder",
        "sms-time-tracker",
        "social-media-scheduler",
        "single-event-app-builder",
      ],
      heading: "Start here: no-code MVPs you can validate this weekend",
      intro:
        "Built for non-technical founders — marketplaces, portals, and schedulers you can stand up in Bubble, Softr, or Glide before writing a line of code.",
    },
  },
  replit: {
    slug: "replit",
    name: "Replit",
    h1: "Replit Project Examples & App Ideas",
    titlePattern:
      "Replit Project Examples & App Ideas ({count}) You Can Deploy Instantly",
    legacyCount: 30,
    metaDescription:
      "Replit project examples and app ideas you can build this weekend. Code in the browser, get help from Agent, deploy with one click.",
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
    featured: {
      slugs: [
        "ai-agent-error-translator",
        "ai-code-coach-tutor",
        "ai-coding-classroom-assistant",
        "daily-standup-bot",
        "invoice-reminder-bot",
        "api-documentation-generator",
        "ai-code-reviewer",
        "client-portal",
        "ai-api-cost-optimizer-indie-builders",
        "saas-financial-toolkit",
      ],
      heading: "Start here: Replit project examples worth deploying this weekend",
      intro:
        "Browser IDE + Agent + one-click Deploy — these ideas are small enough to finish and public enough to share the moment they run.",
    },
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
  { slug: "claude-code", label: "Claude Code", sub: "Terminal Agent", icon: Code2, iconClass: "text-orange-500" },
  { slug: "bolt", label: "Bolt.new", sub: "Full-Stack Builder", icon: Zap, iconClass: "text-yellow-400" },
  { slug: "no-code", label: "No-Code", sub: "Visual Builders", icon: Blocks, iconClass: "text-pink-400" },
];

const STRENGTH_ICONS: LucideIcon[] = [Layers, Brain, GitBranch, Database, Plug];

/* ------------------------------------------------------------------ */
/* Cached data (shared by metadata + page render)                      */
/* ------------------------------------------------------------------ */

type ToolData = {
  ideas: IdeaDoc[];
  featured: IdeaDoc[];
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
  const ideasTool = page.ideasTool ?? slug;
  const [ideas, featured, toolRow] = await Promise.all([
    fetchIdeasByTool(ideasTool),
    fetchIdeasBySlugs(page.featured?.slugs),
    // Reference rows are keyed by public slug; Claude Code has no row yet.
    fetchToolReference(slug),
  ]);
  return {
    ideas,
    featured,
    // Editorial hub copy lives in TOOL_PAGES (titles, MVP positioning).
    // Convex tool rows still supply url/strengths when present.
    description: page.description,
    url: toolRow?.url ?? page.url,
    strengths: toolRow?.strengths ?? page.strengths,
    gettingStarted: page.gettingStarted,
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
    organizationSchema(),
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

  // Editorial curation. Slugs that no longer resolve (unpublished, retagged,
  // or below the byTool cap) are dropped, so the section either renders a
  // real set or disappears — the full grid below is unaffected either way.
  const featuredIdeas = data.featured;
  const featuredSlugs = new Set(featuredIdeas.map((idea) => idea.slug));
  const restIdeas = data.ideas.filter((idea) => !featuredSlugs.has(idea.slug));

  const emailCopy = page.emailCapture ?? {
    eyebrow: "Free newsletter",
    heading: "Get your next build idea by email",
    body: `The Weekend MVP newsletter: a validated idea with the stack, the build plan, and the prompts to ship it — including ideas suited to ${page.name}.`,
    buttonLabel: "Send me ideas",
  };

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
            {featuredIdeas.length > 0 ? (
              <Link
                href="#start-here"
                className="inline-flex items-center gap-2 px-4 py-1.5 bg-white text-black border border-white rounded-full text-sm font-semibold hover:bg-neutral-200 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#050505]"
              >
                <ArrowDown size={14} aria-hidden="true" />
                Start here
              </Link>
            ) : null}
          </>
        }
      />

      {page.relatedHub ? (
        <p className="mb-12 -mt-4 max-w-3xl text-sm text-neutral-400">
          <span className="font-medium text-neutral-300">
            {page.relatedHub.label}
          </span>{" "}
          {page.relatedHub.body}{" "}
          <Link
            href={page.relatedHub.href}
            className="rounded text-white underline decoration-white/30 underline-offset-4 hover:decoration-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
          >
            {page.relatedHub.cta}
          </Link>
        </p>
      ) : null}

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

      {/* Curated "start here" set — editorial, above the full grid */}
      {page.featured && featuredIdeas.length > 0 ? (
        <HubFeaturedIdeas
          heading={page.featured.heading}
          intro={page.featured.intro}
          ideas={featuredIdeas}
          panelClassName={color.border20}
          eyebrowClassName={color.text}
        />
      ) : null}

      {/* Project Ideas */}
      {restIdeas.length > 0 ? (
        <section aria-labelledby="ideas-heading">
          <h2
            id="ideas-heading"
            className="text-2xl font-medium text-white mb-8"
          >
            {featuredIdeas.length > 0
              ? `More Project Ideas for ${page.name}`
              : `Project Ideas for ${page.name}`}
          </h2>
          <HubIdeasGrid ideas={restIdeas} />
        </section>
      ) : null}

      {/* Newsletter capture — the only client boundary on this page */}
      <HubEmailCapture
        eyebrow={emailCopy.eyebrow}
        heading={emailCopy.heading}
        body={emailCopy.body}
        buttonLabel={emailCopy.buttonLabel}
        trackingProps={{ tool_name: page.name, surface: "build_with_hub" }}
        panelClassName={color.border20}
      />

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

      {/* Outbound tool link — deliberately quiet: useful, but this page's job
          is to send the visitor to an idea, not to {page.name}'s homepage. */}
      <p className="mt-6 text-sm text-neutral-400">
        Need the tool itself?{" "}
        <NavExternalLink
          href={data.url}
          className="rounded text-neutral-300 underline decoration-white/30 underline-offset-4 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
        >
          Visit {page.name}
          <ExternalLink
            size={12}
            className="inline ml-1 align-baseline"
            aria-hidden="true"
          />
        </NavExternalLink>
      </p>

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

      {/* Primary conversion path — /startup-ideas. This used to be the 8th
          tile in the grid below, visually identical to "go look at Cursor
          instead". It now owns the loudest block on the lower page. */}
      <HubPrimaryCta
        eyebrow="Next step"
        heading={`Pick your next ${page.name} project`}
        body={`Browse every validated idea on Weekend MVP — filter by category, build time, and revenue goal, then open the one you'd actually ship with ${page.name}.`}
        href="/startup-ideas"
        ctaLabel="Browse all startup ideas"
        note="Every idea includes the stack, the build plan, and what it could earn."
        panelClassName={`${page.gradient} ${color.border20}`}
        iconClassName={color.text}
      />

      {/* Other Tools — kept for internal linking, deliberately low-contrast
          so it no longer competes with the CTA above. */}
      <section className="mt-16" aria-labelledby="other-tools-heading">
        <h2
          id="other-tools-heading"
          className="text-sm font-semibold uppercase tracking-widest text-neutral-400 mb-4"
        >
          Using a different tool?
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {TOOL_TILES.filter((tile) => tile.slug !== slug)
            .slice(0, 3)
            .map((tile) => {
              const TileIcon = tile.icon;
              return (
                <Link
                  key={tile.slug}
                  href={`/build-with/${tile.slug}`}
                  className="group flex items-center gap-3 p-4 bg-white/[0.03] border border-white/10 rounded-xl hover:border-white/20 hover:bg-white/[0.06] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#050505]"
                >
                  <TileIcon
                    size={20}
                    className={`${tile.iconClass} flex-shrink-0`}
                    aria-hidden="true"
                  />
                  <span className="min-w-0">
                    <span className="block text-neutral-200 font-medium text-sm truncate">
                      {tile.label}
                    </span>
                    <span className="block text-neutral-400 text-xs truncate">
                      {tile.sub}
                    </span>
                  </span>
                </Link>
              );
            })}
        </div>
      </section>

      <HubCta
        heading={`Ready to build with ${page.name}?`}
        body={`Get the Weekend MVP Starter Kit with prompts optimized for ${page.name} and other AI tools.`}
      />
    </HubShell>
  );
}
