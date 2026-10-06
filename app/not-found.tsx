import type { Metadata } from "next";

import { ButtonLink, Container, Em, Stamp } from "@/components/home/ui";
import { PublicShell } from "@/components/public/PublicShell";
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
 * group, so it brings its own chrome: the research-desk `PublicShell` (cream
 * nav, paper ground, warm-ink footer). The page's closing call is the email
 * capture below, so the shared band is off.
 */
export default function NotFound() {
  return (
    <PublicShell footerCta={false}>
      {/* 404 Hero */}
      <header className="relative overflow-hidden">
        <div
          aria-hidden
          className="home-dots absolute inset-0 opacity-60 [mask-image:linear-gradient(#000_50%,transparent)]"
        />
        <Container className="relative flex flex-col items-center gap-[22px] pb-14 pt-32 text-center md:pt-40 lg:pb-16">
          <Stamp id="nf-ring" text="NOT FOUND · ERROR 404 · NOT FOUND · " icon="search" />
          <p className="font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-home-orange-ink md:text-xs">
            <span className="sr-only">Error:</span>
            Error 404 — Page not found
          </p>
          <h1 className="font-editorial text-[46px] font-normal leading-none tracking-[-0.03em] text-balance text-home-ink md:text-[72px] lg:text-[88px]">
            This page <Em>didn&apos;t ship.</Em>
          </h1>

          <p className="max-w-[540px] text-pretty text-lg leading-[1.55] text-home-ink-2 md:text-xl">
            We couldn&apos;t find the page you were looking for. It may have
            been moved, renamed, or never made it past the weekend.
          </p>

          {/* Attempted URL (filled in client-side) */}
          <AttemptedPath />

          {/* Primary actions */}
          <div className="flex w-full flex-col items-center justify-center gap-3 pt-1.5 sm:w-auto sm:flex-row">
            <ButtonLink href="/" tone="primary" arrow={false} className="w-full sm:w-auto">
              Back to home
            </ButtonLink>
            <ButtonLink
              href="/startup-ideas"
              tone="secondary"
              arrow={false}
              className="w-full sm:w-auto"
            >
              Browse all ideas
            </ButtonLink>
          </div>
        </Container>
      </header>

      {/* Contextual recommendations */}
      <NotFoundRecommendations />

      {/* Email capture / conversion */}
      <section aria-labelledby="nf-kit" className="pb-20 lg:pb-28">
        <Container className="max-w-[760px] xl:px-0">
          <div className="rounded-2xl border border-home-rule bg-home-card p-7 text-center md:p-12">
            <h2
              id="nf-kit"
              className="mb-2 font-editorial text-[28px] font-normal leading-[1.1] tracking-[-0.02em] text-home-ink md:text-[34px]"
            >
              Don&apos;t leave <Em>empty-handed</Em>
            </h2>
            <p className="mx-auto mb-8 max-w-md text-[15px] leading-[1.55] text-home-ink-2">
              Get the free Weekend MVP Starter Kit plus a fresh build-ready
              idea in your inbox each week. No spam, unsubscribe anytime.
            </p>

            <KitSignup404 />

            <p className="mt-6 text-xs text-home-ink-3">
              By joining, you agree to receive the kit and occasional updates.
            </p>
          </div>
        </Container>
      </section>
    </PublicShell>
  );
}
