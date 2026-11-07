"use client";

import { Check, ChevronsUpDown, Plus } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState, type FocusEvent, type KeyboardEvent } from "react";
import { FOCUS } from "@/components/workspace/kit/styles";
import { businessInitial } from "@/components/workspace/shell/nav-utils";
import type { WorkspaceBusiness } from "@/lib/workspace/businesses";
import { workspacePath } from "@/lib/workspace/routes";

export const SWITCHER_LIST_ID = "workspace-switcher-list";

export function switcherLabel(currentName: string): string {
  return `${currentName}, switch business`;
}

/**
 * Whether a blur should close the open list. Only a move to a node outside the
 * switcher closes it. A null target (a pointer press on a non-focusable link in
 * Safari or Firefox, or focus leaving the window) must not, or the list would
 * hide mid-click. A missing root never closes.
 */
export function shouldCloseOnBlur(next: EventTarget | null, root: Node | null): boolean {
  if (root === null || next === null) return false;
  // Duck-typed: the target can be a non-Node EventTarget (window), and tests run without a DOM.
  if (typeof (next as Partial<Node>).nodeType !== "number") return false;
  return !root.contains(next as Node);
}

/**
 * Disclosure, not a menu: a button toggles a plain list of links. Escape
 * closes it and returns focus to the button. It also closes, without moving
 * focus, when focus leaves it or the pointer goes down outside it, so the open
 * list never covers the nav links a keyboard user lands on next.
 * "Start a second idea" is a disabled row (Growth gate copy) that creates
 * nothing and points nowhere.
 */
export function BusinessSwitcher({
  currentId,
  businesses,
  subline,
}: {
  currentId: string;
  businesses: readonly WorkspaceBusiness[];
  /** The current business's sub-line, e.g. "Web app · Free for now". Omitted when unknown. */
  subline?: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const current = businesses.find((business) => business.id === currentId) ?? businesses[0];
  const currentName = current?.name ?? "Business";

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (rootRef.current && event.target instanceof Node && !rootRef.current.contains(event.target)) setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "Escape" || !open) return;
    event.stopPropagation();
    setOpen(false);
    buttonRef.current?.focus();
  }

  function onBlur(event: FocusEvent<HTMLDivElement>) {
    if (shouldCloseOnBlur(event.relatedTarget, rootRef.current)) setOpen(false);
  }

  return (
    <div ref={rootRef} onKeyDown={onKeyDown} onBlur={onBlur} className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls={SWITCHER_LIST_ID}
        onClick={() => setOpen((value) => !value)}
        className={`flex min-h-[52px] w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left hover:bg-home-sunk ${FOCUS}`}
      >
        <span
          aria-hidden="true"
          className="flex size-8 shrink-0 items-center justify-center rounded-md bg-home-sky-ink text-sm font-semibold text-home-card"
        >
          {businessInitial(currentName)}
        </span>
        <span className="flex min-w-0 flex-1 flex-col leading-tight">
          <span className="truncate font-editorial text-base text-home-ink">{currentName}</span>
          {subline === undefined || subline === "" ? null : (
            <span className="truncate text-[11px] uppercase tracking-[0.12em] text-home-ink-3">{subline}</span>
          )}
        </span>
        <span className="sr-only">, switch business</span>
        <ChevronsUpDown aria-hidden="true" className="size-3.5 shrink-0 text-home-ink-3" />
      </button>
      <div
        id={SWITCHER_LIST_ID}
        hidden={!open}
        className="absolute inset-x-0 top-full z-20 mt-1 rounded-lg border border-home-rule bg-home-card p-1 shadow-sm"
      >
        <ul className="flex flex-col gap-0.5">
          {businesses.map((business) => {
            const isCurrent = business.id === currentId;
            return (
              <li key={business.id}>
                <Link
                  href={workspacePath(business.id)}
                  aria-current={isCurrent ? "true" : undefined}
                  onClick={() => setOpen(false)}
                  className={`flex min-h-10 items-center gap-2 rounded-md px-2.5 text-[13px] text-home-ink hover:bg-home-sunk ${FOCUS}`}
                >
                  <span className="min-w-0 flex-1 truncate">{business.name}</span>
                  {isCurrent ? <Check aria-hidden="true" className="size-4 shrink-0 text-home-sage-ink" /> : null}
                </Link>
              </li>
            );
          })}
        </ul>
        <ul className="mt-1 border-t border-home-rule pt-1">
          <li className="px-2.5 py-2 text-[13px] text-home-ink-2">
            <span className="flex items-center gap-2">
              <Plus aria-hidden="true" className="size-4 shrink-0" />
              <span className="flex-1">Start a second idea</span>
              <span className="rounded-full bg-home-sage px-2 py-0.5 text-xs font-medium text-home-sage-ink">Growth</span>
            </span>
            <span className="mt-1 block text-[11px] text-home-ink-3">
              Running a second business needs Growth. Not available yet.
            </span>
          </li>
        </ul>
      </div>
    </div>
  );
}
