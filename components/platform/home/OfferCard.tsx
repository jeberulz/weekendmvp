"use client";

import { useMutation, useQuery } from "convex/react";
import { ExternalLink, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { api } from "@/convex/_generated/api";
import { QuietErrorBoundary } from "@/components/platform/client-gates";
import { trackDashboardEvent } from "@/lib/track";
import { cn } from "@/lib/utils";
import { clearLegacyDismissal, useLegacyDismissed } from "./dismiss-state";

const EYEBROW = "font-mono text-[11px] font-normal uppercase tracking-[0.08em] text-home-ink-3";
const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-home-orange-ink";

function LiveOffer({ onDismissed }: { onDismissed: () => void }) {
  // Browser-only (behind the rail's Convex gate). Captured once, so the query
  // args stay stable for the page view; queries must not read the clock.
  const [now] = useState(() => Date.now());
  const offer = useQuery(api.platform.dashboard.offer, { now });
  const dismissOffer = useMutation(api.platform.preferences.dismissOffer);
  const [hidden, setHidden] = useState<string | null>(null);
  const legacy = useLegacyDismissed(offer?.id ?? null);
  const viewed = useRef<string | null>(null);

  // Closed in this browser before S12: move the dismissal to the member, once.
  useEffect(() => {
    if (!offer || !legacy) return;
    dismissOffer({ offerId: offer.id })
      .then(() => clearLegacyDismissal(offer.id))
      .catch((error: unknown) => console.error("Moving the offer dismissal failed", error));
  }, [offer, legacy, dismissOffer]);

  const shown = offer && !legacy && hidden !== offer.id ? offer : null;

  useEffect(() => {
    if (!shown || viewed.current === shown.id) return;
    viewed.current = shown.id;
    trackDashboardEvent({ name: "offer_viewed", props: { offer_id: shown.id, kind: shown.kind } });
  }, [shown]);

  if (!shown) return null;
  const props = { offer_id: shown.id, kind: shown.kind };
  const external = shown.cta.href.startsWith("https://");
  const kit = shown.kind === "starter_kit";

  function dismiss() {
    if (!shown) return;
    trackDashboardEvent({ name: "offer_dismissed", props });
    setHidden(shown.id);
    // The card is gone, so focus goes to the rail's first heading, not to <body>.
    onDismissed();
    dismissOffer({ offerId: shown.id }).catch((error: unknown) =>
      console.error("Dismissing the offer failed", error),
    );
  }

  const linkClass = cn(
    "inline-flex h-11 items-center justify-center gap-1.5 rounded-[9px] border border-home-rule bg-home-card px-4 text-sm font-medium text-home-ink transition-colors hover:border-home-ink-3",
    FOCUS,
  );

  return (
    <section
      aria-labelledby="rail-offer-heading"
      className={cn(
        "flex flex-col gap-2.5 rounded-[14px] p-4",
        kit ? "border border-dashed border-home-ink-3 bg-home-sunk" : "border border-home-rule bg-home-ochre",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <p className={cn(EYEBROW, !kit && "text-home-ochre-ink")}>{shown.eyebrow}</p>
        <button
          type="button"
          aria-label="Dismiss"
          title="Dismiss"
          onClick={dismiss}
          className={cn(
            "-my-3 -mr-3 flex size-11 shrink-0 items-center justify-center rounded-lg text-home-ink-2 transition-colors hover:bg-home-card hover:text-home-ink",
            FOCUS,
          )}
        >
          <X aria-hidden className="size-4" strokeWidth={1.8} />
        </button>
      </div>
      <h2 id="rail-offer-heading" className="font-editorial text-[21px] font-normal leading-[1.15] text-home-ink">
        {shown.title}
      </h2>
      {shown.items.length > 0 && (
        <ul className="flex list-disc flex-col gap-0.5 pl-[18px] text-[13px] text-home-ink-2">
          {shown.items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      )}
      <p
        className={cn(
          "text-[13px] leading-[1.5] text-home-ink-2",
          kit && "border-t border-dashed border-home-ink-3 pt-2",
        )}
      >
        {shown.body}
      </p>
      {external ? (
        <a
          href={shown.cta.href}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => trackDashboardEvent({ name: "offer_clicked", props })}
          className={linkClass}
        >
          {shown.cta.label}
          <ExternalLink aria-hidden className="size-3.5 shrink-0" />
          <span className="sr-only"> (opens in a new tab)</span>
        </a>
      ) : (
        <Link
          href={shown.cta.href}
          onClick={() => trackDashboardEvent({ name: "offer_clicked", props })}
          className={linkClass}
        >
          {shown.cta.label}
        </Link>
      )}
    </section>
  );
}

/**
 * The Home rail's one offer card (WP44-S12, PRD 6.2, R6 and R8), chosen on
 * the server. Nothing when there is no offer, and nothing if it fails: the
 * rest of the rail stays.
 */
export function OfferCard({ onDismissed }: { onDismissed: () => void }) {
  return (
    <QuietErrorBoundary>
      <LiveOffer onDismissed={onDismissed} />
    </QuietErrorBoundary>
  );
}
