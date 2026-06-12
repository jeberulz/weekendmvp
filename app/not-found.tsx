import type { Metadata } from "next";
import Link from "next/link";
import { Home, Lightbulb, Mail } from "lucide-react";

import { MegaNav } from "@/components/layout/MegaNav";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { AuraBackground } from "@/components/marketing/AuraBackground";
import {
  AttemptedPath,
  KitSignup404,
  NotFoundRecommendations,
} from "./NotFoundContent";

const DESCRIPTION =
  "We couldn't find that page. Browse weekend-ready startup ideas, the build-with guides, and grab the free Weekend MVP Starter Kit.";
const SOCIAL_DESCRIPTION =
  "We couldn't find that page. Browse weekend-ready startup ideas and grab the free Starter Kit.";

export const metadata: Metadata = {
  title: "Page Not Found (404)",
  description: DESCRIPTION,
  authors: [{ name: "John Iseghohi" }],
  // Don't index error pages. No canonical: this page renders on arbitrary
  // unmatched URLs (the legacy 404.html canonical pointed at itself).
  robots: { index: false, follow: true },
  openGraph: {
    type: "website",
    title: "Page Not Found (404) | Weekend MVP",
    description: SOCIAL_DESCRIPTION,
    images: [
      {
        url: "/image/og-image.png",
        width: 1200,
        height: 630,
        alt: "Weekend MVP — ship your product in 48 hours",
        type: "image/png",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Page Not Found (404) | Weekend MVP",
    description: SOCIAL_DESCRIPTION,
    images: ["/image/og-image.png"],
  },
};

/**
 * App-wide 404, ported from 404.html. Lives outside the (marketing) route
 * group, so the marketing layout does not wrap it — MegaNav and SiteFooter
 * are rendered directly here to recreate the chrome.
 */
export default function NotFound() {
  return (
    <div className="relative min-h-screen overflow-x-hidden pt-24 selection:bg-white/20 selection:text-white">
      <AuraBackground />

      {/* Background Grid */}
      <div className="fixed inset-0 pointer-events-none z-0 grid-lines" />

      {/* Top Glow */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-full max-w-3xl h-96 bg-white/5 blur-[120px] rounded-full pointer-events-none -z-10 mix-blend-screen" />

      <MegaNav />

      <main className="relative z-10 mb-20">
        {/* 404 Hero */}
        <section className="max-w-4xl mx-auto px-6 pt-16 pb-12 text-center animate-enter">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 mb-8 bg-white/5 border border-white/10 rounded-full text-xs font-medium text-neutral-400">
            <span
              className="w-1.5 h-1.5 rounded-full bg-amber-400"
              aria-hidden="true"
            />
            <span className="sr-only">Error:</span>
            Error 404 — Page not found
          </div>

          <h1 className="text-6xl md:text-8xl font-medium tracking-tighter text-white mb-6">
            This page didn&apos;t
            <br className="hidden sm:block" /> ship.
          </h1>

          <p className="text-lg text-neutral-400 max-w-xl mx-auto mb-2">
            We couldn&apos;t find the page you were looking for. It may have
            been moved, renamed, or never made it past the weekend.
          </p>

          {/* Attempted URL (filled in client-side) */}
          <AttemptedPath />

          {/* Primary actions */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mt-8">
            <Link
              href="/"
              className="group inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-white text-black rounded-xl text-sm font-semibold tracking-tight hover:bg-neutral-200 transition-all w-full sm:w-auto"
            >
              <Home size={16} aria-hidden="true" />
              <span>Back to home</span>
            </Link>
            <Link
              href="/startup-ideas"
              className="group inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-white/5 border border-white/10 text-white rounded-xl text-sm font-semibold tracking-tight hover:bg-white/10 transition-all w-full sm:w-auto"
            >
              <Lightbulb size={16} aria-hidden="true" />
              <span>Browse all ideas</span>
            </Link>
          </div>
        </section>

        {/* Contextual recommendations */}
        <NotFoundRecommendations />

        {/* Email capture / conversion */}
        <section className="max-w-3xl mx-auto px-6 py-12">
          <div className="relative overflow-hidden bg-neutral-950/70 border border-white/10 rounded-3xl p-8 md:p-12">
            {/* Glow */}
            <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-96 h-48 bg-white/10 blur-[100px] rounded-full pointer-events-none" />

            <div className="relative text-center">
              <div className="inline-flex w-12 h-12 items-center justify-center bg-white/5 border border-white/10 rounded-2xl text-white mb-5">
                <Mail size={22} aria-hidden="true" />
              </div>
              <h2 className="text-2xl md:text-3xl font-medium tracking-tight text-white mb-2">
                Don&apos;t leave empty-handed
              </h2>
              <p className="text-neutral-400 text-sm max-w-md mx-auto mb-8">
                Get the free Weekend MVP Starter Kit plus a fresh build-ready
                idea in your inbox each week. No spam, unsubscribe anytime.
              </p>

              <KitSignup404 />

              <p className="text-[10px] text-neutral-600 mt-6">
                By joining, you agree to receive the kit and occasional
                updates.
              </p>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
