"use client";

import { ArrowRight, Bookmark, CircleDot, Compass, Sparkles } from "lucide-react";
import { useQuery } from "convex/react";
import Link from "next/link";
import { useSyncExternalStore } from "react";
import { api } from "@/convex/_generated/api";
import { isValidPlatformConvexUrl } from "@/lib/platform-convex-url";

const emptySubscribe = () => () => undefined;

function DashboardSkeleton() {
  return (
    <div aria-label="Loading workspace" className="animate-pulse space-y-8 motion-reduce:animate-none">
      <div className="h-8 w-52 rounded-md bg-white/8" />
      <div className="h-28 max-w-3xl rounded-xl bg-white/5" />
      <div className="space-y-3">
        <div className="h-16 max-w-3xl rounded-lg bg-white/5" />
        <div className="h-16 max-w-3xl rounded-lg bg-white/5" />
      </div>
    </div>
  );
}

function DashboardConfigurationError() {
  return (
    <div role="alert" className="max-w-3xl rounded-xl border border-white/10 p-5">
      <h1 className="text-lg font-semibold text-zinc-100">
        Workspace data is unavailable
      </h1>
      <p className="mt-2 text-sm leading-6 text-zinc-400">
        The Convex data connection is missing or invalid. Check the local
        workspace configuration, then reload this page. No project or account
        state was changed.
      </p>
    </div>
  );
}

function StatusLabel({ status }: { status: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-zinc-400">
      <CircleDot className="size-3.5" aria-hidden />
      <span className="capitalize">{status}</span>
    </span>
  );
}

