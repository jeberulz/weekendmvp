import type { Metadata } from "next";

import { ProjectList } from "@/components/platform/projects/ProjectList";

export const metadata: Metadata = {
  title: "Projects | Workspace",
  robots: { index: false, follow: false },
};

export default function ProjectsPage() {
  return (
    <section aria-labelledby="projects-heading" className="mx-auto w-full max-w-[1200px] px-5 py-8 sm:px-8 lg:px-10 lg:py-10">
      <div className="mx-auto max-w-4xl">
        <div className="flex flex-col gap-5 border-b border-home-rule pb-7 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 id="projects-heading" className="font-editorial text-[34px] font-normal leading-[1.05] tracking-[-0.025em] text-home-ink sm:text-[42px]">
              Projects
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-home-ink-3">
              Drafts and briefs you started earlier. New projects are paused while the product focuses on ideas.
            </p>
          </div>
        </div>
        <div className="mt-8">
          <ProjectList />
        </div>
      </div>
    </section>
  );
}
