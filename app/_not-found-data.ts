import {
  BookOpen,
  Briefcase,
  CalendarClock,
  CircleDollarSign,
  LayoutGrid,
  Lightbulb,
  Mail,
  Package,
  Sparkles,
  Terminal,
  User,
  Users,
  Wand2,
  Wrench,
  type LucideIcon,
} from "lucide-react";

/* -------------------------------------------------------------------------
 * Contextual recommendation data, ported from the legacy 404.html inline
 * script. The default context is rendered server-side (visible to crawlers
 * and without JS); an effect swaps in a context matched from the attempted
 * URL, falling back to the same-site referrer — exactly like legacy.
 * ---------------------------------------------------------------------- */

export type RecoCard = {
  href: string;
  icon: LucideIcon;
  title: string;
  desc: string;
  cta: string;
};

export type RecoContext = {
  eyebrow: string;
  heading: string;
  sub: string;
  cards: RecoCard[];
};

const ICONS = {
  ideas: Lightbulb,
  saas: LayoutGrid,
  ai: Sparkles,
  money: CircleDollarSign,
  kit: Package,
  build: Wand2,
  code: Terminal,
  persona: Users,
  solo: User,
  hustle: Briefcase,
  article: BookOpen,
  mail: Mail,
  wrench: Wrench,
  calendar: CalendarClock,
} as const;

function card(
  href: string,
  icon: LucideIcon,
  title: string,
  desc: string,
  cta: string,
): RecoCard {
  return { href, icon, title, desc, cta };
}

