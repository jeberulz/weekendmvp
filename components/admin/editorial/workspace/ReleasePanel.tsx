"use client";

import Link from "next/link";
import { useId, useMemo, useRef, useState, type FormEvent } from "react";
import { flushSync } from "react-dom";

import { DialogClose } from "@/components/ui/dialog";
import { EDITORIAL_LIMITS } from "@/lib/editorial/contracts/limits";
import { SECTION_DEFINITIONS } from "@/lib/editorial/contracts/sections";
import { RELEASE_OPERATION_LABELS, isReleaseInFlight } from "@/lib/editorial/contracts/states";
import type { IdeaDetail, ReleaseView, RevisionView } from "@/lib/editorial/contracts/views";
import { changedSections, diffLines } from "@/lib/editorial/domain/diff";
import { truncateText } from "@/lib/editorial/editor/outline";
import { formatAbsolute, shortHash } from "@/lib/editorial/presentation/format";
import { EditorialDialog } from "../common/EditorialDialog";
import { ReasonDialog } from "../common/ReasonDialog";
import { StrongAuthStep, isReauthMessage } from "../common/StrongAuthStep";
import { Time, buttonClass, linkClass } from "../common/primitives";
import { ReleaseCard } from "../releases/ReleaseCard";
import { EDITORIAL_BASE } from "../shell/nav-items";
import { smallButtonClass } from "./ui";

export type PublishingContext = {
  strongAuthFresh: boolean;
  strongAuthMechanism: string;
  killSwitchEngaged: boolean;
};

type Command<T = void> = (input: T) => Promise<string | null>;

/** The release this idea is currently live on, if any. */
export function liveReleaseOf(detail: IdeaDetail): ReleaseView | null {
  const liveId = detail.idea.liveRevision?.id;
  if (!liveId || detail.idea.publication !== "live") return null;
  return (
    [...detail.releases]
      .filter((release) => release.state === "succeeded" && release.operation !== "unpublish" && release.revisionId === liveId)
      .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))[0] ?? null
  );
}

/**
 * Release controls for one idea. Approval and publication are separate:
 * this panel prepares a preview of the approved revision, confirms the exact
 * release, and recovers failed or uncertain ones. Everything is simulated in
 * the local demo.
 */
