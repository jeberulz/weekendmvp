"use client";

import * as React from "react";
import Link from "next/link";

import { newsreaderEditorial } from "@/lib/fonts";
import { isTenantHost } from "@/lib/tenant-host";
import { cn } from "@/lib/utils";
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

  // WP28-S3. The root layout wraps every route, including a published
  // customer site on its own host, so this banner would otherwise appear on a
  // page that is not ours — our cookie notice, our privacy link, under their
  // domain. Checked after mount, alongside the existing consent gate, so it
  // costs no server dynamism and cannot cause a hydration mismatch.
  if (!mounted || consent !== null || isTenantHost(window.location.host)) {
    return null;
  }

  return (
    <>
      <div
        role="region"
        aria-label="Cookie consent"
        className={cn(
          newsreaderEditorial.variable,
          "fixed inset-x-0 bottom-0 z-[200] p-3 font-sans sm:p-4",
        )}
      >
        <div className="mx-auto flex max-w-[1200px] flex-col items-start justify-between gap-5 rounded-2xl border border-home-ink bg-home-card p-5 text-home-ink md:flex-row md:items-center md:gap-8 md:p-6">
          <div className="flex-1">
            <h2 className="mb-1.5 font-editorial text-[22px] font-normal leading-tight text-home-ink">
              We use cookies
            </h2>
            <p className="mb-2 max-w-[640px] text-sm leading-[1.55] text-home-ink-2">
              We use analytics to understand how you use our site. You can
              accept, reject, or customize your preferences.
            </p>
            <Link
              href="/privacy-policy"
              className="rounded text-sm font-medium text-home-orange-ink underline underline-offset-4 transition-colors hover:text-home-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-home-orange-ink"
            >
              Learn more in our Privacy Policy
            </Link>
          </div>
          <div className="flex w-full flex-col gap-2.5 sm:flex-row md:w-auto">
            <button
              type="button"
              onClick={() => setConsent(false)}
              className="inline-flex h-11 items-center justify-center rounded-full border border-home-ink px-5 text-sm font-semibold text-home-ink transition-colors hover:bg-home-ink hover:text-home-paper focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-home-orange-ink"
            >
              Reject
            </button>
            <button
              type="button"
              onClick={() => setCustomizeOpen(true)}
              className="inline-flex h-11 items-center justify-center rounded-full px-5 text-sm font-semibold text-home-ink underline-offset-4 transition-colors hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-home-orange-ink"
            >
              Customize
            </button>
            <button
              type="button"
              onClick={() => setConsent(true)}
              className="inline-flex h-11 items-center justify-center rounded-full bg-home-ink px-5 text-sm font-semibold text-home-paper transition-colors hover:bg-home-ink-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-home-orange-ink"
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
