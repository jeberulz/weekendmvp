"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowUpRight,
  CheckCircle2,
  Coins,
  FilePenLine,
  Globe,
} from "lucide-react";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  ideaHref,
  publishControl,
  publishErrorMessage,
  slugFieldError,
  suggestedTenantSlug,
  tenantUrlFromSite,
} from "./cockpit";

export function ProjectWorkspace({ projectId }: { projectId: string }) {
  const router = useRouter();
  const beginRevision = useMutation(api.platform.intake.beginRevision);
  const publishSite = useMutation(api.platform.sites.publish.publish);
  const data = useQuery(api.platform.projects.getOwned, {
    projectId: projectId as Id<"projects">,
  });
  const billing = useQuery(api.platform.billing.queries.summary, {
    historyLimit: 1,
  });
  const [revisionError, setRevisionError] = useState("");
  const [startingRevision, setStartingRevision] = useState(false);
  const [slugOverride, setSlugOverride] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState("");
  const [slugAttempted, setSlugAttempted] = useState(false);

  if (data === undefined) {
    return (
      <div aria-label="Loading project" className="space-y-6 animate-pulse">
        <div className="h-9 w-64 rounded-md bg-white/10" />
        <div className="h-28 rounded-xl bg-white/[0.04]" />
      </div>
    );
  }

  const { project, currentDraft, latestConfirmed, history, site } = data;
  const researchHref = ideaHref(project.sourceSlug);
  const tenantUrl = tenantUrlFromSite(site);
  const control = publishControl({ source: project.source, site });
  const slug = slugOverride ?? suggestedTenantSlug(project.sourceSlug);
  const slugError = slugFieldError(slug);
  const showSlugError = slugAttempted && slugError !== null;

  async function editAsNewRevision() {
    if (!latestConfirmed) return;
    setStartingRevision(true);
    setRevisionError("");
    try {
      await beginRevision({
        projectId: project.projectId,
        confirmedRevision: latestConfirmed.revision,
      });
      router.push(`/dashboard/new?project=${project.projectId}`);
    } catch {
      setRevisionError(
        "We could not start a new revision. Refresh to check the latest brief state.",
      );
      setStartingRevision(false);
    }
  }

  async function publishNow() {
    setSlugAttempted(true);
    if (slugError) return;
    setPublishing(true);
    setPublishError("");
    try {
      await publishSite({
        projectId: project.projectId,
        slug: slug.trim().toLowerCase(),
      });
    } catch (error) {
      setPublishError(publishErrorMessage(error));
    } finally {
      setPublishing(false);
    }
  }

  const publishDisabled =
    control.kind !== "ready" || publishing || slugError !== null;
  const publishDisabledReason =
    control.kind === "blocked"
      ? control.reason
      : control.kind === "live"
        ? "This site is already live."
        : publishing
          ? "Publishing…"
          : slugError;

  return (
    <div className="mx-auto max-w-4xl">
      <Link
        href="/dashboard/projects"
        className="inline-flex items-center gap-2 rounded-md text-sm text-zinc-400 outline-none transition-colors hover:text-white focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        All projects
      </Link>
      <div className="mt-7 flex flex-col gap-5 border-b border-white/10 pb-7 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-3xl font-semibold tracking-[-0.03em] text-zinc-50 sm:text-4xl">
              {project.title}
            </h1>
            <Badge variant="secondary" className="font-normal capitalize text-zinc-300">
              {project.status}
            </Badge>
          </div>
          <p className="mt-2 text-sm text-zinc-400">
            {project.source === "repository_idea" ? "Repository idea" : "Your idea"}
          </p>
        </div>
        {currentDraft && project.source === "own_idea" ? (
          <Button asChild>
            <Link href={`/dashboard/new?project=${project.projectId}`}>
              <FilePenLine aria-hidden="true" />
              Resume draft
            </Link>
          </Button>
        ) : researchHref ? (
          <Button asChild variant="outline">
            <Link href={researchHref}>
              Read source research
              <ArrowUpRight aria-hidden="true" />
            </Link>
          </Button>
        ) : null}
      </div>

      <section aria-labelledby="cockpit-heading" className="border-b border-white/10 py-8">
        <h2 id="cockpit-heading" className="text-lg font-semibold text-zinc-100">
          Cockpit
        </h2>
        <p className="mt-2 max-w-[65ch] text-sm leading-6 text-zinc-400">
          Live project facts from the server. Publishing does not change DNS.
        </p>
        <dl className="mt-5 divide-y divide-white/10">
          <div className="grid gap-2 py-4 sm:grid-cols-[10rem_1fr] sm:gap-6">
            <dt className="text-sm text-zinc-400">Status</dt>
            <dd className="text-sm leading-6 text-zinc-200">
              <span className="capitalize">{project.status}</span>
              {site ? (
                <span className="text-zinc-400">
                  {" "}
                  · site <span className="capitalize text-zinc-200">{site.status}</span>
                  {site.live ? " · live" : ""}
                </span>
              ) : (
                <span className="text-zinc-400"> · no site record</span>
              )}
            </dd>
          </div>
          <div className="grid gap-2 py-4 sm:grid-cols-[10rem_1fr] sm:gap-6">
            <dt className="text-sm text-zinc-400">Credits</dt>
            <dd className="text-sm leading-6 text-zinc-200">
              {billing === undefined ? (
                <span>Loading credit balance…</span>
              ) : (
                <span className="inline-flex items-center gap-2 tabular-nums">
                  <Coins className="size-4 text-amber-300" aria-hidden="true" />
                  {billing.balance.toString()} available
                </span>
              )}
            </dd>
          </div>
          {researchHref ? (
            <div className="grid gap-2 py-4 sm:grid-cols-[10rem_1fr] sm:gap-6">
              <dt className="text-sm text-zinc-400">Canonical idea</dt>
              <dd className="text-sm leading-6">
                <Link
                  href={researchHref}
                  className="inline-flex items-center gap-1 rounded-md text-orange-300 underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500"
                >
                  {researchHref}
                  <ArrowUpRight className="size-4" aria-hidden="true" />
                </Link>
              </dd>
            </div>
          ) : null}
          {tenantUrl ? (
            <div className="grid gap-2 py-4 sm:grid-cols-[10rem_1fr] sm:gap-6">
              <dt className="text-sm text-zinc-400">Tenant URL</dt>
              <dd className="text-sm leading-6">
                <a
                  href={tenantUrl}
                  className="inline-flex items-center gap-1 rounded-md text-orange-300 underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500"
                >
                  <Globe className="size-4" aria-hidden="true" />
                  {tenantUrl}
                </a>
                {site && !site.live ? (
                  <p className="mt-1 text-zinc-400">Hostname is stored. The site is not currently live.</p>
                ) : null}
              </dd>
            </div>
          ) : null}
        </dl>

        {control.kind !== "hidden" ? (
          <form
            className="mt-5 space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              void publishNow();
            }}
          >
            {control.kind === "ready" || control.kind === "blocked" ? (
              <div className="max-w-md space-y-2">
                <Label htmlFor="tenant-slug">Subdomain</Label>
                <div className="flex items-center gap-2">
                  <input
                    id="tenant-slug"
                    name="slug"
                    autoComplete="off"
                    spellCheck={false}
                    value={slug}
                    disabled={control.kind !== "ready" || publishing}
                    aria-invalid={showSlugError}
                    aria-describedby={
                      showSlugError
                        ? "tenant-slug-error"
                        : "tenant-slug-hint"
                    }
                    onChange={(event) => setSlugOverride(event.target.value)}
                    className="h-9 min-w-0 flex-1 rounded-md border border-white/15 bg-white/5 px-3 text-sm text-zinc-100 outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
                  />
                  <span className="shrink-0 text-sm text-zinc-500">.weekendmvp.app</span>
                </div>
                <p id="tenant-slug-hint" className="text-xs leading-5 text-zinc-500">
                  Chooses the hostname stored for this project. It does not activate DNS.
                </p>
                {showSlugError ? (
                  <p id="tenant-slug-error" className="text-sm text-red-300" role="alert">
                    {slugError}
                  </p>
                ) : null}
              </div>
            ) : null}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <Button
                type="submit"
                disabled={publishDisabled}
                aria-describedby="publish-status"
              >
                {control.kind === "live"
                  ? "Published"
                  : publishing
                    ? "Publishing…"
                    : "Publish"}
              </Button>
              <p id="publish-status" className="min-h-5 text-sm text-zinc-400" aria-live="polite">
                {publishError ||
                  (control.kind === "blocked" ? control.reason : null) ||
                  (control.kind === "live" ? "This site is already live." : null) ||
                  (publishDisabled && publishDisabledReason && control.kind === "ready"
                    ? publishDisabledReason
                    : null)}
              </p>
            </div>
          </form>
        ) : null}
      </section>

      <section aria-labelledby="brief-heading" className="py-8">
        <h2 id="brief-heading" className="text-lg font-semibold text-zinc-100">Brief</h2>
        {currentDraft ? (
          <div className="mt-4 border-y border-white/10 py-5">
            <p className="flex items-center gap-2 text-sm font-medium text-zinc-200">
              <FilePenLine className="size-4 text-amber-300" aria-hidden="true" />
              Revision {currentDraft.revision.toString()} is still a draft
            </p>
            <p className="mt-2 max-w-[65ch] text-sm leading-6 text-zinc-400">
              Continue editing, then review the exact brief before you confirm it.
            </p>
          </div>
        ) : latestConfirmed ? (
          <div className="mt-4 border-y border-white/10 py-5">
            <p className="flex items-center gap-2 text-sm font-medium text-zinc-200">
              <CheckCircle2 className="size-4 text-emerald-300" aria-hidden="true" />
              Revision {latestConfirmed.revision.toString()} confirmed
            </p>
            <dl className="mt-5 divide-y divide-white/10">
              {Object.entries(latestConfirmed.input).map(([label, value]) => (
                <div key={label} className="grid gap-2 py-4 sm:grid-cols-[10rem_1fr] sm:gap-6">
                  <dt className="text-sm capitalize text-zinc-400">{label}</dt>
                  <dd className="whitespace-pre-wrap text-sm leading-6 text-zinc-200">{value || "Not provided"}</dd>
                </div>
              ))}
            </dl>
            {project.source === "own_idea" ? (
              <Button
                variant="outline"
                className="mt-5"
                onClick={() => void editAsNewRevision()}
                disabled={startingRevision}
              >
                <FilePenLine aria-hidden="true" />
                {startingRevision ? "Starting revision…" : "Edit as a new revision"}
              </Button>
            ) : null}
            <p className="mt-3 min-h-5 text-sm text-red-300" aria-live="polite">
              {revisionError}
            </p>
          </div>
        ) : (
          <p className="mt-3 text-sm text-zinc-400">No active brief is available.</p>
        )}
      </section>

      {history.length > 1 ? (
        <section aria-labelledby="history-heading" className="border-t border-white/10 py-8">
          <h2 id="history-heading" className="text-lg font-semibold text-zinc-100">Revision history</h2>
          <ol className="mt-4 divide-y divide-white/10">
            {history.map((item) => (
              <li key={item.briefId} className="flex items-center justify-between gap-4 py-3 text-sm">
                <span className="text-zinc-300">Revision {item.revision.toString()}</span>
                <span className="capitalize text-zinc-400">{item.status}</span>
              </li>
            ))}
          </ol>
        </section>
      ) : null}
    </div>
  );
}
