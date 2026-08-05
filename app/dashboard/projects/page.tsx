import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";

import { ProjectList } from "@/components/platform/projects/ProjectList";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Projects | Workspace",
  robots: { index: false, follow: false },
};

export default function ProjectsPage() {
  return (
    <section aria-labelledby="projects-heading" className="min-h-full px-5 py-8 sm:px-8 lg:px-12 lg:py-12">
      <div className="mx-auto max-w-4xl">
        <div className="flex flex-col gap-5 border-b border-white/10 pb-7 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 id="projects-heading" className="text-3xl font-semibold tracking-[-0.03em] text-zinc-50 sm:text-4xl">
              Projects
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-zinc-400">
              Resume a draft, inspect a confirmed brief, or move into the next supported workflow.
            </p>
          </div>
          <Button asChild>
            <Link href="/dashboard/new">
              <Plus aria-hidden="true" />
              Add your idea
            </Link>
          </Button>
        </div>
        <div className="mt-8">
          <ProjectList />
        </div>
      </div>
    </section>
  );
}
