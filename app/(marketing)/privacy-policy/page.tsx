import type { Metadata } from "next";

import { AuraBackground } from "@/components/marketing/AuraBackground";
import { NavExternalLink } from "@/components/primitives/NavExternalLink";

const DESCRIPTION =
  "Privacy Policy for Weekend MVP. Learn about how we handle cookies, analytics, and your data.";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: DESCRIPTION,
  authors: [{ name: "John Iseghohi" }],
  alternates: { canonical: "/privacy-policy" },
  openGraph: {
    type: "website",
    url: "/privacy-policy",
    title: "Privacy Policy | Weekend MVP",
    description: DESCRIPTION,
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
    title: "Privacy Policy | Weekend MVP",
    description: DESCRIPTION,
    images: ["/image/og-image.png"],
  },
};

/**
 * Ported from privacy-policy.html. The legacy page had no table of contents
 * or anchor ids; ids are added per section heading so deep links are possible
 * (e.g. /privacy-policy#email-collection).
 */
function SectionCard({
  id,
  heading,
  children,
}: {
  id: string;
  heading: string;
  children: React.ReactNode;
}) {
  return (
    <div id={id} className="bg-white/[0.02] border border-white/5 rounded-2xl p-8">
      <h2 className="text-white font-medium mb-3 text-lg">{heading}</h2>
      <p>{children}</p>
    </div>
  );
}

export default function PrivacyPolicyPage() {
  return (
    <div className="relative min-h-screen overflow-x-hidden pt-24 selection:bg-white/20 selection:text-white">
      <AuraBackground />

      {/* Background Grid */}
      <div className="fixed inset-0 pointer-events-none z-0 grid-lines" />

      {/* Top Glow */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-full max-w-3xl h-96 bg-white/5 blur-[120px] rounded-full pointer-events-none -z-10 mix-blend-screen" />

      {/* Privacy Policy Content */}
      <main className="relative z-10 max-w-4xl mx-auto px-6 py-32 mb-32">
        <div className="mb-12">
          <h1 className="text-4xl md:text-5xl font-medium text-white tracking-tight mb-4">
            Privacy Policy
          </h1>
          <p className="text-neutral-400 text-sm">Last updated: January 2025</p>
        </div>

        <div className="space-y-8 text-sm text-neutral-400 leading-relaxed">
          <SectionCard id="cookies-and-analytics" heading="Cookies and Analytics">
            We use Google Analytics to understand how visitors interact with
            our site. This helps us improve the user experience. Analytics
            cookies are only loaded after you provide explicit consent.
          </SectionCard>

          <SectionCard id="your-choices" heading="Your Choices">
            You can accept, reject, or customize your cookie preferences at any
            time using the cookie consent banner. Your preferences are saved in
            your browser&apos;s localStorage and will persist for 1 year.
          </SectionCard>

          <SectionCard id="data-collection" heading="Data Collection">
            When you consent to analytics, we collect anonymized usage data
            including page views, time on site, and interaction events. This
            data is processed by Google Analytics and is subject to
            Google&apos;s privacy policy.
          </SectionCard>

          <SectionCard id="email-collection" heading="Email Collection">
            When you sign up for the Weekend MVP Starter Kit, we collect your
            email address and first name through Beehiiv. This information is
            used solely to deliver the kit and occasional updates. You can
            unsubscribe at any time.
          </SectionCard>

          <SectionCard id="contact" heading="Contact">
            If you have questions about this privacy policy, please contact us
            at{" "}
            <NavExternalLink
              href="https://cal.com/switchtoux"
              className="text-neutral-300 hover:text-white underline underline-offset-2"
            >
              cal.com/switchtoux
            </NavExternalLink>
            .
          </SectionCard>
        </div>
      </main>
    </div>
  );
}
