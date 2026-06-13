import { Suspense } from "react";
import type { Metadata } from "next";

import { JsonLd } from "@/components/primitives/JsonLd";
import { SignupCta } from "@/components/marketing/SignupCta";
import { NavExternalLink } from "@/components/primitives/NavExternalLink";
import {
  breadcrumbSchema,
  buildGraph,
  howToSchema,
  personSchema,
} from "@/lib/seo";

import { StarterKitShell } from "./StarterKitShell";
import { SubscribedModal } from "./SubscribedModal";
import {
  KitHero,
  RulesSection,
  Step1Scorecard,
  Step2Spec,
  Step3Plan,
  Step4Ideas,
  Step5Prompts,
  TemplatesSection,
} from "./_sections";

const TITLE = "Weekend MVP Starter Kit | Build your product in 48 hours";
const DESCRIPTION =
  "The exact 48-hour plan, templates, and AI prompts to build and launch your weekend MVP. Created by John Iseghohi.";
const OG_DESCRIPTION =
  "Follow the exact 48-hour plan, templates, and AI prompts to build and launch your weekend MVP. Created by John Iseghohi.";

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  authors: [{ name: "John Iseghohi" }],
  alternates: { canonical: "/starter-kit" },
  openGraph: {
    type: "website",
    url: "https://www.weekendmvp.app/starter-kit",
    title: TITLE,
    description: OG_DESCRIPTION,
    images: [
      {
        url: "https://www.weekendmvp.app/image/og-image.png",
        alt: "Weekend MVP — ship your product in 48 hours",
        type: "image/png",
        width: 1200,
        height: 630,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: OG_DESCRIPTION,
    images: ["https://www.weekendmvp.app/image/og-image.png"],
  },
};

const STARTER_KIT_SCHEMA = buildGraph(
  personSchema(),
  breadcrumbSchema([
    { label: "Home", href: "https://www.weekendmvp.app/" },
    { label: "Starter Kit", href: "https://www.weekendmvp.app/starter-kit" },
  ]),
  {
    ...howToSchema({
      name: "Build a Weekend MVP in 48 Hours",
      description:
        "A step-by-step guide to picking an idea, building a 3-screen MVP, and launching a waitlist by Sunday night.",
      steps: [
        {
          name: "Friday Night: Strategy & Scope",
          text: "Pick the idea using the scorecard, write the one-page spec, draft landing page copy, and decide your tool stack.",
        },
        {
          name: "Saturday: Build Day",
          text: "Setup the project, build the core flow (input form, transformation logic, and output page), and deploy the landing page.",
        },
        {
          name: "Sunday: Distribution Day",
          text: "Create demo assets, reach out to 10 potential testers via DM, and post your build story on social media.",
        },
      ],
    }),
    creator: { "@id": "https://www.weekendmvp.app/#person" },
  },
);

export default function StarterKitPage() {
  return (
    <div className="bg-[#fcfaf7] text-[#1a1a1a] min-h-screen selection:bg-black/10 selection:text-black">
      <JsonLd schema={STARTER_KIT_SCHEMA} />

      <Suspense fallback={null}>
        <SubscribedModal />
      </Suspense>

      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <StarterKitShell>
          <KitHero />

          <div className="space-y-40">
            <RulesSection />
            <Step1Scorecard />
            <Step2Spec />
            <Step3Plan />
            <Step4Ideas />
            <Step5Prompts />
            <TemplatesSection />
          </div>

          {/* Final CTA */}
          <section className="mt-40 p-12 bg-black rounded-[3rem] text-center">
            <h2 className="text-3xl font-medium text-white mb-6">
              Ready to build your Weekend MVP?
            </h2>
            <p className="text-neutral-400 mb-10 max-w-sm mx-auto">
              Take the next step and book a 1:1 sprint to ship your project in
              48 hours.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 items-center justify-center">
              <NavExternalLink
                href="https://cal.com/switchtoux/mvp-sprint"
                className="inline-block px-10 py-4 bg-white text-black rounded-full font-semibold hover:bg-neutral-200 transition-all"
              >
                Book a Sprint
              </NavExternalLink>
              <SignupCta
                buttonLocation="starter-kit-final-cta"
                utmCampaign="starter-kit"
                className="inline-block px-10 py-4 bg-white/10 border border-white/20 text-white rounded-full font-semibold hover:bg-white/20 transition-all"
              >
                Get the Starter Kit
              </SignupCta>
            </div>
          </section>
        </StarterKitShell>
      </div>
    </div>
  );
}
