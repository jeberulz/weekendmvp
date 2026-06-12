import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { ConvexClientProvider } from "./ConvexClientProvider";
import { ConsentProvider } from "@/components/consent/ConsentProvider";
import { ConsentBanner } from "@/components/consent/ConsentBanner";
import { AnalyticsScripts } from "@/components/consent/AnalyticsScripts";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_BASE_URL ?? "https://weekendmvp.app",
  ),
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
