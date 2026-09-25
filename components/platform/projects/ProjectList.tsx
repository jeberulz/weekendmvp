"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePaginatedQuery } from "convex/react";
import { Lightbulb } from "lucide-react";

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
      <div role="status" className="space-y-1 animate-pulse motion-reduce:animate-none">
        <span className="sr-only">Loading projects</span>
        {[0, 1, 2].map((item) => (
          <div key={item} className="h-24 border-b border-home-rule bg-home-sunk" />
        ))}
      </div>
    );
  }

  if (results.length === 0 && status === "Exhausted") {
    return (
      <div className="max-w-2xl border-y border-home-rule py-10">
        <Lightbulb className="size-6 text-home-orange-ink" aria-hidden="true" />
        <h2 className="mt-4 font-editorial text-[24px] font-normal leading-[1.15] text-home-ink">No projects yet</h2>
        <p className="mt-2 max-w-[65ch] text-sm leading-6 text-home-ink-3">
          Pick an idea with research behind it from the library.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
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
        <p className="mt-6 text-sm text-home-ink-3" aria-live="polite">Loading more projects…</p>
      ) : null}
    </div>
  );
}
