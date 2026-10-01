"use client";

import { PanelRight } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Tabs } from "radix-ui";
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";

import {
  createRevisionAction,
  discardRevisionAction,
  getRevisionAction,
  runChecksAction,
} from "@/app/admin/editorial/_actions/draft";
import { resolveIssueAction } from "@/app/admin/editorial/_actions/review";
import type { EditorialTarget } from "@/lib/editorial/contracts/errors";
import type { EditorialMetadata } from "@/lib/editorial/contracts/metadata";
import type { IdeaDetail, RevisionView } from "@/lib/editorial/contracts/views";
import { buildOutline, claimMarkers, type OutlineEntry } from "@/lib/editorial/editor/outline";
import { hasUnsavedChanges } from "@/lib/editorial/editor/save-controller";
import { slugify } from "@/lib/editorial/markdown/render";
import { formatAbsolute } from "@/lib/editorial/presentation/format";
import type { InspectorTab, WorkspaceTab } from "@/lib/editorial/presentation/filters";
import { cn } from "@/lib/utils";
import { buttonClass } from "../common/primitives";
import { SimulatedWorkerTicker } from "../releases/SimulatedWorkerTicker";
import { ComparePane, type CompareTarget } from "./ComparePane";
import { ConflictPanel } from "./ConflictPanel";
import { DetailsPanel } from "./DetailsPanel";
import { DiscardDraftDialog } from "./DiscardDraftDialog";
import { EvidencePanel } from "./EvidencePanel";
import { HistoryPane } from "./HistoryPane";
import { MarkdownEditor, type MarkdownEditorHandle } from "./MarkdownEditor";
import { PREVIEW_ID_PREFIX, PreviewPane } from "./PreviewPane";
import { useLifecycleControls } from "./LifecycleControls";
import { QualityPanel } from "./QualityPanel";
import type { PublishingContext } from "./ReleasePanel";
import { ReviewInspector } from "./ReviewInspector";
import { describeSaveState } from "./SaveStatus";
import { SectionOutline } from "./SectionOutline";
import { WorkspaceTitleBar, type MenuAction } from "./WorkspaceTitleBar";
import { pressedToggleClass, tabListClass, tabPanelClass, tabTriggerClass } from "./ui";
import { useDraftSaver } from "./useDraftSaver";
import { useUnsavedChangesGuard } from "./useUnsavedChangesGuard";

export type IdeaWorkspaceProps = {
  detail: IdeaDetail;
  revision: RevisionView;
  compareTargets: CompareTarget[];
  nowMs: number;
  initialTab: WorkspaceTab;
  initialInspector: InspectorTab;
  notice: string | null;
  baseHref: string;
  publishing: PublishingContext;
};

/** Focus (and reveal) an element once React has committed the current update. */
function focusSoon(selector: string, block: ScrollLogicalPosition = "nearest") {
  window.requestAnimationFrame(() => {
    const element = document.querySelector<HTMLElement>(selector);
    if (!element) return;
    element.scrollIntoView({ block });
    element.focus({ preventScroll: true });
  });
}

function newKey(): string {
  return crypto.randomUUID();
}

/** Release states the (simulated) worker advances. */
const WORKER_STATES = new Set(["preparing", "publish_requested", "deploying", "verifying", "activating"]);

/** Four inspector tabs must fit a 320px column without wrapping. */
const inspectorTriggerClass = cn(tabTriggerClass, "px-2 sm:px-2");

