import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cacheLife, cacheTag } from "next/cache";
import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import { prefillFromIdea } from "@/convex/platform/preview/customisation";
import { MintPreviewRedirect } from "@/components/preview/MintPreviewRedirect";

export const metadata: Metadata = {
  title: "Preview this idea",
  robots: {
    index: false,
    follow: false,
    noarchive: true,
    nocache: true,
    googleBot: {
      index: false,
      follow: false,
      noarchive: true,
      noimageindex: true,
    },
  },
};

async function resolveIdea(slug: string): Promise<Doc<"ideas"> | null> {
  "use cache";
  cacheTag(`idea:${slug}`, "ideas");
  cacheLife("hours");

  try {
    return await fetchQuery(api.ideas.bySlug, { slug });
  } catch {
    return null;
  }
}

export const instant = false;

export default async function BuildPreviewPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const idea = await resolveIdea(slug);
  if (!idea) notFound();

  return (
    <main id="build-main" className="min-h-dvh bg-[#f3f1eb] text-[#1c1917]">
      <Suspense
        fallback={
          <p className="px-5 py-16 text-center text-stone-600">
            Opening the preview…
          </p>
        }
      >
        <MintPreviewRedirect
          slug={idea.slug}
          customisation={prefillFromIdea(idea)}
        />
      </Suspense>
    </main>
  );
}
