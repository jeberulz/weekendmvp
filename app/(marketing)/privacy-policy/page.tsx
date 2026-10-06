import type { Metadata } from "next";

import { Container } from "@/components/home/ui";
import { NavExternalLink } from "@/components/primitives/NavExternalLink";
import { PageHeader } from "@/components/public/PageHeader";
import { newsreaderEditorial } from "@/lib/fonts";
import { cn } from "@/lib/utils";

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
function SectionRow({
  id,
  heading,
  children,
}: {
  id: string;
  heading: string;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-heading`}
      className="grid scroll-mt-28 grid-cols-1 gap-4 border-t border-home-rule py-8 lg:grid-cols-[260px_minmax(0,1fr)] lg:gap-12"
    >
      <h2
        id={`${id}-heading`}
        className="font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-home-ink-3 md:text-xs"
      >
        {heading}
      </h2>
      <p className="max-w-[680px] text-base leading-[1.65] text-home-ink-2">
        {children}
      </p>
    </section>
  );
}

export default function PrivacyPolicyPage() {
  return (
    <div
      className={cn(
        newsreaderEditorial.variable,
        "theme-desk relative min-h-screen overflow-x-clip bg-home-paper font-sans text-home-ink selection:bg-home-orange-light/40",
      )}
    >
      <main id="main">
        <PageHeader
          title="Privacy Policy"
          meta={["Last updated: January 2025"]}
          size="md"
          className="pb-10 lg:pb-12"
        />

        <Container className="pb-20 lg:pb-28">
          <SectionRow id="cookies-and-analytics" heading="Cookies and Analytics">
            We use Google Analytics to understand how visitors interact with
            our site. This helps us improve the user experience. Analytics
            cookies are only loaded after you provide explicit consent.
          </SectionRow>

          <SectionRow id="your-choices" heading="Your Choices">
            You can accept, reject, or customize your cookie preferences at any
            time using the cookie consent banner. Your preferences are saved in
            your browser&apos;s localStorage and will persist for 1 year.
          </SectionRow>

          <SectionRow id="data-collection" heading="Data Collection">
            When you consent to analytics, we collect anonymized usage data
            including page views, time on site, and interaction events. This
            data is processed by Google Analytics and is subject to
            Google&apos;s privacy policy.
          </SectionRow>

          <SectionRow id="email-collection" heading="Email Collection">
            When you sign up for the Weekend MVP Starter Kit, we collect your
            email address and first name through Beehiiv. This information is
            used solely to deliver the kit and occasional updates. You can
            unsubscribe at any time.
          </SectionRow>

          <SectionRow id="contact" heading="Contact">
            If you have questions about this privacy policy, please contact us
            at{" "}
            <NavExternalLink
              href="https://cal.com/switchtoux"
              className="text-home-orange-ink underline underline-offset-4 transition-colors hover:text-home-ink focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-home-orange-ink motion-reduce:transition-none"
            >
              cal.com/switchtoux
            </NavExternalLink>
            .
          </SectionRow>
        </Container>
      </main>
    </div>
  );
}
