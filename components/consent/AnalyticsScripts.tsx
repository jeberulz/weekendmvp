"use client";

import { useEffect } from "react";
import Script from "next/script";

import { trackValidationEvent } from "@/lib/track";
import { useConsent } from "./ConsentProvider";

const GA_ID = process.env.NEXT_PUBLIC_GA_ID;
const META_PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID;

/**
 * Consent-gated analytics loaders, replacing the legacy inline
 * `.analytics-snippet.html` (GA gtag.js + Meta Pixel bootstrap) injected
 * into every page head. Nothing is rendered — and therefore nothing is
 * requested from googletagmanager.com / connect.facebook.net — until the
 * visitor has explicitly consented (`consent === true`).
 *
 * The legacy noscript <img> Pixel fallback is intentionally omitted: it
 * cannot be consent-gated without JavaScript.
 */
export function AnalyticsScripts() {
  const { consent } = useConsent();

  useEffect(() => {
    if (consent !== true) return;

    const trackStarterKitClick = (event: MouseEvent) => {
      if (!(event.target instanceof Element)) return;
      const anchor = event.target.closest<HTMLAnchorElement>("a[href]");
      if (!anchor) return;

      const destination = new URL(anchor.href, window.location.href);
      if (
        destination.origin !== window.location.origin ||
        destination.pathname !== "/starter-kit"
      ) {
        return;
      }

      trackValidationEvent("starter_kit_clicked", {
        cta_id: anchor.dataset.ctaId ?? "starter-kit",
        source_surface: anchor.dataset.sourceSurface ?? "site_link",
      });
    };

    document.addEventListener("click", trackStarterKitClick);
    return () => document.removeEventListener("click", trackStarterKitClick);
  }, [consent]);

  if (consent !== true) {
    return null;
  }

  if (!GA_ID && !META_PIXEL_ID) {
    return null;
  }

  return (
    <>
      {GA_ID && (
        <>
          <Script
            strategy="afterInteractive"
            src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
          />
          <Script id="ga-init" strategy="afterInteractive">
            {`
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              window.gtag = gtag;
              gtag('js', new Date());
              gtag('config', '${GA_ID}', { anonymize_ip: true });
            `}
          </Script>
        </>
      )}

      {META_PIXEL_ID && (
        <Script id="meta-pixel-init" strategy="afterInteractive">
          {`
            !function(f,b,e,v,n,t,s)
            {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
            n.callMethod.apply(n,arguments):n.queue.push(arguments)};
            if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
            n.queue=[];t=b.createElement(e);t.async=!0;
            t.src=v;s=b.getElementsByTagName(e)[0];
            s.parentNode.insertBefore(t,s)}(window, document,'script',
            'https://connect.facebook.net/en_US/fbevents.js');
            fbq('init', '${META_PIXEL_ID}');
            fbq('track', 'PageView');
          `}
        </Script>
      )}
    </>
  );
}
