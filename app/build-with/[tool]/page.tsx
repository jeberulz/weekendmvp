import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";

export const instant = false;
import type { LucideIcon } from "lucide-react";
import {
  ArrowUpRight,
  Blocks,
  Code2,
  Heart,
  MousePointer2,
  Sparkles,
  Terminal,
  Triangle,
  Wind,
  Zap,
} from "lucide-react";

import { ToolLogo, type ToolKey } from "@/components/home/tool-logos";
import { ButtonLink, Container, Em, StepList } from "@/components/home/ui";
import { JsonLd } from "@/components/primitives/JsonLd";
import { NavExternalLink } from "@/components/primitives/NavExternalLink";
import { HubCta } from "@/components/hubs/HubCta";
import { HubEmailCapture } from "@/components/hubs/HubEmailCapture";
import { HubFeaturedIdeas } from "@/components/hubs/HubFeaturedIdeas";
import {
  CURSOR_HYDRATION_LINK,
  HubCrawlLinks,
  SEO_PRIORITY_LINKS,
  type CrawlLink,
} from "@/components/hubs/HubCrawlLinks";
import { ideasItemList } from "@/components/hubs/HubIdeasGrid";
import { HubPrimaryCta } from "@/components/hubs/HubPrimaryCta";
import { HubPromptCard } from "@/components/hubs/HubPromptCard";
import { HubTracker } from "@/components/hubs/HubTracker";
import {
  fetchIdeasBySlugs,
  fetchIdeasByTool,
  fetchToolReference,
  type IdeaDoc,
} from "@/components/hubs/hub-data";
import { IdeaBrowser } from "@/components/public/IdeaBrowser";
import { PageHeader } from "@/components/public/PageHeader";
import { PublicShell } from "@/components/public/PublicShell";
import { InkBand, SectionHeading } from "@/components/public/Sections";
import { toPublicIdeas } from "@/lib/public/ideas";
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
  /** Tool mark for the header tile when the tool has no logo in `ToolLogo`. */
  icon: LucideIcon;
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
   * Prominent crawl-priority internal links (hub + newest idea pages).
   * Rendered under the hero so Google’s frequently crawled tool pages
   * pass equity to URLs that are discovered but not yet indexed.
   */
  crawlLinks?: CrawlLink[];
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
    h1: "Cursor Projects & Examples",
    titlePattern:
      "Cursor Projects & Examples: {count} Things to Build This Weekend",
    legacyCount: 30,
    metaDescription:
      "Cursor projects and Cursor projects examples with copy-paste prompts — full-stack MVPs you can ship in a weekend with Cursor's AI code editor.",
    description:
      "Build full-stack applications with AI pair programming. Cursor understands your codebase and helps you write, refactor, and debug code faster.",
    url: "https://cursor.sh",
    icon: MousePointer2,
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
    crawlLinks: [...SEO_PRIORITY_LINKS, CURSOR_HYDRATION_LINK],
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
    crawlLinks: SEO_PRIORITY_LINKS,
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
    h1: "Bolt.new Project Ideas & Examples",
    titlePattern:
      "Bolt.new Project Ideas: {count} Examples to Build & Deploy in the Browser",
    legacyCount: 28,
    metaDescription:
      "Bolt.new project ideas and examples you can build this weekend. Prompt a full-stack app in the browser, iterate in chat, and deploy with one click.",
    description:
      "Bolt.new turns a plain-English prompt into a full-stack web app in your browser — UI, logic, and deploy included. Ideal for weekend MVPs: landing pages, form tools, and simple SaaS you can share the same day.",
    url: "https://bolt.new",
    icon: Zap,
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
      "Go to bolt.new and describe the MVP in one paragraph (who it's for + the one job it does)",
      "Watch Bolt scaffold the UI and logic — keep the first pass narrow",
      "Iterate in chat: tighten copy, add validation, wire a simple data store",
      "Click Deploy and share the live URL with 5–10 real users this weekend",
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
    featured: {
      slugs: [
        "waitlist-manager",
        "ai-sentiment-landing-page-design",
        "three-minute-money-habit-app",
        "tattoo-dm-booking-agent",
        "saas-financial-toolkit",
        "rental-property-maintenance-dashboard",
        "chattracker",
        "static-ad-to-video-generator",
        "ai-meeting-notes-cleaner",
        "ai-agency-automation-control-panel",
      ],
      heading: "Start here: Bolt.new projects worth shipping this weekend",
      intro:
        "These fit Bolt's sweet spot — browser-native full-stack apps, landing pages, and form tools you can prompt, refine, and deploy without opening a local IDE.",
    },
  },
  lovable: {
    slug: "lovable",
    name: "Lovable",
    h1: "Lovable Projects & App Ideas",
    titlePattern:
      "Lovable Projects: {count} Best App Ideas You Can Ship This Weekend",
    legacyCount: 30,
    metaDescription:
      "Lovable projects with starter prompts — 30+ app ideas where Lovable builds the full stack from plain English. Pick one and go live this weekend.",
    description:
      "Build full applications with natural language. Lovable handles the entire stack and deploys your app automatically.",
    url: "https://lovable.dev",
    icon: Heart,
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
    h1: "Windsurf Project Ideas & Examples",
    titlePattern:
      "Windsurf Project Ideas: {count} Examples for Agentic Coding",
    legacyCount: 30,
    metaDescription:
      "Windsurf project ideas and examples for Cascade-powered builds. Agentic IDE prompts for APIs, refactors, and full-stack MVPs you can ship this weekend.",
    description:
      "Windsurf is Codeium's agentic IDE: Cascade understands your repo, edits across files, and pairs with you like a junior engineer who already read the codebase. Best for developers who want real projects — APIs, refactors, and multi-file MVPs — not chat-only drafts.",
    url: "https://codeium.com/windsurf",
    icon: Wind,
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
      "Download Windsurf and open an empty folder (or an existing repo)",
      "Open Cascade and paste a starter prompt — or describe the MVP in one paragraph",
      "Let Cascade scaffold and edit across files; review diffs as you go",
      "Run the app locally, fix the happy path, then commit and deploy",
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
    featured: {
      slugs: [
        "ai-agent-error-translator",
        "ai-code-coach-tutor",
        "ai-coding-classroom-assistant",
        "ai-code-reviewer",
        "api-documentation-generator",
        "client-portal",
        "conversational-analytics-digest",
        "ai-feedback-triage-widget",
        "contract-analyzer",
        "saas-financial-toolkit",
      ],
      heading: "Start here: Windsurf projects worth shipping this weekend",
      intro:
        "These lean on Cascade — multi-file edits, APIs, and developer tools where an agentic IDE beats a blank chat window.",
    },
  },
};

