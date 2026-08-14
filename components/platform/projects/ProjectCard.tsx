import Link from "next/link";
import { ArrowUpRight, FilePenLine, FolderKanban } from "lucide-react";

import { Badge } from "@/components/ui/badge";

type ProjectCardProps = {
  projectId: string;
  title: string;
  source: "repository_idea" | "own_idea";
  sourceSlug?: string;
  status: "draft" | "validating" | "ready" | "building" | "published";
  updatedAt: number;
  nextAction: "resume_brief" | "review_brief" | "continue_project";
};

const STATUS_LABELS: Record<ProjectCardProps["status"], string> = {
  draft: "Draft",
  validating: "Brief confirmed",
  ready: "Ready",
  building: "Building",
  published: "Published",
};

export function ProjectCard(project: ProjectCardProps) {
  const resumeHref =
    project.source === "own_idea"
      ? `/dashboard/new?project=${project.projectId}`
      : project.sourceSlug
        ? `/build/${project.sourceSlug}`
        : `/dashboard/projects/${project.projectId}`;
  const href =
    project.nextAction === "resume_brief"
      ? resumeHref
      : `/dashboard/projects/${project.projectId}`;
  const action =
    project.nextAction === "resume_brief"
      ? "Resume brief"
      : project.nextAction === "review_brief"
        ? "Review brief"
        : "Open project";

  return (
    <article className="group border-b border-white/10 py-5 first:border-t">
      <div className="flex items-start gap-4">
        <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-white/[0.06] text-zinc-400">
          {project.nextAction === "resume_brief" ? (
            <FilePenLine className="size-4" aria-hidden="true" />
          ) : (
            <FolderKanban className="size-4" aria-hidden="true" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-medium text-zinc-100">{project.title}</h2>
            <Badge variant="secondary" className="font-normal text-zinc-300">
              {STATUS_LABELS[project.status]}
            </Badge>
          </div>
          <p className="mt-1.5 text-sm text-zinc-400">
            {project.source === "repository_idea" ? "Repository idea" : "Your idea"}
            <span aria-hidden="true"> · </span>
            Updated {new Date(project.updatedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
          </p>
        </div>
        <Link
          href={href}
          className="inline-flex min-h-9 shrink-0 items-center gap-2 rounded-md px-3 text-sm font-medium text-zinc-200 outline-none transition-colors hover:bg-white/[0.06] hover:text-white focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          {action}
          <ArrowUpRight className="size-4" aria-hidden="true" />
        </Link>
      </div>
    </article>
  );
}
