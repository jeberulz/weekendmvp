"use client";

import { useQuery } from "convex/react";
import { MessageCircle, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { QuietErrorBoundary, WhenConvexReady } from "@/components/platform/client-gates";
import { WrenChatPanel } from "@/components/workspace/chat/WrenChatPanel";
import { DEFAULT_PARTNER_NAME } from "@/components/workspace/kit/WrenCards";
import { FOCUS } from "@/components/workspace/kit/styles";
import { workspacePath } from "@/lib/workspace/routes";
import { onWrenPrefill } from "@/lib/workspace/wrenPrefill";

export const CHAT_COLUMN_ID = "workspace-chat";

/** The toggle's visible text and the aside's name. */
export function chatColumnLabel(name: string): string {
  return `Chat with ${name}`;
}

function TeamCount({ projectId }: { projectId: Id<"projects"> }) {
  const launch = useQuery(api.crew.roster.launchStatus, { projectId });
  if (launch === undefined || launch.state !== "ready") return null;
  return (
    <>
      {" · "}
      <Link
        href={workspacePath(projectId, "team")}
        className={`text-home-orange-ink underline-offset-2 hover:text-home-ink hover:underline ${FOCUS}`}
      >
        {`team of ${launch.hired.length.toString()}`}
      </Link>
    </>
  );
}

/**
 * The right-hand chat column, mounted once by the layout so it persists across
 * page navigation. From `xl` up it is the board's full-height sticky column
 * (360px, 380px at 2xl). Below `xl` it collapses behind a visible
 * "Chat with {name}" button into a drawer on the right with its own Close
 * button. The drawer is non-modal: Escape closes it, focus moves to its Close
 * button on open and back to the toggle on close.
 *
 * It is always mounted (hidden with CSS when closed), so the conversation and
 * a streaming reply carry on while the drawer is shut.
 */
export function WrenChatColumn({
  projectId,
  name = DEFAULT_PARTNER_NAME,
}: {
  projectId: Id<"projects">;
  /** The co-founder's name (`projects.workspace.partner.name`). "Wren" only when it is missing. */
  name?: string;
}) {
  const [open, setOpen] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(false);
  /** Opened by a page's "Ask Wren": the composer takes focus, not the Close button. */
  const openedForPrefill = useRef(false);
  const label = chatColumnLabel(name);

  // Focus follows the drawer: into it on open, back to the toggle on close.
  useEffect(() => {
    if (open && !openedForPrefill.current) closeRef.current?.focus();
    else if (!open && wasOpen.current) toggleRef.current?.focus();
    openedForPrefill.current = false;
    wasOpen.current = open;
  }, [open]);

  // A page asked Wren something: show the drawer (below `xl`); the composer fills itself and takes focus.
  useEffect(() => onWrenPrefill(() => {
    // `wasOpen` mirrors the committed state: an open drawer needs no reopening.
    if (wasOpen.current) return;
    openedForPrefill.current = true;
    setOpen(true);
  }), []);

  function onKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key !== "Escape" || !open) return;
    event.stopPropagation();
    setOpen(false);
  }

  return (
    <>
      <button
        ref={toggleRef}
        type="button"
        aria-expanded={open}
        aria-controls={CHAT_COLUMN_ID}
        onClick={() => setOpen(true)}
        className={`fixed bottom-4 right-4 z-30 inline-flex min-h-11 items-center gap-2 rounded-full bg-home-ink px-4 text-sm font-medium text-home-card shadow-md hover:bg-home-panel xl:hidden ${open ? "hidden" : ""} ${FOCUS}`}
      >
        <MessageCircle aria-hidden="true" className="size-4" />
        {label}
      </button>
      <aside
        id={CHAT_COLUMN_ID}
        aria-label={label}
        onKeyDown={onKeyDown}
        className={`${open ? "fixed inset-y-0 right-0 z-40 flex w-full max-w-[420px] border-l shadow-lg" : "hidden"} flex-col border-home-rule bg-home-card xl:sticky xl:bottom-auto xl:right-auto xl:top-0 xl:flex xl:h-dvh xl:w-[360px] xl:max-w-none xl:shrink-0 xl:border-l xl:shadow-none 2xl:w-[380px]`}
      >
        <div className="flex items-center justify-between gap-2 border-b border-home-rule px-3.5 py-3">
          <div className="flex min-w-0 flex-col leading-[1.15]">
            <h2 className="truncate font-editorial text-[22px] font-normal text-home-ink">{name}</h2>
            <p className="text-[11px] uppercase tracking-[0.12em] text-home-ink-3">
              Crew Lead
              <WhenConvexReady>
                <QuietErrorBoundary>
                  <TeamCount projectId={projectId} />
                </QuietErrorBoundary>
              </WhenConvexReady>
            </p>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={() => setOpen(false)}
            className={`inline-flex size-10 shrink-0 items-center justify-center rounded-md text-home-ink-2 hover:bg-home-sunk hover:text-home-ink xl:hidden ${FOCUS}`}
          >
            <X aria-hidden="true" className="size-4" />
            <span className="sr-only">{`Close chat with ${name}`}</span>
          </button>
        </div>
        <WrenChatPanel projectId={projectId} name={name} />
      </aside>
    </>
  );
}
