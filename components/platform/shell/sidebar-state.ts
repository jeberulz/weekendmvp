"use client";

import { useCallback, useSyncExternalStore } from "react";

// A per-browser convenience. Storage can be missing or blocked, so every
// read and write is guarded and the sidebar falls back to expanded.
const STORAGE_KEY = "wmvp:workspace-sidebar";
const CHANGE_EVENT = "wmvp:workspace-sidebar-change";

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}

function readCollapsed() {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "collapsed";
  } catch {
    return false;
  }
}

export function useSidebarCollapsed() {
  const collapsed = useSyncExternalStore(subscribe, readCollapsed, () => false);

  const setCollapsed = useCallback((next: boolean) => {
    try {
      window.localStorage.setItem(STORAGE_KEY, next ? "collapsed" : "expanded");
    } catch {
      // Storage is blocked: the toggle still works for this page view.
    }
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }, []);

  return [collapsed, setCollapsed] as const;
}
