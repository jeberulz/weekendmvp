import type { Metadata } from "next";
import Script from "next/script";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { ConvexClientProvider } from "./ConvexClientProvider";
import { ConsentProvider } from "@/components/consent/ConsentProvider";
import { ConsentBanner } from "@/components/consent/ConsentBanner";
import { AnalyticsScripts } from "@/components/consent/AnalyticsScripts";
import { Toaster } from "@/components/ui/sonner";
import { SITE } from "@/lib/seo";
import "./globals.css";

/** Lovable Impact.com affiliate partner snippet — CDN path embeds partner id. */
const LOVABLE_IMPACT_SNIPPET = `(function(i,m,p,a,c,t){c.ire_o=p;c[p]=c[p]||function(){(c[p].a=c[p].a||[]).push(arguments)};t=a.createElement(m);var z=a.getElementsByTagName(m)[0];t.async=1;t.src=i;z.parentNode.insertBefore(t,z)})('https://utt.impactcdn.com/P-A7921807-ff0f-4b2a-a6c1-70a46e3fc5021.js','script','impactStat',document,window);impactStat('transformLinks');impactStat('trackImpression');`;

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  icons: { icon: "/image/favicon.png" },
  title: {
    default: "Weekend MVP — Validate & Build Your Startup Idea in a Weekend",
    template: "%s | Weekend MVP",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${GeistSans.variable} ${GeistMono.variable}`}
    >
      <head>
        {/* Lovable Impact affiliate — sitewide head; transformLinks rewrites Lovable URLs */}
        <Script id="lovable-impact" strategy="beforeInteractive">
          {LOVABLE_IMPACT_SNIPPET}
        </Script>
      </head>
      <body className="font-sans antialiased">
        <ConvexClientProvider>
          <ConsentProvider>
            {children}
            <ConsentBanner />
            <AnalyticsScripts />
          </ConsentProvider>
        </ConvexClientProvider>
        <Toaster />
      </body>
    </html>
  );
}
