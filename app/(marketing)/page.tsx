import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  Bot,
  CalendarClock,
  CalendarDays,
  Check,
  CheckCircle,
  CheckCircle2,
  Circle,
  CircleDashed,
  ClipboardCheck,
  Cloud,
  GraduationCap,
  HeartPulse,
  Layers,
  LayoutTemplate,
  MousePointerClick,
  Rocket,
  Scissors,
  Sparkles,
  Store,
  Target,
  Timer,
  X,
  XCircle,
  Zap,
} from "lucide-react";

import { BeehiivSubscribeForm } from "@/components/forms/BeehiivSubscribeForm";
import { AuraBackground } from "@/components/marketing/AuraBackground";
import { PageInteractions } from "@/components/marketing/Interactions";
import { SignupCta } from "@/components/marketing/SignupCta";
import { JsonLd } from "@/components/primitives/JsonLd";

const TITLE = "Weekend MVP | Ship your product in 48 hours";
const OG_DESCRIPTION =
  "Build and launch your weekend MVP even if you're non-technical. Get the exact checklist, templates, and prompts by John Iseghohi.";

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description:
    "Ship a weekend MVP, even if you're non-technical. Get the exact checklist, templates, and prompts by John Iseghohi to build and launch by Sunday night.",
  authors: [{ name: "John Iseghohi" }],
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    url: "https://weekendmvp.app/",
    title: TITLE,
    description: OG_DESCRIPTION,
    images: [
      {
        url: "https://weekendmvp.app/image/og-image.png",
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
    description: OG_DESCRIPTION,
    images: ["https://weekendmvp.app/image/og-image.png"],
  },
  verification: {
    google: "google-site-verification=HCdXKcfa0MioAEpD-uVIkfFOjcb3CodPcmdc7yxAuRM",
  },
};

const HOME_SCHEMA = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Person",
      "@id": "https://weekendmvp.app/#person",
      name: "John Iseghohi",
      jobTitle: "Product Builder & MVP Specialist",
      url: "https://cal.com/switchtoux",
      knowsAbout: [
        "MVP Development",
        "Startup Ideas",
        "Product Design",
        "AI Tools for Building",
        "Weekend Projects",
        "No-Code Development",
      ],
      description:
        "Product builder helping non-technical founders ship MVPs in 48 hours with the Weekend MVP methodology.",
    },
    {
      "@type": "WebSite",
      "@id": "https://weekendmvp.app/#website",
      url: "https://weekendmvp.app/",
      name: "Weekend MVP",
      publisher: { "@id": "https://weekendmvp.app/#person" },
    },
    {
      "@type": "SoftwareApplication",
      name: "Weekend MVP Starter Kit",
      applicationCategory: "DeveloperApplication",
      operatingSystem: "Web",
      creator: { "@id": "https://weekendmvp.app/#person" },
      description:
        "The exact checklist, templates, and prompts to build a 3-screen MVP and launch a waitlist in 48 hours.",
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "USD",
      },
    },
    {
      "@type": "FAQPage",
      mainEntity: [
        {
          "@type": "Question",
          name: "Is this really free?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Yep. Free. Just useful.",
          },
        },
        {
          "@type": "Question",
          name: "Do I need to be a developer?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "No. The kit is built for non-technical builders using AI tools.",
          },
        },
        {
          "@type": "Question",
          name: "What tools do I need?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Whatever you\u2019re comfortable with. The kit focuses on workflow, not hype stacks.",
          },
        },
        {
          "@type": "Question",
          name: "What will I have by Sunday night?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "A demo you can show, a waitlist to collect emails, and a clear next step.",
          },
        },
        {
          "@type": "Question",
          name: "Will this help me pick an idea?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Yes. There\u2019s a scorecard and a short list of MVP ideas that are easy to ship.",
          },
        },
        {
          "@type": "Question",
          name: "Can you help me build it?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Yes. After you get the kit, you\u2019ll have the option to work with me 1:1 for a Weekend MVP Sprint.",
          },
        },
      ],
    },
  ],
};

/** simple-icons:cursor, inlined from the Iconify simple-icons set. */
function CursorBrandIcon({
  size = 32,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={className}
      aria-hidden="true"
    >
      <path
        fill="currentColor"
        d="M11.503.131L1.891 5.678a.84.84 0 0 0-.42.726v11.188c0 .3.162.575.42.724l9.609 5.55a1 1 0 0 0 .998 0l9.61-5.55a.84.84 0 0 0 .42-.724V6.404a.84.84 0 0 0-.42-.726L12.497.131a1.01 1.01 0 0 0-.996 0M2.657 6.338h18.55c.263 0 .43.287.297.515L12.23 22.918c-.062.107-.229.064-.229-.06V12.335a.59.59 0 0 0-.295-.51l-9.11-5.257c-.109-.063-.064-.23.061-.23"
      />
    </svg>
  );
}

/** simple-icons:anthropic, inlined from the Iconify simple-icons set. */
function AnthropicBrandIcon({
  size = 32,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={className}
      aria-hidden="true"
    >
      <path
        fill="currentColor"
        d="M17.304 3.541h-3.672l6.696 16.918H24Zm-10.608 0L0 20.459h3.744l1.37-3.553h7.005l1.369 3.553h3.744L10.536 3.541Zm-.371 10.223L8.616 7.82l2.291 5.945Z"
      />
    </svg>
  );
}