export function ReleasePanel({
  detail,
  view,
  liveMarkdown,
  nowMs,
  publishing,
  baseHref,
  onPrepare,
  onPublish,
  onCancel,
  onRetry,
  onReconcile,
  onRollback,
  onLoadRevision,
}: {
  detail: IdeaDetail;
  view: RevisionView;
  liveMarkdown: string | null;
  nowMs: number;
  publishing: PublishingContext;
  baseHref: string;
  onPrepare: Command<string>;
  onPublish: Command<ReleaseView>;
  onCancel: Command<{ release: ReleaseView; reason: string }>;
  onRetry: Command<ReleaseView>;
  onReconcile: Command<ReleaseView>;
  onRollback: Command<{ target: ReleaseView; reason: string }>;
  onLoadRevision(revisionId: string): Promise<RevisionView | string>;
}) {
  const idea = detail.idea;
  const approval = detail.activeApproval?.status === "active" ? detail.activeApproval : null;
  const releases = detail.releases.filter((release) => release.operation !== "legacy_baseline");
  const inFlight = releases.filter((release) => isReleaseInFlight(release.state));
  const latest = [...releases].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))[0] ?? null;
  const shown = inFlight.length > 0 ? inFlight : latest ? [latest] : [];
  const trashed = idea.lifecycle === "trashed";
  const liveRelease = liveReleaseOf(detail);
  const rollbackTargets = detail.releases.filter(
    (release) =>
      release.state === "succeeded" &&
      release.operation !== "unpublish" &&
      release.revisionId !== null &&
      release.revisionId !== idea.liveRevision?.id,
  );
  const [prepareError, setPrepareError] = useState<string | null>(null);
  const [preparing, setPreparing] = useState(false);

  return (
    <section
      id="release"
      tabIndex={-1}
      aria-labelledby="release-heading"
      className="flex flex-col gap-3 rounded-lg border border-(--ed-border) bg-(--ed-surface) px-3 py-3 outline-hidden focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-(--ed-focus)"
    >
      <h2 id="release-heading" className="text-sm font-semibold">
        Release
      </h2>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
        <dt className="text-(--ed-text-2)">Public page</dt>
        <dd className="font-mono break-all">/ideas/{idea.slug}</dd>
        <dt className="text-(--ed-text-2)">Live</dt>
        <dd>
          {idea.liveRevision ? (
            <>
              v{idea.liveRevision.number} since <Time iso={idea.liveRevision.releasedAt} nowMs={nowMs} />
            </>
          ) : idea.publication === "unpublished" ? (
            "Unpublished"
          ) : (
            "Never published"
          )}
        </dd>
        <dt className="text-(--ed-text-2)">Approval</dt>
        <dd>
          {approval
            ? `v${approval.revisionNumber} approved ${formatAbsolute(approval.approvedAt)} by ${approval.approvedBy.label}`
            : "No active approval"}
        </dd>
      </dl>
      <p className="text-xs text-(--ed-text-2)">Local demo: releases are simulated. Nothing is deployed and the public site never changes.</p>

      {shown.map((release) => (
        <ReleaseCard
          key={release.id}
          release={release}
          nowMs={nowMs}
          headingLevel="h3"
          liveRegion
          actions={
            <ReleaseActions
              release={release}
              view={view}
              detail={detail}
              liveMarkdown={liveMarkdown}
              publishing={publishing}
              baseHref={baseHref}
              onPublish={onPublish}
              onCancel={onCancel}
              onRetry={onRetry}
              onReconcile={onReconcile}
            />
          }
        />
      ))}

      <div className="flex flex-wrap items-center gap-2">
        {approval && approval.revisionId !== idea.liveRevision?.id && inFlight.length === 0 && !trashed ? (
          <button
            type="button"
            className={smallButtonClass}
            disabled={preparing}
            onClick={async () => {
              setPreparing(true);
              setPrepareError(await onPrepare(approval.revisionId));
              setPreparing(false);
            }}
          >
            {preparing ? "Preparing…" : `Prepare preview of v${approval.revisionNumber}`}
          </button>
        ) : null}
        {liveRelease && rollbackTargets.length > 0 && inFlight.length === 0 ? (
          <RollbackDialog
            strongAuth={{ fresh: publishing.strongAuthFresh, mechanism: publishing.strongAuthMechanism }}
            targets={rollbackTargets}
            liveMarkdown={liveMarkdown}
            liveNumber={idea.liveRevision?.number ?? null}
            onLoadRevision={onLoadRevision}
            onRollback={onRollback}
          />
        ) : null}
        <Link href={`${EDITORIAL_BASE}/releases`} className={`${linkClass} text-sm`}>
          All releases
        </Link>
      </div>
      {prepareError ? (
        <p role="alert" className="text-sm text-(--ed-danger)">
          {prepareError}
        </p>
      ) : null}
      {!approval && !trashed ? (
        <p className="text-xs text-(--ed-text-2)">Approve a revision to prepare a release.</p>
      ) : null}
    </section>
  );
}

