"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CircleCheck } from "lucide-react";

import { BeehiivSubscribeForm } from "@/components/forms/BeehiivSubscribeForm";
import { Icon } from "@/components/home/icons";
import { Container } from "@/components/home/ui";
import { SignupCta } from "@/components/marketing/SignupCta";
import { trackEvent } from "@/lib/track";

import {
  CONTEXTS,
  DEFAULT_CTX,
  pickContextKey,
  type RecoContext,
} from "./_not-found-data";

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
    <p className="font-mono text-xs uppercase tracking-[0.06em] text-home-ink-3">
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
    <section aria-labelledby="nf-reco" className="pb-16 pt-6 lg:pb-20">
      <Container className="flex flex-col gap-[18px]">
        <div className="flex flex-col gap-3">
          <p className="font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-home-orange-ink md:text-xs">
            {ctx.eyebrow}
          </p>
          <div className="flex flex-wrap items-baseline justify-between gap-x-8 gap-y-2">
            <h2
              id="nf-reco"
              className="font-editorial text-[28px] font-normal leading-[1.1] tracking-[-0.02em] text-balance text-home-ink md:text-[32px]"
            >
              {ctx.heading}
            </h2>
            <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-home-ink-3 md:text-xs">
              {ctx.sub}
            </p>
          </div>
        </div>

        <ul className="grid grid-cols-1 gap-x-10 md:grid-cols-2 lg:grid-cols-3">
          {ctx.cards.map((c) => (
            <li key={c.href} className="border-t border-home-ink">
              <Link
                href={c.href}
                className="group flex flex-col gap-1.5 py-5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-home-orange-ink"
                data-404-reco={c.title}
              >
                <span className="flex items-center justify-between gap-4 font-editorial text-[24px] leading-[1.15] text-home-ink md:text-[26px]">
                  {c.title}
                  <Icon
                    name="arrow"
                    size={20}
                    strokeWidth={1.75}
                    className="transition-transform duration-200 ease-[cubic-bezier(0.25,1,0.5,1)] group-hover:translate-x-0.5 motion-reduce:transition-none"
                  />
                </span>
                <span className="text-[15px] leading-[1.5] text-home-ink-2">
                  {c.desc}
                </span>
                <span className="text-sm font-medium text-home-orange-ink underline underline-offset-4">
                  {c.cta}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}

/**
 * Inline email capture, replacing the legacy `kit-form-404` script. Submission
 * goes through BeehiivSubscribeForm (API + embed fallback); on success the
 * form swaps for the legacy inline success state instead of redirecting.
 *
 * Renders a small <SignupCta> below the inline form so the modal-based signup
 * path is reachable from the 404 (R10 wiring — counts toward the SignupCta
 * import sweep).
 */
export function KitSignup404() {
  const [subscribed, setSubscribed] = useState(false);

  if (subscribed) {
    return (
      <div className="flex flex-col items-center pt-2 text-center">
        <CircleCheck
          size={32}
          strokeWidth={1.5}
          aria-hidden="true"
          className="mb-3 text-home-sage-ink"
        />
        <h3 className="mb-1 font-editorial text-2xl font-normal text-home-ink">
          Check your inbox!
        </h3>
        <p className="text-[15px] text-home-ink-2">
          The Weekend MVP Starter Kit is on its way.
        </p>
      </div>
    );
  }

  return (
    <>
      <BeehiivSubscribeForm
        showFirstName={false}
        utmCampaign="404-page"
        successHref={null}
        onSuccess={() => setSubscribed(true)}
        submitLabel="Send me the kit"
        className="mx-auto flex max-w-md flex-col items-stretch gap-3 space-y-0 sm:flex-row [&>div]:flex-1"
        inputClassName="h-[52px] border-home-ink-3 bg-home-paper px-5 py-0 text-base text-home-ink placeholder:text-home-ink-3 focus:ring-home-orange-ink"
        buttonClassName="h-[52px] w-full whitespace-nowrap bg-home-orange-ink px-6 py-0 text-base text-white hover:bg-[#8f3f00] focus:ring-home-orange-ink focus:ring-offset-2 focus:ring-offset-home-card sm:w-auto motion-reduce:transition-none"
      />
      <SignupCta
        buttonLocation="404-signup-card"
        utmCampaign="404-page"
        className="mt-4 inline-flex min-h-11 items-center justify-center text-sm text-home-ink-3 underline underline-offset-4 transition-colors hover:text-home-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-home-orange-ink motion-reduce:transition-none"
      >
        Prefer the quick popup signup?
      </SignupCta>
    </>
  );
}