export const TOOL_SLUGS = Object.keys(TOOL_PAGES);

/** "Using a different tool?" tiles. */
const TOOL_TILES: Array<{
  slug: string;
  label: string;
  sub: string;
  icon: LucideIcon;
}> = [
  { slug: "cursor", label: "Cursor", sub: "AI Code Editor", icon: MousePointer2 },
  { slug: "claude", label: "Claude", sub: "AI Assistant", icon: Sparkles },
  { slug: "claude-code", label: "Claude Code", sub: "Terminal Agent", icon: Code2 },
  { slug: "bolt", label: "Bolt.new", sub: "Full-Stack Builder", icon: Zap },
  { slug: "no-code", label: "No-Code", sub: "Visual Builders", icon: Blocks },
];

/** Tools that have a mark in the homepage logo set. Others fall back to their lucide icon. */
const TOOL_LOGO: Partial<Record<string, ToolKey>> = {
  cursor: "cursor",
  claude: "claude",
  "claude-code": "claudecode",
  lovable: "lovable",
  v0: "v0",
  replit: "replit",
  windsurf: "windsurf",
};

/** Italic tail appended to the H1 (WP56 ruling: the existing h1 stays verbatim first). */
const H1_TAIL: Record<string, string | null> = {
  cursor: "to ship this weekend.",
  claude: "worth building this weekend.",
  "claude-code": "straight from your terminal.",
  bolt: "to build in a weekend.",
  lovable: "you can ship by Sunday.",
  "no-code": null,
  replit: "to build in the browser.",
  v0: "this weekend.",
  windsurf: "to ship this weekend.",
};

function ToolMark({ slug, Icon }: { slug: string; Icon: LucideIcon }) {
  const logo = TOOL_LOGO[slug];
  return (
    <span aria-hidden className="flex size-24 items-center justify-center rounded-[20px] bg-home-ink text-home-d1 md:size-28">
      {logo ? (
        <ToolLogo tool={logo} size={52} idSuffix={`hub-${slug}`} />
      ) : (
        <Icon size={52} strokeWidth={1.4} />
      )}
    </span>
  );
}