export function IdeaWorkspace({
  detail,
  revision,
  compareTargets,
  nowMs,
  initialTab,
  initialInspector,
  notice,
  baseHref,
  publishing,
}: IdeaWorkspaceProps) {
  const router = useRouter();
  const [view, setView] = useState(revision);
  // Refreshed page data (after a release, a decision or a change elsewhere)
  // replaces the displayed revision view. The editor's own text is untouched.
  const [viewSource, setViewSource] = useState(revision);
  if (revision !== viewSource) {
    setViewSource(revision);
    setView(revision);
  }
  const { state, controller, reset } = useDraftSaver(revision, setView);
  /** Bumped when the editor restarts from a server copy, so local forms re-initialise. */
  const [generation, setGeneration] = useState(0);
  const [tab, setTab] = useState<WorkspaceTab>(initialTab);
  const [inspector, setInspector] = useState<InspectorTab>(initialInspector);
  const [pane, setPane] = useState<"article" | "inspector">("article");
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [selectedClaim, setSelectedClaim] = useState<string | null>(null);
  const [metadataInvalid, setMetadataInvalid] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const [compareKey, setCompareKey] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [commandError, setCommandError] = useState<string | null>(null);
  const [checks, setChecks] = useState<{ running: boolean; error: string | null }>({ running: false, error: null });
  const [discardOpen, setDiscardOpen] = useState(false);
  const editorRef = useRef<MarkdownEditorHandle>(null);
  const moreRef = useRef<HTMLButtonElement>(null);
  const keys = useRef<{ create: string | null; fork: { at: string; revision: string; carry: string } | null }>({
    create: null,
    fork: null,
  });

  const current = state.current;
  const editable = state.status !== "read_only";
  const unsaved = hasUnsavedChanges(state) || metadataInvalid;
  useUnsavedChangesGuard(unsaved);

  const idea = detail.idea;
  const workingDraft = idea.workingRevision?.kind === "draft" ? idea.workingRevision : null;
  const canFork = view.readOnly && view.kind !== "draft" && !view.discarded && idea.lifecycle !== "trashed" && workingDraft === null;
  const canDiscard = editable && view.kind === "draft" && view.parentRevisionId !== null;

  /* URL state: tabs are shareable and survive a reload. ------------- */
  const syncUrl = useCallback((next: { tab?: WorkspaceTab; inspector?: InspectorTab }) => {
    const url = new URL(window.location.href);
    if (next.tab) url.searchParams.set("tab", next.tab);
    if (next.inspector) url.searchParams.set("inspector", next.inspector);
    window.history.replaceState(null, "", `${url.pathname}${url.search}`);
  }, []);

  const changeTab = useCallback(
    (next: WorkspaceTab) => {
      setTab(next);
      syncUrl({ tab: next });
    },
    [syncUrl],
  );

  const changeInspector = useCallback(
    (next: InspectorTab) => {
      setInspector(next);
      syncUrl({ inspector: next });
    },
    [syncUrl],
  );

  /* Saving ---------------------------------------------------------- */
  const save = useCallback(async () => {
    if (controller.getState().status === "read_only") return;
    await controller.saveNow();
    const next = controller.getState();
    setAnnouncement(next.status === "saved" ? "All changes saved." : describeSaveState(next, metadataInvalid).text);
  }, [controller, metadataInvalid]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && !event.altKey && !event.shiftKey && event.key.toLowerCase() === "s") {
        event.preventDefault();
        void save();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [save]);

  const onMetadata = useCallback((metadata: EditorialMetadata) => controller.edit({ metadata }), [controller]);

  /* Navigation inside the workspace ---------------------------------- */
  const openClaim = useCallback(
    (claimId: string) => {
      setSelectedClaim(claimId);
      setInspector("evidence");
      setInspectorOpen(true);
      setPane("inspector");
      syncUrl({ inspector: "evidence" });
      focusSoon(`[data-claim-card="${CSS.escape(claimId)}"]`);
    },
    [syncUrl],
  );

  const showClaimInArticle = useCallback(
    (claimId: string) => {
      setSelectedClaim(claimId);
      setPane("article");
      changeTab("preview");
      focusSoon(`[data-claim-button="${CSS.escape(claimId)}"]`, "center");
    },
    [changeTab],
  );

  const deferredMarkdown = useDeferredValue(current.markdown);
  const outline = useMemo(() => buildOutline(deferredMarkdown, view.sections), [deferredMarkdown, view.sections]);
  const markers = useMemo(() => claimMarkers(view.claims), [view.claims]);

  const goToSection = useCallback(
    (entry: OutlineEntry) => {
      setPane("article");
      if (tab === "preview") {
        focusSoon(`#${PREVIEW_ID_PREFIX}-${CSS.escape(slugify(entry.title))}`, "start");
        return;
      }
      if (entry.line === null) return;
      const line = entry.line;
      if (tab !== "write") changeTab("write");
      window.requestAnimationFrame(() => editorRef.current?.jumpToLine(line));
      setAnnouncement(`Moved to section ${entry.title}.`);
    },
    [tab, changeTab],
  );

  const goTo = useCallback(
    (target: EditorialTarget) => {
      if (target.kind === "section") {
        const entry = outline.find((candidate) => candidate.key === target.id);
        if (entry) goToSection(entry);
        return;
      }
      if (target.kind === "claim") {
        openClaim(target.id);
        return;
      }
      if (target.kind === "source") {
        setInspector("evidence");
        setInspectorOpen(true);
        setPane("inspector");
        syncUrl({ inspector: "evidence" });
        focusSoon(`[data-source-card="${CSS.escape(target.id)}"]`);
        return;
      }
      if (target.kind === "metadata") {
        setInspectorOpen(true);
        setPane("inspector");
        changeInspector("details");
        return;
      }
      setInspectorOpen(true);
      setPane("inspector");
      changeInspector(target.kind === "check" ? "quality" : "review");
    },
    [outline, goToSection, openClaim, syncUrl, changeInspector],
  );

  /* Commands ---------------------------------------------------------- */
  const runChecks = useCallback(async () => {
    setChecks({ running: true, error: null });
    const result = await runChecksAction({
      ideaId: view.ideaId,
      revisionId: view.id,
      expectedArtifactHash: view.hashes.artifact,
    }).catch(() => null);
    if (!result) {
      setChecks({ running: false, error: "The server could not be reached. Try again." });
      return;
    }
    if (!result.ok) {
      setChecks({ running: false, error: result.error.message });
      return;
    }
    setView(result.value);
    setChecks({ running: false, error: null });
    setAnnouncement("Checks finished. The quality panel is up to date.");
  }, [view.ideaId, view.id, view.hashes.artifact]);

  const createRevision = useCallback(async () => {
    setBusy(true);
    setCommandError(null);
    keys.current.create ??= newKey();
    const result = await createRevisionAction({
      ideaId: view.ideaId,
      fromRevisionId: view.id,
      idempotencyKey: keys.current.create,
      carry: null,
    }).catch(() => null);
    setBusy(false);
    if (!result) {
      setCommandError("The server could not be reached. Try again.");
      return;
    }
    if (!result.ok) {
      keys.current.create = null;
      setCommandError(result.error.message);
      return;
    }
    router.push(`${baseHref}?revision=${result.value.revisionId}&tab=write`);
  }, [view.ideaId, view.id, baseHref, router]);

  const forkWithMine = useCallback(async () => {
    const conflict = state.conflict;
    if (!conflict) return;
    if (metadataInvalid) {
      setCommandError("Fix the metadata errors in Details first; they would be lost otherwise.");
      return;
    }
    setBusy(true);
    setCommandError(null);
    if (keys.current.fork?.at !== conflict.savedAt) {
      keys.current.fork = { at: conflict.savedAt, revision: newKey(), carry: newKey() };
    }
    const result = await createRevisionAction({
      ideaId: view.ideaId,
      fromRevisionId: null,
      idempotencyKey: keys.current.fork.revision,
      carry: { title: current.title, markdown: current.markdown, metadata: current.metadata, idempotencyKey: keys.current.fork.carry },
    }).catch(() => null);
    setBusy(false);
    if (!result) {
      setCommandError("The server could not be reached. Your text is still here; try again.");
      return;
    }
    if (!result.ok) {
      keys.current.fork = null;
      setCommandError(`${result.error.message} Your text is still here.`);
      return;
    }
    router.push(`${baseHref}?revision=${result.value.revisionId}&tab=write`);
  }, [state.conflict, metadataInvalid, view.ideaId, current, baseHref, router]);

  /** Start the editor over from a server view (conflict resolved, or the draft was approved). */
  const restartFrom = useCallback(
    (next: RevisionView) => {
      setView(next);
      reset(next);
      setMetadataInvalid(false);
      setGeneration((value) => value + 1);
    },
    [reset],
  );

  /** Conflict: take the newer server copy. This editor's unsaved text is dropped on purpose. */
  const takeTheirs = useCallback(async () => {
    setBusy(true);
    setCommandError(null);
    const result = await getRevisionAction({ ideaId: view.ideaId, revisionId: view.id }).catch(() => null);
    setBusy(false);
    if (!result || !result.ok) {
      setCommandError(result ? result.error.message : "The server could not be reached. Your text is still here; try again.");
      return;
    }
    if (!result.value.isWorking) {
      // Discarded or replaced elsewhere: open the idea's current working revision.
      router.replace(baseHref);
      return;
    }
    restartFrom(result.value);
    setAnnouncement("Loaded the newer saved copy. Your unsaved text was discarded.");
  }, [view.ideaId, view.id, restartFrom, router, baseHref]);

  const discard = useCallback(
    async (reason: string): Promise<string | null> => {
      const result = await discardRevisionAction({
        ideaId: view.ideaId,
        revisionId: view.id,
        expectedVersion: controller.getState().baseVersion,
        reason,
      }).catch(() => null);
      if (!result) return "The server could not be reached. Try again.";
      if (!result.ok) return result.error.message;
      controller.markReadOnly("This draft was discarded.");
      router.push(`${baseHref}?revision=${result.value.workingRevisionId}`);
      return null;
    },
    [view.ideaId, view.id, controller, baseHref, router],
  );

  /* Title bar actions -------------------------------------------------- */
  const lifecycle = useLifecycleControls({
    detail,
    view,
    unsaved,
    moreRef,
    onAnnounce: setAnnouncement,
    onRestart: restartFrom,
    strongAuth: { fresh: publishing.strongAuthFresh, mechanism: publishing.strongAuthMechanism },
  });
  const primaryAction = lifecycle.primaryAction ?? (editable ? (
    <button type="button" className={buttonClass.primary} aria-keyshortcuts="Control+S Meta+S" onClick={() => void save()}>
      Save
    </button>
  ) : canFork ? (
    <button type="button" className={buttonClass.primary} onClick={() => void createRevision()} disabled={busy}>
      {busy ? "Creating…" : "Edit in a new revision"}
    </button>
  ) : workingDraft && workingDraft.id !== view.id ? (
    <Link href={`${baseHref}?revision=${workingDraft.id}&tab=write`} className={buttonClass.primary}>
      Open working draft v{workingDraft.number}
    </Link>
  ) : null);

  const runChecksBlocked =
    state.status === "saved" || state.status === "read_only" ? null : "Save first: checks run on the saved copy.";
  const menuActions: MenuAction[] = [
    {
      key: "checks",
      label: checks.running ? "Running checks…" : "Run checks",
      disabled: runChecksBlocked !== null || checks.running,
      onSelect: () => {
        setInspectorOpen(true);
        setPane("inspector");
        changeInspector("quality");
        void runChecks();
      },
    },
    {
      key: "review",
      label: "Open review checklist",
      onSelect: () => {
        setInspectorOpen(true);
        setPane("inspector");
        changeInspector("review");
      },
    },
    ...(compareTargets.length > 0
      ? [{ key: "compare", label: `Compare with ${compareTargets[0].label}`, onSelect: () => changeTab("compare") }]
      : []),
    ...(canDiscard
      ? [{ key: "discard", label: `Discard draft v${view.number}…`, destructive: true, onSelect: () => setDiscardOpen(true) }]
      : []),
    ...lifecycle.menuActions,
  ];

  /** Why review commands are unavailable, if they are. The server re-checks all of it. */
  const reviewDisabledReason =
    idea.lifecycle === "trashed"
      ? "restore the idea first."
      : !view.isWorking
        ? "only the working revision can be reviewed. Open it from History."
        : unsaved
          ? "save your edits first. A review attests the saved copy, not your screen."
          : null;
  const liveMarkdown =
    idea.liveRevision?.id === view.id
      ? view.markdown
      : (compareTargets.find((target) => target.key === idea.liveRevision?.id)?.markdown ?? null);

  const resolveIssue = useCallback(
    async (issueId: string, dependencyHash: string, note: string): Promise<string | null> => {
      const result = await resolveIssueAction({ ideaId: view.ideaId, revisionId: view.id, issueId, dependencyHash, note }).catch(() => null);
      if (!result) return "The server could not be reached. Nothing changed; try again.";
      if (!result.ok) return result.error.message;
      setView(result.value.view);
      setAnnouncement("Issue resolved with your note.");
      return null;
    },
    [view.ideaId, view.id],
  );

  const conflictTargets: CompareTarget[] = state.conflict
    ? [{ key: "theirs", label: "Newer saved copy", title: state.conflict.title, markdown: state.conflict.markdown }, ...compareTargets]
    : compareTargets;

  const alertText =
    state.status === "offline" || state.status === "error" || state.status === "conflict"
      ? describeSaveState(state, metadataInvalid).text
      : "";

  const sectionsReviewed = view.sections.filter((section) => section.review.status === "reviewed").length;
  const claimsOpen = view.reviewItems.filter((item) => item.kind === "claim" && item.status !== "reviewed").length;
  const blockers = view.issues.filter((issue) => issue.severity === "blocker").length;

  const mobileEvidence = pane === "inspector" && (inspector === "evidence" || inspector === "quality");
  const mobileReview = pane === "inspector" && (inspector === "review" || inspector === "details");

  return (
    <div className="flex min-h-full flex-col">
      <WorkspaceTitleBar
        detail={detail}
        view={view}
        title={current.title}
        saveState={state}
        metadataInvalid={metadataInvalid}
        primaryAction={primaryAction}
        menuActions={menuActions}
        moreRef={moreRef}
        onRetry={() => void controller.retryNow()}
        onShowConflict={() => focusSoon("#conflict-panel")}
      />

      <WorkspaceBanners detail={detail} view={view} notice={notice} commandError={state.conflict ? null : commandError} />
      {detail.releases.some((release) => release.simulated && WORKER_STATES.has(release.state)) ? (
        <div className="px-4 pt-4 sm:px-6">
          <SimulatedWorkerTicker active />
        </div>
      ) : null}

      {state.conflict ? (
        <ConflictPanel
          conflict={state.conflict}
          busy={busy}
          error={commandError}
          onCompare={() => {
            setCompareKey("theirs");
            setPane("article");
            changeTab("compare");
          }}
          onKeepMine={() => void controller.keepMine()}
          onUseTheirs={() => void takeTheirs()}
          onForkWithMine={() => void forkWithMine()}
          onDiscardMine={() => void takeTheirs()}
        />
      ) : null}

      <div role="group" aria-label="Show" className="flex gap-2 px-4 pt-4 md:hidden">
        <button
          type="button"
          aria-pressed={pane === "article"}
          aria-controls="workspace-article"
          className={cn(pressedToggleClass, "flex-1")}
          onClick={() => setPane("article")}
        >
          Article
        </button>
        <button
          type="button"
          aria-pressed={mobileEvidence}
          aria-controls="workspace-inspector"
          className={cn(pressedToggleClass, "flex-1")}
          onClick={() => {
            setPane("inspector");
            changeInspector("evidence");
          }}
        >
          Evidence
        </button>
        <button
          type="button"
          aria-pressed={mobileReview}
          aria-controls="workspace-inspector"
          className={cn(pressedToggleClass, "flex-1")}
          onClick={() => {
            setPane("inspector");
            changeInspector("review");
          }}
        >
          Review
        </button>
      </div>

      <div
        className={cn(
          "flex-1 px-4 pb-6 pt-4 sm:px-6 md:grid md:items-start md:gap-6",
          inspectorOpen ? "md:grid-cols-[minmax(0,1fr)_20rem]" : "md:grid-cols-1",
          "xl:grid-cols-[minmax(0,1fr)_340px]",
        )}
      >
        <section id="workspace-article" aria-label="Article" className={cn("min-w-0", pane === "article" ? "block" : "hidden md:block")}>
          <Tabs.Root value={tab} onValueChange={(value) => changeTab(value as WorkspaceTab)}>
            <div className="flex items-end justify-between gap-2 border-b border-(--ed-border)">
              <Tabs.List aria-label="Article views" className={tabListClass}>
                <Tabs.Trigger value="write" className={tabTriggerClass}>
                  Write
                </Tabs.Trigger>
                <Tabs.Trigger value="preview" className={tabTriggerClass}>
                  Preview
                </Tabs.Trigger>
                <Tabs.Trigger value="compare" className={tabTriggerClass}>
                  Compare
                </Tabs.Trigger>
                <Tabs.Trigger value="history" className={tabTriggerClass}>
                  History
                </Tabs.Trigger>
              </Tabs.List>
              <button
                type="button"
                aria-expanded={inspectorOpen}
                aria-controls="workspace-inspector"
                className={cn(buttonClass.ghost, "mb-1 hidden md:inline-flex xl:hidden")}
                onClick={() => setInspectorOpen((open) => !open)}
              >
                <PanelRight aria-hidden="true" className="size-4" />
                {inspectorOpen ? "Hide inspector" : "Show inspector"}
              </button>
            </div>

            <Tabs.Content value="write" forceMount className={cn(tabPanelClass, "flex flex-col gap-4 pt-4 data-[state=inactive]:hidden")}>
              <SectionOutline entries={outline} onSelect={goToSection} />
              {view.readOnlyReason ? (
                <p className="rounded-md border border-(--ed-border-strong) bg-(--ed-sunk) px-3 py-2 text-sm">{view.readOnlyReason}</p>
              ) : null}
              <MarkdownEditor
                ref={editorRef}
                title={current.title}
                markdown={current.markdown}
                readOnly={!editable}
                onTitle={(title) => controller.edit({ title })}
                onMarkdown={(markdown) => controller.edit({ markdown })}
                onNavigate={setAnnouncement}
              />
            </Tabs.Content>

            <Tabs.Content value="preview" className={cn(tabPanelClass, "flex flex-col gap-4 pt-4")}>
              <SectionOutline entries={outline} onSelect={goToSection} />
              <PreviewPane
                title={current.title}
                markdown={current.markdown}
                metadata={current.metadata}
                claims={markers}
                onClaim={openClaim}
              />
            </Tabs.Content>

            <Tabs.Content value="compare" className={cn(tabPanelClass, "pt-4")}>
              <ComparePane
                key={compareKey ?? "default"}
                targets={conflictTargets}
                current={{ title: current.title, markdown: current.markdown }}
                currentLabel={editable ? `this draft (v${view.number}, including unsaved text)` : `v${view.number}`}
                initialKey={compareKey}
              />
            </Tabs.Content>

            <Tabs.Content value="history" className={cn(tabPanelClass, "pt-4")}>
              <HistoryPane
                revisions={detail.revisions}
                selectedId={view.id}
                hrefFor={(revisionId) => `${baseHref}?revision=${revisionId}`}
                nowMs={nowMs}
              />
            </Tabs.Content>
          </Tabs.Root>
        </section>

        <aside
          id="workspace-inspector"
          aria-label="Inspector"
          className={cn(
            "min-w-0",
            pane === "inspector" ? "block" : "hidden",
            inspectorOpen ? "md:block" : "md:hidden",
            "xl:sticky xl:top-0 xl:block xl:max-h-dvh xl:overflow-y-auto xl:pb-6",
          )}
        >
          <Tabs.Root value={inspector} onValueChange={(value) => changeInspector(value as InspectorTab)}>
            <Tabs.List aria-label="Inspector" className={cn(tabListClass, "border-b border-(--ed-border)")}>
              <Tabs.Trigger value="evidence" className={inspectorTriggerClass}>
                Evidence
              </Tabs.Trigger>
              <Tabs.Trigger value="quality" className={inspectorTriggerClass}>
                Quality
                {blockers > 0 ? (
                  <span className="font-mono text-xs text-(--ed-danger)">
                    {blockers}
                    <span className="sr-only"> blocking</span>
                  </span>
                ) : null}
              </Tabs.Trigger>
              <Tabs.Trigger value="review" className={inspectorTriggerClass}>
                Review
              </Tabs.Trigger>
              <Tabs.Trigger value="details" className={inspectorTriggerClass}>
                Details
              </Tabs.Trigger>
            </Tabs.List>
            <Tabs.Content value="evidence" className={cn(tabPanelClass, "pt-4")}>
              <EvidencePanel
                claims={view.claims}
                sources={view.sources}
                selectedClaimId={selectedClaim}
                onSelectClaim={setSelectedClaim}
                onShowInArticle={showClaimInArticle}
              />
            </Tabs.Content>
            <Tabs.Content value="quality" className={cn(tabPanelClass, "pt-4")}>
              <QualityPanel
                view={view}
                nowMs={nowMs}
                resolve={{ disabledReason: reviewDisabledReason, onResolve: resolveIssue }}
                runChecks={{ disabledReason: runChecksBlocked, running: checks.running, error: checks.error, onRun: () => void runChecks() }}
                onGoTo={goTo}
              />
            </Tabs.Content>
            <Tabs.Content value="review" className={cn(tabPanelClass, "pt-4")}>
              <ReviewInspector
                detail={detail}
                view={view}
                onView={setView}
                disabledReason={reviewDisabledReason}
                liveMarkdown={liveMarkdown}
                publishing={publishing}
                baseHref={baseHref}
                nowMs={nowMs}
                onGoTo={goTo}
                onAnnounce={setAnnouncement}
                onRestart={restartFrom}
              />
            </Tabs.Content>
            <Tabs.Content value="details" className={cn(tabPanelClass, "pt-4")}>
              <DetailsPanel
                key={generation}
                detail={detail}
                view={view}
                metadata={current.metadata}
                readOnly={!editable}
                onMetadata={onMetadata}
                onValidityChange={setMetadataInvalid}
              />
            </Tabs.Content>
          </Tabs.Root>
        </aside>
      </div>

      <div className="sticky bottom-0 z-10 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-(--ed-border) bg-(--ed-surface) px-4 py-2 text-xs sm:px-6 md:text-sm">
        <p className="text-(--ed-text-2)">
          <span className="font-mono tabular-nums text-(--ed-text)">
            {sectionsReviewed}/{view.sections.length}
          </span>{" "}
          sections reviewed ·{" "}
          <span className="font-mono tabular-nums text-(--ed-text)">{claimsOpen}</span> claim{claimsOpen === 1 ? "" : "s"} to review ·{" "}
          <span className={cn("font-mono tabular-nums", blockers > 0 ? "text-(--ed-danger)" : "text-(--ed-text)")}>{blockers}</span> blocking
          issue{blockers === 1 ? "" : "s"}
        </p>
        <button
          type="button"
          // Phones already have the Review switch at the top of the workspace.
          className={cn(buttonClass.secondary, "hidden md:inline-flex")}
          onClick={() => {
            setInspectorOpen(true);
            setPane("inspector");
            changeInspector("review");
            focusSoon("#review-checklist");
          }}
        >
          Open review checklist
        </button>
      </div>

      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>
      <p role="alert" className="sr-only">
        {alertText}
      </p>

      {lifecycle.dialogs}
      {canDiscard ? (
        <DiscardDraftDialog
          open={discardOpen}
          onOpenChange={setDiscardOpen}
          revisionNumber={view.number}
          hasUnsavedChanges={unsaved}
          onConfirm={discard}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            moreRef.current?.focus();
          }}
        />
      ) : null}
    </div>
  );
}

