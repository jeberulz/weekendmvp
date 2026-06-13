import type { Metadata } from "next";
import Link from "next/link";

import { IdeaCard } from "@/components/primitives/IdeaCard";
import { ArrowRight } from "lucide-react";

import { BeehiivSubscribeForm } from "@/components/forms/BeehiivSubscribeForm";
import { AuraBackground } from "@/components/marketing/AuraBackground";
import {
  AUDIENCE_COLUMNS,
  CATEGORIES,
  FAQS,
  FEATURED_IDEAS,
  FEATURES,
  PROCESS_STEPS,
  TOOLS,
} from "@/components/marketing/home-data";
import { HomeBackground } from "@/components/marketing/HomeBackground";
import { MotionEffects } from "@/components/marketing/MotionEffects";
import { HomeBento } from "@/components/marketing/sections/HomeBento";
import { SignupCta } from "@/components/marketing/SignupCta";
import { JsonLd } from "@/components/primitives/JsonLd";
import {
  buildGraph,
  faqPageSchema,
  personSchema,
  softwareApplicationSchema,
  websiteSchema,
} from "@/lib/seo";

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
    url: "https://www.weekendmvp.app/",
    title: TITLE,
    description: OG_DESCRIPTION,
    images: [
      {
        url: "https://www.weekendmvp.app/image/og-image.png",
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
    images: ["https://www.weekendmvp.app/image/og-image.png"],
  },
  verification: {
    google: "google-site-verification=HCdXKcfa0MioAEpD-uVIkfFOjcb3CodPcmdc7yxAuRM",
  },
};

