"use client";

import { useCallback, useEffect, useSyncExternalStore, type ReactNode } from "react";

import { cn } from "@/lib/utils";
import { IdeaRowsHead, PublicIdeaCard, PublicIdeaRow } from "./IdeaCards";
import type { IdeaView, PublicIdea } from "./types";

const STORAGE_KEY = "wmvp:idea-view";
/** Last choice this session, so the switch still works when storage is blocked. */
let memoryView: IdeaView | null = null;

function readView(): IdeaView | null {
  try {
    const fromUrl = new URLSearchParams(window.location.search).get("view");
    if (fromUrl === "cards" || fromUrl === "rows") return fromUrl;
    if (memoryView) return memoryView;
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored === "cards" || stored === "rows" ? stored : null;
  } catch {
    return memoryView;
  }
}

const listeners = new Set<() => void>();

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  window.addEventListener("storage", onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}

const getSnapshot = (): IdeaView => readView() ?? "cards";
const getServerSnapshot = (): IdeaView => "cards";

/**
 * Cards or rows, remembered per visitor and mirrored to `?view=` so a shared
 * link keeps it. The server always renders cards; a stored preference for
 * rows applies right after hydration. Every list on the page follows one
 * choice.
 */
export function useIdeaView(): [IdeaView, (view: IdeaView) => void] {
  const view = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  // A rows preference restored from storage is mirrored into the URL too, so
  // the address a visitor shares opens the view they are looking at.
  useEffect(() => {
    if (view !== "rows") return;
    try {
      const url = new URL(window.location.href);
      if (url.searchParams.get("view") === "rows") return;
      url.searchParams.set("view", "rows");
      window.history.replaceState(window.history.state, "", url);
    } catch {
      /* history unavailable: the view itself is unaffected */
    }
  }, [view]);

  const setView = useCallback((next: IdeaView) => {
    memoryView = next;
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
      const url = new URL(window.location.href);
      if (next === "cards") url.searchParams.delete("view");
      else url.searchParams.set("view", next);
      window.history.replaceState(window.history.state, "", url);
    } catch {
      /* storage or history unavailable */
    }
    listeners.forEach((listener) => listener());
  }, []);

  return [view, setView];
}

function GridIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <rect x="4" y="4" width="7" height="7" rx="1" />
      <rect x="13" y="4" width="7" height="7" rx="1" />
      <rect x="4" y="13" width="7" height="7" rx="1" />
      <rect x="13" y="13" width="7" height="7" rx="1" />
    </svg>
  );
}

function ListIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" aria-hidden>
      <path d="M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01" />
    </svg>
  );
}

const SEG =
  "inline-flex h-[38px] min-w-11 items-center justify-center gap-2 rounded-full px-3 text-sm font-medium transition-colors duration-150 sm:px-4 " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-home-orange-ink";

/** The Cards / Rows segmented control. Labels hide on narrow phones; buttons keep their names. */
export function ViewToggle({ view, onChange, className }: { view: IdeaView; onChange: (view: IdeaView) => void; className?: string }) {
  return (
    <div role="group" aria-label="View ideas as" className={cn("inline-flex gap-0.5 rounded-full border border-home-rule bg-home-card p-1", className)}>
      {(
        [
          ["cards", "Cards", <GridIcon key="g" />],
          ["rows", "Rows", <ListIcon key="l" />],
        ] as const
      ).map(([value, label, icon]) => (
        <button
          key={value}
          type="button"
          aria-pressed={view === value}
          onClick={() => onChange(value)}
          className={cn(SEG, view === value ? "bg-home-ink text-home-paper" : "text-home-ink-2 hover:text-home-ink")}
        >
          {icon}
          <span className="max-sm:sr-only">{label}</span>
        </button>
      ))}
    </div>
  );
}

/** The list itself, in either view. Each switch crossfades (no motion when reduced). */
export function IdeaList({ ideas, view }: { ideas: PublicIdea[]; view: IdeaView }) {
  if (view === "rows") {
    return (
      <div key="rows" className="animate-in fade-in duration-150 motion-reduce:animate-none">
        <IdeaRowsHead />
        <ol className="border-t border-home-rule lg:border-t-0">
          {ideas.map((idea) => (
            <PublicIdeaRow key={idea.slug} idea={idea} />
          ))}
        </ol>
      </div>
    );
  }
  return (
    <ul key="cards" className="grid grid-cols-1 gap-5 animate-in fade-in duration-150 motion-reduce:animate-none md:grid-cols-2 lg:grid-cols-3">
      {ideas.map((idea) => (
        <li key={idea.slug}>
          <PublicIdeaCard idea={idea} />
        </li>
      ))}
    </ul>
  );
}

/**
 * A section of ideas with its heading, the view toggle and the list. `aside`
 * sits beside the toggle (for a sort control, say).
 */
export function IdeaBrowser({
  ideas,
  heading,
  headingId,
  aside,
  footer,
  empty,
}: {
  ideas: PublicIdea[];
  heading: ReactNode;
  headingId: string;
  aside?: ReactNode;
  footer?: ReactNode;
  empty?: ReactNode;
}) {
  const [view, setView] = useIdeaView();
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h2
          id={headingId}
          className="font-editorial text-[32px] font-normal leading-[1.05] tracking-[-0.02em] text-home-ink md:text-[40px]"
        >
          {heading}
        </h2>
        <div className="flex flex-wrap items-center gap-3">
          {aside}
          {ideas.length > 0 && <ViewToggle view={view} onChange={setView} />}
        </div>
      </div>
      {ideas.length > 0 ? <IdeaList ideas={ideas} view={view} /> : empty}
      {footer}
    </section>
  );
}