function ReleaseActions({
  release,
  view,
  detail,
  liveMarkdown,
  publishing,
  baseHref,
  onPublish,
  onCancel,
  onRetry,
  onReconcile,
}: {
  release: ReleaseView;
  view: RevisionView;
  detail: IdeaDetail;
  liveMarkdown: string | null;
  publishing: PublishingContext;
  baseHref: string;
  onPublish: Command<ReleaseView>;
  onCancel: Command<{ release: ReleaseView; reason: string }>;
  onRetry: Command<ReleaseView>;
  onReconcile: Command<ReleaseView>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = async (command: () => Promise<string | null>) => {
    setBusy(true);
    setError(null);
    setError(await command());
    setBusy(false);
  };
  const actions = release.availableActions;
  if (actions.length === 0) return null;
  return (
    <>
      {actions.includes("publish") ? (
        release.revisionId === view.id ? (
          <PublishDialog
            release={release}
            view={view}
            detail={detail}
            liveMarkdown={liveMarkdown}
            publishing={publishing}
            onPublish={onPublish}
          />
        ) : (
          <Link href={`${baseHref}?revision=${release.revisionId}&inspector=review`} className={buttonClass.primary}>
            Open v{release.revisionNumber} to publish
          </Link>
        )
      ) : null}
      {actions.includes("retry") ? (
        <button type="button" className={smallButtonClass} disabled={busy} onClick={() => void run(() => onRetry(release))}>
          Retry
        </button>
      ) : null}
      {actions.includes("reconcile") ? (
        <button type="button" className={smallButtonClass} disabled={busy} onClick={() => void run(() => onReconcile(release))}>
          Reconcile from probes
        </button>
      ) : null}
      {actions.includes("cancel") ? (
        <ReasonDialog
          title="Cancel this release?"
          description="The live page stays as it is. The release stays in history as cancelled."
          label="Reason"
          maxLength={EDITORIAL_LIMITS.reasonChars}
          confirmLabel="Cancel release"
          dismissLabel="Keep the release"
          tone="danger"
          trigger={
            <button type="button" className={smallButtonClass} disabled={busy}>
              Cancel release…
            </button>
          }
          onConfirm={(reason) => onCancel({ release, reason })}
        />
      ) : null}
      {error ? (
        <p role="alert" className="basis-full text-sm text-(--ed-danger)">
          {error}
        </p>
      ) : null}
      {isReauthMessage(error) ? (
        <div className="basis-full">
          <StrongAuthStep fresh={false} mechanism={publishing.strongAuthMechanism} onConfirmed={() => setError(null)} />
        </div>
      ) : null}
    </>
  );
}

function PublishDialog({
  release,
  view,
  detail,
  liveMarkdown,
  publishing,
  onPublish,
}: {
  release: ReleaseView;
  view: RevisionView;
  detail: IdeaDetail;
  liveMarkdown: string | null;
  publishing: PublishingContext;
  onPublish: Command<ReleaseView>;
}) {
  const [open, setOpen] = useState(false);
  const [fresh, setFresh] = useState(publishing.strongAuthFresh);
  const submitRef = useRef<HTMLButtonElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const changes = useMemo(() => {
    if (liveMarkdown === null) return null;
    const diff = diffLines(liveMarkdown, view.markdown);
    const titles = changedSections(diff, liveMarkdown, view.markdown);
    const keys = SECTION_DEFINITIONS.filter((section) => titles.includes(section.title)).map((section) => section.key);
    return { titles, claims: view.claims.filter((claim) => (keys as string[]).includes(claim.section)) };
  }, [liveMarkdown, view.markdown, view.claims]);
  const passed = view.checks.filter((check) => check.outcome === "pass").length;
  const blockers = view.issues.filter((issue) => issue.severity === "blocker").length;
  const previous = detail.idea.liveRevision;

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const failure = await onPublish(release);
    setBusy(false);
    if (!failure) {
      setOpen(false);
      return;
    }
    if (isReauthMessage(failure)) setFresh(false);
    setError(failure);
  };

  return (
    <EditorialDialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setError(null);
      }}
      title={`Publish v${release.revisionNumber}?`}
      description="Check exactly what will go live. The release runs in stages and can be cancelled until activation."
      trigger={
        <button type="button" className={buttonClass.primary}>
          Publish v{release.revisionNumber}…
        </button>
      }
    >
      <form onSubmit={submit} noValidate className="flex flex-col gap-3">
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 rounded-md border border-(--ed-border) px-3 py-2 text-sm">
          <dt className="text-(--ed-text-2)">Revision</dt>
          <dd>
            v{view.number} · artifact <span className="font-mono">{shortHash(view.hashes.artifact)}</span>
          </dd>
          <dt className="text-(--ed-text-2)">Type</dt>
          <dd>{RELEASE_OPERATION_LABELS[release.operation]}</dd>
          <dt className="text-(--ed-text-2)">Public URL</dt>
          <dd className="font-mono break-all">
            {release.publicPath} <span className="font-sans text-xs text-(--ed-text-2)">(not changed in the local demo)</span>
          </dd>
          <dt className="text-(--ed-text-2)">Replaces</dt>
          <dd>{previous ? `Live v${previous.number}` : "Nothing: first publication"}</dd>
          <dt className="text-(--ed-text-2)">Changes</dt>
          <dd>
            {changes === null
              ? "Everything is new."
              : changes.titles.length === 0
                ? "No section text changed (metadata or evidence only)."
                : `Sections: ${changes.titles.join(", ")}`}
            {changes && changes.claims.length > 0 ? (
              <ul className="mt-1 list-disc pl-4 text-xs text-(--ed-text-2)">
                {changes.claims.slice(0, 8).map((claim) => (
                  <li key={claim.id}>{truncateText(claim.text, 80)}</li>
                ))}
              </ul>
            ) : null}
          </dd>
          <dt className="text-(--ed-text-2)">Checks</dt>
          <dd>
            {view.policy.checksCurrent ? "Current" : "Out of date"} · {passed} passed · {blockers} blocking · policy{" "}
            <span className="font-mono">{view.policy.version}</span>
          </dd>
          <dt className="text-(--ed-text-2)">Approval</dt>
          <dd>{view.approval ? `${formatAbsolute(view.approval.approvedAt)} by ${view.approval.approvedBy.label}` : "None"}</dd>
        </dl>

        {publishing.killSwitchEngaged ? (
          <p className="rounded-md border border-(--ed-danger) bg-(--ed-danger-bg) px-3 py-2 text-sm text-(--ed-danger)">
            The publishing kill switch is on. New activations are refused until it is released in Settings.
          </p>
        ) : null}

        <StrongAuthStep
          fresh={fresh}
          mechanism={publishing.strongAuthMechanism}
          onConfirmed={() => {
            // The confirm button goes away: continue on the Publish button.
            flushSync(() => setFresh(true));
            submitRef.current?.focus();
          }}
        />

        {error ? (
          <p role="alert" className="text-sm text-(--ed-danger)">
            {error}
          </p>
        ) : null}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <DialogClose asChild>
            <button type="button" className={buttonClass.secondary}>
              Not now
            </button>
          </DialogClose>
          <button ref={submitRef} type="submit" className={buttonClass.primary} disabled={busy || !fresh}>
            {busy ? "Requesting…" : `Publish v${release.revisionNumber} (simulated)`}
          </button>
        </div>
      </form>
    </EditorialDialog>
  );
}

