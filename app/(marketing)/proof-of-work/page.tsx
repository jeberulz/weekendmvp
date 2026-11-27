import { Suspense } from "react";
import type { Metadata } from "next";

import { JsonLd } from "@/components/primitives/JsonLd";
import { newsreaderEditorial } from "@/lib/fonts";
import {
  SITE,
  breadcrumbSchema,
  buildGraph,
  organizationSchema,
  PERSON_ID,
  personSchema,
} from "@/lib/seo";

import { ProofSubscribedModal } from "./ProofSubscribedModal";
import {
  ClosingCapture,
  ProofCapture,
  ProofFaq,
  ProofGateway,
  ProofHero,
  ProofHowItWorks,
  ProofNumbers,
  ProofParts,
  ProofStrip,
  ProofTactics,
} from "./_sections";

import styles from "./proof-of-work.module.css";

const TITLE =
  "Proof of Work: walk into your review with a year of proof already written | Weekend MVP";
const DESCRIPTION =
  "Proof of Work is a free single file for 9-to-5ers: a wins log, eight visibility habits, and three prompts that turn your year into your review story. Free in exchange for your email address. No account. Your wins stay on your machine.";

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  authors: [{ name: "John Iseghohi" }],
  alternates: { canonical: "/proof-of-work" },
  openGraph: {
    type: "website",
    url: `${SITE}/proof-of-work`,
    title: TITLE,
    description: DESCRIPTION,
    images: [
      {
        url: `${SITE}/image/og-image.png`,
        alt: "Weekend MVP — Proof of Work, a free tool for 9-to-5ers",
        type: "image/png",
        width: 1200,
        height: 630,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
    images: [`${SITE}/image/og-image.png`],
  },
};

const PROOF_OF_WORK_SCHEMA = buildGraph(
  personSchema(),
  organizationSchema(),
  breadcrumbSchema([
    { label: "Home", href: `${SITE}/` },
    { label: "Proof of Work", href: `${SITE}/proof-of-work` },
  ]),
  {
    "@type": "WebPage",
    "@id": `${SITE}/proof-of-work`,
    url: `${SITE}/proof-of-work`,
    name: "Proof of Work",
    description: DESCRIPTION,
    isPartOf: { "@id": `${SITE}/#website` },
    about: { "@id": PERSON_ID },
    author: { "@id": PERSON_ID },
  },
);

export default function ProofOfWorkPage() {
  return (
    <main
      id="proof-of-work-content"
      tabIndex={-1}
      className={`${newsreaderEditorial.variable} ${styles.page} min-h-screen bg-home-paper text-home-ink selection:bg-home-orange/18`}
    >
      <JsonLd schema={PROOF_OF_WORK_SCHEMA} />

      <Suspense fallback={null}>
        <ProofSubscribedModal />
      </Suspense>

      <ProofStrip />
      <ProofHero />
      <ProofGateway />
      <ProofCapture />
      <ProofHowItWorks />
      <ProofNumbers />
      <ProofTactics />
      <ProofParts />
      <ProofFaq />
      <ClosingCapture />
    </main>
  );
}
