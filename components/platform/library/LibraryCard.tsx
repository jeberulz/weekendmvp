"use client";

import Link from "next/link";
import { objectHomeHref } from "@/lib/signed-in-chrome";
import type { Id } from "@/convex/_generated/dataModel";

export type LibraryIdea = {
  ideaId: Id<"ideas">;
  slug: string;
  title: string;
  description: string;
  category: string;
  buildTime: string;
  building: boolean;
  projectId?: Id<"projects">;
};

export function LibraryCard({
  idea,
  currentSlug,
}: {
  idea: LibraryIdea;
  currentSlug?: string;
}) {
  const current = currentSlug !== undefined && idea.slug === currentSlug;
  const category = idea.category.replaceAll("-", " ");

  return (
    <article className="rounded-3xl border border-stone-900/10 bg-white p-5">
      <p className="text-xs capitalize text-stone-500">
        {category} · {idea.buildTime} hours
      </p>
      <h2 className="mt-2 text-xl font-semibold tracking-[-0.02em] text-stone-950">
        <Link
          href={`/ideas/${idea.slug}`}
          className="rounded-2xl underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-800"
        >
          {idea.title}
        </Link>
      </h2>
      <p className="mt-2 text-sm leading-6 text-stone-600">{idea.description}</p>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {current ? (
          <p className="text-sm font-medium text-stone-700">
            This is the one you’re on
          </p>
        ) : idea.building ? (
          <Link
            href={objectHomeHref(idea.projectId)}
            className="inline-flex min-h-11 items-center rounded-2xl border border-stone-900/15 px-4 text-sm font-semibold text-stone-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-800"
          >
            Open project
          </Link>
        ) : (
          <Link
            href={`/build/${idea.slug}`}
            className="inline-flex min-h-11 items-center rounded-2xl bg-stone-900 px-4 text-sm font-semibold text-[#f3f1eb] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-800"
          >
            Preview this idea
          </Link>
        )}
      </div>
    </article>
  );
}