/** End free text with exactly one full stop. */
function sentence(text: string): string {
  const trimmed = text.trim();
  return /[.!?…]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

function WorkspaceBanners({
  detail,
  view,
  notice,
  commandError,
}: {
  detail: IdeaDetail;
  view: RevisionView;
  notice: string | null;
  commandError: string | null;
}) {
  const banners: Array<{ key: string; tone: "info" | "warning" | "danger"; text: string }> = [];
  if (notice) banners.push({ key: "notice", tone: "info", text: notice });
  if (detail.trash) {
    banners.push({
      key: "trash",
      tone: "warning",
      text: `In Trash since ${formatAbsolute(detail.trash.trashedAt)}. Reason: ${sentence(detail.trash.reason)} Restore it to edit or review.`,
    });
  }
  if (view.quarantine) {
    banners.push({ key: "quarantine", tone: "danger", text: `Quarantined: ${view.quarantine.reasons.join(" ")}` });
  }
  if (view.kind === "legacy_snapshot") {
    banners.push({
      key: "legacy",
      tone: "info",
      text: "Live before this workspace existed; its evidence has not been reverified. Editing creates a private revision and the live page stays unchanged.",
    });
  }
  if (view.approval?.status === "revoked") {
    banners.push({
      key: "revoked",
      tone: "warning",
      text: `Approval revoked${view.approval.revokedAt ? ` ${formatAbsolute(view.approval.revokedAt)}` : ""}: ${sentence(view.approval.revokedReason ?? "the approved content or policy changed")}`,
    });
  }
  if (banners.length === 0 && !commandError) return null;
  const tones = {
    info: "border-(--ed-info) bg-(--ed-info-bg) text-(--ed-info)",
    warning: "border-(--ed-warning) bg-(--ed-warning-bg) text-(--ed-warning)",
    danger: "border-(--ed-danger) bg-(--ed-danger-bg) text-(--ed-danger)",
  } as const;
  return (
    <div className="flex flex-col gap-2 px-4 pt-4 sm:px-6">
      {commandError ? (
        <p role="alert" className={cn("rounded-md border px-3 py-2 text-sm", tones.danger)}>
          {commandError}
        </p>
      ) : null}
      {banners.length > 0 ? (
        <ul aria-label="Notices" className="flex flex-col gap-2">
          {banners.map((banner) => (
            <li key={banner.key} className={cn("rounded-md border px-3 py-2 text-sm", tones[banner.tone])}>
              {banner.text}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
