import type { Metadata } from "next";
import { Container, Em } from "@/components/home/ui";
import { Breadcrumbs } from "@/components/public/PageHeader";
import { WhenConvexReady } from "@/components/platform/client-gates";
import { IdeaRequestPanel } from "@/components/idea-requests/IdeaRequestPanel";
import { SITE } from "@/lib/seo";

export const metadata: Metadata = {
  title: { absolute: "Request a Startup Idea | Weekend MVP" },
  description:
    "Request the startup idea you want researched next, and vote for the requests you want us to build. The most-voted requests feed the Weekend MVP research queue.",
  alternates: { canonical: "/ideas/requests" },
  openGraph: {
    type: "website",
    url: `${SITE}/ideas/requests`,
    title: "Request a Startup Idea | Weekend MVP",
    description:
      "Request the startup idea you want researched next, and vote for the requests you want us to build.",
  },
  twitter: {
    card: "summary",
    title: "Request a Startup Idea | Weekend MVP",
    description:
      "Request the startup idea you want researched next, and vote for the requests you want us to build.",
  },
};

/**
 * Idea 4 — full requests list. Secondary view behind the floating widget:
 * the widget shows the top 5, this page shows the top 20 with the same
 * submit form and the same Convex backend. Requests here are only ever
 * read by the engine's Stage-0 Suggest step later — nothing on this page
 * publishes an idea or starts research.
 */
export default function IdeaRequestsPage() {
  return (
    <main className="bg-home-paper font-sans text-home-ink">
      <Container className="flex flex-col gap-6 pt-28 pb-16 md:pt-36">
        <Breadcrumbs
          items={[
            { label: "Home", href: "/" },
            { label: "Startup Ideas", href: "/startup-ideas" },
            { label: "Request an idea", href: "/ideas/requests" },
          ]}
        />
        <div className="flex max-w-[640px] flex-col gap-4">
          <h1 className="font-editorial text-[40px] font-normal leading-[1.02] tracking-[-0.02em] text-balance md:text-[52px]">
            Request an idea <Em>we should research.</Em>
          </h1>
          <p className="text-pretty text-base leading-[1.55] text-home-ink-2 md:text-[19px]">
            Can&apos;t find the idea you&apos;re after? Tell us what to research
            next — and vote for the requests you want us to build. The
            most-voted requests feed the research queue; nothing here is
            published until it passes the usual evidence checks.
          </p>
        </div>
        <div className="max-w-[640px]">
          <WhenConvexReady fallback={<p className="text-sm text-neutral-500">Loading requests…</p>}>
            <IdeaRequestPanel limit={20} />
          </WhenConvexReady>
        </div>
      </Container>
    </main>
  );
}