function RollbackDialog({
  strongAuth,
  targets,
  liveMarkdown,
  liveNumber,
  onLoadRevision,
  onRollback,
}: {
  strongAuth: { fresh: boolean; mechanism: string };
  targets: ReleaseView[];
  liveMarkdown: string | null;
  liveNumber: number | null;
  onLoadRevision(revisionId: string): Promise<RevisionView | string>;
  onRollback: Command<{ target: ReleaseView; reason: string }>;
}) {
  const name = useId();
  const [targetId, setTargetId] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ view: RevisionView | null; message: string | null } | null>(null);
  const target = targets.find((candidate) => candidate.id === targetId) ?? null;

  const choose = async (release: ReleaseView) => {
    setTargetId(release.id);
    setPreview(null);
    if (!release.revisionId) return;
    const loaded = await onLoadRevision(release.revisionId);
    setPreview(typeof loaded === "string" ? { view: null, message: loaded } : { view: loaded, message: null });
  };

  const summary = useMemo(() => {
    if (!preview?.view || liveMarkdown === null) return null;
    const diff = diffLines(liveMarkdown, preview.view.markdown);
    return { added: diff.added, removed: diff.removed, sections: changedSections(diff, liveMarkdown, preview.view.markdown) };
  }, [preview, liveMarkdown]);

  return (
    <ReasonDialog
      title="Roll back to an earlier release?"
      description={`Choose an earlier successful release. It goes through the same staged release as a new publication${liveNumber ? `, replacing live v${liveNumber}` : ""}.`}
      label="Reason"
      maxLength={EDITORIAL_LIMITS.reasonChars}
      confirmLabel="Request rollback (simulated)"
      tone="danger"
      canSubmit={target !== null}
      strongAuth={strongAuth}
      onOpenChange={(open) => {
        if (!open) {
          setTargetId(null);
          setPreview(null);
        }
      }}
      trigger={
        <button type="button" className={smallButtonClass}>
          Roll back…
        </button>
      }
      onConfirm={(reason) => (target ? onRollback({ target, reason }) : Promise.resolve("Choose a release to roll back to."))}
    >
      <fieldset className="flex flex-col gap-1">
        <legend className="text-sm font-medium">Release to restore (required)</legend>
        {targets.map((release) => (
          <label key={release.id} className="flex min-h-9 items-center gap-2 text-sm">
            <input
              type="radio"
              name={name}
              checked={release.id === targetId}
              onChange={() => void choose(release)}
              className="size-4 accent-(--ed-text)"
            />
            v{release.revisionNumber} · {RELEASE_OPERATION_LABELS[release.operation].toLowerCase()} · {formatAbsolute(release.updatedAt)}
          </label>
        ))}
      </fieldset>
      {target ? (
        <div className="rounded-md border border-(--ed-border) px-3 py-2 text-sm" aria-live="polite">
          {preview === null ? (
            <p>Loading v{target.revisionNumber}…</p>
          ) : preview.message ? (
            <p className="text-(--ed-danger)">{preview.message}</p>
          ) : preview.view ? (
            <>
              <p>
                Compared with the live page:{" "}
                {summary ? `+${summary.added} / −${summary.removed} lines${summary.sections.length ? ` in ${summary.sections.join(", ")}` : ""}` : "no live copy to compare"}
                .
              </p>
              <p>
                Checks re-run on v{preview.view.number} under policy <span className="font-mono">{preview.view.policy.version}</span>:{" "}
                {preview.view.issues.filter((issue) => issue.severity === "blocker").length} blocking issue(s). Safety blockers stop the
                rollback.
              </p>
            </>
          ) : null}
        </div>
      ) : null}
    </ReasonDialog>
  );
}