export const CONTEXTS: Record<string, RecoContext> = {
  "build-with": {
    eyebrow: "Build with AI",
    heading: "Looks like you were picking a build tool",
    sub: "Here are our most-read guides for shipping with AI.",
    cards: [
      card(
        "/build-with/cursor",
        ICONS.code,
        "Build with Cursor",
        "Ship a full MVP with the AI-first code editor.",
        "Read guide",
      ),
      card(
        "/build-with/claude",
        ICONS.build,
        "Build with Claude",
        "Use Claude to design, code, and ship faster.",
        "Read guide",
      ),
      card(
        "/build-with/no-code",
        ICONS.wrench,
        "No-code & all tools",
        "Bolt, Lovable, Replit, v0 and more, compared.",
        "See all",
      ),
    ],
  },
  "ideas-for": {
    eyebrow: "Made for you",
    heading: "Find ideas matched to your situation",
    sub: "Curated idea lists for whoever you are and however you build.",
    cards: [
      card(
        "/ideas-for/developers",
        ICONS.code,
        "For developers",
        "Technical ideas you can ship with code.",
        "Browse",
      ),
      card(
        "/ideas-for/solo-founders",
        ICONS.solo,
        "For solo founders",
        "One-person businesses you can run yourself.",
        "Browse",
      ),
      card(
        "/ideas-for/side-hustlers",
        ICONS.hustle,
        "For side hustlers",
        "Build it on nights and weekends.",
        "Browse",
      ),
    ],
  },
  solve: {
    eyebrow: "Solve a problem",
    heading: "Pick a real problem worth solving",
    sub: "Proven pain points with built-in demand.",
    cards: [
      card(
        "/solve/scheduling",
        ICONS.calendar,
        "Scheduling",
        "Booking & calendar tools people pay for.",
        "Explore",
      ),
      card(
        "/solve/invoicing",
        ICONS.money,
        "Invoicing",
        "Get-paid tools for freelancers & SMBs.",
        "Explore",
      ),
      card(
        "/solve/meeting-notes",
        ICONS.wrench,
        "Meeting notes",
        "AI note-takers and meeting tools.",
        "Explore",
      ),
    ],
  },
  ideas: {
    eyebrow: "Browse ideas",
    heading: "Plenty more ideas where that came from",
    sub: "Validated, build-ready ideas sorted by category and revenue.",
    cards: [
      card(
        "/ideas/saas",
        ICONS.saas,
        "SaaS ideas",
        "Recurring-revenue products you can build solo.",
        "Browse",
      ),
      card(
        "/ideas/ai-tools",
        ICONS.ai,
        "AI tool ideas",
        "Ride the AI wave with a focused tool.",
        "Browse",
      ),
      card(
        "/ideas/1k-month",
        ICONS.money,
        "$1K/month ideas",
        "Small bets with a clear path to revenue.",
        "Browse",
      ),
    ],
  },
  article: {
    eyebrow: "Keep reading",
    heading: "While you're here, keep reading",
    sub: "Tactics and playbooks for shipping fast.",
    cards: [
      card(
        "/articles",
        ICONS.article,
        "All articles",
        "Guides on validating and shipping MVPs.",
        "Read",
      ),
      card(
        "/newsletter",
        ICONS.mail,
        "The newsletter",
        "A fresh build-ready idea every week.",
        "Subscribe",
      ),
      card(
        "/startup-ideas",
        ICONS.ideas,
        "Startup ideas",
        "Browse the full idea library.",
        "Browse",
      ),
    ],
  },
  newsletter: {
    eyebrow: "Stay in the loop",
    heading: "Get a build-ready idea every week",
    sub: "Join the newsletter and never run out of ideas.",
    cards: [
      card(
        "/newsletter",
        ICONS.mail,
        "The newsletter",
        "One validated idea in your inbox weekly.",
        "Subscribe",
      ),
      card(
        "/startup-ideas",
        ICONS.ideas,
        "Idea library",
        "Catch up on every past idea.",
        "Browse",
      ),
      card(
        "/starter-kit",
        ICONS.kit,
        "Starter Kit",
        "The free toolkit to ship this weekend.",
        "Get it",
      ),
    ],
  },
  "starter-kit": {
    eyebrow: "Ship this weekend",
    heading: "Everything you need to ship",
    sub: "Grab the free kit and a tool to build with.",
    cards: [
      card(
        "/starter-kit",
        ICONS.kit,
        "The Starter Kit",
        "The free toolkit to ship your MVP fast.",
        "Get it free",
      ),
      card(
        "/build-with/no-code",
        ICONS.build,
        "Build with AI",
        "Pick the right tool for your stack.",
        "See tools",
      ),
      card(
        "/startup-ideas",
        ICONS.ideas,
        "Find an idea",
        "Validated ideas ready to build.",
        "Browse",
      ),
    ],
  },
};

export const DEFAULT_CTX: RecoContext = {
  eyebrow: "Popular right now",
  heading: "Pick up where you left off",
  sub: "Here's the good stuff most builders head to next.",
  cards: [
    card(
      "/startup-ideas",
      ICONS.ideas,
      "Weekend-ready ideas",
      "Validated startup ideas you can build in 48 hours.",
      "Explore",
    ),
    card(
      "/starter-kit",
      ICONS.kit,
      "The Starter Kit",
      "The free toolkit to ship your MVP this weekend.",
      "Get it free",
    ),
    card(
      "/build-with/no-code",
      ICONS.build,
      "Build with AI tools",
      "Guides for Cursor, Claude, Bolt, Lovable & more.",
      "See tools",
    ),
  ],
};

/** Match an order-sensitive list of path fragments to a context key. */
export function pickContextKey(path: string): string | null {
  if (!path) return null;
  path = path.toLowerCase();
  if (path.indexOf("build-with") !== -1) return "build-with";
  if (path.indexOf("ideas-for") !== -1) return "ideas-for";
  if (path.indexOf("solve") !== -1) return "solve";
  if (path.indexOf("newsletter") !== -1) return "newsletter";
  if (path.indexOf("article") !== -1) return "article";
  if (path.indexOf("starter") !== -1 || path.indexOf("kit") !== -1)
    return "starter-kit";
  if (path.indexOf("idea") !== -1) return "ideas";
  return null;
}
