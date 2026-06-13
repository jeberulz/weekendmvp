"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowRight, CircleCheck } from "lucide-react";

import { BeehiivSubscribeForm } from "@/components/forms/BeehiivSubscribeForm";
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
 *
 * Renders a small <SignupCta> below the inline form so the modal-based signup
 * path is reachable from the 404 (R10 wiring — counts toward the SignupCta
 * import sweep).
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
    <>
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
      <SignupCta
        buttonLocation="404-signup-card"
        utmCampaign="404-page"
        className="mt-4 inline-flex items-center justify-center text-xs text-neutral-500 hover:text-white transition-colors underline decoration-neutral-700 underline-offset-4"
      >
        Prefer the quick popup signup?
      </SignupCta>
    </>
  );
}