export default function HomePage() {
  return (
    <div className="relative min-h-screen overflow-x-hidden selection:bg-white/20 selection:text-white pt-24">
      <JsonLd
        schema={buildGraph(
          personSchema(),
          websiteSchema(),
          softwareApplicationSchema({
            name: "Weekend MVP Starter Kit",
            applicationCategory: "DeveloperApplication",
            description: "The exact checklist, templates, and prompts to build a 3-screen MVP and launch a waitlist in 48 hours.",
            offers: { price: "0", priceCurrency: "USD" },
          }),
          faqPageSchema(FAQS),
        )}
      />
      <MotionEffects
        effects={["reveal", "flashlight", "smooth-anchor", "section-view", "scroll-depth"]}
        trackedSections={["what-you-get", "process", "faq"]}
      />
      <AuraBackground />
      <HomeBackground />

      {/* Hero */}
      <main className="relative z-10 max-w-7xl mx-auto px-6 pt-20 pb-32">
        <div className="text-center max-w-4xl mx-auto mb-24 relative z-10">
          <div className="animate-enter inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-neutral-400 text-xs font-medium mb-8">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]" aria-hidden="true"></span>
            <span className="sr-only">Available now:</span>
            Weekend MVP Starter Kit
          </div>
          <h1 className="animate-enter delay-100 text-5xl md:text-7xl lg:text-8xl font-medium text-white tracking-tighter leading-[1.1] mb-8">
            Ship a weekend MVP,
            <br className="hidden md:block" />
            <span className="text-gray-50">even if you&rsquo;re non-technical.</span>
          </h1>
          <p className="animate-enter delay-200 text-lg md:text-xl text-neutral-400 font-light tracking-tight max-w-2xl mx-auto leading-relaxed mb-10">
            Get the exact checklist, templates, and prompts to build a 3-screen MVP and launch a waitlist by Sunday night.
          </p>
          <div className="animate-enter delay-300 flex flex-col items-center gap-4">
            <div id="beehiiv-form-container" className="w-full max-w-sm">
              <BeehiivSubscribeForm showFirstName={false} submitLabel="Get the Starter Kit" className="space-y-3" buttonClassName="px-8 py-4 tracking-tight shadow-[0_0_40px_-10px_rgba(255,255,255,0.3)]" />
            </div>
            <p className="text-xs text-neutral-600 font-medium tracking-wide uppercase">Free. Practical. Built for shipping.</p>
          </div>
        </div>
        <HomeBento />
      </main>

      {/* What you get */}
      <section id="what-you-get" className="border-t border-white/5 bg-[#050505] relative py-32">
        <div className="max-w-7xl mx-auto px-6">
          <div className="mb-16 md:mb-24 max-w-2xl">
            <h2 className="animate-enter text-3xl md:text-5xl font-medium text-white tracking-tight mb-6">Everything inside the kit</h2>
            <p className="animate-enter delay-100 text-lg text-neutral-400 font-light">No massive scope. No tool overwhelm. Just a clear plan that gets you to &quot;live link + waitlist&quot;.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {FEATURES.map((f, i) => (
              <div key={f.title} className={`animate-enter ${i < 3 ? "delay-200" : "delay-300"} group p-6 rounded-2xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.04] transition-colors`}>
                <div className="w-10 h-10 rounded-lg bg-neutral-900 border border-white/10 flex items-center justify-center mb-4 text-white">{f.icon}</div>
                <h3 className="text-white font-medium mb-2">{f.title}</h3>
                <p className="text-sm text-neutral-500 leading-relaxed">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="process" className="relative py-32 bg-[#050505] border-t border-white/5 overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-white/[0.02] rounded-full blur-[100px] pointer-events-none"></div>
        <div className="max-w-7xl mx-auto px-6 relative z-10">
          <div className="text-center mb-24">
            <h2 className="animate-enter text-3xl md:text-5xl font-medium text-white tracking-tight mb-4">How it works</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12 relative">
            <div className="hidden md:block absolute top-12 left-[16%] right-[16%] h-px bg-gradient-to-r from-transparent via-white/10 to-transparent"></div>
            {PROCESS_STEPS.map((step, i) => (
              <div key={step.title} className={`animate-enter delay-${(i + 1) * 100} relative flex flex-col items-center text-center`}>
                <div className="w-24 h-24 rounded-full bg-[#0A0A0A] border border-white/10 flex items-center justify-center mb-8 relative z-10 shadow-[0_0_20px_rgba(0,0,0,0.5)]">
                  <span className="text-2xl font-bold text-white">{i + 1}</span>
                </div>
                <h3 className="text-lg font-semibold text-white mb-3">{step.title}</h3>
                <p className="text-sm text-neutral-500 max-w-xs leading-relaxed">{step.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Who it's for */}
      <section className="py-24 border-t border-white/5 bg-[#080808]">
        <div className="max-w-5xl mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
            {AUDIENCE_COLUMNS.map((col) => (
              <div key={col.heading} className={`animate-enter ${col.delay}`}>
                <h3 className="text-xl font-medium text-white mb-8 flex items-center gap-3">
                  {col.headIcon}
                  {col.heading}
                </h3>
                <ul className="space-y-4">
                  {col.items.map((item) => (
                    <li key={item} className="flex items-start gap-3 text-sm text-neutral-400">
                      {col.rowIcon}
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Browse by category */}
      <section id="browse-categories" className="relative z-10 py-24 border-t border-white/5 bg-[#050505]">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="animate-enter text-3xl md:text-4xl font-medium text-white tracking-tight mb-4">Browse Startup Ideas by Category</h2>
            <p className="animate-enter delay-100 text-neutral-400 text-lg max-w-2xl mx-auto font-light">Research-backed ideas organized by industry. Each includes AI prompts, market validation, and a build guide.</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {CATEGORIES.map((c) => (
              <Link key={c.label} href={c.href} className={`animate-enter ${c.delay} group p-6 bg-white/5 border border-white/10 rounded-2xl hover:bg-white/10 hover:border-white/20 transition-all`}>
                <div className="flex items-center gap-3 mb-3">
                  <div className={`w-10 h-10 ${c.iconBg} rounded-xl flex items-center justify-center`}>{c.icon}</div>
                  <span className="text-white font-medium">{c.label}</span>
                </div>
                <p className="text-neutral-500 text-sm">{c.tagline}</p>
              </Link>
            ))}
            <Link href="/startup-ideas" className="animate-enter delay-500 group p-6 bg-gradient-to-br from-white/5 to-transparent border border-white/10 rounded-2xl hover:border-white/20 transition-all flex flex-col justify-center items-center text-center">
              <ArrowRight className="text-neutral-400 group-hover:text-white transition-colors mb-2" size={24} aria-hidden="true" />
              <span className="text-neutral-400 group-hover:text-white font-medium text-sm transition-colors">View All Ideas</span>
            </Link>
          </div>
        </div>
      </section>

      {/* Build with tools */}
      <section id="build-with-tools" className="relative z-10 py-24 border-t border-white/5 bg-[#080808]">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="animate-enter text-3xl md:text-4xl font-medium text-white tracking-tight mb-4">Build With Your Favorite AI Tools</h2>
            <p className="animate-enter delay-100 text-neutral-400 text-lg max-w-2xl mx-auto font-light">Find ideas optimized for your preferred development environment.</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {TOOLS.map((tool) => (
              <Link key={tool.label} href={tool.href} className={`animate-enter ${tool.delay} group relative p-8 bg-gradient-to-br from-white/5 to-transparent border border-white/10 rounded-3xl hover:border-white/20 transition-all text-center`}>
                <div className="w-16 h-16 mx-auto mb-4 bg-white/5 rounded-2xl flex items-center justify-center">{tool.icon}</div>
                <h3 className="text-white font-medium mb-1">{tool.label}</h3>
                <p className="text-neutral-500 text-sm">{tool.tagline}</p>
                <span className="absolute bottom-4 left-1/2 -translate-x-1/2 text-xs text-neutral-600 opacity-0 group-hover:opacity-100 transition-opacity">{tool.hoverHint}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Featured ideas */}
      <section id="featured-ideas" className="relative z-10 py-24 border-t border-white/5 bg-[#050505]">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex items-center justify-between mb-12">
            <div>
              <h2 className="animate-enter text-3xl md:text-4xl font-medium text-white tracking-tight mb-2">Latest Startup Ideas</h2>
              <p className="animate-enter delay-100 text-neutral-400 font-light">Fresh ideas added weekly</p>
            </div>
            <Link href="/startup-ideas" className="animate-enter delay-100 hidden md:flex items-center gap-2 text-sm text-neutral-400 hover:text-white transition-colors">
              View all <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {FEATURED_IDEAS.map((idea) => (
              <IdeaCard
                key={idea.slug}
                surface="translucent"
                className={`animate-enter ${idea.delay}`}
                idea={{
                  slug: idea.slug,
                  title: idea.title,
                  description: idea.description,
                  categoryLabel: idea.categoryLabel,
                  buildTimeLabel: idea.buildTime,
                  badgeClass: `${idea.badgeClass} rounded-full`,
                }}
              />
            ))}
          </div>
          <div className="mt-8 text-center md:hidden">
            <Link href="/startup-ideas" className="inline-flex items-center gap-2 text-sm text-neutral-400 hover:text-white transition-colors">
              View all ideas <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="py-32 border-t border-white/5">
        <div className="max-w-3xl mx-auto px-6">
          <h2 className="animate-enter text-3xl font-medium text-white mb-16 tracking-tight text-center">FAQ</h2>
          <div className="space-y-12">
            <div className="animate-enter delay-100 grid grid-cols-1 md:grid-cols-2 gap-12">
              {FAQS.map((item) => (
                <div key={item.question}>
                  <h4 className="text-white font-medium mb-2 text-sm">{item.question}</h4>
                  <p className="text-neutral-500 text-sm leading-relaxed">{item.answer}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-32 border-t border-white/5 bg-gradient-to-b from-[#050505] to-[#0A0A0A]">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className="animate-enter text-4xl md:text-5xl font-medium text-white tracking-tight mb-6">Ship something real this weekend.</h2>
          <p className="animate-enter delay-100 text-lg text-neutral-400 font-light mb-10 max-w-xl mx-auto">Get the Weekend MVP Starter Kit and turn your idea into a demo and a waitlist.</p>
          <div className="animate-enter delay-200">
            <SignupCta buttonLocation="final-cta" className="gradient-border-button px-10 py-4 bg-white/5 rounded-full text-white font-semibold tracking-tight hover:bg-white/10 transition-all text-sm shadow-2xl">
              Get the Starter Kit
            </SignupCta>
          </div>
        </div>
      </section>
    </div>
  );
}