function DashboardHomeData() {
  const summary = useQuery(api.platform.ideas.dashboardSummary);

  if (summary === undefined) return <DashboardSkeleton />;

  const nextIntent = summary.recentIntents[0];
  const nextHref = nextIntent
    ? `/build/${nextIntent.slug}`
    : "/dashboard/explore";
  const nextLabel = nextIntent ? "Preview this idea" : "Explore ideas";

  return (
    <div className="space-y-10">
      <section aria-labelledby="workspace-heading">
        <p className="text-sm text-zinc-400">
          {summary.userName ? `Welcome back, ${summary.userName}` : "Welcome back"}
        </p>
        <h1
          id="workspace-heading"
          className="mt-2 text-3xl font-semibold tracking-[-0.025em] text-zinc-50 sm:text-4xl"
        >
          Move one idea forward.
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-400">
          Review the evidence you kept, then choose one concrete next step.
          Nothing runs or spends credits without your confirmation.
        </p>
      </section>

      <section
        aria-labelledby="next-action-heading"
        className="max-w-4xl rounded-xl bg-[#11110f] px-5 py-5 ring-1 ring-orange-400/20 sm:px-6"
      >
        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
          <div>
            <h2 id="next-action-heading" className="text-base font-semibold text-zinc-100">
              {nextIntent ? nextIntent.title : "Find an evidence-backed starting point"}
            </h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-zinc-400">
              {nextIntent
                ? "Create the promised landing-page preview before deciding whether to publish."
                : "Browse the canonical research library and keep only the ideas worth revisiting."}
            </p>
          </div>
          <Link
            href={nextHref}
            className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-lg bg-orange-800 px-4 text-sm font-semibold text-white transition-colors duration-200 hover:bg-orange-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300 focus-visible:ring-offset-2 focus-visible:ring-offset-[#11110f]"
          >
            {nextLabel}
            <ArrowRight className="size-4" aria-hidden />
          </Link>
        </div>
      </section>

      <div className="grid gap-10 xl:grid-cols-[minmax(0,1.35fr)_minmax(18rem,0.65fr)]">
        <section aria-labelledby="projects-heading">
          <div className="flex items-end justify-between gap-4 border-b border-white/10 pb-3">
            <div>
              <h2 id="projects-heading" className="text-lg font-semibold text-zinc-100">
                Recent projects
              </h2>
              <p className="mt-1 text-sm text-zinc-400">Only your active, server-owned records.</p>
            </div>
          </div>
          {summary.projects.length === 0 ? (
            <div className="py-7">
              <p className="text-sm font-medium text-zinc-200">No projects yet.</p>
              <p className="mt-2 max-w-xl text-sm leading-6 text-zinc-400">
                Save a repository idea or bring your own. A project starts only after you review its brief.
              </p>
              <Link
                href="/dashboard/new"
                className="mt-4 inline-flex min-h-10 items-center gap-2 text-sm font-medium text-orange-300 underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500"
              >
                Bring your own idea <ArrowRight className="size-4" aria-hidden />
              </Link>
            </div>
          ) : (
            <ul className="divide-y divide-white/10">
              {summary.projects.map((project) => (
                <li key={project.id} className="flex min-h-16 items-center justify-between gap-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-zinc-100">{project.title}</p>
                    <p className="mt-1 text-xs text-zinc-400">
                      {project.source === "repository_idea" ? "Repository idea" : "Your idea"}
                    </p>
                  </div>
                  <StatusLabel status={project.status} />
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="kept-ideas-heading">
          <div className="flex items-end justify-between gap-4 border-b border-white/10 pb-3">
            <div>
              <h2 id="kept-ideas-heading" className="text-lg font-semibold text-zinc-100">
                Ideas you kept
              </h2>
              <p className="mt-1 text-sm text-zinc-400">Saved and Interested remain independent.</p>
            </div>
          </div>
          {summary.recentIntents.length === 0 ? (
            <div className="py-7">
              <p className="text-sm text-zinc-400">Nothing saved or marked Interested yet.</p>
              <Link
                href="/dashboard/explore"
                className="mt-4 inline-flex min-h-10 items-center gap-2 text-sm font-medium text-orange-300 underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500"
              >
                Browse the library <Compass className="size-4" aria-hidden />
              </Link>
            </div>
          ) : (
            <ul className="divide-y divide-white/10">
              {summary.recentIntents.map((intent) => (
                <li key={intent.ideaId} className="py-3">
                  <Link
                    href={`/ideas/${intent.slug}`}
                    className="block rounded-md py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500"
                  >
                    <span className="block text-sm font-medium text-zinc-100 hover:text-orange-200">
                      {intent.title}
                    </span>
                    <span className="mt-1 flex flex-wrap items-center gap-3 text-xs text-zinc-400">
                      <span>{intent.category}</span>
                      {intent.saved && (
                        <span className="inline-flex items-center gap-1">
                          <Bookmark className="size-3" aria-hidden /> Saved
                        </span>
                      )}
                      {intent.interested && (
                        <span className="inline-flex items-center gap-1">
                          <Sparkles className="size-3" aria-hidden /> Interested
                        </span>
                      )}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section aria-labelledby="shortcuts-heading" className="border-t border-white/10 pt-7">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 id="shortcuts-heading" className="text-sm font-semibold text-zinc-100">
              Supported shortcuts
            </h2>
            <p className="mt-1 text-sm leading-6 text-zinc-400">
              These open explicit workflows; they do not run an autonomous agent.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link className="rounded-lg border border-white/10 px-3 py-2 text-sm text-zinc-300 hover:border-white/20 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500" href="/dashboard/explore">
              Explore ideas
            </Link>
            <Link className="rounded-lg border border-white/10 px-3 py-2 text-sm text-zinc-300 hover:border-white/20 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500" href="/dashboard/explore?view=saved">
              Review saved
            </Link>
            <Link className="rounded-lg border border-white/10 px-3 py-2 text-sm text-zinc-300 hover:border-white/20 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500" href="/dashboard/new">
              Bring my own idea
            </Link>
          </div>
        </div>
        {summary.creditBalance !== null && (
          <p className="mt-5 text-xs text-zinc-400">
            Available balance: {summary.creditBalance.toString()} credits. Billing changes only after server confirmation.
          </p>
        )}
      </section>
    </div>
  );
}

export function DashboardHome() {
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);

  if (!mounted) return <DashboardSkeleton />;
  if (!isValidPlatformConvexUrl(process.env.NEXT_PUBLIC_CONVEX_URL)) {
    return <DashboardConfigurationError />;
  }

  return <DashboardHomeData />;
}
