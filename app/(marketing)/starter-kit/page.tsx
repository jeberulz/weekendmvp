import { Suspense } from "react";
import type { Metadata } from "next";

import { readStarterKit, type StarterKit } from "@/lib/landing/read-starter-kit";
import { JsonLd } from "@/components/primitives/JsonLd";
import { SignupCta } from "@/components/marketing/SignupCta";
import { NavExternalLink } from "@/components/primitives/NavExternalLink";
import {
  SITE,
  breadcrumbSchema,
  buildGraph,
  howToSchema,
  organizationSchema,
  PERSON_ID,
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

async function loadStarterKit() {
  "use cache";
  return readStarterKit();
}

export async function generateMetadata(): Promise<Metadata> {
  const { seoTitle, seoDescription, socialDescription } = await loadStarterKit();
  return {
    title: { absolute: seoTitle },
    description: seoDescription,
    authors: [{ name: "John Iseghohi" }],
    alternates: { canonical: "/starter-kit" },
    openGraph: {
      type: "website",
      url: `${SITE}/starter-kit`,
      title: seoTitle,
      description: socialDescription,
      images: [
        {
          url: `${SITE}/image/og-image.png`,
          alt: "Weekend MVP — ship your product in 48 hours",
          type: "image/png",
          width: 1200,
          height: 630,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: seoTitle,
      description: socialDescription,
      images: [`${SITE}/image/og-image.png`],
    },
  };
}

const STARTER_KIT_SCHEMA = buildGraph(
  personSchema(),
  organizationSchema(),
  breadcrumbSchema([
    { label: "Home", href: `${SITE}/` },
    { label: "Starter Kit", href: `${SITE}/starter-kit` },
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
    creator: { "@id": PERSON_ID },
  },
);

function renderResource(resource: StarterKit["resources"][number]) {
  switch (resource.discriminant) {
    case "ideas": return <Step4Ideas key={resource.discriminant} resource={resource} />;
    case "prompts": return <Step5Prompts key={resource.discriminant} resource={resource} />;
    case "templates": return <TemplatesSection key={resource.discriminant} resource={resource} />;
  }
}

export default async function StarterKitPage() {
  const { hero, rules, scorecard, spec, plan, resources, finalCta, contents } = await loadStarterKit();
  return (
    <div className="bg-[#fcfaf7] text-[#1a1a1a] min-h-screen selection:bg-black/10 selection:text-black">
      <JsonLd schema={STARTER_KIT_SCHEMA} />

      <Suspense fallback={null}>
        <SubscribedModal />
      </Suspense>

      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <StarterKitShell contents={contents}>
          <KitHero copy={hero} />

          <div className="space-y-40">
            <RulesSection copy={rules} />
            <Step1Scorecard copy={scorecard} />
            <Step2Spec copy={spec} />
            <Step3Plan copy={plan} />
            {resources.map(renderResource)}
          </div>

          {/* Final CTA */}
          <section className="mt-40 p-12 bg-black rounded-[3rem] text-center">
            <h2 className="text-3xl font-medium text-white mb-6">
              {finalCta.heading}
            </h2>
            <p className="text-neutral-400 mb-10 max-w-sm mx-auto">
              {finalCta.body}
            </p>
            <div className="flex flex-col sm:flex-row gap-3 items-center justify-center">
              <NavExternalLink
                href="https://cal.com/switchtoux/mvp-sprint"
                className="inline-block px-10 py-4 bg-white text-black rounded-full font-semibold hover:bg-neutral-200 transition-all"
              >
                {finalCta.bookLabel}
              </NavExternalLink>
              <SignupCta
                buttonLocation="starter-kit-final-cta"
                utmCampaign="starter-kit"
                className="inline-block px-10 py-4 bg-white/10 border border-white/20 text-white rounded-full font-semibold hover:bg-white/20 transition-all"
              >
                {finalCta.signupLabel}
              </SignupCta>
            </div>
          </section>
        </StarterKitShell>
      </div>
    </div>
  );
}
