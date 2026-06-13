"use client";

import * as React from "react";
import Link from "next/link";

import { useConsent } from "./ConsentProvider";
import { ConsentCustomizeModal } from "./ConsentCustomizeModal";

/**
 * Bottom cookie-consent banner, ported from the legacy
 * `#cookie-consent-banner` markup in index.html. Shown only when consent is
 * undecided (`null`) after mount — SSR output never includes it, so there is
 * no flash for visitors who already decided.
 */
export function ConsentBanner() {
  const { consent, setConsent } = useConsent();
  const [mounted, setMounted] = React.useState(false);
  const [customizeOpen, setCustomizeOpen] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || consent !== null) {
    return null;
  }

  return (
    <>
      <div
        role="region"
        aria-label="Cookie consent"
        className="fixed bottom-0 left-0 right-0 z-[200] border-t border-white/10 bg-neutral-950/95 p-6 backdrop-blur-xl"
      >
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-6 md:flex-row md:items-center">
          <div className="flex-1">
            <h2 className="mb-2 text-sm font-medium text-white">
              We use cookies
            </h2>
            <p className="mb-2 text-xs leading-relaxed text-neutral-400">
              We use analytics to understand how you use our site. You can
              accept, reject, or customize your preferences.
            </p>
            <Link
              href="/privacy-policy"
              className="text-xs text-neutral-500 underline underline-offset-2 transition-colors hover:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-white/40 rounded"
            >
              Learn more in our Privacy Policy
            </Link>
          </div>
          <div className="flex w-full flex-col gap-3 sm:flex-row md:w-auto">
            <button
              type="button"
              onClick={() => setConsent(false)}
              className="rounded-xl border border-white/10 bg-white/5 px-6 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white/40"
            >
              Reject
            </button>
            <button
              type="button"
              onClick={() => setCustomizeOpen(true)}
              className="rounded-xl border border-white/10 bg-white/5 px-6 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white/40"
            >
              Customize
            </button>
            <button
              type="button"
              onClick={() => setConsent(true)}
              className="rounded-xl bg-white px-6 py-2.5 text-xs font-semibold text-black transition-colors hover:bg-neutral-200 focus:outline-none focus:ring-2 focus:ring-white/40 focus:ring-offset-2 focus:ring-offset-neutral-950"
            >
              Accept All
            </button>
          </div>
        </div>
      </div>

      <ConsentCustomizeModal
        open={customizeOpen}
        onOpenChange={setCustomizeOpen}
      />
    </>
  );
}
