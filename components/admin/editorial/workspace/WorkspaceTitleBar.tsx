"use client";

import { ChevronDown } from "lucide-react";
import Link from "next/link";
import { DropdownMenu } from "radix-ui";
import type { ReactNode, Ref } from "react";

import type { IdeaDetail, RevisionView } from "@/lib/editorial/contracts/views";
import type { SaveControllerState } from "@/lib/editorial/editor/save-controller";
import { PUBLICATION_LABELS, REVIEW_LABELS, REVISION_KIND_LABELS, pendingOperationLabel } from "@/lib/editorial/presentation/format";
import { ORIGIN_LABELS } from "@/lib/editorial/presentation/metadata-labels";
import { cn } from "@/lib/utils";
import styles from "../editorial.module.css";
import { StatusBadge, buttonClass, linkClass } from "../common/primitives";
import { EDITORIAL_BASE } from "../shell/nav-items";
import { SaveStatus } from "./SaveStatus";
import { menuItemClass } from "./ui";

export type MenuAction = { key: string; label: string; onSelect(): void; disabled?: boolean; destructive?: boolean };

/**
 * Title, revision and save state. The selected revision, the live revision,
 * the origin, the save state and the review state are always visible.
 */
export function WorkspaceTitleBar({
  detail,
  view,
  title,
  saveState,
  metadataInvalid,
  primaryAction,
  menuActions,
  moreRef,
  onRetry,
  onShowConflict,
}: {
  detail: IdeaDetail;
  view: RevisionView;
  title: string;
  saveState: SaveControllerState;
  metadataInvalid: boolean;
  primaryAction: ReactNode;
  menuActions: MenuAction[];
  moreRef: Ref<HTMLButtonElement>;
  onRetry(): void;
  onShowConflict(): void;
}) {
  const idea = detail.idea;
  const editing = view.kind === "draft" && !view.readOnly;
  const selection = `${editing ? "Editing" : "Viewing"} v${view.number}${view.kind === "draft" ? "" : ` · ${REVISION_KIND_LABELS[view.kind]}`}`;
  const live = idea.liveRevision ? `Live v${idea.liveRevision.number}` : PUBLICATION_LABELS[idea.publication];
  const review = view.kind === "legacy_snapshot" ? "Not under review" : REVIEW_LABELS[view.reviewState];
  const pending = pendingOperationLabel(idea);

  return (
    <header className="border-b border-(--ed-border) bg-(--ed-surface) px-4 py-4 sm:px-6">
      <p className="text-sm">
        <Link href={EDITORIAL_BASE} className={`${linkClass} text-(--ed-text-2)`}>
          Review queue
        </Link>
        <span aria-hidden="true" className="px-1.5 text-(--ed-text-2)">
          /
        </span>
        <Link href={`${EDITORIAL_BASE}/library`} className={`${linkClass} text-(--ed-text-2)`}>
          Library
        </Link>
      </p>
      <div className="mt-2 flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="min-w-0 flex-1 basis-80">
          <h1
            id="workspace-heading"
            tabIndex={-1}
            className="break-words rounded text-[1.75rem] font-semibold leading-tight tracking-tight outline-hidden focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-(--ed-focus)"
          >
            {title.trim() || "Untitled idea"}
          </h1>
          <ul aria-label="Revision status" className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm">
            <li className="font-mono">{live}</li>
            <li aria-hidden="true" className="text-(--ed-text-2)">
              ·
            </li>
            <li className="font-mono font-semibold">{selection}</li>
            <li>
              <StatusBadge>{ORIGIN_LABELS[idea.origin]}</StatusBadge>
            </li>
            <li>
              <StatusBadge
                tone={
                  view.reviewState === "approved" ? "success" : view.reviewState === "changes_requested" ? "warning" : "neutral"
                }
              >
                Review: {review}
              </StatusBadge>
            </li>
            {pending ? (
              <li>
                <StatusBadge tone="info">{pending}</StatusBadge>
              </li>
            ) : null}
          </ul>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <SaveStatus state={saveState} metadataInvalid={metadataInvalid} onRetry={onRetry} onShowConflict={onShowConflict} />
          {primaryAction}
          {menuActions.length > 0 ? (
            <DropdownMenu.Root>
              <DropdownMenu.Trigger asChild>
                <button ref={moreRef} type="button" className={buttonClass.secondary}>
                  More actions
                  <ChevronDown aria-hidden="true" className="size-4" />
                </button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content
                  align="end"
                  sideOffset={6}
                  collisionPadding={16}
                  className={cn(
                    styles.theme,
                    "z-50 min-w-60 rounded-md border border-(--ed-border-strong) bg-(--ed-surface) p-1 shadow-md",
                  )}
                >
                  {menuActions.map((action) => (
                    <DropdownMenu.Item
                      key={action.key}
                      disabled={action.disabled}
                      onSelect={action.onSelect}
                      className={cn(menuItemClass, action.destructive && "text-(--ed-danger)")}
                    >
                      {action.label}
                    </DropdownMenu.Item>
                  ))}
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>
          ) : null}
        </div>
      </div>
    </header>
  );
}
