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

/**
 * Rulings R5 and R9: site publishing and credits are parked for v1.1. The
 * publish form and the credit balance stay in code and stop rendering. Flip
 * this when publishing returns. Nothing in the publish logic changes.
 */
const SITE_PUBLISHING_PARKED = true;

export function ProjectWorkspace({ projectId }: { projectId: string }) {
  const router = useRouter();
  const beginRevision = useMutation(api.platform.intake.beginRevision);
  const publishSite = useMutation(api.platform.sites.publish.publish);
  const data = useQuery(api.platform.projects.getOwned, {
    projectId: projectId as Id<"projects">,
  });
  // Credits are parked (R9): no balance read while the row is hidden.
  const billing = useQuery(
    api.platform.billing.queries.summary,
    SITE_PUBLISHING_PARKED ? "skip" : { historyLimit: 1 },
  );
  const [revisionError, setRevisionError] = useState("");
  const [startingRevision, setStartingRevision] = useState(false);
  const [slugOverride, setSlugOverride] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState("");
  const [slugAttempted, setSlugAttempted] = useState(false);

  if (data === undefined) {
    return (
      <div role="status" className="space-y-6 animate-pulse motion-reduce:animate-none">
        <span className="sr-only">Loading project</span>
        <div className="h-9 w-64 rounded-md bg-home-sunk" />
        <div className="h-28 rounded-xl bg-home-sunk" />
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
        className="inline-flex items-center gap-2 rounded-md text-sm text-home-ink-3 outline-none transition-colors hover:text-home-ink focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        All projects
      </Link>
      <div className="mt-7 flex flex-col gap-5 border-b border-home-rule pb-7 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-editorial text-[34px] font-normal leading-[1.05] tracking-[-0.025em] text-home-ink sm:text-[42px]">
              {project.title}
            </h1>
            <Badge variant="secondary" className="font-normal capitalize text-home-ink-2">
              {project.status}
            </Badge>
          </div>
          <p className="mt-2 text-sm text-home-ink-3">
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

      <section aria-labelledby="cockpit-heading" className="border-b border-home-rule py-8">
        <h2 id="cockpit-heading" className="text-lg font-semibold text-home-ink">
          Cockpit
        </h2>
        <p className="mt-2 max-w-[65ch] text-sm leading-6 text-home-ink-3">
          Live project facts from the server.
          {SITE_PUBLISHING_PARKED ? null : " Publishing does not change DNS."}
        </p>
        <dl className="mt-5 divide-y divide-home-rule">
          <div className="grid gap-2 py-4 sm:grid-cols-[10rem_1fr] sm:gap-6">
            <dt className="text-sm text-home-ink-3">Status</dt>
            <dd className="text-sm leading-6 text-home-ink">
              <span className="capitalize">{project.status}</span>
              {site ? (
                <span className="text-home-ink-3">
                  {" "}
                  · site <span className="capitalize text-home-ink">{site.status}</span>
                  {site.live ? " · live" : ""}
                </span>
              ) : (
                <span className="text-home-ink-3"> · no site record</span>
              )}
            </dd>
          </div>
          {!SITE_PUBLISHING_PARKED ? (
            <div className="grid gap-2 py-4 sm:grid-cols-[10rem_1fr] sm:gap-6">
              <dt className="text-sm text-home-ink-3">Credits</dt>
              <dd className="text-sm leading-6 text-home-ink">
                {billing === undefined ? (
                  <span>Loading credit balance…</span>
                ) : (
                  <span className="inline-flex items-center gap-2 tabular-nums">
                    <Coins className="size-4 text-home-orange-ink" aria-hidden="true" />
                    {billing.balance.toString()} available
                  </span>
                )}
              </dd>
            </div>
          ) : null}
          {researchHref ? (
            <div className="grid gap-2 py-4 sm:grid-cols-[10rem_1fr] sm:gap-6">
              <dt className="text-sm text-home-ink-3">Canonical idea</dt>
              <dd className="text-sm leading-6">
                <Link
                  href={researchHref}
                  className="inline-flex items-center gap-1 rounded-md text-home-orange-ink underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-home-orange-ink"
                >
                  {researchHref}
                  <ArrowUpRight className="size-4" aria-hidden="true" />
                </Link>
              </dd>
            </div>
          ) : null}
          {tenantUrl ? (
            <div className="grid gap-2 py-4 sm:grid-cols-[10rem_1fr] sm:gap-6">
              <dt className="text-sm text-home-ink-3">Tenant URL</dt>
              <dd className="text-sm leading-6">
                <a
                  href={tenantUrl}
                  className="inline-flex items-center gap-1 rounded-md text-home-orange-ink underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-home-orange-ink"
                >
                  <Globe className="size-4" aria-hidden="true" />
                  {tenantUrl}
                </a>
                {site && !site.live ? (
                  <p className="mt-1 text-home-ink-3">Hostname is stored. The site is not currently live.</p>
                ) : null}
              </dd>
            </div>
          ) : null}
        </dl>

        {!SITE_PUBLISHING_PARKED && control.kind !== "hidden" ? (
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
                    className="h-9 min-w-0 flex-1 rounded-md border border-input bg-home-card px-3 text-sm text-home-ink outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
                  />
                  <span className="shrink-0 text-sm text-home-ink-3">.weekendmvp.app</span>
                </div>
                <p id="tenant-slug-hint" className="text-xs leading-5 text-home-ink-3">
                  Chooses the hostname stored for this project. It does not activate DNS.
                </p>
                {showSlugError ? (
                  <p id="tenant-slug-error" className="text-sm text-red-700" role="alert">
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
              <p id="publish-status" className="min-h-5 text-sm text-home-ink-3" aria-live="polite">
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
        <h2 id="brief-heading" className="text-lg font-semibold text-home-ink">Brief</h2>
        {currentDraft ? (
          <div className="mt-4 border-y border-home-rule py-5">
            <p className="flex items-center gap-2 text-sm font-medium text-home-ink">
              <FilePenLine className="size-4 text-home-orange-ink" aria-hidden="true" />
              Revision {currentDraft.revision.toString()} is still a draft
            </p>
            <p className="mt-2 max-w-[65ch] text-sm leading-6 text-home-ink-3">
              Continue editing, then review the exact brief before you confirm it.
            </p>
          </div>
        ) : latestConfirmed ? (
          <div className="mt-4 border-y border-home-rule py-5">
            <p className="flex items-center gap-2 text-sm font-medium text-home-ink">
              <CheckCircle2 className="size-4 text-home-sage-ink" aria-hidden="true" />
              Revision {latestConfirmed.revision.toString()} confirmed
            </p>
            <dl className="mt-5 divide-y divide-home-rule">
              {Object.entries(latestConfirmed.input).map(([label, value]) => (
                <div key={label} className="grid gap-2 py-4 sm:grid-cols-[10rem_1fr] sm:gap-6">
                  <dt className="text-sm capitalize text-home-ink-3">{label}</dt>
                  <dd className="whitespace-pre-wrap text-sm leading-6 text-home-ink">{value || "Not provided"}</dd>
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
            <p className="mt-3 min-h-5 text-sm text-red-700" aria-live="polite">
              {revisionError}
            </p>
          </div>
        ) : (
          <p className="mt-3 text-sm text-home-ink-3">No active brief is available.</p>
        )}
      </section>

      {history.length > 1 ? (
        <section aria-labelledby="history-heading" className="border-t border-home-rule py-8">
          <h2 id="history-heading" className="text-lg font-semibold text-home-ink">Revision history</h2>
          <ol className="mt-4 divide-y divide-home-rule">
            {history.map((item) => (
              <li key={item.briefId} className="flex items-center justify-between gap-4 py-3 text-sm">
                <span className="text-home-ink-2">Revision {item.revision.toString()}</span>
                <span className="capitalize text-home-ink-3">{item.status}</span>
              </li>
            ))}
          </ol>
        </section>
      ) : null}
    </div>
  );
}
