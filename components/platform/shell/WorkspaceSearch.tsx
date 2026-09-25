"use client";

import { Search } from "lucide-react";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";
import { isSearchShortcut } from "./workspace-current";

export function WorkspaceSearch({ ideaCount }: { ideaCount: number | null }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const current =
    pathname === "/dashboard/explore" ? (searchParams.get("q") ?? "") : "";

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      // KeyboardEvent fields are prototype getters, so pass them explicitly.
      const shortcut = isSearchShortcut({
        key: event.key,
        metaKey: event.metaKey,
        ctrlKey: event.ctrlKey,
        altKey: event.altKey,
        defaultPrevented: event.defaultPrevented,
        target: event.target as HTMLElement | null,
      });
      if (!shortcut) return;
      event.preventDefault();
      inputRef.current?.focus();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <form
      role="search"
      action="/dashboard/explore"
      method="get"
      className="relative w-full max-w-md"
    >
      <label htmlFor="workspace-search" className="sr-only">
        Search ideas
      </label>
      <Search
        className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-home-ink-3"
        aria-hidden
      />
      <input
        ref={inputRef}
        key={current}
        id="workspace-search"
        name="q"
        type="search"
        defaultValue={current}
        maxLength={80}
        autoComplete="off"
        placeholder={ideaCount ? `Search ${ideaCount} ideas` : "Search ideas"}
        aria-keyshortcuts="/"
        className="h-10 w-full rounded-lg border border-home-rule bg-home-card pl-9 pr-10 text-sm text-home-ink outline-none transition-colors placeholder:text-home-ink-3 hover:border-home-ink-3 focus-visible:border-home-orange-ink focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-home-orange-ink"
      />
      <kbd
        aria-hidden
        className="pointer-events-none absolute right-2.5 top-1/2 hidden -translate-y-1/2 rounded border border-home-rule bg-home-paper px-1.5 font-mono text-[11px] leading-5 text-home-ink-3 sm:block"
      >
        /
      </kbd>
    </form>
  );
}
