import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { ListSkeleton } from "@/components/admin/editorial/common/ListSkeleton";
import { ErrorState, PageBody } from "@/components/admin/editorial/common/primitives";
import { EDITORIAL_BASE } from "@/components/admin/editorial/shell/nav-items";
import type { CompareTarget } from "@/components/admin/editorial/workspace/ComparePane";
import { IdeaWorkspace } from "@/components/admin/editorial/workspace/IdeaWorkspace";
import { editorialIdSchema } from "@/lib/editorial/contracts/primitives";
import type { EditorialRepository } from "@/lib/editorial/contracts/repository";
import { parseWorkspaceParams, type SearchParamsRecord } from "@/lib/editorial/presentation/filters";
import { assertEditorialRoutesEnabled } from "@/lib/editorial/runtime/route-guard";
import { requireEditorialWorkspace } from "@/lib/editorial/runtime/workspace";

export async function generateMetadata(): Promise<Metadata> {
  assertEditorialRoutesEnabled();
  return { title: { absolute: "Idea workspace — Editorial" } };
}

// A private, per-request tool: navigation into it may block on the server.
// (Instant-navigation validation otherwise flags the shared root layout's
// pathname read, which this slice may not edit.)
export const instant = false;

type Params = Promise<{ ideaId: string }>;

export default function IdeaWorkspacePage({ params, searchParams }: { params: Params; searchParams: Promise<SearchParamsRecord> }) {
  assertEditorialRoutesEnabled();
  return (
    <Suspense
      fallback={
        <PageBody>
          <ListSkeleton label="Loading…" rows={10} />
        </PageBody>
      }
    >
      <WorkspaceContent params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function compareTarget(
  repository: EditorialRepository,
  ideaId: string,
  revisionId: string,
  label: string,
): Promise<CompareTarget | null> {
  const loaded = await repository.getRevision(ideaId, revisionId);
  if (!loaded.ok) return null;
  return { key: revisionId, label, title: loaded.value.title, markdown: loaded.value.markdown };
}

async function WorkspaceContent({ params, searchParams }: { params: Params; searchParams: Promise<SearchParamsRecord> }) {
  const workspace = await requireEditorialWorkspace();
  const { ideaId } = await params;
  if (!editorialIdSchema.safeParse(ideaId).success) notFound();
  const query = parseWorkspaceParams(await searchParams);
  const { repository } = workspace;

  const detail = await repository.getIdea(ideaId);
  if (!detail.ok) {
    if (detail.error.code === "NOT_FOUND") notFound();
    return (
      <PageBody>
        <ErrorState title="This idea could not be loaded">
          {detail.error.message} <span className="font-mono">({detail.error.code})</span>
        </ErrorState>
      </PageBody>
    );
  }
  const { idea, revisions } = detail.value;
  const requested = query.revisionId ? revisions.find((candidate) => candidate.id === query.revisionId) ?? null : null;
  const fallbackId = idea.workingRevision?.id ?? idea.liveRevision?.id ?? [...revisions].sort((a, b) => b.number - a.number)[0]?.id ?? null;
  const revisionId = requested?.id ?? fallbackId;
  if (!revisionId) notFound();
  const notice =
    query.revisionId && !requested ? "That revision does not belong to this idea, so the current working revision is shown." : null;

  const loaded = await repository.getRevision(ideaId, revisionId);
  if (!loaded.ok) {
    return (
      <PageBody>
        <ErrorState title="This revision could not be loaded">
          {loaded.error.message} <span className="font-mono">({loaded.error.code})</span>
        </ErrorState>
      </PageBody>
    );
  }
  const revision = loaded.value;

  // Compare against the live copy, the parent revision and (when viewing an
  // older revision) the working revision. Duplicates are dropped.
  const candidates: Array<[string, string]> = [];
  if (idea.liveRevision && idea.liveRevision.id !== revision.id) {
    candidates.push([idea.liveRevision.id, `Live v${idea.liveRevision.number}`]);
  }
  const parent = revision.parentRevisionId ? revisions.find((candidate) => candidate.id === revision.parentRevisionId) : undefined;
  if (parent && !candidates.some(([id]) => id === parent.id)) candidates.push([parent.id, `Previous v${parent.number}`]);
  if (idea.workingRevision && idea.workingRevision.id !== revision.id && !candidates.some(([id]) => id === idea.workingRevision?.id)) {
    candidates.push([idea.workingRevision.id, `Working v${idea.workingRevision.number}`]);
  }
  const compareTargets = (
    await Promise.all(candidates.map(([id, label]) => compareTarget(repository, ideaId, id, label)))
  ).filter((target): target is CompareTarget => target !== null);

  // Publishing context for the confirmation dialog; the server re-checks both on publish.
  const settings = await repository.getSettings();
  const publishing = settings.ok
    ? {
        strongAuthFresh: settings.value.strongAuth.fresh,
        strongAuthMechanism: settings.value.strongAuth.mechanism,
        killSwitchEngaged: settings.value.publishing.killSwitchEngaged,
      }
    : { strongAuthFresh: false, strongAuthMechanism: "unavailable", killSwitchEngaged: true };

  return (
    <IdeaWorkspace
      // Only another revision starts a fresh editor. A refresh must never
      // remount it and drop unsaved text; approval, trash and restore restart
      // the editor in place from the server's view instead.
      key={revision.id}
      detail={detail.value}
      revision={revision}
      compareTargets={compareTargets}
      nowMs={workspace.nowMs}
      initialTab={query.tab ?? (revision.readOnly ? "preview" : "write")}
      initialInspector={query.inspector ?? "evidence"}
      notice={notice}
      baseHref={`${EDITORIAL_BASE}/ideas/${idea.id}`}
      publishing={publishing}
    />
  );
}
