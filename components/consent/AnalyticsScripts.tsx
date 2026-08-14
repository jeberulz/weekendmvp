"use client";

import Script from "next/script";
import { usePathname } from "next/navigation";

import { isSensitiveAuthPath } from "@/lib/auth-return";
import {
  CLAIM_PARAM,
  REDACTED_PREVIEW_PATH,
} from "@/lib/analytics-redaction";
import { isTenantHost } from "@/lib/tenant-host";
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
  const pathname = usePathname();

  if (consent !== true || isSensitiveAuthPath(pathname)) {
    return null;
  }

  // WP28-S3. Never load platform analytics on a published customer site.
  // Consent is origin-scoped, so a tenant host would almost certainly fail the
  // gate above anyway — but "almost certainly" is not a property worth
  // resting on when the consequence is attributing a customer's visitors to
  // our property. `consent === true` is only reachable after mount, so
  // `window` exists; the guard is explicit regardless.
  if (typeof window !== "undefined" && isTenantHost(window.location.host)) {
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
              (function () {
                var p = location.pathname.replace(
                  /\\/preview\\/[0-9a-f]{64}(?=$|[/?#])/, '${REDACTED_PREVIEW_PATH}');
                var q = new URLSearchParams(location.search);
                q.delete('${CLAIM_PARAM}');
                var s = q.toString();
                var path = p + (s ? '?' + s : '');
                gtag('config', '${GA_ID}', {
                  anonymize_ip: true,
                  page_path: path,
                  page_location: location.origin + path
                });
              })();
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
            // Meta's PageView sends the document location as \`dl\` and the
            // Pixel offers no way to override it, so the only way to keep a
            // capability token out of it is not to fire it on those URLs.
            // Losing one automatic PageView on a private preview costs
            // nothing; exporting a live capability to a vendor is not
            // recoverable.
            if (!/\\/preview\\/[0-9a-f]{64}(?=$|[/?#])/.test(location.pathname)
                && !new URLSearchParams(location.search).has('${CLAIM_PARAM}')) {
              fbq('track', 'PageView');
            }
          `}
        </Script>
      )}
    </>
  );
}
