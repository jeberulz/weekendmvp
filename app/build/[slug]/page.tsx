import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cacheLife, cacheTag } from "next/cache";
import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import { prefillFromIdea } from "@/convex/platform/preview/customisation";
import { BuildPreviewForm } from "@/components/preview/BuildPreviewForm";

/**
 * WP27-S2. Anonymous preview setup for a repository idea.
 *
 * Reachable with no session, no signup, and no payment — this is the free
 * activation hook. It is private in the search sense (a generated preview is
 * not public research) while being open in the access sense.
 */
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

/**
 * Shares the `idea:{slug}` / `ideas` cache tags with the public idea page, so
 * this route invalidates through the same `POST /api/revalidate` path rather
 * than needing its own. An uncached Convex read here fails the build under
 * Cache Components.
 */
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

/**
 * Matches `app/signin/page.tsx`: the interactive step reads router state, so
 * the route opts out of instant prerendering rather than being forced fully
 * dynamic. This page is `noindex` and low-traffic, so prerendering every idea
 * slug would buy nothing anyway.
 */
export const instant = false;

export default async function BuildPreviewPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  // Resolved server-side from the canonical record. An unknown slug is a
  // normal 404 and never yields a generated preview.
  const idea = await resolveIdea(slug);
  if (!idea) notFound();

  return (
    <main id="build-main" className="mx-auto w-full max-w-2xl px-5 py-12">
      <p className="text-sm text-zinc-400">Weekend MVP</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight text-zinc-100">
        Preview this idea
      </h1>
      <p className="mt-3 text-zinc-400">
        We have pre-filled this from the research on{" "}
        <a
          href={`/ideas/${idea.slug}`}
          className="underline underline-offset-4 hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500"
        >
          {idea.title}
        </a>
        . Adjust the wording, pick a layout, and we will render a private
        preview. No account needed yet.
      </p>

      {/* The form is a client component that reads router state, which the
          prerenderer treats as URL data. Suspense keeps the static shell
          (heading, idea link, explanation) prerenderable and streams the
          interactive form in, rather than forcing the whole route dynamic. */}
      <Suspense
        fallback={
          <p className="mt-10 text-zinc-400">Loading the customisation step…</p>
        }
      >
        <BuildPreviewForm slug={idea.slug} initial={prefillFromIdea(idea)} />
      </Suspense>
    </main>
  );
}
