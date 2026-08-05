"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePaginatedQuery } from "convex/react";
import { Lightbulb, Plus } from "lucide-react";

import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { ProjectCard } from "./ProjectCard";

export function ProjectList() {
  const { results, status, loadMore } = usePaginatedQuery(
    api.platform.projects.listOwned,
    {},
    { initialNumItems: 10 },
  );

  useEffect(() => {
    if (results.length === 0 && status === "CanLoadMore") {
      loadMore(10);
    }
  }, [loadMore, results.length, status]);

  if (status === "LoadingFirstPage") {
    return (
      <div aria-label="Loading projects" className="space-y-1 animate-pulse">
        {[0, 1, 2].map((item) => (
          <div key={item} className="h-24 border-b border-white/10 bg-white/[0.02]" />
        ))}
      </div>
    );
  }

  if (results.length === 0 && status === "Exhausted") {
    return (
      <div className="max-w-2xl border-y border-white/10 py-10">
        <Lightbulb className="size-6 text-amber-300" aria-hidden="true" />
        <h2 className="mt-4 text-xl font-semibold text-zinc-100">Start with a problem worth solving</h2>
        <p className="mt-2 max-w-[65ch] text-sm leading-6 text-zinc-400">
          Bring an idea you already have, or explore the research library and choose one with evidence behind it.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Button asChild>
            <Link href="/dashboard/new">
              <Plus aria-hidden="true" />
              Add your idea
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/dashboard/explore">Explore ideas</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div>
        {results.map((project) => (
          <ProjectCard key={project.projectId} {...project} />
        ))}
      </div>
      {status === "CanLoadMore" ? (
        <Button className="mt-6" variant="outline" onClick={() => loadMore(10)}>
          Load more projects
        </Button>
      ) : null}
      {status === "LoadingMore" ? (
        <p className="mt-6 text-sm text-zinc-400" aria-live="polite">Loading more projects…</p>
      ) : null}
    </div>
  );
}