export default function HomePage() {
  return (
    <div className="relative min-h-screen overflow-x-hidden selection:bg-white/20 selection:text-white pt-24">
      <JsonLd schema={HOME_SCHEMA} />
      <PageInteractions trackedSections={["what-you-get", "process", "faq"]} />

      {/* Background (component) added by Aura */}
      <AuraBackground />

      {/* Background Grid */}
      <div className="fixed inset-0 pointer-events-none z-0 grid-lines"></div>

      {/* Top Glow */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-full max-w-3xl h-96 bg-white/5 blur-[120px] rounded-full pointer-events-none -z-10 mix-blend-screen"></div>

      {/* Background Noodles & Beams */}
      <div className="absolute top-[380px] left-0 w-full h-[800px] pointer-events-none z-0 overflow-visible hidden md:block">
        <svg
          className="w-full h-full"
          preserveAspectRatio="none"
          viewBox="0 0 1440 800"
        >
          <defs>
            <linearGradient id="beam-gradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="transparent"></stop>
              <stop offset="50%" stopColor="white"></stop>
              <stop offset="100%" stopColor="transparent"></stop>
            </linearGradient>
          </defs>

          <path
            d="M 720 0 C 720 200, 320 200, 320 600"
            fill="none"
            stroke="rgba(255,255,255,0.03)"
            strokeWidth="1"
          ></path>
          <path
            d="M 720 0 C 720 200, 320 200, 320 600"
            fill="none"
            stroke="url(#beam-gradient)"
            strokeWidth="1.5"
            className="beam-path beam-1 glow-filter"
          ></path>

          <path
            d="M 720 0 V 600"
            fill="none"
            stroke="rgba(255,255,255,0.03)"
            strokeWidth="1"
          ></path>
          <path
            d="M 720 0 V 600"
            fill="none"
            stroke="url(#beam-gradient)"
            strokeWidth="1.5"
            className="beam-path beam-2 glow-filter"
          ></path>

          <path
            d="M 720 0 C 720 200, 1120 200, 1120 600"
            fill="none"
            stroke="rgba(255,255,255,0.03)"
            strokeWidth="1"
          ></path>
          <path
            d="M 720 0 C 720 200, 1120 200, 1120 600"
            fill="none"
            stroke="url(#beam-gradient)"
            strokeWidth="1.5"
            className="beam-path beam-3 glow-filter"
          ></path>
        </svg>
      </div>

      {/* Mobile Vertical Beam */}
      <div className="md:hidden absolute top-[400px] left-1/2 -translate-x-1/2 w-px h-[600px] bg-white/5 z-0 overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-24 bg-gradient-to-b from-transparent via-white/50 to-transparent animate-[fadeUp_3s_infinite]"></div>
      </div>

      {/* Hero Section */}
      <main className="relative z-10 max-w-7xl mx-auto px-6 pt-20 pb-32">
        <div className="text-center max-w-4xl mx-auto mb-24 relative z-10">
          <div className="animate-enter inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-neutral-400 text-xs font-medium mb-8">
            <span
              className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]"
              aria-hidden="true"
            ></span>
            <span className="sr-only">Available now:</span>
            Weekend MVP Starter Kit
          </div>

          <h1 className="animate-enter delay-100 text-5xl md:text-7xl lg:text-8xl font-medium text-white tracking-tighter leading-[1.1] mb-8">
            Ship a weekend MVP,
            <br className="hidden md:block" />
            <span className="text-gray-50">even if you&rsquo;re non-technical.</span>
          </h1>

          <p className="animate-enter delay-200 text-lg md:text-xl text-neutral-400 font-light tracking-tight max-w-2xl mx-auto leading-relaxed mb-10">
            Get the exact checklist, templates, and prompts to build a 3-screen
            MVP and launch a waitlist by Sunday night.
          </p>

          <div className="animate-enter delay-300 flex flex-col items-center gap-4">
            <div id="beehiiv-form-container" className="w-full max-w-sm">
              <BeehiivSubscribeForm
                showFirstName={false}
                submitLabel="Get the Starter Kit"
                className="space-y-3"
                buttonClassName="px-8 py-4 tracking-tight shadow-[0_0_40px_-10px_rgba(255,255,255,0.3)]"
              />
            </div>
            <p className="text-xs text-neutral-600 font-medium tracking-wide uppercase">
              Free. Practical. Built for shipping.
            </p>
          </div>
        </div>

        {/* Bento Grid Visualization */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 max-w-6xl mx-auto relative z-10">
          {/* Left Card */}
          <div className="animate-enter delay-300 md:col-span-4 bg-[#0A0A0A] border border-white/5 rounded-[2rem] p-8 relative overflow-hidden group hover:border-white/10 transition-colors">
            <div className="absolute inset-0 bg-gradient-to-br from-white/[0.03] to-transparent pointer-events-none"></div>
            <div className="absolute -top-px left-1/2 -translate-x-1/2 w-20 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent"></div>
            <div className="relative z-10 flex flex-col h-full justify-between">
              <div>
                <div className="flex items-center gap-2 mb-6 text-neutral-500">
                  <CalendarClock size={20} aria-hidden="true" />
                  <span className="text-xs font-semibold uppercase tracking-wider">
                    The Timeline
                  </span>
                </div>
                <h3 className="text-2xl text-white font-medium tracking-tight mb-2">
                  48-Hour Plan
                </h3>
                <p className="text-sm text-neutral-400">
                  Friday to Sunday execution.
                </p>
              </div>
              <div className="space-y-3 mt-8">
                <div className="flex items-center gap-3 p-3 bg-white/5 rounded-xl border border-white/5">
                  <div className="w-6 h-6 rounded-full bg-neutral-800 flex items-center justify-center text-xs font-bold text-neutral-400">
                    F
                  </div>
                  <span className="text-sm text-neutral-300">
                    Strategy &amp; Scope
                  </span>
                  <CheckCircle2
                    className="ml-auto text-neutral-600"
                    size={16}
                    aria-hidden="true"
                  />
                </div>
                <div className="flex items-center gap-3 p-3 bg-white/5 rounded-xl border border-white/5">
                  <div className="w-6 h-6 rounded-full bg-neutral-800 flex items-center justify-center text-xs font-bold text-neutral-400">
                    S
                  </div>
                  <span className="text-sm text-neutral-300">
                    Build 3 Screens
                  </span>
                  <CircleDashed
                    className="ml-auto text-neutral-600"
                    size={16}
                    aria-hidden="true"
                  />
                </div>
                <div className="flex items-center gap-3 p-3 bg-white/5 rounded-xl border border-white/5">
                  <div className="w-6 h-6 rounded-full bg-neutral-800 flex items-center justify-center text-xs font-bold text-neutral-400">
                    S
                  </div>
                  <span className="text-sm text-neutral-300">
                    Launch &amp; Waitlist
                  </span>
                  <Circle
                    className="ml-auto text-neutral-600"
                    size={16}
                    aria-hidden="true"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Middle Card */}
          <div className="animate-enter delay-400 md:col-span-4 bg-[#0A0A0A] border border-white/5 rounded-[2rem] p-8 relative overflow-hidden group hover:border-white/10 transition-colors">
            <div className="absolute -top-px left-1/2 -translate-x-1/2 w-20 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent"></div>
            <div className="absolute top-0 right-0 p-8 opacity-20 group-hover:opacity-30 transition-opacity">
              <Rocket size={120} aria-hidden="true" />
            </div>
            <div className="relative z-10 h-full flex flex-col">
              <div className="flex items-center gap-2 mb-6 text-neutral-500">
                <Target size={20} aria-hidden="true" />
                <span className="text-xs font-semibold uppercase tracking-wider">
                  The Goal
                </span>
              </div>
              <div className="mt-auto">
                <div className="text-6xl font-medium text-white tracking-tighter mb-2">
                  MVP
                </div>
                <p className="text-neutral-400 text-sm leading-relaxed">
                  Not version one. The smallest version that creates proof.
                </p>
              </div>
              <div className="mt-8 pt-6 border-t border-white/5">
                <div className="flex justify-between items-end">
                  <div>
                    <div className="text-3xl font-semibold text-white tracking-tight">
                      128
                    </div>
                    <div className="text-[10px] text-neutral-500 uppercase tracking-wide font-semibold mt-1">
                      Emails Collected
                    </div>
                  </div>
                  <div className="h-8 w-24 flex items-end gap-1">
                    <div className="w-full bg-neutral-800 rounded-sm h-[40%]"></div>
                    <div className="w-full bg-neutral-800 rounded-sm h-[70%]"></div>
                    <div className="w-full bg-white rounded-sm h-[100%] shadow-[0_0_10px_rgba(255,255,255,0.3)]"></div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Card */}
          <div className="animate-enter delay-500 md:col-span-4 bg-[#0A0A0A] border border-white/5 rounded-[2rem] p-8 relative overflow-hidden group hover:border-white/10 transition-colors">
            <div className="absolute -top-px left-1/2 -translate-x-1/2 w-20 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent"></div>
            <div className="flashlight-container absolute inset-0 z-0 rounded-[2rem] pointer-events-none">
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-white/10 via-transparent to-transparent opacity-40"></div>
              <div className="absolute inset-0 overflow-hidden rounded-[2rem] opacity-20 mix-blend-screen">
                <svg
                  className="w-full h-full"
                  preserveAspectRatio="none"
                  viewBox="0 0 100 100"
                >
                  <path
                    d="M0,0 Q50,50 100,100"
                    fill="none"
                    stroke="url(#local-beam-gradient)"
                    strokeWidth="0.5"
                    className="beam-path"
                    style={{
                      animation: "dash 3s linear infinite",
                      strokeDasharray: "50, 200",
                      strokeDashoffset: 250,
                    }}
                  ></path>
                  <defs>
                    <linearGradient
                      id="local-beam-gradient"
                      x1="0%"
                      y1="0%"
                      x2="100%"
                      y2="100%"
                    >
                      <stop offset="0%" stopColor="transparent"></stop>
                      <stop offset="50%" stopColor="white"></stop>
                      <stop offset="100%" stopColor="transparent"></stop>
                    </linearGradient>
                  </defs>
                </svg>
              </div>
              <div className="flashlight-bg absolute inset-0 transition-opacity duration-300"></div>
              <div className="flashlight-border absolute inset-0 rounded-[2rem] p-[1px]"></div>
            </div>

            <div className="flex items-center gap-2 mb-6 text-neutral-500 relative z-10">
              <LayoutTemplate size={20} aria-hidden="true" />
              <span className="text-xs font-semibold uppercase tracking-wider">
                The Template
              </span>
            </div>

            <h3 className="text-2xl text-white font-medium tracking-tight mb-8 relative z-10">
              3-Screen Flow
            </h3>

            <div className="relative flex items-center justify-center gap-3 perspective-1000">
              <div className="w-20 h-32 bg-neutral-900 border border-white/10 rounded-lg shadow-xl flex flex-col p-2 gap-2 transform -rotate-12 translate-y-2 opacity-60">
                <div className="h-2 w-12 bg-white/20 rounded-full"></div>
                <div className="h-16 w-full bg-white/5 rounded-md"></div>
              </div>
              <div className="w-24 h-40 bg-neutral-800 border border-white/20 rounded-xl shadow-2xl flex flex-col p-3 gap-2 z-10 relative">
                <div className="absolute -top-2 -right-2 w-6 h-6 bg-white rounded-full flex items-center justify-center text-black text-[10px] font-bold shadow-lg">
                  2
                </div>
                <div className="h-2 w-10 bg-white/40 rounded-full mb-1"></div>
                <div className="h-3 w-16 bg-white/10 rounded-full"></div>
                <div className="mt-auto h-6 w-full bg-white rounded-md"></div>
              </div>
              <div className="w-20 h-32 bg-neutral-900 border border-white/10 rounded-lg shadow-xl flex flex-col p-2 gap-2 transform rotate-12 translate-y-2 opacity-60">
                <div className="h-8 w-8 bg-white/10 rounded-full self-center mt-4"></div>
                <div className="h-2 w-12 bg-white/20 rounded-full self-center"></div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* What You Get Section */}
      <section
        id="what-you-get"
        className="border-t border-white/5 bg-[#050505] relative py-32"
      >
        <div className="max-w-7xl mx-auto px-6">
          <div className="mb-16 md:mb-24 max-w-2xl">
            <h2 className="animate-enter text-3xl md:text-5xl font-medium text-white tracking-tight mb-6">
              Everything inside the kit
            </h2>
            <p className="animate-enter delay-100 text-lg text-neutral-400 font-light">
              No massive scope. No tool overwhelm. Just a clear plan that gets
              you to &quot;live link + waitlist&quot;.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <div className="animate-enter delay-200 group p-6 rounded-2xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.04] transition-colors">
              <div className="w-10 h-10 rounded-lg bg-neutral-900 border border-white/10 flex items-center justify-center mb-4 text-white">
                <Timer size={20} aria-hidden="true" />
              </div>
              <h3 className="text-white font-medium mb-2">
                The 15-second demo test
              </h3>
              <p className="text-sm text-neutral-500 leading-relaxed">
                Stop picking ideas that never ship. Validate feasibility
                instantly.
              </p>
            </div>
            <div className="animate-enter delay-200 group p-6 rounded-2xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.04] transition-colors">
              <div className="w-10 h-10 rounded-lg bg-neutral-900 border border-white/10 flex items-center justify-center mb-4 text-white">
                <Layers size={20} aria-hidden="true" />
              </div>
              <h3 className="text-white font-medium mb-2">
                3-screen MVP template
              </h3>
              <p className="text-sm text-neutral-500 leading-relaxed">
                The golden structure: Landing Page → Input → Output.
              </p>
            </div>
            <div className="animate-enter delay-200 group p-6 rounded-2xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.04] transition-colors">
              <div className="w-10 h-10 rounded-lg bg-neutral-900 border border-white/10 flex items-center justify-center mb-4 text-white">
                <ClipboardCheck size={20} aria-hidden="true" />
              </div>
              <h3 className="text-white font-medium mb-2">MVP idea scorecard</h3>
              <p className="text-sm text-neutral-500 leading-relaxed">
                Pick a buildable idea in 10 minutes based on real constraints.
              </p>
            </div>
            <div className="animate-enter delay-300 group p-6 rounded-2xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.04] transition-colors">
              <div className="w-10 h-10 rounded-lg bg-neutral-900 border border-white/10 flex items-center justify-center mb-4 text-white">
                <CalendarDays size={20} aria-hidden="true" />
              </div>
              <h3 className="text-white font-medium mb-2">
                48-hour weekend plan
              </h3>
              <p className="text-sm text-neutral-500 leading-relaxed">
                Step-by-step itinerary: What to do Friday, Saturday, and Sunday.
              </p>
            </div>
            <div className="animate-enter delay-300 group p-6 rounded-2xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.04] transition-colors">
              <div className="w-10 h-10 rounded-lg bg-neutral-900 border border-white/10 flex items-center justify-center mb-4 text-white">
                <Scissors size={20} aria-hidden="true" />
              </div>
              <h3 className="text-white font-medium mb-2">
                Scope-cutting checklist
              </h3>
              <p className="text-sm text-neutral-500 leading-relaxed">
                Slash features without second guessing to ensure you ship.
              </p>
            </div>
            <div className="animate-enter delay-300 group p-6 rounded-2xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.04] transition-colors">
              <div className="w-10 h-10 rounded-lg bg-neutral-900 border border-white/10 flex items-center justify-center mb-4 text-white">
                <Sparkles size={20} aria-hidden="true" />
              </div>
              <h3 className="text-white font-medium mb-2">
                Copy-paste AI prompts
              </h3>
              <p className="text-sm text-neutral-500 leading-relaxed">
                Shrink your idea and unblock code issues fast with AI.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section
        id="process"
        className="relative py-32 bg-[#050505] border-t border-white/5 overflow-hidden"
      >
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-white/[0.02] rounded-full blur-[100px] pointer-events-none"></div>
        <div className="max-w-7xl mx-auto px-6 relative z-10">
          <div className="text-center mb-24">
            <h2 className="animate-enter text-3xl md:text-5xl font-medium text-white tracking-tight mb-4">
              How it works
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12 relative">
            <div className="hidden md:block absolute top-12 left-[16%] right-[16%] h-px bg-gradient-to-r from-transparent via-white/10 to-transparent"></div>
            <div className="animate-enter delay-100 relative flex flex-col items-center text-center">
              <div className="w-24 h-24 rounded-full bg-[#0A0A0A] border border-white/10 flex items-center justify-center mb-8 relative z-10 shadow-[0_0_20px_rgba(0,0,0,0.5)]">
                <span className="text-2xl font-bold text-white">1</span>
              </div>
              <h3 className="text-lg font-semibold text-white mb-3">
                Pick an idea
              </h3>
              <p className="text-sm text-neutral-500 max-w-xs leading-relaxed">
                Use the scorecard to find a shippable idea. Discard the rest.
              </p>
            </div>
            <div className="animate-enter delay-200 relative flex flex-col items-center text-center">
              <div className="w-24 h-24 rounded-full bg-[#0A0A0A] border border-white/10 flex items-center justify-center mb-8 relative z-10 shadow-[0_0_20px_rgba(0,0,0,0.5)]">
                <span className="text-2xl font-bold text-white">2</span>
              </div>
              <h3 className="text-lg font-semibold text-white mb-3">
                Build with templates
              </h3>
              <p className="text-sm text-neutral-500 max-w-xs leading-relaxed">
                Execute the 3-screen MVP using the provided templates and
                prompts.
              </p>
            </div>
            <div className="animate-enter delay-300 relative flex flex-col items-center text-center">
              <div className="w-24 h-24 rounded-full bg-[#0A0A0A] border border-white/10 flex items-center justify-center mb-8 relative z-10 shadow-[0_0_20px_rgba(0,0,0,0.5)]">
                <span className="text-2xl font-bold text-white">3</span>
              </div>
              <h3 className="text-lg font-semibold text-white mb-3">
                Launch &amp; Collect
              </h3>
              <p className="text-sm text-neutral-500 max-w-xs leading-relaxed">
                Launch your waitlist + demo and start collecting emails
                immediately.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Who It's For Section */}
      <section className="py-24 border-t border-white/5 bg-[#080808]">
        <div className="max-w-5xl mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
            <div className="animate-enter">
              <h3 className="text-xl font-medium text-white mb-8 flex items-center gap-3">
                <CheckCircle className="text-green-500" size={20} aria-hidden="true" />
                This kit is for you if:
              </h3>
              <ul className="space-y-4">
                <li className="flex items-start gap-3 text-sm text-neutral-400">
                  <Check
                    className="text-neutral-600 mt-0.5 min-w-[16px]"
                    size={16}
                    aria-hidden="true"
                  />
                  <span>
                    You&rsquo;ve got side project ideas but don&apos;t know
                    where to start.
                  </span>
                </li>
                <li className="flex items-start gap-3 text-sm text-neutral-400">
                  <Check
                    className="text-neutral-600 mt-0.5 min-w-[16px]"
                    size={16}
                    aria-hidden="true"
                  />
                  <span>
                    You&rsquo;re not technical (or you are, but you still want
                    speed).
                  </span>
                </li>
                <li className="flex items-start gap-3 text-sm text-neutral-400">
                  <Check
                    className="text-neutral-600 mt-0.5 min-w-[16px]"
                    size={16}
                    aria-hidden="true"
                  />
                  <span>
                    You want something you can demo and post, not a half-built
                    project.
                  </span>
                </li>
                <li className="flex items-start gap-3 text-sm text-neutral-400">
                  <Check
                    className="text-neutral-600 mt-0.5 min-w-[16px]"
                    size={16}
                    aria-hidden="true"
                  />
                  <span>
                    Your real goal is momentum, feedback, and an email list.
                  </span>
                </li>
              </ul>
            </div>
            <div className="animate-enter delay-100">
              <h3 className="text-xl font-medium text-white mb-8 flex items-center gap-3">
                <XCircle className="text-neutral-600" size={20} aria-hidden="true" />
                Not for you if:
              </h3>
              <ul className="space-y-4">
                <li className="flex items-start gap-3 text-sm text-neutral-400">
                  <X
                    className="text-neutral-600 mt-0.5 min-w-[16px]"
                    size={16}
                    aria-hidden="true"
                  />
                  <span>
                    You&rsquo;re trying to build a full platform in a weekend.
                  </span>
                </li>
                <li className="flex items-start gap-3 text-sm text-neutral-400">
                  <X
                    className="text-neutral-600 mt-0.5 min-w-[16px]"
                    size={16}
                    aria-hidden="true"
                  />
                  <span>You want perfect UI before you ship anything.</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Browse by Category Section */}
      <section
        id="browse-categories"
        className="relative z-10 py-24 border-t border-white/5 bg-[#050505]"
      >
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="animate-enter text-3xl md:text-4xl font-medium text-white tracking-tight mb-4">
              Browse Startup Ideas by Category
            </h2>
            <p className="animate-enter delay-100 text-neutral-400 text-lg max-w-2xl mx-auto font-light">
              Research-backed ideas organized by industry. Each includes AI
              prompts, market validation, and a build guide.
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {/* SaaS Category */}
            <Link
              href="/startup-ideas#saas"
              className="animate-enter delay-200 group p-6 bg-white/5 border border-white/10 rounded-2xl hover:bg-white/10 hover:border-white/20 transition-all"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-blue-500/10 rounded-xl flex items-center justify-center">
                  <Cloud className="text-blue-400" size={20} aria-hidden="true" />
                </div>
                <span className="text-white font-medium">SaaS</span>
              </div>
              <p className="text-neutral-500 text-sm">Subscription software</p>
            </Link>

            {/* AI Tools Category */}
            <Link
              href="/startup-ideas#ai"
              className="animate-enter delay-200 group p-6 bg-white/5 border border-white/10 rounded-2xl hover:bg-white/10 hover:border-white/20 transition-all"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-purple-500/10 rounded-xl flex items-center justify-center">
                  <Sparkles
                    className="text-purple-400"
                    size={20}
                    aria-hidden="true"
                  />
                </div>
                <span className="text-white font-medium">AI Tools</span>
              </div>
              <p className="text-neutral-500 text-sm">AI-powered products</p>
            </Link>

            {/* Productivity Category */}
            <Link
              href="/startup-ideas#productivity"
              className="animate-enter delay-300 group p-6 bg-white/5 border border-white/10 rounded-2xl hover:bg-white/10 hover:border-white/20 transition-all"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-green-500/10 rounded-xl flex items-center justify-center">
                  <Zap className="text-green-400" size={20} aria-hidden="true" />
                </div>
                <span className="text-white font-medium">Productivity</span>
              </div>
              <p className="text-neutral-500 text-sm">Work smarter tools</p>
            </Link>

            {/* Automation Category */}
            <Link
              href="/startup-ideas#automation"
              className="animate-enter delay-300 group p-6 bg-white/5 border border-white/10 rounded-2xl hover:bg-white/10 hover:border-white/20 transition-all"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-orange-500/10 rounded-xl flex items-center justify-center">
                  <Bot className="text-orange-400" size={20} aria-hidden="true" />
                </div>
                <span className="text-white font-medium">Automation</span>
              </div>
              <p className="text-neutral-500 text-sm">Automate workflows</p>
            </Link>

            {/* Health Category */}
            <Link
              href="/startup-ideas#health"
              className="animate-enter delay-400 group p-6 bg-white/5 border border-white/10 rounded-2xl hover:bg-white/10 hover:border-white/20 transition-all"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-red-500/10 rounded-xl flex items-center justify-center">
                  <HeartPulse
                    className="text-red-400"
                    size={20}
                    aria-hidden="true"
                  />
                </div>
                <span className="text-white font-medium">Health</span>
              </div>
              <p className="text-neutral-500 text-sm">Wellness &amp; fitness</p>
            </Link>

            {/* Marketplace Category */}
            <Link
              href="/startup-ideas#marketplace"
              className="animate-enter delay-400 group p-6 bg-white/5 border border-white/10 rounded-2xl hover:bg-white/10 hover:border-white/20 transition-all"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-cyan-500/10 rounded-xl flex items-center justify-center">
                  <Store className="text-cyan-400" size={20} aria-hidden="true" />
                </div>
                <span className="text-white font-medium">Marketplace</span>
              </div>
              <p className="text-neutral-500 text-sm">
                Connect buyers &amp; sellers
              </p>
            </Link>

            {/* Education Category */}
            <Link
              href="/startup-ideas#education"
              className="animate-enter delay-500 group p-6 bg-white/5 border border-white/10 rounded-2xl hover:bg-white/10 hover:border-white/20 transition-all"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-yellow-500/10 rounded-xl flex items-center justify-center">
                  <GraduationCap
                    className="text-yellow-400"
                    size={20}
                    aria-hidden="true"
                  />
                </div>
                <span className="text-white font-medium">Education</span>
              </div>
              <p className="text-neutral-500 text-sm">Learning platforms</p>
            </Link>

            {/* View All Link */}
            <Link
              href="/startup-ideas"
              className="animate-enter delay-500 group p-6 bg-gradient-to-br from-white/5 to-transparent border border-white/10 rounded-2xl hover:border-white/20 transition-all flex flex-col justify-center items-center text-center"
            >
              <ArrowRight
                className="text-neutral-400 group-hover:text-white transition-colors mb-2"
                size={24}
                aria-hidden="true"
              />
              <span className="text-neutral-400 group-hover:text-white font-medium text-sm transition-colors">
                View All Ideas
              </span>
            </Link>
          </div>
        </div>
      </section>

      {/* Build With Tools Section */}
      <section
        id="build-with-tools"
        className="relative z-10 py-24 border-t border-white/5 bg-[#080808]"
      >
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="animate-enter text-3xl md:text-4xl font-medium text-white tracking-tight mb-4">
              Build With Your Favorite AI Tools
            </h2>
            <p className="animate-enter delay-100 text-neutral-400 text-lg max-w-2xl mx-auto font-light">
              Find ideas optimized for your preferred development environment.
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {/* Cursor */}
            <Link
              href="/startup-ideas"
              className="animate-enter delay-200 group relative p-8 bg-gradient-to-br from-white/5 to-transparent border border-white/10 rounded-3xl hover:border-white/20 transition-all text-center"
            >
              <div className="w-16 h-16 mx-auto mb-4 bg-white/5 rounded-2xl flex items-center justify-center">
                <CursorBrandIcon className="text-white" size={32} />
              </div>
              <h3 className="text-white font-medium mb-1">Cursor</h3>
              <p className="text-neutral-500 text-sm">AI Code Editor</p>
              <span className="absolute bottom-4 left-1/2 -translate-x-1/2 text-xs text-neutral-600 opacity-0 group-hover:opacity-100 transition-opacity">
                Full-stack projects →
              </span>
            </Link>

            {/* Claude */}
            <Link
              href="/startup-ideas"
              className="animate-enter delay-300 group relative p-8 bg-gradient-to-br from-white/5 to-transparent border border-white/10 rounded-3xl hover:border-white/20 transition-all text-center"
            >
              <div className="w-16 h-16 mx-auto mb-4 bg-white/5 rounded-2xl flex items-center justify-center">
                <AnthropicBrandIcon className="text-[#D4A574]" size={32} />
              </div>
              <h3 className="text-white font-medium mb-1">Claude</h3>
              <p className="text-neutral-500 text-sm">AI Assistant</p>
              <span className="absolute bottom-4 left-1/2 -translate-x-1/2 text-xs text-neutral-600 opacity-0 group-hover:opacity-100 transition-opacity">
                Complex logic →
              </span>
            </Link>

            {/* Bolt.new */}
            <Link
              href="/startup-ideas"
              className="animate-enter delay-400 group relative p-8 bg-gradient-to-br from-white/5 to-transparent border border-white/10 rounded-3xl hover:border-white/20 transition-all text-center"
            >
              <div className="w-16 h-16 mx-auto mb-4 bg-white/5 rounded-2xl flex items-center justify-center">
                <Zap className="text-yellow-400" size={32} aria-hidden="true" />
              </div>
              <h3 className="text-white font-medium mb-1">Bolt.new</h3>
              <p className="text-neutral-500 text-sm">Instant Apps</p>
              <span className="absolute bottom-4 left-1/2 -translate-x-1/2 text-xs text-neutral-600 opacity-0 group-hover:opacity-100 transition-opacity">
                Quick MVPs →
              </span>
            </Link>

            {/* No-Code */}
            <Link
              href="/startup-ideas"
              className="animate-enter delay-500 group relative p-8 bg-gradient-to-br from-white/5 to-transparent border border-white/10 rounded-3xl hover:border-white/20 transition-all text-center"
            >
              <div className="w-16 h-16 mx-auto mb-4 bg-white/5 rounded-2xl flex items-center justify-center">
                <MousePointerClick
                  className="text-emerald-400"
                  size={32}
                  aria-hidden="true"
                />
              </div>
              <h3 className="text-white font-medium mb-1">No-Code</h3>
              <p className="text-neutral-500 text-sm">Visual Builders</p>
              <span className="absolute bottom-4 left-1/2 -translate-x-1/2 text-xs text-neutral-600 opacity-0 group-hover:opacity-100 transition-opacity">
                Non-technical →
              </span>
            </Link>
          </div>
        </div>
      </section>

      {/* Featured Ideas Section */}
      <section
        id="featured-ideas"
        className="relative z-10 py-24 border-t border-white/5 bg-[#050505]"
      >
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex items-center justify-between mb-12">
            <div>
              <h2 className="animate-enter text-3xl md:text-4xl font-medium text-white tracking-tight mb-2">
                Latest Startup Ideas
              </h2>
              <p className="animate-enter delay-100 text-neutral-400 font-light">
                Fresh ideas added weekly
              </p>
            </div>
            <Link
              href="/startup-ideas"
              className="animate-enter delay-100 hidden md:flex items-center gap-2 text-sm text-neutral-400 hover:text-white transition-colors"
            >
              View all <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Idea Card 1: AI Brake Inspection Analyser */}
            <Link
              href="/ideas/ai-brake-inspection-analyser"
              className="animate-enter delay-200 group p-6 bg-white/5 border border-white/10 rounded-2xl hover:border-white/20 transition-all"
            >
              <div className="flex items-center gap-2 mb-4">
                <span className="px-2 py-1 bg-purple-500/10 text-purple-400 text-[10px] font-bold uppercase rounded-full">
                  AI
                </span>
                <span className="text-neutral-600 text-xs">~12 hours</span>
              </div>
              <h3 className="text-white font-medium mb-2 group-hover:text-neutral-200 transition-colors">
                AI-Powered Brake Inspection Analyser
              </h3>
              <p className="text-neutral-500 text-sm line-clamp-2">
                Use AI to analyze brake pad photos and provide instant wear
                assessment and replacement recommendations.
              </p>
            </Link>

            {/* Idea Card 2: Mobile Brake Repair Marketplace */}
            <Link
              href="/ideas/mobile-brake-repair-marketplace"
              className="animate-enter delay-300 group p-6 bg-white/5 border border-white/10 rounded-2xl hover:border-white/20 transition-all"
            >
              <div className="flex items-center gap-2 mb-4">
                <span className="px-2 py-1 bg-cyan-500/10 text-cyan-400 text-[10px] font-bold uppercase rounded-full">
                  Marketplace
                </span>
                <span className="text-neutral-600 text-xs">~Weekend</span>
              </div>
              <h3 className="text-white font-medium mb-2 group-hover:text-neutral-200 transition-colors">
                Marketplace for Mobile Brake Repair
              </h3>
              <p className="text-neutral-500 text-sm line-clamp-2">
                Connect car owners with mobile mechanics who come to their
                location for brake repairs.
              </p>
            </Link>

            {/* Idea Card 3: AI Meeting Notes Cleaner */}
            <Link
              href="/ideas/ai-meeting-notes-cleaner"
              className="animate-enter delay-400 group p-6 bg-white/5 border border-white/10 rounded-2xl hover:border-white/20 transition-all"
            >
              <div className="flex items-center gap-2 mb-4">
                <span className="px-2 py-1 bg-blue-500/10 text-blue-400 text-[10px] font-bold uppercase rounded-full">
                  SaaS
                </span>
                <span className="text-neutral-600 text-xs">~12 hours</span>
              </div>
              <h3 className="text-white font-medium mb-2 group-hover:text-neutral-200 transition-colors">
                AI Meeting Notes Cleaner
              </h3>
              <p className="text-neutral-500 text-sm line-clamp-2">
                Transform messy meeting notes into structured action items,
                summaries, and follow-up tasks automatically.
              </p>
            </Link>
          </div>

          {/* Mobile View All Link */}
          <div className="mt-8 text-center md:hidden">
            <Link
              href="/startup-ideas"
              className="inline-flex items-center gap-2 text-sm text-neutral-400 hover:text-white transition-colors"
            >
              View all ideas <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section id="faq" className="py-32 border-t border-white/5">
        <div className="max-w-3xl mx-auto px-6">
          <h2 className="animate-enter text-3xl font-medium text-white mb-16 tracking-tight text-center">
            FAQ
          </h2>
          <div className="space-y-12">
            <div className="animate-enter delay-100 grid grid-cols-1 md:grid-cols-2 gap-12">
              <div>
                <h4 className="text-white font-medium mb-2 text-sm">
                  Is this really free?
                </h4>
                <p className="text-neutral-500 text-sm leading-relaxed">
                  Yep. Free. Just useful.
                </p>
              </div>
              <div>
                <h4 className="text-white font-medium mb-2 text-sm">
                  Do I need to be a developer?
                </h4>
                <p className="text-neutral-500 text-sm leading-relaxed">
                  No. The kit is built for non-technical builders using AI
                  tools.
                </p>
              </div>
              <div>
                <h4 className="text-white font-medium mb-2 text-sm">
                  What tools do I need?
                </h4>
                <p className="text-neutral-500 text-sm leading-relaxed">
                  Whatever you&rsquo;re comfortable with. The kit focuses on
                  workflow, not hype stacks.
                </p>
              </div>
              <div>
                <h4 className="text-white font-medium mb-2 text-sm">
                  What will I have by Sunday night?
                </h4>
                <p className="text-neutral-500 text-sm leading-relaxed">
                  A demo you can show, a waitlist to collect emails, and a
                  clear next step.
                </p>
              </div>
              <div>
                <h4 className="text-white font-medium mb-2 text-sm">
                  Will this help me pick an idea?
                </h4>
                <p className="text-neutral-500 text-sm leading-relaxed">
                  Yes. There&rsquo;s a scorecard and a short list of MVP ideas
                  that are easy to ship.
                </p>
              </div>
              <div>
                <h4 className="text-white font-medium mb-2 text-sm">
                  Can you help me build it?
                </h4>
                <p className="text-neutral-500 text-sm leading-relaxed">
                  Yes. After you get the kit, you&rsquo;ll have the option to
                  work with me 1:1 for a Weekend MVP Sprint.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA Section */}
      <section className="py-32 border-t border-white/5 bg-gradient-to-b from-[#050505] to-[#0A0A0A]">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className="animate-enter text-4xl md:text-5xl font-medium text-white tracking-tight mb-6">
            Ship something real this weekend.
          </h2>
          <p className="animate-enter delay-100 text-lg text-neutral-400 font-light mb-10 max-w-xl mx-auto">
            Get the Weekend MVP Starter Kit and turn your idea into a demo and
            a waitlist.
          </p>
          <div className="animate-enter delay-200">
            <SignupCta
              buttonLocation="final-cta"
              className="gradient-border-button px-10 py-4 bg-white/5 rounded-full text-white font-semibold tracking-tight hover:bg-white/10 transition-all text-sm shadow-2xl"
            >
              Get the Starter Kit
            </SignupCta>
          </div>
        </div>
      </section>
    </div>
  );
}