function OtherToolTile({ tile }: { tile: (typeof TOOL_TILES)[number] }) {
  const logo = TOOL_LOGO[tile.slug];
  const Icon = tile.icon;
  return (
    <Link
      href={`/build-with/${tile.slug}`}
      className="group flex h-32 flex-col justify-between rounded-2xl border border-home-rule bg-home-card p-4 text-home-ink transition-colors duration-200 hover:border-home-ink motion-reduce:transition-none lg:h-[168px] lg:p-[22px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-home-orange-ink"
    >
      <span className="flex items-start justify-between">
        {logo ? <ToolLogo tool={logo} size={36} idSuffix={`other-${tile.slug}`} /> : <Icon size={36} strokeWidth={1.4} aria-hidden="true" />}
      </span>
      <span className="flex flex-col gap-1.5">
        <span className="font-editorial text-[22px] leading-none lg:text-[28px]">{tile.label}</span>
        <span className="font-mono text-[10.5px] uppercase tracking-[0.08em] text-home-ink-3 lg:text-[11px]">{tile.sub}</span>
      </span>
    </Link>
  );
}

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
  return page.titlePattern.replace("{count}", String(ideaCount));
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
  await connection();
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
  await connection();
  return <CachedToolHub slug={tool} />;
}

async function CachedToolHub({ slug }: { slug: string }) {
  const page = TOOL_PAGES[slug];
  const data = await getToolData(slug);
  const schema = buildSchema(page, data);
  const ideaCount = data.ideas.length;
  const tail = H1_TAIL[slug] ?? null;

  // Editorial curation. Slugs that no longer resolve (unpublished, retagged,
  // or below the byTool cap) are dropped, so the section either renders a
  // real set or disappears — the full list below is unaffected either way.
  // The kit's "Start here" shows three cards; any further hand-picked ideas
  // lead the list so none of them lose their link.
  const featuredIdeas = data.featured;
  const featuredCards = toPublicIdeas(featuredIdeas.slice(0, 3));
  const listed = new Set(featuredIdeas.map((idea) => idea.slug));
  const featuredExtras = featuredIdeas.slice(3);
  const browseIdeas = toPublicIdeas([...featuredExtras, ...data.ideas.filter((idea) => !listed.has(idea.slug))]);

  const emailCopy = page.emailCapture ?? {
    eyebrow: "Free newsletter",
    heading: "Get your next build idea by email",
    body: `The Weekend MVP newsletter: a validated idea with the stack, the build plan, and the prompts to ship it — including ideas suited to ${page.name}.`,
    buttonLabel: "Send me ideas",
  };

  const hasSteps = data.gettingStarted.length > 0;
  const hasPrompts = page.prompts.length > 0;
  const otherTools = TOOL_TILES.filter((tile) => tile.slug !== slug).slice(0, 4);

  return (
    <PublicShell>
      <JsonLd schema={schema} />
      <HubTracker event="view_tool_page" props={{ tool_name: page.name }} />

      <PageHeader
        crumbs={[{ label: "Home", href: "/" }, { label: `Build With ${page.name}` }]}
        lead={<ToolMark slug={slug} Icon={page.icon} />}
        title={
          <>
            {page.h1}
            {tail && (
              <>
                {" "}
                <Em>{tail}</Em>
              </>
            )}
          </>
        }
        description={data.description}
        meta={[
          ideaCount > 0 ? (
            <>
              <span className="font-medium text-home-ink">{ideaCount}</span> project ideas
            </>
          ) : null,
          hasPrompts ? `${page.prompts.length} starter prompts` : null,
          page.operatingSystem,
        ]}
      >
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3 pt-1">
          {featuredCards.length > 0 ? <ButtonLink href="#start-here">Start here</ButtonLink> : null}
          {/* Outbound tool link — deliberately secondary: this page's job is to
              send the visitor to an idea, not to the tool's homepage. */}
          <NavExternalLink
            href={data.url}
            className="inline-flex min-h-11 items-center gap-1.5 text-[15px] font-medium text-home-orange-ink underline underline-offset-4 transition-colors hover:text-home-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-home-orange-ink motion-reduce:transition-none"
          >
            Visit {page.name}
            <ArrowUpRight size={15} aria-hidden="true" />
          </NavExternalLink>
        </div>
      </PageHeader>

      {page.relatedHub ? (
        <Container className="pt-10">
          <p className="max-w-3xl text-[15px] leading-[1.6] text-home-ink-2">
            <span className="font-medium text-home-ink">{page.relatedHub.label}</span> {page.relatedHub.body}{" "}
            <Link
              href={page.relatedHub.href}
              className="text-home-orange-ink underline underline-offset-4 transition-colors hover:text-home-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-home-orange-ink motion-reduce:transition-none"
            >
              {page.relatedHub.cta}
            </Link>
          </p>
        </Container>
      ) : null}

      {page.crawlLinks && page.crawlLinks.length > 0 ? <HubCrawlLinks links={page.crawlLinks} /> : null}

      {/* What the tool is best for: a ruled, numbered serif list */}
      {data.strengths.length > 0 ? (
        <section aria-labelledby="strengths-heading" className="pt-14">
          <Container>
            <div className="flex flex-col gap-5 border-y border-home-rule border-t-home-ink py-7 lg:py-8">
              <h2
                id="strengths-heading"
                className="font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-home-orange-ink md:text-xs"
              >
                What {page.name} is Best For
              </h2>
              <ol className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-5">
                {data.strengths.slice(0, 5).map((strength, index) => (
                  <li key={strength} className="flex gap-2.5 font-editorial text-[22px] leading-[1.2] text-home-ink">
                    <span aria-hidden className="italic text-home-orange-ink">
                      {index + 1}
                    </span>
                    {strength}
                  </li>
                ))}
              </ol>
            </div>
          </Container>
        </section>
      ) : null}

      {/* Curated "start here" set — editorial, above the full list */}
      {page.featured && featuredCards.length > 0 ? (
        <HubFeaturedIdeas heading={page.featured.heading} intro={page.featured.intro} ideas={featuredCards} />
      ) : null}

      {/* Project ideas */}
      {browseIdeas.length > 0 ? (
        <Container className="py-14 lg:py-20">
          <IdeaBrowser
            ideas={browseIdeas}
            headingId="ideas-heading"
            heading={
              <>
                {featuredIdeas.length > 0 ? "More Project Ideas for" : "Project Ideas for"} <Em>{page.name}</Em>
              </>
            }
          />
        </Container>
      ) : null}

      {/* Newsletter capture — the only client boundary on this page */}
      <HubEmailCapture
        eyebrow={emailCopy.eyebrow}
        heading={emailCopy.heading}
        body={emailCopy.body}
        buttonLabel={emailCopy.buttonLabel}
        trackingProps={{ tool_name: page.name, surface: "build_with_hub" }}
      />

      {/* Getting started (left) and starter prompts (right) share one ink band */}
      {hasSteps || hasPrompts ? (
        <InkBand labelledBy={hasSteps ? "getting-started-heading" : "prompts-heading"}>
          <div className={hasSteps && hasPrompts ? "grid grid-cols-1 gap-12 lg:grid-cols-[5fr_7fr] lg:gap-16" : "grid grid-cols-1 gap-12"}>
            {hasSteps ? (
              <div className="flex flex-col gap-7">
                <SectionHeading id="getting-started-heading" dark>
                  Getting Started with <Em dark>{page.name}</Em>
                </SectionHeading>
                <StepList steps={data.gettingStarted} dark className="gap-3.5" />
              </div>
            ) : null}
            {hasPrompts ? (
              <div className="flex flex-col gap-7">
                <SectionHeading
                  id="prompts-heading"
                  dark
                  intro="Copy and paste these prompts to kickstart your project."
                >
                  {page.name} <Em dark>Starter Prompts</Em>
                </SectionHeading>
                <ul className="overflow-hidden rounded-2xl border border-home-panel-rule bg-home-panel">
                  {page.prompts.map((prompt, index) => (
                    <HubPromptCard
                      key={prompt.label}
                      index={index + 1}
                      label={prompt.label}
                      prompt={prompt.prompt}
                      location={`build-with-${slug}`}
                    />
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </InkBand>
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
      />

      {/* Other tools — kept for internal linking */}
      <section aria-labelledby="other-tools-heading" className="py-14 lg:py-20">
        <Container className="flex flex-col gap-6">
          <h2
            id="other-tools-heading"
            className="font-editorial text-[32px] font-normal leading-[1.05] tracking-[-0.02em] text-home-ink md:text-[40px]"
          >
            Using a different tool?
          </h2>
          <ul className="grid grid-cols-2 gap-2.5 lg:grid-cols-4 lg:gap-5">
            {otherTools.map((tile) => (
              <li key={tile.slug}>
                <OtherToolTile tile={tile} />
              </li>
            ))}
          </ul>
        </Container>
      </section>

      <HubCta
        heading={`Ready to build with ${page.name}?`}
        body={`Get the Weekend MVP Starter Kit with prompts optimized for ${page.name} and other AI tools.`}
      />
    </PublicShell>
  );
}
