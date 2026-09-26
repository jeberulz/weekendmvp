"use client";

import { useCallback, useSyncExternalStore } from "react";

export type LibraryLayout = "grid" | "list";

// A per-browser convenience (grid or list). Storage can be missing or
// blocked, so reads fall back to the grid and a blocked write still switches
// the layout for this page view through the in-memory value.
const STORAGE_KEY = "wmvp:ideas-layout";
const CHANGE_EVENT = "wmvp:ideas-layout-change";
let memory: LibraryLayout | null = null;

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}

function read(): LibraryLayout {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "grid" || stored === "list") return stored;
  } catch {
    // Fall through to memory.
  }
  return memory ?? "grid";
}

export function useLibraryLayout() {
  const layout = useSyncExternalStore(subscribe, read, () => "grid" as const);
  const setLayout = useCallback((next: LibraryLayout) => {
    memory = next;
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Blocked storage: memory keeps the choice for this page view.
    }
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }, []);
  return [layout, setLayout] as const;
}
