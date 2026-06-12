"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowRight,
  BookOpen,
  Briefcase,
  CalendarClock,
  CircleCheck,
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

import { BeehiivSubscribeForm } from "@/components/forms/BeehiivSubscribeForm";
import { trackEvent } from "@/lib/track";

/* -------------------------------------------------------------------------
 * Contextual recommendation data, ported from the legacy 404.html inline
 * script. The default context is rendered server-side (visible to crawlers
 * and without JS); an effect swaps in a context matched from the attempted
 * URL, falling back to the same-site referrer — exactly like legacy.
 * ---------------------------------------------------------------------- */

type RecoCard = {
  href: string;
  icon: LucideIcon;
  title: string;
  desc: string;
  cta: string;
};

type RecoContext = {
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

const CONTEXTS: Record<string, RecoContext> = {
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

const DEFAULT_CTX: RecoContext = {
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
function pickContextKey(path: string): string | null {
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

/** Shows the path that 404'd so the visitor understands what happened. */
export function AttemptedPath() {
  const pathname = usePathname();
  const [path, setPath] = useState("");

  useEffect(() => {
    const attempted = pathname || window.location.pathname || "";
    if (attempted && attempted !== "/" && attempted !== "/404") {
      setPath(attempted);
    }
  }, [pathname]);

  if (!path) return null;

  return (
    <p className="text-sm text-neutral-600 font-mono mb-2">
      Couldn&apos;t find: {path}
    </p>
  );
}

/**
 * Contextual recommendations section. SSR renders the default card set for
 * crawlers / no-JS; after mount the cards swap based on the attempted URL or
 * same-site referrer, and the page_not_found analytics event fires.
 */
export function NotFoundRecommendations() {
  const pathname = usePathname();
  const [ctx, setCtx] = useState<RecoContext>(DEFAULT_CTX);

  useEffect(() => {
    const attemptedPath = pathname || window.location.pathname || "";

    let referrerPath = "";
    try {
      if (document.referrer) {
        const ref = new URL(document.referrer);
        // Only use the referrer if it's from our own site.
        if (ref.hostname === window.location.hostname) {
          referrerPath = ref.pathname;
        }
      }
    } catch {
      // ignore malformed referrer
    }

    // Prefer the broken URL the visitor tried; fall back to where they came from.
    const ctxKey = pickContextKey(attemptedPath) ?? pickContextKey(referrerPath);
    if (ctxKey && CONTEXTS[ctxKey]) setCtx(CONTEXTS[ctxKey]);

    // Track the 404 hit + the context we served, for analytics.
    trackEvent("page_not_found", {
      attempted_path: attemptedPath,
      referrer_path: referrerPath,
      served_context: ctxKey ?? "default",
    });
  }, [pathname]);

  return (
    <section className="max-w-5xl mx-auto px-6 py-12">
      <div className="text-center mb-10">
        <p className="text-xs font-bold uppercase tracking-widest text-neutral-500 mb-3">
          {ctx.eyebrow}
        </p>
        <h2 className="text-2xl md:text-3xl font-medium tracking-tight text-white mb-2">
          {ctx.heading}
        </h2>
        <p className="text-neutral-400 text-sm max-w-lg mx-auto">{ctx.sub}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {ctx.cards.map((c) => (
          <Link
            key={c.href}
            href={c.href}
            className="group flex flex-col p-6 bg-neutral-950/60 border border-white/10 rounded-2xl hover:border-white/25 hover:bg-neutral-900/60 transition-all"
            data-404-reco={c.title}
          >
            <div className="w-10 h-10 flex items-center justify-center bg-white/5 border border-white/10 rounded-xl text-white mb-4">
              <c.icon size={20} aria-hidden="true" />
            </div>
            <h3 className="text-white font-medium text-sm mb-1">{c.title}</h3>
            <p className="text-neutral-500 text-xs leading-relaxed flex-1">
              {c.desc}
            </p>
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-neutral-400 group-hover:text-white transition-colors mt-4">
              {c.cta} <ArrowRight size={13} aria-hidden="true" />
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}

/**
 * Inline email capture, replacing the legacy `kit-form-404` script. Submission
 * goes through BeehiivSubscribeForm (API + embed fallback); on success the
 * form swaps for the legacy inline success state instead of redirecting.
 */
export function KitSignup404() {
  const [subscribed, setSubscribed] = useState(false);

  if (subscribed) {
    return (
      <div className="flex flex-col items-center text-center pt-2">
        <div className="w-14 h-14 bg-green-500/10 rounded-full flex items-center justify-center text-green-500 mb-4">
          <CircleCheck size={28} aria-hidden="true" />
        </div>
        <h3 className="text-xl font-medium text-white tracking-tight mb-1">
          Check your inbox!
        </h3>
        <p className="text-neutral-400 text-sm">
          The Weekend MVP Starter Kit is on its way.
        </p>
      </div>
    );
  }

  return (
    <BeehiivSubscribeForm
      showFirstName={false}
      utmCampaign="404-page"
      successHref={null}
      onSuccess={() => setSubscribed(true)}
      submitLabel="Send me the kit"
      className="flex flex-col sm:flex-row items-stretch gap-3 max-w-md mx-auto space-y-0 [&>div]:flex-1"
      inputClassName="rounded-xl px-4 py-3.5 placeholder:text-neutral-600"
      buttonClassName="w-auto rounded-xl px-6 py-3.5 tracking-tight whitespace-nowrap"
    />
  );
}
